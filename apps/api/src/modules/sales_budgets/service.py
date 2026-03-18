from sqlalchemy.orm import Session
from sqlalchemy import func, literal_column
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List
from uuid import UUID
import re

from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem, SalesBudgetResponsavel, RentalBudgetItem
from src.modules.sales_budgets.schemas import SalesBudgetCreate, SalesBudgetUpdate, SalesBudgetItemCreate, RentalBudgetItemCreate
from src.modules.products.models import Product
from src.modules.companies.models import Company, CompanySalesParameter
from src.modules.customers.models import Customer
from src.modules.ncm_st.models import NcmStHeader, NcmStItem


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


def check_st_flag(db: Session, tenant_id: str, ncm_codigo: Optional[str], company_uf: str) -> bool:
    """Check if product has active ST rule via NcmStHeader/NcmStItem."""
    if not ncm_codigo or len(ncm_codigo) < 4:
        return False
    ncm_clean = re.sub(r'[^0-9]', '', ncm_codigo)
    if len(ncm_clean) < 4:
        return False
    match = db.query(NcmStItem).join(NcmStHeader).filter(
        NcmStHeader.tenant_id == tenant_id,
        NcmStHeader.state_id == company_uf,
        NcmStHeader.is_active == True,
        NcmStItem.is_active == True,
        func.length(NcmStItem.ncm_normalizado) >= 4,
        literal_column(f"'{ncm_clean}'").like(NcmStItem.ncm_normalizado + '%')
    ).first()
    return match is not None


# ═══════════════════════════════════════════════════════════════════
# SALE ITEM CALCULATION
# ═══════════════════════════════════════════════════════════════════

def calculate_item(
    item_data: SalesBudgetItemCreate,
    budget_defaults: dict,
    product: Optional[Product],
    has_st: bool
) -> dict:
    """Calculate all fields for a single sales budget item."""
    is_service = item_data.tipo_item in ("SERVICO_INSTALACAO", "SERVICO_MANUTENCAO")
    use_defaults = item_data.usa_parametros_padrao

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

    custo = _d(item_data.custo_unit_base)
    if not is_service and product and custo == 0:
        custo = _d(product.vlr_referencia_revenda)

    venda = _round(custo * markup)
    frete_unit = _round(venda * perc_frete / 100) if not is_service else Decimal("0")

    if is_service:
        pis_u = cofins_u = csll_u = irpj_u = icms_u = Decimal("0")
        iss_u = _round(venda * perc_iss / 100)
        impostos_total = iss_u
        actual_st = False
    else:
        pis_u = _round(venda * perc_pis / 100)
        cofins_u = _round(venda * perc_cofins / 100)
        csll_u = _round(venda * perc_csll / 100)
        irpj_u = _round(venda * perc_irpj / 100)
        icms_u = Decimal("0") if has_st else _round(venda * perc_icms / 100)
        iss_u = Decimal("0")
        impostos_total = pis_u + cofins_u + csll_u + irpj_u + icms_u
        actual_st = has_st

    desp_u = _round(venda * perc_desp / 100)
    com_u = _round(venda * perc_com / 100)
    lucro = venda - custo - frete_unit - impostos_total - desp_u - com_u
    margem = _round(lucro / venda * 100, 4) if venda > 0 else Decimal("0")
    qty = _d(item_data.quantidade)
    total = _round(venda * qty)

    return {
        "custo_unit_base": custo, "markup": markup, "venda_unit": venda,
        "perc_frete_venda": perc_frete, "frete_venda_unit": frete_unit,
        "perc_pis": perc_pis, "pis_unit": pis_u,
        "perc_cofins": perc_cofins, "cofins_unit": cofins_u,
        "perc_csll": perc_csll, "csll_unit": csll_u,
        "perc_irpj": perc_irpj, "irpj_unit": irpj_u,
        "perc_icms": perc_icms, "icms_unit": icms_u,
        "tem_st": actual_st,
        "perc_iss": perc_iss, "iss_unit": iss_u,
        "perc_despesa_adm": perc_desp, "despesa_adm_unit": desp_u,
        "perc_comissao": perc_com, "comissao_unit": com_u,
        "lucro_unit": lucro, "margem_unit": margem,
        "quantidade": qty, "total_venda": total,
    }


# ═══════════════════════════════════════════════════════════════════
# RENTAL ITEM CALCULATION (Locação / Comodato)
# ═══════════════════════════════════════════════════════════════════

def calculate_rental_item(item_data: RentalBudgetItemCreate, rental_defaults: dict) -> dict:
    """Calculate all fields for a rental/comodato budget item.

    Calculation steps:
    1. Custo total de aquisição = base + IPI + frete + ICMS-ST + DIFAL
    2. Depreciação mensal = custo_total / prazo_contrato
    3. Manutenção mensal = custo_total × taxa_manut_anual / 12
    4. Custo total mensal = depreciação + manutenção
    5. Valor venda equipamento = custo_total × fator_margem
    6. Parcela locação (tabela Price) = V × i / (1 - (1+i)^-n)
    7. Manutenção locação = V × taxa_manut / 12
    8. Valor mensal = parcela + manutenção_locação
    9. Impostos sobre receita
    10. Receita líquida = valor_mensal - impostos
    11. Comissão
    12. Lucro = receita_líquida - custo_total_mensal - comissão
    """
    # Acquisition costs
    base = _d(item_data.custo_aquisicao_unit)
    ipi = _d(item_data.ipi_unit)
    frete = _d(item_data.frete_unit)
    icms_st = _d(item_data.icms_st_unit)
    difal = _d(item_data.difal_unit)
    custo_total_aquisicao = base + ipi + frete + icms_st + difal

    # Contract terms
    prazo = item_data.prazo_contrato or rental_defaults.get("prazo_contrato_meses", 36)
    if prazo <= 0:
        prazo = 36

    # Maintenance rate
    if item_data.usa_taxa_manut_padrao or item_data.taxa_manutencao_anual_item is None:
        taxa_manut = _d(rental_defaults.get("taxa_manutencao_anual", 5))
    else:
        taxa_manut = _d(item_data.taxa_manutencao_anual_item)

    # Depreciation
    depreciacao_mensal = _round(custo_total_aquisicao / prazo)

    # Maintenance cost
    custo_manut_mensal = _round(custo_total_aquisicao * taxa_manut / Decimal("100") / Decimal("12"))

    # Total monthly cost
    custo_total_mensal = depreciacao_mensal + custo_manut_mensal

    # Revenue calculation
    fator_margem = _d(item_data.fator_margem) if item_data.fator_margem else Decimal("1")
    valor_venda_equipamento = _round(custo_total_aquisicao * fator_margem)

    # Price formula: P = V × i / (1 - (1+i)^-n)
    taxa_juros = _d(rental_defaults.get("taxa_juros_mensal", 0)) / Decimal("100")
    if taxa_juros > 0 and prazo > 0:
        one_plus_i = Decimal("1") + taxa_juros
        parcela_locacao = _round(valor_venda_equipamento * taxa_juros / (Decimal("1") - one_plus_i ** (-prazo)))
    else:
        # No interest: simple division
        parcela_locacao = _round(valor_venda_equipamento / prazo) if prazo > 0 else Decimal("0")

    # Rental maintenance = equipment value × annual rate / 12
    manutencao_locacao = _round(valor_venda_equipamento * taxa_manut / Decimal("100") / Decimal("12"))

    # Monthly revenue
    valor_mensal = parcela_locacao + manutencao_locacao

    # Taxes on revenue
    perc_pis = _d(rental_defaults.get("perc_pis_rental", 0))
    perc_cofins = _d(rental_defaults.get("perc_cofins_rental", 0))
    perc_csll = _d(rental_defaults.get("perc_csll_rental", 0))
    perc_irpj = _d(rental_defaults.get("perc_irpj_rental", 0))
    perc_iss = _d(rental_defaults.get("perc_iss_rental", 0))
    perc_impostos_total = perc_pis + perc_cofins + perc_csll + perc_irpj + perc_iss
    impostos_mensal = _round(valor_mensal * perc_impostos_total / Decimal("100"))

    # Net revenue
    receita_liquida_mensal = valor_mensal - impostos_mensal

    # Commission
    perc_comissao = _d(rental_defaults.get("perc_comissao_rental", 0))
    comissao_mensal = _round(receita_liquida_mensal * perc_comissao / Decimal("100"))

    # Profit
    lucro_mensal = receita_liquida_mensal - custo_total_mensal - comissao_mensal
    margem = _round(lucro_mensal / valor_mensal * Decimal("100"), 4) if valor_mensal > 0 else Decimal("0")

    return {
        "custo_aquisicao_unit": base, "ipi_unit": ipi, "frete_unit": frete,
        "icms_st_unit": icms_st, "difal_unit": difal,
        "custo_total_aquisicao": custo_total_aquisicao,
        "prazo_contrato": prazo,
        "usa_taxa_manut_padrao": item_data.usa_taxa_manut_padrao,
        "taxa_manutencao_anual_item": item_data.taxa_manutencao_anual_item,
        "depreciacao_mensal": depreciacao_mensal,
        "custo_manut_mensal": custo_manut_mensal,
        "custo_total_mensal": custo_total_mensal,
        "fator_margem": fator_margem,
        "valor_venda_equipamento": valor_venda_equipamento,
        "parcela_locacao": parcela_locacao,
        "manutencao_locacao": manutencao_locacao,
        "valor_mensal": valor_mensal,
        "perc_impostos_total": perc_impostos_total,
        "impostos_mensal": impostos_mensal,
        "receita_liquida_mensal": receita_liquida_mensal,
        "perc_comissao": perc_comissao,
        "comissao_mensal": comissao_mensal,
        "lucro_mensal": lucro_mensal,
        "margem": margem,
        "quantidade": _d(item_data.quantidade),
    }


# ═══════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════

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


def _build_rental_defaults(budget: SalesBudget) -> dict:
    return {
        "prazo_contrato_meses": budget.prazo_contrato_meses,
        "prazo_instalacao_meses": budget.prazo_instalacao_meses,
        "taxa_juros_mensal": budget.taxa_juros_mensal,
        "taxa_manutencao_anual": budget.taxa_manutencao_anual,
        "fator_margem_padrao": budget.fator_margem_padrao,
        "perc_instalacao_padrao": budget.perc_instalacao_padrao,
        "perc_comissao_rental": budget.perc_comissao_rental,
        "perc_pis_rental": budget.perc_pis_rental,
        "perc_cofins_rental": budget.perc_cofins_rental,
        "perc_csll_rental": budget.perc_csll_rental,
        "perc_irpj_rental": budget.perc_irpj_rental,
        "perc_iss_rental": budget.perc_iss_rental,
    }


def _process_sale_items(db, budget, data_items, tenant_id, company_uf, customer_uf, defaults):
    """Process and save sale items for a budget."""
    for item_data in data_items:
        product = None
        if item_data.product_id:
            product = db.query(Product).filter(Product.id == item_data.product_id).first()

        has_st = False
        if product and item_data.tipo_item == "MERCADORIA":
            has_st = item_data.tem_st or check_st_flag(db, tenant_id, product.ncm_codigo, company_uf)

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


def _process_rental_items(db, budget, data_items, rental_defaults):
    """Process and save rental items for a budget."""
    for item_data in data_items:
        calc = calculate_rental_item(item_data, rental_defaults)
        db_item = RentalBudgetItem(
            budget_id=budget.id,
            product_id=item_data.product_id,
            opportunity_kit_id=getattr(item_data, "opportunity_kit_id", None),
            custo_op_mensal_kit=getattr(item_data, "custo_op_mensal_kit", None),
            is_kit_instalacao=getattr(item_data, "is_kit_instalacao", False),
            kit_custo_produtos=getattr(item_data, "kit_custo_produtos", None),
            kit_custo_servicos=getattr(item_data, "kit_custo_servicos", None),
            kit_pis=getattr(item_data, "kit_pis", None),
            kit_cofins=getattr(item_data, "kit_cofins", None),
            kit_csll=getattr(item_data, "kit_csll", None),
            kit_irpj=getattr(item_data, "kit_irpj", None),
            kit_iss=getattr(item_data, "kit_iss", None),
            **calc
        )
        db.add(db_item)


# ═══════════════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════════════

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
        # Sale defaults
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
        # Rental defaults
        prazo_contrato_meses=data.prazo_contrato_meses,
        prazo_instalacao_meses=data.prazo_instalacao_meses,
        taxa_juros_mensal=data.taxa_juros_mensal,
        taxa_manutencao_anual=data.taxa_manutencao_anual,
        fator_margem_padrao=data.fator_margem_padrao,
        perc_instalacao_padrao=data.perc_instalacao_padrao,
        perc_comissao_rental=data.perc_comissao_rental,
        perc_pis_rental=data.perc_pis_rental,
        perc_cofins_rental=data.perc_cofins_rental,
        perc_csll_rental=data.perc_csll_rental,
        perc_irpj_rental=data.perc_irpj_rental,
        perc_iss_rental=data.perc_iss_rental,
    )
    db.add(budget)
    db.flush()

    # Responsaveis
    for uid in data.responsavel_ids:
        db.add(SalesBudgetResponsavel(budget_id=budget.id, user_id=uid))

    # Sale items
    company = db.query(Company).filter(Company.id == company_id).first()
    company_uf = company.state_id if company else ""
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    customer_uf = customer.state_id if customer else ""
    defaults = _build_defaults(budget)

    _process_sale_items(db, budget, data.items, tenant_id, company_uf, customer_uf, defaults)

    # Rental items
    rental_defaults = _build_rental_defaults(budget)
    _process_rental_items(db, budget, data.rental_items, rental_defaults)

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

    # Update header + sale defaults
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

    # Update rental defaults
    budget.prazo_contrato_meses = data.prazo_contrato_meses
    budget.prazo_instalacao_meses = data.prazo_instalacao_meses
    budget.taxa_juros_mensal = data.taxa_juros_mensal
    budget.taxa_manutencao_anual = data.taxa_manutencao_anual
    budget.fator_margem_padrao = data.fator_margem_padrao
    budget.perc_instalacao_padrao = data.perc_instalacao_padrao
    budget.perc_comissao_rental = data.perc_comissao_rental
    budget.perc_pis_rental = data.perc_pis_rental
    budget.perc_cofins_rental = data.perc_cofins_rental
    budget.perc_csll_rental = data.perc_csll_rental
    budget.perc_irpj_rental = data.perc_irpj_rental
    budget.perc_iss_rental = data.perc_iss_rental

    # Update responsaveis
    db.query(SalesBudgetResponsavel).filter(SalesBudgetResponsavel.budget_id == budget.id).delete()
    for uid in data.responsavel_ids:
        db.add(SalesBudgetResponsavel(budget_id=budget.id, user_id=uid))

    # Delete old items and recalculate
    db.query(SalesBudgetItem).filter(SalesBudgetItem.budget_id == budget.id).delete()
    db.query(RentalBudgetItem).filter(RentalBudgetItem.budget_id == budget.id).delete()

    company = db.query(Company).filter(Company.id == budget.company_id).first()
    company_uf = company.state_id if company else ""
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    customer_uf = customer.state_id if customer else ""
    defaults = _build_defaults(budget)

    _process_sale_items(db, budget, data.items, budget.tenant_id, company_uf, customer_uf, defaults)

    rental_defaults = _build_rental_defaults(budget)
    _process_rental_items(db, budget, data.rental_items, rental_defaults)

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
        # Sale defaults
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
        # Rental defaults
        prazo_contrato_meses=original.prazo_contrato_meses,
        prazo_instalacao_meses=original.prazo_instalacao_meses,
        taxa_juros_mensal=original.taxa_juros_mensal,
        taxa_manutencao_anual=original.taxa_manutencao_anual,
        fator_margem_padrao=original.fator_margem_padrao,
        perc_instalacao_padrao=original.perc_instalacao_padrao,
        perc_comissao_rental=original.perc_comissao_rental,
        perc_pis_rental=original.perc_pis_rental,
        perc_cofins_rental=original.perc_cofins_rental,
        perc_csll_rental=original.perc_csll_rental,
        perc_irpj_rental=original.perc_irpj_rental,
        perc_iss_rental=original.perc_iss_rental,
    )
    db.add(new_budget)
    db.flush()

    for resp in original.responsaveis:
        db.add(SalesBudgetResponsavel(budget_id=new_budget.id, user_id=resp.user_id))

    # Copy sale items
    for item in original.items:
        new_item = SalesBudgetItem(
            budget_id=new_budget.id,
            product_id=item.product_id,
            tipo_item=item.tipo_item,
            descricao_servico=item.descricao_servico,
            usa_parametros_padrao=item.usa_parametros_padrao,
            custo_unit_base=item.custo_unit_base,
            markup=item.markup, venda_unit=item.venda_unit,
            perc_frete_venda=item.perc_frete_venda, frete_venda_unit=item.frete_venda_unit,
            perc_pis=item.perc_pis, pis_unit=item.pis_unit,
            perc_cofins=item.perc_cofins, cofins_unit=item.cofins_unit,
            perc_csll=item.perc_csll, csll_unit=item.csll_unit,
            perc_irpj=item.perc_irpj, irpj_unit=item.irpj_unit,
            perc_icms=item.perc_icms, icms_unit=item.icms_unit,
            tem_st=item.tem_st,
            perc_iss=item.perc_iss, iss_unit=item.iss_unit,
            perc_despesa_adm=item.perc_despesa_adm, despesa_adm_unit=item.despesa_adm_unit,
            perc_comissao=item.perc_comissao, comissao_unit=item.comissao_unit,
            lucro_unit=item.lucro_unit, margem_unit=item.margem_unit,
            quantidade=item.quantidade, total_venda=item.total_venda,
        )
        db.add(new_item)

    # Copy rental items
    for ri in original.rental_items:
        new_ri = RentalBudgetItem(
            budget_id=new_budget.id,
            product_id=ri.product_id,
            opportunity_kit_id=ri.opportunity_kit_id,
            custo_op_mensal_kit=ri.custo_op_mensal_kit,
            is_kit_instalacao=ri.is_kit_instalacao,
            kit_custo_produtos=ri.kit_custo_produtos,
            kit_custo_servicos=ri.kit_custo_servicos,
            kit_pis=ri.kit_pis,
            kit_cofins=ri.kit_cofins,
            kit_csll=ri.kit_csll,
            kit_irpj=ri.kit_irpj,
            kit_iss=ri.kit_iss,
            quantidade=ri.quantidade,
            custo_aquisicao_unit=ri.custo_aquisicao_unit,
            ipi_unit=ri.ipi_unit, frete_unit=ri.frete_unit,
            icms_st_unit=ri.icms_st_unit, difal_unit=ri.difal_unit,
            custo_total_aquisicao=ri.custo_total_aquisicao,
            prazo_contrato=ri.prazo_contrato,
            usa_taxa_manut_padrao=ri.usa_taxa_manut_padrao,
            taxa_manutencao_anual_item=ri.taxa_manutencao_anual_item,
            depreciacao_mensal=ri.depreciacao_mensal,
            custo_manut_mensal=ri.custo_manut_mensal,
            custo_total_mensal=ri.custo_total_mensal,
            fator_margem=ri.fator_margem,
            valor_venda_equipamento=ri.valor_venda_equipamento,
            parcela_locacao=ri.parcela_locacao,
            manutencao_locacao=ri.manutencao_locacao,
            valor_mensal=ri.valor_mensal,
            perc_impostos_total=ri.perc_impostos_total,
            impostos_mensal=ri.impostos_mensal,
            receita_liquida_mensal=ri.receita_liquida_mensal,
            perc_comissao=ri.perc_comissao,
            comissao_mensal=ri.comissao_mensal,
            lucro_mensal=ri.lucro_mensal,
            margem=ri.margem,
        )
        db.add(new_ri)

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
