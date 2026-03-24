import sys
import os

# Setup sys.path to allow importing from src
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.main import app  # Forces loaded registry
from src.core.database import SessionLocal
from src.modules.sales_budgets.models import SalesBudget
from src.modules.companies.models import Company
from datetime import datetime

def migrate():
    db = SessionLocal()
    try:
        budgets = db.query(SalesBudget).filter(SalesBudget.numero_orcamento.like('OV-%')).order_by(SalesBudget.created_at).all()
        count = 0
        ano_vigente = datetime.now().year
        
        for budget in budgets:
            company = db.query(Company).filter(Company.id == budget.company_id).first()
            if not company:
                continue
                
            nom = company.nomenclatura_orcamento or "OV"
            num = company.numero_proposta or 1
            
            budget.numero_orcamento = f"{nom}-{num:03d}/{ano_vigente}"
            company.numero_proposta = num + 1
            
            db.add(budget)
            db.add(company)
            count += 1
            
        db.commit()
        print(f"Migrated {count} budgets successfully.")
    except Exception as e:
        db.rollback()
        print(f"Error migrating budgets: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
