from sqlalchemy.orm import Session
from sqlalchemy import func, literal_column
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
import uuid
import re
import logging

from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem, SalesBudgetResponsavel, RentalBudgetItem
from src.modules.sales_budgets.schemas import SalesBudgetCreate, SalesBudgetUpdate, SalesBudgetItemCreate, RentalBudgetItemCreate, SalesBudgetHeaderUpdate
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


def get_next_numero(db: Session, tenant_id: str, company_id: str) -> str:
    """Generate next sequential budget number [NOMENCLATURA]-[NUM]/[ANO]."""
    from datetime import datetime
    ano_vigente = datetime.now().year
    
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        return f"OV-001/{ano_vigente}"
        
    nom = company.nomenclatura_orcamento or "OV"
    num = company.numero_proposta or 1
    
    company.numero_proposta = num + 1
    db.add(company)
    
    return f"{nom}-{num:03d}/{ano_vigente}"


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
    has_st: bool,
    is_same_cnpj: bool = False
) -> dict:
    """Calculate all fields for a single sales budget item."""
    is_service = item_data.tipo_item in ("SERVICO_INSTALACAO", "SERVICO_MANUTENCAO")
    use_defaults = item_data.usa_parametros_padrao

    def resolve(item_val, default_key):
        if not use_defaults and item_val is not None:
            return _d(item_val)
        return _d(budget_defaults.get(default_key, 0))

    if is_same_cnpj and not is_service:
        perc_frete = Decimal("0")
        perc_pis = Decimal("0")
        perc_cofins = Decimal("0")
        perc_csll = Decimal("0")
        perc_irpj = Decimal("0")
        perc_iss = Decimal("0")
        perc_desp = Decimal("0")
        perc_com = Decimal("0")
        perc_icms = Decimal("0")
        markup = _d(item_data.markup) if item_data.markup else Decimal("1.0")
    else:
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
    if is_same_cnpj and not is_service and getattr(item_data, "venda_unit", None) is not None:
        venda = _d(item_data.venda_unit)
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

    # Pass through the ICMS credit abatement value from the frontend
    icms_abatido = _d(getattr(item_data, 'icms_abatido_unit', 0) or 0)
    
    # Apply ICMS credit to profit
    lucro = lucro + icms_abatido
    margem = _round(lucro / venda * 100, 4) if venda > 0 else Decimal("0")

    return {
        "custo_unit_base": custo, "markup": markup, "venda_unit": venda,
        "perc_frete_venda": perc_frete, "frete_venda_unit": frete_unit,
        "perc_pis": perc_pis, "pis_unit": pis_u,
        "perc_cofins": perc_cofins, "cofins_unit": cofins_u,
        "perc_csll": perc_csll, "csll_unit": csll_u,
        "perc_irpj": perc_irpj, "irpj_unit": irpj_u,
        "perc_icms": perc_icms, "icms_unit": icms_u,
        "tem_st": actual_st,
        "icms_abatido_unit": icms_abatido,
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
    is_kit = bool(getattr(item_data, "opportunity_kit_id", None))
    is_instalacao = bool(getattr(item_data, "is_kit_instalacao", False))
    
    # If it's a kit, uses its own tipo_contrato to define if it's Comodato
    tipo_contrato_kit = getattr(item_data, "tipo_contrato_kit", None)
    is_instalacao = bool(getattr(item_data, "is_kit_instalacao", False)) or tipo_contrato_kit == "INSTALACAO"
    
    if is_kit and tipo_contrato_kit:
        is_comodato = tipo_contrato_kit == "COMODATO"
    else:
        is_comodato = rental_defaults.get("tipo_receita_rental", "") == "COMODATO"

    if is_instalacao:
        prazo = 1
    else:
        prazo = item_data.prazo_contrato or rental_defaults.get("prazo_contrato_meses", 36)
        if prazo <= 0:
            prazo = 36

    if is_kit:
        custo_aquisicao_unit = _d(item_data.custo_aquisicao_unit)
        custo_op_mensal_unit = _d(getattr(item_data, "custo_op_mensal_kit", 0))
        
        manutencao_mensal_unit = Decimal("0")
        if not is_instalacao:
            taxa_manut = _d(rental_defaults.get("taxa_manutencao_anual", 0)) if item_data.usa_taxa_manut_padrao else _d(item_data.taxa_manutencao_anual_item or 0)
            manutencao_mensal_unit = _round(custo_aquisicao_unit * (taxa_manut / Decimal("100")) / Decimal("12"))
            
        custo_manut_mensal_unit = manutencao_mensal_unit + custo_op_mensal_unit
        
        fm = _d(item_data.fator_margem) if item_data.fator_margem else Decimal("1")
        valor_base_venda_unit = _round(custo_aquisicao_unit * fm)
        
        kit_taxa_juros = getattr(item_data, "kit_taxa_juros_mensal", None)
        if kit_taxa_juros is not None:
            taxa = _d(kit_taxa_juros) / Decimal("100")
        else:
            taxa = _d(rental_defaults.get("taxa_juros_mensal", 0)) / Decimal("100")
            
        prazo_mensalidades = prazo - int(rental_defaults.get("prazo_instalacao_meses", 0))
        if prazo_mensalidades < 0: prazo_mensalidades = 0
        
        tx_locacao = Decimal("0")
        if is_instalacao:
            tx_locacao = Decimal("1")
        elif prazo_mensalidades > 0 and taxa > 0:
            tx_locacao = taxa / (Decimal("1") - (Decimal("1") + taxa) ** -prazo_mensalidades)
        elif prazo_mensalidades > 0 and taxa == Decimal("0"):
            tx_locacao = Decimal("1") / Decimal(prazo_mensalidades)
            
        parcela_locacao_unit = _round(valor_base_venda_unit * tx_locacao)
        
        # --- EXACT OVERRIDES FOR PARCELA LOCACAO (Prevents recalculation when prazo changes) ---
        if getattr(item_data, "kit_parcela_locacao", None) is not None:
            parcela_locacao_unit = _d(item_data.kit_parcela_locacao)

        valor_base_final_unit = parcela_locacao_unit + manutencao_mensal_unit + custo_op_mensal_unit

        p_imp = Decimal("0")
        if getattr(item_data, "kit_pis", None) is not None:
            p_imp = _d(item_data.kit_pis) + _d(getattr(item_data, "kit_cofins", 0)) + _d(getattr(item_data, "kit_csll", 0)) + _d(getattr(item_data, "kit_irpj", 0)) + _d(getattr(item_data, "kit_iss", 0))
        else:
            p_imp = _d(rental_defaults.get("perc_pis_rental", 0)) + _d(rental_defaults.get("perc_cofins_rental", 0)) + _d(rental_defaults.get("perc_csll_rental", 0)) + _d(rental_defaults.get("perc_irpj_rental", 0))
            if is_comodato: p_imp += _d(rental_defaults.get("perc_iss_rental", 0))

        if is_instalacao:
            valor_mensal_unit = valor_base_final_unit
            impostos_unit = _round(valor_mensal_unit * (p_imp / Decimal("100")))
        else:
            impostos_unit = _round(valor_base_final_unit * (p_imp / Decimal("100")))
            valor_mensal_unit = valor_base_final_unit + impostos_unit
            
        rec_liq_unit = valor_mensal_unit - impostos_unit
        depreciacao_unit = _round(custo_aquisicao_unit / prazo) if (not is_instalacao and prazo > 0) else Decimal("0")
        custo_total_mensal_unit = depreciacao_unit + custo_manut_mensal_unit

        p_com = Decimal("0")
        com_val = Decimal("0")
        if getattr(item_data, "kit_perc_comissao", None) is not None:
            p_com = _d(item_data.kit_perc_comissao)
        if getattr(item_data, "kit_comissao", None) is not None:
            com_val = _d(item_data.kit_comissao)

        if is_instalacao and com_val == Decimal("0") and p_com > Decimal("0"):
            com_val = _round(valor_mensal_unit * (p_com / Decimal("100")))

        # --- EXACT OVERRIDES ---
        if getattr(item_data, "kit_vlt_manut", None) is not None:
            manutencao_mensal_unit = _d(item_data.kit_vlt_manut)
            custo_manut_mensal_unit = manutencao_mensal_unit + custo_op_mensal_unit
            custo_total_mensal_unit = depreciacao_unit + custo_manut_mensal_unit
            
        if getattr(item_data, "kit_valor_mensal", None) is not None:
            valor_mensal_unit = _d(item_data.kit_valor_mensal)
            
        if getattr(item_data, "kit_valor_impostos", None) is not None:
            impostos_unit = _d(item_data.kit_valor_impostos)
            
        if getattr(item_data, "kit_receita_liquida", None) is not None:
            rec_liq_unit = _d(item_data.kit_receita_liquida)

        # Recalculate com_val if valor_mensal_unit changed due to overrides
        if is_instalacao and com_val == Decimal("0") and p_com > Decimal("0"):
            com_val = _round(valor_mensal_unit * (p_com / Decimal("100")))

        # Recalculate profit using final overridden values
        if is_instalacao:
            perc_desp = _d(rental_defaults.get("perc_despesa_adm", 0))
            desp_u = _round(valor_mensal_unit * (perc_desp / Decimal("100")))
            lucro_mensal_unit = rec_liq_unit - custo_aquisicao_unit - custo_op_mensal_unit - com_val - desp_u
        else:
            lucro_mensal_unit = rec_liq_unit - custo_total_mensal_unit

        if getattr(item_data, "kit_lucro_mensal", None) is not None:
            lucro_mensal_unit = _d(item_data.kit_lucro_mensal)

        margem = Decimal("0")
        if getattr(item_data, "kit_margem", None) is not None:
            margem = _d(item_data.kit_margem)
        elif is_comodato:
            lucro_mensal_unit = Decimal("0")
        else:
            if rec_liq_unit > 0:
                margem = _round((lucro_mensal_unit / valor_mensal_unit) * 100, 2) if is_instalacao else _round((lucro_mensal_unit / rec_liq_unit) * 100, 2)

        return {
            "custo_aquisicao_unit": custo_aquisicao_unit,
            "custo_total_aquisicao": custo_aquisicao_unit,
            "prazo_contrato": prazo,
            "custo_manut_mensal": custo_manut_mensal_unit,
            "custo_total_mensal": custo_total_mensal_unit,
            "fator_margem": fm,
            "valor_venda_equipamento": valor_base_venda_unit,
            "parcela_locacao": parcela_locacao_unit,
            "manutencao_locacao": manutencao_mensal_unit,
            "valor_mensal": valor_mensal_unit,
            "perc_impostos_total": p_imp,
            "impostos_mensal": impostos_unit,
            "receita_liquida_mensal": rec_liq_unit,
            "perc_comissao": p_com,
            "comissao_mensal": com_val,
            "lucro_mensal": lucro_mensal_unit,
            "margem": margem,
            "quantidade": _d(item_data.quantidade),
        }

    # Non-Kit Logic
    base = _d(item_data.custo_aquisicao_unit)
    ipi = _d(item_data.ipi_unit)
    frete = _d(item_data.frete_unit)
    icms_st = _d(item_data.icms_st_unit)
    difal = _d(item_data.difal_unit)
    
    instalacao = Decimal("0")
    if getattr(item_data, "valor_instalacao_item", None) is not None:
        instalacao = _d(item_data.valor_instalacao_item)
    else:
        p_instal = _d(item_data.perc_instalacao_item) if getattr(item_data, "perc_instalacao_item", None) is not None else _d(rental_defaults.get("perc_instalacao_padrao", 0))
        instalacao = _round((base + ipi + frete + icms_st + difal) * (p_instal / Decimal("100")))
        
    custo_total_aquisicao = base + ipi + frete + icms_st + difal + instalacao
    
    fm = _d(item_data.fator_margem) if item_data.fator_margem else Decimal("1")
    valor_venda_equipamento = _round(custo_total_aquisicao * fm)
    
    taxa_juros = _d(rental_defaults.get("taxa_juros_mensal", 0)) / Decimal("100")
    prazo_mensalidades = prazo - int(rental_defaults.get("prazo_instalacao_meses", 0))
    if prazo_mensalidades < 0: prazo_mensalidades = 0

    parcela_locacao = Decimal("0")
    if prazo_mensalidades > 0 and taxa_juros > 0:
        one_plus_i = Decimal("1") + taxa_juros
        parcela_locacao = _round(valor_venda_equipamento * taxa_juros / (Decimal("1") - (one_plus_i ** -prazo_mensalidades)))
    elif prazo_mensalidades > 0 and taxa_juros == 0:
        parcela_locacao = _round(valor_venda_equipamento / Decimal(prazo_mensalidades))

    taxa_manut = _d(rental_defaults.get("taxa_manutencao_anual", 5)) if item_data.usa_taxa_manut_padrao else _d(item_data.taxa_manutencao_anual_item or 5)
    custo_manut_mensal = _round(custo_total_aquisicao * taxa_manut / Decimal("100") / Decimal("12"))
    
    depreciacao = _round(custo_total_aquisicao / prazo) if (is_comodato and prazo > 0) else Decimal("0")
    custo_total_mensal = custo_manut_mensal + depreciacao
    valor_mensal = parcela_locacao + custo_manut_mensal
    
    p_imp = _d(rental_defaults.get("perc_pis_rental", 0)) + _d(rental_defaults.get("perc_cofins_rental", 0)) + _d(rental_defaults.get("perc_csll_rental", 0)) + _d(rental_defaults.get("perc_irpj_rental", 0))
    if is_comodato: p_imp += _d(rental_defaults.get("perc_iss_rental", 0))
    
    impostos_mensal = _round(valor_mensal * (p_imp / Decimal("100")))
    receita_liquida_mensal = valor_mensal - impostos_mensal
    
    p_com = _d(rental_defaults.get("perc_comissao_rental", 0))
    comissao_mensal = _round(receita_liquida_mensal * (p_com / Decimal("100")))
    
    lucro_mensal = receita_liquida_mensal - custo_total_mensal - comissao_mensal
    margem = _round((lucro_mensal / valor_mensal) * Decimal("100"), 2) if valor_mensal > 0 else Decimal("0")

    if is_comodato:
        lucro_mensal = Decimal("0")
        margem = Decimal("0")

    return {
        "custo_aquisicao_unit": base, "ipi_unit": ipi, "frete_unit": frete,
        "icms_st_unit": icms_st, "difal_unit": difal,
        "instalacao_unit": instalacao,
        "custo_total_aquisicao": custo_total_aquisicao,
        "prazo_contrato": prazo,
        "custo_manut_mensal": custo_manut_mensal,
        "custo_total_mensal": custo_total_mensal,
        "fator_margem": fm,
        "valor_venda_equipamento": valor_venda_equipamento,
        "parcela_locacao": parcela_locacao,
        "manutencao_locacao": custo_manut_mensal,
        "valor_mensal": valor_mensal,
        "perc_impostos_total": p_imp,
        "impostos_mensal": impostos_mensal,
        "receita_liquida_mensal": receita_liquida_mensal,
        "perc_comissao": p_com,
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
        "perc_despesa_adm": budget.perc_despesa_adm,
    }


def _process_sale_items(db, budget, data_items, tenant_id, company_uf, customer_uf, defaults, perfil_st_ativo=True):
    """Process and save sale items for a budget."""
    company = budget.company or db.query(Company).filter(Company.id == budget.company_id).first()
    customer = budget.customer or db.query(Customer).filter(Customer.id == budget.customer_id).first()
    
    is_same_cnpj = False
    if company and customer and company.cnpj and customer.cnpj:
        def clean_cnpj(val):
            return re.sub(r"\D", "", val)
        is_same_cnpj = clean_cnpj(company.cnpj) == clean_cnpj(customer.cnpj)

    for item_data in data_items:
        # If CNPJ is the same and it is equipment sale, override costs and sales value
        if is_same_cnpj and item_data.tipo_item == "MERCADORIA" and item_data.product_id:
            comp = calculate_product_cost_composition(
                db,
                product_id=str(item_data.product_id),
                tenant_id=tenant_id,
                tipo="REVENDA",
                sales_budget_id=budget.id
            )
            if comp:
                base_unitario = comp.get("base_unitario", 0.0)
                ipi_unitario = comp.get("ipi_unitario", 0.0)
                st_unitario = comp.get("icms_st_final", 0.0)
                difal_unitario = comp.get("difal_unitario", 0.0)
                frete_unitario = comp.get("frete_cif_unitario", 0.0)
                
                # Custo base is base_unitario
                item_data.custo_unit_base = Decimal(str(base_unitario))
                
                # Venda unit is base + taxes + freight
                venda_calculada = Decimal(str(base_unitario)) + Decimal(str(ipi_unitario)) + Decimal(str(st_unitario)) + Decimal(str(difal_unitario)) + Decimal(str(frete_unitario))
                item_data.__dict__["venda_unit"] = venda_calculada
                
                # Markup is venda / custo
                if base_unitario > 0:
                    item_data.markup = venda_calculada / Decimal(str(base_unitario))
                else:
                    item_data.markup = Decimal("1.0")

        product = None
        if item_data.product_id:
            product = db.query(Product).filter(Product.id == item_data.product_id).first()

        has_st = False
        if product and item_data.tipo_item == "MERCADORIA":
            has_st = item_data.tem_st or check_st_flag(db, tenant_id, product.ncm_codigo, company_uf)

        # When the company does NOT adhere to ST (perfil_tarifario_st=False),
        # override has_st to False so ICMS is calculated on the sale (17% × venda)
        # instead of being zeroed out. The ICMS credit from the purchase invoice
        # is tracked via icms_abatido_unit.
        if not perfil_st_ativo:
            has_st = False

        if item_data.usa_parametros_padrao or item_data.perc_icms is None:
            if company_uf == customer_uf:
                defaults["perc_icms_interno"] = budget.perc_icms_interno
            else:
                defaults["perc_icms_interno"] = budget.perc_icms_externo

        calc = calculate_item(item_data, defaults, product, has_st, is_same_cnpj=is_same_cnpj)

        db_item = SalesBudgetItem(
            budget_id=budget.id,
            product_id=item_data.product_id,
            opportunity_kit_id=getattr(item_data, "opportunity_kit_id", None),
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
            tipo_contrato_kit=getattr(item_data, "tipo_contrato_kit", None),
            kit_taxa_juros_mensal=getattr(item_data, "kit_taxa_juros_mensal", None),
            kit_custo_produtos=getattr(item_data, "kit_custo_produtos", None),
            kit_custo_servicos=getattr(item_data, "kit_custo_servicos", None),
            kit_pis=getattr(item_data, "kit_pis", None),
            kit_cofins=getattr(item_data, "kit_cofins", None),
            kit_csll=getattr(item_data, "kit_csll", None),
            kit_irpj=getattr(item_data, "kit_irpj", None),
            kit_iss=getattr(item_data, "kit_iss", None),
            # Kit override fields — must be persisted so reload doesn't zero them out
            kit_vlt_manut=getattr(item_data, "kit_vlt_manut", None),
            kit_valor_mensal=getattr(item_data, "kit_valor_mensal", None),
            kit_valor_impostos=getattr(item_data, "kit_valor_impostos", None),
            kit_receita_liquida=getattr(item_data, "kit_receita_liquida", None),
            kit_lucro_mensal=getattr(item_data, "kit_lucro_mensal", None),
            kit_margem=getattr(item_data, "kit_margem", None),
            kit_comissao=getattr(item_data, "kit_comissao", None),
            kit_perc_comissao=getattr(item_data, "kit_perc_comissao", None),
            kit_despesas_adm=getattr(item_data, "kit_despesas_adm", None),
            kit_perc_despesas_adm=getattr(item_data, "kit_perc_despesas_adm", None),
            kit_faturamento_separado=getattr(item_data, "kit_faturamento_separado", False),
            kit_investimento_total=getattr(item_data, "kit_investimento_total", None),
            kit_vlr_instal_calc=getattr(item_data, "kit_vlr_instal_calc", None),
            kit_parcela_locacao=getattr(item_data, "kit_parcela_locacao", None),
            kit_venda_unit_monitoramento=getattr(item_data, "kit_venda_unit_monitoramento", None),
            perc_instalacao_item=getattr(item_data, "perc_instalacao_item", None),
            valor_instalacao_item=getattr(item_data, "valor_instalacao_item", None),
            **calc
        )
        db.add(db_item)


# ═══════════════════════════════════════════════════════════════════
# CRUD
# ═══════════════════════════════════════════════════════════════════

def check_user_has_budget_access(db: Session, user_id: str, tenant_id: str, budget: SalesBudget) -> bool:
    # 1. Approvers/admins always have access
    is_approver, _ = check_is_approver(db, user_id, tenant_id, budget.company_id)
    if is_approver:
        return True
    
    # 2. Check if user is in responsaveis
    from src.modules.sales_budgets.models import SalesBudgetResponsavel
    is_responsible = db.query(SalesBudgetResponsavel).filter(
        SalesBudgetResponsavel.budget_id == budget.id,
        SalesBudgetResponsavel.user_id == user_id
    ).first() is not None
    
    return is_responsible


def _sync_missing_product_prices(db: Session, tenant_id: str, sales_budget_id: Optional[UUID], items: list, rental_items: list):
    """
    Collects all product IDs involved in the sales budget (directly or via kits)
    and synchronizes their reference prices from the opportunity purchase budgets
    if they are missing in the catalog.
    """
    from src.modules.purchase_budgets.service import PurchaseBudgetService
    from src.modules.opportunity_kits.models import OpportunityKit
    
    product_ids = set()

    # 1. Collect from direct items
    for item in items:
        prod_id = getattr(item, "product_id", None) or (item.get("product_id") if isinstance(item, dict) else None)
        if prod_id:
            product_ids.add(str(prod_id))

    # 2. Collect from rental items
    for item in rental_items:
        prod_id = getattr(item, "product_id", None) or (item.get("product_id") if isinstance(item, dict) else None)
        if prod_id:
            product_ids.add(str(prod_id))

    # 3. Collect from Opportunity Kits referenced by the items/rental items
    kit_ids = set()
    for item in items:
        kit_id = getattr(item, "opportunity_kit_id", None) or (item.get("opportunity_kit_id") if isinstance(item, dict) else None)
        if kit_id:
            kit_ids.add(str(kit_id))
    for item in rental_items:
        kit_id = getattr(item, "opportunity_kit_id", None) or (item.get("opportunity_kit_id") if isinstance(item, dict) else None)
        if kit_id:
            kit_ids.add(str(kit_id))

    if kit_ids:
        kits = db.query(OpportunityKit).filter(
            OpportunityKit.id.in_(list(kit_ids)),
            OpportunityKit.tenant_id == tenant_id
        ).all()
        for kit in kits:
            for kit_item in kit.items:
                if kit_item.tipo_item == "PRODUTO" and kit_item.product_id:
                    product_ids.add(str(kit_item.product_id))
            for cost in kit.costs:
                if cost.tipo_item == "PRODUTO" and cost.product_id:
                    product_ids.add(str(cost.product_id))

    # 4. Synchronize reference prices for products that have missing values in the catalog
    for pid in product_ids:
        product = db.query(Product).filter(Product.id == pid, Product.tenant_id == tenant_id).first()
        if product:
            # Check if any price is missing
            if product.vlr_referencia_revenda is None or product.vlr_referencia_uso_consumo is None:
                PurchaseBudgetService.sync_product_reference_prices(
                    db,
                    product_id=pid,
                    tenant_id=tenant_id,
                    sales_budget_id=sales_budget_id
                )


def create_budget(db: Session, tenant_id: str, company_id: str, data: SalesBudgetCreate) -> SalesBudget:
    company = db.query(Company).filter(Company.id == company_id).first()
    cp = company.sales_parameters if company else None
    
    # Extract defaults from company if available
    c_pis = cp.pis_venda if cp and cp.pis_venda is not None else data.perc_pis
    c_cofins = cp.cofins_venda if cp and cp.cofins_venda is not None else data.perc_cofins
    c_csll = cp.csll_venda if cp and cp.csll_venda is not None else data.perc_csll
    c_irpj = cp.irpj_venda if cp and cp.irpj_venda is not None else data.perc_irpj
    c_iss = cp.iss_venda if cp and cp.iss_venda is not None else data.perc_iss
    c_icms_int = cp.icms_interno_venda if cp and cp.icms_interno_venda is not None else data.perc_icms_interno
    c_icms_ext = cp.icms_externo_venda if cp and cp.icms_externo_venda is not None else data.perc_icms_externo
    c_frete = cp.frete_venda_padrao if cp and hasattr(cp, 'frete_venda_padrao') and cp.frete_venda_padrao is not None else data.perc_frete_venda
    
    # Locacao fields mapped to default sale values as requested by user
    c_mkp = cp.mkp_padrao_locacao if cp and cp.mkp_padrao_locacao is not None else data.venda_markup_produtos
    c_desp = cp.despesa_administrativa_locacao if cp and cp.despesa_administrativa_locacao is not None else data.perc_despesa_adm
    c_com = cp.comissionamento_locacao if cp and cp.comissionamento_locacao is not None else data.perc_comissao

    budget = SalesBudget(
        tenant_id=tenant_id,
        company_id=company_id,
        customer_id=data.customer_id,
        vendedor_id=data.vendedor_id,
        forma_pagamento_id=data.forma_pagamento_id,
        data_vencimento_inicial=data.data_vencimento_inicial,
        forma_pagamento_snapshot=data.forma_pagamento_snapshot,
        numero_orcamento=get_next_numero(db, tenant_id, company_id),
        titulo=data.titulo,
        observacoes=data.observacoes,
        data_orcamento=data.data_orcamento,
        status="EM_LANCAMENTO",
        # Sale defaults
        markup_padrao=c_mkp,
        perc_despesa_adm=c_desp,
        perc_comissao=c_com,
        perc_frete_venda=c_frete,
        perc_pis=c_pis,
        perc_cofins=c_cofins,
        perc_csll=c_csll,
        perc_irpj=c_irpj,
        perc_iss=c_iss,
        perc_icms_interno=c_icms_int,
        perc_icms_externo=c_icms_ext,
        venda_markup_produtos=c_mkp,
        venda_markup_servicos=c_mkp,
        venda_markup_instalacao=c_mkp,
        venda_markup_manutencao=c_mkp,
        venda_havera_manutencao=data.venda_havera_manutencao,
        venda_qtd_meses_manutencao=data.venda_qtd_meses_manutencao,
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
        perc_comissao_diretoria=data.perc_comissao_diretoria,
    )
    db.add(budget)
    db.flush()

    # Responsaveis
    for uid in data.responsavel_ids:
        db.add(SalesBudgetResponsavel(budget_id=budget.id, user_id=uid))

    # Sale items
    company_uf = company.state_id if company else ""
    customer = db.query(Customer).filter(Customer.id == data.customer_id).first()
    customer_uf = customer.state_id if customer else ""
    defaults = _build_defaults(budget)

    # Determine perfil_tarifario_st for the company
    from src.modules.companies.models import CompanyTaxProfile
    tax_profile = db.query(CompanyTaxProfile).filter(
        CompanyTaxProfile.company_id == company_id
    ).first()
    perfil_st_ativo = True
    if tax_profile and tax_profile.perfil_tarifario_st is False:
        perfil_st_ativo = False

    # Sync missing product reference prices from opportunity purchase budgets
    _sync_missing_product_prices(db, tenant_id, budget.id, data.items, data.rental_items)

    _process_sale_items(db, budget, data.items, tenant_id, company_uf, customer_uf, defaults, perfil_st_ativo)

    # Rental items
    rental_defaults = _build_rental_defaults(budget)
    _process_rental_items(db, budget, data.rental_items, rental_defaults)

    from src.modules.payment_methods.service import PaymentMethodsService
    PaymentMethodsService.sync_sales_budget_planning(db, budget)
    recalculate_budget_total(db, budget)

    db.commit()
    db.refresh(budget)
    return budget


def check_budget_locked(budget: SalesBudget):
    if budget.status in ("GANHO", "PERDIDO"):
        raise ValueError("Status não permite mais edição")


def _only_comissao_diretoria_changed(budget: SalesBudget, data: SalesBudgetUpdate) -> bool:
    def _float(v):
        return float(v) if v is not None else 0.0

    def _str(v):
        return str(v) if v is not None else ""

    if _str(budget.customer_id) != _str(data.customer_id): return False
    if _str(budget.vendedor_id) != _str(data.vendedor_id): return False
    if _str(budget.forma_pagamento_id) != _str(data.forma_pagamento_id): return False
    
    if budget.data_vencimento_inicial and data.data_vencimento_inicial:
        if budget.data_vencimento_inicial.date() != data.data_vencimento_inicial.date():
            return False
    elif budget.data_vencimento_inicial or data.data_vencimento_inicial:
        return False

    if budget.data_orcamento.date() != data.data_orcamento.date():
        return False

    if (budget.titulo or "") != (data.titulo or ""): return False
    if (budget.observacoes or "") != (data.observacoes or ""): return False

    if _float(budget.markup_padrao) != _float(data.markup_padrao): return False
    if _float(budget.perc_despesa_adm) != _float(data.perc_despesa_adm): return False
    if _float(budget.perc_comissao) != _float(data.perc_comissao): return False
    if _float(budget.perc_frete_venda) != _float(data.perc_frete_venda): return False
    if _float(budget.perc_pis) != _float(data.perc_pis): return False
    if _float(budget.perc_cofins) != _float(data.perc_cofins): return False
    if _float(budget.perc_csll) != _float(data.perc_csll): return False
    if _float(budget.perc_irpj) != _float(data.perc_irpj): return False
    if _float(budget.perc_iss) != _float(data.perc_iss): return False
    if _float(budget.perc_icms_interno) != _float(data.perc_icms_interno): return False
    if _float(budget.perc_icms_externo) != _float(data.perc_icms_externo): return False

    if _float(budget.venda_markup_produtos) != _float(data.venda_markup_produtos): return False
    if _float(budget.venda_markup_servicos) != _float(data.venda_markup_servicos): return False
    if _float(budget.venda_markup_instalacao) != _float(data.venda_markup_instalacao): return False
    if _float(budget.venda_markup_manutencao) != _float(data.venda_markup_manutencao): return False
    if bool(budget.venda_havera_manutencao) != bool(data.venda_havera_manutencao): return False
    if int(budget.venda_qtd_meses_manutencao or 0) != int(data.venda_qtd_meses_manutencao or 0): return False

    if int(budget.prazo_contrato_meses or 0) != int(data.prazo_contrato_meses or 0): return False
    if int(budget.prazo_instalacao_meses or 0) != int(data.prazo_instalacao_meses or 0): return False
    if _float(budget.taxa_juros_mensal) != _float(data.taxa_juros_mensal): return False
    if _float(budget.taxa_manutencao_anual) != _float(data.taxa_manutencao_anual): return False
    if (budget.tipo_receita_rental or "") != (data.tipo_receita_rental or ""): return False
    if _float(budget.fator_margem_padrao) != _float(data.fator_margem_padrao): return False
    if _float(budget.fator_manutencao_padrao) != _float(data.fator_manutencao_padrao): return False
    if _float(budget.perc_instalacao_padrao) != _float(data.perc_instalacao_padrao): return False
    if _float(budget.perc_comissao_rental) != _float(data.perc_comissao_rental): return False
    if _float(budget.perc_pis_rental) != _float(data.perc_pis_rental): return False
    if _float(budget.perc_cofins_rental) != _float(data.perc_cofins_rental): return False
    if _float(budget.perc_csll_rental) != _float(data.perc_csll_rental): return False
    if _float(budget.perc_irpj_rental) != _float(data.perc_irpj_rental): return False
    if _float(budget.perc_iss_rental) != _float(data.perc_iss_rental): return False

    db_resp = sorted([_str(r.user_id) for r in budget.responsaveis])
    in_resp = sorted([_str(uid) for uid in data.responsavel_ids])
    if db_resp != in_resp: return False

    if len(budget.items) != len(data.items): return False
    for i_db, i_in in zip(budget.items, data.items):
        if _str(i_db.product_id) != _str(i_in.product_id): return False
        if _str(i_db.opportunity_kit_id) != _str(i_in.opportunity_kit_id): return False
        db_type = i_db.tipo_item.value if hasattr(i_db.tipo_item, 'value') else str(i_db.tipo_item)
        in_type = i_in.tipo_item.value if hasattr(i_in.tipo_item, 'value') else str(i_in.tipo_item)
        if db_type != in_type: return False
        if (i_db.descricao_servico or "") != (i_in.descricao_servico or ""): return False
        if bool(i_db.usa_parametros_padrao) != bool(i_in.usa_parametros_padrao): return False
        if _float(i_db.custo_unit_base) != _float(i_in.custo_unit_base): return False
        if _float(i_db.markup) != _float(i_in.markup): return False
        if _float(i_db.quantidade) != _float(i_in.quantidade): return False
        if _float(i_db.perc_frete_venda) != _float(i_in.perc_frete_venda): return False
        if _float(i_db.perc_pis) != _float(i_in.perc_pis): return False
        if _float(i_db.perc_cofins) != _float(i_in.perc_cofins): return False
        if _float(i_db.perc_csll) != _float(i_in.perc_csll): return False
        if _float(i_db.perc_irpj) != _float(i_in.perc_irpj): return False
        if _float(i_db.perc_icms) != _float(i_in.perc_icms): return False
        if _float(i_db.perc_iss) != _float(i_in.perc_iss): return False
        if _float(i_db.perc_despesa_adm) != _float(i_in.perc_despesa_adm): return False
        if _float(i_db.perc_comissao) != _float(i_in.perc_comissao): return False
        if bool(i_db.tem_st) != bool(i_in.tem_st): return False

    if len(budget.rental_items) != len(data.rental_items): return False
    for r_db, r_in in zip(budget.rental_items, data.rental_items):
        if _str(r_db.product_id) != _str(r_in.product_id): return False
        if _str(r_db.opportunity_kit_id) != _str(r_in.opportunity_kit_id): return False
        if _float(r_db.custo_op_mensal_kit) != _float(r_in.custo_op_mensal_kit): return False
        if bool(r_db.is_kit_instalacao) != bool(r_in.is_kit_instalacao): return False
        if _str(r_db.tipo_contrato_kit) != _str(r_in.tipo_contrato_kit): return False
        if _float(r_db.kit_taxa_juros_mensal) != _float(r_in.kit_taxa_juros_mensal): return False
        if _float(r_db.kit_custo_produtos) != _float(r_in.kit_custo_produtos): return False
        if _float(r_db.kit_custo_servicos) != _float(r_in.kit_custo_servicos): return False
        if _float(r_db.kit_pis) != _float(r_in.kit_pis): return False
        if _float(r_db.kit_cofins) != _float(r_in.kit_cofins): return False
        if _float(r_db.kit_csll) != _float(r_in.kit_csll): return False
        if _float(r_db.kit_irpj) != _float(r_in.kit_irpj): return False
        if _float(r_db.kit_iss) != _float(r_in.kit_iss): return False
        if _float(r_db.kit_vlt_manut) != _float(r_in.kit_vlt_manut): return False
        if _float(r_db.kit_valor_mensal) != _float(r_in.kit_valor_mensal): return False
        if _float(r_db.kit_valor_impostos) != _float(r_in.kit_valor_impostos): return False
        if _float(r_db.kit_receita_liquida) != _float(r_in.kit_receita_liquida): return False
        if _float(r_db.kit_lucro_mensal) != _float(r_in.kit_lucro_mensal): return False
        if _float(r_db.kit_margem) != _float(r_in.kit_margem): return False
        if bool(getattr(r_db, 'kit_faturamento_separado', False)) != bool(getattr(r_in, 'kit_faturamento_separado', False)): return False
        if _float(r_db.kit_investimento_total) != _float(r_in.kit_investimento_total): return False
        if _float(r_db.kit_comissao) != _float(r_in.kit_comissao): return False
        if _float(r_db.kit_perc_comissao) != _float(r_in.kit_perc_comissao): return False
        if _float(r_db.kit_despesas_adm) != _float(r_in.kit_despesas_adm): return False
        if _float(r_db.kit_perc_despesas_adm) != _float(r_in.kit_perc_despesas_adm): return False
        if _float(r_db.kit_vlr_instal_calc) != _float(r_in.kit_vlr_instal_calc): return False
        if _float(r_db.kit_parcela_locacao) != _float(r_in.kit_parcela_locacao): return False
        if _float(r_db.kit_venda_unit_monitoramento) != _float(r_in.kit_venda_unit_monitoramento): return False
        if int(r_db.prazo_contrato or 0) != int(r_in.prazo_contrato or 0): return False
        if bool(r_db.usa_taxa_manut_padrao) != bool(r_in.usa_taxa_manut_padrao): return False
        if _float(r_db.taxa_manutencao_anual_item) != _float(r_in.taxa_manutencao_anual_item): return False
        if _float(r_db.perc_instalacao_item) != _float(r_in.perc_instalacao_item): return False
        if _float(r_db.valor_instalacao_item) != _float(r_in.valor_instalacao_item): return False
        if _float(r_db.fator_margem) != _float(r_in.fator_margem): return False

    return True


def update_budget(db: Session, tenant_id: str, budget_id: str, data: SalesBudgetUpdate, user_id: Optional[str] = None) -> Optional[SalesBudget]:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        return None
    if user_id:
        if not check_user_has_budget_access(db, user_id, tenant_id, budget):
            raise PermissionError("Acesso negado: você não tem permissão para esta oportunidade.")

    # Check for direct permission bypass for Consolidação Diretoria modifications by an approver
    is_approver = False
    if user_id:
        is_approver, _ = check_is_approver(db, user_id, tenant_id, budget.company_id)

    if budget.status in ("ENVIADO_APROVACAO", "APROVADO", "CANCELADO", "GANHO", "PERDIDO"):
        if is_approver and _only_comissao_diretoria_changed(budget, data):
            if budget.perc_comissao_diretoria != data.perc_comissao_diretoria:
                old_val = float(budget.perc_comissao_diretoria)
                new_val = float(data.perc_comissao_diretoria)
                budget.perc_comissao_diretoria = data.perc_comissao_diretoria
                
                cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
                from src.modules.sales_budgets.models import SalesBudgetHistory
                history_entry = SalesBudgetHistory(
                    sales_budget_id=budget.id,
                    tenant_id=tenant_id,
                    versao=budget.versao,
                    status_anterior=budget.status,
                    status_novo=budget.status,
                    usuario_id=user_id,
                    cargo_usuario=cargo_usuario,
                    descricao=f"Comissão da diretoria alterada de {old_val:.2f}% para {new_val:.2f}%."
                )
                db.add(history_entry)
                db.commit()
                db.refresh(budget)
            return budget

    check_budget_locked(budget)
    if budget.status in ("ENVIADO_APROVACAO", "CANCELADO"):
        raise ValueError(f"Orçamento no status {budget.status} não pode ser editado.")

    is_reopened = False
    old_status = budget.status
    if budget.status == "APROVADO":
        is_reopened = True
        budget.versao += 1
        budget.status = "EM_LANCAMENTO"
        from src.modules.sales_budgets.models import SalesBudgetApproval
        db.query(SalesBudgetApproval).filter(SalesBudgetApproval.sales_budget_id == budget.id).delete()

    # Update header + sale defaults
    budget.customer_id = data.customer_id
    budget.titulo = data.titulo
    budget.observacoes = data.observacoes
    budget.data_orcamento = data.data_orcamento
    budget.forma_pagamento_id = data.forma_pagamento_id
    budget.data_vencimento_inicial = data.data_vencimento_inicial
    budget.forma_pagamento_snapshot = data.forma_pagamento_snapshot
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
    budget.venda_markup_produtos = data.venda_markup_produtos
    budget.venda_markup_servicos = data.venda_markup_servicos
    budget.venda_markup_instalacao = data.venda_markup_instalacao
    budget.venda_markup_manutencao = data.venda_markup_manutencao
    budget.venda_havera_manutencao = data.venda_havera_manutencao
    budget.venda_qtd_meses_manutencao = data.venda_qtd_meses_manutencao

    # Update rental defaults
    budget.prazo_contrato_meses = data.prazo_contrato_meses
    budget.prazo_instalacao_meses = data.prazo_instalacao_meses
    budget.taxa_juros_mensal = data.taxa_juros_mensal
    budget.taxa_manutencao_anual = data.taxa_manutencao_anual
    budget.tipo_receita_rental = data.tipo_receita_rental
    budget.fator_margem_padrao = data.fator_margem_padrao
    budget.fator_manutencao_padrao = data.fator_manutencao_padrao
    budget.perc_instalacao_padrao = data.perc_instalacao_padrao
    budget.perc_comissao_rental = data.perc_comissao_rental
    budget.perc_pis_rental = data.perc_pis_rental
    budget.perc_cofins_rental = data.perc_cofins_rental
    budget.perc_csll_rental = data.perc_csll_rental
    budget.perc_irpj_rental = data.perc_irpj_rental
    budget.perc_iss_rental = data.perc_iss_rental
    budget.perc_comissao_diretoria = data.perc_comissao_diretoria

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

    # Determine perfil_tarifario_st for the company
    from src.modules.companies.models import CompanyTaxProfile
    tax_profile = db.query(CompanyTaxProfile).filter(
        CompanyTaxProfile.company_id == budget.company_id
    ).first()
    perfil_st_ativo = True
    if tax_profile and tax_profile.perfil_tarifario_st is False:
        perfil_st_ativo = False

    # Sync missing product reference prices from opportunity purchase budgets
    _sync_missing_product_prices(db, tenant_id, budget.id, data.items, data.rental_items)

    _process_sale_items(db, budget, data.items, budget.tenant_id, company_uf, customer_uf, defaults, perfil_st_ativo)

    rental_defaults = _build_rental_defaults(budget)
    _process_rental_items(db, budget, data.rental_items, rental_defaults)
    db.flush()

    # Clean up orphaned OpportunityKits that are strictly attached to this budget
    from src.modules.opportunity_kits.models import OpportunityKit
    active_sale_kit_ids = [item.opportunity_kit_id for item in db.query(SalesBudgetItem).filter(SalesBudgetItem.budget_id == budget.id) if item.opportunity_kit_id]
    active_rental_kit_ids = [item.opportunity_kit_id for item in db.query(RentalBudgetItem).filter(RentalBudgetItem.budget_id == budget.id) if item.opportunity_kit_id]
    valid_kit_ids = set(active_sale_kit_ids + active_rental_kit_ids)
    
    orphans = db.query(OpportunityKit).filter(
        OpportunityKit.sales_budget_id == budget.id,
        OpportunityKit.id.notin_(list(valid_kit_ids) if valid_kit_ids else [uuid.uuid4()])
    ).all()
    
    for orphan in orphans:
        db.delete(orphan)

    from src.modules.payment_methods.service import PaymentMethodsService
    PaymentMethodsService.sync_sales_budget_planning(db, budget)
    recalculate_budget_total(db, budget)

    if is_reopened and user_id:
        cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
        from src.modules.sales_budgets.models import SalesBudgetHistory
        history_entry = SalesBudgetHistory(
            sales_budget_id=budget.id,
            tenant_id=tenant_id,
            versao=budget.versao,
            status_anterior=old_status,
            status_novo=budget.status,
            usuario_id=user_id,
            cargo_usuario=cargo_usuario,
            descricao="Reabertura automática por alteração nos itens da oportunidade aprovada."
        )
        db.add(history_entry)
        db.flush()

    db.commit()
    db.refresh(budget)
    return budget


def update_header(db: Session, tenant_id: str, budget_id: str, data: SalesBudgetHeaderUpdate, user_id: Optional[str] = None) -> Optional[SalesBudget]:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        return None
    if user_id:
        if not check_user_has_budget_access(db, user_id, tenant_id, budget):
            raise PermissionError("Acesso negado: você não tem permissão para esta oportunidade.")
    check_budget_locked(budget)
    if budget.status in ("ENVIADO_APROVACAO", "CANCELADO"):
        raise ValueError(f"Orçamento no status {budget.status} não pode ser editado.")
        
    is_reopened = False
    old_status = budget.status
    
    has_changes = False
    if data.titulo is not None and data.titulo != budget.titulo:
        has_changes = True
    if data.customer_id is not None and data.customer_id != budget.customer_id:
        has_changes = True
        
    if has_changes and budget.status == "APROVADO":
        is_reopened = True
        budget.versao += 1
        budget.status = "EM_LANCAMENTO"
        from src.modules.sales_budgets.models import SalesBudgetApproval
        db.query(SalesBudgetApproval).filter(SalesBudgetApproval.sales_budget_id == budget.id).delete()
        
    if data.titulo is not None:
        budget.titulo = data.titulo
    if data.customer_id is not None:
        budget.customer_id = data.customer_id
        
    recalculate_budget_total(db, budget)
    
    if is_reopened and user_id:
        cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
        from src.modules.sales_budgets.models import SalesBudgetHistory
        history_entry = SalesBudgetHistory(
            sales_budget_id=budget.id,
            tenant_id=tenant_id,
            versao=budget.versao,
            status_anterior=old_status,
            status_novo=budget.status,
            usuario_id=user_id,
            cargo_usuario=cargo_usuario,
            descricao="Reabertura automática por alteração nos dados do cabeçalho da oportunidade aprovada."
        )
        db.add(history_entry)
        db.flush()
        
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


def duplicate_budget(db: Session, tenant_id: str, budget_id: str, user_id: Optional[str] = None) -> Optional[SalesBudget]:
    original = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not original:
        return None
    if user_id:
        if not check_user_has_budget_access(db, user_id, tenant_id, original):
            raise PermissionError("Acesso negado: você não tem permissão para esta oportunidade.")

    new_budget = SalesBudget(
        tenant_id=original.tenant_id,
        company_id=original.company_id,
        customer_id=original.customer_id,
        numero_orcamento=get_next_numero(db, tenant_id, str(original.company_id)),
        titulo=f"{original.titulo} (Cópia)",
        observacoes=original.observacoes,
        data_orcamento=original.data_orcamento,
        status="EM_LANCAMENTO",
        venda_havera_manutencao=original.venda_havera_manutencao,
        venda_qtd_meses_manutencao=original.venda_qtd_meses_manutencao,
        # Sale defaults
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
        venda_markup_produtos=original.venda_markup_produtos,
        venda_markup_servicos=original.venda_markup_servicos,
        venda_markup_instalacao=original.venda_markup_instalacao,
        venda_markup_manutencao=original.venda_markup_manutencao,
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
        perc_comissao_diretoria=original.perc_comissao_diretoria,
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
            tipo_contrato_kit=ri.tipo_contrato_kit,
            kit_taxa_juros_mensal=ri.kit_taxa_juros_mensal,
            kit_custo_produtos=ri.kit_custo_produtos,
            kit_custo_servicos=ri.kit_custo_servicos,
            kit_pis=ri.kit_pis,
            kit_cofins=ri.kit_cofins,
            kit_csll=ri.kit_csll,
            kit_irpj=ri.kit_irpj,
            kit_iss=ri.kit_iss,
            kit_vlt_manut=ri.kit_vlt_manut,
            kit_valor_mensal=ri.kit_valor_mensal,
            kit_valor_impostos=ri.kit_valor_impostos,
            kit_receita_liquida=ri.kit_receita_liquida,
            kit_lucro_mensal=ri.kit_lucro_mensal,
            kit_margem=ri.kit_margem,
            quantidade=ri.quantidade,
            custo_aquisicao_unit=ri.custo_aquisicao_unit,
            ipi_unit=ri.ipi_unit, frete_unit=ri.frete_unit,
            icms_st_unit=ri.icms_st_unit, difal_unit=ri.difal_unit,
            custo_total_aquisicao=ri.custo_total_aquisicao,
            prazo_contrato=ri.prazo_contrato,
            usa_taxa_manut_padrao=ri.usa_taxa_manut_padrao,
            taxa_manutencao_anual_item=ri.taxa_manutencao_anual_item,
            perc_instalacao_item=ri.perc_instalacao_item,
            valor_instalacao_item=ri.valor_instalacao_item,
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


def list_budgets(
    db: Session,
    tenant_id: str,
    company_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 25,
    q: Optional[str] = None,
    status: Optional[str] = None,
    user_id: Optional[str] = None
) -> Tuple[List[SalesBudget], int]:
    from sqlalchemy import or_
    from src.modules.sales_budgets.models import SalesBudgetResponsavel
    
    query = db.query(SalesBudget).outerjoin(Customer, SalesBudget.customer_id == Customer.id).filter(SalesBudget.tenant_id == tenant_id)
    if company_id:
        query = query.filter(SalesBudget.company_id == company_id)
        
    if user_id:
        is_approver, _ = check_is_approver(db, user_id, tenant_id, company_id)
        if not is_approver:
            query = query.filter(SalesBudget.responsaveis.any(SalesBudgetResponsavel.user_id == user_id))
            
    if status:
        query = query.filter(SalesBudget.status == status)
        
    if q:
        search_term = f"%{q}%"
        query = query.filter(
            or_(
                SalesBudget.titulo.ilike(search_term),
                SalesBudget.numero_orcamento.ilike(search_term),
                Customer.nome_fantasia.ilike(search_term),
                Customer.razao_social.ilike(search_term)
            )
        )
        
    total = query.count()
    items = query.order_by(SalesBudget.created_at.desc()).offset(skip).limit(limit).all()
    
    return items, total

def get_budget(db: Session, tenant_id: str, budget_id: str, user_id: Optional[str] = None) -> Optional[SalesBudget]:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if budget and user_id:
        if not check_user_has_budget_access(db, user_id, tenant_id, budget):
            return None
    return budget


def delete_budget(db: Session, tenant_id: str, budget_id: str, user_id: Optional[str] = None) -> bool:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        return False
    if user_id:
        if not check_user_has_budget_access(db, user_id, tenant_id, budget):
            raise PermissionError("Acesso negado: você não tem permissão para esta oportunidade.")
    check_budget_locked(budget)
    db.delete(budget)
    db.commit()
    return True

def calculate_product_cost_composition(db: Session, product_id: str, tenant_id: str, tipo: str = "REVENDA", sales_company_id: Optional[str] = None, sales_budget_id: Optional[str] = None, licitacao_id: Optional[str] = None) -> dict:
    from src.modules.products.models import Product
    from src.modules.products.service import ProductService
    from src.modules.ncm.services.ncm_service import NcmService
    from src.modules.purchase_budgets.models import PurchaseBudget, PurchaseBudgetItem

    product = db.query(Product).filter(
        Product.id == product_id,
        Product.tenant_id == tenant_id
    ).first()
    if not product:
        return None

    # Select reference price + budget based on tipo
    uso_consumo = tipo.upper() == "USO_CONSUMO"
    
    ref_budget_id = None
    if sales_budget_id:
        # Query across all purchase budgets linked to this opportunity that contain the product
        linked_item = db.query(PurchaseBudgetItem).join(PurchaseBudget).filter(
            PurchaseBudget.sales_budget_id == sales_budget_id,
            PurchaseBudget.tenant_id == tenant_id,
            PurchaseBudgetItem.product_id == product_id
        ).first()
        if linked_item:
            ref_budget_id = linked_item.budget_id
    elif licitacao_id:
        # Query across all purchase budgets linked to this licitacao that contain the product
        linked_item = db.query(PurchaseBudgetItem).join(PurchaseBudget).filter(
            PurchaseBudget.licitacao_id == licitacao_id,
            PurchaseBudget.tenant_id == tenant_id,
            PurchaseBudgetItem.product_id == product_id
        ).first()
        if linked_item:
            ref_budget_id = linked_item.budget_id

    if not ref_budget_id:
        if uso_consumo:
            ref_budget_id = product.orcamento_referencia_uso_consumo_id
        else:
            ref_budget_id = product.orcamento_referencia_revenda_id

    if uso_consumo:
        custo_ref = float(product.vlr_referencia_uso_consumo or 0)
    else:
        custo_ref = float(product.vlr_referencia_revenda or 0)

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
        "is_intrastate": True,
        "uf_origem": "",
        "uf_destino": "",
        "difal_unitario": 0.0,
        "tipo": "USO_CONSUMO" if uso_consumo else "REVENDA",
        "custo_unit_final": custo_ref,
    }

    if not ref_budget_id:
        return result

    budget_item = db.query(PurchaseBudgetItem).join(PurchaseBudget).filter(
        PurchaseBudgetItem.product_id == product_id,
        PurchaseBudget.id == ref_budget_id
    ).first()

    if not budget_item:
        return result

    budget = budget_item.budget
    qtd = float(budget_item.quantidade) if float(budget_item.quantidade) > 0 else 1

    base_unitario = float(budget_item.valor_unitario)
    if budget.negotiations:
        latest_neg = sorted(budget.negotiations, key=lambda x: x.data_negociacao, reverse=True)[0]
        for n_item in latest_neg.items:
            if n_item.budget_item_id == budget_item.id:
                base_unitario = float(n_item.valor_final) / qtd

    ipi_unitario = float(budget_item.ipi_valor) / qtd if qtd > 0 else 0
    frete_unitario = float(budget_item.frete_valor) / qtd if qtd > 0 else 0

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
            budget.tenant_id, product.ncm_codigo, str(budget.company_id), "USO_CONSUMO" if uso_consumo else "REVENDA"
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

    from src.modules.companies.models import Company, CompanyTaxProfile
    from src.modules.catalog.models import State
    
    # Check if a custom sales_company_id was passed, otherwise default to the purchase budget company
    target_company_id = sales_company_id if sales_company_id else str(budget.company_id)
    
    company = db.query(Company).filter(Company.id == target_company_id).first()
    
    tax_profile = db.query(CompanyTaxProfile).filter(CompanyTaxProfile.company_id == target_company_id).first()
    perfil_st_ativo = True
    if tax_profile and tax_profile.perfil_tarifario_st is False:
        perfil_st_ativo = False
    uf_destino = "MT"
    if company and company.state_id:
        state_rec = db.query(State).filter(State.id == company.state_id).first()
        if state_rec:
            uf_destino = state_rec.sigla.upper()
    uf_origem = budget.supplier.uf.upper() if (budget.supplier and budget.supplier.uf) else "SP"
    op_interestadual = (uf_origem != uf_destino)

    if st_flag and op_interestadual:
        cred = icms_entrada_effective / 100.0
        base_com_mva = (base_unitario + ipi_unitario) * (1 + (mva_percent / 100.0))

        if bit_flag:
            icms_st_saida = base_com_mva * FATOR_BIT * ALIQ_INTERNA_DESTINO
            icms_credito = base_unitario * FATOR_BIT * cred
            calc_icms_st_final = max(0.0, icms_st_saida - icms_credito)
            icms_st_normal = calc_icms_st_final
        else:
            icms_st_bruto = base_com_mva * ALIQ_INTERNA_DESTINO - base_unitario * cred
            icms_st_normal = max(0.0, icms_st_bruto)
            cred_outorgado_valor = icms_st_normal * DESCONTO_CREDITO_OUTORGADO
            calc_icms_st_final = max(0.0, icms_st_normal - cred_outorgado_valor)

    ALIQUOTA_INTERESTADUAL_PADRAO = icms_entrada_effective / 100.0
    difal_unitario = 0.0

    if op_interestadual:
        base_com_ipi_e_frete = base_unitario + ipi_unitario + frete_unitario
        c_icms_origem = base_com_ipi_e_frete * ALIQUOTA_INTERESTADUAL_PADRAO
        base_sem_icms = base_com_ipi_e_frete - c_icms_origem
        divisor = 1 - ALIQ_INTERNA_DESTINO
        if divisor > 0:
            c_base_calculo_difal = base_sem_icms / divisor
            c_icms_destino = c_base_calculo_difal * ALIQ_INTERNA_DESTINO
            c_valor_difal_base = c_icms_destino - c_icms_origem

            if uso_consumo:
                difal_unitario = max(0.0, c_valor_difal_base)
            else:
                diff_difal_st = c_valor_difal_base - calc_icms_st_final
                if diff_difal_st > 0:
                    difal_unitario = calc_icms_st_final + diff_difal_st
                else:
                    difal_unitario = max(0.0, c_valor_difal_base)

    icms_abatido_unitario = 0.0
    if product and product.tipo in ["SERVICO", "LICENCA"]:
        difal_unitario = 0.0
        calc_icms_st_final = 0.0
        icms_st_normal = 0.0
        cred_outorgado_valor = 0.0
        custo_unit_final = base_unitario + ipi_unitario + frete_unitario
    elif uso_consumo:
        custo_unit_final = base_unitario + ipi_unitario + frete_unitario + difal_unitario
    else:
        if not perfil_st_ativo:
            icms_abatido_unitario = base_unitario * (icms_entrada_effective / 100.0)
            custo_unit_final = base_unitario + ipi_unitario + frete_unitario
        else:
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
        "difal_unitario": round(difal_unitario, 2),
        "tipo": "USO_CONSUMO" if uso_consumo else "REVENDA",
        "custo_unit_final": round(custo_unit_final, 2),
        "perfil_st_ativo": perfil_st_ativo,
        "icms_abatido": round(icms_abatido_unitario, 2),
    }


def check_is_approver(db: Session, user_id: str, tenant_id: str, company_id: Any) -> Tuple[bool, str]:
    from src.modules.users.models import UserRole, UserRoleEnum
    from src.modules.professionals.models import Professional

    if isinstance(company_id, str):
        try:
            company_id = UUID(company_id)
        except ValueError:
            pass

    # 1. Check system roles first (ADMIN or DIRETORIA on UserRole)
    user_roles = db.query(UserRole).filter(UserRole.user_id == user_id).all()
    for ur in user_roles:
        if ur.role in (UserRoleEnum.ADMIN, UserRoleEnum.DIRETORIA):
            return True, ur.role.value

    # 2. Check Professional role in active company (GERENTE or DIRETOR)
    professional = db.query(Professional).filter(
        Professional.user_id == user_id,
        Professional.company_id == company_id,
        Professional.tenant_id == tenant_id
    ).first()
    
    if professional and professional.role:
        role_name_upper = professional.role.name.upper()
        if role_name_upper in ("GERENTE", "DIRETOR"):
            return True, role_name_upper

    return False, "VENDEDOR"


def get_user_role_name(db: Session, user_id: str, tenant_id: str, company_id: Any) -> str:
    is_app, role_name = check_is_approver(db, user_id, tenant_id, company_id)
    if role_name != "VENDEDOR":
        return role_name
    
    if isinstance(company_id, str):
        try:
            company_id = UUID(company_id)
        except ValueError:
            pass

    from src.modules.professionals.models import Professional
    professional = db.query(Professional).filter(
        Professional.user_id == user_id,
        Professional.company_id == company_id,
        Professional.tenant_id == tenant_id
    ).first()
    if professional and professional.role:
        return professional.role.name.upper()
    return "VENDEDOR"


def recalculate_budget_total(db: Session, budget: SalesBudget):
    db.flush()
    sale_total = Decimal("0")
    for item in budget.items:
        sale_total += _d(item.total_venda)
    for ri in budget.rental_items:
        if getattr(ri, "tipo_contrato_kit", None) == 'VENDA_EQUIPAMENTOS':
            sale_total += _d(ri.kit_valor_mensal) * _d(ri.quantidade)
            
    valid_rentals = [ri for ri in budget.rental_items if getattr(ri, "tipo_contrato_kit", None) != 'VENDA_EQUIPAMENTOS']
    rental_total = Decimal("0")
    for ri in valid_rentals:
        p_inst = int(getattr(budget, "prazo_instalacao_meses", 0) or 0)
        p_ctr = max(0, int(ri.prazo_contrato or 0) - p_inst)
        val_mensal = _d(ri.valor_mensal) if ri.valor_mensal is not None else _d(getattr(ri, "kit_valor_mensal", 0))
        qty = _d(ri.quantidade)
        instalacao = _d(getattr(ri, "kit_vlr_instal_calc", 0) or getattr(ri, "valor_instalacao_item", 0) or 0)
        rental_total += (val_mensal * p_ctr + instalacao) * qty
        
    budget.valor_total = sale_total + rental_total


def enviar_para_aprovacao(db: Session, tenant_id: str, budget_id: str, user_id: str, justificativa: str) -> SalesBudget:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        raise ValueError("Oportunidade não encontrada.")
    if not check_user_has_budget_access(db, user_id, tenant_id, budget):
        raise PermissionError("Acesso negado: você não tem permissão para esta oportunidade.")
    
    check_budget_locked(budget)
    if budget.status not in ("EM_LANCAMENTO", "RETORNADO_VENDEDOR"):
        raise ValueError(f"Não é possível enviar para aprovação a partir do status {budget.status}.")
        
    if len(budget.items) == 0 and len(budget.rental_items) == 0:
        raise ValueError("Oportunidade deve conter pelo menos um item/kit para ser enviada para aprovação.")
        
    old_status = budget.status
    budget.status = "ENVIADO_APROVACAO"
    
    cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
    from src.modules.sales_budgets.models import SalesBudgetHistory
    history_entry = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao,
        status_anterior=old_status,
        status_novo=budget.status,
        usuario_id=user_id,
        cargo_usuario=cargo_usuario,
        descricao=justificativa
    )
    db.add(history_entry)

    # Generate notifications for approvers
    from src.modules.users.models import User, UserRole, UserRoleEnum
    from src.modules.professionals.models import Professional
    from src.modules.roles.models import Role
    from src.modules.notifications.models import Notification

    # 1. Query System Approvers (ADMIN, DIRETORIA)
    system_approvers = db.query(User).join(UserRole).filter(
        User.tenant_id == tenant_id,
        UserRole.role.in_([UserRoleEnum.ADMIN, UserRoleEnum.DIRETORIA])
    ).all()

    # 2. Query Company Approvers (GERENTE, DIRETOR in active company)
    company_approvers = db.query(User).join(Professional, Professional.user_id == User.id).join(Role, Role.id == Professional.role_id).filter(
        User.tenant_id == tenant_id,
        Professional.company_id == budget.company_id,
        Role.name.in_(["GERENTE", "DIRETOR"])
    ).all()

    # 3. Consolidate recipient IDs (no duplicates)
    recipient_ids = set()
    for u in system_approvers:
        recipient_ids.add(u.id)
    for u in company_approvers:
        recipient_ids.add(u.id)

    # Get vendor name
    vendedor = db.query(User).filter(User.id == user_id).first()
    vendedor_name = vendedor.name if vendedor else "Vendedor"

    opportunity_number = budget.numero_orcamento or "Sem Número"

    # 4. Create Notification objects
    for r_id in recipient_ids:
        # Avoid notifying oneself if they are an approver who sent it (though usually it's sellers who send)
        if r_id == user_id:
            continue
        notification = Notification(
            tenant_id=tenant_id,
            company_id=budget.company_id,
            user_id=r_id,
            title="Nova proposta para aprovação",
            message=f"A oportunidade {opportunity_number} foi enviada para aprovação por {vendedor_name}.",
            opportunity_id=str(budget.id),
            opportunity_number=opportunity_number,
            vendedor_name=vendedor_name
        )
        db.add(notification)

    db.commit()
    db.refresh(budget)
    return budget


def aprovar_oportunidade(db: Session, tenant_id: str, budget_id: str, user_id: str, observacao: Optional[str] = None) -> SalesBudget:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        raise ValueError("Oportunidade não encontrada.")
        
    check_budget_locked(budget)
    if budget.status != "ENVIADO_APROVACAO":
        raise ValueError("Apenas oportunidades no status ENVIADO_APROVACAO podem ser aprovadas.")
        
    is_approver, cargo_aprovador = check_is_approver(db, user_id, tenant_id, budget.company_id)
    if not is_approver:
        raise PermissionError("Usuário não possui cargo de aprovação (Gerente ou Diretor).")
        
    old_status = budget.status
    budget.status = "APROVADO"
    
    from src.modules.sales_budgets.models import SalesBudgetApproval, SalesBudgetHistory
    approval_entry = SalesBudgetApproval(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        usuario_aprovador_id=user_id,
        cargo_aprovador=cargo_aprovador,
        observacao=observacao
    )
    db.add(approval_entry)
    
    cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
    desc = f"Aprovado por {cargo_aprovador}."
    if observacao:
        desc += f" Obs: {observacao}"
        
    history_entry = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao,
        status_anterior=old_status,
        status_novo=budget.status,
        usuario_id=user_id,
        cargo_usuario=cargo_usuario,
        descricao=desc
    )
    db.add(history_entry)

    # Generate notifications for seller and responsibles
    from src.modules.notifications.models import Notification
    
    vendedor_name = budget.vendedor.name if budget.vendedor else "Vendedor"
    opportunity_number = budget.numero_orcamento or "Sem Número"
    
    recipients = set()
    if budget.vendedor and budget.vendedor.user_id:
        recipients.add(budget.vendedor.user_id)
    for resp in budget.responsaveis:
        if resp.user_id:
            recipients.add(resp.user_id)
            
    # Exclude the approver themselves from receiving the notification
    recipients.discard(user_id)
    
    for r_uid in recipients:
        notification = Notification(
            tenant_id=tenant_id,
            company_id=budget.company_id,
            user_id=r_uid,
            title="Proposta aprovada",
            message=f"A oportunidade {opportunity_number} foi aprovada.",
            opportunity_id=str(budget.id),
            opportunity_number=opportunity_number,
            vendedor_name=vendedor_name
        )
        db.add(notification)
    
    db.commit()
    db.refresh(budget)
    return budget


def retornar_ao_vendedor(db: Session, tenant_id: str, budget_id: str, user_id: str, justificativa: str) -> SalesBudget:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        raise ValueError("Oportunidade não encontrada.")
        
    check_budget_locked(budget)
    if budget.status != "ENVIADO_APROVACAO":
        raise ValueError("Apenas oportunidades enviadas para aprovação podem retornar ao vendedor.")
        
    is_approver, cargo_aprovador = check_is_approver(db, user_id, tenant_id, budget.company_id)
    if not is_approver:
        raise PermissionError("Apenas aprovadores podem retornar a oportunidade ao vendedor.")
        
    old_status = budget.status
    budget.status = "RETORNADO_VENDEDOR"
    
    cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
    from src.modules.sales_budgets.models import SalesBudgetHistory
    history_entry = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao,
        status_anterior=old_status,
        status_novo=budget.status,
        usuario_id=user_id,
        cargo_usuario=cargo_usuario,
        descricao=justificativa
    )
    db.add(history_entry)
    db.commit()
    db.refresh(budget)
    return budget


def cancelar_oportunidade(db: Session, tenant_id: str, budget_id: str, user_id: str, justificativa: str) -> SalesBudget:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        raise ValueError("Oportunidade não encontrada.")
    if not check_user_has_budget_access(db, user_id, tenant_id, budget):
        raise PermissionError("Acesso negado: você não tem permissão para esta oportunidade.")
        
    check_budget_locked(budget)
    if budget.status in ("CANCELADO", "GANHO", "PERDIDO"):
        raise ValueError(f"Não é possível cancelar uma oportunidade já no status {budget.status}.")
        
    old_status = budget.status
    budget.status = "CANCELADO"
    
    cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
    from src.modules.sales_budgets.models import SalesBudgetHistory
    history_entry = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao,
        status_anterior=old_status,
        status_novo=budget.status,
        usuario_id=user_id,
        cargo_usuario=cargo_usuario,
        descricao=justificativa
    )
    db.add(history_entry)
    db.commit()
    db.refresh(budget)
    return budget


def ganhar_oportunidade(db: Session, tenant_id: str, budget_id: str, user_id: str, justificativa: str) -> SalesBudget:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        raise ValueError("Oportunidade não encontrada.")
    if not check_user_has_budget_access(db, user_id, tenant_id, budget):
        raise PermissionError("Acesso negado: você não tem permissão para esta oportunidade.")
        
    check_budget_locked(budget)
    if budget.status != "APROVADO":
        raise ValueError("Apenas oportunidades com status APROVADO podem ser ganhas.")
        
    old_status = budget.status
    budget.status = "GANHO"
    
    cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
    from src.modules.sales_budgets.models import SalesBudgetHistory
    history_entry = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao,
        status_anterior=old_status,
        status_novo=budget.status,
        usuario_id=user_id,
        cargo_usuario=cargo_usuario,
        descricao=justificativa
    )
    db.add(history_entry)
    db.commit()
    db.refresh(budget)
    return budget


def perder_oportunidade(db: Session, tenant_id: str, budget_id: str, user_id: str, justificativa: str) -> SalesBudget:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        raise ValueError("Oportunidade não encontrada.")
    if not check_user_has_budget_access(db, user_id, tenant_id, budget):
        raise PermissionError("Acesso negado: você não tem permissão para esta oportunidade.")
        
    check_budget_locked(budget)
    if budget.status in ("CANCELADO", "GANHO", "PERDIDO"):
        raise ValueError(f"Não é possível marcar como perdida uma oportunidade no status {budget.status}.")
        
    old_status = budget.status
    budget.status = "PERDIDO"
    
    cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
    from src.modules.sales_budgets.models import SalesBudgetHistory
    history_entry = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao,
        status_anterior=old_status,
        status_novo=budget.status,
        usuario_id=user_id,
        cargo_usuario=cargo_usuario,
        descricao=justificativa
    )
    db.add(history_entry)
    db.commit()
    db.refresh(budget)
    return budget


def reabrir_oportunidade(db: Session, tenant_id: str, budget_id: str, user_id: str, justificativa: str) -> SalesBudget:
    budget = db.query(SalesBudget).filter(
        SalesBudget.id == budget_id,
        SalesBudget.tenant_id == tenant_id
    ).first()
    if not budget:
        raise ValueError("Oportunidade não encontrada.")
    if not check_user_has_budget_access(db, user_id, tenant_id, budget):
        raise PermissionError("Acesso negado: você não tem permissão para esta oportunidade.")
        
    if budget.status == "PERDIDO":
        raise ValueError("Status não permite mais edição")
        
    if budget.status != "GANHO":
        raise ValueError("Apenas oportunidades com status GANHO podem ser reabertas.")
        
    # Check permissions: ADMIN, GERENTE, or DIRETOR
    is_approver, role_name = check_is_approver(db, user_id, tenant_id, budget.company_id)
    if role_name not in ("ADMIN", "DIRETORIA", "GERENTE", "DIRETOR"):
        raise PermissionError("Acesso negado: apenas administradores, gerentes ou diretores podem reabrir a oportunidade.")
        
    old_status = budget.status
    budget.status = "EM_LANCAMENTO"
    
    cargo_usuario = get_user_role_name(db, user_id, tenant_id, budget.company_id)
    from src.modules.sales_budgets.models import SalesBudgetHistory
    history_entry = SalesBudgetHistory(
        sales_budget_id=budget.id,
        tenant_id=tenant_id,
        versao=budget.versao,
        status_anterior=old_status,
        status_novo=budget.status,
        usuario_id=user_id,
        cargo_usuario=cargo_usuario,
        descricao=justificativa
    )
    db.add(history_entry)
    db.commit()
    db.refresh(budget)
    return budget


def get_opportunity_dre(db: Session, tenant_id: str, opportunity_id: UUID, company_id: str) -> dict:
    from src.modules.purchase_budgets.models import PurchaseBudget
    from src.modules.opportunity_kits.service import OpportunityKitService
    from src.modules.opportunity_kits.models import OpportunityKit
    from src.modules.sales_budgets.models import SalesBudgetHistory
    
    opportunity = get_budget(db, tenant_id, str(opportunity_id))
    if not opportunity:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
        
    kit_service = OpportunityKitService(db)
    
    total_produtos = Decimal("0.0")
    total_servicos = Decimal("0.0")
    total_st_total = Decimal("0.0")
    is_interestadual = False
    company = opportunity.company
    customer = opportunity.customer
    if company and customer:
        is_interestadual = str(company.state_id) != str(customer.state_id)
        
    is_rental_opp = len(opportunity.rental_items) > 0
    prazo_contrato = Decimal(str(opportunity.prazo_contrato_meses or 36))
    
    # Purchase Taxes (IPI, ST, DIFAL)
    purchase_ipi = Decimal("0.0")
    purchase_st = Decimal("0.0")
    purchase_difal = Decimal("0.0")
    custo_base_produtos = Decimal("0.0")
    
    # Venda Taxes
    vlt_pis = Decimal("0.0")
    vlt_cofins = Decimal("0.0")
    vlt_csll = Decimal("0.0")
    vlt_irpj = Decimal("0.0")
    vlt_icms = Decimal("0.0")
    vlt_iss = Decimal("0.0")
    vlt_ipi_venda = Decimal("0.0")

    # Segregated Venda Taxes (Locação vs Instalação)
    impostos_instalacao_pis = Decimal("0.0")
    impostos_instalacao_cofins = Decimal("0.0")
    impostos_instalacao_csll = Decimal("0.0")
    impostos_instalacao_irpj = Decimal("0.0")
    impostos_instalacao_iss = Decimal("0.0")
    impostos_instalacao_icms = Decimal("0.0")
    
    impostos_locacao_pis = Decimal("0.0")
    impostos_locacao_cofins = Decimal("0.0")
    impostos_locacao_csll = Decimal("0.0")
    impostos_locacao_irpj = Decimal("0.0")
    impostos_locacao_iss = Decimal("0.0")
    
    # Despesas
    vlt_frete = Decimal("0.0")
    vlt_comissao = Decimal("0.0")
    vlt_despesas_adm = Decimal("0.0")
    total_frete_compra = Decimal("0.0")
    
    # Custos Operacionais
    vlt_custo_op_monitoramento = Decimal("0.0")
    vlt_custo_op_manutencao = Decimal("0.0")
    
    total_venda = Decimal("0.0")
    
    is_interestadual = False
    company = opportunity.company
    customer = opportunity.customer
    if company and customer:
        is_interestadual = str(company.state_id) != str(customer.state_id)
        
    is_rental_opp = len(opportunity.rental_items) > 0
    prazo_contrato = Decimal(str(opportunity.prazo_contrato_meses or 36))

    # Get kits from the items of SalesBudget (SalesBudgetItem & RentalBudgetItem)
    kit_ids = set()
    for item in opportunity.items:
        if item.opportunity_kit_id:
            kit_ids.add(item.opportunity_kit_id)
    for item in opportunity.rental_items:
        if item.opportunity_kit_id:
            kit_ids.add(item.opportunity_kit_id)
            
    kits = db.query(OpportunityKit).filter(OpportunityKit.id.in_(kit_ids)).all() if kit_ids else []
    
    import datetime
    purchase_budgets = db.query(PurchaseBudget).filter(
        PurchaseBudget.sales_budget_id == opportunity_id,
        PurchaseBudget.tenant_id == tenant_id
    ).all()
    purchase_budgets = sorted(purchase_budgets, key=lambda x: getattr(x, "created_at", None) or datetime.datetime.min, reverse=True)
    
    product_suppliers = {}
    for pb in purchase_budgets:
        for pb_item in pb.items:
            if pb_item.product_id:
                product_suppliers[pb_item.product_id] = pb.supplier_nome_fantasia
                
    supplier_map = {}

    # Build purchase tax details exactly as in reports.py to match calculations and roundings
    opp_product_taxes = {}
    
    # 1. Populate from direct items in opportunity.items
    for item in opportunity.items:
        if not item.opportunity_kit_id and item.product_id:
            difal = Decimal(str(getattr(item, "difal_unit", None) or 0.0))
            st = Decimal(str(getattr(item, "icms_st_unit", None) or 0.0))
            opp_product_taxes[item.product_id] = {
                "difal": difal,
                "st": st,
                "source": "opportunity_item"
            }
            
    # 2. Populate from direct items in opportunity.rental_items
    for item in opportunity.rental_items:
        if not item.opportunity_kit_id and item.product_id:
            difal = Decimal(str(getattr(item, "difal_unit", None) or 0.0))
            st = Decimal(str(getattr(item, "icms_st_unit", None) or 0.0))
            opp_product_taxes[item.product_id] = {
                "difal": difal,
                "st": st,
                "source": "opportunity_item"
            }

    def get_purchase_tax_breakdown(prod_id, pb_item):
        tax_info = opp_product_taxes.get(prod_id)
        difal = Decimal("0.0")
        st = Decimal("0.0")
        ipi = Decimal("0.0")
        
        if tax_info:
            difal = tax_info["difal"]
            st = tax_info["st"]
        
        if difal == Decimal("0.0") and pb_item and pb_item.difal_unitario is not None and Decimal(str(pb_item.difal_unitario)) > Decimal("0.0"):
            difal = Decimal(str(pb_item.difal_unitario))
        if st == Decimal("0.0") and pb_item and pb_item.st_unitario is not None and Decimal(str(pb_item.st_unitario)) > Decimal("0.0"):
            st = Decimal(str(pb_item.st_unitario))
            
        if pb_item and pb_item.ipi_valor is not None and Decimal(str(pb_item.ipi_valor)) > Decimal("0.0"):
            pb_qty = Decimal(str(pb_item.quantidade)) if Decimal(str(pb_item.quantidade)) > Decimal("0.0") else Decimal("1.0")
            ipi = Decimal(str(pb_item.ipi_valor)) / pb_qty
            
        return difal, st, ipi

    kits_financials = {}
    for kit in kits:
        fin = kit_service.calculate_financials(kit, tenant_id, sales_budget_id=str(opportunity_id))
        kits_financials[kit.id] = fin
        summary = fin["summary"]
        
        # Populate kit items taxes into opp_product_taxes
        for item_sum in fin.get("item_summaries", []):
            p_id = item_sum.get("product_id")
            if p_id:
                p_uuid = UUID(p_id) if isinstance(p_id, str) else p_id
                difal_val = Decimal(str(item_sum.get("difal_unitario") or 0.0))
                st_val = Decimal(str(item_sum.get("icms_st_unitario") or 0.0))
                opp_product_taxes[p_uuid] = {
                    "difal": difal_val,
                    "st": st_val,
                    "source": "opportunity_kit"
                }
        
        # Scale values by the actual quantity of this kit inside this opportunity
        qty = Decimal("0.0")
        for item in opportunity.items:
            if item.opportunity_kit_id == kit.id:
                qty += Decimal(str(item.quantidade or 0))
        for ri in opportunity.rental_items:
            if ri.opportunity_kit_id == kit.id:
                qty += Decimal(str(ri.quantidade or 0))
        if qty == Decimal("0.0"):
            qty = Decimal("1.0")
        
        # --- ENTRADAS ---
        if is_rental_opp:
            if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
                prod_sum = sum(Decimal(str(item.get("venda_total_item", 0))) for item in fin["item_summaries"] if item.get("tipo_item") != "SERVICO")
                serv_sum = sum(Decimal(str(item.get("venda_total_item", 0))) for item in fin["item_summaries"] if item.get("tipo_item") == "SERVICO")
                vlr_inst = Decimal(str(summary.get("valor_venda_instalacao", 0) or summary.get("vlr_instal_calc", 0) or 0))
                vlr_manut = Decimal(str(summary.get("valor_venda_manutencao", 0) or summary.get("vlt_manut", 0) or 0))
                
                total_servicos += (prod_sum + serv_sum + vlr_inst + vlr_manut) * qty
                
                # Custos operacionais do kit de instalação (não multiplicados pelo prazo do contrato)
                vlt_custo_op_manutencao += (Decimal(str(summary.get("custo_operacional_mensal_kit") or 0.0)) + Decimal(str(summary.get("custo_mensal_bloco_7") or 0.0))) * qty
                vlt_custo_op_monitoramento += Decimal(str(summary.get("custo_monitoramento_unitario") or 0.0)) * qty
            else: # LOCACAO or COMODATO
                total_produtos += Decimal(str(summary.get("valor_mensal_locacao_base", 0) or 0)) * prazo_contrato * qty
                
                vlr_inst = Decimal(str(summary.get("vlr_instal_calc", 0) or 0))
                vlr_manut = Decimal(str(summary.get("manutencao_mensal", 0) or summary.get("vlt_manut", 0) or 0))
                vlr_monit = Decimal(str(summary.get("venda_unit_monitoramento", 0) or 0))
                
                total_servicos += (
                    vlr_inst +
                    (vlr_manut + vlr_monit) * prazo_contrato
                ) * qty
                
                # Custos operacionais do kit de locação/comodato (multiplicados pelo prazo do contrato)
                vlt_custo_op_manutencao += (Decimal(str(summary.get("custo_operacional_mensal_kit") or 0.0)) + Decimal(str(summary.get("custo_mensal_bloco_7") or 0.0))) * prazo_contrato * qty
                vlt_custo_op_monitoramento += Decimal(str(summary.get("custo_monitoramento_unitario") or 0.0)) * prazo_contrato * qty
        else: # Standard sales/venda opportunity
            if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
                prod_sum = sum(Decimal(str(item.get("venda_total_item", 0))) for item in fin["item_summaries"] if item.get("tipo_item") != "SERVICO")
                serv_sum = sum(Decimal(str(item.get("venda_total_item", 0))) for item in fin["item_summaries"] if item.get("tipo_item") == "SERVICO")
                
                total_produtos += prod_sum * qty
                
                vlr_inst = Decimal(str(summary.get("valor_venda_instalacao", 0) or summary.get("vlr_instal_calc", 0) or 0))
                vlr_manut = Decimal(str(summary.get("valor_venda_manutencao", 0) or summary.get("vlt_manut", 0) or 0))
                
                total_servicos += (serv_sum + vlr_inst + vlr_manut) * qty
            else: # LOCACAO or COMODATO
                prazo_mensalidades = Decimal(str(summary.get("prazo_mensalidades") or 0))
                total_produtos += Decimal(str(summary.get("valor_mensal_locacao_base", 0) or 0)) * prazo_mensalidades * qty
                
                vlr_inst = Decimal(str(summary.get("vlr_instal_calc", 0) or 0))
                vlr_manut = Decimal(str(summary.get("manutencao_mensal", 0) or summary.get("vlt_manut", 0) or 0))
                vlr_monit = Decimal(str(summary.get("venda_unit_monitoramento", 0) or 0))
                
                total_servicos += (
                    vlr_inst +
                    (vlr_manut + vlr_monit) * prazo_mensalidades
                ) * qty
            
        total_st_total += Decimal(str(summary.get("total_st_total", 0) or 0)) * qty
        
        # --- SAÍDAS: Impostos de Compra ---
        # Accumulated precisely from components inside the loop below
        custo_base_produtos += Decimal(str(summary.get("custo_aquisicao_produtos", 0) or 0)) * qty
        
        # --- SAÍDAS: Impostos de Venda ---
        if is_rental_opp:
            if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
                vlt_pis_val = Decimal(str(summary.get("vlt_pis", 0) or 0)) * qty
                vlt_cofins_val = Decimal(str(summary.get("vlt_cofins", 0) or 0)) * qty
                vlt_csll_val = Decimal(str(summary.get("vlt_csll", 0) or 0)) * qty
                vlt_irpj_val = Decimal(str(summary.get("vlt_irpj", 0) or 0)) * qty
                vlt_icms_val = Decimal(str(summary.get("vlt_icms", 0) or 0)) * qty
                vlt_iss_val = Decimal(str(summary.get("vlt_iss", 0) or 0)) * qty
                
                vlt_pis += vlt_pis_val
                vlt_cofins += vlt_cofins_val
                vlt_csll += vlt_csll_val
                vlt_irpj += vlt_irpj_val
                vlt_icms += vlt_icms_val
                vlt_iss += vlt_iss_val
                
                impostos_instalacao_pis += vlt_pis_val
                impostos_instalacao_cofins += vlt_cofins_val
                impostos_instalacao_csll += vlt_csll_val
                impostos_instalacao_irpj += vlt_irpj_val
                impostos_instalacao_icms += vlt_icms_val
                impostos_instalacao_iss += vlt_iss_val
            else: # LOCACAO or COMODATO
                # Skip rental taxes here; calculated precisely at the end of the DRE function
                pass
        else: # Standard sales/venda opportunity
            vlt_pis_val = Decimal(str(summary.get("vlt_pis", 0) or 0)) * qty
            vlt_cofins_val = Decimal(str(summary.get("vlt_cofins", 0) or 0)) * qty
            vlt_csll_val = Decimal(str(summary.get("vlt_csll", 0) or 0)) * qty
            vlt_irpj_val = Decimal(str(summary.get("vlt_irpj", 0) or 0)) * qty
            vlt_icms_val = Decimal(str(summary.get("vlt_icms", 0) or 0)) * qty
            vlt_iss_val = Decimal(str(summary.get("vlt_iss", 0) or 0)) * qty
            
            vlt_pis += vlt_pis_val
            vlt_cofins += vlt_cofins_val
            vlt_csll += vlt_csll_val
            vlt_irpj += vlt_irpj_val
            vlt_icms += vlt_icms_val
            vlt_iss += vlt_iss_val
            
            impostos_instalacao_pis += vlt_pis_val
            impostos_instalacao_cofins += vlt_cofins_val
            impostos_instalacao_csll += vlt_csll_val
            impostos_instalacao_irpj += vlt_irpj_val
            impostos_instalacao_icms += vlt_icms_val
            impostos_instalacao_iss += vlt_iss_val
        
        # --- SAÍDAS: Despesas de Venda ---
        vlt_frete += Decimal(str(summary.get("vlt_frete_venda", 0) or 0)) * qty
        if is_rental_opp:
            if kit.tipo_contrato in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]:
                vlt_comissao += Decimal(str(summary.get("vlt_comissao", 0) or 0)) * qty
                vlt_despesas_adm += Decimal(str(summary.get("vlt_despesas_adm", 0) or 0)) * qty
            else:
                vlt_comissao += Decimal(str(summary.get("vlt_comissao", 0) or 0)) * prazo_contrato * qty
                vlt_despesas_adm += Decimal(str(summary.get("vlt_despesas_adm", 0) or 0)) * prazo_contrato * qty
        else:
            vlt_comissao += Decimal(str(summary.get("vlt_comissao", 0) or 0)) * qty
            vlt_despesas_adm += Decimal(str(summary.get("vlt_despesas_adm", 0) or 0)) * qty
        
        total_venda += (Decimal(str(summary.get("faturamento_total_venda") or summary.get("venda_total") or 0)) *
                        (prazo_contrato if (is_rental_opp and kit.tipo_contrato not in ["VENDA_EQUIPAMENTOS", "INSTALACAO"]) else Decimal("1.0")) *
                        qty)

        # Accumulate supplier values from kit components
        for item_sum in fin.get("item_summaries", []):
            p_id = item_sum.get("product_id")
            o_id = item_sum.get("own_service_id")
            ref_id = p_id or o_id
            if ref_id:
                ref_uuid = UUID(ref_id) if isinstance(ref_id, str) else ref_id
                kit_item = next((ki for ki in kit.items if (ki.product_id == ref_uuid or ki.own_service_id == ref_uuid)), None)
                qty_in_kit = Decimal(str(kit_item.quantidade_no_kit)) if kit_item else Decimal("1.0")
                component_qty = qty * qty_in_kit
                
                if item_sum.get("tipo_item") == "SERVICO":
                    sup_name = "Serviços Próprios"
                    if p_id:
                        p_uuid = UUID(p_id) if isinstance(p_id, str) else p_id
                        if p_uuid in product_suppliers:
                            sup_name = product_suppliers[p_uuid]
                    base_forn = Decimal(str(item_sum.get("custo_base_unitario_item") or 0.0))
                    supplier_map[sup_name] = supplier_map.get(sup_name, Decimal("0.0")) + (base_forn * component_qty)
                else:
                    p_uuid = UUID(p_id) if isinstance(p_id, str) else p_id
                    sup_name = product_suppliers.get(p_uuid, "Não Cadastrado")
                    
                    pb_item = None
                    for pb in purchase_budgets:
                        pb_item = next((pbi for pbi in pb.items if pbi.product_id == p_uuid), None)
                        if pb_item:
                            break
                    
                    difal_val, st_val, ipi_val = get_purchase_tax_breakdown(p_uuid, pb_item)
                    c_cost_total = Decimal(str(item_sum.get("custo_total_item_no_kit") or 0.0)) * qty
                    c_tax_total = (difal_val + st_val + ipi_val) * component_qty
                    
                    # Subtrair frete de compra de base_forn_total para não duplicar, pois c_cost_total já engloba o frete
                    frete_compra_unit = Decimal(str(pb_item.frete_valor)) / Decimal(str(pb_item.quantidade)) if (pb_item and pb_item.frete_valor and pb_item.quantidade > 0) else Decimal("0.0")
                    frete_total = frete_compra_unit * component_qty
                    base_forn_total = c_cost_total - c_tax_total - frete_total
                    total_frete_compra += frete_total
                    
                    supplier_map[sup_name] = supplier_map.get(sup_name, Decimal("0.0")) + base_forn_total
                    
                    # Accumulate purchase taxes precisely matching reports.py
                    purchase_ipi += ipi_val * component_qty
                    purchase_st += st_val * component_qty
                    purchase_difal += difal_val * component_qty

    # Process direct sales items (without kit)
    for item in opportunity.items:
        if not item.opportunity_kit_id:
            item_qty = Decimal(str(item.quantidade or 1.0))
            if item.product_id:
                p_uuid = item.product_id
                sup_name = product_suppliers.get(p_uuid, "Não Cadastrado")
                
                pb_item = None
                for pb in purchase_budgets:
                    pb_item = next((pbi for pbi in pb.items if pbi.product_id == p_uuid), None)
                    if pb_item:
                        break
                        
                difal_val, st_val, ipi_val = get_purchase_tax_breakdown(p_uuid, pb_item)
                cost_total = Decimal(str(getattr(item, 'custo_total_aquisicao', None) or getattr(item, 'custo_unit_base', Decimal("0.0")))) * item_qty
                tax_total = (difal_val + st_val + ipi_val) * item_qty
                
                # Subtrair frete de compra de base_forn_total para não duplicar, pois cost_total já engloba o frete
                frete_compra_unit = Decimal(str(pb_item.frete_valor)) / Decimal(str(pb_item.quantidade)) if (pb_item and pb_item.frete_valor and pb_item.quantidade > 0) else Decimal("0.0")
                frete_total = frete_compra_unit * item_qty
                base_forn_total = cost_total - tax_total - frete_total
                total_frete_compra += frete_total
                
                supplier_map[sup_name] = supplier_map.get(sup_name, Decimal("0.0")) + base_forn_total
                
                total_produtos += Decimal(str(item.total_venda or 0.0))
                custo_base_produtos += Decimal(str(item.custo_unit_base or 0.0)) * item_qty
                
                # Purchase Taxes
                purchase_ipi += ipi_val * item_qty
                purchase_st += st_val * item_qty
                purchase_difal += difal_val * item_qty
            elif item.own_service_id:
                sup_name = "Serviços Próprios"
                base_forn = Decimal(str(item.custo_unit_base or 0.0))
                supplier_map[sup_name] = supplier_map.get(sup_name, Decimal("0.0")) + (base_forn * item_qty)
                total_servicos += Decimal(str(item.total_venda or 0.0))

            total_venda += Decimal(str(item.total_venda or 0.0))
            
            # Sell-side Taxes
            pis_direct = Decimal(str(item.pis_unit or 0.0)) * item_qty
            cofins_direct = Decimal(str(item.cofins_unit or 0.0)) * item_qty
            csll_direct = Decimal(str(item.csll_unit or 0.0)) * item_qty
            irpj_direct = Decimal(str(item.irpj_unit or 0.0)) * item_qty
            icms_direct = Decimal(str(item.icms_unit or 0.0)) * item_qty
            iss_direct = Decimal(str(item.iss_unit or 0.0)) * item_qty

            vlt_pis += pis_direct
            vlt_cofins += cofins_direct
            vlt_csll += csll_direct
            vlt_irpj += irpj_direct
            vlt_icms += icms_direct
            vlt_iss += iss_direct

            impostos_instalacao_pis += pis_direct
            impostos_instalacao_cofins += cofins_direct
            impostos_instalacao_csll += csll_direct
            impostos_instalacao_irpj += irpj_direct
            impostos_instalacao_icms += icms_direct
            impostos_instalacao_iss += iss_direct
            
            # Expenses
            vlt_frete += Decimal(str(item.frete_venda_unit or 0.0)) * item_qty
            vlt_comissao += Decimal(str(item.comissao_unit or 0.0)) * item_qty
            vlt_despesas_adm += Decimal(str(item.despesa_adm_unit or 0.0)) * item_qty

    # Process direct rental/locação items (without kit)
    for ri in opportunity.rental_items:
        if not ri.opportunity_kit_id:
            qty = Decimal(str(ri.quantidade or 1.0))
            prazo = Decimal(str(ri.prazo_contrato or 36))
            valor_mensal = Decimal(str(ri.valor_mensal or 0.0))
            valor_instalacao = Decimal(str(ri.valor_instalacao_item or 0.0))
            
            # Revenues (Entradas)
            receita_locacao = valor_mensal * prazo * qty
            receita_instalacao = valor_instalacao * qty
            
            total_produtos += receita_locacao
            total_servicos += receita_instalacao
            total_venda += receita_locacao + receita_instalacao
            
            # Suppliers & Costs
            if ri.product_id:
                p_uuid = ri.product_id
                sup_name = product_suppliers.get(p_uuid, "Não Cadastrado")
                
                pb_item = None
                for pb in purchase_budgets:
                    pb_item = next((pbi for pbi in pb.items if pbi.product_id == p_uuid), None)
                    if pb_item:
                        break
                        
                difal_val, st_val, ipi_val = get_purchase_tax_breakdown(p_uuid, pb_item)
                cost_total = Decimal(str(getattr(ri, 'custo_total_aquisicao', None) or getattr(ri, 'custo_aquisicao_unit', Decimal("0.0")))) * qty
                tax_total = (difal_val + st_val + ipi_val) * qty
                
                # Subtrair frete de compra de base_forn_total para não duplicar, pois cost_total já engloba o frete
                frete_compra_unit = Decimal(str(pb_item.frete_valor)) / Decimal(str(pb_item.quantidade)) if (pb_item and pb_item.frete_valor and pb_item.quantidade > 0) else Decimal("0.0")
                frete_total = frete_compra_unit * qty
                base_forn_total = cost_total - tax_total - frete_total
                total_frete_compra += frete_total
                
                supplier_map[sup_name] = supplier_map.get(sup_name, Decimal("0.0")) + base_forn_total
                
                custo_base_produtos += Decimal(str(ri.custo_aquisicao_unit or 0.0)) * qty
                
                # Purchase Taxes
                purchase_ipi += ipi_val * qty
                purchase_st += st_val * qty
                purchase_difal += difal_val * qty

            if ri.valor_instalacao_item and float(ri.valor_instalacao_item) > 0.0:
                supplier_map["Serviços Próprios"] = supplier_map.get("Serviços Próprios", Decimal("0.0")) + (Decimal(str(ri.valor_instalacao_item)) * qty)

            # Sell-side Taxes: calculated precisely at the end of the DRE function
            pass
            
            # Expenses (comissão e despesas adm)
            vlt_comissao += (receita_locacao + receita_instalacao) * Decimal(str(opportunity.perc_comissao_rental or opportunity.perc_comissao or 0.0)) / 100
            vlt_despesas_adm += (receita_locacao + receita_instalacao) * Decimal(str(opportunity.perc_despesa_adm or 0.0)) / 100
            
            # Custos operacionais do item direto de locação/comodato
            if ri.is_kit_instalacao:
                vlt_custo_op_manutencao += Decimal(str(ri.custo_manut_mensal or 0.0)) * qty
            else:
                vlt_custo_op_manutencao += Decimal(str(ri.custo_manut_mensal or 0.0)) * prazo * qty

    if is_rental_opp:
        # Determine tax rates based on the first item
        first_rental_item = opportunity.rental_items[0] if opportunity.rental_items else None
        if first_rental_item and first_rental_item.opportunity_kit_id:
            aliq_pis_rental = Decimal(str(first_rental_item.kit_pis or 0.0))
            aliq_cofins_rental = Decimal(str(first_rental_item.kit_cofins or 0.0))
            aliq_csll_rental = Decimal(str(first_rental_item.kit_csll or 0.0))
            aliq_irpj_rental = Decimal(str(first_rental_item.kit_irpj or 0.0))
            aliq_iss_rental = Decimal(str(first_rental_item.kit_iss or 0.0))
        else:
            aliq_pis_rental = Decimal(str(opportunity.perc_pis_rental or 0.0))
            aliq_cofins_rental = Decimal(str(opportunity.perc_cofins_rental or 0.0))
            aliq_csll_rental = Decimal(str(opportunity.perc_csll_rental or 0.0))
            aliq_irpj_rental = Decimal(str(opportunity.perc_irpj_rental or 0.0))
            aliq_iss_rental = Decimal(str(opportunity.perc_iss_rental or 0.0))

        # Reset and calculate rental & installation taxes dynamically matching reports.py
        impostos_locacao_pis = Decimal("0.0")
        impostos_locacao_cofins = Decimal("0.0")
        impostos_locacao_csll = Decimal("0.0")
        impostos_locacao_irpj = Decimal("0.0")
        impostos_locacao_iss = Decimal("0.0")

        impostos_instalacao_pis = Decimal("0.0")
        impostos_instalacao_cofins = Decimal("0.0")
        impostos_instalacao_csll = Decimal("0.0")
        impostos_instalacao_irpj = Decimal("0.0")
        impostos_instalacao_iss = Decimal("0.0")
        impostos_instalacao_icms = Decimal("0.0")

        prazo_instalacao = opportunity.prazo_instalacao_meses or 0

        # Loop 1: Locacao Taxes (skips is_kit_instalacao)
        for item in opportunity.rental_items:
            q = Decimal(str(item.quantidade or 1.0))
            if item.is_kit_instalacao:
                continue
                
            faturamento = Decimal(str(item.valor_mensal or getattr(item, "kit_valor_mensal", 0.0) or 0.0)) * q
            if item.opportunity_kit_id:
                mon = Decimal(str(item.kit_venda_unit_monitoramento or 0.0)) * q
                man = Decimal(str(item.kit_vlt_manut or item.manutencao_locacao or 0.0)) * q
                loc = faturamento - man - mon
                rate_pis = Decimal(str(item.kit_pis or 0.0))
                rate_cofins = Decimal(str(item.kit_cofins or 0.0))
                rate_csll = Decimal(str(item.kit_csll or 0.0))
                rate_irpj = Decimal(str(item.kit_irpj or 0.0))
                rate_iss = Decimal(str(item.kit_iss or 0.0))
                is_sep = bool(item.kit_faturamento_separado)
            else:
                mon = Decimal("0.0")
                man = Decimal("0.0")
                loc = faturamento
                rate_pis = aliq_pis_rental
                rate_cofins = aliq_cofins_rental
                rate_csll = aliq_csll_rental
                rate_irpj = aliq_irpj_rental
                rate_iss = aliq_iss_rental
                is_sep = False
                
            is_com = item.tipo_contrato_kit == 'COMODATO' or (not item.opportunity_kit_id and opportunity.tipo_receita_rental == 'COMODATO')
            
            def calc_tax(is_iss: bool, rate: Decimal):
                if rate <= 0: return Decimal("0.0")
                if is_iss and not is_com: return Decimal("0.0")
                if not is_sep: return (loc + man + mon) * (rate / Decimal("100.0"))
                if is_iss: return (man + mon) * (rate / Decimal("100.0"))
                return (loc + man + mon) * (rate / Decimal("100.0"))
                
            c_pis = calc_tax(False, rate_pis)
            c_cofins = calc_tax(False, rate_cofins)
            c_csll = calc_tax(False, rate_csll)
            c_irpj = calc_tax(False, rate_irpj)
            c_iss = calc_tax(True, rate_iss)
            
            total_calc = c_pis + c_cofins + c_csll + c_irpj + c_iss
            
            kit_financials_summary = None
            if item.opportunity_kit_id:
                kf = kits_financials.get(item.opportunity_kit_id)
                if kf and "summary" in kf:
                    kit_financials_summary = kf["summary"]
                    
            if kit_financials_summary:
                impostos = Decimal(str(kit_financials_summary.get("valor_impostos") or 0.0)) * q
            else:
                impostos = Decimal(str(item.impostos_mensal or 0.0)) * q
                
            ratio = impostos / total_calc if total_calc > 0 else Decimal("1.0")
            
            prazo_item_raw = int(item.prazo_contrato or prazo_contrato)
            prazo_item = max(0, prazo_item_raw - prazo_instalacao)
            
            impostos_locacao_pis += c_pis * ratio * prazo_item
            impostos_locacao_cofins += c_cofins * ratio * prazo_item
            impostos_locacao_csll += c_csll * ratio * prazo_item
            impostos_locacao_irpj += c_irpj * ratio * prazo_item
            impostos_locacao_iss += c_iss * ratio * prazo_item

        # Loop 2: Installation Taxes (only is_kit_instalacao)
        for item in opportunity.rental_items:
            q = Decimal(str(item.quantidade or 1.0))
            if not item.is_kit_instalacao:
                continue
                
            faturamento = Decimal(str(item.valor_mensal or getattr(item, "kit_valor_mensal", 0.0) or 0.0)) * q
            if item.opportunity_kit_id:
                rate_pis = Decimal(str(item.kit_pis or 0.0))
                rate_cofins = Decimal(str(item.kit_cofins or 0.0))
                rate_csll = Decimal(str(item.kit_csll or 0.0))
                rate_irpj = Decimal(str(item.kit_irpj or 0.0))
                rate_iss = Decimal(str(item.kit_iss or 0.0))
            else:
                rate_pis = aliq_pis_rental
                rate_cofins = aliq_cofins_rental
                rate_csll = aliq_csll_rental
                rate_irpj = aliq_irpj_rental
                rate_iss = aliq_iss_rental
                
            c_pis = faturamento * (rate_pis / Decimal("100.0"))
            c_cofins = faturamento * (rate_cofins / Decimal("100.0"))
            c_csll = faturamento * (rate_csll / Decimal("100.0"))
            c_irpj = faturamento * (rate_irpj / Decimal("100.0"))
            c_iss = faturamento * (rate_iss / Decimal("100.0"))
            
            total_calc = c_pis + c_cofins + c_csll + c_irpj + c_iss
            impostos = Decimal(str(item.impostos_mensal or 0.0)) * q
            ratio = impostos / total_calc if total_calc > 0 else Decimal("1.0")
            
            impostos_instalacao_pis += c_pis * ratio
            impostos_instalacao_cofins += c_cofins * ratio
            impostos_instalacao_csll += c_csll * ratio
            impostos_instalacao_irpj += c_irpj * ratio
            impostos_instalacao_iss += c_iss * ratio
            impostos_instalacao_icms += Decimal(str(getattr(item, "icms_abatido_unit", 0.0) or getattr(item, "icms_unit", 0.0) or 0.0)) * q

        # Apply to master DRE variables
        vlt_pis = impostos_instalacao_pis + impostos_locacao_pis
        vlt_cofins = impostos_instalacao_cofins + impostos_locacao_cofins
        vlt_csll = impostos_instalacao_csll + impostos_locacao_csll
        vlt_irpj = impostos_instalacao_irpj + impostos_locacao_irpj
        vlt_iss = impostos_instalacao_iss + impostos_locacao_iss
        vlt_icms = impostos_instalacao_icms
    else:
        # For non-rental opportunities, define default rental percentage variables as zero
        aliq_pis_rental = Decimal("0.0")
        aliq_cofins_rental = Decimal("0.0")
        aliq_csll_rental = Decimal("0.0")
        aliq_irpj_rental = Decimal("0.0")
        aliq_iss_rental = Decimal("0.0")

    restituicao_icms_st = total_st_total if is_interestadual else Decimal("0.0")
    
    # Net the ST refund from sales taxes for sales opportunities
    if not is_rental_opp and is_interestadual and restituicao_icms_st > 0:
        deduction = restituicao_icms_st
        if vlt_icms >= deduction:
            vlt_icms -= deduction
            deduction = Decimal("0.0")
        else:
            deduction -= vlt_icms
            vlt_icms = Decimal("0.0")
            
        if deduction > 0:
            if vlt_cofins >= deduction:
                vlt_cofins -= deduction
                deduction = Decimal("0.0")
            else:
                deduction -= vlt_cofins
                vlt_cofins = Decimal("0.0")
                
        if deduction > 0:
            if vlt_pis >= deduction:
                vlt_pis -= deduction
                deduction = Decimal("0.0")
            else:
                deduction -= vlt_pis
                vlt_pis = Decimal("0.0")
        
        # Zero out the entries field since it has been neted against sales taxes
        restituicao_icms_st = Decimal("0.0")
        
    total_entradas = total_produtos + total_servicos + restituicao_icms_st
    
    ipi_compra_pct = (purchase_ipi / custo_base_produtos * 100) if custo_base_produtos > 0 else Decimal("0.0")
    st_compra_pct = (purchase_st / custo_base_produtos * 100) if custo_base_produtos > 0 else Decimal("0.0")
    difal_compra_pct = (purchase_difal / custo_base_produtos * 100) if custo_base_produtos > 0 else Decimal("0.0")
    
    first_kit = kits[0] if kits else None
    if first_kit:
        pis_venda_pct = Decimal(str(first_kit.aliq_pis or 0.0))
        cofins_venda_pct = Decimal(str(first_kit.aliq_cofins or 0.0))
        icms_venda_pct = Decimal(str(first_kit.aliq_icms or 0.0))
        if is_interestadual and getattr(first_kit, "tipo_contrato", None) == "VENDA_EQUIPAMENTOS":
            icms_venda_pct = Decimal("12.0")
        iss_venda_pct = Decimal(str(first_kit.aliq_iss or 0.0))
        irpj_venda_pct = Decimal(str(first_kit.aliq_irpj or 0.0))
        csll_venda_pct = Decimal(str(first_kit.aliq_csll or 0.0))
    else:
        pis_venda_pct = Decimal("0.0")
        cofins_venda_pct = Decimal("0.0")
        icms_venda_pct = Decimal("0.0")
        iss_venda_pct = Decimal("0.0")
        irpj_venda_pct = Decimal("0.0")
        csll_venda_pct = Decimal("0.0")

    total_receita_venda = total_produtos + total_servicos
    frete_pct = (vlt_frete / total_receita_venda * 100) if total_receita_venda > 0 else Decimal("0.0")
    comissao_pct = (vlt_comissao / total_receita_venda * 100) if total_receita_venda > 0 else Decimal("0.0")
    despesas_adm_pct = (vlt_despesas_adm / total_receita_venda * 100) if total_receita_venda > 0 else Decimal("0.0")
        
    ipi_venda_pct = Decimal("0.0")

    # Adicionar o frete de compra (Frete CIF) consolidado aos fornecedores
    if total_frete_compra > 0:
        supplier_map["Frete"] = supplier_map.get("Frete", Decimal("0.0")) + total_frete_compra
    
    fornecedores = [{"nome": name, "valor": round(val, 2)} for name, val in supplier_map.items()]
    total_fornecedores = sum(item["valor"] for item in fornecedores)
    
    total_custos_operacionais = vlt_custo_op_monitoramento + vlt_custo_op_manutencao
    
    total_saidas = (
        total_fornecedores +
        purchase_ipi + purchase_st + purchase_difal +
        vlt_pis + vlt_cofins + vlt_icms + vlt_iss + vlt_irpj + vlt_csll +
        vlt_frete + vlt_comissao + vlt_despesas_adm +
        total_custos_operacionais
    )
    
    total_impostos_instalacao = (
        impostos_instalacao_pis +
        impostos_instalacao_cofins +
        impostos_instalacao_csll +
        impostos_instalacao_irpj +
        impostos_instalacao_iss +
        impostos_instalacao_icms
    )
    
    total_impostos_locacao = (
        impostos_locacao_pis +
        impostos_locacao_cofins +
        impostos_locacao_csll +
        impostos_locacao_irpj +
        impostos_locacao_iss
    )
    
    lucro_ebitda = total_entradas - total_saidas
    margem_liquida = (lucro_ebitda / total_entradas * 100) if total_entradas > 0 else Decimal("0.0")
    
    vendedor_nome = opportunity.vendedor.name if opportunity.vendedor else "Não atribuído"
    
    resp_names = [r.user.name for r in opportunity.responsaveis if r.user]
    responsavel_nome = ", ".join(resp_names) if resp_names else "Não atribuído"
        
    data_fechamento = opportunity.updated_at
    closing_history = db.query(SalesBudgetHistory).filter(
        SalesBudgetHistory.sales_budget_id == opportunity_id,
        SalesBudgetHistory.status_novo.in_(["GANHO", "PERDIDO"])
    ).order_by(SalesBudgetHistory.data_movimentacao.desc()).first()
    if closing_history:
        data_fechamento = closing_history.data_movimentacao
        
    cidade = "Não atribuída"
    estado = ""
    if customer:
        cidade = customer.city_nome or cidade
        estado = customer.state_sigla or estado
        
    is_rental = len(opportunity.rental_items) > 0
        
    return {
        "header": {
            "cliente_nome": customer.nome_fantasia or customer.razao_social if customer else "Não informado",
            "cidade": cidade,
            "estado": estado,
            "vendedor_nome": vendedor_nome,
            "responsavel_nome": responsavel_nome,
            "numero_oportunidade": opportunity.numero_orcamento or "Sem número",
            "data_fechamento": data_fechamento,
            "is_rental": is_rental
        },
        "entradas": {
            "total_produtos": round(total_produtos, 2),
            "total_servicos": round(total_servicos, 2),
            "restituicao_icms_st": round(restituicao_icms_st, 2),
            "total_entradas": round(total_entradas, 2)
        },
        "saidas": {
            "fornecedores": fornecedores,
            "impostos_compra": {
                "ipi": {"percent": round(ipi_compra_pct, 2), "valor": round(purchase_ipi, 2)},
                "icms_st": {"percent": round(st_compra_pct, 2), "valor": round(purchase_st, 2)},
                "difal": {"percent": round(difal_compra_pct, 2), "valor": round(purchase_difal, 2)}
            },
            "impostos_venda": {
                "pis": {"percent": round(pis_venda_pct, 2), "valor": round(vlt_pis, 2)},
                "cofins": {"percent": round(cofins_venda_pct, 2), "valor": round(vlt_cofins, 2)},
                "icms": {"percent": round(icms_venda_pct, 2), "valor": round(vlt_icms, 2)},
                "ipi": {"percent": round(ipi_venda_pct, 2), "valor": round(vlt_ipi_venda, 2)},
                "iss": {"percent": round(iss_venda_pct, 2), "valor": round(vlt_iss, 2)},
                "irpj": {"percent": round(irpj_venda_pct, 2), "valor": round(vlt_irpj, 2)},
                "csll": {"percent": round(csll_venda_pct, 2), "valor": round(vlt_csll, 2)}
            },
            "impostos_instalacao": {
                "pis": {"percent": round(pis_venda_pct, 2), "valor": round(impostos_instalacao_pis, 2)},
                "cofins": {"percent": round(cofins_venda_pct, 2), "valor": round(impostos_instalacao_cofins, 2)},
                "icms": {"percent": round(icms_venda_pct, 2), "valor": round(impostos_instalacao_icms, 2)},
                "iss": {"percent": round(iss_venda_pct, 2), "valor": round(impostos_instalacao_iss, 2)},
                "irpj": {"percent": round(irpj_venda_pct, 2), "valor": round(impostos_instalacao_irpj, 2)},
                "csll": {"percent": round(csll_venda_pct, 2), "valor": round(impostos_instalacao_csll, 2)},
                "total": round(total_impostos_instalacao, 2)
            },
            "impostos_locacao": {
                "pis": {"percent": round(aliq_pis_rental, 2), "valor": round(impostos_locacao_pis, 2)},
                "cofins": {"percent": round(aliq_cofins_rental, 2), "valor": round(impostos_locacao_cofins, 2)},
                "irpj": {"percent": round(aliq_irpj_rental, 2), "valor": round(impostos_locacao_irpj, 2)},
                "csll": {"percent": round(aliq_csll_rental, 2), "valor": round(impostos_locacao_csll, 2)},
                "iss": {"percent": round(aliq_iss_rental, 2), "valor": round(impostos_locacao_iss, 2)},
                "total": round(total_impostos_locacao, 2)
            },
            "despesas_venda": {
                "frete": {"percent": round(frete_pct, 2), "valor": round(vlt_frete, 2)},
                "comissao": {"percent": round(comissao_pct, 2), "valor": round(vlt_comissao, 2)},
                "despesas_administrativas": {"percent": round(despesas_adm_pct, 2), "valor": round(vlt_despesas_adm, 2)}
            },
            "custos_operacionais": {
                "monitoramento": {
                    "percent": round((vlt_custo_op_monitoramento / total_entradas * 100) if total_entradas > 0 else Decimal("0.0"), 2),
                    "valor": round(vlt_custo_op_monitoramento, 2)
                },
                "manutencao": {
                    "percent": round((vlt_custo_op_manutencao / total_entradas * 100) if total_entradas > 0 else Decimal("0.0"), 2),
                    "valor": round(vlt_custo_op_manutencao, 2)
                },
                "total": round(vlt_custo_op_monitoramento + vlt_custo_op_manutencao, 2)
            },
            "total_saidas": round(total_saidas, 2)
        },
        "lucro_ebitda": round(lucro_ebitda, 2),
        "margem_liquida": round(margem_liquida, 2)
    }



