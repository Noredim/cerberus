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
    ExpressSaleSaveRequest, ExpressSaleItemInput, SalesBudgetOut
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
    if custo_unitario > 0:
        fator_efetivo = _round4(valor_unitario_final / custo_unitario)
    else:
        fator_efetivo = _d(kit.fator_margem_locacao or 1.0)

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

    # Approval check
    requer_aprovacao = False
    motivo_aprovacao = None

    if min_policy_factor is not None and fator_efetivo < min_policy_factor:
        requer_aprovacao = True
        motivo_aprovacao = f"Fator de venda ({fator_efetivo:.4f}) está abaixo do limite mínimo da política comercial ({min_policy_factor:.4f}). Requer aprovação de gerência."

    # 6. Quantities and Totals
    qtd = req.quantidade if req.quantidade >= 1 else 1
    valor_total_final = _round2(valor_unitario_final * Decimal(qtd))
    valor_comissao_estimada = _round2(valor_total_final * (comissao_percentual / Decimal("100.0")))
    
    lucro_unitario = valor_unitario_final - custo_unitario - (valor_unitario_final * (comissao_percentual / Decimal("100.0")))
    lucro_unitario_estimado = _round2(lucro_unitario)
    margem_estimada = _round2((lucro_unitario / valor_unitario_final) * Decimal("100.0")) if valor_unitario_final > 0 else Decimal("0.0")

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
        db.query(SalesBudgetItem).filter(SalesBudgetItem.budget_id == budget.id).delete()
        db.query(RentalBudgetItem).filter(RentalBudgetItem.budget_id == budget.id).delete()
        db.flush()

    # Calculate and insert new items
    calculated_items_state = []
    total_budget_value = Decimal("0.00")
    primary_policy_id = None

    kit_svc = OpportunityKitService(db)

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
        
        if not primary_policy_id and pricing.commercial_policy_id:
            primary_policy_id = pricing.commercial_policy_id

        # Clone global kit to associate directly with this sales budget
        cloned_kit = kit_svc.clone_kit(
            source_kit_id=str(item_input.opportunity_kit_id),
            tenant_id=tenant_id,
            company_id=company_id,
            sales_budget_id=str(budget.id)
        )
        # Update cloned kit factors and commission
        cloned_kit.fator_margem_locacao = pricing.fator_efetivo
        cloned_kit.perc_comissao = pricing.comissao_percentual
        cloned_kit.commercial_policy_id = pricing.commercial_policy_id
        db.add(cloned_kit)
        db.flush()

        total_budget_value += pricing.valor_total_final

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
                comissao_unit=_round2(pricing.valor_unitario_final * (pricing.comissao_percentual / Decimal("100.0"))),
                lucro_unit=pricing.lucro_unitario_estimado,
                margem_unit=pricing.margem_estimada,
                quantidade=Decimal(pricing.quantidade),
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
                comissao_mensal=_round2(pricing.valor_unitario_final * (pricing.comissao_percentual / Decimal("100.0"))),
                lucro_mensal=pricing.lucro_unitario_estimado,
                margem=pricing.margem_estimada,
                quantidade=Decimal(pricing.quantidade)
            )
            db.add(db_item)

        calculated_items_state.append({
            "opportunity_kit_id": str(item_input.opportunity_kit_id),
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
        usuario_id=current_user.id,
        cargo_usuario=None,
        descricao=desc_history,
        diff_changes=diff_payload,
        data_movimentacao=datetime.now(timezone.utc)
    )
    db.add(history_record)
    db.commit()
    db.refresh(budget)

    return budget
