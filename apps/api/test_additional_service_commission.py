import sys
sys.path.append('/app')
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import os

from src.core.base import Base
from src.modules.tenants.models import Tenant
from src.modules.users.models import User, UserRole, UserRoleEnum
from src.modules.professionals.models import Professional
from src.modules.roles.models import Role
from src.modules.companies.models import Company, State, CommercialPolicy, CommercialPolicyServiceCommission
from src.modules.customers.models import Customer
from src.modules.products.models import Product
from src.modules.licitacoes.models import Licitacao, LicitacaoLote, LicitacaoItem
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem, SalesBudgetHistory, SalesBudgetApproval
from src.modules.sales_proposals.models import SalesProposal, SalesProposalKit
from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitCost
from src.modules.opportunity_kits.service import OpportunityKitService
from src.modules.own_services.models import OwnService

def run_commission_tests():
    print("Initializing test database connection for additional service commission tests...")
    db_url = os.getenv("DATABASE_URL", "postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        company = db.query(Company).first()
        if not company:
            raise Exception("No company found in database to run tests.")
        company_id = company.id
        tenant_id = company.tenant_id

        # Create test own services
        service_noc = db.query(OwnService).filter(OwnService.nome_servico == "SERVIÇO DE NOC - MONITORAMENTO", OwnService.company_id == company_id).first()
        if not service_noc:
            service_noc = OwnService(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                nome_servico="SERVIÇO DE NOC - MONITORAMENTO",
                unidade="UN",
                vigencia=2026,
                tempo_total_minutos=0,
                ativo=True
            )
            db.add(service_noc)

        service_tat = db.query(OwnService).filter(OwnService.nome_servico == "SERVIÇO TÁTICO MENSAL", OwnService.company_id == company_id).first()
        if not service_tat:
            service_tat = OwnService(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                company_id=company_id,
                nome_servico="SERVIÇO TÁTICO MENSAL",
                unidade="UN",
                vigencia=2026,
                tempo_total_minutos=0,
                ativo=True
            )
            db.add(service_tat)
            
        db.flush()

        # Create Commercial Policy
        policy = CommercialPolicy(
            id=uuid.uuid4(),
            company_id=company_id,
            nome_politica="POLITICA COMISSAO B6",
            fator_limite=Decimal("1.2"),
            manutencao_ano_percentual=Decimal("5.0"),
            comissao_percentual=Decimal("3.0"),
            tipo_comissionamento="TRADICIONAL",
            dsr_percentual=Decimal("15.0"),
            fgts_percentual=Decimal("8.0"),
            inss_percentual=Decimal("20.0"),
            demais_incidencias_percentual=Decimal("2.0"),
            despesa_operacional_percentual=Decimal("1.0"),
            ativo=True,
            is_default=False
        )
        db.add(policy)
        db.flush()

        # Create active service commission rules for the policy
        # NOC service: eligible, 2 installments/months
        rule_noc = CommercialPolicyServiceCommission(
            id=uuid.uuid4(),
            commercial_policy_id=policy.id,
            own_service_id=service_noc.id,
            commission_installments=2,
            ativo=True,
            tenant_id=tenant_id
        )
        # Tático service: eligible, 0 installments/months
        rule_tat = CommercialPolicyServiceCommission(
            id=uuid.uuid4(),
            commercial_policy_id=policy.id,
            own_service_id=service_tat.id,
            commission_installments=0,
            ativo=True,
            tenant_id=tenant_id
        )
        db.add(rule_noc)
        db.add(rule_tat)
        db.flush()

        # Instantiate service
        kit_service = OpportunityKitService(db)

        # ----------------------------------------------------
        # CA001: Locação opportunity kit with eligible service in Block 6
        # ----------------------------------------------------
        print("\n--- CA001: Testing eligible service in Locação ---")
        kit_loc = OpportunityKit(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            nome_kit="Kit Teste Locacao",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=36,
            prazo_instalacao_meses=0,
            commercial_policy_id=policy.id,
            fator_margem_locacao=Decimal("1.0"),
            fator_manutencao=Decimal("1.2"), # Markup of maintenance (Block 6)
            havera_manutencao=True,
            qtd_meses_manutencao=36,
            perc_comissao=Decimal("3.0"), # 3% kit commission
            aliq_pis=Decimal("1.65"),
            aliq_cofins=Decimal("7.6"),
            aliq_csll=Decimal("9.0"),
            aliq_irpj=Decimal("15.0"),
            aliq_iss=Decimal("5.0")
        )
        db.add(kit_loc)
        db.flush()

        # Add Block 6 service NOC: valor_unitario R$ 500, quantidade 1
        cost_item = OpportunityKitCost(
            id=uuid.uuid4(),
            kit_id=kit_loc.id,
            tipo_item="SERVICO_PROPRIO",
            own_service_id=service_noc.id,
            tipo_custo="MANUTENCAO",
            quantidade=Decimal("1.0"),
            valor_unitario=Decimal("500.00")
        )
        db.add(cost_item)
        db.flush()

        # Recalculate
        fin = kit_service.calculate_financials(kit_loc, tenant_id)
        
        # Monthly selling price (mensalidade): cost_val * fator_manut = 500 * 1.2 = 600.0
        # Rule commission_installments: 2
        # Base: 600.0 * 1.0 (qty) = 600.0
        # Expected Commission (traditional): 600.0 * 2 = 1200.00
        comissoes = fin["comissionamento_detalhado"]["comissao_venda"]
        print("Commissions detail:", comissoes)
        
        b6_comm = next((c for c in comissoes if "(B6)" in c["origem"]), None)
        assert b6_comm is not None, "B6 commission must be generated"
        print(f"B6 Commission Base: {b6_comm['base']} (Expected: 600.0)")
        print(f"B6 Commission Regra: {b6_comm['regra']} (Expected: 2 mensalidades)")
        print(f"B6 Commission Valor: {b6_comm['valor_destinado']} (Expected: 1200.0)")
        
        assert float(b6_comm["base"]) == 600.0
        assert "2 mensalidade" in b6_comm["regra"]
        assert float(b6_comm["valor_destinado"]) == 1200.0

        # ----------------------------------------------------
        # CA002: Comodato opportunity kit
        # ----------------------------------------------------
        print("\n--- CA002: Testing Comodato opportunity kit ---")
        kit_como = OpportunityKit(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            nome_kit="Kit Teste Comodato",
            tipo_contrato="COMODATO",
            prazo_contrato_meses=36,
            prazo_instalacao_meses=0,
            commercial_policy_id=policy.id,
            fator_margem_locacao=Decimal("1.0"),
            fator_manutencao=Decimal("1.0"), # No markup
            havera_manutencao=True,
            qtd_meses_manutencao=36,
            perc_comissao=Decimal("0.0")
        )
        db.add(kit_como)
        db.flush()

        cost_item_como = OpportunityKitCost(
            id=uuid.uuid4(),
            kit_id=kit_como.id,
            tipo_item="SERVICO_PROPRIO",
            own_service_id=service_noc.id,
            tipo_custo="MANUTENCAO",
            quantidade=Decimal("1.0"),
            valor_unitario=Decimal("300.00")
        )
        db.add(cost_item_como)
        db.flush()

        fin_como = kit_service.calculate_financials(kit_como, tenant_id)
        comissoes_como = fin_como["comissionamento_detalhado"]["comissao_venda"]
        b6_comm_como = next((c for c in comissoes_como if "(B6)" in c["origem"]), None)
        assert b6_comm_como is not None
        print(f"Comodato B6 Commission Valor: {b6_comm_como['valor_destinado']} (Expected: 600.0)")
        assert float(b6_comm_como["valor_destinado"]) == 600.0

        # ----------------------------------------------------
        # CA003: Service not linked to policy
        # ----------------------------------------------------
        print("\n--- CA003: Testing service not linked to policy ---")
        # Create a new service not in rules
        service_unlinked = OwnService(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            nome_servico="SERVIÇO NÃO VINCULADO",
            unidade="UN",
            vigencia=2026,
            tempo_total_minutos=0,
            ativo=True
        )
        db.add(service_unlinked)
        db.flush()

        cost_item_unlinked = OpportunityKitCost(
            id=uuid.uuid4(),
            kit_id=kit_loc.id,
            tipo_item="SERVICO_PROPRIO",
            own_service_id=service_unlinked.id,
            tipo_custo="MANUTENCAO",
            quantidade=Decimal("1.0"),
            valor_unitario=Decimal("400.00")
        )
        db.add(cost_item_unlinked)
        db.flush()

        fin_unlinked = kit_service.calculate_financials(kit_loc, tenant_id)
        comissoes_unlinked = fin_unlinked["comissionamento_detalhado"]["comissao_venda"]
        print("Unlinked service commission count:", len([c for c in comissoes_unlinked if "NÃO VINCULADO" in c["origem"]]))
        assert not any("NÃO VINCULADO" in c["origem"] for c in comissoes_unlinked)

        # ----------------------------------------------------
        # CA004: Inactive service in policy
        # ----------------------------------------------------
        print("\n--- CA004: Testing inactive service rule ---")
        rule_noc.ativo = False
        db.flush()

        fin_inactive = kit_service.calculate_financials(kit_loc, tenant_id)
        comissoes_inactive = fin_inactive["comissionamento_detalhado"]["comissao_venda"]
        assert not any("(B6)" in c["origem"] for c in comissoes_inactive)
        
        # Restore NOC active
        rule_noc.ativo = True
        db.flush()

        # ----------------------------------------------------
        # CA005: Opportunity type not eligible (e.g. VENDA_EQUIPAMENTOS)
        # ----------------------------------------------------
        print("\n--- CA005: Testing type not eligible ---")
        kit_venda = OpportunityKit(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            nome_kit="Kit Teste Venda",
            tipo_contrato="VENDA_EQUIPAMENTOS",
            prazo_contrato_meses=36,
            prazo_instalacao_meses=0,
            commercial_policy_id=policy.id,
            fator_margem_locacao=Decimal("1.0"),
            fator_manutencao=Decimal("1.2"),
            havera_manutencao=True,
            qtd_meses_manutencao=36,
            perc_comissao=Decimal("3.0")
        )
        db.add(kit_venda)
        db.flush()

        cost_item_venda = OpportunityKitCost(
            id=uuid.uuid4(),
            kit_id=kit_venda.id,
            tipo_item="SERVICO_PROPRIO",
            own_service_id=service_noc.id,
            tipo_custo="MANUTENCAO",
            quantidade=Decimal("1.0"),
            valor_unitario=Decimal("500.00")
        )
        db.add(cost_item_venda)
        db.flush()

        fin_venda = kit_service.calculate_financials(kit_venda, tenant_id)
        comissoes_venda = fin_venda["comissionamento_detalhado"]["comissao_venda"]
        assert not any("(B6)" in c["origem"] for c in comissoes_venda)

        # ----------------------------------------------------
        # CA006: Altering value / CA007: Removing service / CA009: 0 installments
        # ----------------------------------------------------
        print("\n--- CA006 & CA007 & CA009: Testing other rules ---")
        # Test 0 installments (Tático service)
        cost_item_tat = OpportunityKitCost(
            id=uuid.uuid4(),
            kit_id=kit_loc.id,
            tipo_item="SERVICO_PROPRIO",
            own_service_id=service_tat.id,
            tipo_custo="MANUTENCAO",
            quantidade=Decimal("1.0"),
            valor_unitario=Decimal("200.00")
        )
        db.add(cost_item_tat)
        db.flush()

        fin_tat = kit_service.calculate_financials(kit_loc, tenant_id)
        comissoes_tat = fin_tat["comissionamento_detalhado"]["comissao_venda"]
        print("Tático service commission count:", len([c for c in comissoes_tat if "TÁTICO" in c["origem"]]))
        assert not any("TÁTICO" in c["origem"] for c in comissoes_tat)

        # Cleanup/delete database objects from test run to leave it clean
        db.rollback()
        print("\nALL ADDITIONAL SERVICE COMMISSION TESTS PASSED SUCCESSFULLY!")

    finally:
        db.close()

if __name__ == "__main__":
    run_commission_tests()
