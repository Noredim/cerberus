import sys
import os
import uuid
from sqlalchemy.orm import Session

# Setup path so it finds modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
sys.path.append(os.path.join(os.path.dirname(os.path.abspath(__file__)), "src"))

from src.core.database import SessionLocal
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
import src.modules.sales_proposals.models
import src.modules.own_services.models
import src.modules.licitacoes.models
import src.modules.fiscal.models

from src.modules.fiscal.models import NfeAnalysis
from src.modules.users.models import User
from src.modules.fiscal.reports import NfeReportsService


def run_test():
    db = SessionLocal()
    try:
        # Find any NfeAnalysis
        analysis = db.query(NfeAnalysis).first()
        if not analysis:
            print("No NfeAnalysis found in DB. Please make sure the DB is seeded or upload an XML first.")
            return

        print(f"Testing PDF generation for NfeAnalysis ID: {analysis.id} ('{analysis.name}')")

        # Get owner or an admin user
        user = db.query(User).filter(User.tenant_id == analysis.tenant_id).first()
        if not user:
            print("No user found under the analysis tenant. Creating a mock user...")
            user = User(
                tenant_id=analysis.tenant_id,
                name="Mock Admin",
                email="mock-admin-pdf@cerberus.com",
                password_hash="mock"
            )
            db.add(user)
            db.flush()

        # Let's find any company in this tenant for MVA/BIT lookups
        from src.modules.companies.models import Company
        company = db.query(Company).filter(Company.tenant_id == analysis.tenant_id).first()
        company_id = company.id if company else None
        print(f"Using company ID for MVA lookups: {company_id}")

        # Helper to read streaming body response
        import asyncio
        async def read_stream(body_iterator):
            chunks = []
            async for chunk in body_iterator:
                if isinstance(chunk, str):
                    chunks.append(chunk.encode('utf-8'))
                else:
                    chunks.append(chunk)
            return b"".join(chunks)

        # 1. Generate DIFAL report
        print("Generating DIFAL (Ativo Imobilizado) report...")
        response_difal = NfeReportsService.generate_analise_compra_pdf(
            db=db,
            analysis_id=analysis.id,
            current_user=user,
            tax_type="DIFAL",
            company_id=company_id
        )
        
        pdf_bytes_difal = asyncio.run(read_stream(response_difal.body_iterator))
        output_path_difal = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_nfe_report_difal.pdf")
        with open(output_path_difal, "wb") as f:
            f.write(pdf_bytes_difal)
        print(f"DIFAL PDF report generated successfully at: {output_path_difal}")

        # 2. Generate ICMS_ST report
        print("Generating ICMS ST report...")
        response_st = NfeReportsService.generate_analise_compra_pdf(
            db=db,
            analysis_id=analysis.id,
            current_user=user,
            tax_type="ICMS_ST",
            company_id=company_id
        )
        
        pdf_bytes_st = asyncio.run(read_stream(response_st.body_iterator))
        output_path_st = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_nfe_report_st.pdf")
        with open(output_path_st, "wb") as f:
            f.write(pdf_bytes_st)
        print(f"ICMS ST PDF report generated successfully at: {output_path_st}")
        print("All PDF tests passed successfully!")

    except Exception as e:
        print(f"Test failed with error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    run_test()
