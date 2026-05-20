import sys
sys.path.append('/app')
from src.core.database import SessionLocal
from src.modules.sales_budgets.schemas import RentalBudgetItemCreate
from src.modules.sales_budgets.service import calculate_rental_item

rd = {"prazo_contrato_meses": 12}
item = RentalBudgetItemCreate(
    product_id="11111111-1111-1111-1111-111111111111",
    opportunity_kit_id="22222222-2222-2222-2222-222222222222",
    prazo_contrato=11,
    custo_aquisicao_unit=100
)

res = calculate_rental_item(item, rd)
print(f"Calculated prazo: {res['prazo_contrato']}")
