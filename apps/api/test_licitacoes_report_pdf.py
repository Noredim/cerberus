import sys
import os
import uuid
import datetime
import asyncio
from decimal import Decimal

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
import src.modules.sales_proposals.models
import src.modules.own_services.models
import src.modules.licitacoes.models

from src.modules.licitacoes.models import Licitacao, LicitacaoLote, LicitacaoItem
from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.users.models import User
from src.modules.companies.models import Company
from src.modules.customers.models import Customer
from src.modules.licitacoes.reports import LicitacoesReportService


def run_test():
    import logging
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        print("Building Homologation Licitacao, Lote, Item and Kit...")
        
        # 1. Fetch base company first to get the tenant_id
        company = db.query(Company).first()
        if not company:
            raise Exception("No company found in database. Please seed companies first.")
        
        tenant_id = company.tenant_id

        # 2. Create/Fetch mock users under the common tenant_id
        from src.modules.users.models import UserRole, UserRoleEnum
        
        admin_email = "admin-test-report@cerberus.com"
        admin_user = db.query(User).filter(User.email == admin_email).first()
        if not admin_user:
            admin_user = User(
                tenant_id=tenant_id,
                name="Admin Homologador",
                email=admin_email,
                password_hash="pbkdf2:sha256:1000"
            )
            db.add(admin_user)
            db.flush()

            user_role = UserRole(user_id=admin_user.id, role=UserRoleEnum.ADMIN)
            db.add(user_role)
            db.flush()

        analyst_email = "analyst-test-report@cerberus.com"
        analyst_user = db.query(User).filter(User.email == analyst_email).first()
        if not analyst_user:
            analyst_user = User(
                tenant_id=tenant_id,
                name="Analista Comercial",
                email=analyst_email,
                password_hash="pbkdf2:sha256:1000"
            )
            db.add(analyst_user)
            db.flush()

        # 3. Create base customer under the common tenant
        customer = db.query(Customer).filter(Customer.tenant_id == tenant_id).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                razao_social="Prefeitura de Homologacao S.A.",
                nome_fantasia="Prefeitura Homologacao",
                cnpj="98765432000188"
            )
            db.add(customer)
            db.flush()

        # 3. Create the Licitacao
        licitacao = Licitacao(
            tenant_id=tenant_id,
            company_id=company.id,
            customer_id=customer.id,
            numero_edital="Pregão 001/2026",
            descricao="Licitação de Homologação de Equipamentos",
            status="Em Análise/Precificação",
            modalidade="Pregão",
            tipo_licitacao="Menor preço",
            po_id=admin_user.id
        )
        db.add(licitacao)
        db.flush()

        # 4. Create Lote
        lote = LicitacaoLote(
            licitacao_id=licitacao.id,
            numero="1",
            nome="EQUIPAMENTOS DE REDES",
            descricao="Equipamentos Lote 01",
            custo_total=Decimal("60000.00"),
            venda_total=Decimal("100000.00"),
            lucro_estimado=Decimal("40000.00"),
            margem_geral=Decimal("40.00")
        )
        db.add(lote)
        db.flush()

        # 5. Create Item
        item = LicitacaoItem(
            lote_id=lote.id,
            codigo="1.1",
            nome="MÓDULO QSFP+ MULTIMODO",
            descricao="Módulo Transceptor Multimodo",
            quantidade=Decimal("10.0"),
            tipo_fornecimento="Unitário",
            quantidade_total=Decimal("10.0"),
            custo_unitario=Decimal("6000.00"),
            custo_total=Decimal("60000.00"),
            venda_unitario=Decimal("10000.00"),
            venda_total=Decimal("100000.00"),
            lucro_estimado=Decimal("40000.00"),
            margem_geral=Decimal("40.00")
        )
        db.add(item)
        db.flush()

        # 6. Create OpportunityKit linked to this item
        kit = OpportunityKit(
            tenant_id=company.tenant_id,
            company_id=company.id,
            licitacao_id=licitacao.id,
            licitacao_item_id=item.id,
            nome_kit="Kit Módulo QSFP+",
            tipo_contrato="VENDA_EQUIPAMENTOS",
            quantidade_kits=10,
            prazo_contrato_meses=36,
            venda_total=Decimal("100000.00"),
            venda_unitario=Decimal("10000.00"),
            custo_total=Decimal("60000.00"),
            custo_unitario=Decimal("6000.00"),
            lucro_estimado=Decimal("40000.00"),
            margem_geral=Decimal("40.00"),
            # Margem Minima Solver fields
            margem_minima_desejada=Decimal("30.00"),
            fator_minimo_calculado=Decimal("1.25"),
            valor_venda_minimo=Decimal("80000.00"),
            lucro_minimo=Decimal("20000.00"),
            margem_minima_resultante=Decimal("25.00")
        )
        db.add(kit)
        db.flush()

        # Also set the overall licitacao consolidated totals
        licitacao.valor_total_venda = Decimal("100000.00")
        licitacao.custo_total = Decimal("60000.00")
        licitacao.lucro_estimado = Decimal("40000.00")
        licitacao.margem_ponderada_global = Decimal("40.00")
        db.flush()

        # Helper to read streaming body response
        async def read_stream(body_iterator):
            chunks = []
            async for chunk in body_iterator:
                if isinstance(chunk, str):
                    chunks.append(chunk.encode('utf-8'))
                else:
                    chunks.append(chunk)
            return b"".join(chunks)

        # 7. Generate Proposal PDF for user with permissions (Admin)
        print("Invoking generate_envio_proposta_pdf for Admin User (authorized)...")
        response_admin = LicitacoesReportService.generate_envio_proposta_pdf(db, licitacao.id, admin_user)
        pdf_bytes_admin = asyncio.run(read_stream(response_admin.body_iterator))

        assert pdf_bytes_admin.startswith(b"%PDF"), "PDF admin header signature is invalid"
        print(f"SUCCESS: Admin Proposal PDF generated. Size: {len(pdf_bytes_admin)} bytes")
        with open("test_licitacoes_output.pdf", "wb") as f:
            f.write(pdf_bytes_admin)
        print("Saved Admin PDF to test_licitacoes_output.pdf")

        # 8. Generate Proposal PDF for user without permissions (Analyst)
        print("Invoking generate_envio_proposta_pdf for Analyst User (unauthorized)...")
        response_analyst = LicitacoesReportService.generate_envio_proposta_pdf(db, licitacao.id, analyst_user)
        pdf_bytes_analyst = asyncio.run(read_stream(response_analyst.body_iterator))

        assert pdf_bytes_analyst.startswith(b"%PDF"), "PDF analyst header signature is invalid"
        print(f"SUCCESS: Analyst Proposal PDF generated. Size: {len(pdf_bytes_analyst)} bytes")
        
        # Verify the file is generated, let's write to file to allow review if needed
        with open("test_licitacoes_analyst_output.pdf", "wb") as f:
            f.write(pdf_bytes_analyst)
        print("Saved Analyst PDF to test_licitacoes_analyst_output.pdf")

        print("All integration tests passed successfully!")

    except Exception as e:
        print(f"FAILED: Exception raised during PDF generation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.rollback()
        db.close()


if __name__ == "__main__":
    run_test()
