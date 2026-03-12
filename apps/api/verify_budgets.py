import sys
import os
# Add src to path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.append(current_dir)

from src.database import SessionLocal
from src.modules.products.models import Product
from src.modules.opportunities.models import Opportunity, OpportunityBudgetItem
from src.modules.opportunities import services_budget
from src.modules.companies.models import Company

def run_verify():
    db = SessionLocal()
    tenant_id = "VERIFY_TENANT"
    try:
        print(f"Verificando tenant: {tenant_id}")
        
        # 1. Garantir empresa
        company = db.query(Company).filter_by(tenant_id=tenant_id).first()
        if not company:
            company = Company(tenant_id=tenant_id, razao_social="Verify Co", cnpj="00000000000191")
            db.add(company)
            db.flush()
            print("Empresa criada.")

        # 2. Testar ensure_mdm_opportunity
        opp_id = services_budget.ensure_mdm_opportunity(db, tenant_id)
        print(f"Oportunidade MDM ID: {opp_id}")
        
        opp = db.query(Opportunity).filter_by(id=opp_id).first()
        assert opp.titulo_oportunidade == "ORÇAMENTOS AVULSOS - MDM"
        
        # 3. Testar get_product_budget_history
        product = db.query(Product).filter_by(tenant_id=tenant_id).first()
        if not product:
            product = Product(tenant_id=tenant_id, nome="Produto Teste", tipo="EQUIPAMENTO", company_id=company.id)
            db.add(product)
            db.flush()
            print("Produto criado.")
            
        history = services_budget.get_product_budget_history(db, str(product.id))
        print(f"Histórico inicial: {len(history)} itens")
        
        db.commit()
        print("Verificação concluída com sucesso.")
        
    except Exception as e:
        print(f"ERRO: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run_verify()
