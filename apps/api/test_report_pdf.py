import sys
import os
import uuid
import datetime

# Setup path so it finds modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from src.core.database import SessionLocal
# Import all models to register them with SQLAlchemy mapper
import src.modules.users.models
import src.modules.tenants.models
import src.modules.companies.models
import src.modules.customers.models
import src.modules.professionals.models
import src.modules.payment_methods.models
import src.modules.suppliers.models
import src.modules.products.models
import src.modules.sales_budgets.models
import src.modules.purchase_budgets.models
import src.modules.opportunity_kits.models

from src.modules.sales_budgets.models import SalesBudget
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.users.models import User
from src.modules.sales_budgets.reports import OpportunitiesReportService


def run_test():
    db = SessionLocal()
    try:
        # 1. Fetch any sales budget (opportunity)
        opp = db.query(SalesBudget).first()
        if not opp:
            print("No opportunity found in database to test report. Creating a mock one...")
            from src.modules.companies.models import Company
            from src.modules.customers.models import Customer
            
            company = db.query(Company).first()
            customer = db.query(Customer).first()
            if not company or not customer:
                print("Missing Company or Customer records in database. Cannot test.")
                return
            
            opp = SalesBudget(
                tenant_id=company.tenant_id,
                company_id=company.id,
                customer_id=customer.id,
                titulo="Oportunidade Teste PDF",
                status="EM_LANCAMENTO",
                valor_total=1000.0
            )
            db.add(opp)
            db.flush()
        
        print(f"Testing report generation for Opportunity: {opp.titulo} ({opp.id})")

        # 2. Fetch or create a mock user
        user = db.query(User).filter(User.tenant_id == opp.tenant_id).first()
        if not user:
            user = User(
                tenant_id=opp.tenant_id, 
                name="Test User", 
                email=f"test-{uuid.uuid4()}@cerberus.com", 
                password_hash="hash"
            )
            db.add(user)
            db.flush()

        # 3. Check if there are associated purchase budgets. If not, link one.
        pb = db.query(PurchaseBudget).filter(PurchaseBudget.sales_budget_id == opp.id).first()
        if not pb:
            print("No purchase budgets linked. Creating a mock purchase budget for testing...")
            from src.modules.suppliers.models import Supplier
            from src.modules.companies.models import Company
            
            supplier = db.query(Supplier).first()
            company = db.query(Company).filter(Company.id == opp.company_id).first()
            
            if not supplier:
                print("No Supplier found in database. Creating a mock supplier...")
                supplier = Supplier(
                    id=str(uuid.uuid4()),
                    tenant_id=opp.tenant_id,
                    cnpj="12345678000199",
                    razao_social="Supplier Test S.A.",
                    nome_fantasia="Supplier Test"
                )
                db.add(supplier)
                db.flush()
                
            pb = PurchaseBudget(
                tenant_id=opp.tenant_id,
                company_id=opp.company_id,
                sales_budget_id=opp.id,
                supplier_id=supplier.id,
                tipo_orcamento='REVENDA',
                frete_tipo='CIF',
                data_orcamento=opp.data_orcamento,
                ipi_calculado=False
            )
            db.add(pb)
            db.flush()
            
            # Add items to opportunity and purchase budget to test mapping
            from src.modules.products.models import Product
            product = db.query(Product).first()
            if not product:
                print("No Product found in database. Creating a mock product...")
                product = Product(
                    id=uuid.uuid4(),
                    tenant_id=opp.tenant_id,
                    codigo="PROD-TEST-PDF",
                    nome="Câmera Bullet IP Teste",
                    tipo="EQUIPAMENTO",
                    vlr_referencia_revenda=100.0,
                    ativo=True
                )
                db.add(product)
                db.flush()

            # Add sales budget item
            from src.modules.sales_budgets.models import SalesBudgetItem
            opp_item = SalesBudgetItem(
                budget_id=opp.id,
                product_id=product.id,
                tipo_item="MERCADORIA",
                quantidade=5,
                custo_unit_base=100.0,
                total_venda=750.0
            )
            db.add(opp_item)
            db.flush()

            # Add purchase budget item with custom DIFAL/ST
            from src.modules.purchase_budgets.models import PurchaseBudgetItem
            pb_item = PurchaseBudgetItem(
                budget_id=pb.id,
                product_id=product.id,
                quantidade=5,
                valor_unitario=100.0,
                total_item=500.0,
                difal_unitario=12.50,
                st_unitario=18.90
            )
            db.add(pb_item)
            db.flush()
            db.commit()

        # 4. Generate PDF Report via service
        print("Invoking OpportunitiesReportService...")
        response = OpportunitiesReportService.generate_fechamento_fornecedores_pdf(db, opp.id, user)
        
        # Read the streaming body response asynchronously
        import asyncio
        async def read_stream(body_iterator):
            chunks = []
            async for chunk in body_iterator:
                if isinstance(chunk, str):
                    chunks.append(chunk.encode('utf-8'))
                else:
                    chunks.append(chunk)
            return b"".join(chunks)
            
        pdf_bytes = asyncio.run(read_stream(response.body_iterator))

        
        # 5. Assert PDF header
        if pdf_bytes.startswith(b"%PDF"):
            print("SUCCESS: PDF generated successfully! Header starts with %PDF")
            print(f"PDF size: {len(pdf_bytes)} bytes")
        else:
            print("FAILED: PDF generated but header is invalid.")
            sys.exit(1)
            
    except Exception as e:
        print(f"FAILED: Exception raised during PDF generation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()

if __name__ == "__main__":
    run_test()
