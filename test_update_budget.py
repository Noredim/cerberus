import sys
sys.path.append('/app')
# IMPORT ALL MODELS FIRST TO PREVENT MAPPER ERRORS
from src.core.database import Base, engine, SessionLocal
from src.modules.users.models import *
from src.modules.professionals.models import *
from src.modules.companies.models import *
from src.modules.customers.models import *
from src.modules.products.models import *
from src.modules.opportunity_kits.models import *
from src.modules.sales_budgets.models import *

from decimal import Decimal
from src.modules.sales_budgets.schemas import SalesBudgetUpdate
from src.modules.sales_budgets.service import update_budget

db = SessionLocal()
item = db.query(RentalBudgetItem).first()

budget = db.query(SalesBudget).filter(SalesBudget.id == item.budget_id).first()
budget.prazo_contrato_meses = 12
db.commit()

print(f"Original prazo of item: {item.prazo_contrato}")

payload = {
    "titulo": budget.titulo,
    "customer_id": str(budget.customer_id),
    "prazo_contrato_meses": 12,
    "rental_items": [
        {
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
    ]
}

data = SalesBudgetUpdate(**payload)
update_budget(db, str(budget.tenant_id), str(budget.id), data)
db.commit()

item_after = db.query(RentalBudgetItem).filter(RentalBudgetItem.budget_id == budget.id).first()
print(f"After update prazo: {item_after.prazo_contrato}")
