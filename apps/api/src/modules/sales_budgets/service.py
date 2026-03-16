from sqlalchemy.orm import Session
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List
from uuid import UUID

from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem, SalesBudgetResponsavel
from src.modules.sales_budgets.schemas import SalesBudgetCreate, SalesBudgetUpdate, SalesBudgetItemCreate
from src.modules.products.models import Product
from src.modules.companies.models import Company, CompanySalesParameter
from src.modules.customers.models import Customer
from src.modules.fiscal.models import NcmRule


def _d(val) -> Decimal:
    """Safely convert to Decimal."""
    if val is None:
        return Decimal("0")
    return Decimal(str(val))


def _round(val: Decimal, places: int = 4) -> Decimal:
    return val.quantize(Decimal(10) ** -places, rounding=ROUND_HALF_UP)


def get_next_numero(db: Session, tenant_id: str) -> str:
    """Generate next sequential budget number OV-XXXX."""
    last = db.query(SalesBudget).filter(
        SalesBudget.tenant_id == tenant_id,
        SalesBudget.numero_orcamento.isnot(None)
    ).order_by(SalesBudget.created_at.desc()).first()

    if last and last.numero_orcamento and last.numero_orcamento.startswith("OV-"):
        try:
            num = int(last.numero_orcamento.split("-")[1]) + 1
        except (ValueError, IndexError):
            num = 1
    else:
        num = 1
    return f"OV-{num:04d}"


def check_st_flag(db: Session, ncm_codigo: Optional[str], uf: str) -> bool:
    """Check if product has ST based on NCM + UF rule."""
    if not ncm_codigo or len(ncm_codigo) < 4:
        return False
    rule = db.query(NcmRule).filter(
        NcmRule.ncm.startswith(ncm_codigo[:4]),
        NcmRule.uf == uf
    ).first()
    return bool(rule and rule.st_flag)


def calculate_item(
    item_data: SalesBudgetItemCreate,
    budget_defaults: dict,
    product: Optional[Product],
    has_st: bool
) -> dict:
    """Calculate all fields for a single sales budget item.

    Follows the exact order from spec Section 9 (merchandise) and Section 10 (services).
    """
    is_service = item_data.tipo_item in ("SERVICO_INSTALACAO", "SERVICO_MANUTENCAO")
    use_defaults = item_data.usa_parametros_padrao

    # Resolve percentages: use item override or budget defaults
    def resolve(item_val, default_key):
        if not use_defaults and item_val is not None:
            return _d(item_val)
        return _d(budget_defaults.get(default_key, 0))

    perc_frete = resolve(item_data.perc_frete_venda, "perc_frete_venda")
    perc_pis = resolve(item_data.perc_pis, "perc_pis")
    perc_cofins = resolve(item_data.perc_cofins, "perc_cofins")
    perc_csll = resolve(item_data.perc_csll, "perc_csll")
    perc_irpj = resolve(item_data.perc_irpj, "perc_irpj")
    perc_iss = resolve(item_data.perc_iss, "perc_iss")
    perc_desp = resolve(item_data.perc_despesa_adm, "perc_despesa_adm")
    perc_com = resolve(item_data.perc_comissao, "perc_comissao")
    perc_icms = resolve(item_data.perc_icms, "perc_icms_interno")
    markup = _d(item_data.markup) if item_data.markup else _d(budget_defaults.get("markup_padrao", 1))

    # Step 1: Cost
    custo = _d(item_data.custo_unit_base)
    if not is_service and product and custo == 0:
        custo = _d(product.vlr_referencia_revenda)

    # Step 2: Sale price
    venda = _round(custo * markup)

    # Step 3: Freight
    frete_unit = _round(venda * perc_frete / 100) if not is_service else Decimal("0")

    # Step 4: Taxes
    if is_service:
        # Services: only ISS
        pis_u = cofins_u = csll_u = irpj_u = icms_u = Decimal("0")
        iss_u = _round(venda * perc_iss / 100)
        impostos_total = iss_u
        actual_st = False
    else:
        # Merchandise: PIS, COFINS, CSLL, IRPJ + ICMS (if no ST)
        pis_u = _round(venda * perc_pis / 100)
        cofins_u = _round(venda * perc_cofins / 100)
        csll_u = _round(venda * perc_csll / 100)
        irpj_u = _round(venda * perc_irpj / 100)
        icms_u = Decimal("0") if has_st else _round(venda * perc_icms / 100)
        iss_u = Decimal("0")
        impostos_total = pis_u + cofins_u + csll_u + irpj_u + icms_u
        actual_st = has_st

    # Step 5: Administrative expenses
    desp_u = _round(venda * perc_desp / 100)

    # Step 6: Commission
    com_u = _round(venda * perc_com / 100)

    # Step 7: Profit
    lucro = venda - custo - frete_unit - impostos_total - desp_u - com_u

    # Step 8: Margin
    margem = _round(lucro / venda * 100, 4) if venda > 0 else Decimal("0")

    qty = _d(item_data.quantidade)
    total = _round(venda * qty)

    return {
        "custo_unit_base": custo,
        "markup": markup,
        "venda_unit": venda,
        "perc_frete_venda": perc_frete,
        "frete_venda_unit": frete_unit,
        "perc_pis": perc_pis, "pis_unit": pis_u,
        "perc_cofins": perc_cofins, "cofins_unit": cofins_u,
        "perc_csll": perc_csll, "csll_unit": csll_u,
        "perc_irpj": perc_irpj, "irpj_unit": irpj_u,
        "perc_icms": perc_icms, "icms_unit": icms_u,
        "tem_st": actual_st,
        "perc_iss": perc_iss, "iss_unit": iss_u,
        "perc_despesa_adm": perc_desp, "despesa_adm_unit": desp_u,
        "perc_comissao": perc_com, "comissao_unit": com_u,
        "lucro_unit": lucro,
        "margem_unit": margem,
        "quantidade": qty,
        "total_venda": total,
    }


def _build_defaults(budget: SalesBudget) -> dict:
    return {
        "markup_padrao": budget.markup_padrao,
        "perc_despesa_adm": budget.perc_despesa_adm,
        "perc_comissao": budget.perc_comissao,
        "perc_frete_venda": budget.perc_frete_venda,
        "perc_pis": budget.perc_pis,
        "perc_cofins": budget.perc_cofins,
        "perc_csll": budget.perc_csll,
        "perc_irpj": budget.perc_irpj,
        "perc_iss": budget.perc_iss,
        "perc_icms_interno": budget.perc_icms_interno,
        "perc_icms_externo": budget.perc_icms_externo,
    }


def create_budget(db: Session, tenant_id: str, company_id: str, data: SalesBudgetCreate) -> SalesBudget:
    budget = SalesBudget(
        tenant_id=tenant_id,
        company_id=company_id,
        customer_id=data.customer_id,
        numero_orcamento=get_next_numero(db, tenant_id),
        titulo=data.titulo,
        observacoes=data.observacoes,
        data_orcamento=data.data_orcamento,
        status="RASCUNHO",
        markup_padrao=data.markup_padrao,
        perc_despesa_adm=data.perc_despesa_adm,
        perc_comissao=data.perc_comissao,
        perc_frete_venda=data.perc_frete_venda,
        perc_pis=data.perc_pis,
        perc_cofins=data.perc_cofins,
        perc_csll=data.perc_csll,
        perc_irpj=data.perc_irpj,
        perc_iss=data.perc_iss,
        perc_icms_interno=data.perc_icms_interno,
        perc_icms_externo=data.perc_icms_externo,
    )
    db.add(budget)
    db.flush()

    # Responsaveis
    for uid in data.responsavel_ids:
        db.add(SalesBudgetResponsavel(budget_id=budget.id, user_id=uid))

    # Get company UF for ST check
    company = db.query(Company).filter(Company.id == company_id).first()
    company_uf = ""
    if company and company.state_id:
        company_uf = company.state_id

    # Get customer UF
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    customer_uf = customer.state_id if customer else ""

    defaults = _build_defaults(budget)

    # Items
    for item_data in data.items:
        product = None
        if item_data.product_id:
            product = db.query(Product).filter(Product.id == item_data.product_id).first()

        # Check ST
        has_st = False
        if product and item_data.tipo_item == "MERCADORIA":
            has_st = item_data.tem_st or check_st_flag(db, product.ncm_codigo, company_uf)

        # Resolve ICMS based on UF
        if not item_data.usa_parametros_padrao and item_data.perc_icms is not None:
            pass  # Item has custom ICMS
        else:
            if company_uf == customer_uf:
                defaults["perc_icms_interno"] = budget.perc_icms_interno
            else:
                defaults["perc_icms_interno"] = budget.perc_icms_externo

        calc = calculate_item(item_data, defaults, product, has_st)

        db_item = SalesBudgetItem(
            budget_id=budget.id,
            product_id=item_data.product_id,
            tipo_item=item_data.tipo_item,
            descricao_servico=item_data.descricao_servico,
            usa_parametros_padrao=item_data.usa_parametros_padrao,
            **calc
        )
        db.add(db_item)

    db.commit()
    db.refresh(budget)
    return budget


def update_budget(db: Session, tenant_id: str, budget_id: str, data: SalesBudgetUpdate) -> Optional[SalesBudget]:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        return None
    if budget.status != "RASCUNHO":
        raise ValueError("Orçamento aprovado/arquivado não pode ser editado.")

    budget.customer_id = data.customer_id
    budget.titulo = data.titulo
    budget.observacoes = data.observacoes
    budget.data_orcamento = data.data_orcamento
    budget.markup_padrao = data.markup_padrao
    budget.perc_despesa_adm = data.perc_despesa_adm
    budget.perc_comissao = data.perc_comissao
    budget.perc_frete_venda = data.perc_frete_venda
    budget.perc_pis = data.perc_pis
    budget.perc_cofins = data.perc_cofins
    budget.perc_csll = data.perc_csll
    budget.perc_irpj = data.perc_irpj
    budget.perc_iss = data.perc_iss
    budget.perc_icms_interno = data.perc_icms_interno
    budget.perc_icms_externo = data.perc_icms_externo

    # Update responsaveis
    db.query(SalesBudgetResponsavel).filter(SalesBudgetResponsavel.budget_id == budget.id).delete()
    for uid in data.responsavel_ids:
        db.add(SalesBudgetResponsavel(budget_id=budget.id, user_id=uid))

    # Delete old items and recalculate
    db.query(SalesBudgetItem).filter(SalesBudgetItem.budget_id == budget.id).delete()

    company = db.query(Company).filter(Company.id == budget.company_id).first()
    company_uf = company.state_id if company else ""
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    customer_uf = customer.state_id if customer else ""
    defaults = _build_defaults(budget)

    for item_data in data.items:
        product = None
        if item_data.product_id:
            product = db.query(Product).filter(Product.id == item_data.product_id).first()

        has_st = False
        if product and item_data.tipo_item == "MERCADORIA":
            has_st = item_data.tem_st or check_st_flag(db, product.ncm_codigo, company_uf)

        if item_data.usa_parametros_padrao or item_data.perc_icms is None:
            if company_uf == customer_uf:
                defaults["perc_icms_interno"] = budget.perc_icms_interno
            else:
                defaults["perc_icms_interno"] = budget.perc_icms_externo

        calc = calculate_item(item_data, defaults, product, has_st)

        db_item = SalesBudgetItem(
            budget_id=budget.id,
            product_id=item_data.product_id,
            tipo_item=item_data.tipo_item,
            descricao_servico=item_data.descricao_servico,
            usa_parametros_padrao=item_data.usa_parametros_padrao,
            **calc
        )
        db.add(db_item)

    db.commit()
    db.refresh(budget)
    return budget


def update_status(db: Session, tenant_id: str, budget_id: str, new_status: str) -> Optional[SalesBudget]:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        return None
    budget.status = new_status
    db.commit()
    db.refresh(budget)
    return budget


def duplicate_budget(db: Session, tenant_id: str, budget_id: str) -> Optional[SalesBudget]:
    original = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not original:
        return None

    new_budget = SalesBudget(
        tenant_id=original.tenant_id,
        company_id=original.company_id,
        customer_id=original.customer_id,
        numero_orcamento=get_next_numero(db, tenant_id),
        titulo=f"{original.titulo} (Cópia)",
        observacoes=original.observacoes,
        data_orcamento=original.data_orcamento,
        status="RASCUNHO",
        markup_padrao=original.markup_padrao,
        perc_despesa_adm=original.perc_despesa_adm,
        perc_comissao=original.perc_comissao,
        perc_frete_venda=original.perc_frete_venda,
        perc_pis=original.perc_pis,
        perc_cofins=original.perc_cofins,
        perc_csll=original.perc_csll,
        perc_irpj=original.perc_irpj,
        perc_iss=original.perc_iss,
        perc_icms_interno=original.perc_icms_interno,
        perc_icms_externo=original.perc_icms_externo,
    )
    db.add(new_budget)
    db.flush()

    for resp in original.responsaveis:
        db.add(SalesBudgetResponsavel(budget_id=new_budget.id, user_id=resp.user_id))

    for item in original.items:
        new_item = SalesBudgetItem(
            budget_id=new_budget.id,
            product_id=item.product_id,
            tipo_item=item.tipo_item,
            descricao_servico=item.descricao_servico,
            usa_parametros_padrao=item.usa_parametros_padrao,
            custo_unit_base=item.custo_unit_base,
            markup=item.markup,
            venda_unit=item.venda_unit,
            perc_frete_venda=item.perc_frete_venda,
            frete_venda_unit=item.frete_venda_unit,
            perc_pis=item.perc_pis, pis_unit=item.pis_unit,
            perc_cofins=item.perc_cofins, cofins_unit=item.cofins_unit,
            perc_csll=item.perc_csll, csll_unit=item.csll_unit,
            perc_irpj=item.perc_irpj, irpj_unit=item.irpj_unit,
            perc_icms=item.perc_icms, icms_unit=item.icms_unit,
            tem_st=item.tem_st,
            perc_iss=item.perc_iss, iss_unit=item.iss_unit,
            perc_despesa_adm=item.perc_despesa_adm, despesa_adm_unit=item.despesa_adm_unit,
            perc_comissao=item.perc_comissao, comissao_unit=item.comissao_unit,
            lucro_unit=item.lucro_unit,
            margem_unit=item.margem_unit,
            quantidade=item.quantidade,
            total_venda=item.total_venda,
        )
        db.add(new_item)

    db.commit()
    db.refresh(new_budget)
    return new_budget


def list_budgets(db: Session, tenant_id: str) -> list:
    return db.query(SalesBudget).filter(
        SalesBudget.tenant_id == tenant_id
    ).order_by(SalesBudget.created_at.desc()).all()


def get_budget(db: Session, tenant_id: str, budget_id: str) -> Optional[SalesBudget]:
    return db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
