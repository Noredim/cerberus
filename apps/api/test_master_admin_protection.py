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
    # Connect to the DB to locate master admin, tenant, and prepare secondary admin
    engine = create_engine("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Find master admin
        master_user = db.query(User).filter(User.email == "wars@warslab.com.br").first()
        assert master_user is not None, "Master admin user 'wars@warslab.com.br' not found. Please run seed_admin.py first."
        master_user_id = master_user.id
        tenant_id = master_user.tenant_id
        logger.info(f"Master User ID: {master_user_id}, Tenant ID: {tenant_id}")

        # Create secondary admin in same tenant
        sec_email = "secondary_admin@warslab.com.br"
        sec_user = db.query(User).filter(User.email == sec_email).first()
        if not sec_user:
            logger.info(f"Creating secondary admin {sec_email} in tenant {tenant_id}...")
            sec_user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Secondary Admin",
                email=sec_email,
                password_hash=get_password_hash("SecPassword123"),
                is_active=True
            )
            db.add(sec_user)
            db.commit()
            db.refresh(sec_user)

            # Assign ADMIN role to secondary admin
            sec_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=sec_user.id,
                role=UserRoleEnum.ADMIN
            )
            db.add(sec_role)
            db.commit()
            logger.info("Secondary admin created and role assigned.")
        else:
            logger.info(f"Secondary admin {sec_email} already exists.")
            # Ensure it is active and has ADMIN role
            sec_user.is_active = True
            sec_user.tenant_id = tenant_id
            
            has_role = db.query(UserRole).filter(
                UserRole.user_id == sec_user.id,
                UserRole.role == UserRoleEnum.ADMIN
            ).first()
            if not has_role:
                sec_role = UserRole(
                    id=str(uuid.uuid4()),
                    user_id=sec_user.id,
                    role=UserRoleEnum.ADMIN
                )
                db.add(sec_role)
            db.commit()
            logger.info("Secondary admin verified and active.")
            
    finally:
        db.close()

    # Now make the API requests
    # Login as secondary user
    logger.info("Logging in as secondary user...")
    r = requests.post(f"{API_URL}/auth/login", data={"username": sec_email, "password": "SecPassword123"})
    assert r.status_code == 200, f"Secondary login failed: {r.text}"
    token_sec = r.json()["access_token"]
    
    headers_sec = {
        "Authorization": f"Bearer {token_sec}",
        "X-Tenant-Id": tenant_id
    }

    # Test 3: Attempt toggle-active of master admin using secondary admin token
    logger.info("3. Attempting to toggle active status of master admin using secondary token...")
    r = requests.patch(f"{API_URL}/users/{master_user_id}/toggle-active", headers=headers_sec)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    assert "O usuário Master Admin não pode ser alterado ou excluído" in r.json()["detail"]
    logger.info("SUCCESS: Toggle active correctly blocked!")

    # Test 4: Attempt update of master admin using secondary token
    logger.info("4. Attempting to update master admin details using secondary token...")
    r = requests.put(f"{API_URL}/users/{master_user_id}", json={"name": "Attacker"}, headers=headers_sec)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    assert "O usuário Master Admin não pode ser alterado ou excluído" in r.json()["detail"]
    logger.info("SUCCESS: Update details correctly blocked!")

    # Test 5: Attempt to delete master admin user using secondary token
    logger.info("5. Attempting to delete master admin user using secondary token...")
    r = requests.delete(f"{API_URL}/users/{master_user_id}", headers=headers_sec)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    assert "O usuário Master Admin não pode ser alterado ou excluído" in r.json()["detail"]
    logger.info("SUCCESS: Delete user correctly blocked!")

    # Test 6: Attempt to assign company to master admin using secondary token
    logger.info("6. Attempting to assign company to master admin using secondary token...")
    r = requests.post(f"{API_URL}/users/{master_user_id}/companies", json={"company_id": "00000000-0000-0000-0000-000000000000", "is_default": True}, headers=headers_sec)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    assert "O usuário Master Admin não pode ser alterado ou excluído" in r.json()["detail"]
    logger.info("SUCCESS: Assign company correctly blocked!")

    # Test 7: Attempt to unassign company from master admin using secondary token
    logger.info("7. Attempting to unassign company from master admin using secondary token...")
    r = requests.delete(f"{API_URL}/users/{master_user_id}/companies/00000000-0000-0000-0000-000000000000", headers=headers_sec)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    assert "O usuário Master Admin não pode ser alterado ou excluído" in r.json()["detail"]
    logger.info("SUCCESS: Unassign company correctly blocked!")

    # Test 8: Login as master admin and verify self-modification block endpoints
    logger.info("8. Verifying master admin self-modification block endpoints...")
    r = requests.post(f"{API_URL}/auth/login", data={"username": "wars@warslab.com.br", "password": "W@rs26"})
    assert r.status_code == 200, f"Master login failed: {r.text}"
    token_master = r.json()["access_token"]
    headers_master = {
        "Authorization": f"Bearer {token_master}",
        "X-Tenant-Id": tenant_id
    }
    
    # Try to reset own password
    r = requests.put(f"{API_URL}/users/me/reset-password", json={"current_password": "W@rs26", "new_password": "new_password_123"}, headers=headers_master)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    assert "O usuário Master Admin não pode ser alterado ou excluído" in r.json()["detail"]
    
    # Try to update own profile picture
    r = requests.put(f"{API_URL}/users/me/profile-picture", json={"profile_picture": "test.png"}, headers=headers_master)
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"
    assert "O usuário Master Admin não pode ser alterado ou excluído" in r.json()["detail"]
    
    logger.info("SUCCESS: Master admin self-modification correctly blocked!")

    logger.info("\nALL MASTER ADMIN PROTECTION TESTS PASSED SUCCESSFULLY! ✅")

if __name__ == "__main__":
    run_tests()
