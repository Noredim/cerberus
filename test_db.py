import sys
sys.path.append('c:/cerberus/apps/api')
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.opportunity_kits.service import OpportunityKitService

engine = create_engine("postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

kit = db.query(OpportunityKit).filter(OpportunityKit.nome_kit.ilike('%Kit Global%')).first()
if not kit:
    kit = db.query(OpportunityKit).filter(OpportunityKit.tipo_contrato == 'LOCACAO').first()

if kit:
    service = OpportunityKitService(db)
    financials = service.calculate_financials(kit, kit.tenant_id)
    summary = financials.get('summary', {})
    print(f"Name: {kit.nome_kit}")
    print(f"valor_mensal_antes_impostos: {summary.get('valor_mensal_antes_impostos')}")
    print(f"valor_mensal_kit: {summary.get('valor_mensal_kit')}")
    print(f"receita_liquida_mensal_kit: {summary.get('receita_liquida_mensal_kit')}")
    print(f"impostos: {summary.get('valor_impostos')}")
    print(f"vlt_manut: {summary.get('vlt_manut')}")
    print(f"custo_operacional_mensal_kit: {summary.get('custo_operacional_mensal_kit')}")
    print(f"tx_locacao: {summary.get('tx_locacao')}")
    print(f"vlr_instal_calc: {summary.get('vlr_instal_calc')}")
else:
    print("No kit found")
