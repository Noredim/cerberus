import os
import sys

base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "apps", "api"))
sys.path.append(base_dir)

# Fix SQLAlchemy relation tracking by importing base models that refer to each other
from src.core.database import SessionLocal
from src.modules.companies.models import Company # MUST import required mapping models before Product
from src.modules.ncm.models import Ncm # same
from src.modules.suppliers.models import Supplier
from src.modules.products.models import Product, ProductSupplier
from src.modules.purchase_budgets.service import PurchaseBudgetService

def force_sync_all_products():
    db: SessionLocal = SessionLocal()
    try:
        products = db.query(Product).all()
        total = len(products)
        
        print(f"Starting force sync for {total} products...")
        
        success = 0
        for idx, prod in enumerate(products):
            print(f"[{idx+1}/{total}] Syncing Product ID: {prod.id} for Tenant: {prod.tenant_id}")
            PurchaseBudgetService.sync_product_reference_prices(db, str(prod.id), prod.tenant_id)
            db.commit() # Commit each product singly for safety
            success += 1
            
        print(f"Done! {success}/{total} synchronized.")
    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    force_sync_all_products()
