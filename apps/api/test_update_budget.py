import sys
sys.path.append('/app')
from src.core.database import SessionLocal
from src.modules.sales_budgets.models import SalesBudget, RentalBudgetItem
from decimal import Decimal
from src.modules.sales_budgets.service import calculate_rental_item
from src.modules.sales_budgets.schemas import RentalBudgetItemCreate

db = SessionLocal()
item = db.query(RentalBudgetItem).first()

budget = db.query(SalesBudget).filter(SalesBudget.id == item.budget_id).first()
budget.prazo_contrato_meses = 12

print(f"Original prazo of item: {item.prazo_contrato}")

payload_dict = {
    "product_id": str(item.product_id) if item.product_id else None,
    "opportunity_kit_id": str(item.opportunity_kit_id) if item.opportunity_kit_id else None,
    "prazo_contrato": 11, # OVERRIDE TO 11
    "quantidade": 1,
    "custo_aquisicao_unit": 0,
    "ipi_unit": 0,
    "frete_unit": 0,
    "icms_st_unit": 0,
    "difal_unit": 0,
}

item_data = RentalBudgetItemCreate(**payload_dict)

rd = {"prazo_contrato_meses": 12}
calc = calculate_rental_item(item_data, rd)

print(f"Calculated prazo: {calc['prazo_contrato']}")

db.query(RentalBudgetItem).filter(RentalBudgetItem.id == item.id).delete()
db_item = RentalBudgetItem(
    budget_id=budget.id,
    **calc
)
db.add(db_item)
db.commit()

item_after = db.query(RentalBudgetItem).filter(RentalBudgetItem.budget_id == budget.id).first()
print(f"After update prazo: {item_after.prazo_contrato}")
