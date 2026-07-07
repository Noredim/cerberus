import sys
from src.core.database import SessionLocal
from src.modules.sales_budgets.models import SalesBudget
from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.purchase_budgets.models import PurchaseBudget

db = SessionLocal()

opportunity = db.query(SalesBudget).filter(SalesBudget.numero_orcamento.like('%135/2026%')).first()
if not opportunity:
    print("Opportunity STM135/2026 not found!")
    sys.exit(1)

print(f"Found Opportunity: {opportunity.titulo} (ID: {opportunity.id}, Number: {opportunity.numero_orcamento})")

print("\n--- RENTAL ITEMS ---")
for ri in opportunity.rental_items:
    print(f"Product ID: {ri.product_id}, Kit ID: {ri.opportunity_kit_id}, Qty: {ri.quantidade}, is_kit_instalacao: {ri.is_kit_instalacao}")
    print(f"  custo_total_aquisicao: {ri.custo_total_aquisicao}, difal_unit: {ri.difal_unit}, icms_st_unit: {ri.icms_st_unit}")
    print(f"  kit_investimento_total: {ri.kit_investimento_total}, kit_despesas_adm: {ri.kit_despesas_adm}")

# Let's check purchase budgets associated
purchase_budgets = db.query(PurchaseBudget).filter(PurchaseBudget.sales_budget_id == opportunity.id).all()
print(f"\n--- ASSOCIATED PURCHASE BUDGETS (Qty: {len(purchase_budgets)}) ---")
total_pb_items = 0
total_pb_difal = 0
total_pb_st = 0
for pb in purchase_budgets:
    print(f"Purchase Budget: {pb.id} | Supplier: {pb.supplier_nome_fantasia}")
    for item in pb.items:
        qty = item.quantidade
        val_unit = float(item.valor_unitario or 0)
        difal = float(item.difal_unitario or 0)
        st = float(item.st_unitario or 0)
        print(f"  Item: {item.product_nome} (Product: {item.product_id}) Qty: {qty}, UnitPrice: {val_unit}, Difal: {difal}, ST: {st}")
        total_pb_items += val_unit * qty
        total_pb_difal += difal * qty
        total_pb_st += st * qty

print(f"\nPB Total Products: {total_pb_items:.2f}")
print(f"PB Total Difal: {total_pb_difal:.2f}")
print(f"PB Total ST: {total_pb_st:.2f}")
print(f"PB Total General: {total_pb_items + total_pb_difal + total_pb_st:.2f}")

db.close()
