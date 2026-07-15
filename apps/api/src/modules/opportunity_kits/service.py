from uuid import UUID
from datetime import datetime, timezone
from typing import Optional
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException

from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitItem, OpportunityKitCost
from src.modules.opportunity_kits.schemas import (
    OpportunityKitCreate, OpportunityKitUpdate, OpportunityKitFinancialSummary,
    OpportunityKitItemFinancialSummary
)
from src.modules.products.models import Product
from src.modules.sales_budgets.router import get_product_cost_composition


class OpportunityKitService:
    def __init__(self, db: Session):
        self.db = db

    def get_product_info(self, product_id: str, tenant_id: str, considerar_st_ou_difal: str = "DIFAL", company_id: Optional[str] = None, sales_budget_id: Optional[str] = None, licitacao_id: Optional[str] = None) -> dict:
        from src.modules.sales_budgets.service import calculate_product_cost_composition

        tipo_calc = "REVENDA" if considerar_st_ou_difal == "ST" else "USO_CONSUMO"
        comp = calculate_product_cost_composition(self.db, product_id, tenant_id, tipo_calc, sales_company_id=company_id, sales_budget_id=sales_budget_id, licitacao_id=licitacao_id)
        if not comp:
            product = self.db.query(Product).filter(
                Product.id == product_id,
                Product.tenant_id == tenant_id
            ).first()
            if not product:
                return {
                    "cost": Decimal("0.0"),
                    "tipo": "MERCADORIA",
                    "difal": Decimal("0.0"),
                    "icms_st": Decimal("0.0"),
                    "base_unitario": Decimal("0.0"),
                    "ipi": Decimal("0.0"),
                    "frete_cif": Decimal("0.0"),
                    "tem_st": False,
                    "perfil_st_ativo": True,
                    "icms_abatido_unit": Decimal("0.0"),
                    "ipi_percent": 0.0,
                    "icms_st_normal": Decimal("0.0"),
                    "cred_outorgado_percent": 0.0,
                    "cred_outorgado_valor": Decimal("0.0"),
                    "is_bit": False,
                    "is_intrastate": True,
                    "uf_origem": "",
                    "uf_destino": "",
                    "custo_unit_final": Decimal("0.0"),
                }
            custo_base = getattr(product, "vlr_referencia_revenda", 0) if considerar_st_ou_difal == "ST" else getattr(product, "vlr_referencia_uso_consumo", 0)
            tipo = product.tipo or "MERCADORIA"
            difal_val = Decimal("0.0") if (tipo in ["SERVICO", "LICENCA"] or considerar_st_ou_difal != "DIFAL") else Decimal(getattr(product, "vlr_referencia_difal", 0) or 0)
            return {
                "cost": Decimal(custo_base or 0),
                "tipo": tipo,
                "base_unitario": Decimal(custo_base or 0),
                "ipi": Decimal("0.0"),
                "frete_cif": Decimal("0.0"),
                "difal": difal_val,
                "icms_st": Decimal("0.0"),
                "tem_st": False,
                "perfil_st_ativo": True,
                "icms_abatido_unit": Decimal("0.0"),
                "ipi_percent": 0.0,
                "icms_st_normal": Decimal("0.0"),
                "cred_outorgado_percent": 0.0,
                "cred_outorgado_valor": Decimal("0.0"),
                "is_bit": False,
                "is_intrastate": True,
                "uf_origem": "",
                "uf_destino": "",
                "custo_unit_final": Decimal(custo_base or 0),
            }

        product = self.db.query(Product).filter(Product.id == product_id).first()
        tipo = product.tipo if product else "MERCADORIA"

        if considerar_st_ou_difal == "ST":
            if tipo in ["SERVICO", "LICENCA"]:
                custo_base = Decimal(comp.get("base_unitario", 0))
                icms_st = Decimal("0.0")
            else:
                custo_base = Decimal(comp.get("custo_unit_final", 0))
                icms_st = Decimal(comp.get("icms_st_final", 0))
            difal_val = Decimal("0.0")
        else:
            custo_base = Decimal(comp.get("custo_unit_final", 0))
            icms_st = Decimal("0.0")
            difal_val = Decimal("0.0") if tipo in ["SERVICO", "LICENCA"] else Decimal(comp.get("difal_unitario", 0))

        return {
            "cost": custo_base,
            "tipo": tipo,
            "base_unitario": Decimal(comp.get("base_unitario", 0)),
            "ipi": Decimal(comp.get("ipi_unitario", 0)),
            "frete_cif": Decimal(comp.get("frete_cif_unitario", 0)),
            "difal": difal_val,
            "icms_st": icms_st,
            "tem_st": icms_st > 0 or bool(comp.get("has_st", False)),
            "perfil_st_ativo": comp.get("perfil_st_ativo", True),
            "icms_abatido_unit": Decimal(comp.get("icms_abatido", 0)),
            "ipi_percent": float(comp.get("ipi_percent", 0.0)),
            "icms_st_normal": Decimal(comp.get("icms_st_normal", 0.0)),
            "cred_outorgado_percent": float(comp.get("cred_outorgado_percent", 0.0)),
            "cred_outorgado_valor": Decimal(comp.get("cred_outorgado_valor", 0.0)),
            "is_bit": bool(comp.get("is_bit", False)),
            "is_intrastate": bool(comp.get("is_intrastate", True)),
            "uf_origem": comp.get("uf_origem", ""),
            "uf_destino": comp.get("uf_destino", ""),
            "custo_unit_final": Decimal(comp.get("custo_unit_final", custo_base))
        }

    def calculate_financials(
        self, 
        kit: OpportunityKit, 
        tenant_id: str, 
        override_factor: Optional[Decimal] = None,
        sales_budget_id: Optional[str] = None,
        sales_proposal_id: Optional[str] = None
    ) -> dict:
        comissao_venda_origens = []
        from src.modules.sales_budgets.models import SalesBudget
        from src.modules.licitacoes.models import Licitacao
        
        final_budget_id = sales_budget_id or (str(kit.sales_budget_id) if kit.sales_budget_id else None)
        final_proposal_id = sales_proposal_id or (str(kit.sales_proposal_id) if kit.sales_proposal_id else None)
        
        company_id = None
        sales_budget = None
        sales_proposal = None
        
        if final_budget_id:
            sales_budget = self.db.query(SalesBudget).filter(SalesBudget.id == final_budget_id).first()
            company_id = str(sales_budget.company_id) if sales_budget else None
        elif final_proposal_id:
            from src.modules.sales_proposals.models import SalesProposal
            sales_proposal = self.db.query(SalesProposal).filter(SalesProposal.id == final_proposal_id).first()
            company_id = str(sales_proposal.company_id) if sales_proposal else None
        elif kit.licitacao_id:
            licitacao = self.db.query(Licitacao).filter(Licitacao.id == kit.licitacao_id).first()
            company_id = str(licitacao.company_id) if licitacao else None

        # Determine if we should force 12% ICMS rate (Requirement 4)
        force_12_icms = False
        if kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
            from src.modules.companies.models import Company
            from src.modules.customers.models import Customer
            from src.modules.catalog.models import State

            company = None
            customer = None
            if sales_budget:
                company = self.db.query(Company).filter(Company.id == sales_budget.company_id).first()
                customer = self.db.query(Customer).filter(Customer.id == sales_budget.customer_id).first()
            elif sales_proposal:
                company = self.db.query(Company).filter(Company.id == sales_proposal.company_id).first()
                customer = self.db.query(Customer).filter(Customer.id == sales_proposal.customer_id).first()

            if company and customer:
                company_state = self.db.query(State).filter(State.id == company.state_id).first()
                customer_state = self.db.query(State).filter(State.id == customer.state_id).first()
                if company_state and customer_state and company_state.sigla != customer_state.sigla:
                    force_12_icms = True

        effective_aliq_icms = Decimal("12.0") if force_12_icms else Decimal(str(kit.aliq_icms or 0))
        
        faturamento_separado = getattr(kit, 'faturamento_servico_separado', False)
        
        # 2. Prazos do Contrato
        prazo_mensalidades = max(0, kit.prazo_contrato_meses - kit.prazo_instalacao_meses)
        if kit.prazo_instalacao_meses >= kit.prazo_contrato_meses:
            prazo_mensalidades = 0

        # 5. Custos Operacionais Mensais (Apenas valores da grid)
        custo_operacional_mensal_kit = Decimal("0.0")
        custo_instalacao_avulso = Decimal("0.0")
        
        perc_frete_venda = Decimal(str(kit.perc_frete_venda or 0)) / Decimal(100.0)
        perc_despesas_adm = Decimal(str(kit.perc_despesas_adm or 0)) / Decimal(100.0)
        perc_comissao = Decimal(str(kit.perc_comissao or 0)) / Decimal(100.0)
        
        tipo_com = getattr(kit, "tipo_comissionamento", "TRADICIONAL")
        perc_dsr = Decimal(str(getattr(kit, "perc_dsr", 0) or 0))
        perc_fgts = Decimal(str(getattr(kit, "perc_fgts", 0) or 0))
        perc_inss = Decimal(str(getattr(kit, "perc_inss", 0) or 0))
        perc_demais = Decimal(str(getattr(kit, "perc_demais_incidencias", 0) or 0))
        perc_desp_op = Decimal(str(getattr(kit, "perc_despesa_operacional", 0) or 0))

        fator_margem_inst = Decimal(getattr(kit, 'fator_margem_instalacao', 1) or 1)
        fator_margem_manut = Decimal(getattr(kit, 'fator_margem_manutencao', 1) or 1)

        cost_summaries = []
        
        # We need aliq_servicos for costs, which we compute here:
        aliq_base = sum([
            Decimal(str(kit.aliq_pis or 0)),
            Decimal(str(kit.aliq_cofins or 0)),
            Decimal(str(kit.aliq_csll or 0)),
            Decimal(str(kit.aliq_irpj or 0))
        ]) / Decimal(100.0)
        aliq_servicos = aliq_base + (Decimal(str(kit.aliq_iss or 0)) / Decimal(100.0))
        aliq_produtos = aliq_base + (effective_aliq_icms / Decimal(100.0))
        
        if hasattr(kit, 'costs') and kit.costs:
            for cost in kit.costs:
                cost_tipo_custo = getattr(cost, 'tipo_custo', '')
                qtde = Decimal(cost.quantidade or 1)
                vl_un = Decimal(cost.valor_unitario or 0)
                vl_tot = vl_un * qtde
                
                # Recalculo dinamico p/ VENDA_EQUIPAMENTOS, LOCACAO, e COMODATO + SERVICO_PROPRIO + Forma de Execucao
                if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "LOCACAO", "COMODATO", "INSTALACAO"] and getattr(cost, "own_service_id", None) and getattr(kit, "forma_execucao", None):
                    EXEC_MAP = {
                        'H. NORMAL': 'hora_normal',
                        'H. EXTRA': 'hora_extra',
                        'H.E. Ad. Noturno': 'hora_extra_adicional_noturno',
                        'H.E. Dom./Fer.': 'hora_extra_domingos_feriados',
                        'H.E. Dom./Fer. Not.': 'hora_extra_domingos_feriados_noturno',
                    }
                    field_name = EXEC_MAP.get(str(kit.forma_execucao))
                    if field_name:
                        from src.modules.own_services.models import OwnServiceItem
                        from src.modules.man_hours.models import ManHour
                        
                        current_year = datetime.now(timezone.utc).year
                        comp_id = str(kit.company_id) if kit.company_id else None
                        
                        if comp_id:
                            # Busca as horas homems de toda a base da company
                            man_hours = self.db.query(ManHour).filter(
                                ManHour.tenant_id == tenant_id,
                                ManHour.company_id == comp_id,
                                ManHour.vigencia <= current_year,
                                ManHour.ativo == True
                            ).order_by(ManHour.vigencia.desc()).all()
                            
                            # Pega valor da coluna por CARGO
                            mh_by_role = {}
                            for mh in man_hours:
                                if str(mh.role_id) not in mh_by_role:
                                    mh_by_role[str(mh.role_id)] = Decimal(getattr(mh, field_name, 0))
                                    
                            os_items = self.db.query(OwnServiceItem).filter(
                                OwnServiceItem.own_service_id == cost.own_service_id
                            ).all()
                            
                            if os_items:
                                dyn_total = Decimal("0.0")
                                for os_item in os_items:
                                    role_rate = mh_by_role.get(str(os_item.role_id), Decimal("0.0"))
                                    minutes = Decimal(str(os_item.tempo_minutos or 0))
                                    dyn_total += (role_rate / Decimal(60.0)) * minutes
                                
                                if dyn_total > 0:
                                    vl_un = dyn_total
                                    vl_tot = vl_un * qtde

                if cost_tipo_custo == "INSTALACAO":
                    custo_instalacao_avulso += vl_tot
                else:
                    custo_operacional_mensal_kit += vl_tot

                fator_cost = fator_margem_inst if cost_tipo_custo == "INSTALACAO" else fator_margem_manut
                
                venda_unitario_item = Decimal("0.0")
                venda_total_item = Decimal("0.0")
                imposto_venda_item = Decimal("0.0")
                
                # Ajuste de Custo da Manutenção para multiplicador do prazo total
                custo_total_final = vl_tot
                if cost_tipo_custo in ["MANUTENCAO", "Manut. pred./corretiva"] and kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
                    meses_manut = Decimal(getattr(kit, 'qtd_meses_manutencao', 1) or 1)
                    custo_total_final = vl_tot * meses_manut
                
                if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
                    venda_unitario_item = vl_un * fator_cost
                    venda_total_item = custo_total_final * fator_cost
                    imposto_venda_item = venda_total_item * aliq_servicos
                    
                frete_venda_item = venda_total_item * perc_frete_venda
                desp_adm_item = venda_total_item * perc_despesas_adm
                comissao_item = venda_total_item * perc_comissao
                
                lucro_total_item = venda_total_item - custo_total_final - imposto_venda_item - frete_venda_item - desp_adm_item - comissao_item
                lucro_unitario_item = (lucro_total_item / qtde) if qtde > 0 else Decimal("0.0")
                margem_item = (lucro_total_item / venda_total_item * Decimal(100.0)) if venda_total_item > 0 else Decimal("0.0")

                # Requisito: Tooltip Breakdown details
                aliq_base_federais = sum([
                    Decimal(str(kit.aliq_pis or 0)),
                    Decimal(str(kit.aliq_cofins or 0)),
                    Decimal(str(kit.aliq_csll or 0)),
                    Decimal(str(kit.aliq_irpj or 0))
                ]) / Decimal(100.0)

                cost_summaries.append({
                    "id": str(cost.id) if cost.id else None,
                    "product_id": str(cost.product_id) if cost.product_id else None,
                    "own_service_id": str(cost.own_service_id) if cost.own_service_id else None,
                    "tipo_custo": cost_tipo_custo,
                    "quantidade": float(cost.quantidade or 1.0),
                    "custo_base_unitario_item": round(vl_un, 2),  # type: ignore
                    "custo_total_item_no_kit": round(custo_total_final, 2),  # type: ignore
                    "fator_item": round(fator_cost, 2),  # type: ignore
                    "venda_unitario_item": round(venda_unitario_item, 2),  # type: ignore
                    "venda_total_item": round(venda_total_item, 2),  # type: ignore
                    "imposto_venda_item": round(imposto_venda_item, 2),  # type: ignore
                    "frete_venda_item": round(frete_venda_item, 2),  # type: ignore
                    "desp_adm_item": round(desp_adm_item, 2),  # type: ignore
                    "comissao_item": round(comissao_item, 2),  # type: ignore
                    "lucro_unitario_item": round(lucro_unitario_item, 2),  # type: ignore
                    "lucro_total_item": round(lucro_total_item, 2),  # type: ignore
                    "margem_item": round(margem_item, 2),  # type: ignore
                    # Para match com Tooltip do array
                    "tipo_item": "SERVICO",
                    "perc_pis": float(str(kit.aliq_pis or 0)),
                    "perc_cofins": float(str(kit.aliq_cofins or 0)),
                    "perc_csll": float(str(kit.aliq_csll or 0)),
                    "perc_irpj": float(str(kit.aliq_irpj or 0)),
                    "perc_iss": float(str(kit.aliq_iss or 0)),
                    "pis_unit": round(venda_total_item * (Decimal(str(kit.aliq_pis or 0)) / Decimal(100)), 2),  # type: ignore
                    "cofins_unit": round(venda_total_item * (Decimal(str(kit.aliq_cofins or 0)) / Decimal(100)), 2),  # type: ignore
                    "csll_unit": round(venda_total_item * (Decimal(str(kit.aliq_csll or 0)) / Decimal(100)), 2),  # type: ignore
                    "irpj_unit": round(venda_total_item * (Decimal(str(kit.aliq_irpj or 0)) / Decimal(100)), 2),  # type: ignore
                    "iss_unit": round(venda_total_item * (Decimal(str(kit.aliq_iss or 0)) / Decimal(100)), 2),  # type: ignore
                })

        custo_mensal_bloco_7 = Decimal("0.0")
        if hasattr(kit, 'monthly_costs') and kit.monthly_costs:
            for mcost in kit.monthly_costs:
                qtde = Decimal(mcost.quantidade or 1)
                vl_un = Decimal(mcost.valor_unitario or 0)
                vl_tot = vl_un * qtde
                custo_mensal_bloco_7 += vl_tot

        custo_aquisicao_kit = Decimal("0.0")
        custo_aquisicao_produtos = Decimal("0.0")
        custo_aquisicao_servicos = Decimal("0.0")
        total_difal_kit = Decimal("0.0")
        total_st_kit = Decimal("0.0")
        total_ipi_kit = Decimal("0.0")
        total_base_cost_kit = Decimal("0.0")
        
        fator_margem = override_factor if override_factor is not None else Decimal(str(kit.fator_margem_locacao or 1))

        iss_val = Decimal(str(kit.aliq_iss or 0)) if kit.tipo_contrato in ["COMODATO", "INSTALACAO"] else Decimal("0.0")
        icms_val = effective_aliq_icms if kit.tipo_contrato == "VENDA_EQUIPAMENTOS" else Decimal("0.0")
        aliq_total_impostos = sum([
            Decimal(str(kit.aliq_pis or 0)),
            Decimal(str(kit.aliq_cofins or 0)),
            Decimal(str(kit.aliq_csll or 0)),
            Decimal(str(kit.aliq_irpj or 0)),
            iss_val,
            icms_val
        ]) / Decimal(100.0)
        
        item_summaries = []
        total_imposto_itens_venda = Decimal("0.0")
        credito_icms_compra_total = Decimal("0.0")
        
        for item in kit.items:
            tipo_item_entity = getattr(item, "tipo_item", "PRODUTO")
            
            custo_base_unitario_item = Decimal("0.0")
            tipo_produto = "MERCADORIA"
            difal_unitario = Decimal("0.0")
            icms_st = Decimal("0.0")
            icms_abatido_unit = Decimal("0.0")
            info = {}  # fallback for tooltip details; populated only for product items
            
            if tipo_item_entity == "SERVICO_PROPRIO" and getattr(item, "own_service_id", None):
                tipo_produto = "SERVICO"
                if getattr(kit, "forma_execucao", None):
                    EXEC_MAP = {
                        'H. NORMAL': 'hora_normal',
                        'H. EXTRA': 'hora_extra',
                        'H.E. Ad. Noturno': 'hora_extra_adicional_noturno',
                        'H.E. Dom./Fer.': 'hora_extra_domingos_feriados',
                        'H.E. Dom./Fer. Not.': 'hora_extra_domingos_feriados_noturno',
                    }
                    field_name = EXEC_MAP.get(str(kit.forma_execucao))
                    if field_name:
                        from src.modules.own_services.models import OwnServiceItem
                        from src.modules.man_hours.models import ManHour
                        
                        current_year = datetime.now(timezone.utc).year
                        comp_id = str(kit.company_id) if kit.company_id else None
                        
                        if comp_id:
                            man_hours = self.db.query(ManHour).filter(
                                ManHour.tenant_id == tenant_id,
                                ManHour.company_id == comp_id,
                                ManHour.vigencia <= current_year,
                                ManHour.ativo == True
                            ).order_by(ManHour.vigencia.desc()).all()
                            
                            mh_by_role = {}
                            for mh in man_hours:
                                if str(mh.role_id) not in mh_by_role:
                                    mh_by_role[str(mh.role_id)] = Decimal(getattr(mh, field_name, 0))
                                    
                            os_items = self.db.query(OwnServiceItem).filter(
                                OwnServiceItem.own_service_id == item.own_service_id
                            ).all()
                            
                            if os_items:
                                dyn_total = Decimal("0.0")
                                for os_item in os_items:
                                    role_rate = mh_by_role.get(str(os_item.role_id), Decimal("0.0"))
                                    minutes = Decimal(str(os_item.tempo_minutos or 0))
                                    dyn_total += (role_rate / Decimal(60.0)) * minutes
                                
                                if dyn_total > 0:
                                    custo_base_unitario_item = dyn_total
            else:
                if item.product_id:
                    tax_mode = "ST" if (kit.tipo_contrato == "VENDA_EQUIPAMENTOS" or getattr(kit, "considerar_st_ou_difal", "DIFAL") == "ST") else "DIFAL"
                    info = self.get_product_info(
                        str(item.product_id), 
                        tenant_id, 
                        tax_mode, 
                        company_id, 
                        sales_budget_id=str(sales_budget.id) if sales_budget else None,
                        licitacao_id=str(kit.licitacao_id) if kit.licitacao_id else None
                    )
                else:
                    info = {
                        "cost": Decimal("0.0"),
                        "tipo": "SERVICO",
                        "base_unitario": Decimal("0.0"),
                        "ipi": Decimal("0.0"),
                        "frete_cif": Decimal("0.0"),
                        "difal": Decimal("0.0"),
                        "icms_st": Decimal("0.0"),
                        "tem_st": False,
                        "perfil_st_ativo": False,
                        "icms_abatido_unit": Decimal("0.0"),
                        "ipi_percent": 0.0,
                        "icms_st_normal": Decimal("0.0"),
                        "cred_outorgado_percent": 0.0,
                        "cred_outorgado_valor": Decimal("0.0"),
                        "is_bit": False,
                        "is_intrastate": True,
                        "uf_origem": "",
                        "uf_destino": "",
                        "custo_unit_final": Decimal("0.0")
                    }
                custo_base_unitario_item = Decimal(str(info["cost"]))
                tipo_produto = info["tipo"]
                difal_unitario = Decimal(str(info["difal"]))
                icms_st = Decimal(str(info.get("icms_st", 0)))
                icms_abatido_unit = Decimal(str(info.get("icms_abatido_unit", 0)))
            
            custo_total_item_no_kit = custo_base_unitario_item * Decimal(str(item.quantidade_no_kit or 1))
            difal_total_item = difal_unitario * Decimal(str(item.quantidade_no_kit or 1))
            icms_st_total = icms_st * Decimal(str(item.quantidade_no_kit or 1))
            ipi_total = Decimal(str(info.get("ipi", 0.0))) * Decimal(str(item.quantidade_no_kit or 1))
            
            custo_aquisicao_kit += custo_total_item_no_kit
            total_difal_kit += difal_total_item
            total_st_kit += icms_st_total
            total_ipi_kit += ipi_total
            credito_icms_compra_total += icms_abatido_unit * Decimal(str(item.quantidade_no_kit or 1))
            
            base_unitario = Decimal(str(info.get("base_unitario", custo_base_unitario_item))) if isinstance(info, dict) else custo_base_unitario_item
            total_base_cost_kit += base_unitario * Decimal(str(item.quantidade_no_kit or 1))
            
            if tipo_produto in ["SERVICO", "LICENCA"]:
                custo_aquisicao_servicos += custo_total_item_no_kit
            else:
                custo_aquisicao_produtos += custo_total_item_no_kit
                
            venda_unitario_item = Decimal("0.0")
            venda_total_item = Decimal("0.0")
            imposto_venda_item = Decimal("0.0")
            
            if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
                fator_item = fator_margem
                aliq_pis_val = Decimal(str(kit.aliq_pis or 0)) / Decimal(100.0)
                aliq_cofins_val = Decimal(str(kit.aliq_cofins or 0)) / Decimal(100.0)
                aliq_csll_val = Decimal(str(kit.aliq_csll or 0)) / Decimal(100.0)
                aliq_irpj_val = Decimal(str(kit.aliq_irpj or 0)) / Decimal(100.0)
                aliq_iss_val = Decimal(str(kit.aliq_iss or 0)) / Decimal(100.0)
                aliq_icms_val = effective_aliq_icms / Decimal(100.0)
                
                perc_icms_aplicado = aliq_icms_val
                
                if kit.tipo_contrato == "INSTALACAO":
                    fator_item = fator_margem
                    perc_icms_aplicado = Decimal("0.0")
                    imposto_tax = aliq_pis_val + aliq_cofins_val + aliq_csll_val + aliq_irpj_val + aliq_iss_val
                elif tipo_produto in ["SERVICO", "LICENCA"]:
                    fator_item = Decimal(getattr(kit, 'fator_margem_servicos_produtos', 1) or 1)
                    perc_icms_aplicado = Decimal("0.0")
                    imposto_tax = aliq_pis_val + aliq_cofins_val + aliq_csll_val + aliq_irpj_val + aliq_iss_val
                else:
                    perfil_st_ativo = info.get("perfil_st_ativo", True)
                    if info.get("tem_st") and perfil_st_ativo and not force_12_icms:
                        perc_icms_aplicado = Decimal("0.0")
                    # If perfil_st_ativo is False, perc_icms_aplicado remains aliq_icms_val
                    
                    imposto_tax = aliq_pis_val + aliq_cofins_val + aliq_csll_val + aliq_irpj_val + perc_icms_aplicado
                
                venda_unitario_item = custo_base_unitario_item * fator_item
                venda_total_item = (custo_base_unitario_item * Decimal(str(item.quantidade_no_kit or 1))) * fator_item
                imposto_venda_item = venda_total_item * imposto_tax
                total_imposto_itens_venda += imposto_venda_item
            else:
                if tipo_produto in ["SERVICO", "LICENCA"]:
                    fator_item = Decimal(getattr(kit, 'fator_margem_servicos_produtos', 1) or 1)
                    venda_unitario_item = custo_base_unitario_item * fator_item
                    venda_total_item = (custo_base_unitario_item * Decimal(str(item.quantidade_no_kit or 1))) * fator_item
            
            # Additional detailed kit item metrics
            frete_venda_item = venda_total_item * perc_frete_venda
            desp_adm_item = venda_total_item * perc_despesas_adm
            comissao_item = venda_total_item * perc_comissao
            
            # Calcular impostos líquidos para o lucro
            qty_dec = Decimal(str(item.quantidade_no_kit or 1))
            icms_abatido_total = icms_abatido_unit * qty_dec
            icms_st_deduction = icms_st_total if not info.get("is_intrastate", True) else Decimal("0.0")
            net_impostos = imposto_venda_item - icms_abatido_total - icms_st_deduction

            # Lucro utilizando impostos líquidos
            lucro_total_item = venda_total_item - custo_total_item_no_kit - net_impostos - frete_venda_item - desp_adm_item - comissao_item
            lucro_unitario_item = (lucro_total_item / qty_dec) if qty_dec > 0 else Decimal("0.0")
            margem_item = (lucro_total_item / venda_total_item * Decimal(100.0)) if venda_total_item > 0 else Decimal("0.0")

            item_summaries.append({
                "id": str(item.id) if item.id else None,
                "tipo_item_entity": getattr(item, "tipo_item", "PRODUTO"),
                "product_id": str(item.product_id) if item.product_id else None,
                "own_service_id": str(getattr(item, "own_service_id", None)) if getattr(item, "own_service_id", None) else None,
                "tipo_item": tipo_produto,
                "quantidade_no_kit": float(item.quantidade_no_kit or 1.0),
                "custo_base_unitario_item": round(custo_base_unitario_item, 2),  # type: ignore
                "custo_total_item_no_kit": round(custo_total_item_no_kit, 2),  # type: ignore
                "difal_unitario": round(difal_unitario, 2),  # type: ignore
                "difal_total_item": round(difal_total_item, 2),  # type: ignore
                "fator_item": round(locals().get("fator_item", fator_margem), 2),  # type: ignore
                "venda_unitario_item": round(venda_unitario_item, 2),  # type: ignore
                "venda_total_item": round(venda_total_item, 2),  # type: ignore
                "imposto_venda_item": round(imposto_venda_item, 2),  # type: ignore
                "icms_st_unitario": round(icms_st, 2),  # type: ignore
                "icms_st_total": round(icms_st_total, 2),  # type: ignore
                "icms_abatido": round(icms_abatido_unit, 2), # type: ignore
                "frete_venda_item": round(frete_venda_item, 2),  # type: ignore
                "desp_adm_item": round(desp_adm_item, 2),  # type: ignore
                "comissao_item": round(comissao_item, 2),  # type: ignore
                "lucro_unitario_item": round(lucro_unitario_item, 2),  # type: ignore
                "lucro_total_item": round(lucro_total_item, 2),  # type: ignore
                "margem_item": round(margem_item, 2),  # type: ignore
                # Tooltip breakdown details for frontend
                "base_fornecedor": round(info.get("base_unitario", 0), 2),  # type: ignore
                "ipi_unit": round(info.get("ipi", 0), 2),  # type: ignore
                "frete_cif_unit": round(info.get("frete_cif", 0), 2),  # type: ignore
                "tem_st": info.get("tem_st", False),
                "perfil_st_ativo": info.get("perfil_st_ativo", True),
                "ipi_percent": info.get("ipi_percent", 0.0),
                "icms_st_normal": round(info.get("icms_st_normal", 0), 2),
                "cred_outorgado_percent": info.get("cred_outorgado_percent", 0.0),
                "cred_outorgado_valor": round(info.get("cred_outorgado_valor", 0), 2),
                "is_bit": info.get("is_bit", False),
                "is_intrastate": info.get("is_intrastate", True),
                "uf_origem": info.get("uf_origem", ""),
                "uf_destino": info.get("uf_destino", ""),
                "custo_unit_final": round(info.get("custo_unit_final", custo_base_unitario_item), 2),
                "perc_pis": float(str(kit.aliq_pis or 0)),
                "perc_cofins": float(str(kit.aliq_cofins or 0)),
                "perc_csll": float(str(kit.aliq_csll or 0)),
                "perc_irpj": float(str(kit.aliq_irpj or 0)),
                "perc_icms": float(effective_aliq_icms),
                "perc_iss": float(str(kit.aliq_iss or 0)),
                "pis_unit": round(venda_total_item * (Decimal(str(kit.aliq_pis or 0)) / Decimal(100)), 2),  # type: ignore
                "cofins_unit": round(venda_total_item * (Decimal(str(kit.aliq_cofins or 0)) / Decimal(100)), 2),  # type: ignore
                "csll_unit": round(venda_total_item * (Decimal(str(kit.aliq_csll or 0)) / Decimal(100)), 2),  # type: ignore
                "irpj_unit": round(venda_total_item * (Decimal(str(kit.aliq_irpj or 0)) / Decimal(100)), 2),  # type: ignore
                "icms_unit": round(venda_total_item * locals().get("perc_icms_aplicado", Decimal(0)), 2) if (tipo_produto not in ["SERVICO", "LICENCA"] and kit.tipo_contrato != "INSTALACAO") else 0,  # type: ignore
                "iss_unit": round(venda_total_item * (Decimal(str(kit.aliq_iss or 0)) / Decimal(100)), 2) if (tipo_produto in ["SERVICO", "LICENCA"] or kit.tipo_contrato == "INSTALACAO") else 0,  # type: ignore
            })

        custo_aquisicao_total = custo_aquisicao_kit * Decimal(str(kit.quantidade_kits or 1))

        # 10. Depreciacao (Removido da formacao de custos)
        
        # 11. Custo Total Mensal (Will be added with maintenance later)

        # 12. Calculo da Taxa de Locação
        tx_locacao = Decimal("0.0")
        juros = Decimal(str(kit.taxa_juros_mensal or 0)) / Decimal(100.0)
        
        if kit.tipo_contrato == "INSTALACAO":
            tx_locacao = Decimal("1.0")
        elif kit.prazo_contrato_meses > 0 and juros > 0:
            # txLocacao = taxa / (1 - (1 + taxa)^(-prazo_contrato))
            base = Decimal(1.0) + juros
            tx_locacao = juros / (Decimal(1.0) - (base ** -int(str(kit.prazo_contrato_meses or 0))))
        elif kit.prazo_contrato_meses > 0 and juros == 0:
            tx_locacao = Decimal(1.0) / Decimal(str(kit.prazo_contrato_meses or 1))

        # 13. Formação do Valor
        fator_margem_inst = Decimal(getattr(kit, 'fator_margem_instalacao', 1) or 1)
        fator_margem_manut = Decimal(getattr(kit, 'fator_margem_manutencao', 1) or 1)
        
        # We always compute the base for the installation percentage, used for maintenance
        perc_inst = Decimal(str(kit.percentual_instalacao or 0)) / Decimal(100.0)
        vlr_instal_calc_base_manut = custo_aquisicao_kit * perc_inst
        
        vlr_instal_calc = Decimal("0.0")
        valor_venda_instalacao = Decimal("0.0")
        valor_venda_produtos = Decimal("0.0")
        valor_venda_manutencao = Decimal("0.0")
        venda_unit_monitoramento = Decimal("0.0")
        impostos_produtos_base = Decimal("0.0")
        impostos_instalacao = Decimal("0.0")
        impostos_manutencao = Decimal("0.0")

        
        if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
            # For Sales/Install: Flat value application based on independent markup factors
            if kit.tipo_contrato == "INSTALACAO":
                fator_margem_serv_prod = fator_margem
            else:
                fator_margem_serv_prod = Decimal(getattr(kit, 'fator_margem_servicos_produtos', 1) or 1)
                
            if kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
                valor_venda_produtos = sum(Decimal(str(is_["venda_total_item"])) for is_ in item_summaries)
            else:
                valor_venda_produtos = (custo_aquisicao_produtos * fator_margem) + (custo_aquisicao_servicos * fator_margem_serv_prod)
            
            if kit.instalacao_inclusa:
                vlr_instal_calc = vlr_instal_calc_base_manut
                valor_venda_instalacao = vlr_instal_calc * fator_margem_inst
            else:
                vlr_instal_calc = custo_instalacao_avulso
                valor_venda_instalacao = custo_instalacao_avulso * fator_margem_inst
                
            vlt_manut = Decimal("0.0")
            valor_venda_manutencao = Decimal("0.0")
            if getattr(kit, 'havera_manutencao', False):
                meses_manut = Decimal(getattr(kit, 'qtd_meses_manutencao', 1) or 1)
                custo_manut_total = custo_operacional_mensal_kit * meses_manut
                valor_venda_manutencao = custo_manut_total * fator_margem_manut
                vlt_manut = custo_manut_total
                
            valor_base_final = valor_venda_produtos + valor_venda_instalacao + valor_venda_manutencao
            valor_base_venda = valor_base_final
            
            # Populate variables that the frontend reads 
            valor_mensal_locacao_base = valor_base_final
            manutencao_mensal = valor_venda_manutencao
            valor_parcela_locacao = valor_venda_produtos + valor_venda_instalacao
            
            # Store real total cost for final profit calculation
            custo_operacional_mensal_kit = custo_operacional_mensal_kit + Decimal(str(vlt_manut))
            custo_total_mensal_kit = custo_aquisicao_kit + vlr_instal_calc + Decimal(str(vlt_manut))

        else:
            # Original Locacao/Comodato Logic
            if kit.instalacao_inclusa:
                vlr_instal_calc = vlr_instal_calc_base_manut
                valor_mensal_locacao_base = ((custo_aquisicao_kit + vlr_instal_calc) * fator_margem) * tx_locacao
            else:
                valor_mensal_locacao_base = (custo_aquisicao_kit * fator_margem) * tx_locacao

            valor_base_venda = custo_aquisicao_kit * fator_margem
            
            perc_comissao_locacao = Decimal(getattr(kit, 'perc_comissao', 0) or 0) / Decimal(100.0)
            com_destinado_loc = valor_base_venda * perc_comissao_locacao
            
            # --- START SERVICE COMMISSION CALCULATION ---
            valor_destinado_comissao_servicos = Decimal("0.0")
            comissao_venda_origens = [
                {
                    "origem": "Comissão percentual do kit",
                    "base": float(round(valor_base_venda, 2)),
                    "regra": f"{float(perc_comissao_locacao * 100):.2f}%",
                    "valor_destinado": float(round(com_destinado_loc, 2))
                }
            ]
            
            # Resolve active policy
            policy_id = kit.commercial_policy_id or (sales_budget.commercial_policy_id if sales_budget else None)
            policy = None
            if policy_id:
                from src.modules.companies.models import CommercialPolicy
                policy = self.db.query(CommercialPolicy).filter(
                    CommercialPolicy.id == policy_id,
                    CommercialPolicy.ativo == True
                ).first()
                
            if not policy:
                from src.modules.companies.models import CommercialPolicy
                comp_id = kit.company_id or (sales_budget.company_id if sales_budget else None)
                if comp_id:
                    policy = self.db.query(CommercialPolicy).filter(
                        CommercialPolicy.company_id == comp_id,
                        CommercialPolicy.is_default == True,
                        CommercialPolicy.ativo == True
                    ).first()
                
            if policy and policy.service_commissions:
                # Group active service commission rules
                rules_by_service = {
                    sc.own_service_id: sc 
                    for sc in policy.service_commissions 
                    if sc.ativo and sc.commission_installments > 0
                }
                
                # Check for items that are SERVICO_PROPRIO in the kit
                for item in kit.items:
                    if getattr(item, "tipo_item", "PRODUTO") == "SERVICO_PROPRIO" and getattr(item, "own_service_id", None):
                        rule = rules_by_service.get(item.own_service_id)
                        if rule:
                            # Preço mensal do serviço (venda_unitario_item) was calculated in the items loop.
                            venda_mensal_unit = Decimal("0.0")
                            for summary in item_summaries:
                                if (summary.get("id") == str(item.id)) or (summary.get("own_service_id") == str(item.own_service_id)):
                                    venda_mensal_unit = Decimal(str(summary.get("venda_unitario_item", 0.0)))
                                    break
                            
                            qty = Decimal(str(item.quantidade_no_kit or 1.0))
                            valor_mensal_total_servico = venda_mensal_unit * qty
                            valor_destinado_comissao_servico = valor_mensal_total_servico * Decimal(str(rule.commission_installments))
                            
                            valor_destinado_comissao_servicos += valor_destinado_comissao_servico
                            
                            service_name = getattr(rule.own_service, "nome_servico", "Serviço Próprio")
                            comissao_venda_origens.append({
                                "origem": f"Serviço {service_name}",
                                "base": float(round(valor_mensal_total_servico, 2)),
                                "regra": f"{rule.commission_installments} mensalidade" if rule.commission_installments == 1 else f"{rule.commission_installments} mensalidades",
                                "valor_destinado": float(round(valor_destinado_comissao_servico, 2))
                            })
                
                # Check for items that are SERVICO_PROPRIO in Block 6 (kit.costs)
                if hasattr(kit, 'costs') and kit.costs:
                    for cost in kit.costs:
                        if getattr(cost, "tipo_item", "PRODUTO") == "SERVICO_PROPRIO" and getattr(cost, "own_service_id", None):
                            rule = rules_by_service.get(cost.own_service_id)
                            if rule:
                                # For LOCACAO/COMODATO, the service selling price in Block 6 is: cost.valor_unitario * kit.fator_manutencao
                                fator_manut_val = Decimal(str(kit.fator_manutencao if kit.fator_manutencao is not None else 1))
                                venda_mensal_unit = Decimal(str(cost.valor_unitario or 0)) * fator_manut_val
                                
                                qty = Decimal(str(cost.quantidade or 1.0))
                                valor_mensal_total_servico = venda_mensal_unit * qty
                                valor_destinado_comissao_servico = valor_mensal_total_servico * Decimal(str(rule.commission_installments))
                                
                                valor_destinado_comissao_servicos += valor_destinado_comissao_servico
                                
                                service_name = getattr(rule.own_service, "nome_servico", "Serviço Próprio")
                                comissao_venda_origens.append({
                                    "origem": f"Serviço {service_name} (B6)",
                                    "base": float(round(valor_mensal_total_servico, 2)),
                                    "regra": f"{rule.commission_installments} mensalidade" if rule.commission_installments == 1 else f"{rule.commission_installments} mensalidades",
                                    "valor_destinado": float(round(valor_destinado_comissao_servico, 2))
                                })
            
            # Add service commissions to total com_destinado_loc
            com_destinado_loc += valor_destinado_comissao_servicos
            # --- END SERVICE COMMISSION CALCULATION ---
            
            vlt_comissao_dsr_loc = Decimal("0.0")
            vlt_comissao_fgts_loc = Decimal("0.0")
            vlt_comissao_inss_loc = Decimal("0.0")
            vlt_comissao_demais_loc = Decimal("0.0")
            
            if tipo_com == "COMISSAO_POR_DENTRO" and com_destinado_loc > 0:
                fator_total = (Decimal("1") + perc_dsr / Decimal("100")) * (Decimal("1") + (perc_fgts + perc_inss + perc_demais) / Decimal("100"))
                comissao_real_loc = com_destinado_loc / fator_total
                vlt_comissao_dsr_loc = comissao_real_loc * perc_dsr / Decimal("100")
                vlt_comissao_fgts_loc = (comissao_real_loc + vlt_comissao_dsr_loc) * perc_fgts / Decimal("100")
                vlt_comissao_inss_loc = (comissao_real_loc + vlt_comissao_dsr_loc) * perc_inss / Decimal("100")
                vlt_comissao_demais_loc = (comissao_real_loc + vlt_comissao_dsr_loc) * perc_demais / Decimal("100")
                
                soma = comissao_real_loc + vlt_comissao_dsr_loc + vlt_comissao_fgts_loc + vlt_comissao_inss_loc + vlt_comissao_demais_loc
                diff = com_destinado_loc - soma
                comissao_real_loc += diff
                
                valor_comissao_locacao = comissao_real_loc
            else:
                valor_comissao_locacao = com_destinado_loc
                
            valor_despesa_operacional_loc = valor_base_venda * perc_desp_op / Decimal("100")

            perc_despesas_adm_locacao = Decimal(getattr(kit, 'perc_despesas_adm', 0) or 0) / Decimal(100.0)
            
            # Monitoramento
            custo_monitoramento_unitario = Decimal(getattr(kit, 'custo_monitoramento_unitario', 0) or 0)
            fator_monitoramento = Decimal(getattr(kit, 'fator_monitoramento', 1) or 1)
            venda_unit_monitoramento = custo_monitoramento_unitario * fator_monitoramento
            receita_total_monitoramento = venda_unit_monitoramento * Decimal(str(kit.prazo_contrato_meses or 1))
            custo_total_monitoramento = custo_monitoramento_unitario * Decimal(str(kit.prazo_contrato_meses or 1))
            lucro_total_monitoramento = receita_total_monitoramento - custo_total_monitoramento

            # Manutenção
            vlt_manut = Decimal("0.0")
            
            if kit.manutencao_inclusa:
                tx_manut = (Decimal(str(kit.taxa_manutencao_anual or 0)) / Decimal(12.0)) / Decimal(100.0)
                vlt_manut = (custo_aquisicao_kit + vlr_instal_calc_base_manut) * fator_margem * tx_manut
            else:
                fator_manut = Decimal(str(kit.fator_manutencao if kit.fator_manutencao is not None else 1))
                vlt_manut = custo_operacional_mensal_kit * fator_manut
                    
            valor_parcela_locacao = valor_mensal_locacao_base
            manutencao_mensal = vlt_manut

            # Removing duplicate INSTALACAO check here as it is handled by the unified sales block
            valor_base_final = valor_parcela_locacao + manutencao_mensal + venda_unit_monitoramento
            valor_despesas_adm_locacao = valor_base_final * perc_despesas_adm_locacao
            # custo_operacional_mensal_kit = raw Block 6 cost (DO NOT MUTATE)
            # custo_total_mensal_kit = all operational costs for profitability calc
            custo_total_mensal_kit = custo_operacional_mensal_kit + Decimal(str(vlt_manut)) + custo_monitoramento_unitario

        # 14. Calculo de Impostos
        # aliq_total_impostos was calculated at the top
        # Pre-initialize so static analysis never sees these as potentially uninitialized
        aliq_base = Decimal("0.0")
        aliq_iss_pct = Decimal("0.0")

        
        if aliq_total_impostos >= Decimal(1.0):
            aliq_total_impostos = Decimal("0.99") # Safety fallback
            
        if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
            # For Sales and Installation exactly like Orçamento de Venda: impostos are calculated ON the final price.
            # But wait, now some items used aliq_produtos and others aliq_servicos! 
            # So the total `valor_impostos` should be the sum of all `imposto_venda_item` for products
            # PLUS the maintenance and installation taxes (which are usually ISS)
            valor_mensal_kit = valor_base_final
            
            # Impostos from products in the kit:
            impostos_produtos_base = total_imposto_itens_venda
            # Impostos from Instalacao (ISS):
            impostos_instalacao = valor_venda_instalacao * aliq_servicos
            # Impostos from Manutencao (ISS):
            impostos_manutencao = valor_venda_manutencao * aliq_servicos
            
            valor_impostos = impostos_produtos_base + impostos_instalacao + impostos_manutencao
            if force_12_icms:
                valor_impostos -= total_st_kit
            valor_mensal_antes_impostos = valor_base_final
        else:
            # Locação / Comodato
            valor_mensal_antes_impostos = valor_base_final
            valor_mensal_kit = valor_base_final
            
            faturamento_separado = getattr(kit, 'faturamento_servico_separado', False)
            
            aliq_base = sum([
                Decimal(str(kit.aliq_pis or 0)),
                Decimal(str(kit.aliq_cofins or 0)),
                Decimal(str(kit.aliq_csll or 0)),
                Decimal(str(kit.aliq_irpj or 0))
            ]) / Decimal(100.0)
            aliq_iss_pct = Decimal(str(kit.aliq_iss or 0)) / Decimal(100.0)  # always initialized in this branch

            # --- START UPFRONT INSTALLATION TAX CALCULATION ---
            imposto_instalacao_upfront = Decimal("0.0")
            venda_instalacao_upfront = Decimal("0.0")
            if kit.instalacao_inclusa:
                venda_instalacao_upfront = locals().get("vlr_instal_calc_base_manut", Decimal("0.0"))
            else:
                venda_instalacao_upfront = locals().get("custo_instalacao_avulso", Decimal("0.0"))
                
            if venda_instalacao_upfront > 0:
                if faturamento_separado:
                    imposto_instalacao_upfront = venda_instalacao_upfront * (aliq_base + aliq_iss_pct)
                else:
                    imposto_instalacao_upfront = venda_instalacao_upfront * aliq_total_impostos
            # --- END UPFRONT INSTALLATION TAX CALCULATION ---

            if faturamento_separado:
                # Group 1: Products/Equipment (Full Locação Base including diluted installation) without ISS
                locacao_equipamento = valor_mensal_locacao_base
                impostos_grupo_1 = locacao_equipamento * aliq_base
                
                # Group 2: Services (Maintenance and Monitoring) with ISS
                impostos_grupo_2 = (manutencao_mensal + venda_unit_monitoramento) * (aliq_base + aliq_iss_pct)
                
                valor_impostos = impostos_grupo_1 + impostos_grupo_2
                if valor_mensal_kit > 0:
                    aliq_total_impostos = valor_impostos / valor_mensal_kit
            else:
                # If unificado, the entire monthly value is taxed equally (including ISS)
                mensal_tributavel = valor_mensal_kit
                valor_impostos = mensal_tributavel * aliq_total_impostos

        # 16. Receita Liquida
        receita_liquida_mensal_kit = valor_mensal_kit - valor_impostos

        # 16.5 Sales expenses (freight, admin expenses, and commission)
        vlt_frete_venda = valor_mensal_kit * perc_frete_venda
        vlt_despesas_adm = valor_mensal_kit * perc_despesas_adm
        
        com_destinado = valor_mensal_kit * perc_comissao
        vlt_comissao_dsr = Decimal("0.0")
        vlt_comissao_fgts = Decimal("0.0")
        vlt_comissao_inss = Decimal("0.0")
        vlt_comissao_demais = Decimal("0.0")
        
        if tipo_com == "COMISSAO_POR_DENTRO" and com_destinado > 0:
            fator_total = (Decimal("1") + perc_dsr / Decimal("100")) * (Decimal("1") + (perc_fgts + perc_inss + perc_demais) / Decimal("100"))
            comissao_real = com_destinado / fator_total
            vlt_comissao_dsr = comissao_real * perc_dsr / Decimal("100")
            vlt_comissao_fgts = (comissao_real + vlt_comissao_dsr) * perc_fgts / Decimal("100")
            vlt_comissao_inss = (comissao_real + vlt_comissao_dsr) * perc_inss / Decimal("100")
            vlt_comissao_demais = (comissao_real + vlt_comissao_dsr) * perc_demais / Decimal("100")
            
            soma = comissao_real + vlt_comissao_dsr + vlt_comissao_fgts + vlt_comissao_inss + vlt_comissao_demais
            diff = com_destinado - soma
            comissao_real += diff
            
            vlt_comissao = comissao_real
        else:
            vlt_comissao = com_destinado
            
        vlt_despesa_operacional = valor_mensal_kit * perc_desp_op / Decimal("100")

        # 17. Lucro Mensal
        if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
            lucro_mensal_kit = receita_liquida_mensal_kit - custo_total_mensal_kit - custo_mensal_bloco_7 + credito_icms_compra_total - (vlt_frete_venda + vlt_despesas_adm + com_destinado) - vlt_despesa_operacional
        else:
            # Commission and Operational Expenses are upfront and do not repeat monthly
            lucro_mensal_kit = receita_liquida_mensal_kit - custo_total_mensal_kit - custo_mensal_bloco_7 - (vlt_frete_venda + vlt_despesas_adm)

        margem_kit = Decimal("0.0")
        if receita_liquida_mensal_kit > 0:
            if kit.tipo_contrato == "INSTALACAO" or kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
                margem_kit = (lucro_mensal_kit / valor_mensal_kit) * Decimal(100.0)
            else:
                margem_kit = (lucro_mensal_kit / receita_liquida_mensal_kit) * Decimal(100.0)

        # 18. Granular metrics for the summary (Venda vs Manutenção)
        lucro_manutencao = Decimal("0.0")
        margem_manutencao = Decimal("0.0")
        venda_manutencao_total = Decimal("0.0")
        
        lucro_equipamentos = Decimal("0.0")
        margem_equipamentos = Decimal("0.0")
        venda_equipamentos_total = Decimal("0.0")

        if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
            # Maintenance Metrics
            venda_manutencao_total = valor_venda_manutencao
            custo_manut_total_calc = vlt_manut
            imposto_manut_total = impostos_manutencao
            despesa_op_manutencao = venda_manutencao_total * perc_desp_op / Decimal("100")
            lucro_manutencao = venda_manutencao_total - custo_manut_total_calc - imposto_manut_total - (venda_manutencao_total * (perc_frete_venda + perc_despesas_adm + perc_comissao)) - despesa_op_manutencao
            if venda_manutencao_total > 0:
                margem_manutencao = (lucro_manutencao / venda_manutencao_total) * Decimal(100.0)
            
            # Equipment Metrics (Products + Installation)
            venda_equipamentos_total = valor_venda_produtos + valor_venda_instalacao
            custo_equipamentos_total = custo_aquisicao_kit + vlr_instal_calc
            imposto_equipamentos_total = impostos_produtos_base + impostos_instalacao
            if force_12_icms:
                imposto_equipamentos_total -= total_st_kit
            despesa_op_equipamentos = venda_equipamentos_total * perc_desp_op / Decimal("100")
            lucro_equipamentos = venda_equipamentos_total - custo_equipamentos_total - imposto_equipamentos_total - (venda_equipamentos_total * (perc_frete_venda + perc_despesas_adm + perc_comissao)) + credito_icms_compra_total - despesa_op_equipamentos
            if venda_equipamentos_total > 0:
                margem_equipamentos = (lucro_equipamentos / venda_equipamentos_total) * Decimal(100.0)
        else:
            # For Locacao/Comodato, we treat the main rental fee as equipment revenue for this summary logic
            venda_equipamentos_total = valor_mensal_locacao_base
            venda_manutencao_total = manutencao_mensal
            # Simplified profit splits for Locacao
            faturamento_separado = getattr(kit, 'faturamento_servico_separado', False)
            if faturamento_separado:
                imposto_equip_loc = venda_equipamentos_total * aliq_base
                imposto_manut_loc = venda_manutencao_total * (aliq_base + aliq_iss_pct)
            else:
                imposto_equip_loc = venda_equipamentos_total * aliq_total_impostos
                imposto_manut_loc = venda_manutencao_total * aliq_total_impostos
                
            lucro_equipamentos = venda_equipamentos_total - (custo_aquisicao_kit + vlr_instal_calc) - imposto_equip_loc
            if venda_equipamentos_total > 0:
                margem_equipamentos = (lucro_equipamentos / venda_equipamentos_total) * Decimal(100.0)
                
            lucro_manutencao = venda_manutencao_total - custo_operacional_mensal_kit - imposto_manut_loc
            if venda_manutencao_total > 0:
                margem_manutencao = (lucro_manutencao / venda_manutencao_total) * Decimal(100.0)

        # ROI = Investimento / (Faturamento - Custo Monitoramento - Custo Op. Bloco6 - Custo Bloco7 - Impostos - Desp. Adm)
        custo_monit = locals().get("custo_monitoramento_unitario", Decimal("0.0"))
        valor_com_loc = locals().get("valor_comissao_locacao", Decimal("0.0"))
        valor_desp_adm_loc = locals().get("valor_despesas_adm_locacao", Decimal("0.0"))
        imposto_inst = locals().get("imposto_instalacao_upfront", Decimal("0.0"))
        
        if kit.tipo_contrato in ["LOCACAO", "COMODATO"]:
            investimento_total = custo_aquisicao_kit + imposto_inst + locals().get("com_destinado_loc", Decimal("0.0"))
            if kit.tipo_contrato == "COMODATO":
                investimento_total += locals().get("valor_despesa_operacional_loc", Decimal("0.0"))
            
            roi_denominador = valor_mensal_antes_impostos - custo_monit - custo_operacional_mensal_kit - custo_mensal_bloco_7 - valor_impostos - valor_desp_adm_loc
        else:
            investimento_total = custo_aquisicao_kit + imposto_inst + valor_com_loc + valor_desp_adm_loc
            roi_denominador = valor_mensal_antes_impostos - custo_monit - custo_operacional_mensal_kit - custo_mensal_bloco_7 - valor_impostos

        roi_meses = float(investimento_total / roi_denominador) if roi_denominador > 0 else 0.0

        # ROI Equipamento = (Custo de Aquisição + Comissão + Despesa Adm / Desp. Op) / (Locação Mensal - Imposto de Locação)
        roi_equipamento_meses = 0.0
        if kit.tipo_contrato in ["LOCACAO", "COMODATO"]:
            locacao_liquida = venda_equipamentos_total - locals().get("imposto_equip_loc", Decimal("0.0"))
            if locacao_liquida > 0:
                numerator = custo_aquisicao_kit + locals().get("com_destinado_loc", Decimal("0.0"))
                if kit.tipo_contrato == "COMODATO":
                    numerator += locals().get("valor_despesa_operacional_loc", Decimal("0.0"))
                roi_equipamento_meses = float(numerator / locacao_liquida)

        # 19. Aggregate granular tax fields for the frontend Fechamento de Venda
        faturamento_total_venda = valor_mensal_kit
        if kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
            # Sum from individual item_summaries for precision
            vlt_pis = sum(Decimal(str(is_.get("pis_unit", 0))) for is_ in item_summaries)
            vlt_cofins = sum(Decimal(str(is_.get("cofins_unit", 0))) for is_ in item_summaries)
            vlt_csll = sum(Decimal(str(is_.get("csll_unit", 0))) for is_ in item_summaries)
            vlt_irpj = sum(Decimal(str(is_.get("irpj_unit", 0))) for is_ in item_summaries)
            vlt_icms = sum(Decimal(str(is_.get("icms_unit", 0))) for is_ in item_summaries)
            vlt_iss = sum(Decimal(str(is_.get("iss_unit", 0))) for is_ in item_summaries)
            # Add ISS from installation and maintenance (services not in item_summaries)
            vlt_iss += impostos_instalacao + impostos_manutencao
            faturamento_total_venda = venda_equipamentos_total + venda_manutencao_total
        else:
            # Locação/Comodato: calculate from aliquots × faturamento
            vlt_pis = faturamento_total_venda * (Decimal(str(kit.aliq_pis or 0)) / Decimal(100))
            vlt_cofins = faturamento_total_venda * (Decimal(str(kit.aliq_cofins or 0)) / Decimal(100))
            vlt_csll = faturamento_total_venda * (Decimal(str(kit.aliq_csll or 0)) / Decimal(100))
            vlt_irpj = faturamento_total_venda * (Decimal(str(kit.aliq_irpj or 0)) / Decimal(100))
            vlt_icms = Decimal("0")  # Locação doesn't apply ICMS on revenue
            if faturamento_separado:
                vlt_iss = (manutencao_mensal + venda_unit_monitoramento) * (Decimal(str(kit.aliq_iss or 0)) / Decimal(100))
            else:
                vlt_iss = faturamento_total_venda * (Decimal(str(kit.aliq_iss or 0)) / Decimal(100))

        vlt_frete_venda = faturamento_total_venda * perc_frete_venda
        vlt_despesas_adm = faturamento_total_venda * perc_despesas_adm
        
        com_destinado = faturamento_total_venda * perc_comissao
        vlt_comissao_dsr = Decimal("0.0")
        vlt_comissao_fgts = Decimal("0.0")
        vlt_comissao_inss = Decimal("0.0")
        vlt_comissao_demais = Decimal("0.0")
        
        if tipo_com == "COMISSAO_POR_DENTRO" and com_destinado > 0:
            fator_total = (Decimal("1") + perc_dsr / Decimal("100")) * (Decimal("1") + (perc_fgts + perc_inss + perc_demais) / Decimal("100"))
            comissao_real = com_destinado / fator_total
            vlt_comissao_dsr = comissao_real * perc_dsr / Decimal("100")
            vlt_comissao_fgts = (comissao_real + vlt_comissao_dsr) * perc_fgts / Decimal("100")
            vlt_comissao_inss = (comissao_real + vlt_comissao_dsr) * perc_inss / Decimal("100")
            vlt_comissao_demais = (comissao_real + vlt_comissao_dsr) * perc_demais / Decimal("100")
            
            soma = comissao_real + vlt_comissao_dsr + vlt_comissao_fgts + vlt_comissao_inss + vlt_comissao_demais
            diff = com_destinado - soma
            comissao_real += diff
            
            vlt_comissao = comissao_real
        else:
            vlt_comissao = com_destinado
            
        if kit.tipo_contrato in ["LOCACAO", "COMODATO"]:
            vlt_despesa_operacional = valor_base_venda * perc_desp_op / Decimal("100")
        else:
            vlt_despesa_operacional = faturamento_total_venda * perc_desp_op / Decimal("100")
        
        if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
            valor_comissao_locacao = com_destinado
            valor_despesas_adm_locacao = vlt_despesas_adm


        # Aggregate cost breakdown for Fechamento
        custo_equip_total_calc = custo_aquisicao_kit + vlr_instal_calc
        custo_manut_total_calc = vlt_manut if kit.tipo_contrato == "VENDA_EQUIPAMENTOS" else custo_operacional_mensal_kit

        # Target Margin Solver (converts minimum desired margin to minimum factor, price, profit)
        fator_minimo_calculado = None
        valor_venda_minimo = None
        lucro_minimo = None
        margem_minima_resultante = None

        if override_factor is None and getattr(kit, "margem_minima_desejada", None) is not None:
            target_margin = Decimal(str(kit.margem_minima_desejada))
            low = Decimal("0.0")
            high = Decimal(str(kit.fator_margem_locacao or 1.0))
            
            # Binary search
            for _ in range(25):
                mid = (low + high) / 2
                sub_res = self.calculate_financials(kit, tenant_id, override_factor=mid)
                sub_margin = Decimal(str(sub_res["margem_kit_raw"]))
                
                if sub_margin >= target_margin:
                    high = mid
                else:
                    low = mid
            
            best_factor = high
            min_res = self.calculate_financials(kit, tenant_id, override_factor=best_factor)
            
            fator_minimo_calculado = best_factor
            valor_venda_minimo = Decimal(str(min_res["summary"]["valor_mensal_kit"]))
            lucro_minimo = Decimal(str(min_res["summary"]["lucro_mensal_kit"]))
            margem_minima_resultante = Decimal(str(min_res["margem_kit_raw"]))

        # Build comissionamento_detalhado JSON structure
        if kit.tipo_contrato not in ["LOCACAO", "COMODATO"]:
            comissao_venda_origens = [
                {
                    "origem": "Comissão percentual do kit",
                    "base": float(round(faturamento_total_venda, 2)),
                    "regra": f"{float(perc_comissao * 100):.2f}%",
                    "valor_destinado": float(round(com_destinado, 2))
                }
            ]
            
        comissionamento_detalhado = {
            "comissao_venda": comissao_venda_origens,
            "detalhamento_incidencias": {
                "comissao_efetiva": float(round(vlt_comissao, 2)) if kit.tipo_contrato not in ["LOCACAO", "COMODATO"] else float(round(valor_comissao_locacao, 2)),
                "dsr": float(round(vlt_comissao_dsr, 2)) if kit.tipo_contrato not in ["LOCACAO", "COMODATO"] else float(round(vlt_comissao_dsr_loc, 2)),
                "fgts": float(round(vlt_comissao_fgts, 2)) if kit.tipo_contrato not in ["LOCACAO", "COMODATO"] else float(round(vlt_comissao_fgts_loc, 2)),
                "inss": float(round(vlt_comissao_inss, 2)) if kit.tipo_contrato not in ["LOCACAO", "COMODATO"] else float(round(vlt_comissao_inss_loc, 2)),
                "demais": float(round(vlt_comissao_demais, 2)) if kit.tipo_contrato not in ["LOCACAO", "COMODATO"] else float(round(vlt_comissao_demais_loc, 2)),
                "total": float(round(com_destinado, 2)) if kit.tipo_contrato not in ["LOCACAO", "COMODATO"] else float(round(com_destinado_loc, 2))
            }
        }

        return {
            "margem_kit_raw": margem_kit,
            "comissionamento_detalhado": comissionamento_detalhado,
            "summary": {
                "fator_minimo_calculado": round(fator_minimo_calculado, 4) if fator_minimo_calculado is not None else None,
                "valor_venda_minimo": round(valor_venda_minimo, 2) if valor_venda_minimo is not None else None,
                "lucro_minimo": round(lucro_minimo, 2) if lucro_minimo is not None else None,
                "margem_minima_resultante": round(margem_minima_resultante, 2) if margem_minima_resultante is not None else None,
                "prazo_mensalidades": prazo_mensalidades,
                "custo_operacional_mensal_kit": round(custo_operacional_mensal_kit, 2),  # type: ignore
                "custo_aquisicao_kit": round(custo_aquisicao_kit, 2),  # type: ignore
                "custo_aquisicao_produtos": round(custo_aquisicao_produtos, 2),  # type: ignore
                "custo_aquisicao_servicos": round(custo_aquisicao_servicos, 2),  # type: ignore
                "custo_aquisicao_total": round(custo_aquisicao_total, 2),  # type: ignore
                "total_difal_kit": round(total_difal_kit, 2),  # type: ignore
                "total_st_kit": round(total_st_kit, 2),  # type: ignore
                "total_ipi_kit": round(total_ipi_kit, 2),  # type: ignore
                "total_base_cost_total": round(total_base_cost_kit * Decimal(str(kit.quantidade_kits or 1)), 2),  # type: ignore
                "total_ipi_total": round(total_ipi_kit * Decimal(str(kit.quantidade_kits or 1)), 2),  # type: ignore
                "total_st_total": round(total_st_kit * Decimal(str(kit.quantidade_kits or 1)), 2),  # type: ignore
                "total_difal_total": round(total_difal_kit * Decimal(str(kit.quantidade_kits or 1)), 2),  # type: ignore
                "custo_total_mensal_kit": round(custo_total_mensal_kit, 2),  # type: ignore
                "tx_locacao": round(tx_locacao, 6),  # type: ignore
                "vlr_instal_calc": round(vlr_instal_calc, 2),  # type: ignore
                "valor_mensal_locacao_base": round(valor_mensal_locacao_base, 2),  # type: ignore
                "vlt_manut": round(vlt_manut, 2),  # type: ignore
                "valor_base_venda": round(valor_base_venda, 2),  # type: ignore
                "imposto_instalacao": round(locals().get("imposto_instalacao_upfront", Decimal("0.0")), 2),  # type: ignore
                "valor_comissao_locacao": round(locals().get("valor_comissao_locacao", Decimal("0.0")), 2),  # type: ignore
                "valor_despesas_adm_locacao": round(locals().get("valor_despesas_adm_locacao", Decimal("0.0")), 2),  # type: ignore
                "valor_despesa_operacional_loc": round(locals().get("valor_despesa_operacional_loc", Decimal("0.0")), 2),  # type: ignore
                "vlt_comissao_dsr_loc": round(locals().get("vlt_comissao_dsr_loc", Decimal("0.0")), 2),  # type: ignore
                "vlt_comissao_fgts_loc": round(locals().get("vlt_comissao_fgts_loc", Decimal("0.0")), 2),  # type: ignore
                "vlt_comissao_inss_loc": round(locals().get("vlt_comissao_inss_loc", Decimal("0.0")), 2),  # type: ignore
                "vlt_comissao_demais_loc": round(locals().get("vlt_comissao_demais_loc", Decimal("0.0")), 2),  # type: ignore
                "valor_parcela_locacao": round(valor_parcela_locacao, 2),  # type: ignore
                "manutencao_mensal": round(manutencao_mensal, 2),  # type: ignore
                "valor_mensal_antes_impostos": round(valor_mensal_antes_impostos, 2),  # type: ignore
                "aliq_total_impostos": round(aliq_total_impostos * Decimal(100.0), 2),  # type: ignore
                "valor_impostos": round(valor_impostos, 2),  # type: ignore
                "valor_mensal_kit": round(valor_mensal_kit, 2),  # type: ignore
                "receita_liquida_mensal_kit": round(receita_liquida_mensal_kit, 2),  # type: ignore
                "lucro_mensal_kit": round(lucro_mensal_kit, 2),  # type: ignore
                "margem_kit": round(margem_kit, 2),  # type: ignore
                "roi_meses": round(roi_meses, 1),  # type: ignore
                "roi_equipamento_meses": round(roi_equipamento_meses, 2), # type: ignore
                "investimento_total": round(investimento_total, 2), # type: ignore
                "roi_denominador": round(roi_denominador, 2), # type: ignore
                "imposto_equip_loc": round(locals().get("imposto_equip_loc", Decimal("0.0")), 2), # type: ignore
                "credito_icms_compra_total": round(credito_icms_compra_total, 2), # type: ignore
                # New granular fields
                "venda_equipamentos_total": round(venda_equipamentos_total, 2), # type: ignore
                "lucro_equipamentos": round(lucro_equipamentos, 2), # type: ignore
                "margem_equipamentos": round(margem_equipamentos, 2), # type: ignore
                "venda_manutencao_total": round(venda_manutencao_total, 2), # type: ignore
                "lucro_manutencao": round(lucro_manutencao, 2), # type: ignore
                "margem_manutencao": round(margem_manutencao, 2), # type: ignore
                
                "venda_unit_monitoramento": round(locals().get("venda_unit_monitoramento", Decimal("0.0")), 2),  # type: ignore
                "custo_monitoramento_unitario": round(locals().get("custo_monitoramento_unitario", Decimal("0.0")), 2),  # type: ignore
                "receita_total_monitoramento": round(locals().get("receita_total_monitoramento", Decimal("0.0")), 2),  # type: ignore
                "custo_total_monitoramento": round(locals().get("custo_total_monitoramento", Decimal("0.0")), 2),  # type: ignore
                "lucro_total_monitoramento": round(locals().get("lucro_total_monitoramento", Decimal("0.0")), 2),  # type: ignore
                "custo_mensal_bloco_7": round(locals().get("custo_mensal_bloco_7", Decimal("0.0")), 2),  # type: ignore
                # Granular tax/expense breakdown for Fechamento de Venda
                "faturamento_total_venda": round(faturamento_total_venda, 2), # type: ignore
                "vlt_pis": round(vlt_pis, 2), # type: ignore
                "vlt_cofins": round(vlt_cofins, 2), # type: ignore
                "vlt_csll": round(vlt_csll, 2), # type: ignore
                "vlt_irpj": round(vlt_irpj, 2), # type: ignore
                "vlt_icms": round(vlt_icms, 2), # type: ignore
                "vlt_iss": round(vlt_iss, 2), # type: ignore
                "vlt_frete_venda": round(vlt_frete_venda, 2), # type: ignore
                "vlt_despesas_adm": round(vlt_despesas_adm, 2), # type: ignore
                "vlt_comissao": round(vlt_comissao, 2), # type: ignore
                "vlt_comissao_dsr": round(locals().get("vlt_comissao_dsr", Decimal("0.0")), 2),
                "vlt_comissao_fgts": round(locals().get("vlt_comissao_fgts", Decimal("0.0")), 2),
                "vlt_comissao_inss": round(locals().get("vlt_comissao_inss", Decimal("0.0")), 2),
                "vlt_comissao_demais": round(locals().get("vlt_comissao_demais", Decimal("0.0")), 2),
                "vlt_despesa_operacional": round(locals().get("vlt_despesa_operacional", Decimal("0.0")), 2),
                "custo_equip_total_calc": round(custo_equip_total_calc, 2), # type: ignore
                "custo_manut_total_calc": round(custo_manut_total_calc, 2), # type: ignore
            },
            "item_summaries": item_summaries,
            "cost_summaries": cost_summaries
        }

    def list_kits(self, tenant_id: str, company_id: str, sales_budget_id: Optional[str] = None, tipo_contrato: Optional[str] = None):
        query = self.db.query(OpportunityKit).filter(
            OpportunityKit.tenant_id == tenant_id,
            OpportunityKit.company_id == company_id
        )
        if tipo_contrato:
            query = query.filter(OpportunityKit.tipo_contrato == tipo_contrato)

        if sales_budget_id:
            query = query.filter(
                (OpportunityKit.sales_budget_id == None) | (OpportunityKit.sales_budget_id == sales_budget_id)
            )
        else:
            query = query.filter(OpportunityKit.sales_budget_id == None)
            
        kits = query.all()
        
        # Compute dynamic financials
        for kit in kits:
            fin = self.calculate_financials(kit, tenant_id, sales_budget_id=sales_budget_id)
            kit.summary = fin["summary"]
            kit.item_summaries = fin["item_summaries"]
        return kits

    def get_kit(self, kit_id: str, tenant_id: str, company_id: Optional[str] = None, sales_budget_id: Optional[str] = None, sales_proposal_id: Optional[str] = None):
        query = self.db.query(OpportunityKit).filter(
            OpportunityKit.id == kit_id,
            OpportunityKit.tenant_id == tenant_id
        )
        if company_id:
            query = query.filter(OpportunityKit.company_id == company_id)
        kit = query.first()
        if kit:
            fin = self.calculate_financials(kit, tenant_id, sales_budget_id=sales_budget_id, sales_proposal_id=sales_proposal_id)
            kit.summary = fin["summary"]
            kit.item_summaries = fin["item_summaries"]
        return kit

    def create_kit(self, tenant_id: str, company_id: str, data: OpportunityKitCreate) -> OpportunityKit:
        if data.prazo_instalacao_meses > data.prazo_contrato_meses:
            raise ValueError("Prazo de instalação não pode ser maior que o prazo do contrato.")
            
        qty_kits = data.quantidade_kits
        if data.licitacao_item_id:
            from src.modules.licitacoes.models import LicitacaoItem
            lic_item = self.db.query(LicitacaoItem).filter(LicitacaoItem.id == data.licitacao_item_id).first()
            if lic_item:
                qty_kits = int(lic_item.quantidade_total)

        # Default taxes and parameters to database company parameters if not specified or passed as 0
        from src.modules.companies.models import CompanySalesParameter
        sales_params = self.db.query(CompanySalesParameter).filter(CompanySalesParameter.company_id == company_id).first()
        
        # Suffix mapping based on tipo_contrato
        suffix = "locacao"
        if data.tipo_contrato == "COMODATO":
            suffix = "comodato"
        elif data.tipo_contrato in ("VENDA_EQUIPAMENTOS", "INSTALACAO"):
            suffix = "venda"
            
        def pick_param(base: str, passed_val) -> float:
            val = float(passed_val) if passed_val is not None else 0.0
            if val > 0.0:
                return val
            if not sales_params:
                return 0.0
            # Try specific suffix field first
            specific_field = f"{base}_{suffix}"
            specific_val = getattr(sales_params, specific_field, None)
            if specific_val is not None and float(specific_val) > 0.0:
                return float(specific_val)
            # Fallback to generic base field
            generic_val = getattr(sales_params, base, 0.0)
            return float(generic_val or 0.0)

        aliq_pis = pick_param("pis", data.aliq_pis)
        aliq_cofins = pick_param("cofins", data.aliq_cofins)
        aliq_csll = pick_param("csll", data.aliq_csll)
        aliq_irpj = pick_param("irpj", data.aliq_irpj)
        aliq_iss = pick_param("iss", data.aliq_iss)
        aliq_icms = pick_param("icms_interno", data.aliq_icms)
        perc_despesas_adm = pick_param("despesa_administrativa", data.perc_despesas_adm)
        perc_comissao = pick_param("comissionamento", data.perc_comissao)
        perc_frete_venda = pick_param("frete_venda_padrao", data.perc_frete_venda)

        kit = OpportunityKit(
            tenant_id=tenant_id,
            company_id=company_id,
            sales_budget_id=data.sales_budget_id,
            licitacao_id=data.licitacao_id,
            licitacao_item_id=data.licitacao_item_id,
            nome_kit=data.nome_kit,
            descricao_kit=data.descricao_kit,
            quantidade_kits=qty_kits,
            tipo_contrato=data.tipo_contrato,
            prazo_contrato_meses=data.prazo_contrato_meses,
            prazo_instalacao_meses=data.prazo_instalacao_meses,
            fator_margem_locacao=data.fator_margem_locacao,
            fator_margem_servicos_produtos=data.fator_margem_servicos_produtos,
            fator_margem_instalacao=data.fator_margem_instalacao,
            fator_margem_manutencao=data.fator_margem_manutencao,
            taxa_juros_mensal=data.taxa_juros_mensal,
            taxa_manutencao_anual=data.taxa_manutencao_anual,
            instalacao_inclusa=data.instalacao_inclusa,
            percentual_instalacao=data.percentual_instalacao,
            manutencao_inclusa=data.manutencao_inclusa,
            fator_manutencao=data.fator_manutencao,
            havera_manutencao=data.havera_manutencao,
            qtd_meses_manutencao=data.qtd_meses_manutencao,
            perc_frete_venda=perc_frete_venda,
            perc_despesas_adm=perc_despesas_adm,
            perc_comissao=perc_comissao,
            tipo_comissionamento=data.tipo_comissionamento,
            perc_dsr=data.perc_dsr,
            perc_fgts=data.perc_fgts,
            perc_inss=data.perc_inss,
            perc_demais_incidencias=data.perc_demais_incidencias,
            perc_despesa_operacional=data.perc_despesa_operacional,
            custo_monitoramento_unitario=data.custo_monitoramento_unitario,
            fator_monitoramento=data.fator_monitoramento,
            aliq_pis=aliq_pis,
            aliq_cofins=aliq_cofins,
            aliq_csll=aliq_csll,
            aliq_irpj=aliq_irpj,
            aliq_iss=aliq_iss,
            aliq_icms=aliq_icms,
            faturamento_servico_separado=data.faturamento_servico_separado,
            custo_manut_mensal_kit=data.custo_manut_mensal_kit,
            custo_suporte_mensal_kit=data.custo_suporte_mensal_kit,
            custo_seguro_mensal_kit=data.custo_seguro_mensal_kit,
            custo_logistica_mensal_kit=data.custo_logistica_mensal_kit,
            custo_software_mensal_kit=data.custo_software_mensal_kit,
            custo_itens_acessorios_mensal_kit=data.custo_itens_acessorios_mensal_kit,
            margem_minima_desejada=data.margem_minima_desejada,
            commercial_policy_id=data.commercial_policy_id
        )
        self.db.add(kit)
        self.db.flush()

        for item_data in data.items:
            item = OpportunityKitItem(
                kit_id=kit.id,
                tipo_item=item_data.tipo_item,
                product_id=item_data.product_id,
                own_service_id=item_data.own_service_id,
                descricao_item=item_data.descricao_item,
                quantidade_no_kit=item_data.quantidade_no_kit
            )
            self.db.add(item)
            
        for cost_data in data.costs:
            cost = OpportunityKitCost(
                kit_id=kit.id,
                tipo_item=cost_data.tipo_item,
                forma_execucao=cost_data.forma_execucao,
                own_service_id=cost_data.own_service_id,
                product_id=cost_data.product_id,
                tipo_custo=cost_data.tipo_custo,
                quantidade=cost_data.quantidade,
                valor_unitario=cost_data.valor_unitario
            )
            self.db.add(cost)

        for mcost_data in getattr(data, "monthly_costs", []):
            from src.modules.opportunity_kits.models import OpportunityKitMonthlyCost
            mcost = OpportunityKitMonthlyCost(
                kit_id=kit.id,
                servico=mcost_data.servico,
                tipo_custo=mcost_data.tipo_custo,
                quantidade=mcost_data.quantidade,
                valor_unitario=mcost_data.valor_unitario
            )
            self.db.add(mcost)
            
        self.db.flush()
        self.db.refresh(kit)

        # Calculate financials to validate and populate minimum columns before committing
        fin = self.calculate_financials(kit, tenant_id)
        current_margin = Decimal(str(fin["margem_kit_raw"]))
        kit.comissionamento_detalhado = fin.get("comissionamento_detalhado")
        
        if kit.margem_minima_desejada is not None:
            if Decimal(str(kit.margem_minima_desejada)) > current_margin:
                raise ValueError("A margem mínima desejada não pode ser maior que a margem atual do Kit.")
            
            kit.fator_minimo_calculado = fin["summary"].get("fator_minimo_calculado")
            kit.valor_venda_minimo = fin["summary"].get("valor_venda_minimo")
            kit.lucro_minimo = fin["summary"].get("lucro_minimo")
            kit.margem_minima_resultante = fin["summary"].get("margem_minima_resultante")
            
        self.db.commit()

        self.db.refresh(kit)
        if kit.licitacao_id:
            try:
                from src.modules.licitacoes.service import LicitacaoService
                LicitacaoService.invalidate_licitacao_totals(self.db, kit.licitacao_id)
            except Exception:
                pass
        fin = self.calculate_financials(kit, tenant_id)
        kit.summary = fin["summary"]
        kit.item_summaries = fin["item_summaries"]
        return kit

    def update_kit(self, kit_id: str, tenant_id: str, data: OpportunityKitUpdate, company_id: Optional[str] = None) -> OpportunityKit:
        kit = self.get_kit(kit_id, tenant_id, company_id)
        if not kit:
            return None
            
        update_data = data.model_dump(exclude_unset=True)
        
        items_data = update_data.pop("items", None)
        if items_data is not None:
            # Delete old items
            self.db.query(OpportunityKitItem).filter(OpportunityKitItem.kit_id == kit.id).delete()
            self.db.flush()
            # Insert new items
            for item in items_data:
                new_item = OpportunityKitItem(
                    kit_id=kit.id,
                    tipo_item=item.get("tipo_item", "PRODUTO"),
                    product_id=item.get("product_id"),
                    own_service_id=item.get("own_service_id"),
                    descricao_item=item["descricao_item"],
                    quantidade_no_kit=item["quantidade_no_kit"]
                )
                self.db.add(new_item)
                
        costs_data = update_data.pop("costs", None)
        if costs_data is not None:
            # Delete old costs
            self.db.query(OpportunityKitCost).filter(OpportunityKitCost.kit_id == kit.id).delete()
            self.db.flush()
            # Insert new costs
            for cost in costs_data:
                new_cost = OpportunityKitCost(
                    kit_id=kit.id,
                    tipo_item=cost.get("tipo_item", "PRODUTO"),
                    forma_execucao=cost.get("forma_execucao"),
                    own_service_id=cost.get("own_service_id"),
                    product_id=cost.get("product_id"),
                    tipo_custo=cost["tipo_custo"],
                    quantidade=cost["quantidade"],
                    valor_unitario=cost["valor_unitario"]
                )
                self.db.add(new_cost)

        mcosts_data = update_data.pop("monthly_costs", None)
        if mcosts_data is not None:
            from src.modules.opportunity_kits.models import OpportunityKitMonthlyCost
            self.db.query(OpportunityKitMonthlyCost).filter(OpportunityKitMonthlyCost.kit_id == kit.id).delete()
            self.db.flush()
            for mcost in mcosts_data:
                new_mcost = OpportunityKitMonthlyCost(
                    kit_id=kit.id,
                    servico=mcost["servico"],
                    tipo_custo=mcost["tipo_custo"],
                    quantidade=mcost["quantidade"],
                    valor_unitario=mcost["valor_unitario"]
                )
                self.db.add(new_mcost)

        for key, value in update_data.items():
            setattr(kit, key, value)
            
        if kit.prazo_instalacao_meses > kit.prazo_contrato_meses:
            raise ValueError("Prazo de instalação não pode ser maior que o prazo do contrato.")    

        self.db.flush()
        self.db.refresh(kit)

        # Calculate financials to validate and populate minimum columns before committing
        fin = self.calculate_financials(kit, tenant_id)
        current_margin = Decimal(str(fin["margem_kit_raw"]))
        kit.comissionamento_detalhado = fin.get("comissionamento_detalhado")
        
        if kit.margem_minima_desejada is not None:
            if Decimal(str(kit.margem_minima_desejada)) > current_margin:
                raise ValueError("A margem mínima desejada não pode ser maior que a margem atual do Kit.")
            
            kit.fator_minimo_calculado = fin["summary"].get("fator_minimo_calculado")
            kit.valor_venda_minimo = fin["summary"].get("valor_venda_minimo")
            kit.lucro_minimo = fin["summary"].get("lucro_minimo")
            kit.margem_minima_resultante = fin["summary"].get("margem_minima_resultante")
        else:
            kit.fator_minimo_calculado = None
            kit.valor_venda_minimo = None
            kit.lucro_minimo = None
            kit.margem_minima_resultante = None

        self.db.commit()
        self.db.refresh(kit)
        if kit.licitacao_id:
            try:
                from src.modules.licitacoes.service import LicitacaoService
                LicitacaoService.invalidate_licitacao_totals(self.db, kit.licitacao_id)
            except Exception:
                pass
        fin = self.calculate_financials(kit, tenant_id)
        kit.summary = fin["summary"]
        kit.item_summaries = fin["item_summaries"]
        return kit
    
    def recalculate_kit_preview(self, tenant_id: str, company_id: str, data: OpportunityKitCreate) -> dict:
        """Endpoint used to preview financials without saving to DB"""
        # Create a mock objects
        kit = OpportunityKit(**data.model_dump(exclude={"items", "costs", "monthly_costs"}))
        setattr(kit, "company_id", UUID(company_id) if company_id else None)  # type: ignore[arg-type]
        kit.items = [OpportunityKitItem(**item_data.model_dump()) for item_data in data.items]
        kit.costs = [OpportunityKitCost(**cost_data.model_dump()) for cost_data in data.costs]
        
        from src.modules.opportunity_kits.models import OpportunityKitMonthlyCost
        kit.monthly_costs = [OpportunityKitMonthlyCost(**mc_data.model_dump()) for mc_data in getattr(data, "monthly_costs", [])]
        
        fin = self.calculate_financials(kit, tenant_id)
        current_margin = Decimal(str(fin["margem_kit_raw"]))
        if kit.margem_minima_desejada is not None:
            if Decimal(str(kit.margem_minima_desejada)) > current_margin:
                raise ValueError("A margem mínima desejada não pode ser maior que a margem atual do Kit.")
        return fin
