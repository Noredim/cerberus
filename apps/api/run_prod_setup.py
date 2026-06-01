import sys
import os
import subprocess
import logging
from sqlalchemy import text

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

def run_step(name, func):
    logger.info(f"=== Starting Step: {name} ===")
    try:
        func()
        logger.info(f"=== Completed Step: {name} successfully! ✅ ===\n")
    except Exception as e:
        logger.error(f"❌ Error during step '{name}': {e}")
        sys.exit(1)

def drop_conflicting_tables():
    from src.core.database import SessionLocal
    db = SessionLocal()
    try:
        tables_to_drop = [
            "opportunity_budget_items",
            "opportunity_items_kit",
            "opportunity_installation_items",
            "opportunity_maintenance_items",
            "opportunity_parameters_sales",
            "opportunity_parameters_rent",
            "opportunity_budgets",
            "opportunity_items",
            "opportunities"
        ]
        logger.info(f"Dropping conflicting tables CASCADE: {', '.join(tables_to_drop)}")
        db.execute(text(f"DROP TABLE IF EXISTS {', '.join(tables_to_drop)} CASCADE"))
        db.commit()
    finally:
        db.close()

def run_alembic_upgrade():
    logger.info("Running: alembic upgrade head")
    result = subprocess.run(["alembic", "upgrade", "head"], capture_output=True, text=True)
    if result.returncode != 0:
        raise Exception(f"Alembic upgrade failed:\nSTDOUT:\n{result.stdout}\nSTDERR:\n{result.stderr}")
    else:
        logger.info(result.stdout)

def seed_admin_user():
    from seed_admin import seed_admin
    seed_admin()

def seed_stelmat_company():
    from seed_company_stelmat import seed_stelmat
    seed_stelmat()

def seed_man_hours_data():
    from seed_man_hours import main as seed_man_hours_main
    seed_man_hours_main()

def main():
    run_step("Drop Conflicting Opportunity Tables", drop_conflicting_tables)
    run_step("Run Alembic Migrations", run_alembic_upgrade)
    run_step("Seed Admin User (wars@warslab.com.br)", seed_admin_user)
    run_step("Seed STELMAT Company and Tax Params", seed_stelmat_company)
    run_step("Seed STELMAT Man Hours Data", seed_man_hours_data)
    logger.info("🎉 Setup completed successfully!")

if __name__ == "__main__":
    main()
