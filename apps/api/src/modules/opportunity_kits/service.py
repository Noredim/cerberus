from uuid import UUID
from datetime import datetime
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

    def get_product_info(self, product_id: str, tenant_id: str, tipo_contrato: Optional[str] = None) -> dict:
        from src.modules.sales_budgets.service import calculate_product_cost_composition

        comp = calculate_product_cost_composition(self.db, product_id, tenant_id, "REVENDA" if tipo_contrato == "VENDA_EQUIPAMENTOS" else "USO_CONSUMO")
        if not comp:
            product = self.db.query(Product).filter(
                Product.id == product_id,
                Product.tenant_id == tenant_id
            ).first()
            if not product:
                return {"cost": Decimal("0.0"), "tipo": "MERCADORIA", "difal": Decimal("0.0"), "icms_st": Decimal("0.0")}
            custo_base = getattr(product, "vlr_referencia_revenda", 0) if tipo_contrato == "VENDA_EQUIPAMENTOS" else getattr(product, "vlr_referencia_uso_consumo", 0)
            return {
                "cost": Decimal(custo_base or 0),
                "tipo": product.tipo or "MERCADORIA",
                "difal": Decimal(getattr(product, "vlr_referencia_difal", 0) or 0),
                "icms_st": Decimal("0.0")
            }

        product = self.db.query(Product).filter(Product.id == product_id).first()
        tipo = product.tipo if product else "MERCADORIA"

        if tipo_contrato == "VENDA_EQUIPAMENTOS":
            if tipo in ["SERVICO", "LICENCA"]:
                custo_base = Decimal(comp.get("base_unitario", 0))
                icms_st = Decimal("0.0")
            else:
                custo_base = Decimal(comp.get("custo_unit_final", 0))
                icms_st = Decimal(comp.get("icms_st_final", 0))
        else:
            custo_base = Decimal(comp.get("custo_unit_final", 0))
            icms_st = Decimal("0.0")

        return {
            "cost": custo_base,
            "tipo": tipo,
            "base_unitario": Decimal(comp.get("base_unitario", 0)),
            "ipi": Decimal(comp.get("ipi_final", 0)),
            "frete_cif": Decimal(comp.get("frete_cif_final", 0)),
            "difal": Decimal(comp.get("difal_unitario", 0)),
            "icms_st": icms_st,
            "tem_st": icms_st > 0 or bool(comp.get("has_st", False))
        }

    def calculate_financials(self, kit: OpportunityKit, tenant_id: str) -> dict:
        # 2. Prazos do Contrato
        prazo_mensalidades = max(0, kit.prazo_contrato_meses - kit.prazo_instalacao_meses)
        if kit.prazo_instalacao_meses >= kit.prazo_contrato_meses:
            prazo_mensalidades = 0

        # 5. Custos Operacionais Mensais (Apenas valores da grid)
        custo_operacional_mensal_kit = Decimal("0.0")
        custo_instalacao_avulso = Decimal("0.0")
        
        perc_frete_venda = Decimal(kit.perc_frete_venda or 0) / Decimal(100.0)
        perc_despesas_adm = Decimal(kit.perc_despesas_adm or 0) / Decimal(100.0)
        perc_comissao = Decimal(kit.perc_comissao or 0) / Decimal(100.0)

        fator_margem_inst = Decimal(getattr(kit, 'fator_margem_instalacao', 1) or 1)
        fator_margem_manut = Decimal(getattr(kit, 'fator_margem_manutencao', 1) or 1)

        cost_summaries = []
        
        # We need aliq_servicos for costs, which we compute here:
        aliq_base = sum([
            Decimal(kit.aliq_pis or 0),
            Decimal(kit.aliq_cofins or 0),
            Decimal(kit.aliq_csll or 0),
            Decimal(kit.aliq_irpj or 0)
        ]) / Decimal(100.0)
        aliq_servicos = aliq_base + (Decimal(kit.aliq_iss or 0) / Decimal(100.0))
        aliq_produtos = aliq_base + (Decimal(kit.aliq_icms or 0) / Decimal(100.0))
        
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
                    field_name = EXEC_MAP.get(kit.forma_execucao)
                    if field_name:
                        from src.modules.own_services.models import OwnServiceItem
                        from src.modules.man_hours.models import ManHour
                        
                        current_year = datetime.utcnow().year
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
                                    minutes = Decimal(os_item.tempo_minutos or 0)
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
                
                if kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
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
                    Decimal(kit.aliq_pis or 0),
                    Decimal(kit.aliq_cofins or 0),
                    Decimal(kit.aliq_csll or 0),
                    Decimal(kit.aliq_irpj or 0)
                ]) / Decimal(100.0)

                cost_summaries.append({
                    "id": str(cost.id) if cost.id else None,
                    "product_id": str(cost.product_id) if cost.product_id else None,
                    "own_service_id": str(cost.own_service_id) if cost.own_service_id else None,
                    "tipo_custo": cost_tipo_custo,
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
                    "perc_pis": float(kit.aliq_pis or 0),
                    "perc_cofins": float(kit.aliq_cofins or 0),
                    "perc_csll": float(kit.aliq_csll or 0),
                    "perc_irpj": float(kit.aliq_irpj or 0),
                    "perc_iss": float(kit.aliq_iss or 0),
                    "pis_unit": round(venda_total_item * (Decimal(kit.aliq_pis or 0) / Decimal(100)), 2),  # type: ignore
                    "cofins_unit": round(venda_total_item * (Decimal(kit.aliq_cofins or 0) / Decimal(100)), 2),  # type: ignore
                    "csll_unit": round(venda_total_item * (Decimal(kit.aliq_csll or 0) / Decimal(100)), 2),  # type: ignore
                    "irpj_unit": round(venda_total_item * (Decimal(kit.aliq_irpj or 0) / Decimal(100)), 2),  # type: ignore
                    "iss_unit": round(venda_total_item * (Decimal(kit.aliq_iss or 0) / Decimal(100)), 2),  # type: ignore
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
        
        fator_margem = Decimal(kit.fator_margem_locacao or 1)

        iss_val = Decimal(kit.aliq_iss or 0) if kit.tipo_contrato in ["COMODATO", "INSTALACAO"] else Decimal("0.0")
        icms_val = Decimal(kit.aliq_icms or 0) if kit.tipo_contrato == "VENDA_EQUIPAMENTOS" else Decimal("0.0")
        aliq_total_impostos = sum([
            Decimal(kit.aliq_pis or 0),
            Decimal(kit.aliq_cofins or 0),
            Decimal(kit.aliq_csll or 0),
            Decimal(kit.aliq_irpj or 0),
            iss_val,
            icms_val
        ]) / Decimal(100.0)
        
        item_summaries = []
        total_imposto_itens_venda = Decimal("0.0")
        
        for item in kit.items:
            tipo_item_entity = getattr(item, "tipo_item", "PRODUTO")
            
            custo_base_unitario_item = Decimal("0.0")
            tipo_produto = "MERCADORIA"
            difal_unitario = Decimal("0.0")
            icms_st = Decimal("0.0")
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
                    field_name = EXEC_MAP.get(kit.forma_execucao)
                    if field_name:
                        from src.modules.own_services.models import OwnServiceItem
                        from src.modules.man_hours.models import ManHour
                        
                        current_year = datetime.utcnow().year
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
                                    minutes = Decimal(os_item.tempo_minutos or 0)
                                    dyn_total += (role_rate / Decimal(60.0)) * minutes
                                
                                if dyn_total > 0:
                                    custo_base_unitario_item = dyn_total
            else:
                info = self.get_product_info(str(item.product_id), tenant_id, kit.tipo_contrato)
                custo_base_unitario_item = info["cost"]
                tipo_produto = info["tipo"]
                difal_unitario = info["difal"]
                icms_st = info.get("icms_st", Decimal("0.0"))
            
            custo_total_item_no_kit = custo_base_unitario_item * Decimal(item.quantidade_no_kit or 1)
            difal_total_item = difal_unitario * Decimal(item.quantidade_no_kit or 1)
            icms_st_total = icms_st * Decimal(item.quantidade_no_kit or 1)
            
            custo_aquisicao_kit += custo_total_item_no_kit
            total_difal_kit += difal_total_item
            
            if tipo_produto in ["SERVICO", "LICENCA"]:
                custo_aquisicao_servicos += custo_total_item_no_kit
            else:
                custo_aquisicao_produtos += custo_total_item_no_kit
                
            venda_unitario_item = Decimal("0.0")
            venda_total_item = Decimal("0.0")
            imposto_venda_item = Decimal("0.0")
            
            if kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
                fator_item = fator_margem
                aliq_pis_val = Decimal(kit.aliq_pis or 0) / Decimal(100.0)
                aliq_cofins_val = Decimal(kit.aliq_cofins or 0) / Decimal(100.0)
                aliq_csll_val = Decimal(kit.aliq_csll or 0) / Decimal(100.0)
                aliq_irpj_val = Decimal(kit.aliq_irpj or 0) / Decimal(100.0)
                aliq_iss_val = Decimal(kit.aliq_iss or 0) / Decimal(100.0)
                aliq_icms_val = Decimal(kit.aliq_icms or 0) / Decimal(100.0)
                
                perc_icms_aplicado = aliq_icms_val
                
                if tipo_produto in ["SERVICO", "LICENCA"]:
                    fator_item = Decimal(getattr(kit, 'fator_margem_servicos_produtos', 1) or 1)
                    imposto_tax = aliq_pis_val + aliq_cofins_val + aliq_csll_val + aliq_irpj_val + aliq_iss_val
                else:
                    if info.get("tem_st"):
                        perc_icms_aplicado = Decimal("0.0")
                    imposto_tax = aliq_pis_val + aliq_cofins_val + aliq_csll_val + aliq_irpj_val + perc_icms_aplicado
                
                venda_unitario_item = custo_base_unitario_item * fator_item
                venda_total_item = custo_total_item_no_kit * fator_item
                imposto_venda_item = venda_total_item * imposto_tax
                total_imposto_itens_venda += imposto_venda_item
            
            # Additional detailed kit item metrics
            frete_venda_item = venda_total_item * perc_frete_venda
            desp_adm_item = venda_total_item * perc_despesas_adm
            comissao_item = venda_total_item * perc_comissao
            
            lucro_total_item = venda_total_item - custo_total_item_no_kit - imposto_venda_item - frete_venda_item - desp_adm_item - comissao_item
            lucro_unitario_item = (lucro_total_item / Decimal(item.quantidade_no_kit or 1)) if Decimal(item.quantidade_no_kit or 1) > 0 else Decimal("0.0")
            margem_item = (lucro_total_item / venda_total_item * Decimal(100.0)) if venda_total_item > 0 else Decimal("0.0")

            item_summaries.append({
                "id": str(item.id) if item.id else None,
                "tipo_item_entity": getattr(item, "tipo_item", "PRODUTO"),
                "product_id": str(item.product_id) if item.product_id else None,
                "own_service_id": str(getattr(item, "own_service_id", None)) if getattr(item, "own_service_id", None) else None,
                "tipo_item": tipo_produto,
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
                "perc_pis": float(kit.aliq_pis or 0),
                "perc_cofins": float(kit.aliq_cofins or 0),
                "perc_csll": float(kit.aliq_csll or 0),
                "perc_irpj": float(kit.aliq_irpj or 0),
                "perc_icms": float(kit.aliq_icms or 0),
                "perc_iss": float(kit.aliq_iss or 0),
                "pis_unit": round(venda_total_item * (Decimal(kit.aliq_pis or 0) / Decimal(100)), 2),  # type: ignore
                "cofins_unit": round(venda_total_item * (Decimal(kit.aliq_cofins or 0) / Decimal(100)), 2),  # type: ignore
                "csll_unit": round(venda_total_item * (Decimal(kit.aliq_csll or 0) / Decimal(100)), 2),  # type: ignore
                "irpj_unit": round(venda_total_item * (Decimal(kit.aliq_irpj or 0) / Decimal(100)), 2),  # type: ignore
                "icms_unit": round(venda_total_item * locals().get("perc_icms_aplicado", Decimal(0)), 2) if tipo_produto not in ["SERVICO", "LICENCA"] else 0,  # type: ignore
                "iss_unit": round(venda_total_item * (Decimal(kit.aliq_iss or 0) / Decimal(100)), 2) if tipo_produto in ["SERVICO", "LICENCA"] else 0,  # type: ignore
            })

        custo_aquisicao_total = custo_aquisicao_kit * Decimal(kit.quantidade_kits or 1)

        # 10. Depreciacao (Removido da formacao de custos)
        
        # 11. Custo Total Mensal (Will be added with maintenance later)

        # 12. Calculo da Taxa de Locação
        tx_locacao = Decimal("0.0")
        juros = Decimal(kit.taxa_juros_mensal or 0) / Decimal(100.0)
        
        if kit.tipo_contrato == "INSTALACAO":
            tx_locacao = Decimal("1.0")
        elif kit.prazo_contrato_meses > 0 and juros > 0:
            # txLocacao = taxa / (1 - (1 + taxa)^(-prazo_contrato))
            base = Decimal(1.0) + juros
            tx_locacao = juros / (Decimal(1.0) - (base ** -kit.prazo_contrato_meses))
        elif kit.prazo_contrato_meses > 0 and juros == 0:
            tx_locacao = Decimal(1.0) / Decimal(kit.prazo_contrato_meses)

        # 13. Formação do Valor
        fator_margem_inst = Decimal(getattr(kit, 'fator_margem_instalacao', 1) or 1)
        fator_margem_manut = Decimal(getattr(kit, 'fator_margem_manutencao', 1) or 1)
        
        # We always compute the base for the installation percentage, used for maintenance
        perc_inst = Decimal(kit.percentual_instalacao or 0) / Decimal(100.0)
        vlr_instal_calc_base_manut = custo_aquisicao_kit * perc_inst
        
        vlr_instal_calc = Decimal("0.0")
        
        if kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
            # For Sales: Flat value application based on independent markup factors
            fator_margem_serv_prod = Decimal(getattr(kit, 'fator_margem_servicos_produtos', 1) or 1)
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

            # Manutenção
            vlt_manut = Decimal("0.0")
            
            if kit.manutencao_inclusa:
                tx_manut = (Decimal(kit.taxa_manutencao_anual or 0) / Decimal(12.0)) / Decimal(100.0)
                vlt_manut = (custo_aquisicao_kit + vlr_instal_calc_base_manut) * tx_manut
            else:
                fator_manut = Decimal(kit.fator_manutencao if kit.fator_manutencao is not None else 1)
                vlt_manut = custo_operacional_mensal_kit * fator_manut
                    
            valor_parcela_locacao = valor_mensal_locacao_base
            manutencao_mensal = vlt_manut

            if kit.tipo_contrato == "INSTALACAO":
                valor_base_final = valor_parcela_locacao + custo_operacional_mensal_kit
            else:
                valor_base_final = valor_parcela_locacao + manutencao_mensal

            # custo_operacional_mensal_kit = raw Block 6 cost (DO NOT MUTATE)
            # custo_total_mensal_kit = all operational costs for profitability calc
            custo_total_mensal_kit = custo_operacional_mensal_kit + Decimal(str(vlt_manut))

        # 14. Calculo de Impostos
        # aliq_total_impostos was calculated at the top

        
        if aliq_total_impostos >= Decimal(1.0):
            aliq_total_impostos = Decimal("0.99") # Safety fallback
            
        if kit.tipo_contrato == "INSTALACAO":
            # For INSTALACAO typically taxes are inside the final value
            valor_mensal_kit = valor_base_final
            valor_impostos = valor_mensal_kit * aliq_total_impostos
            valor_mensal_antes_impostos = valor_base_final
        elif kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
            # For Sales exactly like Orçamento de Venda: impostos are calculated ON the final price.
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
            valor_mensal_antes_impostos = valor_base_final
        else:
            # Locação / Comodato
            valor_mensal_antes_impostos = valor_base_final
            valor_mensal_kit = valor_base_final
            
            faturamento_separado = getattr(kit, 'faturamento_servico_separado', False)
            if faturamento_separado:
                aliq_base = sum([
                    Decimal(kit.aliq_pis or 0),
                    Decimal(kit.aliq_cofins or 0),
                    Decimal(kit.aliq_csll or 0),
                    Decimal(kit.aliq_irpj or 0)
                ]) / Decimal(100.0)
                
                aliq_iss_pct = Decimal(kit.aliq_iss or 0) / Decimal(100.0)
                
                # Grupo 1: Produtos/Equipamentos (Locação Base) sem ISS
                impostos_grupo_1 = valor_mensal_locacao_base * aliq_base
                # Grupo 2: Serviços (Manutenção) com ISS
                impostos_grupo_2 = manutencao_mensal * (aliq_base + aliq_iss_pct)
                
                valor_impostos = impostos_grupo_1 + impostos_grupo_2
                if valor_mensal_kit > 0:
                    aliq_total_impostos = valor_impostos / valor_mensal_kit
            else:
                valor_impostos = valor_mensal_kit * aliq_total_impostos

        # 16. Receita Liquida
        receita_liquida_mensal_kit = valor_mensal_kit - valor_impostos

        # 17. Lucro Mensal
        if kit.tipo_contrato == "INSTALACAO":
            lucro_mensal_kit = receita_liquida_mensal_kit - custo_aquisicao_kit - custo_operacional_mensal_kit - custo_mensal_bloco_7
        elif kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
            lucro_mensal_kit = receita_liquida_mensal_kit - custo_total_mensal_kit - custo_mensal_bloco_7
        else:
            lucro_mensal_kit = receita_liquida_mensal_kit - custo_total_mensal_kit - custo_mensal_bloco_7

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

        if kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
            # Maintenance Metrics
            venda_manutencao_total = valor_venda_manutencao
            custo_manut_total_calc = vlt_manut
            imposto_manut_total = impostos_manutencao
            lucro_manutencao = venda_manutencao_total - custo_manut_total_calc - imposto_manut_total - (venda_manutencao_total * (perc_frete_venda + perc_despesas_adm + perc_comissao))
            if venda_manutencao_total > 0:
                margem_manutencao = (lucro_manutencao / venda_manutencao_total) * Decimal(100.0)
            
            # Equipment Metrics (Products + Installation)
            venda_equipamentos_total = valor_venda_produtos + valor_venda_instalacao
            custo_equipamentos_total = custo_aquisicao_kit + vlr_instal_calc
            imposto_equipamentos_total = impostos_produtos_base + impostos_instalacao
            lucro_equipamentos = venda_equipamentos_total - custo_equipamentos_total - imposto_equipamentos_total - (venda_equipamentos_total * (perc_frete_venda + perc_despesas_adm + perc_comissao))
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

        # ROI = Investimento / (Faturamento - Custo Op. Bloco6 - Custo Bloco7 - Impostos)
        roi_denominador = valor_mensal_antes_impostos - custo_operacional_mensal_kit - custo_mensal_bloco_7 - valor_impostos
        investimento_total = custo_aquisicao_kit + vlr_instal_calc
        roi_meses = float(investimento_total / roi_denominador) if roi_denominador > 0 else 0.0

        return {
            "summary": {
                "prazo_mensalidades": prazo_mensalidades,
                "custo_operacional_mensal_kit": round(custo_operacional_mensal_kit, 2),  # type: ignore
                "custo_aquisicao_kit": round(custo_aquisicao_kit, 2),  # type: ignore
                "custo_aquisicao_produtos": round(custo_aquisicao_produtos, 2),  # type: ignore
                "custo_aquisicao_servicos": round(custo_aquisicao_servicos, 2),  # type: ignore
                "custo_aquisicao_total": round(custo_aquisicao_total, 2),  # type: ignore
                "total_difal_kit": round(total_difal_kit, 2),  # type: ignore
                "custo_total_mensal_kit": round(custo_total_mensal_kit, 2),  # type: ignore
                "tx_locacao": round(tx_locacao, 6),  # type: ignore
                "vlr_instal_calc": round(vlr_instal_calc, 2),  # type: ignore
                "valor_mensal_locacao_base": round(valor_mensal_locacao_base, 2),  # type: ignore
                "vlt_manut": round(vlt_manut, 2),  # type: ignore
                "valor_base_venda": round(valor_base_venda, 2),  # type: ignore
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
                # New granular fields
                "venda_equipamentos_total": round(venda_equipamentos_total, 2), # type: ignore
                "lucro_equipamentos": round(lucro_equipamentos, 2), # type: ignore
                "margem_equipamentos": round(margem_equipamentos, 2), # type: ignore
                "venda_manutencao_total": round(venda_manutencao_total, 2), # type: ignore
                "lucro_manutencao": round(lucro_manutencao, 2), # type: ignore
                "margem_manutencao": round(margem_manutencao, 2) # type: ignore
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
            fin = self.calculate_financials(kit, tenant_id)
            kit.summary = fin["summary"]
            kit.item_summaries = fin["item_summaries"]
        return kits

    def get_kit(self, kit_id: str, tenant_id: str, company_id: Optional[str] = None):
        query = self.db.query(OpportunityKit).filter(
            OpportunityKit.id == kit_id,
            OpportunityKit.tenant_id == tenant_id
        )
        if company_id:
            query = query.filter(OpportunityKit.company_id == company_id)
        kit = query.first()
        if kit:
            fin = self.calculate_financials(kit, tenant_id)
            kit.summary = fin["summary"]
            kit.item_summaries = fin["item_summaries"]
        return kit

    def create_kit(self, tenant_id: str, company_id: str, data: OpportunityKitCreate) -> OpportunityKit:
        if data.prazo_instalacao_meses > data.prazo_contrato_meses:
            raise ValueError("Prazo de instalação não pode ser maior que o prazo do contrato.")
            
        kit = OpportunityKit(
            tenant_id=tenant_id,
            company_id=company_id,
            sales_budget_id=data.sales_budget_id,
            nome_kit=data.nome_kit,
            descricao_kit=data.descricao_kit,
            quantidade_kits=data.quantidade_kits,
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
            perc_frete_venda=data.perc_frete_venda,
            perc_despesas_adm=data.perc_despesas_adm,
            perc_comissao=data.perc_comissao,
            aliq_pis=data.aliq_pis,
            aliq_cofins=data.aliq_cofins,
            aliq_csll=data.aliq_csll,
            aliq_irpj=data.aliq_irpj,
            aliq_iss=data.aliq_iss,
            aliq_icms=data.aliq_icms,
            custo_manut_mensal_kit=data.custo_manut_mensal_kit,
            custo_suporte_mensal_kit=data.custo_suporte_mensal_kit,
            custo_seguro_mensal_kit=data.custo_seguro_mensal_kit,
            custo_logistica_mensal_kit=data.custo_logistica_mensal_kit,
            custo_software_mensal_kit=data.custo_software_mensal_kit,
            custo_itens_acessorios_mensal_kit=data.custo_itens_acessorios_mensal_kit
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
            
        self.db.commit()

        self.db.refresh(kit)
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

        self.db.commit()
        self.db.refresh(kit)
        fin = self.calculate_financials(kit, tenant_id)
        kit.summary = fin["summary"]
        kit.item_summaries = fin["item_summaries"]
        return kit
    
    def recalculate_kit_preview(self, tenant_id: str, company_id: str, data: OpportunityKitCreate) -> dict:
        """Endpoint used to preview financials without saving to DB"""
        # Create a mock objects
        kit = OpportunityKit(**data.model_dump(exclude={"items", "costs", "monthly_costs"}))
        kit.company_id = company_id
        kit.items = [OpportunityKitItem(**item_data.model_dump()) for item_data in data.items]
        kit.costs = [OpportunityKitCost(**cost_data.model_dump()) for cost_data in data.costs]
        
        from src.modules.opportunity_kits.models import OpportunityKitMonthlyCost
        kit.monthly_costs = [OpportunityKitMonthlyCost(**mc_data.model_dump()) for mc_data in getattr(data, "monthly_costs", [])]
        
        fin = self.calculate_financials(kit, tenant_id)
        return fin
