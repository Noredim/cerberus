import os
import sys

# Add apps/api to path so `src.*` can be resolved
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.core.database import SessionLocal
from src.modules.tenants.models import Tenant
from src.modules.profiles.models import FunctionalProfile

DEFAULT_PROFILES = [
    {
        "name": "Administrador",
        "margin_factor_limit": 1.0,
        "view_director_consolidation": True,
        "is_protected": True
    },
    {
        "name": "Engenharia de Preços",
        "margin_factor_limit": 1.2,
        "view_director_consolidation": False,
        "is_protected": True
    },
    {
        "name": "Diretoria",
        "margin_factor_limit": 99.0,
        "view_director_consolidation": True,
        "is_protected": True
    }
]

def seed_profiles():
    db = SessionLocal()
    try:
        tenants = db.query(Tenant).all()
        for tenant in tenants:
            existing_count = db.query(FunctionalProfile).filter(FunctionalProfile.tenant_id == tenant.id).count()
            if existing_count == 0:
                print(f"Seeding defaults for tenant {tenant.id}...")
                for p in DEFAULT_PROFILES:
                    new_profile = FunctionalProfile(
                        tenant_id=tenant.id,
                        name=p["name"],
                        margin_factor_limit=p["margin_factor_limit"],
                        view_director_consolidation=p["view_director_consolidation"],
                        is_protected=p["is_protected"]
                    )
                    db.add(new_profile)
                db.commit()
            else:
                print(f"Tenant {tenant.id} already has profiles. Skipping.")
    finally:
        db.close()

if __name__ == "__main__":
    seed_profiles()
