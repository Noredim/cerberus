import requests
import json
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.modules.tenants.models import Tenant
from src.modules.users.models import User, UserRole, UserRoleEnum
from src.modules.companies.models import Company
from src.core.security import get_password_hash
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_URL = "http://localhost:8000"

def run_tests():
    # 1. Connect to the DB to create/update the ENGENHARIA_PRECO test user
    engine = create_engine("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Find master tenant
        tenant = db.query(Tenant).filter(Tenant.cnpj == "00000000000000").first()
        assert tenant is not None, "Master tenant not found."
        tenant_id = tenant.id

        # Find or create engenharia user
        email = "engenharia@warslab.com.br"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.info(f"Creating test user {email}...")
            user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Engenharia de Preço Test",
                email=email,
                password_hash=get_password_hash("Engenharia123"),
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.is_active = True
            user.password_hash = get_password_hash("Engenharia123")
            db.commit()

        # Enforce ONLY ENGENHARIA_PRECO role
        db.query(UserRole).filter(UserRole.user_id == user.id).delete()
        db.commit()

        role = UserRole(
            id=str(uuid.uuid4()),
            user_id=user.id,
            role=UserRoleEnum.ENGENHARIA_PRECO
        )
        db.add(role)
        db.commit()
        logger.info(f"User {email} successfully configured with role ENGENHARIA_PRECO.")

    finally:
        db.close()

    # 2. Login as Engenharia de Preço
    logger.info("Logging in as engenharia@warslab.com.br...")
    r = requests.post(f"{API_URL}/auth/login", data={"username": email, "password": "Engenharia123"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]

    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": tenant_id
    }

    # Helper function to check forbidden routes
    def assert_forbidden(method, endpoint, json_payload=None):
        url = f"{API_URL}{endpoint}"
        r = requests.request(method, url, json=json_payload, headers=headers)
        assert r.status_code == 403, f"Expected 403 for {method} {endpoint}, got {r.status_code}: {r.text}"
        assert "Acesso negado" in r.json()["detail"] or "Você não tem acesso" in r.json()["detail"] or "O usuário Master Admin" in r.json()["detail"]
        logger.info(f"OK: {method} {endpoint} is correctly blocked (403 Forbidden)")

    # Helper function to check allowed routes
    def assert_allowed(method, endpoint, json_payload=None):
        url = f"{API_URL}{endpoint}"
        r = requests.request(method, url, json=json_payload, headers=headers)
        # 200, 201, 204 are typical successes. Paging may have other outputs.
        # We just want to make sure it doesn't return 403 Forbidden
        assert r.status_code != 403, f"Expected allowed for {method} {endpoint}, but got 403: {r.text}"
        logger.info(f"OK: {method} {endpoint} is allowed (Status {r.status_code})")

    # 3. Test Restricted Routes (should be blocked)
    logger.info("\n--- TESTING RESTRICTED ENDPOINTS ---")
    assert_forbidden("GET", "/users")
    assert_forbidden("GET", "/fiscal/ncm/123")
    assert_forbidden("GET", "/dashboards/kpis")
    assert_forbidden("GET", "/document-templates")
    assert_forbidden("GET", "/sales-proposals")
    assert_forbidden("GET", "/man-hours")
    assert_forbidden("GET", "/own-services")
    assert_forbidden("GET", "/roles")
    assert_forbidden("GET", "/professionals")
    assert_forbidden("GET", "/profiles")
    assert_forbidden("GET", "/tenants")
    assert_forbidden("GET", "/tax-benefits")
    assert_forbidden("GET", "/cadastro/ncm-st")
    assert_forbidden("POST", "/ncm")

    # 4. Test Allowed Routes (should NOT be 403)
    logger.info("\n--- TESTING PERMITTED ENDPOINTS ---")
    assert_allowed("GET", "/auth/me")
    assert_allowed("GET", "/users/me/companies")
    assert_allowed("GET", "/cadastro/produtos")
    assert_allowed("GET", "/cadastro/formas-pagamento")
    assert_allowed("GET", "/cadastro/clientes")
    assert_allowed("GET", "/cadastro/fornecedores")
    assert_allowed("GET", "/ncm")
    assert_allowed("GET", "/sales-budgets")
    assert_allowed("GET", "/purchase-budgets")
    assert_allowed("GET", "/opportunity-kits")

    logger.info("\nALL ACCESS PROFILE RESTRICTION TESTS PASSED SUCCESSFULLY! ✅")

if __name__ == "__main__":
    run_tests()
