import sys
import os
import uuid
import datetime
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

from src.modules.sales_budgets.models import SalesBudget
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.users.models import User
from src.modules.sales_budgets.reports import OpportunitiesReportService


def run_test():
    import logging
    logging.basicConfig(level=logging.INFO)
    db = SessionLocal()
    try:
        print("Building Homologation Opportunity...")
        from src.modules.companies.models import Company
        from src.modules.customers.models import Customer
        from src.modules.suppliers.models import Supplier
        from src.modules.products.models import Product
        from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem
        from src.modules.purchase_budgets.models import PurchaseBudget, PurchaseBudgetItem
        from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitItem

        # 1. Fetch or create base company and customer
        company = db.query(Company).first()
        if not company:
            company = Company(
                razao_social="Cerberus Tech Ltda",
                nome_fantasia="Cerberus Tech",
                cnpj="12345678000199",
                tenant_id="tenant-homologacao"
            )
            db.add(company)
            db.flush()

        customer = db.query(Customer).first()
        if not customer:
            customer = Customer(
                tenant_id=company.tenant_id,
                razao_social="Cliente Homologacao S.A.",
                nome_fantasia="Cliente Homologacao",
                cnpj="98765432000188"
            )
            db.add(customer)
            db.flush()

        # 2. Create the Sales Budget / Opportunity
        opp = SalesBudget(
            tenant_id=company.tenant_id,
            company_id=company.id,
            customer_id=customer.id,
            titulo="Oportunidade Homologacao Real",
            status="APROVADO",
            valor_total=18500.0,
            data_orcamento=datetime.date.today(),
            data_vencimento_inicial=datetime.date.today()
        )
        db.add(opp)
        db.flush()

        # 3. Create a mock user
        user = db.query(User).filter(User.tenant_id == opp.tenant_id).first()
        if not user:
            user = User(
                tenant_id=opp.tenant_id,
                name="Diretor Homologador",
                email="homologador@cerberus.com",
                password_hash="pbkdf2:sha256:1000"
            )
            db.add(user)
            db.flush()

        # 4. Create products
        product_difal = Product(
            tenant_id=opp.tenant_id,
            company_id=opp.company_id,
            codigo="PROD-DIFAL",
            nome="Câmera Bullet IP (DIFAL)",
            tipo="EQUIPAMENTO",
            finalidade="REVENDA",
            vlr_referencia_revenda=120.0,
            ativo=True
        )
        product_st = Product(
            tenant_id=opp.tenant_id,
            company_id=opp.company_id,
            codigo="PROD-ST",
            nome="Switch 24p POE (ST)",
            tipo="EQUIPAMENTO",
            finalidade="REVENDA",
            vlr_referencia_revenda=250.0,
            ativo=True
        )
        product_no_tax = Product(
            tenant_id=opp.tenant_id,
            company_id=opp.company_id,
            codigo="PROD-NO-TAX",
            nome="Cabo UTP Cat6 (Isento)",
            tipo="EQUIPAMENTO",
            finalidade="REVENDA",
            vlr_referencia_revenda=80.0,
            ativo=True
        )
        db.add_all([product_difal, product_st, product_no_tax])
        db.flush()

        # 5. Create suppliers
        supplier_a = Supplier(
            tenant_id=opp.tenant_id,
            cnpj="11111111000111",
            razao_social="TD SYNNEX Distribuidora S.A.",
            nome_fantasia="TD SYNNEX"
        )
        supplier_b = Supplier(
            tenant_id=opp.tenant_id,
            cnpj="22222222000122",
            razao_social="Ingram Micro S.A.",
            nome_fantasia="INGRAM MICRO"
        )
        db.add_all([supplier_a, supplier_b])
        db.flush()

        # 6. Create Opportunity Kit
        kit = OpportunityKit(
            tenant_id=opp.tenant_id,
            company_id=opp.company_id,
            sales_budget_id=opp.id,
            nome_kit="Kit CFTV Homologacao",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=36,
            considerar_st_ou_difal="DIFAL",
            fator_margem_locacao=1.2
        )
        db.add(kit)
        db.flush()

        # Add kit items
        kit_item_difal = OpportunityKitItem(
            kit_id=kit.id,
            tipo_item="PRODUTO",
            product_id=product_difal.id,
            descricao_item="Câmera Bullet IP (DIFAL) no Kit",
            quantidade_no_kit=10.0
        )
        kit_item_st = OpportunityKitItem(
            kit_id=kit.id,
            tipo_item="PRODUTO",
            product_id=product_st.id,
            descricao_item="Switch 24p POE (ST) no Kit",
            quantidade_no_kit=2.0
        )
        kit_item_no_tax = OpportunityKitItem(
            kit_id=kit.id,
            tipo_item="PRODUTO",
            product_id=product_no_tax.id,
            descricao_item="Cabo UTP Cat6 (Isento) no Kit",
            quantidade_no_kit=5.0
        )
        db.add_all([kit_item_difal, kit_item_st, kit_item_no_tax])
        db.flush()

        # Link kit to sales budget
        opp_item = SalesBudgetItem(
            budget_id=opp.id,
            opportunity_kit_id=kit.id,
            tipo_item="MERCADORIA",
            quantidade=1.0,
            custo_unit_base=3000.0,
            total_venda=4500.0
        )
        db.add(opp_item)
        db.flush()

        # 7. Create Supplier Budgets (Purchase Budgets)
        # Supplier A (TD SYNNEX) - with 30/60/90
        pb_a = PurchaseBudget(
            tenant_id=opp.tenant_id,
            company_id=opp.company_id,
            sales_budget_id=opp.id,
            supplier_id=supplier_a.id,
            tipo_orcamento='REVENDA',
            frete_tipo='CIF',
            data_orcamento=opp.data_orcamento,
            ipi_calculado=False,
            forma_pagamento_snapshot={"descricao": "30/60/90"}
        )
        db.add(pb_a)
        db.flush()

        pb_item_a1 = PurchaseBudgetItem(
            budget_id=pb_a.id,
            product_id=product_difal.id,
            quantidade=10.0,
            valor_unitario=85.00,
            total_item=850.00,
            difal_unitario=0.00,  # will be overridden by kit financials
            st_unitario=0.00
        )
        pb_item_a2 = PurchaseBudgetItem(
            budget_id=pb_a.id,
            product_id=product_no_tax.id,
            quantidade=5.0,
            valor_unitario=60.00,
            total_item=300.00,
            difal_unitario=0.00,
            st_unitario=0.00
        )
        db.add_all([pb_item_a1, pb_item_a2])
        db.flush()

        # Supplier B (INGRAM MICRO) - with À Vista
        pb_b = PurchaseBudget(
            tenant_id=opp.tenant_id,
            company_id=opp.company_id,
            sales_budget_id=opp.id,
            supplier_id=supplier_b.id,
            tipo_orcamento='REVENDA',
            frete_tipo='CIF',
            data_orcamento=opp.data_orcamento,
            ipi_calculado=False,
            forma_pagamento_snapshot={"descricao": "À Vista"}
        )
        db.add(pb_b)
        db.flush()

        pb_item_b1 = PurchaseBudgetItem(
            budget_id=pb_b.id,
            product_id=product_st.id,
            quantidade=2.0,
            valor_unitario=220.00,
            total_item=440.00,
            difal_unitario=0.00,
            st_unitario=0.00  # will be overridden by kit financials
        )
        db.add_all([pb_item_b1])
        db.flush()

        # Monkeypatch kit financials calculations to isolate tests
        from src.modules.opportunity_kits.service import OpportunityKitService
        original_calc = OpportunityKitService.calculate_financials
        OpportunityKitService.calculate_financials = lambda self, kit, tenant_id: {
            "item_summaries": [
                {
                    "product_id": str(product_difal.id),
                    "difal_unitario": 12.35,
                    "icms_st_unitario": 0.00,
                    "custo_base_unitario_item": 85.00,
                    "venda_unitario_item": 150.00,
                    "imposto_venda_item": 180.00  # 18.00 * 10
                },
                {
                    "product_id": str(product_st.id),
                    "difal_unitario": 0.00,
                    "icms_st_unitario": 34.60,
                    "custo_base_unitario_item": 220.00,
                    "venda_unitario_item": 400.00,
                    "imposto_venda_item": 96.00  # 48.00 * 2
                },
                {
                    "product_id": str(product_no_tax.id),
                    "difal_unitario": 0.00,
                    "icms_st_unitario": 0.00,
                    "custo_base_unitario_item": 60.00,
                    "venda_unitario_item": 100.00,
                    "imposto_venda_item": 0.00
                }
            ]
        }

        print(f"Testing report generation for Opportunity: {opp.titulo} ({opp.id})")

        # 3.5. Test the payment condition parser directly
        print("Testing parse_payment_condition parser...")
        from src.modules.sales_budgets.reports import parse_payment_condition
        
        # Test À Vista
        insts, obs = parse_payment_condition("À Vista", 1000.0, datetime.date(2026, 5, 31))
        assert len(insts) == 1
        assert insts[0]["percentual"] == "100.00"
        assert insts[0]["data_prevista"] == "31/05/2026"
        assert obs is None
        
        # Test 30/60/90
        insts, obs = parse_payment_condition("30/60/90", 1000.0, datetime.date(2026, 5, 31))
        assert len(insts) == 3
        assert insts[0]["percentual"] == "33.33"
        assert insts[1]["percentual"] == "33.33"
        assert insts[2]["percentual"] == "33.34"
        assert insts[0]["data_prevista"] == "30/06/2026"
        assert insts[1]["data_prevista"] == "30/07/2026"
        assert insts[2]["data_prevista"] == "29/08/2026"
        assert obs is None

        # Test 50% Entrada + 50% 30 Dias
        insts, obs = parse_payment_condition("50% Entrada + 50% 30 Dias", 1000.0, datetime.date(2026, 5, 31))
        assert len(insts) == 2
        assert insts[0]["percentual"] == "50.00"
        assert insts[0]["data_prevista"] == "31/05/2026"
        assert insts[1]["percentual"] == "50.00"
        assert insts[1]["data_prevista"] == "30/06/2026"
        assert obs is None
        
        # Test Fallback "Conforme negociação comercial"
        insts, obs = parse_payment_condition("Conforme negociação comercial", 1000.0, datetime.date(2026, 5, 31))
        assert len(insts) == 1
        assert insts[0]["percentual"] == "100.00"
        assert insts[0]["data_prevista"] == "Não Calculada"
        assert obs == "Forma de pagamento não estruturada."
        
        print("All parser unit tests PASSED!")

        # 4. Generate PDF Report via service (Fechamento Fornecedores)
        print("Invoking OpportunitiesReportService (Fechamento Fornecedores)...")
        response = OpportunitiesReportService.generate_fechamento_fornecedores_pdf(db, opp.id, user)  # type: ignore
        
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
            print("SUCCESS: Fechamento Fornecedores PDF generated successfully! Header starts with %PDF")
            print(f"PDF size: {len(pdf_bytes)} bytes")
            with open("test_output.pdf", "wb") as f:
                f.write(pdf_bytes)
            print("Saved PDF to test_output.pdf")
        else:
            print("FAILED: Fechamento Fornecedores PDF generated but header is invalid.")
            sys.exit(1)

        # 6. Generate PDF Report via service (Venda Approval)
        print("Invoking OpportunitiesReportService (Venda Approval)...")
        response_venda = OpportunitiesReportService.generate_venda_approval_pdf(db, opp.id, user)  # type: ignore
        pdf_bytes_venda = asyncio.run(read_stream(response_venda.body_iterator))

        if pdf_bytes_venda.startswith(b"%PDF"):
            print("SUCCESS: Venda Approval PDF generated successfully! Header starts with %PDF")
            print(f"PDF size: {len(pdf_bytes_venda)} bytes")
            with open("test_venda_approval_output.pdf", "wb") as f:
                f.write(pdf_bytes_venda)
            print("Saved PDF to test_venda_approval_output.pdf")
        else:
            print("FAILED: Venda Approval PDF generated but header is invalid.")
            sys.exit(1)

        # 7. Configure and Generate PDF Report via service (Locacao Approval)
        print("Configuring Rental/Comodato opportunity fields...")
        opp.tipo_receita_rental = "LOCACAO_SERVICO"  # type: ignore
        opp.prazo_contrato_meses = 36  # type: ignore
        opp.perc_pis_rental = Decimal("1.65")  # type: ignore
        opp.perc_cofins_rental = Decimal("7.60")  # type: ignore
        opp.perc_csll_rental = Decimal("1.00")  # type: ignore
        opp.perc_irpj_rental = Decimal("2.00")  # type: ignore
        opp.perc_iss_rental = Decimal("5.00")  # type: ignore
        db.flush()

        print("Adding rental items...")
        from src.modules.sales_budgets.models import RentalBudgetItem
        rental_item_1 = RentalBudgetItem(
            budget_id=opp.id,
            product_id=product_difal.id,
            quantidade=10.0,
            custo_aquisicao_unit=85.00,
            difal_unit=12.35,
            icms_st_unit=0.00,
            custo_total_aquisicao=97.35 * 10,
            prazo_contrato=36,
            valor_mensal=150.00,
            custo_total_mensal=10.00,
            impostos_mensal=20.00,
            lucro_mensal=120.00,
            fator_margem=1.2,
            comissao_mensal=5.00,
            is_kit_instalacao=False
        )
        rental_item_2 = RentalBudgetItem(
            budget_id=opp.id,
            product_id=product_st.id,
            opportunity_kit_id=kit.id,
            quantidade=2.0,
            custo_aquisicao_unit=220.00,
            difal_unit=0.00,
            icms_st_unit=34.60,
            custo_total_aquisicao=254.60 * 2,
            prazo_contrato=36,
            valor_mensal=400.00,
            custo_total_mensal=15.00,
            impostos_mensal=48.00,
            lucro_mensal=337.00,
            fator_margem=1.5,
            kit_comissao=10.00,
            is_kit_instalacao=False
        )
        opp.rental_items.append(rental_item_1)
        opp.rental_items.append(rental_item_2)
        db.add_all([rental_item_1, rental_item_2])
        db.flush()

        print("Invoking OpportunitiesReportService (Locacao Approval)...")
        response_locacao = OpportunitiesReportService.generate_locacao_approval_pdf(db, opp.id, user)  # type: ignore
        pdf_bytes_locacao = asyncio.run(read_stream(response_locacao.body_iterator))

        if pdf_bytes_locacao.startswith(b"%PDF"):
            print("SUCCESS: Locacao Approval PDF generated successfully! Header starts with %PDF")
            print(f"PDF size: {len(pdf_bytes_locacao)} bytes")
            with open("test_locacao_approval_output.pdf", "wb") as f:
                f.write(pdf_bytes_locacao)
            print("Saved PDF to test_locacao_approval_output.pdf")
        else:
            print("FAILED: Locacao Approval PDF generated but header is invalid.")
            sys.exit(1)
            
    except Exception as e:
        print(f"FAILED: Exception raised during PDF generation: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        # Restore monkeypatched kit financials calculation method
        try:
            OpportunityKitService.calculate_financials = original_calc
        except Exception:
            pass
        db.rollback()
        db.close()

if __name__ == "__main__":
    run_test()
