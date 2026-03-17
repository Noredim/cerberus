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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return the full cost composition breakdown for a product."""
    from src.modules.products.models import Product
    from src.modules.products.service import ProductService
    from src.modules.ncm.services.ncm_service import NcmService
    from src.modules.purchase_budgets.models import PurchaseBudget, PurchaseBudgetItem

    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == current_user.tenant_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado")

    custo_ref = float(product.vlr_referencia_revenda or 0)

    # Default fallback when no linked budget
    result = {
        "base_unitario": custo_ref,
        "ipi_percent": 0.0,
        "ipi_unitario": 0.0,
        "frete_cif_unitario": 0.0,
        "has_st": False,
        "icms_st_normal": 0.0,
        "cred_outorgado_percent": 0.0,
        "cred_outorgado_valor": 0.0,
        "icms_st_final": 0.0,
        "is_bit": False,
        "custo_unit_final": custo_ref,
    }

    if not product.orcamento_referencia_revenda_id:
        return result

    budget_item = db.query(PurchaseBudgetItem).join(PurchaseBudget).filter(
        PurchaseBudgetItem.product_id == product_id,
        PurchaseBudget.id == product.orcamento_referencia_revenda_id
    ).first()

    if not budget_item:
        return result

    budget = budget_item.budget
    qtd = float(budget_item.quantidade) if float(budget_item.quantidade) > 0 else 1

    # Negotiated unit price
    base_unitario = float(budget_item.valor_unitario)
    if budget.negotiations:
        latest_neg = sorted(budget.negotiations, key=lambda x: x.data_negociacao, reverse=True)[0]
        for n_item in latest_neg.items:
            if n_item.budget_item_id == budget_item.id:
                base_unitario = float(n_item.valor_final) / qtd

    ipi_unitario = float(budget_item.ipi_valor) / qtd if qtd > 0 else 0
    frete_unitario = float(budget_item.frete_valor) / qtd if qtd > 0 else 0

    # --- ST calculation (mirrors PurchaseBudgetService._calculate_costs) ---
    ALIQ_INTERNA_DESTINO = 0.17
    FATOR_BIT = 0.4117
    DESCONTO_CREDITO_OUTORGADO = 0.12

    st_flag = False
    mva_percent = 0.0
    bit_flag = False
    icms_st_normal = 0.0
    cred_outorgado_valor = 0.0
    calc_icms_st_final = 0.0

    prod_service = ProductService(db)
    ncm_service = NcmService(db)

    if product.ncm_codigo:
        mva_data = prod_service.get_product_mva(
            budget.tenant_id, product.ncm_codigo, str(budget.company_id), "REVENDA"
        )
        if mva_data:
            st_flag = True
            mva_percent = float(mva_data.get("mva_percent", 0))

        benefits = ncm_service.get_linked_benefits(product.ncm_codigo)
        benefits = [b for b in benefits if str(b.tenant_id) == str(budget.tenant_id)]
        if any("BIT" in (b.nome or "").upper() for b in benefits):
            bit_flag = True

    icms_from_budget = float(budget_item.icms_percent)
    icms_entrada_effective = icms_from_budget if icms_from_budget <= 4 else 7

    # --- DETERMINE INTERSTATE OPERATION ---
    from src.modules.companies.models import Company
    company = db.query(Company).filter(Company.id == str(budget.company_id)).first()
    uf_destino = company.state_id.upper() if (company and company.state_id) else "MT"
    uf_origem = budget.supplier.uf.upper() if (budget.supplier and budget.supplier.uf) else "SP"
    op_interestadual = (uf_origem != uf_destino)

    # --- CALCULATE ST (only for interstate operations) ---
    if st_flag and op_interestadual:
        cred = icms_entrada_effective / 100.0
        base_com_mva = (base_unitario + ipi_unitario) * (1 + (mva_percent / 100.0))

        if bit_flag:
            icms_st_saida = base_com_mva * FATOR_BIT * ALIQ_INTERNA_DESTINO
            icms_credito = base_unitario * FATOR_BIT * cred
            calc_icms_st_final = max(0.0, icms_st_saida - icms_credito)
            icms_st_normal = calc_icms_st_final  # BIT: single step
        else:
            icms_st_bruto = base_com_mva * ALIQ_INTERNA_DESTINO - base_unitario * cred
            icms_st_normal = max(0.0, icms_st_bruto)
            cred_outorgado_valor = icms_st_normal * DESCONTO_CREDITO_OUTORGADO
            calc_icms_st_final = max(0.0, icms_st_normal - cred_outorgado_valor)

    custo_unit_final = base_unitario + ipi_unitario + frete_unitario + calc_icms_st_final

    return {
        "base_unitario": round(base_unitario, 2),
        "ipi_percent": float(budget_item.ipi_percent or 0),
        "ipi_unitario": round(ipi_unitario, 2),
        "frete_cif_unitario": round(frete_unitario, 2),
        "has_st": st_flag and op_interestadual,
        "icms_st_normal": round(icms_st_normal, 2),
        "cred_outorgado_percent": DESCONTO_CREDITO_OUTORGADO * 100 if (st_flag and op_interestadual and not bit_flag) else 0,
        "cred_outorgado_valor": round(cred_outorgado_valor, 2),
        "icms_st_final": round(calc_icms_st_final, 2),
        "is_bit": bit_flag,
        "is_intrastate": not op_interestadual,
        "uf_origem": uf_origem,
        "uf_destino": uf_destino,
        "custo_unit_final": round(custo_unit_final, 2),
    }


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
