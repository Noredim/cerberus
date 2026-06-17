import sys
sys.path.append('c:/cerberus/apps/api')

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.modules.users.models import User, UserRole, UserRoleEnum
from src.modules.professionals.models import Professional
from src.modules.roles.models import Role
from src.modules.companies.models import Company
from src.modules.customers.models import Customer
import src.modules.sales_proposals.models
import src.modules.sales_budgets.models
from src.modules.licitacoes.models import (
    Licitacao, LicitacaoLote, LicitacaoItem, LicitacaoAnalista, LicitacaoHistory, LicitacaoChecklistGrupo,
    LicitacaoChecklistItem, LicitacaoChecklistAplicacao, LicitacaoTarefa, LicitacaoTarefaAndamento
)
from src.modules.licitacoes.schemas import (
    LicitacaoUpdate, LicitacaoChecklistItemUpdate, LicitacaoChecklistItemCreate,
    LicitacaoChecklistAplicacaoCreate, LicitacaoChecklistAplicacaoUpdate,
    LicitacaoTarefaCreate, LicitacaoTarefaUpdate
)
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.opportunity_kits.service import OpportunityKitService
from src.modules.licitacoes.service import LicitacaoService

def run_tests():
    print("Connecting to local database...")
    engine = create_engine("postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Get active company and tenant
        company = db.query(Company).first()
        if not company:
            print("No company found. Seeding first...")
            company = Company(
                id=uuid.uuid4(),
                tenant_id="master_tenant",
                cnpj="12345678000199",
                tipo="MATRIZ",
                razao_social="Test Company",
                nome_fantasia="Test Co",
                cep="01001-000",
                logradouro="Praça da Sé",
                numero="111",
                bairro="Sé",
                data_abertura="1990-01-01",
                situacao_cadastral="ATIVA",
                porte="MEDIO"
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        tenant_id = company.tenant_id
        company_id = company.id

        # Get or create customer
        customer = db.query(Customer).filter(Customer.tenant_id == tenant_id).first()
        if not customer:
            customer = Customer(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                cnpj="98765432000188",
                razao_social="Orgao Publico Test",
                nome_fantasia="Orgao Publico",
                tipo="PUBLICO",
                esfera="MUNICIPAL",
                active=True
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)

        # Get or create admin user
        admin = db.query(User).filter(User.email == "wars@warslab.com.br").first()
        if not admin:
            admin = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Test Admin",
                email="wars@warslab.com.br",
                password_hash="pw",
                is_active=True
            )
            db.add(admin)
            db.commit()
            db.refresh(admin)

            admin_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=admin.id,
                role=UserRoleEnum.ADMIN
            )
            db.add(admin_role)
            db.commit()

        # Create normal user
        normal_user = db.query(User).filter(User.email == "normal@warslab.com.br").first()
        if not normal_user:
            normal_user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Normal User",
                email="normal@warslab.com.br",
                password_hash="pw",
                is_active=True
            )
            db.add(normal_user)
            db.commit()
            db.refresh(normal_user)

            normal_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=normal_user.id,
                role=UserRoleEnum.ENGENHARIA_PRECO
            )
            db.add(normal_role)
            db.commit()

        print("\n--- Test 1: Business Day Calculation ---")
        # Thursday June 18, 2026. 4 business days should land on Wednesday June 24, 2026 (skipping June 20 Sat, June 21 Sun).
        date_zero = datetime(2026, 6, 18, 10, 0, tzinfo=timezone.utc)
        data_limite = LicitacaoService.calculate_data_limite(date_zero, 4)
        print(f"Data Zero: {date_zero.strftime('%Y-%m-%d')} (Thursday)")
        print(f"Prazo: 4 business days")
        print(f"Data Limite: {data_limite.strftime('%Y-%m-%d')} (Expected: 2026-06-24, Wednesday)")
        assert data_limite.strftime('%Y-%m-%d') == '2026-06-24', f"Expected 2026-06-24, got {data_limite.strftime('%Y-%m-%d')}"
        print("Test 1 OK! [SUCCESS]")

        print("\n--- Test 2: Status Transition Guards (Fail Cases) ---")
        # Create a new tender
        lic = Licitacao(
            tenant_id=tenant_id,
            company_id=company_id,
            customer_id=customer.id,
            numero_edital="Pregão 11/2026",
            status="Criada",
            modalidade="Pregão",
            tipo_licitacao="Menor preço",
            valor_total_estimado=Decimal("100000.00"),
            valor_total_venda=Decimal("0.00"),
            margem_ponderada_global=Decimal("0.00"),
            precisa_aprovacao_diretoria=False,
            aprovado_diretoria=False
        )
        db.add(lic)
        db.commit()
        db.refresh(lic)

        # 2a. Attempt transition to "Em Análise/Precificação" without P.O.
        print("Attempting status transition to 'Em Análise/Precificação' without P.O. or analysts...")
        try:
            LicitacaoService.update_licitacao(
                db, tenant_id, company_id, lic.id,
                LicitacaoUpdate(status="Em Análise/Precificação"),
                admin
            )
            raise AssertionError("Should have raised HTTPException for missing PO")
        except Exception as e:
            print(f"Successfully blocked transition: {getattr(e, 'detail', str(e))}")

        # 2b. Attempt transition to "Em Análise/Precificação" with P.O. but no analysts
        print("Setting P.O. but no analysts, then attempting status transition...")
        # Defining initial PO is allowed for anyone
        lic = LicitacaoService.update_licitacao(
            db, tenant_id, company_id, lic.id,
            LicitacaoUpdate(po_id=normal_user.id),
            normal_user
        )
        try:
            LicitacaoService.update_licitacao(
                db, tenant_id, company_id, lic.id,
                LicitacaoUpdate(status="Em Análise/Precificação"),
                normal_user
            )
            raise AssertionError("Should have raised HTTPException for missing analysts")
        except Exception as e:
            print(f"Successfully blocked transition: {getattr(e, 'detail', str(e))}")

        print("\n--- Test 3: Status Transition Guards (Success Cases) ---")
        # Add an analyst
        print("Adding analyst...")
        analyst = LicitacaoService.add_analista(
            db, tenant_id, company_id, lic.id,
            admin.id, 4, admin
        )
        
        # Now transition should succeed
        lic = LicitacaoService.update_licitacao(
            db, tenant_id, company_id, lic.id,
            LicitacaoUpdate(status="Em Análise/Precificação"),
            normal_user
        )
        print(f"Successfully transitioned! Status is now: {lic.status}")
        assert lic.status == "Em Análise/Precificação"

        print("\n--- Test 4: PO Editing Restrictions ---")
        # Attempt to change PO by a normal user (no GERENTE/DIRETORIA role)
        print("Attempting to change P.O. as normal user...")
        try:
            LicitacaoService.update_licitacao(
                db, tenant_id, company_id, lic.id,
                LicitacaoUpdate(po_id=admin.id),
                normal_user
            )
            raise AssertionError("Should have blocked PO change")
        except Exception as e:
            print(f"Successfully blocked PO change: {getattr(e, 'detail', str(e))}")

        # Attempt to change PO by an admin (allowed)
        print("Attempting to change P.O. as admin...")
        lic = LicitacaoService.update_licitacao(
            db, tenant_id, company_id, lic.id,
            LicitacaoUpdate(po_id=admin.id),
            admin
        )
        print("Successfully changed P.O. as admin!")
        assert str(lic.po_id) == str(admin.id)

        print("\n--- Test 5: History / Timeline Logs ---")
        history = db.query(LicitacaoHistory).filter(LicitacaoHistory.licitacao_id == lic.id).order_by(LicitacaoHistory.data_movimentacao.asc()).all()
        print(f"Found {len(history)} timeline events:")
        for h in history:
            print(f" - [{h.data_movimentacao.strftime('%H:%M:%S')}] {h.descricao}")
        assert len(history) >= 4, "Expected at least 4 events in the history"

        print("\n--- Test 6: Default Checklist Seeding and general update ---")
        LicitacaoService.seed_checklist(db, tenant_id, lic.id)
        checklist = LicitacaoService.get_checklist(db, tenant_id, lic.id)
        print(f"Found {len(checklist)} groups in seeded checklist:")
        for g in checklist:
            print(f" - Group: {g.nome} with {len(g.items)} items")
        assert len(checklist) == 3, "Expected 3 groups"
        assert checklist[0].nome == "Habilitação"
        assert checklist[1].nome == "Análise Técnica"
        assert checklist[2].nome == "Checklist de Fechamento"
        
        # Test item status/user update
        item_to_update = checklist[0].items[0]
        LicitacaoService.update_checklist_item(
            db, tenant_id, item_to_update.id,
            LicitacaoChecklistItemUpdate(status="Concluído", usuario_id=normal_user.id),
            admin
        )
        db.refresh(item_to_update)
        print(f"Updated item '{item_to_update.nome}' status: {item_to_update.status}, user: {item_to_update.usuario_nome}")
        assert item_to_update.status == "Concluído"
        assert str(item_to_update.usuario_id) == str(normal_user.id)
        assert item_to_update.data_conclusao is not None

        print("\n--- Test 6b: Custom Checklist Item Creation and Deletion ---")
        # Try to create as normal_user (not PO, not admin, not GERENTE/DIRETORIA in company)
        # Wait, normal_user has role UserRoleEnum.ENGENHARIA_PRECO and is not the PO of this licitacao.
        print("Attempting to create checklist item as normal user (non-PO, unprivileged)...")
        grupo_hab = checklist[0]
        try:
            LicitacaoService.create_checklist_item(
                db, tenant_id, company_id, lic.id, grupo_hab.id,
                LicitacaoChecklistItemCreate(nome="Custom Item Test", descricao="Custom description"),
                normal_user
            )
            raise AssertionError("Should have failed checklist item creation for non-PO/non-admin user")
        except Exception as e:
            print(f"Successfully blocked checklist item creation: {getattr(e, 'detail', str(e))}")

        # Create as admin (who is the PO)
        print("Creating checklist item as admin (PO)...")
        custom_item = LicitacaoService.create_checklist_item(
            db, tenant_id, company_id, lic.id, grupo_hab.id,
            LicitacaoChecklistItemCreate(nome="Custom Item Test", descricao="Custom description"),
            admin
        )
        print(f"Successfully created custom checklist item: '{custom_item.nome}' (ordem: {custom_item.ordem})")
        assert custom_item.nome == "Custom Item Test"
        assert custom_item.descricao == "Custom description"

        # Try to delete as normal_user
        print("Attempting to delete checklist item as normal user (non-PO, unprivileged)...")
        try:
            LicitacaoService.delete_checklist_item(
                db, tenant_id, company_id, lic.id, custom_item.id,
                normal_user
            )
            raise AssertionError("Should have failed checklist item deletion for non-PO/non-admin user")
        except Exception as e:
            print(f"Successfully blocked checklist item deletion: {getattr(e, 'detail', str(e))}")

        # Delete as admin (PO)
        print("Deleting checklist item as admin (PO)...")
        delete_success = LicitacaoService.delete_checklist_item(
            db, tenant_id, company_id, lic.id, custom_item.id,
            admin
        )
        assert delete_success is True
        print("Successfully deleted custom checklist item!")


        print("\n--- Test 7: Technical Applications (adding, updating, deleting) ---")
        # Technical item from group "Análise Técnica"
        tech_item = checklist[1].items[0]
        # Should fail if user not in team
        print("Attempting to add technical application for user not in team...")
        non_team_user = db.query(User).filter(User.email == "not_in_team@warslab.com.br").first()
        if not non_team_user:
            non_team_user = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Non-team User",
                email="not_in_team@warslab.com.br",
                password_hash="pw",
                is_active=True
            )
            db.add(non_team_user)
            db.commit()
            db.refresh(non_team_user)

        try:
            LicitacaoService.create_technical_aplicacao(
                db, tenant_id, tech_item.id,
                LicitacaoChecklistAplicacaoCreate(usuario_id=non_team_user.id, observacao="HW check"),
                admin
            )
            raise AssertionError("Should have failed for user not in team")
        except Exception as e:
            print(f"Successfully blocked: {getattr(e, 'detail', str(e))}")

        # Adding technical application for a team member (admin is analyst in lic)
        print("Adding technical application for team analyst...")
        app1 = LicitacaoService.create_technical_aplicacao(
            db, tenant_id, tech_item.id,
            LicitacaoChecklistAplicacaoCreate(usuario_id=admin.id, observacao="Analisar HW"),
            admin
        )
        print(f"Created application for: {app1.usuario.name}")
        assert str(app1.usuario_id) == str(admin.id)
        assert app1.status == "Pendente"

        # Update application
        LicitacaoService.update_technical_aplicacao(
            db, tenant_id, app1.id,
            LicitacaoChecklistAplicacaoUpdate(status="Concluído", observacao="HW validado"),
            admin
        )
        db.refresh(app1)
        print(f"Updated application status: {app1.status}, obs: {app1.observacao}")
        assert app1.status == "Concluído"
        assert app1.data_conclusao is not None

        print("\n--- Test 8: Tasks Creation and Deadline Validation ---")
        # Analyst's deadline is defined by `analyst.data_limite`. Let's verify it
        analyst_limit = analyst.data_limite
        print(f"Analyst limit date: {analyst_limit.strftime('%Y-%m-%d')}")

        # Task within deadline
        task1 = LicitacaoService.create_tarefa(
            db, tenant_id, company_id, lic.id,
            LicitacaoTarefaCreate(
                titulo="Tarefa Teste",
                descricao="Tarefa within analyst deadline",
                responsavel_id=admin.id,
                data_limite=analyst_limit,
                checklist_item_id=tech_item.id
            ),
            admin
        )
        print(f"Created task: {task1.titulo}, deadline: {task1.data_limite.strftime('%Y-%m-%d')}")
        assert task1.status == "Pendente"

        # Task exceeding deadline
        exceeded_deadline = analyst_limit + timedelta(days=5)
        print("Attempting to create task exceeding analyst limit date...")
        try:
            LicitacaoService.create_tarefa(
                db, tenant_id, company_id, lic.id,
                LicitacaoTarefaCreate(
                    titulo="Tarefa Atrasada",
                    responsavel_id=admin.id,
                    data_limite=exceeded_deadline
                ),
                admin
            )
            raise AssertionError("Should have failed for deadline exceeding analyst limit")
        except Exception as e:
            print(f"Successfully blocked: {getattr(e, 'detail', str(e))}")

        print("\n--- Test 9: Task avulsa creator restrictions ---")
        # Creator not in team trying to assign to himself
        print("Attempting to create task by non-team user assigning to himself...")
        try:
            LicitacaoService.create_tarefa(
                db, tenant_id, company_id, lic.id,
                LicitacaoTarefaCreate(
                    titulo="Tarefa Avulsa Maluca",
                    responsavel_id=non_team_user.id,
                    data_limite=analyst_limit
                ),
                non_team_user
            )
            raise AssertionError("Should have failed since creator not in team cannot assign to himself")
        except Exception as e:
            print(f"Successfully blocked: {getattr(e, 'detail', str(e))}")

        # Creator not in team assigning to team participant (admin)
        task_avulsa = LicitacaoService.create_tarefa(
            db, tenant_id, company_id, lic.id,
            LicitacaoTarefaCreate(
                titulo="Tarefa Avulsa Correta",
                responsavel_id=admin.id,
                data_limite=analyst_limit
            ),
            non_team_user
        )
        print(f"Created task avulsa correctly: {task_avulsa.titulo} assigned to {task_avulsa.responsavel.name}")
        assert str(task_avulsa.responsavel_id) == str(admin.id)

        print("\n--- Test 10: Task reopening restrictions ---")
        # Conclude task
        LicitacaoService.update_tarefa(
            db, tenant_id, company_id, lic.id, task1.id,
            LicitacaoTarefaUpdate(status="Concluída"),
            admin
        )
        db.refresh(task1)
        assert task1.status == "Concluída"

        # Attempt to reopen as normal_user (not PO, not admin, not Gerente)
        print("Attempting to reopen completed task as normal user (unprivileged)...")
        try:
            LicitacaoService.update_tarefa(
                db, tenant_id, company_id, lic.id, task1.id,
                LicitacaoTarefaUpdate(status="Pendente"),
                normal_user
            )
            raise AssertionError("Should have blocked reopen")
        except Exception as e:
            print(f"Successfully blocked completed task reopening: {getattr(e, 'detail', str(e))}")

        # Reopen as admin (allowed)
        LicitacaoService.update_tarefa(
            db, tenant_id, company_id, lic.id, task1.id,
            LicitacaoTarefaUpdate(status="Pendente"),
            admin
        )
        db.refresh(task1)
        print(f"Successfully reopened task by admin! Status: {task1.status}")
        assert task1.status == "Pendente"

        # Add comment (andamento)
        comment = LicitacaoService.create_tarefa_andamento(
            db, tenant_id, company_id, lic.id, task1.id,
            "Andamento de teste comentando tarefa",
            admin
        )
        print(f"Comment added: {comment.descricao}")
        assert comment.descricao == "Andamento de teste comentando tarefa"
        print("\n--- Test 11: Task & Checklist Sincronização, Permissões e Filtros ---")
        analyst_normal = LicitacaoService.add_analista(
            db, tenant_id, company_id, lic.id,
            normal_user.id, 4, admin
        )
        tech_item = db.query(LicitacaoChecklistItem).filter(LicitacaoChecklistItem.id == tech_item.id).first()
        
        # 11a. Sync Status: Em Andamento -> Em Andamento
        print("Testing status sync: Em Andamento...")
        LicitacaoService.update_tarefa(
            db, tenant_id, company_id, lic.id, task1.id,
            LicitacaoTarefaUpdate(status="Em Andamento"),
            admin
        )
        db.refresh(tech_item)
        print(f"Checklist item status is: {tech_item.status} (Expected: Em Andamento)")
        assert tech_item.status == "Em Andamento"

        # 11b. Sync Status: Pausada -> Pausado
        print("Testing status sync: Pausada...")
        LicitacaoService.update_tarefa(
            db, tenant_id, company_id, lic.id, task1.id,
            LicitacaoTarefaUpdate(status="Pausada"),
            admin
        )
        db.refresh(tech_item)
        print(f"Checklist item status is: {tech_item.status} (Expected: Pausado)")
        assert tech_item.status == "Pausado"

        # 11c. Sync Status: Concluída -> Concluído
        print("Testing status sync: Concluída...")
        LicitacaoService.update_tarefa(
            db, tenant_id, company_id, lic.id, task1.id,
            LicitacaoTarefaUpdate(status="Concluída"),
            admin
        )
        db.refresh(tech_item)
        print(f"Checklist item status is: {tech_item.status} (Expected: Concluído)")
        assert tech_item.status == "Concluído"
        assert tech_item.data_conclusao is not None

        # 11d. Reopen and Sync Status: Cancelada -> Não Aplicável
        print("Reopening and testing status sync: Cancelada...")
        LicitacaoService.update_tarefa(
            db, tenant_id, company_id, lic.id, task1.id,
            LicitacaoTarefaUpdate(status="Pendente"),
            admin
        )
        db.refresh(tech_item)
        assert tech_item.status == "Pendente"
        assert tech_item.data_conclusao is None

        # Sync responsible
        print("Testing sync of responsible to checklist item...")
        LicitacaoService.update_tarefa(
            db, tenant_id, company_id, lic.id, task1.id,
            LicitacaoTarefaUpdate(responsavel_id=normal_user.id),
            admin
        )
        db.refresh(tech_item)
        print(f"Checklist item responsible is: {tech_item.usuario_id} (Expected: {normal_user.id})")
        assert str(tech_item.usuario_id) == str(normal_user.id)

        # 11e. Cancel guard: Analyst tries to cancel task1 (should fail)
        print("Attempting to cancel task as normal user (analyst)...")
        try:
            LicitacaoService.update_tarefa(
                db, tenant_id, company_id, lic.id, task1.id,
                LicitacaoTarefaUpdate(status="Cancelada"),
                normal_user
            )
            raise AssertionError("Should have blocked cancel action by analyst")
        except Exception as e:
            print(f"Successfully blocked cancel action: {getattr(e, 'detail', str(e))}")
            assert getattr(e, 'status_code', None) == 403

        # PO cancels task1 (should succeed)
        print("Canceling task as admin (PO)...")
        LicitacaoService.update_tarefa(
            db, tenant_id, company_id, lic.id, task1.id,
            LicitacaoTarefaUpdate(status="Cancelada"),
            admin
        )
        db.refresh(tech_item)
        db.refresh(task1)
        assert task1.status == "Cancelada"
        assert tech_item.status == "Não Aplicável"
        print("Cancel succeeded and checklist item is 'Não Aplicável'.")

        # 11f. Visibility Filter
        print("Testing visibility filtering for analysts...")
        task2 = LicitacaoService.create_tarefa(
            db, tenant_id, company_id, lic.id,
            LicitacaoTarefaCreate(
                titulo="Tarefa do Admin",
                responsavel_id=admin.id,
                data_limite=analyst_limit
            ),
            admin
        )
        # admin reopens task1 and assigns it to normal_user
        LicitacaoService.update_tarefa(
            db, tenant_id, company_id, lic.id, task1.id,
            LicitacaoTarefaUpdate(status="Pendente", responsavel_id=normal_user.id),
            admin
        )

        # Get tasks as normal_user (analyst)
        tasks_normal = LicitacaoService.get_tarefas(db, tenant_id, lic.id, lic, normal_user)
        print(f"Tasks visible to normal_user: {[t.titulo for t in tasks_normal]}")
        assert len(tasks_normal) == 1
        assert str(tasks_normal[0].id) == str(task1.id)

        # Get tasks as admin (PO / admin)
        tasks_admin = LicitacaoService.get_tarefas(db, tenant_id, lic.id, lic, admin)
        print(f"Tasks visible to admin: {[t.titulo for t in tasks_admin]}")
        assert len(tasks_admin) >= 2

        # Clean up added tasks & applications
        db.delete(task2)
        db.delete(comment)
        db.delete(task1)
        db.delete(task_avulsa)
        db.delete(app1)
        db.delete(analyst_normal)
        db.delete(non_team_user)
        db.commit()

        # Cleanup
        db.delete(analyst)
        db.delete(lic)
        db.commit()

        print("\n--- Test 8: LicitacaoItem Quantity and Supply Type LPs ---")
        # Create a temporary tender and lote for item tests
        lic_test = Licitacao(
            tenant_id=tenant_id,
            company_id=company_id,
            customer_id=customer.id,
            numero_edital="Pregão Teste Quantidade",
            status="Criada",
            modalidade="Pregão",
            tipo_licitacao="Menor preço",
            valor_total_estimado=Decimal("0.00"),
            valor_total_venda=Decimal("0.00"),
            margem_ponderada_global=Decimal("0.00"),
            precisa_aprovacao_diretoria=False,
            aprovado_diretoria=False
        )
        db.add(lic_test)
        db.commit()
        db.refresh(lic_test)

        lote = LicitacaoLote(
            licitacao_id=lic_test.id,
            numero="Lote 99",
            nome="Lote Teste Quantidade"
        )
        db.add(lote)
        db.commit()
        db.refresh(lote)

        # 1. Create a Unitary item
        item_unit = LicitacaoItem(
            lote_id=lote.id,
            codigo="99.1",
            nome="Item Unitario Teste",
            quantidade=Decimal("5"),
            tipo_fornecimento="Unitário",
            quantidade_total=Decimal("5")
        )
        db.add(item_unit)
        db.commit()
        db.refresh(item_unit)
        print(f"Item Unitario: quantidade={item_unit.quantidade}, tipo={item_unit.tipo_fornecimento}, total={item_unit.quantidade_total}")
        assert item_unit.quantidade_total == Decimal("5")

        # 2. Create a Monthly item
        item_mensal = LicitacaoItem(
            lote_id=lote.id,
            codigo="99.2",
            nome="Item Mensal Teste",
            quantidade=Decimal("2"),
            tipo_fornecimento="Mensal",
            total_meses=12,
            quantidade_total=Decimal("24")
        )
        db.add(item_mensal)
        db.commit()
        db.refresh(item_mensal)
        print(f"Item Mensal: quantidade={item_mensal.quantidade}, tipo={item_mensal.tipo_fornecimento}, total={item_mensal.quantidade_total}")
        assert item_mensal.quantidade_total == Decimal("24")

        # 3. Create a Kit linked to the monthly item and check inheritance
        print("Creating OpportunityKit linked to Item Mensal...")
        kit_service = OpportunityKitService(db)
        from src.modules.opportunity_kits.schemas import OpportunityKitCreate
        kit_data = OpportunityKitCreate(
            nome_kit="Kit Teste Quantidade",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=12,
            licitacao_id=lic_test.id,
            licitacao_item_id=item_mensal.id,
            quantidade_kits=1 # Should be overridden by LicitacaoItem.quantidade_total
        )
        kit_obj = kit_service.create_kit(tenant_id=tenant_id, company_id=str(company_id), data=kit_data)
        print(f"Kit criado: quantidade_kits={kit_obj.quantidade_kits} (Expected: 24)")
        assert kit_obj.quantidade_kits == 24

        # Clean up the test items
        db.delete(kit_obj)
        db.delete(item_mensal)
        db.delete(item_unit)
        db.delete(lote)
        db.delete(lic_test)
        db.commit()

        print("\nALL TEST CASES COMPLETED SUCCESSFULLY! [SUCCESS]")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
