import sys
import os
import uuid
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.core.database import SessionLocal
from src.modules.purchase_budgets.models import PurchaseBudgetItem, PurchaseBudget

def main():
    db = SessionLocal()
    try:
        product_uuid = uuid.UUID('69d5cee3-8c61-4692-8a18-8486dcae2947')
        tenant_uuid = uuid.UUID('5cc7aebb-9c18-4bfa-bb17-77a218a26179')
        
        items = db.query(PurchaseBudgetItem).join(PurchaseBudget).filter(
            PurchaseBudgetItem.product_id == str(product_uuid),
            PurchaseBudget.tenant_id == tenant_uuid
        ).order_by(PurchaseBudget.data_orcamento.desc()).limit(20).all()
        
        print(f"Found {len(items)} items for product {product_uuid}")
        for item in items:
            print(f"- Item {item.id} from budget {getattr(item.budget, 'numero_orcamento', 'N/A')}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
