import os
import sys

current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from src.core.database import SessionLocal
from src.modules.products.models import Product
from src.modules.purchase_budgets.service import PurchaseBudgetService

def force_sync_all():
    db = SessionLocal()
    try:
        products = db.query(Product).all()
        print(f"Encontrados {len(products)} produtos no banco para atualizar.")
        
        updated = 0
        for p in products:
            try:
                # Sincronização global do catálogo (considerando todos os orçamentos, inclusive oportunidades)
                PurchaseBudgetService.sync_product_reference_prices(db, str(p.id), p.tenant_id)
                updated += 1
                if updated % 50 == 0:
                    print(f"Processados {updated} produtos...")
            except Exception as e:
                print(f"Erro no produto {p.id}: {e}")
                
        db.commit()
        print(f"Concluído! Sincronização de {updated} produtos executada com sucesso.")
    finally:
        db.close()

if __name__ == '__main__':
    force_sync_all()
