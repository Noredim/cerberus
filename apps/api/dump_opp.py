from src.modules.tenants.models import Tenant
from src.modules.users.models import User
from src.modules.roles.models import Role
from src.modules.professionals.models import Professional
from src.modules.companies.models import Company
from src.modules.customers.models import Customer
from src.modules.products.models import Product
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.licitacoes.models import Licitacao, LicitacaoLote, LicitacaoItem
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem
from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitItem
from src.core.database import SessionLocal
import json

db = SessionLocal()
try:
    budget = db.query(SalesBudget).filter(SalesBudget.numero_orcamento.like("%STM-198/2026%")).first()
    if not budget:
        budget = db.query(SalesBudget).filter(SalesBudget.titulo.like("%198%")).first()
        
    if budget:
        # Convert budget attributes to dict
        b_dict = {c.name: str(getattr(budget, c.name)) for c in budget.__table__.columns}
        print("Budget:")
        print(json.dumps(b_dict, indent=2))
        
        print("\nItems:")
        for item in budget.items:
            i_dict = {c.name: str(getattr(item, c.name)) for c in item.__table__.columns}
            print(json.dumps(i_dict, indent=2))
            
            # Print item's kit detail
            if item.opportunity_kit_id:
                kit = db.query(OpportunityKit).filter(OpportunityKit.id == item.opportunity_kit_id).first()
                if kit:
                    k_dict = {c.name: str(getattr(kit, c.name)) for c in kit.__table__.columns}
                    print("Kit details:")
                    print(json.dumps(k_dict, indent=2))
                    
except Exception as e:
    print(f"Error: {e}")
finally:
    db.close()
