import uuid, sys, os
from decimal import Decimal
sys.path.append('c:/cerberus/apps/api')
from src.core.database import SessionLocal  # type: ignore
from src.modules.opportunity_kits.service import OpportunityKitService  # type: ignore
from src.modules.opportunity_kits.models import OpportunityKit  # type: ignore

db = SessionLocal()
service = OpportunityKitService(db)

kit = db.query(OpportunityKit).filter(OpportunityKit.tipo_contrato == 'VENDA_EQUIPAMENTOS').order_by(OpportunityKit.updated_at.desc()).first()
if not kit:
    print('No kit')
    sys.exit()

fin = service.calculate_financials(kit, kit.tenant_id)
v_orig = fin['summary'].get('venda_equipamentos_total') or 0
print(f'Original: {v_orig}')

old_id = kit.sales_budget_id
kit.sales_budget_id = None
fin_no_budg = service.calculate_financials(kit, kit.tenant_id)
print(f"No budget: {fin_no_budg.get('summary', {}).get('venda_equipamentos_total')}")

percentual = kit.percentual_instalacao
kit.percentual_instalacao = None
fin_no_inst = service.calculate_financials(kit, kit.tenant_id)
print(f"No inst: {fin_no_inst.get('summary', {}).get('venda_equipamentos_total')}")
kit.percentual_instalacao = percentual

fm = kit.fator_manutencao
kit.fator_manutencao = Decimal(1)
fin_no_fm = service.calculate_financials(kit, kit.tenant_id)
print(f"FM = 1: {fin_no_fm.get('summary', {}).get('venda_equipamentos_total')}")
kit.fator_manutencao = fm

print(f"Aliq icms is {kit.aliq_icms}")
print(f"Percentual instalacao is {percentual}")
print(f"Fator Manutencao is {fm}")

from src.modules.sales_budgets.service import SalesBudgetService  # type: ignore
s_service = SalesBudgetService(db)
if old_id:
    s_budget_obj = db.query(OpportunityKit).filter(OpportunityKit.sales_budget_id == old_id).first()
    if s_budget_obj and s_budget_obj.sales_budget_id:
        from src.modules.sales_budgets.models import SalesBudget  # type: ignore
        b = db.query(SalesBudget).filter(SalesBudget.id == old_id).first()
        s_budget = s_service.serialize_response(b)
        print('Rental items:')
        for r in s_budget['rental_items']:
            if str(r.get('opportunity_kit_id')) == str(kit.id):
                print(f"Sales budget rental item valor_venda_equipamento: {r.get('valor_venda_equipamento')}")
