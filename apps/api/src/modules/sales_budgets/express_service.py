from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
import uuid

from sqlalchemy.orm import Session
from fastapi import HTTPException

from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.opportunity_kits.service import OpportunityKitService
from src.modules.companies.models import CommercialPolicy, CommercialPolicyRole, SalesTeamPolicy, Company
from src.modules.professionals.models import Professional
from src.modules.users.models import User
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem, RentalBudgetItem, SalesBudgetHistory
from src.modules.sales_budgets.schemas import (
    ExpressKitPricingRequest, ExpressKitPricingResponse,
    ExpressSaleSaveRequest, ExpressSaleItemInput, SalesBudgetOut,
    ExpressAuthorizeManagerRequest, ExpressFinalizeRequest
)
from src.modules.sales_budgets.service import get_next_numero


def _d(val) -> Decimal:
    if val is None:
        return Decimal("0.00")
    return Decimal(str(val))


def _round2(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _round4(val: Decimal) -> Decimal:
    return val.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)


def get_applicable_commercial_policies(
    db: Session,
    company_id: str,
    sales_team_id: Optional[UUID] = None,
    user_id: Optional[str] = None,
    tenant_id: Optional[str] = None
) -> List[CommercialPolicy]:
    """
    Fetches active commercial policies applicable to the given team and user role,
    ordered by fator_limite DESC (highest factor first).
    """
    base_query = db.query(CommercialPolicy).filter(
        CommercialPolicy.company_id == company_id,
        CommercialPolicy.ativo == True
    )

    team_policy_ids = None
    if sales_team_id:
        rows = db.query(SalesTeamPolicy.commercial_policy_id).filter(
            SalesTeamPolicy.sales_team_id == sales_team_id
        ).all()
        team_policy_ids = [r[0] for r in rows]

    if team_policy_ids:
        base_query = base_query.filter(CommercialPolicy.id.in_(team_policy_ids))

    if user_id and tenant_id:
        professional = db.query(Professional).filter(
            Professional.user_id == user_id,
            Professional.tenant_id == tenant_id
        ).first()
        if professional and professional.role_id:
            role_policies = base_query.join(
                CommercialPolicyRole,
                CommercialPolicyRole.policy_id == CommercialPolicy.id
            ).filter(
                CommercialPolicyRole.role_id == professional.role_id
            ).order_by(CommercialPolicy.fator_limite.desc()).all()
            if role_policies:
                return role_policies

    return base_query.order_by(CommercialPolicy.fator_limite.desc()).all()


def calculate_express_pricing(
    db: Session,
    tenant_id: str,
    company_id: str,
    req: ExpressKitPricingRequest,
    current_user: Optional[User] = None
) -> ExpressKitPricingResponse:
    """
    Calculates reverse-engineered pricing for a kit in Express Sales:
    - Resolves kit base price (dynamic vs fixed).
    - Applies mutual exclusivity between Desconto % and Acréscimo %.
    - Computes reverse factor F = ValorFinal / Custo.
    - Matches active Commercial Policy brackets for commission % and approval limits.
    """
    kit_svc = OpportunityKitService(db)
    kit = kit_svc.get_kit(str(req.opportunity_kit_id), tenant_id, company_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit de oportunidade não encontrado.")

    # Calculate standard financials
    fin = kit_svc.calculate_financials(kit, tenant_id)
    summary = fin.get("summary", {})

    is_venda = kit.tipo_contrato == "VENDA_EQUIPAMENTOS"
    
    # 1. Determine Unit Base Cost
    custo_unitario = _d(summary.get("custo_unitario") or summary.get("custo_aquisicao_total") or summary.get("custo_total") or 0.0)
    if custo_unitario <= 0 and summary.get("custo_aquisicao_produtos"):
        custo_unitario = _d(summary.get("custo_aquisicao_produtos"))

    # 2. Determine Unit Base Selling Price (List Price)
    tipo_precificacao = getattr(kit, "tipo_precificacao", "DINAMICO_CUSTO") or "DINAMICO_CUSTO"
    
    if tipo_precificacao == "PRECO_FIXO":
        if is_venda and kit.valor_venda_fixo is not None and kit.valor_venda_fixo > 0:
            valor_unitario_base = _d(kit.valor_venda_fixo)
        elif not is_venda and kit.valor_locacao_mensal_fixo is not None and kit.valor_locacao_mensal_fixo > 0:
            valor_unitario_base = _d(kit.valor_locacao_mensal_fixo)
        else:
            valor_unitario_base = _d(summary.get("venda_unitario") or summary.get("valor_mensal_kit") or 0.0)
    else:
        valor_unitario_base = _d(summary.get("venda_unitario") or summary.get("valor_mensal_kit") or 0.0)

    if valor_unitario_base <= 0:
        valor_unitario_base = custo_unitario * _d(kit.fator_margem_locacao or 1.5)

    # 3. Handle Bidirectional inputs and Mutual Exclusivity
    desconto_pct = _d(req.desconto_percentual)
    acrescimo_pct = _d(req.acrescimo_percentual)
    valor_final_input = _d(req.valor_final) if req.valor_final is not None else None

    # Mutual Exclusivity resolution:
    if desconto_pct > 0:
        acrescimo_pct = Decimal("0.0")
        valor_unitario_final = _round2(valor_unitario_base * (Decimal("1.0") - (desconto_pct / Decimal("100.0"))))
    elif acrescimo_pct > 0:
        desconto_pct = Decimal("0.0")
        valor_unitario_final = _round2(valor_unitario_base * (Decimal("1.0") + (acrescimo_pct / Decimal("100.0"))))
    elif valor_final_input is not None and valor_final_input > 0:
        valor_unitario_final = _round2(valor_final_input)
        if valor_unitario_base > 0:
            if valor_unitario_final < valor_unitario_base:
                desconto_pct = _round2(((valor_unitario_base - valor_unitario_final) / valor_unitario_base) * Decimal("100.0"))
                acrescimo_pct = Decimal("0.0")
            elif valor_unitario_final > valor_unitario_base:
                acrescimo_pct = _round2(((valor_unitario_final - valor_unitario_base) / valor_unitario_base) * Decimal("100.0"))
                desconto_pct = Decimal("0.0")
            else:
                desconto_pct = Decimal("0.0")
                acrescimo_pct = Decimal("0.0")
    else:
        valor_unitario_final = _round2(valor_unitario_base)
        desconto_pct = Decimal("0.0")
        acrescimo_pct = Decimal("0.0")

    # 4. Reverse Factor Calculation
    if is_venda:
        if custo_unitario > 0:
            fator_efetivo = _round4(valor_unitario_final / custo_unitario)
        else:
            fator_efetivo = _d(kit.fator_margem_locacao or 1.0)
    else:
        # Locação / Comodato / Instalação: o valor unitário final é a mensalidade recorrente.
        # Coletamos os fatores ativos do kit (produtos, serviços, instalação, manutenção)
        factors = []
        custo_prod = _d(summary.get("custo_aquisicao_produtos") or 0)
        custo_serv = _d(summary.get("custo_aquisicao_servicos") or 0)
        if custo_prod > 0 or (custo_prod == 0 and custo_serv == 0):
            factors.append(_d(kit.fator_margem_locacao or 1.0))
        if custo_serv > 0:
            factors.append(_d(kit.fator_margem_servicos_produtos or 1.0))
        if not kit.instalacao_inclusa and _d(summary.get("valor_venda_instalacao") or 0) > 0:
            factors.append(_d(kit.fator_margem_instalacao or 1.0))
        if not kit.manutencao_inclusa and _d(summary.get("vlt_manut") or 0) > 0 and kit.fator_manutencao is not None:
            factors.append(_d(kit.fator_manutencao))

        fator_base = (sum(factors) / Decimal(len(factors))) if factors else _d(kit.fator_margem_locacao or 1.0)

        if valor_unitario_base > 0:
            fator_efetivo = _round4(fator_base * (valor_unitario_final / valor_unitario_base))
        else:
            fator_efetivo = _round4(fator_base)

    # 5. Dynamic Commercial Policy Bracket Resolution
    user_id = current_user.id if current_user else None
    policies = get_applicable_commercial_policies(
        db, company_id, req.sales_team_id, user_id=user_id, tenant_id=tenant_id
    )

    matched_policy = None
    min_policy_factor = None
    
    if policies:
        min_policy_factor = min(_d(p.fator_limite) for p in policies)
        # policies are sorted by fator_limite desc
        for p in policies:
            if fator_efetivo >= _d(p.fator_limite):
                matched_policy = p
                break
        if not matched_policy:
            # Below the lowest policy bracket
            matched_policy = policies[-1]

    comissao_percentual = Decimal("0.0")
    commercial_policy_id = None
    nome_politica = None
    fator_limite_politica = None

    if matched_policy:
        commercial_policy_id = matched_policy.id
        nome_politica = matched_policy.nome_politica
        fator_limite_politica = _d(matched_policy.fator_limite)
        comissao_percentual = _d(matched_policy.comissao_percentual)
    else:
        comissao_percentual = _d(kit.perc_comissao or 0.0)

    # Re-calculate standard financials with the resolved commercial policy for exact service commission evaluation
    if matched_policy and not is_venda:
        fin = kit_svc.calculate_financials(kit, tenant_id, override_policy_id=str(matched_policy.id))
        summary = fin.get("summary", {})

    # Approval check
    requer_aprovacao = False
    motivo_aprovacao = None

    if min_policy_factor is not None and fator_efetivo < min_policy_factor:
        requer_aprovacao = True
        termo_fator = "Fator de venda" if is_venda else "Fator"
        motivo_aprovacao = f"{termo_fator} ({fator_efetivo:.4f}) está abaixo do limite mínimo da política comercial ({min_policy_factor:.4f}). Requer aprovação de gerência."

    tipo_comissionamento = getattr(matched_policy, "tipo_comissionamento", "TRADICIONAL") if matched_policy else "TRADICIONAL"
    dsr_pct = _d(getattr(matched_policy, "dsr_percentual", 0) or 0) if matched_policy else Decimal("0.0")
    fgts_pct = _d(getattr(matched_policy, "fgts_percentual", 0) or 0) if matched_policy else Decimal("0.0")
    inss_pct = _d(getattr(matched_policy, "inss_percentual", 0) or 0) if matched_policy else Decimal("0.0")
    demais_pct = _d(getattr(matched_policy, "demais_incidencias_percentual", 0) or 0) if matched_policy else Decimal("0.0")
    despesa_operacional_percentual = _d(getattr(matched_policy, "despesa_operacional_percentual", 0) or 0) if matched_policy else _d(getattr(kit, "perc_despesa_operacional", 0) or 0)

    # 6. Quantities and Totals
    qtd = req.quantidade if req.quantidade >= 1 else 1
    valor_total_final = _round2(valor_unitario_final * Decimal(qtd))

    valor_dsr = Decimal("0.0")
    valor_fgts = Decimal("0.0")
    valor_inss = Decimal("0.0")
    valor_demais = Decimal("0.0")

    if is_venda:
        valor_comissao_bruta = _round2(valor_total_final * (comissao_percentual / Decimal("100.0")))
        comissao_bruta_percentual = comissao_percentual
        if tipo_comissionamento in ["POR_DENTRO", "COMISSAO_POR_DENTRO"]:
            fator_total = (Decimal("1.0") + dsr_pct / Decimal("100.0")) * (Decimal("1.0") + (fgts_pct + inss_pct + demais_pct) / Decimal("100.0"))
            comissao_real = _round4(valor_comissao_bruta / fator_total) if fator_total > 0 else valor_comissao_bruta
            valor_dsr = _round2(comissao_real * (dsr_pct / Decimal("100.0")))
            valor_fgts = _round2((comissao_real + valor_dsr) * (fgts_pct / Decimal("100.0")))
            valor_inss = _round2((comissao_real + valor_dsr) * (inss_pct / Decimal("100.0")))
            valor_demais = _round2((comissao_real + valor_dsr) * (demais_pct / Decimal("100.0")))
            soma = comissao_real + valor_dsr + valor_fgts + valor_inss + valor_demais
            diff = valor_comissao_bruta - soma
            valor_comissao_liquida = _round2(comissao_real + diff)
            comissao_liquida_percentual = _round2((valor_comissao_liquida / valor_total_final) * Decimal("100.0")) if valor_total_final > 0 else Decimal("0.0")
        else:
            comissao_liquida_percentual = comissao_bruta_percentual
            valor_comissao_liquida = valor_comissao_bruta
        valor_despesa_operacional = _round2(valor_total_final * (despesa_operacional_percentual / Decimal("100.0")))
    else:
        # Locação / Comodato: com_destinado_loc calculates equipment commission + service commissions (number of monthly installments)
        base_destinado = _d(summary.get("com_destinado_loc") or summary.get("valor_comissao_locacao") or 0.0)
        if base_destinado <= 0 and comissao_percentual > 0:
            base_destinado = _round2(valor_unitario_base * (comissao_percentual / Decimal("100.0")))
        
        ratio = (valor_unitario_final / valor_unitario_base) if valor_unitario_base > 0 else Decimal("1.0")
        valor_comissao_bruta_un = _round2(base_destinado * ratio)
        valor_comissao_bruta = _round2(valor_comissao_bruta_un * Decimal(qtd))
        comissao_bruta_percentual = _round2((valor_comissao_bruta / valor_total_final) * Decimal("100.0")) if valor_total_final > 0 else Decimal("0.0")

        base_liq = _d(summary.get("valor_comissao_locacao") or 0.0)
        base_dsr = _d(summary.get("vlt_comissao_dsr_loc") or 0.0)
        base_fgts = _d(summary.get("vlt_comissao_fgts_loc") or 0.0)
        base_inss = _d(summary.get("vlt_comissao_inss_loc") or 0.0)
        base_demais = _d(summary.get("vlt_comissao_demais_loc") or 0.0)

        if tipo_comissionamento in ["POR_DENTRO", "COMISSAO_POR_DENTRO"]:
            if base_liq > 0 or base_dsr > 0 or base_fgts > 0:
                valor_comissao_liquida = _round2(base_liq * ratio * Decimal(qtd))
                valor_dsr = _round2(base_dsr * ratio * Decimal(qtd))
                valor_fgts = _round2(base_fgts * ratio * Decimal(qtd))
                valor_inss = _round2(base_inss * ratio * Decimal(qtd))
                valor_demais = _round2(base_demais * ratio * Decimal(qtd))
            else:
                fator_total = (Decimal("1.0") + dsr_pct / Decimal("100.0")) * (Decimal("1.0") + (fgts_pct + inss_pct + demais_pct) / Decimal("100.0"))
                comissao_real = _round4(valor_comissao_bruta / fator_total) if fator_total > 0 else valor_comissao_bruta
                valor_dsr = _round2(comissao_real * (dsr_pct / Decimal("100.0")))
                valor_fgts = _round2((comissao_real + valor_dsr) * (fgts_pct / Decimal("100.0")))
                valor_inss = _round2((comissao_real + valor_dsr) * (inss_pct / Decimal("100.0")))
                valor_demais = _round2((comissao_real + valor_dsr) * (demais_pct / Decimal("100.0")))
                soma = comissao_real + valor_dsr + valor_fgts + valor_inss + valor_demais
                diff = valor_comissao_bruta - soma
                valor_comissao_liquida = _round2(comissao_real + diff)
            comissao_liquida_percentual = _round2((valor_comissao_liquida / valor_total_final) * Decimal("100.0")) if valor_total_final > 0 else Decimal("0.0")
        else:
            comissao_liquida_percentual = comissao_bruta_percentual
            valor_comissao_liquida = valor_comissao_bruta

        base_desp_op = _d(summary.get("valor_despesa_operacional_loc") or 0.0)
        valor_despesa_operacional = _round2(base_desp_op * ratio * Decimal(qtd))

    despesa_operacional_percentual = _round2((valor_despesa_operacional / valor_total_final) * Decimal("100.0")) if valor_total_final > 0 else Decimal("0.0")
    valor_despesas_venda = _round2(valor_comissao_liquida + valor_despesa_operacional)
    despesas_venda_percentual = _round2((valor_despesas_venda / valor_total_final) * Decimal("100.0")) if valor_total_final > 0 else Decimal("0.0")

    if is_venda:
        lucro_unitario = valor_unitario_final - custo_unitario - (valor_unitario_final * (despesas_venda_percentual / Decimal("100.0")))
    else:
        base_lucro = _d(summary.get("lucro_mensal_kit") or 0.0)
        delta_revenue = valor_unitario_final - valor_unitario_base
        lucro_unitario = base_lucro + delta_revenue - (delta_revenue * (despesas_venda_percentual / Decimal("100.0")))

    lucro_unitario_estimado = _round2(lucro_unitario)
    margem_estimada = _round2((lucro_unitario / valor_unitario_final) * Decimal("100.0")) if valor_unitario_final > 0 else Decimal("0.0")
    valor_comissao_estimada = valor_comissao_bruta

    return ExpressKitPricingResponse(
        opportunity_kit_id=kit.id,
        nome_kit=kit.nome_kit,
        tipo_contrato=kit.tipo_contrato,
        tipo_precificacao=tipo_precificacao,
        custo_unitario=_round2(custo_unitario),
        valor_unitario_base=_round2(valor_unitario_base),
        desconto_percentual=_round2(desconto_pct),
        acrescimo_percentual=_round2(acrescimo_pct),
        valor_unitario_final=valor_unitario_final,
        quantidade=qtd,
        valor_total_final=valor_total_final,
        fator_efetivo=fator_efetivo,
        comissao_percentual=_round2(comissao_percentual),
        valor_comissao_estimada=valor_comissao_estimada,
        valor_comissao_bruta=valor_comissao_bruta,
        comissao_bruta_percentual=_round2(comissao_bruta_percentual),
        valor_dsr=valor_dsr,
        valor_fgts=valor_fgts,
        valor_inss=valor_inss,
        valor_demais=valor_demais,
        comissao_liquida_percentual=_round2(comissao_liquida_percentual),
        valor_comissao_liquida=valor_comissao_liquida,
        despesa_operacional_percentual=_round2(despesa_operacional_percentual),
        valor_despesa_operacional=valor_despesa_operacional,
        valor_despesas_venda=valor_despesas_venda,
        despesas_venda_percentual=despesas_venda_percentual,
        lucro_unitario_estimado=lucro_unitario_estimado,
        margem_estimada=margem_estimada,
        commercial_policy_id=commercial_policy_id,
        nome_politica=nome_politica,
        fator_limite_politica=fator_limite_politica,
        requer_aprovacao=requer_aprovacao,
        motivo_aprovacao=motivo_aprovacao
    )


def build_sales_budget_diff(
    old_state: Optional[Dict[str, Any]],
    new_state: Dict[str, Any],
    user: Optional[User] = None,
    action: str = "SALVAR_VENDA_EXPRESS"
) -> Dict[str, Any]:
    """
    Builds a granular JSON diff structure tracking every change per kit and header.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    user_id = user.id if user else "sistema"
    user_name = user.name if user else "Sistema"

    mudancas_cabecalho = {}
    if old_state:
        for field in ["valor_total", "forma_pagamento_id", "status", "sales_team_id", "titulo"]:
            old_val = old_state.get(field)
            new_val = new_state.get(field)
            if str(old_val) != str(new_val):
                mudancas_cabecalho[field] = {
                    "de": old_val,
                    "para": new_val
                }

    mudancas_kits = []
    old_items_map = {str(item.get("opportunity_kit_id")): item for item in (old_state.get("items", []) if old_state else [])}
    
    for new_item in new_state.get("items", []):
        kit_id = str(new_item.get("opportunity_kit_id"))
        old_item = old_items_map.get(kit_id)
        
        diff_item = {
            "kit_id": kit_id,
            "nome_kit": new_item.get("nome_kit"),
            "tipo_precificacao": new_item.get("tipo_precificacao"),
            "quantidade": new_item.get("quantidade"),
            "valor_unitario": {
                "de": old_item.get("valor_unitario") if old_item else None,
                "para": new_item.get("valor_unitario")
            },
            "fator": {
                "de": old_item.get("fator") if old_item else None,
                "para": new_item.get("fator")
            },
            "desconto_percentual": new_item.get("desconto_percentual"),
            "acrescimo_percentual": new_item.get("acrescimo_percentual"),
            "comissao_percentual": {
                "de": old_item.get("comissao_percentual") if old_item else None,
                "para": new_item.get("comissao_percentual")
            },
            "nome_politica": new_item.get("nome_politica"),
            "valor_total": new_item.get("valor_total")
        }
        mudancas_kits.append(diff_item)

    return {
        "timestamp": now_iso,
        "usuario_id": user_id,
        "usuario_nome": user_name,
        "acao": action,
        "mudancas_cabecalho": mudancas_cabecalho,
        "mudancas_kits": mudancas_kits
    }


def _resolve_vendedor_id(
    db: Session,
    raw_vendedor_id: Optional[Any],
    user_id: str,
    company_id: str,
    tenant_id: str
) -> Optional[str]:
    # 1. If raw_vendedor_id provided, check if it's already a valid Professional ID
    if raw_vendedor_id:
        prof = db.query(Professional.id).filter(
            Professional.id == str(raw_vendedor_id),
            Professional.tenant_id == tenant_id
        ).first()
        if prof:
            return str(prof[0])

        # Or check if raw_vendedor_id matches a user_id of a Professional in this tenant
        prof = db.query(Professional.id).filter(
            Professional.user_id == str(raw_vendedor_id),
            Professional.tenant_id == tenant_id
        ).first()
        if prof:
            return str(prof[0])

    # 2. Try current user's professional record in this tenant
    if user_id:
        prof = db.query(Professional.id).filter(
            Professional.user_id == str(user_id),
            Professional.tenant_id == tenant_id
        ).first()
        if prof:
            return str(prof[0])

    return None


def save_express_sale(
    db: Session,
    tenant_id: str,
    company_id: str,
    req: ExpressSaleSaveRequest,
    current_user: User
) -> SalesBudget:
    """
    Creates or updates a SalesBudget in Express Sales mode with automated kit pricing,
    team proposal sequence numbering, and granular diff audit history.
    """
    if not req.items:
        raise HTTPException(status_code=400, detail="A venda express requer ao menos um kit.")

    is_update = req.budget_id is not None
    budget = None
    old_state = None

    vendedor_id = _resolve_vendedor_id(
        db=db,
        raw_vendedor_id=req.vendedor_id,
        user_id=str(current_user.id) if current_user else "",
        company_id=company_id,
        tenant_id=tenant_id
    )

    if is_update:
        budget = db.query(SalesBudget).filter(
            SalesBudget.id == req.budget_id,
            SalesBudget.tenant_id == tenant_id,
            SalesBudget.company_id == company_id
        ).first()
        if not budget:
            raise HTTPException(status_code=404, detail="Oportunidade/Orçamento não encontrado.")

        if budget.status in ["GANHO", "PERDIDO"]:
            raise HTTPException(
                status_code=400,
                detail=f"Esta venda express já foi finalizada como {budget.status} e não pode ser alterada (somente leitura para emissão de proposta e visualização)."
            )

        old_state = {
            "valor_total": float(budget.valor_total or 0),
            "forma_pagamento_id": str(budget.forma_pagamento_id) if budget.forma_pagamento_id else None,
            "status": budget.status,
            "sales_team_id": str(budget.sales_team_id) if budget.sales_team_id else None,
            "titulo": budget.titulo,
            "items": []
        }
        for item in budget.items:
            old_state["items"].append({
                "opportunity_kit_id": str(item.opportunity_kit_id) if item.opportunity_kit_id else None,
                "valor_unitario": float(item.venda_unit or 0),
                "fator": float(item.markup or 1.0),
                "comissao_percentual": float(item.perc_comissao or 0)
            })
        for ritem in budget.rental_items:
            old_state["items"].append({
                "opportunity_kit_id": str(ritem.opportunity_kit_id) if ritem.opportunity_kit_id else None,
                "valor_unitario": float(ritem.valor_mensal or 0),
                "fator": float(ritem.fator_margem or 1.0),
                "comissao_percentual": float(ritem.perc_comissao or 0)
            })
    else:
        num_orc = get_next_numero(db, tenant_id, company_id, str(req.sales_team_id) if req.sales_team_id else None)
        budget = SalesBudget(
            tenant_id=tenant_id,
            company_id=UUID(company_id),
            customer_id=req.customer_id,
            sales_team_id=req.sales_team_id,
            vendedor_id=vendedor_id,
            forma_pagamento_id=req.forma_pagamento_id,
            numero_orcamento=num_orc,
            titulo=req.titulo or "Venda Express",
            observacoes=req.observacoes,
            data_orcamento=req.data_orcamento or datetime.now(timezone.utc),
            status="EM_LANCAMENTO",
            versao=1,
            valor_total=Decimal("0.00")
        )
        db.add(budget)
        db.flush()

    # Clear old items if updating
    if is_update:
        for it in list(budget.items):
            db.delete(it)
        for rit in list(budget.rental_items):
            db.delete(rit)
        budget.items.clear()
        budget.rental_items.clear()
        db.flush()

    # Calculate and insert new items
    calculated_items_state = []
    total_budget_value = Decimal("0.00")
    primary_policy_id = None

    kit_svc = OpportunityKitService(db)
    kit_id_map = {}
    has_any_requiring_approval = False

    for item_input in req.items:
        pricing_req = ExpressKitPricingRequest(
            opportunity_kit_id=item_input.opportunity_kit_id,
            sales_team_id=req.sales_team_id,
            valor_final=item_input.valor_final,
            desconto_percentual=item_input.desconto_percentual,
            acrescimo_percentual=item_input.acrescimo_percentual,
            quantidade=item_input.quantidade
        )
        pricing = calculate_express_pricing(db, tenant_id, company_id, pricing_req, current_user=current_user)
        if pricing.requer_aprovacao:
            has_any_requiring_approval = True
        
        if not primary_policy_id and pricing.commercial_policy_id:
            primary_policy_id = pricing.commercial_policy_id

        # Check if the kit is already a cloned kit bound to this sales budget
        existing_kit = db.query(OpportunityKit).filter(
            OpportunityKit.id == item_input.opportunity_kit_id,
            OpportunityKit.sales_budget_id == budget.id
        ).first()

        if existing_kit:
            cloned_kit = existing_kit
        else:
            # Clone global kit to associate directly with this sales budget
            cloned_kit = kit_svc.clone_kit(
                source_kit_id=str(item_input.opportunity_kit_id),
                tenant_id=tenant_id,
                company_id=company_id,
                sales_budget_id=str(budget.id)
            )

        kit_id_map[str(item_input.opportunity_kit_id)] = str(cloned_kit.id)

        # Update cloned kit commission and commercial policy without mutating its catalog base pricing factor
        cloned_kit.perc_comissao = pricing.comissao_percentual
        cloned_kit.perc_despesa_operacional = pricing.despesa_operacional_percentual
        cloned_kit.commercial_policy_id = pricing.commercial_policy_id
        db.add(cloned_kit)
        db.flush()

        total_budget_value += pricing.valor_total_final
        qtd_dec = Decimal(pricing.quantidade) if pricing.quantidade >= 1 else Decimal(1)

        if pricing.tipo_contrato == "VENDA_EQUIPAMENTOS":
            db_item = SalesBudgetItem(
                budget_id=budget.id,
                opportunity_kit_id=cloned_kit.id,
                tipo_item="MERCADORIA",
                descricao_servico=cloned_kit.nome_kit,
                custo_unit_base=pricing.custo_unitario,
                markup=pricing.fator_efetivo,
                venda_unit=pricing.valor_unitario_final,
                perc_comissao=pricing.comissao_percentual,
                comissao_unit=_round2(pricing.valor_comissao_liquida / qtd_dec),
                dsr_unit=_round2(pricing.valor_dsr / qtd_dec),
                fgts_unit=_round2(pricing.valor_fgts / qtd_dec),
                inss_unit=_round2(pricing.valor_inss / qtd_dec),
                demais_incidencias_unit=_round2(pricing.valor_demais / qtd_dec),
                despesa_operacional_unit=_round2(pricing.valor_despesa_operacional / qtd_dec),
                lucro_unit=pricing.lucro_unitario_estimado,
                margem_unit=pricing.margem_estimada,
                quantidade=qtd_dec,
                total_venda=pricing.valor_total_final
            )
            db.add(db_item)
        else:
            db_item = RentalBudgetItem(
                budget_id=budget.id,
                opportunity_kit_id=cloned_kit.id,
                tipo_contrato_kit=pricing.tipo_contrato,
                custo_aquisicao_unit=pricing.custo_unitario,
                custo_total_aquisicao=pricing.custo_unitario,
                fator_margem=pricing.fator_efetivo,
                valor_venda_equipamento=pricing.valor_unitario_final,
                valor_mensal=pricing.valor_unitario_final,
                perc_comissao=pricing.comissao_percentual,
                comissao_mensal=_round2(pricing.valor_comissao_liquida / qtd_dec),
                dsr_mensal=_round2(pricing.valor_dsr / qtd_dec),
                fgts_mensal=_round2(pricing.valor_fgts / qtd_dec),
                inss_mensal=_round2(pricing.valor_inss / qtd_dec),
                demais_incidencias_mensal=_round2(pricing.valor_demais / qtd_dec),
                despesa_operacional_mensal=_round2(pricing.valor_despesa_operacional / qtd_dec),
                lucro_mensal=pricing.lucro_unitario_estimado,
                margem=pricing.margem_estimada,
                quantidade=qtd_dec
            )
            db.add(db_item)

        calculated_items_state.append({
            "opportunity_kit_id": str(cloned_kit.id),
            "nome_kit": pricing.nome_kit,
            "tipo_precificacao": pricing.tipo_precificacao,
            "quantidade": pricing.quantidade,
            "valor_unitario": float(pricing.valor_unitario_final),
            "fator": float(pricing.fator_efetivo),
            "desconto_percentual": float(pricing.desconto_percentual),
            "acrescimo_percentual": float(pricing.acrescimo_percentual),
            "comissao_percentual": float(pricing.comissao_percentual),
            "nome_politica": pricing.nome_politica,
            "valor_total": float(pricing.valor_total_final)
        })

    budget.valor_total = total_budget_value
    budget.customer_id = req.customer_id
    budget.sales_team_id = req.sales_team_id
    budget.vendedor_id = vendedor_id
    budget.forma_pagamento_id = req.forma_pagamento_id
    budget.titulo = req.titulo or budget.titulo
    budget.observacoes = req.observacoes
    if primary_policy_id:
        budget.commercial_policy_id = primary_policy_id

    raw_groupings = list(req.proposal_custom_groupings if req.proposal_custom_groupings is not None else (budget.proposal_custom_groupings or []))
    groupings = []
    for g in raw_groupings:
        if isinstance(g, dict):
            g_dict = dict(g)
            if "kit_ids" in g_dict and isinstance(g_dict["kit_ids"], list):
                g_dict["kit_ids"] = [kit_id_map.get(str(k_id), str(k_id)) for k_id in g_dict["kit_ids"]]
            groupings.append(g_dict)
        elif hasattr(g, 'model_dump'):
            g_dict = g.model_dump()
            if "kit_ids" in g_dict and isinstance(g_dict["kit_ids"], list):
                g_dict["kit_ids"] = [kit_id_map.get(str(k_id), str(k_id)) for k_id in g_dict["kit_ids"]]
            groupings.append(g_dict)
        elif hasattr(g, 'dict'):
            g_dict = g.dict()
            if "kit_ids" in g_dict and isinstance(g_dict["kit_ids"], list):
                g_dict["kit_ids"] = [kit_id_map.get(str(k_id), str(k_id)) for k_id in g_dict["kit_ids"]]
            groupings.append(g_dict)
        else:
            groupings.append(g)

    if not any(isinstance(g, dict) and g.get("is_express") for g in groupings):
        groupings.append({"is_express": True, "tipo": "EXPRESS_SALE"})
    budget.proposal_custom_groupings = groupings

    if has_any_requiring_approval:
        budget.status = "EM_LANCAMENTO"

    if is_update:
        budget.versao = (budget.versao or 1) + 1

    db.add(budget)
    db.flush()

    # Build and record history diff
    new_state = {
        "valor_total": float(budget.valor_total),
        "forma_pagamento_id": str(budget.forma_pagamento_id) if budget.forma_pagamento_id else None,
        "status": budget.status,
        "sales_team_id": str(budget.sales_team_id) if budget.sales_team_id else None,
        "titulo": budget.titulo,
        "items": calculated_items_state
    }

    diff_payload = build_sales_budget_diff(
        old_state=old_state,
        new_state=new_state,
        user=current_user,
        action="ATUALIZAR_VENDA_EXPRESS" if is_update else "CRIAR_VENDA_EXPRESS"
    )

    desc_history = (
        f"Venda Express atualizada (Versão {budget.versao}). Total: R$ {budget.valor_total:.2f}."
        if is_update else
        f"Venda Express criada (Nº {budget.numero_orcamento}). Total: R$ {budget.valor_total:.2f}."
    )

    history_record = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao,
        status_anterior=old_state.get("status", "EM_LANCAMENTO") if old_state else "EM_LANCAMENTO",
        status_novo=budget.status,
        usuario_id=str(current_user.id) if current_user else "sistema",
        cargo_usuario=None,
        descricao=desc_history,
        diff_changes=diff_payload,
        data_movimentacao=datetime.now(timezone.utc)
    )
    db.add(history_record)
    db.commit()
    db.refresh(budget)

    return budget


def authorize_express_sale_by_manager(
    db: Session,
    tenant_id: str,
    company_id: str,
    budget_id: UUID,
    req: ExpressAuthorizeManagerRequest,
    current_user: Optional[User] = None
) -> Dict[str, Any]:
    from src.core.security import verify_password
    from src.modules.users.models import User
    from src.modules.sales_budgets.models import SalesBudget, SalesBudgetApproval, SalesBudgetHistory
    from src.modules.sales_budgets.service import check_is_approver

    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento de Venda Express não encontrado.")

    # Find manager/admin by email in this tenant
    manager_user = db.query(User).filter(
        User.tenant_id == tenant_id,
        User.email.ilike(req.email.strip())
    ).first()

    if not manager_user:
        raise HTTPException(status_code=401, detail="Usuário ou senha de gerência incorretos.")

    if not verify_password(req.password, manager_user.password_hash):
        raise HTTPException(status_code=401, detail="Usuário ou senha de gerência incorretos.")

    # Check if user is approver
    is_approver, cargo_aprovador = check_is_approver(db, str(manager_user.id), tenant_id, budget.company_id)
    if not is_approver:
        raise HTTPException(
            status_code=403, 
            detail="O usuário autenticado não possui perfil de Gerente ou Administrador para autorizar vendas."
        )

    # Register approval
    approval = SalesBudgetApproval(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        usuario_aprovador_id=str(manager_user.id),
        cargo_aprovador=cargo_aprovador or "Gerência/Admin",
        observacao=req.motivo or "Autorização por credenciais de gerência na Venda Express.",
        data_aprovacao=datetime.now(timezone.utc)
    )
    db.add(approval)

    budget.status = "APROVADO"

    desc_hist = f"Venda Express autorizada por {manager_user.name} ({cargo_aprovador or 'Gerência'})."
    hist = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao or 1,
        status_anterior="EM_LANCAMENTO",
        status_novo="APROVADO",
        usuario_id=str(manager_user.id),
        cargo_usuario=cargo_aprovador,
        descricao=desc_hist,
        data_movimentacao=datetime.now(timezone.utc)
    )
    db.add(hist)
    db.commit()
    db.refresh(budget)

    return {
        "success": True,
        "message": f"Venda Express autorizada com sucesso por {manager_user.name}.",
        "budget_id": str(budget.id),
        "status": budget.status,
        "approver_name": manager_user.name,
        "cargo": cargo_aprovador
    }


def finalize_express_sale(
    db: Session,
    tenant_id: str,
    company_id: str,
    budget_id: UUID,
    req: ExpressFinalizeRequest,
    current_user: Optional[User] = None
) -> Dict[str, Any]:
    from src.modules.sales_budgets.models import SalesBudget, SalesBudgetHistory
    from src.modules.sales_budgets.schemas import BudgetStatusEnum

    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()

    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento de Venda Express não encontrado.")

    target_status = req.status.value if hasattr(req.status, 'value') else str(req.status)
    if target_status not in ["GANHO", "PERDIDO"]:
        raise HTTPException(status_code=400, detail="Status de finalização inválido. Escolha GANHO ou PERDIDO.")

    status_anterior = budget.status

    if target_status == "GANHO" and status_anterior not in ["APROVADO", "GANHO"]:
        for it in list(budget.items) + list(budget.rental_items):
            if it.opportunity_kit_id:
                try:
                    p_res = calculate_express_pricing(
                        db, tenant_id, company_id,
                        ExpressKitPricingRequest(
                            opportunity_kit_id=it.opportunity_kit_id,
                            sales_team_id=budget.sales_team_id,
                            valor_final=Decimal(str(getattr(it, 'venda_unit', None) or getattr(it, 'valor_mensal', None) or 0)),
                            quantidade=int(it.quantidade or 1)
                        ),
                        current_user=current_user
                    )
                    if p_res.requer_aprovacao:
                        raise HTTPException(
                            status_code=400,
                            detail="Esta venda express possui itens com margem abaixo da alçada comercial e necessita de autorização da gerência por senha antes de ser finalizada como Ganha."
                        )
                except HTTPException:
                    raise
                except Exception:
                    pass

    budget.status = target_status

    if target_status == "GANHO":
        desc = "Venda Express finalizada com status GANHA."
    else:
        desc = f"Venda Express finalizada com status PERDIDA. Motivo: {req.motivo_perda or 'Não informado'}."

    hist = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao or 1,
        status_anterior=status_anterior,
        status_novo=target_status,
        usuario_id=str(current_user.id) if current_user else "sistema",
        descricao=desc,
        data_movimentacao=datetime.now(timezone.utc)
    )
    db.add(hist)
    db.commit()
    db.refresh(budget)

    return {
        "success": True,
        "message": desc,
        "budget_id": str(budget.id),
        "status": budget.status
    }
