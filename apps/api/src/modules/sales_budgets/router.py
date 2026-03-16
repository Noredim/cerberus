from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.sales_budgets import service
from src.modules.sales_budgets.schemas import (
    SalesBudgetCreate, SalesBudgetUpdate, SalesBudgetOut,
    SalesBudgetStatusUpdate
)


router = APIRouter(prefix="/sales-budgets", tags=["Sales Budgets"])


@router.get("")
def list_budgets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budgets = service.list_budgets(db, current_user.tenant_id)
    result = []
    for b in budgets:
        result.append({
            "id": b.id,
            "numero_orcamento": b.numero_orcamento,
            "titulo": b.titulo,
            "status": b.status,
            "data_orcamento": b.data_orcamento,
            "customer_nome": b.customer.nome_fantasia or b.customer.razao_social if b.customer else None,
            "total_venda": sum(float(i.total_venda or 0) for i in b.items),
            "margem_media": _calc_margem(b.items),
            "created_at": b.created_at,
        })
    return result


def _calc_margem(items) -> float:
    total_lucro = sum(float(i.lucro_unit or 0) * float(i.quantidade or 1) for i in items)
    total_venda = sum(float(i.venda_unit or 0) * float(i.quantidade or 1) for i in items)
    if total_venda == 0:
        return 0
    return round(total_lucro / total_venda * 100, 2)


@router.post("")
def create_budget(
    data: SalesBudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    budget = service.create_budget(
        db, current_user.tenant_id, company_id, data
    )
    return _budget_to_dict(budget)


@router.get("/{budget_id}")
def get_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budget = service.get_budget(db, current_user.tenant_id, str(budget_id))
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return _budget_to_dict(budget)


@router.put("/{budget_id}")
def update_budget(
    budget_id: UUID,
    data: SalesBudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        budget = service.update_budget(db, current_user.tenant_id, str(budget_id), data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return _budget_to_dict(budget)


@router.patch("/{budget_id}/status")
def update_status(
    budget_id: UUID,
    data: SalesBudgetStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budget = service.update_status(db, current_user.tenant_id, str(budget_id), data.status.value)
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return {"status": budget.status}


@router.post("/{budget_id}/duplicate")
def duplicate_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budget = service.duplicate_budget(db, current_user.tenant_id, str(budget_id))
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return _budget_to_dict(budget)


def _budget_to_dict(budget) -> dict:
    """Serialize budget to response dict."""
    items = []
    for i in budget.items:
        items.append({
            "id": i.id,
            "product_id": i.product_id,
            "product_nome": i.product_nome,
            "product_codigo": i.product_codigo,
            "tipo_item": i.tipo_item,
            "descricao_servico": i.descricao_servico,
            "usa_parametros_padrao": i.usa_parametros_padrao,
            "custo_unit_base": float(i.custo_unit_base or 0),
            "markup": float(i.markup or 1),
            "venda_unit": float(i.venda_unit or 0),
            "perc_frete_venda": float(i.perc_frete_venda or 0),
            "frete_venda_unit": float(i.frete_venda_unit or 0),
            "perc_pis": float(i.perc_pis or 0), "pis_unit": float(i.pis_unit or 0),
            "perc_cofins": float(i.perc_cofins or 0), "cofins_unit": float(i.cofins_unit or 0),
            "perc_csll": float(i.perc_csll or 0), "csll_unit": float(i.csll_unit or 0),
            "perc_irpj": float(i.perc_irpj or 0), "irpj_unit": float(i.irpj_unit or 0),
            "perc_icms": float(i.perc_icms or 0), "icms_unit": float(i.icms_unit or 0),
            "tem_st": i.tem_st,
            "perc_iss": float(i.perc_iss or 0), "iss_unit": float(i.iss_unit or 0),
            "perc_despesa_adm": float(i.perc_despesa_adm or 0), "despesa_adm_unit": float(i.despesa_adm_unit or 0),
            "perc_comissao": float(i.perc_comissao or 0), "comissao_unit": float(i.comissao_unit or 0),
            "lucro_unit": float(i.lucro_unit or 0),
            "margem_unit": float(i.margem_unit or 0),
            "quantidade": float(i.quantidade or 1),
            "total_venda": float(i.total_venda or 0),
        })

    return {
        "id": budget.id,
        "tenant_id": budget.tenant_id,
        "company_id": budget.company_id,
        "customer_id": budget.customer_id,
        "numero_orcamento": budget.numero_orcamento,
        "titulo": budget.titulo,
        "observacoes": budget.observacoes,
        "data_orcamento": budget.data_orcamento,
        "status": budget.status,
        "markup_padrao": float(budget.markup_padrao or 0),
        "perc_despesa_adm": float(budget.perc_despesa_adm or 0),
        "perc_comissao": float(budget.perc_comissao or 0),
        "perc_frete_venda": float(budget.perc_frete_venda or 0),
        "perc_pis": float(budget.perc_pis or 0),
        "perc_cofins": float(budget.perc_cofins or 0),
        "perc_csll": float(budget.perc_csll or 0),
        "perc_irpj": float(budget.perc_irpj or 0),
        "perc_iss": float(budget.perc_iss or 0),
        "perc_icms_interno": float(budget.perc_icms_interno or 0),
        "perc_icms_externo": float(budget.perc_icms_externo or 0),
        "responsavel_ids": [r.user_id for r in budget.responsaveis],
        "items": items,
        "created_at": budget.created_at,
        "updated_at": budget.updated_at,
    }
