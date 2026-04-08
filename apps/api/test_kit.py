from sqlalchemy.orm import Session
from src.core.database import SessionLocal
from src.modules.opportunity_kits.service import OpportunityKitService

db = SessionLocal()
service = OpportunityKitService(db)

# Just find the kit that corresponds to this difference.
kits = db.execute("SELECT id, nome_kit, fator_margem_locacao FROM opportunity_kits WHERE tipo_contrato = 'VENDA_EQUIPAMENTOS' ORDER BY created_at DESC LIMIT 5").fetchall()
for kit in kits:
    print(f"Kit ID: {kit[0]}, Nome: {kit[1]}")
    try:
        k = service.get_kit(str(kit[0]), "db4b0553-9118-47bc-8f43-300c3c5443af") # wait I need correct tenant
    except:
        pass
