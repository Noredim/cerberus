import sys
from decimal import Decimal
from uuid import uuid4
from fastapi import HTTPException

# Set path to import modules
sys.path.append('c:/cerberus/apps/api')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Import models
from src.core.base import Base
from src.modules.sales_budgets.models import SalesBudget
from src.modules.purchase_budgets.models import PurchaseBudget, PurchaseBudgetItem
from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitItem
from src.modules.products.models import Product
from src.modules.sales_proposals.models import SalesProposal
from src.modules.sales_budgets.service import calculate_product_cost_composition
from src.modules.purchase_budgets.service import PurchaseBudgetService

# DB connection pointing to port 5433
engine = create_engine("postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

def run_test():
    print("--- Starting Integration Test for Multiple Purchase Budgets ---")
    
    # 1. Gather existing product, company, tenant, and supplier
    product = db.query(Product).first()
    if not product:
        print("Error: No product found in DB to run test.")
        return
        
    # Get a tenant and company
    tenant_id = product.tenant_id
    company_id = product.company_id
    
    # Get a supplier
    from src.modules.suppliers.models import Supplier
    suppliers = db.query(Supplier).filter(Supplier.tenant_id == tenant_id).limit(2).all()
    if len(suppliers) < 2:
        print("Error: Need at least 2 suppliers in DB to run test.")
        return
        
    supplier_a = suppliers[0]
    supplier_b = suppliers[1]
    
    # Get a customer
    from src.modules.customers.models import Customer
    customer = db.query(Customer).filter(Customer.tenant_id == tenant_id).first()
    if not customer:
        print("Error: No customer found in DB to run test.")
        return

    # 2. Create a Sales Budget (Opportunity)
    sales_budget = SalesBudget(
        id=uuid4(),
        tenant_id=tenant_id,
        company_id=company_id,
        customer_id=customer.id,
        titulo="Test Opportunity Multi-budget",
        status="EM_ANALISE"
    )
    db.add(sales_budget)
    db.commit()
    print(f"Created SalesBudget: {sales_budget.id}")

    try:
        # 3. Create Purchase Budget 1 (Supplier A) with Product cost = R$ 120.00
        pb_a = PurchaseBudget(
            id=uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            sales_budget_id=sales_budget.id,
            supplier_id=supplier_a.id,
            tipo_orcamento="REVENDA",
            frete_tipo="CIF",
            frete_percent=Decimal("0"),
            ipi_calculado=False
        )
        db.add(pb_a)
        db.flush()
        
        pbi_a = PurchaseBudgetItem(
            id=uuid4(),
            budget_id=pb_a.id,
            product_id=product.id,
            quantidade=Decimal("1"),
            valor_unitario=Decimal("120.00"),
            total_item=Decimal("120.00")
        )
        db.add(pbi_a)
        db.commit()
        print(f"Created PurchaseBudget A ({supplier_a.nome_fantasia}) with cost 120.00")

        # 4. Create Purchase Budget 2 (Supplier B) with Product cost = R$ 95.00
        pb_b = PurchaseBudget(
            id=uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            sales_budget_id=sales_budget.id,
            supplier_id=supplier_b.id,
            tipo_orcamento="REVENDA",
            frete_tipo="CIF",
            frete_percent=Decimal("0"),
            ipi_calculado=False
        )
        db.add(pb_b)
        db.flush()
        
        pbi_b = PurchaseBudgetItem(
            id=uuid4(),
            budget_id=pb_b.id,
            product_id=product.id,
            quantidade=Decimal("1"),
            valor_unitario=Decimal("95.00"),
            total_item=Decimal("95.00")
        )
        db.add(pbi_b)
        db.commit()
        print(f"Created PurchaseBudget B ({supplier_b.nome_fantasia}) with cost 95.00")

        # 5. Check if calculate_product_cost_composition resolves to the correct budget
        # Let's call calculate_product_cost_composition for pb_b (since it's also linked)
        comp = calculate_product_cost_composition(
            db=db,
            product_id=str(product.id),
            tenant_id=tenant_id,
            tipo="REVENDA",
            sales_budget_id=str(sales_budget.id)
        )
        print(f"Resolved cost composition: {comp}")
        assert comp is not None
        # Should find one of the budgets linked to opportunity.
        # Since pb_b was inserted last, or pb_a was first. Let's make sure it found one of the two!
        assert float(comp["base_unitario"]) in [120.00, 95.00]
        print("Cost resolution test passed!")

        # 6. Create an Opportunity Kit and link the product to it
        kit = OpportunityKit(
            id=uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            sales_budget_id=sales_budget.id,
            nome_kit="Exclusive Kit Test",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=12
        )
        db.add(kit)
        db.flush()
        
        kit_item = OpportunityKitItem(
            id=uuid4(),
            kit_id=kit.id,
            tipo_item="PRODUTO",
            product_id=product.id,
            descricao_item="Test product item",
            quantidade_no_kit=Decimal("1")
        )
        db.add(kit_item)
        db.commit()
        print(f"Created OpportunityKit and linked product {product.nome} to it.")

        # 7. Try to delete Purchase Budget A and check for validation block
        print("Attempting to delete Purchase Budget A (should fail)...")
        try:
            PurchaseBudgetService.delete_budget(
                db=db,
                tenant_id=tenant_id,
                budget_id=pb_a.id,
                company_id=str(company_id)
            )
            print("FAILED: Budget A deletion was NOT blocked!")
            assert False
        except HTTPException as exc:
            print(f"Success: Deletion blocked as expected! Error detail: {exc.detail}")
            assert exc.status_code == 400
            
    finally:
        # Clean up
        print("Cleaning up test database records...")
        db.query(OpportunityKitItem).filter(OpportunityKitItem.product_id == product.id).delete()
        db.query(OpportunityKit).filter(OpportunityKit.sales_budget_id == sales_budget.id).delete()
        db.query(PurchaseBudgetItem).filter(PurchaseBudgetItem.product_id == product.id).delete()
        db.query(PurchaseBudget).filter(PurchaseBudget.sales_budget_id == sales_budget.id).delete()
        db.query(SalesBudget).filter(SalesBudget.id == sales_budget.id).delete()
        db.commit()
        print("Cleanup done!")

if __name__ == "__main__":
    run_test()
