import sys
import uuid
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append('/app')
import src.main
from src.modules.sales_budgets import service
from src.modules.sales_budgets.models import SalesBudget
from src.modules.sales_budgets.schemas import SalesBudgetUpdate, SalesBudgetHeaderUpdate
from src.modules.companies.models import Company
from src.modules.users.models import User, UserRole, UserRoleEnum, UserCompany
from src.modules.roles.models import Role
from src.modules.professionals.models import Professional
from src.modules.tenants.models import Tenant
from src.modules.customers.models import Customer

# Connect to the test database
engine = create_engine("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Begin transaction
db.begin()

try:
    tenant_id = "test-tenant-lock"
    company_id = uuid.uuid4()
    
    # 1. Setup mock tenant/company safely
    existing_company = db.query(Company).first()
    if existing_company:
        company_id = existing_company.id
        tenant_id = existing_company.tenant_id
        company = existing_company
    else:
        tenant = Tenant(id=tenant_id, name="Test Tenant Lock")
        db.add(tenant)
        db.flush()
        
        company = Company(
            id=company_id,
            tenant_id=tenant_id,
            razao_social="Lock test Company LTDA",
            cnpj="99999999000199",
            municipality_id="1",
            state_id="MT"
        )
        db.add(company)
        db.flush()

    # 1b. Setup mock customer safely
    customer = db.query(Customer).filter(Customer.tenant_id == tenant_id).first()
    if customer:
        customer_id = customer.id
    else:
        customer_id = "cust-lock-id"
        db.add(Customer(
            id=customer_id,
            tenant_id=tenant_id,
            cnpj="11111111000111",
            razao_social="Cliente Teste Lock",
            nome_fantasia="Cliente Teste Lock",
            state_id="MT",
            active=True
        ))
        db.flush()

    # 2. Setup mock users
    # User 1: Admin
    admin_user = User(
        id="admin-user-id-" + str(uuid.uuid4())[:8],
        tenant_id=tenant_id,
        name="Admin Test",
        email="admin-" + str(uuid.uuid4())[:8] + "@test.com",
        password_hash="fake",
        is_active=True
    )
    db.add(admin_user)
    db.flush()
    db.add(UserRole(user_id=admin_user.id, role=UserRoleEnum.ADMIN))
    db.add(UserCompany(user_id=admin_user.id, company_id=company_id, is_default=True))

    # User 2: Gerente
    gerente_user = User(
        id="gerente-user-id-" + str(uuid.uuid4())[:8],
        tenant_id=tenant_id,
        name="Gerente Test",
        email="gerente-" + str(uuid.uuid4())[:8] + "@test.com",
        password_hash="fake",
        is_active=True
    )
    db.add(gerente_user)
    db.flush()
    db.add(UserCompany(user_id=gerente_user.id, company_id=company_id, is_default=True))
    
    role_gerente = Role(tenant_id=tenant_id, company_id=company_id, name="GERENTE", can_perform_sale=True)
    db.add(role_gerente)
    db.flush()
    
    prof_gerente = Professional(
        tenant_id=tenant_id,
        company_id=company_id,
        name="Gerente Professional",
        cpf="11111111111",
        role_id=role_gerente.id,
        user_id=gerente_user.id
    )
    db.add(prof_gerente)

    # User 3: Vendedor
    vendedor_user = User(
        id="vendedor-user-id-" + str(uuid.uuid4())[:8],
        tenant_id=tenant_id,
        name="Vendedor Test",
        email="vendedor-" + str(uuid.uuid4())[:8] + "@test.com",
        password_hash="fake",
        is_active=True
    )
    db.add(vendedor_user)
    db.flush()
    db.add(UserCompany(user_id=vendedor_user.id, company_id=company_id, is_default=True))
    
    role_vendedor = Role(tenant_id=tenant_id, company_id=company_id, name="VENDEDOR", can_perform_sale=True)
    db.add(role_vendedor)
    db.flush()
    
    prof_vendedor = Professional(
        tenant_id=tenant_id,
        company_id=company_id,
        name="Vendedor Professional",
        cpf="22222222222",
        role_id=role_vendedor.id,
        user_id=vendedor_user.id
    )
    db.add(prof_vendedor)
    db.flush()

    # 3. Create a SalesBudget
    budget = SalesBudget(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        company_id=company_id,
        customer_id=customer_id,
        titulo="Lock Test Budget",
        status="GANHO"
    )
    db.add(budget)
    db.flush()

    print("--- Setup Complete ---")

    # --- TEST 1: Block Update in GANHO ---
    print("\n--- Test 1: Block update in GANHO status ---")
    update_data = SalesBudgetUpdate(
        titulo="Updated Title",
        customer_id=customer_id,
        data_orcamento=datetime.now(),
        items=[],
        rental_items=[]
    )
    try:
        service.update_budget(db, tenant_id, str(budget.id), update_data, user_id=admin_user.id)
        raise AssertionError("Test 1 Failed: update_budget did not raise ValueError")
    except ValueError as e:
        print(f"Test 1 Passed! Threw expected error: {e}")
        assert str(e) == "Status não permite mais edição"

    # --- TEST 2: Block Header Update in GANHO ---
    print("\n--- Test 2: Block update_header in GANHO status ---")
    header_data = SalesBudgetHeaderUpdate(titulo="New Header Title", customer_id=customer_id)
    try:
        service.update_header(db, tenant_id, str(budget.id), header_data, user_id=admin_user.id)
        raise AssertionError("Test 2 Failed: update_header did not raise ValueError")
    except ValueError as e:
        print(f"Test 2 Passed! Threw expected error: {e}")
        assert str(e) == "Status não permite mais edição"

    # --- TEST 3: Block Delete in GANHO ---
    print("\n--- Test 3: Block delete_budget in GANHO status ---")
    try:
        service.delete_budget(db, tenant_id, str(budget.id), user_id=admin_user.id)
        raise AssertionError("Test 3 Failed: delete_budget did not raise ValueError")
    except ValueError as e:
        print(f"Test 3 Passed! Threw expected error: {e}")
        assert str(e) == "Status não permite mais edição"

    # --- TEST 4: Reopen GANHO by VENDEDOR (Must Block) ---
    print("\n--- Test 4: Block reopening by VENDEDOR ---")
    try:
        service.reabrir_oportunidade(db, tenant_id, str(budget.id), vendedor_user.id, "Solicito reabertura")
        raise AssertionError("Test 4 Failed: reabrir_oportunidade did not raise PermissionError for VENDEDOR")
    except PermissionError as e:
        print(f"Test 4 Passed! Threw expected permission error: {e}")
    
    # --- TEST 5: Reopen GANHO by GERENTE (Must Succeed) ---
    print("\n--- Test 5: Allow reopening by GERENTE ---")
    service.reabrir_oportunidade(db, tenant_id, str(budget.id), gerente_user.id, "Reabrindo como gerente")
    db.refresh(budget)
    assert budget.status == "EM_LANCAMENTO"
    print("Test 5 Passed! Budget successfully set back to EM_LANCAMENTO.")

    # --- TEST 6: Block Update in PERDIDO ---
    print("\n--- Test 6: Block update in PERDIDO status ---")
    # Set status to PERDIDO
    budget.status = "PERDIDO"
    db.flush()
    try:
        service.update_budget(db, tenant_id, str(budget.id), update_data, user_id=admin_user.id)
        raise AssertionError("Test 6 Failed: update_budget did not raise ValueError for PERDIDO")
    except ValueError as e:
        print(f"Test 6 Passed! Threw expected error: {e}")
        assert str(e) == "Status não permite mais edição"

    # --- TEST 7: Block Reopen in PERDIDO (Even for ADMIN) ---
    print("\n--- Test 7: Block reopening of PERDIDO budget even for ADMIN ---")
    try:
        service.reabrir_oportunidade(db, tenant_id, str(budget.id), admin_user.id, "Quero reabrir perdido")
        raise AssertionError("Test 7 Failed: reabrir_oportunidade did not raise ValueError for PERDIDO")
    except ValueError as e:
        print(f"Test 7 Passed! Threw expected error: {e}")
        assert str(e) == "Status não permite mais edição"

    print("\nAll Opportunity Locking integration tests completed successfully!")

finally:
    # Always rollback transaction to clean up test database changes
    db.rollback()
    db.close()
