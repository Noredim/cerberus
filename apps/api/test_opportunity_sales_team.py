import sys
import uuid
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append('/app')
import src.main
from src.modules.companies.models import Company, SalesTeam
from src.modules.customers.models import Customer
from src.modules.sales_budgets.schemas import SalesBudgetCreate
from src.modules.sales_budgets.service import create_budget
from src.modules.users.models import User

engine = create_engine("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()
db.begin()

try:
    company = db.query(Company).first()
    assert company is not None
    tenant_id = str(company.tenant_id)

    customer = db.query(Customer).first()
    if not customer:
        customer = Customer(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            razao_social="Cliente Teste LTDA",
            cnpj_cpf="11122233000188"
        )
        db.add(customer)
        db.flush()

    team = SalesTeam(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        company_id=company.id,
        nome="Equipe Venda Teste Oportunidade",
        ativo=True
    )
    db.add(team)
    db.flush()

    budget_payload = SalesBudgetCreate(
        customer_id=str(customer.id),
        vendedor_id=None,
        sales_team_id=team.id,
        titulo="Oportunidade com Equipe de Venda Específica",
        data_orcamento=datetime.now(),
        usar_produtos_gerais=False
    )

    budget = create_budget(db, tenant_id, str(company.id), budget_payload)
    assert budget.id is not None
    assert budget.sales_team_id == team.id
    print(f"Integration Test Passed! Created budget ID: {budget.id} linked to sales_team_id: {budget.sales_team_id}")

except Exception as e:
    print(f"Test failed: {e}")
    raise e
finally:
    db.rollback()
    db.close()
