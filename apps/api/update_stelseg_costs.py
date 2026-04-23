import os
import sys

sys.path.append("/app")

from src.core.database import SessionLocal
from src.modules.companies.models import Company
from src.modules.products.models import Product
from src.modules.purchase_budgets.service import PurchaseBudgetService

def apply_stelseg_cost_updates():
    db = SessionLocal()
    stelseg = db.query(Company).filter(Company.nome_fantasia.ilike('%STELSEG%')).first()
    if not stelseg:
        print("Company STELSEG not found")
        sys.exit(1)
        
    print(f"Applying updates for {stelseg.nome_fantasia} (ID: {stelseg.id}, Tenant: {stelseg.tenant_id})")
    
    products = db.query(Product).filter(Product.company_id == str(stelseg.id)).all()
    print(f"Found {len(products)} products to recalculate.")
    
    updated_count = 0
    for product in products:
        try:
            PurchaseBudgetService.sync_product_reference_prices(db, str(product.id), stelseg.tenant_id)
            updated_count += 1
        except Exception as e:
            print(f"Error updating product {product.id}: {e}")
            
    db.commit()
    print(f"Successfully updated {updated_count} products.")
    db.close()

if __name__ == '__main__':
    apply_stelseg_cost_updates()
