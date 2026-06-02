from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.solution_analysis.schemas import (
    SolutionAnalysisCreate,
    SolutionAnalysisUpdate,
    SolutionAnalysisResponse,
    SolutionAnalysisItemCreate,
    SolutionAnalysisItemResponse,
    SolutionAnalysisSummary,
)
from src.modules.solution_analysis.service import SolutionAnalysisService

router = APIRouter(prefix="/solution-analysis", tags=["Solution Analysis"])


@router.get("", response_model=List[SolutionAnalysisSummary])
def list_analyses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    service = SolutionAnalysisService(db)
    return service.list_analyses(current_user.tenant_id, company_id)


@router.post("", response_model=SolutionAnalysisResponse, status_code=201)
def create_analysis(
    data: SolutionAnalysisCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    service = SolutionAnalysisService(db)
    try:
        return service.create_analysis(current_user.tenant_id, company_id, data, current_user)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{analise_id}", response_model=SolutionAnalysisResponse)
def get_analysis(
    analise_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    analise = service.get_analysis(str(analise_id), current_user.tenant_id)
    if not analise:
        raise HTTPException(status_code=404, detail="Análise não encontrada")
    return analise


@router.put("/{analise_id}", response_model=SolutionAnalysisResponse)
@router.patch("/{analise_id}", response_model=SolutionAnalysisResponse)
def update_analysis(
    analise_id: UUID,
    data: SolutionAnalysisUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    try:
        analise = service.update_analysis(str(analise_id), current_user.tenant_id, data, current_user)
        if not analise:
            raise HTTPException(status_code=404, detail="Análise não encontrada")
        return analise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{analise_id}", status_code=204)
def delete_analysis(
    analise_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    try:
        deleted = service.delete_analysis(str(analise_id), current_user.tenant_id, current_user)
        if not deleted:
            raise HTTPException(status_code=404, detail="Análise não encontrada")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{analise_id}/items", response_model=SolutionAnalysisItemResponse, status_code=201)
def add_item(
    analise_id: UUID,
    data: SolutionAnalysisItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    try:
        return service.add_item(str(analise_id), current_user.tenant_id, data, current_user)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{analise_id}/items/{item_id}", status_code=204)
def delete_item(
    analise_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    try:
        deleted = service.delete_item(str(analise_id), str(item_id), current_user.tenant_id, current_user)
        if not deleted:
            raise HTTPException(status_code=404, detail="Item não encontrado")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/budgets-by-product/{product_id}")
def list_budgets_by_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    from src.modules.purchase_budgets.models import PurchaseBudget, PurchaseBudgetItem
    
    items = (
        db.query(PurchaseBudgetItem)
        .join(PurchaseBudget)
        .filter(
            PurchaseBudgetItem.product_id == product_id,
            PurchaseBudget.tenant_id == current_user.tenant_id,
            PurchaseBudget.company_id == UUID(str(company_id))
        )
        .order_by(PurchaseBudget.data_orcamento.desc(), PurchaseBudget.created_at.desc())
        .all()
    )
    
    res = []
    seen_budgets = set()
    for item in items:
        b = item.budget
        if b.id in seen_budgets:
            continue
        seen_budgets.add(b.id)
        
        costs = calculate_purchase_item_cost(db, item)
        
        supplier_name = b.supplier.nome_fantasia or b.supplier.razao_social if b.supplier else b.vendedor_nome
        res.append({
            "id": str(b.id),
            "numero_orcamento": b.numero_orcamento or "Sem Número",
            "supplier_name": supplier_name or "Fornecedor não informado",
            "data_orcamento": b.data_orcamento.isoformat() if b.data_orcamento else None,
            "custo_revenda": float(costs["custo_revenda"]),
            "custo_uso_consumo": float(costs["custo_uso_consumo"])
        })
    return res


def calculate_purchase_item_cost(db: Session, item) -> dict:
    from src.modules.products.service import ProductService
    from src.modules.ncm.services.ncm_service import NcmService
    from src.modules.companies.models import Company
    from src.modules.catalog.models import State

    budget = item.budget
    product = item.product
    
    ALIQ_INTERNA_DESTINO = 0.17 
    FATOR_BIT = 0.4117
    DESCONTO_CREDITO_OUTORGADO = 0.12

    final_valor_unitario = float(item.valor_unitario or 0)
    if budget.negotiations:
        latest_neg = sorted(budget.negotiations, key=lambda x: x.data_negociacao, reverse=True)[0]
        for n_item in latest_neg.items:
            if n_item.budget_item_id == item.id and float(item.quantidade or 1) > 0:
                final_valor_unitario = float(n_item.valor_final or 0) / float(item.quantidade or 1)

    qty = float(item.quantidade or 1)
    if qty <= 0:
        qty = 1.0

    frete_unit = float(item.frete_valor or 0) / qty
    ipi_unit = float(item.ipi_valor or 0) / qty

    st_flag = False
    mva_percent = 0.0
    bit_flag = False
    
    prod_service = ProductService(db)
    ncm_service = NcmService(db)

    if product and product.ncm_codigo:
        mva_data = prod_service.get_product_mva(budget.tenant_id, product.ncm_codigo, str(budget.company_id), "REVENDA")
        if mva_data:
            st_flag = True
            mva_percent = float(mva_data.get("mva_percent", 0))
        
        benefits = ncm_service.get_linked_benefits(product.ncm_codigo)
        benefits = [b for b in benefits if str(b.tenant_id) == str(budget.tenant_id)]
        if any("BIT" in (b.nome or "").upper() for b in benefits):
            bit_flag = True

    company = db.query(Company).filter(Company.id == str(budget.company_id)).first()
    uf_destino = "MT"
    if company and company.state_id:
        state = db.query(State).filter(State.id == company.state_id).first()
        if state:
            uf_destino = state.sigla.upper()
    uf_origem = budget.supplier.uf.upper() if (budget.supplier and budget.supplier.uf) else "SP"
    op_interestadual = (uf_origem != uf_destino)

    icms_from_budget = float(item.icms_percent or 0)
    icms_entrada_effective = icms_from_budget if icms_from_budget <= 4 else 7

    calc_icms_st_final = 0.0
    if st_flag and op_interestadual and product and product.tipo == 'EQUIPAMENTO':
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

    c_valor_difal = 0.0
    if op_interestadual and product and product.tipo == 'EQUIPAMENTO':
        aliquota_origem = float(item.icms_percent or 0) / 100.0 if item.icms_percent else 0.12
        base_com_ipi_e_frete = final_valor_unitario + ipi_unit + frete_unit
        c_icms_origem = base_com_ipi_e_frete * aliquota_origem
        base_sem_icms = base_com_ipi_e_frete - c_icms_origem
        divisor = 1 - ALIQ_INTERNA_DESTINO
        
        if divisor > 0:
            c_base_calculo_difal = base_sem_icms / divisor
            c_icms_destino = c_base_calculo_difal * ALIQ_INTERNA_DESTINO
            c_valor_difal_base = c_icms_destino - c_icms_origem
            
            diff_difal_st = c_valor_difal_base - calc_icms_st_final
            if diff_difal_st > 0:
                c_valor_difal = calc_icms_st_final + diff_difal_st
            else:
                c_valor_difal = c_valor_difal_base

    return {
        "custo_revenda": final_valor_unitario + ipi_unit + frete_unit + calc_icms_st_final,
        "custo_uso_consumo": final_valor_unitario + ipi_unit + frete_unit + c_valor_difal
    }
