import sys
sys.path.append('/app')
try:
    from src.core.database import SessionLocal
    from src.modules.sales_budgets.models import RentalBudgetItem
    db = SessionLocal()
    item = db.query(RentalBudgetItem).order_by(RentalBudgetItem.created_at.desc()).first()
    if item:
        print(f"Item ID: {item.id}, Budget ID: {item.budget_id}, Prazo: {item.prazo_contrato}")
    else:
        print("No items")
except Exception as e:
    print(e)
