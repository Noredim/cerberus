import requests
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_URL = "http://localhost:8000"

def test_auth_flow():
    logger.info("1. Registering a test Tenant")
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    from src.modules.tenants.models import Tenant
    import uuid

    engine = create_engine("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    # Check if tenant already exists to avoid UniqueViolation on CNPJ
    existing_tenant = db.query(Tenant).filter(Tenant.cnpj == "12345678000199").first()
    
    if existing_tenant:
        tenant_id = existing_tenant.id
        logger.info(f"Using existing Tenant ID: {tenant_id}")
    else:
        tenant_id = str(uuid.uuid4())
        logger.info(f"Generating new Tenant ID: {tenant_id}")
        new_tenant = Tenant(id=tenant_id, cnpj="12345678000199", razao_social="Empresa Teste SA")
        db.add(new_tenant)
        db.commit()
    
    db.close()

    logger.info("2. Registering a User for the Tenant")
    payload = {
        "email": "admin@empresateste.com",
        "password": "strongpassword123"
    }
    
    response = requests.post(f"{API_URL}/auth/register?tenant_id={tenant_id}", json=payload)
    if response.status_code == 200:
        logger.info("User registered successfully")
    elif response.status_code == 400 and "já registrado" in response.text:
        logger.info("User already exists, continuing...")
    else:
        logger.error(f"Failed to register user: {response.text}")
        return

    logger.info("3. Login and Get JWT Token")
    response = requests.post(f"{API_URL}/auth/login", json=payload)
    if response.status_code != 200:
        logger.error(f"Login failed: {response.text}")
        return
    
    data = response.json()
    token = data["access_token"]
    logger.info(f"JWT Token generated: {token[:30]}...")

    logger.info("4. Accessing protected /me route")
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": tenant_id
    }
    response = requests.get(f"{API_URL}/auth/me", headers=headers)
    if response.status_code == 200:
        logger.info(f"Success! User Data: {json.dumps(response.json(), indent=2)}")
    else:
        logger.error(f"Failed to access /me: {response.text}")

if __name__ == "__main__":
    test_auth_flow()
