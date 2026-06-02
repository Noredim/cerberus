import sys
sys.path.append('c:/cerberus/apps/api')

import uuid
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.core.base import Base
from src.modules.users.models import User, UserRole, UserRoleEnum
from src.modules.professionals.models import Professional
from src.modules.roles.models import Role
from src.modules.companies.models import Company
from src.modules.customers.models import Customer
from src.modules.products.models import Product
from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem, SalesBudgetHistory, SalesBudgetApproval
from src.modules.sales_budgets.schemas import SalesBudgetUpdate, SalesBudgetItemCreate
from src.modules.sales_budgets.service import (
    create_budget,
    update_budget,
    update_header,
    enviar_para_aprovacao,
    aprovar_oportunidade,
    retornar_ao_vendedor,
    cancelar_oportunidade,
    ganhar_oportunidade,
    perder_oportunidade,
    check_is_approver
)

def run_tests():
    print("Initializing test database connection...")
    engine = create_engine("postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # 1. Fetch seed user or create dummy
        admin_user = db.query(User).filter(User.email == "wars@warslab.com.br").first()
        if not admin_user:
            print("Creating dummy admin user...")
            admin_user = User(
                id=str(uuid.uuid4()),
                tenant_id="master_tenant",
                name="Test Admin",
                email="wars@warslab.com.br",
                password_hash="pw",
                is_active=True
            )
            db.add(admin_user)
            db.flush()
            admin_role = UserRole(
                id=str(uuid.uuid4()),
                user_id=admin_user.id,
                role=UserRoleEnum.ADMIN
            )
            db.add(admin_role)
            db.flush()

        tenant_id = admin_user.tenant_id

        # 2. Get/create Company
        company = db.query(Company).filter(Company.tenant_id == tenant_id).first()
        if not company:
            print("Creating test Company...")
            company = Company(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                razao_social="Test Company",
                cnpj="12345678000199",
                state_id="SP"
            )
            db.add(company)
            db.flush()

        # 3. Get/create Customer
        customer = db.query(Customer).filter(Customer.tenant_id == tenant_id).first()
        if not customer:
            print("Creating test Customer...")
            customer = Customer(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                razao_social="Test Customer",
                cnpj="98765432000188",
                state_id="SP"
            )
            db.add(customer)
            db.flush()

        # 4. Create salesman user & Professional role with unique email per run to avoid database pollution
        run_id = str(uuid.uuid4())[:8]
        vendedor_email = f"vendedor_{run_id}@test.com"
        peon_email = f"peon_{run_id}@test.com"

        salesman_user = User(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name="Test Vendedor",
            email=vendedor_email,
            password_hash="pw",
            is_active=True
        )
        db.add(salesman_user)
        db.flush()

        # Create Role "GERENTE" in this company
        gerente_role = db.query(Role).filter(Role.company_id == company.id, Role.name == "GERENTE").first()
        if not gerente_role:
            gerente_role = Role(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                company_id=company.id,
                name="GERENTE"
            )
            db.add(gerente_role)
            db.flush()

        # Create professional associated with salesman mapped to GERENTE
        manager_professional = Professional(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            company_id=company.id,
            name="Test Professional Manager",
            cpf="11122233344",
            role_id=gerente_role.id,
            user_id=salesman_user.id
        )
        db.add(manager_professional)
        db.flush()

        # 5. Create basic salesman user with no approval permissions
        peon_user = User(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name="Test Peon",
            email=peon_email,
            password_hash="pw",
            is_active=True
        )
        db.add(peon_user)
        db.flush()

        other_peon_user = User(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name="Other Peon",
            email=f"other_peon_{run_id}@test.com",
            password_hash="pw",
            is_active=True
        )
        db.add(other_peon_user)
        db.flush()

        # Commit setup
        db.commit()

        # ── Test 1: Check Approver Role Resolution ──
        print("\n--- Test 1: Approver Verification ---")
        print(f"DEBUG: company.id = {company.id} ({type(company.id)})")
        print(f"DEBUG: salesman_user.id = {salesman_user.id} ({type(salesman_user.id)})")
        prof = db.query(Professional).filter(Professional.user_id == salesman_user.id).first()
        print(f"DEBUG: prof = {prof}")
        if prof:
            print(f"DEBUG: prof.company_id = {prof.company_id} ({type(prof.company_id)})")
            print(f"DEBUG: prof.tenant_id = {prof.tenant_id} ({type(prof.tenant_id)})")
            print(f"DEBUG: prof.role_id = {prof.role_id}")
            print(f"DEBUG: prof.role = {prof.role}")
            if prof.role:
                print(f"DEBUG: prof.role.name = {prof.role.name}")

        is_admin_app, role_admin = check_is_approver(db, admin_user.id, tenant_id, company.id)
        is_mgr_app, role_mgr = check_is_approver(db, salesman_user.id, tenant_id, company.id)
        is_peon_app, role_peon = check_is_approver(db, peon_user.id, tenant_id, company.id)

        print(f"Admin: is_approver={is_admin_app}, role={role_admin} (Expected: True, ADMIN)")
        print(f"Manager: is_approver={is_mgr_app}, role={role_mgr} (Expected: True, GERENTE)")
        print(f"Peon: is_approver={is_peon_app}, role={role_peon} (Expected: False, VENDEDOR)")
        assert is_admin_app and role_admin in ("ADMIN", "DIRETORIA")
        assert is_mgr_app and role_mgr == "GERENTE"
        assert not is_peon_app

        # ── Test 2: Create Budget starts in EM_LANCAMENTO ──
        print("\n--- Test 2: Budget Creation ---")
        from src.modules.sales_budgets.schemas import SalesBudgetCreate
        create_payload = SalesBudgetCreate(
            customer_id=str(customer.id),
            vendedor_id=str(manager_professional.id),
            titulo="Oportunidade Teste Workflow",
            observacoes="Obs de teste",
            data_orcamento="2026-05-31T12:00:00",
            responsavel_ids=[peon_user.id],
            items=[
                SalesBudgetItemCreate(
                    tipo_item="MERCADORIA",
                    descricao_servico=None,
                    usa_parametros_padrao=True,
                    custo_unit_base=Decimal("100.00"),
                    markup=Decimal("1.5"),
                    quantidade=Decimal("5"),
                )
            ]
        )
        budget = create_budget(db, tenant_id, str(company.id), create_payload)
        print(f"Created budget. Status: {budget.status} (Expected: EM_LANCAMENTO)")
        print(f"Created budget. Valor Total: {budget.valor_total} (Expected: 750.00)")
        assert budget.status == "EM_LANCAMENTO"
        assert float(budget.valor_total) == 750.0

        # ── Test 3: Standard workflow transition blocks ──
        print("\n--- Test 3: Transitions & Permission Blocks ---")
        # Try to approve without status ENVIADO_APROVACAO
        try:
            aprovar_oportunidade(db, tenant_id, str(budget.id), admin_user.id, "Auto approval attempt")
            assert False, "Should have failed to approve a budget that is in EM_LANCAMENTO"
        except ValueError as e:
            print(f"Successfully blocked approval from EM_LANCAMENTO: {e}")

        # Try to submit to approval
        budget = enviar_para_aprovacao(db, tenant_id, str(budget.id), peon_user.id, "Por favor aprovar orçamento.")
        print(f"Submitted. Status: {budget.status} (Expected: ENVIADO_APROVACAO)")
        assert budget.status == "ENVIADO_APROVACAO"
        
        # Verify history log was created
        assert len(budget.history) == 1
        assert budget.history[0].status_anterior == "EM_LANCAMENTO"
        assert budget.history[0].status_novo == "ENVIADO_APROVACAO"
        assert budget.history[0].usuario_id == peon_user.id
        print("History entry verified successfully!")

        # Try to edit in ENVIADO_APROVACAO status
        try:
            update_payload = SalesBudgetUpdate(**create_payload.model_dump())
            update_budget(db, tenant_id, str(budget.id), update_payload, peon_user.id)
            assert False, "Should have blocked editing in ENVIADO_APROVACAO status"
        except ValueError as e:
            print(f"Successfully blocked edit in ENVIADO_APROVACAO status: {e}")

        # ── Test 4: Approval & Returning ──
        print("\n--- Test 4: Returning to Seller & Approving ---")
        # Try to approve with Peon user (non-approver)
        try:
            aprovar_oportunidade(db, tenant_id, str(budget.id), peon_user.id, "Approval attempt by peon")
            assert False, "Should have blocked approval by non-approver"
        except PermissionError as e:
            print(f"Successfully blocked approval by non-approver: {e}")

        # Retornar ao vendedor
        budget = retornar_ao_vendedor(db, tenant_id, str(budget.id), salesman_user.id, "Falta ajustar margens.")
        print(f"Returned. Status: {budget.status} (Expected: RETORNADO_VENDEDOR)")
        assert budget.status == "RETORNADO_VENDEDOR"
        assert len(budget.history) == 2
        assert budget.history[0].status_novo == "RETORNADO_VENDEDOR"

        # Submit again
        budget = enviar_para_aprovacao(db, tenant_id, str(budget.id), peon_user.id, "Margens ajustadas!")
        assert budget.status == "ENVIADO_APROVACAO"

        # Approve opportunity
        budget = aprovar_oportunidade(db, tenant_id, str(budget.id), salesman_user.id, "Aprovado com ressalvas.")
        print(f"Approved. Status: {budget.status} (Expected: APROVADO)")
        assert budget.status == "APROVADO"
        assert len(budget.approvals) == 1
        assert budget.approvals[0].usuario_aprovador_id == salesman_user.id
        assert budget.approvals[0].cargo_aprovador == "GERENTE"
        print("Approval details recorded successfully!")

        # Verify notification generated for the responsible user upon approval
        from src.modules.notifications.models import Notification
        approval_notifs = db.query(Notification).filter(
            Notification.opportunity_id == str(budget.id),
            Notification.title == "Proposta aprovada"
        ).all()
        print(f"DEBUG: Found {len(approval_notifs)} approval notifications.")
        assert len(approval_notifs) > 0
        recipient_ids = [n.user_id for n in approval_notifs]
        assert peon_user.id in recipient_ids
        # Seller (salesman_user) was the approver, so they should be excluded
        assert salesman_user.id not in recipient_ids
        print("Approval notification verification passed!")

        # ── Test 5: Reopening and Auto-Versioning on Edit ──
        print("\n--- Test 5: Auto-Versioning on Edit ---")
        # Let's perform an edit
        update_payload = SalesBudgetUpdate(
            customer_id=str(customer.id),
            vendedor_id=str(manager_professional.id),
            titulo="Oportunidade Teste Workflow (Edição Aprovada)",
            observacoes="Obs de teste alterada",
            data_orcamento="2026-05-31T12:00:00",
            responsavel_ids=[peon_user.id],
            items=[
                SalesBudgetItemCreate(
                    tipo_item="MERCADORIA",
                    descricao_servico=None,
                    usa_parametros_padrao=True,
                    custo_unit_base=Decimal("100.00"),
                    markup=Decimal("2.0"), # Changed markup
                    quantidade=Decimal("5"),
                )
            ]
        )
        budget = update_budget(db, tenant_id, str(budget.id), update_payload, peon_user.id)
        print(f"After update. Status: {budget.status} (Expected: EM_LANCAMENTO)")
        print(f"After update. Version: {budget.versao} (Expected: 2)")
        print(f"After update. Valor Total: {budget.valor_total} (Expected: 1000.00)")
        assert budget.status == "EM_LANCAMENTO"
        assert budget.versao == 2
        assert float(budget.valor_total) == 1000.0
        
        # Verify approval was invalidated (deleted)
        assert len(budget.approvals) == 0
        
        # Verify history recorded reopening
        assert len(budget.history) == 5 # Enviar, Retornar, Enviar, Aprovar, Reabrir
        assert budget.history[0].status_anterior == "APROVADO"
        assert budget.history[0].status_novo == "EM_LANCAMENTO"
        assert "Reabertura" in budget.history[0].descricao
        print("Auto-versioning, approval invalidation, and history entries verified!")

        # ── Test 6: Win/Lose Transitions ──
        print("\n--- Test 6: Win/Lose Transitions ---")
        # Try to win in EM_LANCAMENTO state
        try:
            ganhar_oportunidade(db, tenant_id, str(budget.id), peon_user.id, "Ganhamos o contrato!")
            assert False, "Should have blocked winning a non-approved opportunity"
        except ValueError as e:
            print(f"Successfully blocked winning in EM_LANCAMENTO state: {e}")

        # Send for approval and approve again
        budget = enviar_para_aprovacao(db, tenant_id, str(budget.id), peon_user.id, "Por favor aprovar versao 2.")
        budget = aprovar_oportunidade(db, tenant_id, str(budget.id), admin_user.id, "Aprovado versao 2.")
        assert budget.status == "APROVADO"
        
        # Win opportunity
        budget = ganhar_oportunidade(db, tenant_id, str(budget.id), peon_user.id, "Contrato fechado com sucesso!")
        print(f"Won. Status: {budget.status} (Expected: GANHO)")
        assert budget.status == "GANHO"

        # Create a new budget to test the lost opportunity flow
        lost_budget_payload = SalesBudgetCreate(
            customer_id=str(customer.id),
            vendedor_id=str(manager_professional.id),
            titulo="Oportunidade Teste Workflow (Perda)",
            observacoes="Obs de teste",
            data_orcamento="2026-05-31T12:00:00",
            responsavel_ids=[peon_user.id],
            items=[
                SalesBudgetItemCreate(
                    tipo_item="MERCADORIA",
                    descricao_servico=None,
                    usa_parametros_padrao=True,
                    custo_unit_base=Decimal("100.00"),
                    markup=Decimal("1.5"),
                    quantidade=Decimal("5"),
                )
            ]
        )
        lost_budget = create_budget(db, tenant_id, str(company.id), lost_budget_payload)
        
        # We should be able to lose it from EM_LANCAMENTO state directly as per "durante todo o fluxo"
        lost_budget = perder_oportunidade(db, tenant_id, str(lost_budget.id), peon_user.id, "Perdemos no preço.")
        print(f"Lost. Status: {lost_budget.status} (Expected: PERDIDO)")
        assert lost_budget.status == "PERDIDO"
        
        # Try to edit the lost budget, should fail
        try:
            update_payload = SalesBudgetUpdate(**lost_budget_payload.model_dump())
            update_budget(db, tenant_id, str(lost_budget.id), update_payload, peon_user.id)
            assert False, "Should have failed to edit a lost budget"
        except ValueError as e:
            print(f"Successfully blocked editing a lost opportunity: {e}")


        # ── Test 7: User-Based Access Control ──
        print("\n--- Test 7: User-Based Access Control ---")
        from src.modules.sales_budgets.service import get_budget, list_budgets, delete_budget
        
        # 1. Other peon (no access) trying to get budget
        budget_other = get_budget(db, tenant_id, str(budget.id), user_id=other_peon_user.id)
        print(f"Get budget for other peon: {budget_other} (Expected: None)")
        assert budget_other is None
        
        # 2. Peon (responsible) trying to get budget
        budget_peon = get_budget(db, tenant_id, str(budget.id), user_id=peon_user.id)
        print(f"Get budget for responsible peon: {budget_peon.titulo if budget_peon else None} (Expected: Oportunidade Teste Workflow (Edição Aprovada))")
        assert budget_peon is not None
        
        # 3. List budgets for other peon
        other_items, other_total = list_budgets(db, tenant_id, company.id, user_id=other_peon_user.id)
        print(f"List budgets for other peon: count={len(other_items)}, total={other_total} (Expected: 0)")
        assert other_total == 0
        
        # 4. List budgets for responsible peon
        peon_items, peon_total = list_budgets(db, tenant_id, company.id, user_id=peon_user.id)
        print(f"List budgets for responsible peon: count={len(peon_items)}, total={peon_total} (Expected: 1)")
        assert peon_total >= 1
        
        # 5. Admin user (approver) trying to get budget
        budget_admin = get_budget(db, tenant_id, str(budget.id), user_id=admin_user.id)
        print(f"Get budget for admin (non-responsible but approver): {budget_admin.titulo if budget_admin else None} (Expected: Oportunidade Teste Workflow (Edição Aprovada))")
        assert budget_admin is not None

        # 6. Try to delete budget with other peon
        try:
            delete_budget(db, tenant_id, str(budget.id), user_id=other_peon_user.id)
            assert False, "Should have blocked deletion by non-responsible peon"
        except PermissionError as e:
            print(f"Successfully blocked deletion by non-responsible user: {e}")

        # ── Test 8: Bypass Consolidação Diretoria update for Approver ──
        print("\n--- Test 8: Bypass Consolidação Diretoria ---")
        
        # 1. Budget is currently GANHO (locked). Try to update only comissao_diretoria using admin (approver)
        print("Testing comissao_diretoria update on locked status by admin...")
        locked_payload = SalesBudgetUpdate(
            customer_id=str(customer.id),
            vendedor_id=str(manager_professional.id),
            titulo=budget.titulo,
            observacoes=budget.observacoes,
            data_orcamento=budget.data_orcamento,
            responsavel_ids=[peon_user.id],
            items=[
                SalesBudgetItemCreate(
                    tipo_item="MERCADORIA",
                    descricao_servico=None,
                    usa_parametros_padrao=True,
                    custo_unit_base=Decimal("100.00"),
                    markup=Decimal("2.0"),
                    quantidade=Decimal("5"),
                )
            ],
            perc_comissao_diretoria=Decimal("12.50") # New commission value
        )
        
        # This should succeed since it's only comissao_diretoria and user is admin
        old_status = budget.status
        old_version = budget.versao
        updated_budget = update_budget(db, tenant_id, str(budget.id), locked_payload, admin_user.id)
        
        print(f"Bypass successful! Status: {updated_budget.status} (Expected: {old_status})")
        print(f"Bypass successful! Version: {updated_budget.versao} (Expected: {old_version})")
        print(f"Bypass successful! comissao_diretoria: {updated_budget.perc_comissao_diretoria} (Expected: 12.50)")
        
        assert updated_budget.status == old_status
        assert updated_budget.versao == old_version
        assert float(updated_budget.perc_comissao_diretoria) == 12.5
        
        # Verify history entry
        last_hist = sorted(updated_budget.history, key=lambda h: h.data_movimentacao, reverse=True)[0]
        print(f"History entry: {last_hist.descricao}")
        assert "Comissão da diretoria alterada" in last_hist.descricao
        
        # 2. Try to update comissao_diretoria + another field (e.g. titulo) on locked status by admin
        print("Testing comissao_diretoria + other field update on locked status by admin...")
        locked_invalid_payload = SalesBudgetUpdate(**locked_payload.model_dump())
        locked_invalid_payload.titulo = "Titulo alterado"
        try:
            update_budget(db, tenant_id, str(budget.id), locked_invalid_payload, admin_user.id)
            assert False, "Should have failed to edit locked opportunity other fields"
        except ValueError as e:
            print(f"Successfully blocked locked edit of other fields: {e}")
            
        # 3. Try to update comissao_diretoria on locked status by non-approver (peon)
        print("Testing comissao_diretoria update on locked status by peon...")
        try:
            update_budget(db, tenant_id, str(budget.id), locked_payload, peon_user.id)
            assert False, "Should have blocked locked comissao_diretoria update by peon"
        except ValueError as e:
            print(f"Successfully blocked locked comissao_diretoria update by peon: {e}")

        # ── Test 9: Intercompany Sales Budget (Same CNPJ) ──
        print("\n--- Test 9: Intercompany Sales Budget (Same CNPJ) ---")
        from src.modules.purchase_budgets.models import PurchaseBudget, PurchaseBudgetItem
        from src.modules.suppliers.models import Supplier
        from src.modules.products.schemas import ProductType, ProductFinalidade
        from src.modules.companies.models import State
        from sqlalchemy.sql import func

        # Resolve State SP ID
        sp_state = db.query(State).filter(State.sigla == "SP").first()
        sp_state_id = str(sp_state.id) if sp_state else None

        # Dynamically format customer CNPJ to match company CNPJ but with punctuation
        import re
        raw_cnpj = re.sub(r"\D", "", company.cnpj)
        if len(raw_cnpj) == 14:
            formatted_cnpj = f"{raw_cnpj[0:2]}.{raw_cnpj[2:5]}.{raw_cnpj[5:8]}/{raw_cnpj[8:12]}-{raw_cnpj[12:14]}"
        else:
            formatted_cnpj = company.cnpj

        # Clean up any leftover database entries
        db.query(Customer).filter(Customer.cnpj == formatted_cnpj).delete()
        db.commit()

        # Create intercompany customer with the same CNPJ but formatted
        intercompany_customer = Customer(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            razao_social="Intercompany Branch Customer SP",
            cnpj=formatted_cnpj,
            state_id=sp_state_id
        )
        db.add(intercompany_customer)

        # Create a new product for this test
        prod_intercompany = Product(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company.id,
            nome="Product Intercompany Revenda",
            tipo=ProductType.EQUIPAMENTO,
            finalidade=ProductFinalidade.REVENDA,
            codigo="SKU-INTERCO-123"
        )
        db.add(prod_intercompany)

        # Get or create a dummy supplier
        supplier = db.query(Supplier).filter(Supplier.tenant_id == tenant_id).first()
        if not supplier:
            supplier = Supplier(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                cnpj="11111111000111",
                razao_social="Fornecedor Intercompany Test"
            )
            db.add(supplier)
        db.commit()

        # 1. Create a sales budget for the intercompany customer.
        create_payload = SalesBudgetCreate(
            customer_id=str(intercompany_customer.id),
            vendedor_id=str(manager_professional.id),
            titulo="Oportunidade Intercompany Test",
            observacoes="Intercompany same CNPJ flow",
            data_orcamento="2026-06-02T12:00:00",
            responsavel_ids=[peon_user.id],
            items=[
                SalesBudgetItemCreate(
                    tipo_item="MERCADORIA",
                    product_id=prod_intercompany.id,
                    descricao_servico=None,
                    usa_parametros_padrao=True,
                    custo_unit_base=Decimal("100.00"),
                    markup=Decimal("1.5"),
                    quantidade=Decimal("10"),
                )
            ]
        )
        sales_budget = create_budget(db, tenant_id, str(company.id), create_payload)
        db.commit()

        print(f"Created intercompany sales budget ID: {sales_budget.id}")
        
        # 2. Create a purchase budget (supplier budget) linked to this sales_budget_id.
        purchase_budget = PurchaseBudget(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company.id,
            sales_budget_id=sales_budget.id,
            supplier_id=supplier.id,
            tipo_orcamento="REVENDA",
            frete_tipo="CIF",
            frete_percent=Decimal("0.0"),
            data_orcamento=func.now()
        )
        db.add(purchase_budget)
        db.flush()

        purchase_item = PurchaseBudgetItem(
            id=uuid.uuid4(),
            budget_id=purchase_budget.id,
            product_id=prod_intercompany.id,
            quantidade=Decimal("10"),
            valor_unitario=Decimal("80.00"),  # Base purchase cost
            frete_percent=Decimal("0"),
            frete_valor=Decimal("50.00"),    # Total freight for 10 units = 5.00/unit
            ipi_percent=Decimal("10"),
            ipi_valor=Decimal("80.00"),      # Total IPI for 10 units = 8.00/unit
            icms_percent=Decimal("12"),
            difal_unitario=Decimal("4.00"),   # 4.00/unit
            st_unitario=Decimal("3.00"),      # 3.00/unit
            total_item=Decimal("980.00")
        )
        db.add(purchase_item)
        db.commit()

        # 3. Call update_budget on the sales budget. This should trigger recalculation,
        # find the purchase budget, extract cost composition, zero out sales taxes/commissions/expenses,
        # and override selling price to base_unitario + taxes + freight.
        update_payload = SalesBudgetUpdate(
            customer_id=str(intercompany_customer.id),
            vendedor_id=str(manager_professional.id),
            titulo="Oportunidade Intercompany Test (Recalculado)",
            observacoes="Intercompany same CNPJ flow recalculated",
            data_orcamento="2026-06-02T12:00:00",
            responsavel_ids=[peon_user.id],
            items=[
                SalesBudgetItemCreate(
                    tipo_item="MERCADORIA",
                    product_id=prod_intercompany.id,
                    descricao_servico=None,
                    usa_parametros_padrao=True,
                    custo_unit_base=Decimal("100.00"), # Will be overridden by base_unitario (80.00)
                    markup=Decimal("1.5"),             # Will be calculated as venda_unit / custo_unit_base
                    quantidade=Decimal("10"),
                )
            ]
        )
        updated_sales_budget = update_budget(db, tenant_id, str(sales_budget.id), update_payload, peon_user.id)
        db.commit()

        # 4. Verify assertions!
        assert len(updated_sales_budget.items) == 1
        item = updated_sales_budget.items[0]

        # Verify custo base is overridden to purchase base_unitario (80.00)
        print(f"Item custo_unit_base: {item.custo_unit_base} (Expected: 80.00)")
        assert float(item.custo_unit_base) == 80.00

        # Verify venda_unit is base (80) + IPI (8) + ST (0) + DIFAL (11.20) + Freight (5) = 104.20
        print(f"Item venda_unit: {item.venda_unit} (Expected: 104.20)")
        assert float(item.venda_unit) == 104.20

        # Verify total_venda is 104.20 * 10 = 1042.00
        print(f"Item total_venda: {item.total_venda} (Expected: 1042.00)")
        assert float(item.total_venda) == 1042.00

        # Verify all sales taxes and costs are exactly 0.00
        print(f"Item sales taxes/expenses/commissions:")
        print(f"  pis_unit: {item.pis_unit} (Expected: 0)")
        print(f"  cofins_unit: {item.cofins_unit} (Expected: 0)")
        print(f"  csll_unit: {item.csll_unit} (Expected: 0)")
        print(f"  irpj_unit: {item.irpj_unit} (Expected: 0)")
        print(f"  icms_unit: {item.icms_unit} (Expected: 0)")
        print(f"  iss_unit: {item.iss_unit} (Expected: 0)")
        print(f"  frete_venda_unit: {item.frete_venda_unit} (Expected: 0)")
        print(f"  comissao_unit: {item.comissao_unit} (Expected: 0)")
        print(f"  despesa_adm_unit: {item.despesa_adm_unit} (Expected: 0)")

        assert float(item.pis_unit) == 0.0
        assert float(item.cofins_unit) == 0.0
        assert float(item.csll_unit) == 0.0
        assert float(item.irpj_unit) == 0.0
        assert float(item.icms_unit) == 0.0
        assert float(item.iss_unit) == 0.0
        assert float(item.frete_venda_unit) == 0.0
        assert float(item.comissao_unit) == 0.0
        assert float(item.despesa_adm_unit) == 0.0

        # Verify profit margin (selling price (104.20) - cost base (80) = 24.20)
        # Margem = lucro / venda * 100 = 24.20 / 104.20 * 100 = 23.2246%
        print(f"Item lucro_unit: {item.lucro_unit} (Expected: 24.20)")
        print(f"Item margem_unit: {item.margem_unit}% (Expected: 23.2246%)")
        assert float(item.lucro_unit) == 24.20
        assert abs(float(item.margem_unit) - 23.2246) < 0.001

        # Verify intercompany PDF report calculations
        import jinja2
        captured_kpis = {}
        orig_render = jinja2.Template.render
        def temp_render(self, *args, **kwargs):
            nonlocal captured_kpis
            captured_kpis = kwargs.get("kpis", {})
            return "<html></html>"
        jinja2.Template.render = temp_render
        try:
            from src.modules.sales_budgets.reports import OpportunitiesReportService
            OpportunitiesReportService.generate_venda_approval_pdf(db, updated_sales_budget.id, admin_user)
        finally:
            jinja2.Template.render = orig_render

        print("Captured intercompany report KPIs:", captured_kpis)
        assert captured_kpis.get("impostos_venda") == "0,00"
        assert captured_kpis.get("despesas_totais") == "0,00"
        assert captured_kpis.get("lucro_total") == "0,00"
        assert captured_kpis.get("margem_percentual") == "0.00"
        assert captured_kpis.get("venda_consolidada") == captured_kpis.get("custo_total_com_impostos")
        print("Intercompany PDF report variables verified successfully!")

        print("Intercompany sales budget verification passed successfully!")

        # --- Test 10: Product Creation & Duplication Validation ---
        print("\n--- Test 10: Product Creation & Duplication Validation ---")
        from src.modules.products.service import ProductService
        from src.modules.products.schemas import ProductCreate, ProductType, ProductFinalidade
        from fastapi import HTTPException

        # Clean up any leftover products from previous runs
        db.query(Product).filter(Product.tenant_id == tenant_id, Product.codigo == "SKU-UNICO-123").delete()
        db.query(Product).filter(Product.tenant_id == tenant_id, Product.nome == "PRODUTO TESTE UNICO").delete()
        db.commit()

        prod_service = ProductService(db)
        prod_payload1 = ProductCreate(
            company_id=uuid.UUID(str(company.id)),
            nome="Produto Teste Unico",
            tipo=ProductType.EQUIPAMENTO,
            finalidade=ProductFinalidade.REVENDA,
            codigo="SKU-UNICO-123"
        )
        # 1. Create product
        p1 = prod_service.create_product(tenant_id, prod_payload1)
        assert p1.nome == "PRODUTO TESTE UNICO"
        assert p1.codigo == "SKU-UNICO-123"
        print("Product created successfully!")

        # 2. Try to create with duplicate name
        prod_payload2 = ProductCreate(
            company_id=uuid.UUID(str(company.id)),
            nome="produto teste unico",
            tipo=ProductType.EQUIPAMENTO,
            finalidade=ProductFinalidade.REVENDA,
            codigo="SKU-UNICO-999"
        )
        try:
            prod_service.create_product(tenant_id, prod_payload2)
            assert False, "Should have failed to create product with duplicate name"
        except HTTPException as e:
            print(f"Successfully blocked duplicate name: {e.detail}")
            assert e.status_code == 400
            assert "Já existe um produto cadastrado com o nome" in e.detail

        # 3. Try to create with duplicate SKU
        prod_payload3 = ProductCreate(
            company_id=uuid.UUID(str(company.id)),
            nome="Produto Outro Nome 123",
            tipo=ProductType.EQUIPAMENTO,
            finalidade=ProductFinalidade.REVENDA,
            codigo="SKU-UNICO-123"
        )
        try:
            prod_service.create_product(tenant_id, prod_payload3)
            assert False, "Should have failed to create product with duplicate SKU"
        except HTTPException as e:
            print(f"Successfully blocked duplicate SKU: {e.detail}")
            assert e.status_code == 400
            assert "Já existe um produto cadastrado com o código/SKU" in e.detail

        print("\nALL WORKFLOW WORK PATTERNS COMPLETED SUCCESSFULLY!")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
