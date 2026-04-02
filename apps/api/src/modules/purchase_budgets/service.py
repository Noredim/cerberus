from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from copy import deepcopy
from typing import List, Optional

from fastapi import HTTPException

from .models import PurchaseBudget, PurchaseBudgetItem, PurchaseBudgetNegotiation, PurchaseBudgetNegotiationItem, PaymentCondition
from .schemas import (
    PurchaseBudgetCreate, 
    PurchaseBudgetNegotiationCreate, 
    FreightTypeEnum,
    PaymentConditionCreate
)
from src.modules.products.models import Product, ProductSupplier
import io
import openpyxl

class PurchaseBudgetService:
    @staticmethod
    def get_budgets(db: Session, tenant_id: str, skip: int = 0, limit: int = 100, supplier_id: Optional[str] = None, sales_budget_id: Optional[UUID] = None):
        # returns budgets with nested supplier and items
        query = db.query(PurchaseBudget).filter(PurchaseBudget.tenant_id == tenant_id)
        if supplier_id:
            query = query.filter(PurchaseBudget.supplier_id == supplier_id)
        if sales_budget_id:
            query = query.filter(PurchaseBudget.sales_budget_id == sales_budget_id)
        return query.order_by(PurchaseBudget.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_budget_by_id(db: Session, tenant_id: str, budget_id: UUID) -> PurchaseBudget:
        budget = db.query(PurchaseBudget).filter(PurchaseBudget.id == budget_id, PurchaseBudget.tenant_id == tenant_id).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")
        return budget

    @staticmethod
    def sync_product_reference_prices(db: Session, product_id: str, tenant_id: str):
        """
        Recalculates product reference prices by looking up the latest REVENDA budget
        and the latest ATIVO_IMOBILIZADO_USO_CONSUMO budget.
        
        Rules:
        - REVENDA budget: updates VLR_REVENDA (cost + st) and derives VLR_USO_CONSUMO (cost + difal).
        - USO_CONSUMO budget: updates ONLY VLR_USO_CONSUMO natively.
        - If USO_CONSUMO is newer than REVENDA, USO_CONSUMO overrides VLR_USO_CONSUMO. VLR_REVENDA is kept from the older REVENDA.
        """
        from src.modules.products.service import ProductService
        from src.modules.ncm.services.ncm_service import NcmService
        
        product = db.query(Product).filter(Product.id == product_id).first()
        if not product:
            return

        now = datetime.now()
        prod_service = ProductService(db)
        ncm_service = NcmService(db)

        # 1. Fetch all budget items for this product in descending order of budget date
        items_desc = db.query(PurchaseBudgetItem).join(PurchaseBudget).filter(
            PurchaseBudgetItem.product_id == product_id,
            PurchaseBudget.tenant_id == tenant_id
        ).order_by(PurchaseBudget.data_orcamento.desc(), PurchaseBudget.created_at.desc()).all()

        latest_revenda = None
        latest_uso_consumo = None

        for item in items_desc:
            budget = item.budget
            if not budget: continue
            
            if budget.tipo_orcamento == "REVENDA" and not latest_revenda:
                latest_revenda = item
            elif budget.tipo_orcamento == "ATIVO_IMOBILIZADO_USO_CONSUMO" and not latest_uso_consumo:
                latest_uso_consumo = item
                
            if latest_revenda and latest_uso_consumo:
                break

        def _calculate_costs(item: PurchaseBudgetItem, is_revenda: bool):
            budget = item.budget
            ALIQ_INTERNA_DESTINO = 0.17 
            FATOR_BIT = 0.4117
            DESCONTO_CREDITO_OUTORGADO = 0.12
            ALIQUOTA_INTERESTADUAL_PADRAO = 0.12

            final_valor_unitario = float(item.valor_unitario)
            if budget.negotiations:
                latest_neg = sorted(budget.negotiations, key=lambda x: x.data_negociacao, reverse=True)[0]
                for n_item in latest_neg.items:
                    if n_item.budget_item_id == item.id and float(item.quantidade) > 0:
                        final_valor_unitario = float(n_item.valor_final) / float(item.quantidade)

            frete_unit = float(item.frete_valor) / float(item.quantidade) if float(item.quantidade) > 0 else 0
            ipi_unit = float(item.ipi_valor) / float(item.quantidade) if float(item.quantidade) > 0 else 0

            # --- DETERMINE COMPONENT FLAGS ---
            st_flag = False
            mva_percent = 0.0
            bit_flag = False
            
            if product.ncm_codigo:
                mva_data = prod_service.get_product_mva(budget.tenant_id, product.ncm_codigo, str(budget.company_id), "REVENDA")
                if mva_data:
                    st_flag = True
                    mva_percent = float(mva_data.get("mva_percent", 0))
                
                benefits = ncm_service.get_linked_benefits(product.ncm_codigo)
                benefits = [b for b in benefits if str(b.tenant_id) == str(budget.tenant_id)]
                if any("BIT" in (b.nome or "").upper() for b in benefits):
                    bit_flag = True

            # --- DETERMINE INTERSTATE OPERATION ---
            from src.modules.companies.models import Company
            from src.modules.catalog.models import State
            company = db.query(Company).filter(Company.id == str(budget.company_id)).first()
            uf_destino = "MT"
            if company and company.state_id:
                state = db.query(State).filter(State.id == company.state_id).first()
                if state:
                    uf_destino = state.sigla.upper()
            uf_origem = budget.supplier.uf.upper() if (budget.supplier and budget.supplier.uf) else "SP"
            op_interestadual = (uf_origem != uf_destino)

            icms_from_budget = float(item.icms_percent)
            icms_entrada_effective = icms_from_budget if icms_from_budget <= 4 else 7

            # --- CALCULATE ST (only for interstate operations and products) ---
            calc_icms_st_final = 0.0
            if st_flag and op_interestadual and product.tipo == 'EQUIPAMENTO':
                cred = icms_entrada_effective / 100.0
                base_com_mva = (final_valor_unitario + ipi_unit) * (1 + (mva_percent / 100.0))
                
                if bit_flag:
                    icms_st_saida = base_com_mva * FATOR_BIT * ALIQ_INTERNA_DESTINO
                    icms_credito = final_valor_unitario * FATOR_BIT * cred
                    calc_icms_st_final = max(0.0, icms_st_saida - icms_credito)
                else:
                    icms_st_bruto = base_com_mva * ALIQ_INTERNA_DESTINO - final_valor_unitario * cred
                    icms_st_protegido = max(0.0, icms_st_bruto)
                    calc_icms_st_final = max(0.0, icms_st_protegido * (1 - DESCONTO_CREDITO_OUTORGADO))

            # --- CALCULATE DIFAL (only for products) ---
            c_valor_difal = 0.0
            
            if op_interestadual and product.tipo == 'EQUIPAMENTO':
                # Use the actual budget item ICMS instead of the hardcoded 12%
                aliquota_origem = float(item.icms_percent) / 100.0 if item.icms_percent else 0.12
                
                base_com_ipi_e_frete = final_valor_unitario + ipi_unit + frete_unit
                c_icms_origem = base_com_ipi_e_frete * aliquota_origem
                base_sem_icms = base_com_ipi_e_frete - c_icms_origem
                divisor = 1 - ALIQ_INTERNA_DESTINO
                
                if divisor > 0:
                    c_base_calculo_difal = base_sem_icms / divisor
                    c_icms_destino = c_base_calculo_difal * ALIQ_INTERNA_DESTINO
                    c_valor_difal_base = c_icms_destino - c_icms_origem
                    
                    if not is_revenda:
                        c_valor_difal = c_valor_difal_base
                    else:
                        diff_difal_st = c_valor_difal_base - calc_icms_st_final
                        if diff_difal_st > 0:
                            c_valor_difal = calc_icms_st_final + diff_difal_st
                        else:
                            c_valor_difal = c_valor_difal_base

            return {
                "custo_revenda": final_valor_unitario + ipi_unit + frete_unit + calc_icms_st_final,
                "custo_uso_consumo": final_valor_unitario + ipi_unit + frete_unit + c_valor_difal,
                "valor_difal": c_valor_difal,
                "budget_id": budget.id,
                "date": budget.data_orcamento or budget.created_at
            }

        # Clear existing
        product.vlr_referencia_revenda = None
        product.orcamento_referencia_revenda_id = None
        
        product.vlr_referencia_uso_consumo = None
        product.vlr_referencia_difal = None
        product.orcamento_referencia_uso_consumo_id = None
        product.origem_valor_uso_consumo = None

        revenda_res = None
        uso_res = None

        if latest_revenda:
            revenda_res = _calculate_costs(latest_revenda, True)
            product.vlr_referencia_revenda = revenda_res["custo_revenda"]
            product.orcamento_referencia_revenda_id = revenda_res["budget_id"]
            product.data_atualizacao_revenda = now
            
            # Sub-derive uso_consumo
            product.vlr_referencia_uso_consumo = revenda_res["custo_uso_consumo"]
            product.vlr_referencia_difal = revenda_res["valor_difal"]
            product.origem_valor_uso_consumo = "DERIVADO_REVENDA"
            product.orcamento_referencia_uso_consumo_id = revenda_res["budget_id"]
            product.data_atualizacao_uso_consumo = now

        if latest_uso_consumo:
            uso_res = _calculate_costs(latest_uso_consumo, False)
            
            # Overwrite uso/consumo if the native ATIVO budget is NEWER than the derived REVENDA
            # Or if there is no revenda budget at all
            if not revenda_res or (uso_res["date"] >= revenda_res["date"]):
                product.vlr_referencia_uso_consumo = uso_res["custo_uso_consumo"]
                product.vlr_referencia_difal = uso_res["valor_difal"]
                product.origem_valor_uso_consumo = "ORCAMENTO_USO_CONSUMO"
                product.orcamento_referencia_uso_consumo_id = uso_res["budget_id"]
                product.data_atualizacao_uso_consumo = now

    @staticmethod
    def _update_product_reference_prices(db: Session, budget: PurchaseBudget):
        """
        Wrapper to find all unique products in a budget and run the full resync.
        """
        product_ids = {item.product_id for item in budget.items}
        for pid in product_ids:
            PurchaseBudgetService.sync_product_reference_prices(db, str(pid), budget.tenant_id)

    @staticmethod
    def calculate_item_totals(frete_tipo: str, frete_percent_cabecalho: float, ipi_calculado: bool, item: dict):
        # item is a dict with incoming data
        valor_unitario = float(item.get("valor_unitario", 0))
        quantidade = float(item.get("quantidade", 1))
        
        # Freight logic
        if frete_tipo == FreightTypeEnum.CIF:
            frete_percent = 0
        else: # FOB
            # Se item nao tiver frete percent, herda do cabecalho
            frete_percent = item.get("frete_percent")
            if frete_percent is None:
                frete_percent = frete_percent_cabecalho
            frete_percent = float(frete_percent)
        
        frete_valor = valor_unitario * (frete_percent / 100) * quantidade
        
        # IPI logic
        ipi_percent = float(item.get("ipi_percent", 0))
        ipi_valor = valor_unitario * (ipi_percent / 100) * quantidade
        
        frete_unitario = valor_unitario * (frete_percent / 100)
        ipi_unitario = valor_unitario * (ipi_percent / 100)

        if ipi_calculado:
            # IPI já calculado
            base_unitario = valor_unitario + frete_unitario
        else:
            # IPI NÃO calculado
            base_unitario = valor_unitario + frete_unitario + ipi_unitario
            
        total_item = base_unitario * quantidade

        return {
            "frete_percent": frete_percent,
            "frete_valor": frete_valor,
            "ipi_percent": ipi_percent,
            "ipi_valor": ipi_valor,
            "total_item": total_item
        }

    @staticmethod
    def create_budget(db: Session, tenant_id: str, company_id: UUID, data: PurchaseBudgetCreate) -> PurchaseBudget:
        db_budget = PurchaseBudget(
            tenant_id=tenant_id,
            company_id=company_id,
            supplier_id=data.supplier_id,
            payment_condition_id=data.payment_condition_id,
            data_orcamento=data.data_orcamento,
            validade=data.validade,
            numero_orcamento=data.numero_orcamento,
            vendedor_nome=data.vendedor_nome,
            vendedor_telefone=data.vendedor_telefone,
            vendedor_email=data.vendedor_email,
            tipo_orcamento=data.tipo_orcamento,
            frete_tipo=data.frete_tipo,
            frete_percent=data.frete_percent,
            ipi_calculado=data.ipi_calculado,
            sales_budget_id=data.sales_budget_id
        )
        db.add(db_budget)
        db.flush() # To get ID
        for item_data in data.items:
            # We calculate totals just in case
            totals = PurchaseBudgetService.calculate_item_totals(db_budget.frete_tipo, float(db_budget.frete_percent), db_budget.ipi_calculado, item_data.model_dump())
            db_item = PurchaseBudgetItem(
                budget_id=db_budget.id,
                product_id=item_data.product_id,
                codigo_fornecedor=item_data.codigo_fornecedor,
                ncm=item_data.ncm,
                quantidade=item_data.quantidade,
                valor_unitario=item_data.valor_unitario,
                frete_percent=totals["frete_percent"],
                frete_valor=totals["frete_valor"],
                ipi_percent=item_data.ipi_percent,
                ipi_valor=totals["ipi_valor"],
                icms_percent=item_data.icms_percent,
                total_item=totals["total_item"]
            )
            db.add(db_item)
            
        db.commit()
        db.refresh(db_budget)
        
        # Fire reference price rule
        PurchaseBudgetService._update_product_reference_prices(db, db_budget)
        db.commit()
        
        return db_budget

    @staticmethod
    def update_budget(db: Session, tenant_id: str, company_id: UUID, budget_id: UUID, data) -> PurchaseBudget:
        db_budget = db.query(PurchaseBudget).filter(PurchaseBudget.id == budget_id, PurchaseBudget.tenant_id == tenant_id).first()
        if not db_budget:
            raise HTTPException(status_code=404, detail="Budget not found")
        
        old_product_ids = {item.product_id for item in db_budget.items}
        
        db_budget.supplier_id = data.supplier_id
        db_budget.payment_condition_id = data.payment_condition_id
        db_budget.numero_orcamento = data.numero_orcamento
        db_budget.data_orcamento = data.data_orcamento
        db_budget.validade = data.validade
        db_budget.vendedor_nome = data.vendedor_nome
        db_budget.vendedor_telefone = data.vendedor_telefone
        db_budget.vendedor_email = data.vendedor_email
        db_budget.tipo_orcamento = data.tipo_orcamento
        db_budget.frete_tipo = data.frete_tipo
        db_budget.frete_percent = data.frete_percent
        db_budget.ipi_calculado = data.ipi_calculado
        db_budget.sales_budget_id = data.sales_budget_id
        
        # Delete old items
        db.query(PurchaseBudgetItem).filter(PurchaseBudgetItem.budget_id == budget_id).delete()
        db.flush()

        for item_data in data.items:
            totals = PurchaseBudgetService.calculate_item_totals(
                db_budget.frete_tipo, float(db_budget.frete_percent), db_budget.ipi_calculado, item_data.model_dump()
            )
            db_item = PurchaseBudgetItem(
                budget_id=db_budget.id,
                product_id=item_data.product_id,
                codigo_fornecedor=item_data.codigo_fornecedor,
                ncm=item_data.ncm,
                quantidade=item_data.quantidade,
                valor_unitario=item_data.valor_unitario,
                frete_percent=totals["frete_percent"],
                frete_valor=totals["frete_valor"],
                ipi_percent=item_data.ipi_percent,
                ipi_valor=totals["ipi_valor"],
                icms_percent=item_data.icms_percent,
                total_item=totals["total_item"]
            )
            db.add(db_item)

        db.commit()
        db.refresh(db_budget)
        
        PurchaseBudgetService._update_product_reference_prices(db, db_budget)
        for old_pid in old_product_ids:
            PurchaseBudgetService.sync_product_reference_prices(db, str(old_pid), tenant_id)
        db.commit()
            
        return db_budget

    @staticmethod
    def add_negotiation(db: Session, tenant_id: str, budget_id: UUID, data: PurchaseBudgetNegotiationCreate) -> PurchaseBudgetNegotiation:
        # Verifica orcamento
        budget = db.query(PurchaseBudget).filter(PurchaseBudget.id == budget_id, PurchaseBudget.tenant_id == tenant_id).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")
            
        negotiation = PurchaseBudgetNegotiation(
            budget_id=budget_id,
            data_negociacao=data.data_negociacao,
            desconto_percent=data.desconto_percent
        )
        db.add(negotiation)
        db.flush()
        
        items_dict = {str(i.id): i for i in budget.items}
        
        # update the product prices and logic
        for neg_item in data.items:
            b_item = items_dict.get(str(neg_item.budget_item_id))
            if not b_item:
                continue
                
            valor_original = float(b_item.total_item)
            
            # Descobrir o valor_final
            if data.desconto_percent and data.desconto_percent > 0:
                valor_final = valor_original * (1 - (float(data.desconto_percent)/100))
            elif neg_item.desconto_percent and neg_item.desconto_percent > 0:
                valor_final = valor_original * (1 - (float(neg_item.desconto_percent)/100))
            elif neg_item.valor_final is not None:
                valor_final = float(neg_item.valor_final)
            else:
                valor_final = valor_original
                
            n_item = PurchaseBudgetNegotiationItem(
                negotiation_id=negotiation.id,
                budget_item_id=b_item.id,
                valor_original=valor_original,
                desconto_percent=neg_item.desconto_percent,
                valor_final=valor_final
            )
            db.add(n_item)
            
            # ATUALIZAÇÃO DO PRODUTO (PRD 17)
            # Sistema atualiza no produto: ultimo_preco_compra, data_ultimo_preco, fornecedor_ultimo_preco
            product = db.query(Product).filter(Product.id == b_item.product_id).first()
            if product:
                product.ultimo_preco_compra = valor_final
                product.data_ultimo_preco = data.data_negociacao
                product.fornecedor_ultimo_preco_id = budget.supplier_id
                
        db.commit()
        db.refresh(negotiation)
        
        # Re-fire reference price rule after negotiation
        PurchaseBudgetService._update_product_reference_prices(db, budget)
        db.commit()
        
        return negotiation

    @staticmethod
    def get_payment_conditions(db: Session, tenant_id: str):
        return db.query(PaymentCondition).filter(PaymentCondition.tenant_id == tenant_id).all()

    @staticmethod
    def create_payment_condition(db: Session, tenant_id: str, data: PaymentConditionCreate):
        cond = PaymentCondition(
            tenant_id=tenant_id,
            descricao=data.descricao,
            prazo=data.prazo,
            parcelas=data.parcelas
        )
        db.add(cond)
        db.commit()
        db.refresh(cond)
        return cond

    @staticmethod
    def parse_excel_items(db: Session, tenant_id: str, supplier_id: str, file_bytes: bytes):
        workbook = openpyxl.load_workbook(io.BytesIO(file_bytes), data_only=True)
        sheet = workbook.active
        
        headers = {}
        for idx, cell in enumerate(sheet[1]):
            if cell.value:
                headers[str(cell.value).strip().lower()] = idx
                
        col_codigo = headers.get("codigo_fornecedor") if "codigo_fornecedor" in headers else headers.get("codigo")
        col_descricao = headers.get("descricao") if "descricao" in headers else headers.get("produto")
        col_ncm = headers.get("ncm")
        
        col_valor = headers.get("valor_unitario")
        if col_valor is None: col_valor = headers.get("valor")
        if col_valor is None: col_valor = headers.get("preco")
        
        col_qtd = headers.get("quantidade")
        if col_qtd is None: col_qtd = headers.get("qtd")
        if col_qtd is None: col_qtd = headers.get("qtd.")
        if col_qtd is None: col_qtd = headers.get("quant")
        if col_qtd is None: col_qtd = headers.get("quant.")
        
        col_frete = headers.get("frete_percent") if "frete_percent" in headers else headers.get("frete")
        col_ipi = headers.get("ipi_percent") if "ipi_percent" in headers else headers.get("ipi_percentual") if "ipi_percentual" in headers else headers.get("ipi")
        col_icms = headers.get("icms_percent") if "icms_percent" in headers else headers.get("icms_percentual") if "icms_percentual" in headers else headers.get("icms")
        
        if col_codigo is None or col_valor is None:
            raise HTTPException(status_code=400, detail="Planilha deve conter as colunas 'codigo' e 'valor'")
            
        encontrados = []
        nao_encontrados = []
        
        supplier_prods = db.query(ProductSupplier, Product).join(Product, ProductSupplier.product_id == Product.id).filter(
            ProductSupplier.supplier_id == supplier_id,
            Product.tenant_id == tenant_id
        ).all()
        
        map_codigo_produto = {sp.ProductSupplier.codigo_externo: {"id": str(sp.Product.id), "nome": sp.Product.nome, "codigo": sp.Product.codigo, "ncm": sp.Product.ncm_codigo} for sp in supplier_prods}
        
        # Evitar loops vazios
        for row_raw in sheet.iter_rows(min_row=2, values_only=True):
            if not isinstance(row_raw, tuple):
                continue
            row = list(row_raw)
                
            c_cod = int(col_codigo) if isinstance(col_codigo, int) else -1
            c_desc = int(col_descricao) if isinstance(col_descricao, int) else -1
            c_val = int(col_valor) if isinstance(col_valor, int) else -1
            c_qtd = int(col_qtd) if isinstance(col_qtd, int) else -1
            c_ncm = int(col_ncm) if isinstance(col_ncm, int) else -1
            c_frete = int(col_frete) if isinstance(col_frete, int) else -1
            c_ipi = int(col_ipi) if isinstance(col_ipi, int) else -1
            c_icms = int(col_icms) if isinstance(col_icms, int) else -1
            
            codigo_raw = row[c_cod] if c_cod >= 0 and len(row) > c_cod else None
            if codigo_raw is None:
                continue
                
            codigo = str(codigo_raw).strip()
            if not codigo:
                continue
            
            descricao = row[c_desc] if c_desc >= 0 and len(row) > c_desc else None
            
            val = row[c_val] if c_val >= 0 and len(row) > c_val else 0
            qtd = row[c_qtd] if c_qtd >= 0 and len(row) > c_qtd else 1
            ncm_raw = row[c_ncm] if c_ncm >= 0 and len(row) > c_ncm else None
            frete = row[c_frete] if c_frete >= 0 and len(row) > c_frete else 0
            ipi = row[c_ipi] if c_ipi >= 0 and len(row) > c_ipi else 0
            icms = row[c_icms] if c_icms >= 0 and len(row) > c_icms else 0
            
            try: val = float(val) if val else 0
            except: val = 0
            try: qtd = float(qtd) if qtd else 1
            except: qtd = 1
            try: frete = float(frete) if frete else 0
            except: frete = 0
            try: ipi = float(ipi) if ipi else 0
            except: ipi = 0
            try: icms = float(icms) if icms else 0
            except: icms = 0
            
            item_data: dict = {
                "codigo_fornecedor": codigo,
                "descricao": str(descricao).strip() if descricao else "",
                "ncm": str(ncm_raw).strip() if ncm_raw else None,
                "quantidade": qtd,
                "valor_unitario": val,
                "frete_percent": frete,
                "ipi_percent": ipi,
                "icms_percent": icms
            }
            
            prod = map_codigo_produto.get(codigo)
            if prod:
                item_data["product"] = prod
                encontrados.append(item_data)
            else:
                nao_encontrados.append(item_data)
                
        return {
            "encontrados": encontrados,
            "nao_encontrados": nao_encontrados
        }

    @staticmethod
    def link_supplier_product(db: Session, tenant_id: str, supplier_id: str, product_id: UUID, codigo_fornecedor: str) -> ProductSupplier:
        # Prevent UniqueConstraint violation
        existing_code = db.query(ProductSupplier).filter(
            ProductSupplier.supplier_id == str(supplier_id),
            ProductSupplier.codigo_externo == codigo_fornecedor,
            ProductSupplier.product_id != product_id
        ).first()
        
        if existing_code:
            raise HTTPException(status_code=400, detail="Este código de fornecedor já está vinculado a outro produto deste fornecedor.")

        ps = db.query(ProductSupplier).filter(
            ProductSupplier.supplier_id == str(supplier_id),
            ProductSupplier.product_id == product_id
        ).first()

        if ps:
            ps.codigo_externo = codigo_fornecedor
        else:
            ps = ProductSupplier(
                supplier_id=supplier_id,
                product_id=product_id,
                codigo_externo=codigo_fornecedor,
                unidade="UN",
                fator_conversao="1"
            )
            db.add(ps)
        db.commit()
        db.refresh(ps)
        return ps

