import sys
sys.path.append('.')

import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.modules.users.models import User, UserRole, UserRoleEnum
from src.modules.users.schemas import UserPasswordResetAdmin
from src.core.database import SessionLocal
from src.modules.tenants.models import Tenant
from src.core.security import verify_password, get_password_hash
from src.modules.companies.models import Company
from src.modules.licitacoes.models import Licitacao, LicitacaoItem
from src.modules.products.models import Product
from src.modules.own_services.models import OwnService
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.sales_budgets.models import SalesBudget
from src.modules.sales_proposals.models import SalesProposal
from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.customers.models import Customer
from fastapi import HTTPException

def run_tests():
    print("Initializing test database connection...")
    db = SessionLocal()
    
    try:
        # Create or fetch a test tenant
        tenant = db.query(Tenant).filter(Tenant.razao_social == "Tenant Test Password Reset").first()
        if not tenant:
            tenant = Tenant(id="tenant-pw-reset-1", cnpj="99887766554433", razao_social="Tenant Test Password Reset")
            db.add(tenant)
            db.flush()
        tenant_id = tenant.id

        # Create or fetch another test tenant
        other_tenant = db.query(Tenant).filter(Tenant.razao_social == "Tenant Test Password Reset 2").first()
        if not other_tenant:
            other_tenant = Tenant(id="tenant-pw-reset-2", cnpj="99887766554422", razao_social="Tenant Test Password Reset 2")
            db.add(other_tenant)
            db.flush()
        other_tenant_id = other_tenant.id
        
        # Create an ADMIN user
        admin_user = db.query(User).filter(User.email == "test_admin_reset@example.com").first()
        if not admin_user:
            admin_user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Admin Test Password Reset",
                email="test_admin_reset@example.com",
                password_hash=get_password_hash("password123"),
                is_active=True
            )
            db.add(admin_user)
            db.flush()
            admin_role = UserRole(user_id=admin_user.id, role=UserRoleEnum.ADMIN)
            db.add(admin_role)
            db.flush()
            
        # Create a non-admin user
        peon_user = db.query(User).filter(User.email == "test_peon_reset@example.com").first()
        if not peon_user:
            peon_user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Peon Test Password Reset",
                email="test_peon_reset@example.com",
                password_hash=get_password_hash("password123"),
                is_active=True
            )
            db.add(peon_user)
            db.flush()
            peon_role = UserRole(user_id=peon_user.id, role=UserRoleEnum.ENGENHARIA_PRECO)
            db.add(peon_role)
            db.flush()
            
        # Create a user from a different tenant
        other_user = db.query(User).filter(User.email == "test_other_tenant@example.com").first()
        if not other_user:
            other_user = User(
                id=str(uuid.uuid4()),
                tenant_id=other_tenant_id,
                name="Other Tenant User",
                email="test_other_tenant@example.com",
                password_hash=get_password_hash("password123"),
                is_active=True
            )
            db.add(other_user)
            db.flush()
            
        db.commit()
        
        # Now let's call reset_password_admin via the router logic directly or manually mimicking the router logic
        from src.modules.users.router import reset_password_admin
        
        # Test 1: Non-admin trying to reset password (should fail with 403)
        print("\n--- Test 1: Non-admin resets password ---")
        try:
            reset_password_admin(
                user_id=peon_user.id,
                payload=UserPasswordResetAdmin(new_password="newsecurepassword"),
                db=db,
                current_user=peon_user
            )
            assert False, "Expected 403 Forbidden but succeeded"
        except HTTPException as exc:
            print(f"Succeeded blocking non-admin: {exc.detail}")
            assert exc.status_code == 403
            
        # Test 2: Admin resetting password of user in a different tenant (should fail with 404)
        print("\n--- Test 2: Admin resets password of user in different tenant ---")
        try:
            reset_password_admin(
                user_id=other_user.id,
                payload=UserPasswordResetAdmin(new_password="newsecurepassword"),
                db=db,
                current_user=admin_user
            )
            assert False, "Expected 404 Not Found but succeeded"
        except HTTPException as exc:
            print(f"Succeeded blocking cross-tenant update: {exc.detail}")
            assert exc.status_code == 404
            
        # Test 3: Admin resetting password of user in same tenant (should succeed)
        print("\n--- Test 3: Admin resets password of user in same tenant ---")
        res = reset_password_admin(
            user_id=peon_user.id,
            payload=UserPasswordResetAdmin(new_password="newsecurepassword"),
            db=db,
            current_user=admin_user
        )
        print(f"Password reset success: {res}")
        # Verify password updated in DB
        db.refresh(peon_user)
        assert verify_password("newsecurepassword", peon_user.password_hash)
        print("Password reset verified successfully in database!")
        
        # Clean up
        db.query(UserRole).filter(UserRole.user_id.in_([admin_user.id, peon_user.id])).delete()
        db.query(User).filter(User.id.in_([admin_user.id, peon_user.id, other_user.id])).delete()
        db.query(Tenant).filter(Tenant.id.in_([tenant.id, other_tenant.id])).delete()
        db.commit()
        print("\nALL USER PASSWORD RESET BACKEND TESTS PASSED SUCCESSFULLY!")
        
    except Exception as e:
        db.rollback()
        print(f"Test failed with exception: {e}")
        raise e
    finally:
        db.close()

if __name__ == '__main__':
    run_tests()
