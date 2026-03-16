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
    def get_budgets(db: Session, tenant_id: str, skip: int = 0, limit: int = 100):
        # returns budgets with nested supplier and items
        return db.query(PurchaseBudget).filter(PurchaseBudget.tenant_id == tenant_id).order_by(PurchaseBudget.created_at.desc()).offset(skip).limit(limit).all()

    @staticmethod
    def get_budget_by_id(db: Session, tenant_id: str, budget_id: UUID) -> PurchaseBudget:
        budget = db.query(PurchaseBudget).filter(PurchaseBudget.id == budget_id, PurchaseBudget.tenant_id == tenant_id).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Budget not found")
        return budget

    @staticmethod
    def calculate_item_totals(frete_tipo: str, frete_percent_cabecalho: float, ipi_calculado: bool, item: dict):
        # item is a dict with incoming data
        valor_unitario = float(item.get("valor_unitario", 0))
        
        # Freight logic
        if frete_tipo == FreightTypeEnum.CIF:
            frete_percent = 0
        else: # FOB
            # Se item nao tiver frete percent, herda do cabecalho
            frete_percent = item.get("frete_percent")
            if frete_percent is None:
                frete_percent = frete_percent_cabecalho
            frete_percent = float(frete_percent)
        
        frete_valor = valor_unitario * (frete_percent / 100)
        
        # IPI logic
        ipi_percent = float(item.get("ipi_percent", 0))
        ipi_valor = valor_unitario * (ipi_percent / 100)
        
        if ipi_calculado:
            # IPI já calculado
            total_item = valor_unitario + frete_valor
        else:
            # IPI NÃO calculado
            total_item = valor_unitario + frete_valor + ipi_valor

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
            ipi_calculado=data.ipi_calculado
        )
        db.add(db_budget)
        db.flush() # To get ID

        for item_data in data.items:
            item_dict = item_data.model_dump()
            calc_results = PurchaseBudgetService.calculate_item_totals(
                frete_tipo=data.frete_tipo,
                frete_percent_cabecalho=float(data.frete_percent),
                ipi_calculado=data.ipi_calculado,
                item=item_dict
            )
            
            db_item = PurchaseBudgetItem(
                budget_id=db_budget.id,
                product_id=item_data.product_id,
                codigo_fornecedor=item_data.codigo_fornecedor,
                ncm=item_data.ncm,
                valor_unitario=item_data.valor_unitario,
                frete_percent=calc_results["frete_percent"],
                frete_valor=calc_results["frete_valor"],
                ipi_percent=item_data.ipi_percent,
                ipi_valor=calc_results["ipi_valor"],
                icms_percent=item_data.icms_percent,
                total_item=calc_results["total_item"]
            )
            db.add(db_item)
            
        db.commit()
        db.refresh(db_budget)
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
        
        col_frete = headers.get("frete_percent") if "frete_percent" in headers else headers.get("frete")
        col_ipi = headers.get("ipi_percent") if "ipi_percent" in headers else headers.get("ipi")
        col_icms = headers.get("icms_percent") if "icms_percent" in headers else headers.get("icms")
        
        if col_codigo is None or col_valor is None:
            raise HTTPException(status_code=400, detail="Planilha deve conter as colunas 'codigo' e 'valor'")
            
        encontrados = []
        nao_encontrados = []
        
        supplier_prods = db.query(ProductSupplier, Product).join(Product, ProductSupplier.product_id == Product.id).filter(
            ProductSupplier.supplier_id == supplier_id,
            Product.tenant_id == tenant_id
        ).all()
        
        map_codigo_produto = {sp.ProductSupplier.codigo_externo: {"id": str(sp.Product.id), "nome": sp.Product.nome, "ncm": sp.Product.ncm_codigo} for sp in supplier_prods}
        
        # Evitar loops vazios
        for row_raw in sheet.iter_rows(min_row=2, values_only=True):
            if not isinstance(row_raw, tuple):
                continue
            row = list(row_raw)
                
            c_cod = int(col_codigo) if isinstance(col_codigo, int) else -1
            c_desc = int(col_descricao) if isinstance(col_descricao, int) else -1
            c_val = int(col_valor) if isinstance(col_valor, int) else -1
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
            ncm_raw = row[c_ncm] if c_ncm >= 0 and len(row) > c_ncm else None
            frete = row[c_frete] if c_frete >= 0 and len(row) > c_frete else 0
            ipi = row[c_ipi] if c_ipi >= 0 and len(row) > c_ipi else 0
            icms = row[c_icms] if c_icms >= 0 and len(row) > c_icms else 0
            
            try: val = float(val) if val else 0
            except: val = 0
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
                codigo_externo=codigo_fornecedor
            )
            db.add(ps)
        db.commit()
        db.refresh(ps)
        return ps

