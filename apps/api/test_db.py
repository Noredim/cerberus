import sys
sys.path.append("c:\\cerberus\\apps\\api")
from src.core.database import SessionLocal
from src.modules.opportunity_kits.models import OpportunityKit

def main():
    db = SessionLocal()
    kits = db.query(OpportunityKit).order_by(OpportunityKit.updated_at.desc()).limit(3).all()
    for k in kits:
        print(f"Kit: {k.nome_kit} | ID: {k.id}")
        print(f" - Prod: {k.fator_margem_locacao}")
        print(f" - Serv: {k.fator_margem_servicos_produtos}")
        print(f" - Inst: {k.fator_margem_instalacao}")
        print(f" - Manu: {k.fator_margem_manutencao}")
        print("-------------")

if __name__ == "__main__":
    main()
