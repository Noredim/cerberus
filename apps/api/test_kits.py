import sys
import json
from src.core.database import SessionLocal
from src.modules.opportunity_kits.service import OpportunityKitService
from src.modules.companies.models import Company

def run():
    db = SessionLocal()
    try:
        # Get any company
        company = db.query(Company).first()
        if not company:
            print("No company found.")
            return

        service = OpportunityKitService(db)
        kits = service.list_kits(company.tenant_id, str(company.id))
        
        for kit in kits:
            print(f"Kit: {kit.nome_kit} ({kit.id})")
            if hasattr(kit, 'summary') and kit.summary:
                print(f"  Summary: {json.dumps(kit.summary, indent=2, default=str)}")
            else:
                print("  No summary attached.")
                
    finally:
        db.close()

if __name__ == "__main__":
    run()
