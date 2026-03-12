import sys
import logging
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.modules.tenants.models import Tenant
from src.modules.users.models import User, UserRole, UserRoleEnum
from src.core.security import get_password_hash
import uuid

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_admin():
    from src.core.config import settings

    logger.info("Initializing Admin Seeder...")
    engine = create_engine("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    try:
        # Create or find master tenant
        tenant_cnpj = "00000000000000"
        tenant = db.query(Tenant).filter(Tenant.cnpj == tenant_cnpj).first()
        if not tenant:
            tenant_id = str(uuid.uuid4())
            logger.info(f"Creating Master Tenant ID: {tenant_id}")
            tenant = Tenant(id=tenant_id, cnpj=tenant_cnpj, razao_social="Warslab Master Admin")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        else:
            logger.info(f"Master tenant already exists: {tenant.id}")

        email = "wars@warslab.com.br"
        user = db.query(User).filter(User.email == email).first()
        if not user:
            logger.info(f"Creating user {email}...")
            hashed_pw = get_password_hash("W@rs2026")
            user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant.id,
                name="Warslab Admin Master",
                email=email,
                password_hash=hashed_pw,
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

            # Assign roles
            logger.info("Assigning ADMIN role...")
            admin_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=user.id,
                role=UserRoleEnum.ADMIN
            )
            db.add(admin_role)
            db.commit()
            logger.info(f"User {email} successfully created and assigned ADMIN role!")
        else:
            logger.info(f"User {email} already exists in the database.")

    except Exception as e:
        logger.error(f"Error seeding admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
