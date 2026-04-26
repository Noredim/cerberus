from decimal import Decimal
import sys
sys.path.append('c:/cerberus/apps/api/src')
from modules.sales_budgets.service import calculate_rental_item
from modules.sales_budgets.schemas import RentalBudgetItemCreate

item_data = RentalBudgetItemCreate(
    opportunity_kit_id="00000000-0000-0000-0000-000000000000",
    quantidade=Decimal("1"),
    custo_aquisicao_unit=Decimal("2491.55"),
    fator_margem=Decimal("2"),
    taxa_manutencao_anual_item=Decimal("5"),
    usa_taxa_manut_padrao=True,
    is_kit_instalacao=False,
    tipo_contrato_kit="LOCACAO",
    kit_taxa_juros_mensal=Decimal("4.5904"),
    kit_valor_mensal=Decimal("536.36"),
    kit_vlt_manut=Decimal("23.88"),
    kit_valor_impostos=Decimal("72.53"),
    kit_receita_liquida=Decimal("463.83"),
    kit_lucro_mensal=Decimal("263.83"),
)

rental_defaults = {
    "tipo_receita_rental": "LOCACAO_PURA",
    "prazo_contrato_meses": 36,
    "prazo_instalacao_meses": 0,
    "taxa_juros_mensal": 0,
    "taxa_manutencao_anual": 5,
    "perc_pis_rental": 0.65,
    "perc_cofins_rental": 3,
    "perc_csll_rental": 1.08,
    "perc_irpj_rental": 4.8
}

res = calculate_rental_item(item_data, rental_defaults)
for k, v in res.items():
    print(f"{k}: {v}")
