from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.sales_budgets import service
from src.modules.sales_budgets.schemas import (
    SalesBudgetCreate, SalesBudgetUpdate, SalesBudgetOut,
    SalesBudgetStatusUpdate, SalesBudgetHeaderUpdate
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
        mv = _calc_margem_venda(b.items)
        mr = _calc_margem_rental(b.rental_items)
        
        # Margem Geral: average of non-zero margins
        if mv > 0 and mr > 0:
            mg = float(round((mv + mr) / 2, 2))
        else:
            mg = float(mv if mv > 0 else mr)
            
        total_faturamento_rental = sum(float(ri.valor_mensal or 0) * float(ri.quantidade or 1) * int(ri.prazo_contrato or 0) for ri in b.rental_items)
        valor_mensal_total_rental = sum(float(ri.valor_mensal or 0) * float(ri.quantidade or 1) for ri in b.rental_items)
        prazo_max_rental = max([int(ri.prazo_contrato or 0) for ri in b.rental_items]) if b.rental_items else 0
        
        result.append({
            "id": b.id,
            "numero_orcamento": b.numero_orcamento,
            "titulo": b.titulo,
            "status": b.status,
            "data_orcamento": b.data_orcamento,
            "customer_nome": b.customer.nome_fantasia or b.customer.razao_social if b.customer else None,
            "total_venda": sum(float(i.total_venda or 0) for i in b.items),
            "margem_venda": mv,
            "total_faturamento_rental": total_faturamento_rental,
            "valor_mensal_total_rental": valor_mensal_total_rental,
            "prazo_max_rental": prazo_max_rental,
            "margem_rental": mr,
            "margem_geral": mg,
            "created_at": b.created_at,
        })
    return result


def _calc_margem_venda(items) -> float:
    total_lucro = sum(float(i.lucro_unit or 0) * float(i.quantidade or 1) for i in items)
    total_venda = sum(float(i.venda_unit or 0) * float(i.quantidade or 1) for i in items)
    if total_venda == 0:
        return 0.0
    return float(round(total_lucro / total_venda * 100, 2))


def _calc_margem_rental(rental_items) -> float:
    total_lucro_mensal = sum(float(ri.lucro_mensal or 0) * float(ri.quantidade or 1) for ri in rental_items)
    total_faturamento_mensal = sum(float(ri.valor_mensal or 0) * float(ri.quantidade or 1) for ri in rental_items)
    if total_faturamento_mensal == 0:
        return 0.0
    return float(round(total_lucro_mensal / total_faturamento_mensal * 100, 2))


@router.get("/check-st")
def check_st(
    ncm_codigo: str,
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Check if a product NCM has ST rules for the company's UF."""
    from src.modules.companies.models import Company
    company = db.query(Company).filter(Company.id == company_id).first()
    company_uf = company.state_id if company else ""
    has_st = service.check_st_flag(db, current_user.tenant_id, ncm_codigo, company_uf)
    return {"has_st": has_st}


@router.get("/product-cost-composition/{product_id}")
def get_product_cost_composition(
    product_id: str,
    tipo: str = "REVENDA",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return the full cost composition breakdown for a product."""
    res = service.calculate_product_cost_composition(db, product_id, current_user.tenant_id, tipo)
    if not res:
        raise HTTPException(status_code=404, detail="Produto não encontrado")
    return res


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


@router.patch("/{budget_id}/header")
def update_header(
    budget_id: UUID,
    data: SalesBudgetHeaderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    budget = service.update_header(db, current_user.tenant_id, str(budget_id), data)
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


@router.delete("/{budget_id}")
def delete_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from src.modules.sales_budgets.models import SalesBudgetItem, RentalBudgetItem
    
    # Check if there are any kits attached to this budget in the UI grids
    has_sale_kits = db.query(SalesBudgetItem).filter(
        SalesBudgetItem.budget_id == str(budget_id),
        SalesBudgetItem.opportunity_kit_id.isnot(None)
    ).first()
    
    has_rental_kits = db.query(RentalBudgetItem).filter(
        RentalBudgetItem.budget_id == str(budget_id),
        RentalBudgetItem.opportunity_kit_id.isnot(None)
    ).first()
    
    if has_sale_kits or has_rental_kits:
        raise HTTPException(
            status_code=400, 
            detail="Não é possível excluir a oportunidade pois existem kits vinculados e visíveis. Remova-os primeiro."
        )
    
    success = service.delete_budget(db, current_user.tenant_id, str(budget_id))
    if not success:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    return {"message": "Orçamento excluído com sucesso"}


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

    rental_items = []
    for ri in budget.rental_items:
        rental_items.append({
            "id": ri.id,
            "product_id": ri.product_id,
            "opportunity_kit_id": ri.opportunity_kit_id,
            "product_nome": ri.product_nome,
            "product_codigo": ri.product_codigo,
            "custo_op_mensal_kit": float(ri.custo_op_mensal_kit) if ri.custo_op_mensal_kit is not None else None,
            "is_kit_instalacao": ri.is_kit_instalacao,
            "tipo_contrato_kit": ri.tipo_contrato_kit,
            "kit_taxa_juros_mensal": float(ri.kit_taxa_juros_mensal) if ri.kit_taxa_juros_mensal is not None else None,
            "kit_custo_produtos": float(ri.kit_custo_produtos) if ri.kit_custo_produtos is not None else None,
            "kit_custo_servicos": float(ri.kit_custo_servicos) if ri.kit_custo_servicos is not None else None,
            "kit_pis": float(ri.kit_pis) if ri.kit_pis is not None else None,
            "kit_cofins": float(ri.kit_cofins) if ri.kit_cofins is not None else None,
            "kit_csll": float(ri.kit_csll) if ri.kit_csll is not None else None,
            "kit_irpj": float(ri.kit_irpj) if ri.kit_irpj is not None else None,
            "kit_iss": float(ri.kit_iss) if ri.kit_iss is not None else None,
            "kit_vlt_manut": float(ri.kit_vlt_manut) if ri.kit_vlt_manut is not None else None,
            "kit_valor_mensal": float(ri.kit_valor_mensal) if ri.kit_valor_mensal is not None else None,
            "kit_valor_impostos": float(ri.kit_valor_impostos) if ri.kit_valor_impostos is not None else None,
            "kit_receita_liquida": float(ri.kit_receita_liquida) if ri.kit_receita_liquida is not None else None,
            "kit_lucro_mensal": float(ri.kit_lucro_mensal) if ri.kit_lucro_mensal is not None else None,
            "kit_margem": float(ri.kit_margem) if ri.kit_margem is not None else None,
            "quantidade": float(ri.quantidade or 1),
            "custo_aquisicao_unit": float(ri.custo_aquisicao_unit or 0),
            "ipi_unit": float(ri.ipi_unit or 0),
            "frete_unit": float(ri.frete_unit or 0),
            "icms_st_unit": float(ri.icms_st_unit or 0),
            "difal_unit": float(ri.difal_unit or 0),
            "custo_total_aquisicao": float(ri.custo_total_aquisicao or 0),
            "prazo_contrato": ri.prazo_contrato,
            "usa_taxa_manut_padrao": ri.usa_taxa_manut_padrao,
            "taxa_manutencao_anual_item": float(ri.taxa_manutencao_anual_item) if ri.taxa_manutencao_anual_item is not None else None,
            "perc_instalacao_item": float(ri.perc_instalacao_item) if ri.perc_instalacao_item is not None else None,
            "valor_instalacao_item": float(ri.valor_instalacao_item) if ri.valor_instalacao_item is not None else None,
            "custo_manut_mensal": float(ri.custo_manut_mensal or 0),
            "custo_total_mensal": float(ri.custo_total_mensal or 0),
            "fator_margem": float(ri.fator_margem or 1),
            "valor_venda_equipamento": float(ri.valor_venda_equipamento or 0),
            "parcela_locacao": float(ri.parcela_locacao or 0),
            "manutencao_locacao": float(ri.manutencao_locacao or 0),
            "valor_mensal": float(ri.valor_mensal or 0),
            "perc_impostos_total": float(ri.perc_impostos_total or 0),
            "impostos_mensal": float(ri.impostos_mensal or 0),
            "receita_liquida_mensal": float(ri.receita_liquida_mensal or 0),
            "perc_comissao": float(ri.perc_comissao or 0),
            "comissao_mensal": float(ri.comissao_mensal or 0),
            "lucro_mensal": float(ri.lucro_mensal or 0),
            "margem": float(ri.margem or 0),
        })

    return {
        "id": budget.id,
        "tenant_id": budget.tenant_id,
        "company_id": budget.company_id,
        "customer_id": budget.customer_id,
        "vendedor_id": str(budget.vendedor_id) if budget.vendedor_id else None,
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
        "venda_markup_produtos": float(budget.venda_markup_produtos or 1),
        "venda_markup_servicos": float(budget.venda_markup_servicos or 1),
        "venda_markup_instalacao": float(budget.venda_markup_instalacao or 1),
        "venda_markup_manutencao": float(budget.venda_markup_manutencao or 1),
        "venda_havera_manutencao": bool(budget.venda_havera_manutencao),
        "venda_qtd_meses_manutencao": int(budget.venda_qtd_meses_manutencao or 0),
        "tipo_receita_rental": budget.tipo_receita_rental,
        "prazo_contrato_meses": budget.prazo_contrato_meses,
        "prazo_instalacao_meses": budget.prazo_instalacao_meses,
        "taxa_juros_mensal": float(budget.taxa_juros_mensal or 0),
        "taxa_manutencao_anual": float(budget.taxa_manutencao_anual or 0),
        "fator_margem_padrao": float(budget.fator_margem_padrao or 0),
        "fator_manutencao_padrao": float(budget.fator_manutencao_padrao or 0),
        "perc_instalacao_padrao": float(budget.perc_instalacao_padrao or 0),
        "perc_comissao_rental": float(budget.perc_comissao_rental or 0),
        "perc_pis_rental": float(budget.perc_pis_rental or 0),
        "perc_cofins_rental": float(budget.perc_cofins_rental or 0),
        "perc_csll_rental": float(budget.perc_csll_rental or 0),
        "perc_irpj_rental": float(budget.perc_irpj_rental or 0),
        "perc_iss_rental": float(budget.perc_iss_rental or 0),
        "perc_comissao_diretoria": float(budget.perc_comissao_diretoria or 0),
        "responsavel_ids": [r.user_id for r in budget.responsaveis],
        "items": items,
        "rental_items": rental_items,
        "created_at": budget.created_at,
        "updated_at": budget.updated_at,
    }
