import sys
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
        hashed_pw = get_password_hash("W@rs26")
        if not user:
            logger.info(f"Creating user {email}...")
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
            logger.info(f"User {email} already exists in the database. Enforcing Master credentials and active status...")
            user.password_hash = hashed_pw
            user.is_active = True
            user.name = "Warslab Admin Master"
            
            # Check and enforce ADMIN role
            has_admin_role = db.query(UserRole).filter(
                UserRole.user_id == user.id,
                UserRole.role == UserRoleEnum.ADMIN
            ).first()
            if not has_admin_role:
                logger.info("Enforcing ADMIN role for existing user...")
                admin_role = UserRole(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    role=UserRoleEnum.ADMIN
                )
                db.add(admin_role)
            db.commit()
            logger.info(f"User {email} successfully updated with Master credentials!")

    except Exception as e:
        logger.error(f"Error seeding admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_admin()
