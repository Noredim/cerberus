import sys
sys.path.append('c:/cerberus/apps/api')

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.modules.users.models import User, UserRole, UserRoleEnum
from src.modules.companies.models import Company
from src.modules.customers.models import Customer
import src.modules.sales_proposals.models
import src.modules.sales_budgets.models
from src.modules.licitacoes.models import (
    Licitacao, LicitacaoLote, LicitacaoItem, LicitacaoAnalista, LicitacaoHistory,
    LicitacaoChecklistGrupo, LicitacaoChecklistItem, LicitacaoChecklistAplicacao,
    LicitacaoTarefa
)
from src.modules.licitacoes.schemas import LicitacaoDashboardResponse
from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitItem
from src.modules.opportunity_kits.service import OpportunityKitService
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.licitacoes.service import LicitacaoService

def run_dashboard_tests():
    print("Connecting to local database for dashboard tests...")
    engine = create_engine("postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Get active company/tenant
        company = db.query(Company).first()
        if not company:
            print("No company found.")
            return

        tenant_id = company.tenant_id
        company_id = company.id

        # Get or create customer
        customer = db.query(Customer).filter(Customer.tenant_id == tenant_id).first()
        if not customer:
            customer = Customer(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                cnpj="98765432000188",
                razao_social="Customer Dashboard Test",
                nome_fantasia="Customer Dash",
                tipo="PUBLICO",
                esfera="MUNICIPAL",
                active=True
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)

        # Create PO user
        po_user = db.query(User).filter(User.email == "po_dash@warslab.com.br").first()
        if not po_user:
            po_user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="PO Manager",
                email="po_dash@warslab.com.br",
                password_hash="pw",
                is_active=True
            )
            db.add(po_user)
            db.commit()
            db.refresh(po_user)

            po_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=po_user.id,
                role=UserRoleEnum.ENGENHARIA_PRECO
            )
            db.add(po_role)
            db.commit()

        # Create Analyst user
        analyst_user = db.query(User).filter(User.email == "analyst_dash@warslab.com.br").first()
        if not analyst_user:
            analyst_user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Analyst Dash",
                email="analyst_dash@warslab.com.br",
                password_hash="pw",
                is_active=True
            )
            db.add(analyst_user)
            db.commit()
            db.refresh(analyst_user)

            analyst_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=analyst_user.id,
                role=UserRoleEnum.ENGENHARIA_PRECO
            )
            db.add(analyst_role)
            db.commit()

        print("\n--- Setup test data for Dashboard ---")
        # 1. Create a Tender (Licitação)
        lic = Licitacao(
            tenant_id=tenant_id,
            company_id=company_id,
            customer_id=customer.id,
            numero_edital="Pregão Dash 100/2026",
            status="Criada",
            modalidade="Pregão",
            tipo_licitacao="Menor preço",
            valor_total_estimado=Decimal("200000.00"),
            valor_total_venda=Decimal("150000.00"),
            margem_ponderada_global=Decimal("45.5"),
            precisa_aprovacao_diretoria=False,
            aprovado_diretoria=False,
            po_id=po_user.id
        )
        db.add(lic)
        db.commit()
        db.refresh(lic)

        # 2. Add Lote and Item
        lote = LicitacaoLote(
            licitacao_id=lic.id,
            numero="Lote 1",
            nome="Lote Principal"
        )
        db.add(lote)
        db.commit()
        db.refresh(lote)

        item = LicitacaoItem(
            lote_id=lote.id,
            codigo="1.1",
            nome="Item Principal",
            quantidade=Decimal("10"),
            tipo_fornecimento="Unitário",
            quantidade_total=Decimal("10")
        )
        db.add(item)
        db.commit()
        db.refresh(item)

        # 3. Add Analyst and checklist
        analista = LicitacaoService.add_analista(
            db, tenant_id, company_id, lic.id,
            analyst_user.id, 5, po_user
        )

        LicitacaoService.seed_checklist(db, tenant_id, lic.id)
        checklist_groups = LicitacaoService.get_checklist(db, tenant_id, lic.id)

        # Retrieve a standard checklist item (Habilitação)
        hab_group = next(g for g in checklist_groups if g.nome == "Habilitação")
        hab_item = hab_group.items[0]
        # Assign it to the analyst
        LicitacaoService.update_checklist_item(
            db, tenant_id, hab_item.id,
            LicitacaoChecklistItemUpdate(usuario_id=analyst_user.id),
            po_user
        )

        # Retrieve a technical checklist item and assign it
        tech_group = next(g for g in checklist_groups if g.nome == "Análise Técnica")
        tech_item = tech_group.items[0]
        tech_app = LicitacaoService.create_technical_aplicacao(
            db, tenant_id, tech_item.id,
            LicitacaoChecklistAplicacaoCreate(usuario_id=analyst_user.id, observacao="Pending analysis"),
            po_user
        )

        # 4. Add Opportunity Kit for financial calculations
        kit = OpportunityKit(
            tenant_id=tenant_id,
            company_id=company_id,
            licitacao_id=lic.id,
            licitacao_item_id=item.id,
            nome_kit="Kit Test",
            tipo_contrato="VENDA_EQUIPAMENTOS",
            quantidade_kits=10,
            prazo_contrato_meses=12
        )
        db.add(kit)
        db.commit()
        db.refresh(kit)

        # Mock OpportunityKitService.calculate_financials to return expected numbers
        orig_calc = OpportunityKitService.calculate_financials
        OpportunityKitService.calculate_financials = lambda self, k, t: {
            "summary": {
                "valor_mensal_kit": Decimal("150000.00"),
                "lucro_mensal_kit": Decimal("67500.00"),
                "custo_total_mensal_kit": Decimal("82500.00"),
                "margem_kit": Decimal("45.0")
            },
            "item_summaries": []
        }

        # 5. Create some tasks (one overdue, one pending, one linked to a checklist item)
        # Task 1: Overdue, linked to hab_item
        past_deadline = datetime.now(timezone.utc) - timedelta(days=2)
        task_overdue = LicitacaoTarefa(
            tenant_id=tenant_id,
            licitacao_id=lic.id,
            titulo="Task Overdue",
            descricao="Linked to checklist",
            responsavel_id=analyst_user.id,
            criador_id=po_user.id,
            data_limite=past_deadline,
            status="Pendente",
            checklist_item_id=hab_item.id
        )
        db.add(task_overdue)

        # Task 2: Active, normal
        future_deadline = datetime.now(timezone.utc) + timedelta(days=2)
        task_pending = LicitacaoTarefa(
            tenant_id=tenant_id,
            licitacao_id=lic.id,
            titulo="Task Pending",
            responsavel_id=analyst_user.id,
            criador_id=po_user.id,
            data_limite=future_deadline,
            status="Em Andamento"
        )
        db.add(task_pending)
        db.commit()

        # Update checklist item status to Em Andamento as well (mocking)
        db.query(LicitacaoChecklistItem).filter(LicitacaoChecklistItem.id == hab_item.id).update({"status": "Em Andamento"})
        db.commit()

        # Run get_dashboard_summary and assert results
        print("\n--- Test: Dashboard Summary Output Validation ---")
        summary_res = LicitacaoService.get_dashboard_summary(db, tenant_id, company_id, lic.id, po_user)

        # 1. Resumo checks
        resumo = summary_res["resumo"]
        print(f"Resumo Edital: {resumo['numero_edital']}")
        assert resumo["numero_edital"] == "Pregão Dash 100/2026"
        assert resumo["po_responsavel"] == "PO Manager"
        assert resumo["qtd_analistas"] == 1
        assert resumo["qtd_lotes"] == 1
        assert resumo["qtd_itens"] == 1
        assert resumo["qtd_kits"] == 1

        # 2. Financeiro checks
        fin = summary_res["financeiro"]
        print(f"Financeiro Venda: {fin['total_venda']}, Custo: {fin['total_custo']}, Lucro: {fin['lucro_estimado']}")
        assert fin["total_venda"] == Decimal("150000.00")
        # total_custo = venta - lucro = 150000 - 67500 = 82500
        assert fin["total_custo"] == Decimal("82500.00")
        assert fin["lucro_estimado"] == Decimal("67500.00")

        # 3. Checklist Progress Checks
        chk = summary_res["checklist"]
        print(f"Checklist total: {chk['total']}, pendentes: {chk['pendentes']}, percentual: {chk['percentual']}")
        # Checklist items: 5 from habilitacao, 2 from fechamento (analysis group not counted in std_items), plus 1 tech application = 8 total.
        # Pendentes should reflect correctly.
        assert chk["total"] == 8

        # 4. Tarefas Progress Checks
        tar = summary_res["tarefas"]
        print(f"Tasks total: {tar['total']}, pendentes: {tar['pendentes']}, em_andamento: {tar['em_andamento']}")
        assert tar["total"] == 2
        assert tar["pendentes"] == 1
        assert tar["em_andamento"] == 1

        # 5. Analyst distribution checks
        dist = summary_res["distribuicao_analistas"]
        assert len(dist) == 1
        analyst_dist = dist[0]
        print(f"Analyst: {analyst_dist['nome']}, tarefas_atrasadas: {analyst_dist['tarefas_atrasadas']}, status_indicador: {analyst_dist['status_indicador']}")
        assert analyst_dist["nome"] == "Analyst Dash"
        assert analyst_dist["tarefas_atrasadas"] == 1
        # indicator should be Vermelho because analyst has an overdue task
        assert analyst_dist["status_indicador"] == "Vermelho"

        # 6. Alerts checks
        alertas = summary_res["alertas"]
        alert_types = [a["tipo"] for a in alertas]
        print(f"Triggered Alerts: {alert_types}")
        
        # Verify checklist item overdue trigger (because hab_item is linked to overdue task)
        assert "CHECKLIST_ATRASADO" in alert_types
        # Verify normal task overdue trigger
        assert "TAREFA_ATRASADA" in alert_types
        # Verify analyst with overdue task trigger
        assert "ANALISTA_COM_TAREFA_VENCIDA" in alert_types

        # Validate against Pydantic schema
        print("\n--- Validating Pydantic DTO ---")
        pydantic_validated = LicitacaoDashboardResponse.model_validate(summary_res)
        print("Schema verification passed [SUCCESS]")

        print("\n--- Cleanup ---")
        # Restore service mock
        OpportunityKitService.calculate_financials = orig_calc

        db.delete(task_overdue)
        db.delete(task_pending)
        db.delete(kit)
        
        # Delete checklist groups and applications
        db.query(LicitacaoChecklistAplicacao).filter(LicitacaoChecklistAplicacao.licitacao_id == lic.id).delete()
        items_to_del = db.query(LicitacaoChecklistItem).join(LicitacaoChecklistGrupo).filter(LicitacaoChecklistGrupo.licitacao_id == lic.id).all()
        for it in items_to_del:
            db.delete(it)
        db.commit()
        db.query(LicitacaoChecklistGrupo).filter(LicitacaoChecklistGrupo.licitacao_id == lic.id).delete()

        db.delete(analista)
        db.delete(item)
        db.delete(lote)
        db.delete(lic)
        db.commit()

        print("Dashboard Tests Passed [SUCCESS]")

    finally:
        db.close()

if __name__ == "__main__":
    from src.modules.licitacoes.schemas import LicitacaoChecklistItemUpdate, LicitacaoChecklistAplicacaoCreate
    run_dashboard_tests()
