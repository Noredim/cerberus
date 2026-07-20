import sys
sys.path.append('.')

import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.modules.users.models import User, UserCompany
from src.modules.companies.models import Company, SalesTeam, SalesTeamMember
from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitSalesTeam
from src.modules.opportunity_kits.schemas import OpportunityKitCreate, OpportunityKitUpdate
from src.modules.opportunity_kits.service import OpportunityKitService
from src.modules.roles.models import Role
from src.modules.licitacoes.models import Licitacao, LicitacaoItem
from src.modules.products.models import Product
from src.modules.own_services.models import OwnService
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.sales_budgets.models import SalesBudget
from src.modules.sales_proposals.models import SalesProposal
from src.modules.customers.models import Customer





def run_tests():
    print("Initializing test database connection...")
    import os
    db_url = os.getenv("DATABASE_URL", "postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Get admin user and tenant_id
        admin_user = db.query(User).filter(User.email == "wars@warslab.com.br").first()
        if not admin_user:
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
        
        tenant_id = admin_user.tenant_id

        # Fetch or create a test company
        company = db.query(Company).filter(Company.tenant_id == tenant_id).first()
        if not company:
            from src.modules.catalog.models import City, State
            any_city = db.query(City).first()
            m_id = any_city.id if any_city else "1302603"
            any_state = db.query(State).first()
            s_id = any_state.id if any_state else "13"
            
            company = Company(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                cnpj="12345678000199",
                razao_social="Empresa Teste Kits",
                nome_fantasia="Teste Kits",
                ativo=True,
                municipality_id=m_id,
                state_id=s_id
            )
            db.add(company)
            db.flush()
            
        company_id = str(company.id)

        # Ensure seller role exists in database
        seller_role = db.query(Role).filter(Role.name == "VENDEDOR").first()
        if not seller_role:
            seller_role = Role(id=str(uuid.uuid4()), name="VENDEDOR")
            db.add(seller_role)
            db.flush()

        # Create Seller A (only Team 1)
        seller_a = db.query(User).filter(User.email == "seller_a@test.com").first()
        if not seller_a:
            seller_a = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Seller A",
                email="seller_a@test.com",
                password_hash="pw",
                is_active=True
            )
            db.add(seller_a)
            db.flush()
            uc = UserCompany(user_id=seller_a.id, company_id=company.id)
            db.add(uc)
            db.flush()
            # Assign Vendedor role
            from src.modules.professionals.models import Professional
            prof = Professional(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                company_id=company.id,
                user_id=seller_a.id,
                role_id=seller_role.id,
                name="Seller A",
                cpf="12345678901"
            )
            db.add(prof)
            db.flush()

        # Create Seller B (only Team 2)
        seller_b = db.query(User).filter(User.email == "seller_b@test.com").first()
        if not seller_b:
            seller_b = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Seller B",
                email="seller_b@test.com",
                password_hash="pw",
                is_active=True
            )
            db.add(seller_b)
            db.flush()
            uc = UserCompany(user_id=seller_b.id, company_id=company.id)
            db.add(uc)
            db.flush()
            from src.modules.professionals.models import Professional
            prof = Professional(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                company_id=company.id,
                user_id=seller_b.id,
                role_id=seller_role.id,
                name="Seller B",
                cpf="12345678902"
            )
            db.add(prof)
            db.flush()

        # Create Seller C (Team 1 and Team 2)
        seller_c = db.query(User).filter(User.email == "seller_c@test.com").first()
        if not seller_c:
            seller_c = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Seller C",
                email="seller_c@test.com",
                password_hash="pw",
                is_active=True
            )
            db.add(seller_c)
            db.flush()
            uc = UserCompany(user_id=seller_c.id, company_id=company.id)
            db.add(uc)
            db.flush()
            from src.modules.professionals.models import Professional
            prof = Professional(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                company_id=company.id,
                user_id=seller_c.id,
                role_id=seller_role.id,
                name="Seller C",
                cpf="12345678903"
            )
            db.add(prof)
            db.flush()

        # Create Sales Team 1
        team1 = db.query(SalesTeam).filter(SalesTeam.company_id == company.id, SalesTeam.nome == "Equipe Teste 1").first()
        if not team1:
            team1 = SalesTeam(id=uuid.uuid4(), tenant_id=tenant_id, company_id=company.id, nome="Equipe Teste 1", ativo=True)
            db.add(team1)
            db.flush()
        
        # Create Sales Team 2
        team2 = db.query(SalesTeam).filter(SalesTeam.company_id == company.id, SalesTeam.nome == "Equipe Teste 2").first()
        if not team2:
            team2 = SalesTeam(id=uuid.uuid4(), tenant_id=tenant_id, company_id=company.id, nome="Equipe Teste 2", ativo=True)
            db.add(team2)
            db.flush()

        # Link members
        db.query(SalesTeamMember).filter(SalesTeamMember.sales_team_id.in_([team1.id, team2.id])).delete()
        db.flush()

        db.add(SalesTeamMember(id=uuid.uuid4(), sales_team_id=team1.id, user_id=seller_a.id, cargo="VENDEDOR"))
        db.add(SalesTeamMember(id=uuid.uuid4(), sales_team_id=team2.id, user_id=seller_b.id, cargo="VENDEDOR"))
        db.add(SalesTeamMember(id=uuid.uuid4(), sales_team_id=team1.id, user_id=seller_c.id, cargo="VENDEDOR"))
        db.add(SalesTeamMember(id=uuid.uuid4(), sales_team_id=team2.id, user_id=seller_c.id, cargo="VENDEDOR"))
        db.flush()

        # Create a test customer
        customer = db.query(Customer).filter(Customer.company_id == company.id).first()
        if not customer:
            customer = Customer(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                company_id=company.id,
                nome="Cliente Teste Kits",
                cnpj_cpf="12345678901",
                tipo="FISICA",
                is_active=True
            )
            db.add(customer)
            db.flush()
        
        # Create a test SalesBudget
        from src.modules.professionals.models import Professional
        prof_obj = db.query(Professional).filter(Professional.company_id == company.id).first()
        prof_id = prof_obj.id if prof_obj else str(uuid.uuid4())
        
        sales_budget = db.query(SalesBudget).filter(SalesBudget.company_id == company.id).first()
        if not sales_budget:
            sales_budget = SalesBudget(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                company_id=company.id,
                customer_id=customer.id,
                titulo="Orcamento Teste Kits",
                status="EM_LANCAMENTO",
                vendedor_id=prof_id,
                valor_total=0.0
            )
            db.add(sales_budget)
            db.flush()
        
        real_budget_id = sales_budget.id

        # Clean existing test kits
        db.query(OpportunityKit).filter(
            OpportunityKit.company_id == company.id,
            OpportunityKit.nome_kit.like("KIT TESTE %")
        ).delete()
        db.commit()

        service = OpportunityKitService(db)

        # --- TEST 1: Seller A creating a kit ---
        print("\n--- Test 1: Seller A creating a kit ---")
        
        # Scenario 1.1: Seller A selects Team 1 (their only team) -> Should succeed
        kit1_data = OpportunityKitCreate(
            nome_kit="KIT TESTE EQUIPE 1",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=24,
            sales_teams=[team1.id]
        )
        kit1 = service.create_kit(tenant_id, company_id, kit1_data, current_user=seller_a)
        print(f"Created Kit 1 successfully. Linked Teams count: {len(kit1.sales_teams)}")
        assert len(kit1.sales_teams) == 1
        assert kit1.sales_teams[0].sales_team_id == team1.id

        # Scenario 1.2: Seller A tries to select Team 2 (they don't belong to it) -> Should fail
        kit2_data = OpportunityKitCreate(
            nome_kit="KIT TESTE EQUIPE 2",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=24,
            sales_teams=[team2.id]
        )
        try:
            service.create_kit(tenant_id, company_id, kit2_data, current_user=seller_a)
            print("ERROR: Seller A should not be able to select Team 2!")
            sys.exit(1)
        except ValueError as e:
            print(f"Successfully blocked Seller A selecting Team 2: {e}")

        # Scenario 1.3: Seller A passes empty sales_teams list -> Auto-selects Team 1 (their only team)
        kit3_data = OpportunityKitCreate(
            nome_kit="KIT TESTE EQUIPE 1 AUTO",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=24,
            sales_teams=[]
        )
        kit3 = service.create_kit(tenant_id, company_id, kit3_data, current_user=seller_a)
        print(f"Created Auto Kit successfully. Linked Teams count: {len(kit3.sales_teams)}")
        assert len(kit3.sales_teams) == 1
        assert kit3.sales_teams[0].sales_team_id == team1.id


        # --- TEST 2: Seller C creating a kit ---
        print("\n--- Test 2: Seller C (multiple teams) creating a kit ---")

        # Scenario 2.1: Seller C selects both Team 1 and Team 2 -> Should succeed
        kit4_data = OpportunityKitCreate(
            nome_kit="KIT TESTE MULTI",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=24,
            sales_teams=[team1.id, team2.id]
        )
        kit4 = service.create_kit(tenant_id, company_id, kit4_data, current_user=seller_c)
        print(f"Created Multi-team Kit successfully. Linked Teams count: {len(kit4.sales_teams)}")
        assert len(kit4.sales_teams) == 2

        # Scenario 2.2: Seller C selects Team 2 only -> Should succeed
        kit5_data = OpportunityKitCreate(
            nome_kit="KIT TESTE TEAM 2 ONLY",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=24,
            sales_teams=[team2.id]
        )
        kit5 = service.create_kit(tenant_id, company_id, kit5_data, current_user=seller_c)
        print(f"Created Team 2 Kit successfully. Linked Teams count: {len(kit5.sales_teams)}")
        assert len(kit5.sales_teams) == 1
        assert kit5.sales_teams[0].sales_team_id == team2.id


        # --- TEST 3: Public Kit (no team specified) ---
        print("\n--- Test 3: Creating a public catalog kit (no teams) ---")
        
        # Scenario 3.1: Admin creates a kit without specifying teams -> Should succeed
        kit_pub_data = OpportunityKitCreate(
            nome_kit="KIT TESTE PUBLIC",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=24,
            sales_teams=[]
        )
        kit_pub = service.create_kit(tenant_id, company_id, kit_pub_data, current_user=admin_user)
        print(f"Created Public Kit successfully. Linked Teams count: {len(kit_pub.sales_teams)}")
        assert len(kit_pub.sales_teams) == 0


        # --- TEST 4: Context of Opportunity Kit ---
        print("\n--- Test 4: Creating a kit inside a budget context ---")

        # Even if sales_teams are provided, they must be ignored/cleared inside a budget context
        budget_id = real_budget_id
        kit_priv_data = OpportunityKitCreate(
            nome_kit="KIT TESTE PRIVATE BUDGET",
            tipo_contrato="LOCACAO",
            prazo_contrato_meses=24,
            sales_budget_id=budget_id,
            sales_teams=[team1.id, team2.id]
        )
        kit_priv = service.create_kit(tenant_id, company_id, kit_priv_data, current_user=seller_c)
        print(f"Created Private Kit successfully. Linked Teams count: {len(kit_priv.sales_teams)}")
        assert len(kit_priv.sales_teams) == 0
        assert kit_priv.sales_budget_id == budget_id


        # --- TEST 5: Visibility in Listing ---
        print("\n--- Test 5: Visibility filtering in list_kits ---")

        # Seller A (belongs to Team 1) should see:
        # - kit1 (Team 1)
        # - kit3 (Team 1)
        # - kit4 (Team 1 and Team 2)
        # - kit_pub (Public)
        # NOT kit5 (Team 2 only)
        kits_seller_a = service.list_kits(tenant_id, company_id, current_user=seller_a)
        kit_names_a = [k.nome_kit for k in kits_seller_a]
        print(f"Seller A sees kits: {kit_names_a}")
        assert "KIT TESTE EQUIPE 1" in kit_names_a
        assert "KIT TESTE EQUIPE 1 AUTO" in kit_names_a
        assert "KIT TESTE MULTI" in kit_names_a
        assert "KIT TESTE PUBLIC" in kit_names_a
        assert "KIT TESTE TEAM 2 ONLY" not in kit_names_a
        assert "KIT TESTE PRIVATE BUDGET" not in kit_names_a # Catalog listing only

        # Seller B (belongs to Team 2) should see:
        # - kit4 (Team 1 and Team 2)
        # - kit5 (Team 2 only)
        # - kit_pub (Public)
        # NOT kit1, kit3 (Team 1)
        kits_seller_b = service.list_kits(tenant_id, company_id, current_user=seller_b)
        kit_names_b = [k.nome_kit for k in kits_seller_b]
        print(f"Seller B sees kits: {kit_names_b}")
        assert "KIT TESTE MULTI" in kit_names_b
        assert "KIT TESTE TEAM 2 ONLY" in kit_names_b
        assert "KIT TESTE PUBLIC" in kit_names_b
        assert "KIT TESTE EQUIPE 1" not in kit_names_b
        assert "KIT TESTE EQUIPE 1 AUTO" not in kit_names_b

        # Seller C (belongs to both Team 1 and Team 2) should see all
        kits_seller_c = service.list_kits(tenant_id, company_id, current_user=seller_c)
        kit_names_c = [k.nome_kit for k in kits_seller_c]
        print(f"Seller C sees kits: {kit_names_c}")
        assert "KIT TESTE EQUIPE 1" in kit_names_c
        assert "KIT TESTE EQUIPE 1 AUTO" in kit_names_c
        assert "KIT TESTE MULTI" in kit_names_c
        assert "KIT TESTE TEAM 2 ONLY" in kit_names_c
        assert "KIT TESTE PUBLIC" in kit_names_c

        # Listing inside budget context:
        # Should also include the private budget kit
        kits_budget = service.list_kits(tenant_id, company_id, sales_budget_id=str(budget_id), current_user=seller_c)
        kit_names_budget = [k.nome_kit for k in kits_budget]
        print(f"Budget context listing kits: {kit_names_budget}")
        assert "KIT TESTE PRIVATE BUDGET" in kit_names_budget


        # --- TEST 6: Update kit validations ---
        print("\n--- Test 6: Validations on update_kit ---")

        # Scenario 6.1: Seller A tries to update a kit to use Team 2 (they don't belong) -> Should fail
        try:
            service.update_kit(
                str(kit1.id), tenant_id,
                OpportunityKitUpdate(sales_teams=[team2.id]),
                company_id=company_id, current_user=seller_a
            )
            print("ERROR: Seller A should not be able to update to Team 2!")
            sys.exit(1)
        except ValueError as e:
            print(f"Successfully blocked Seller A updating to Team 2: {e}")

        # Scenario 6.2: Seller A updates to Team 1 -> Should succeed
        kit1_updated = service.update_kit(
            str(kit1.id), tenant_id,
            OpportunityKitUpdate(sales_teams=[team1.id]),
            company_id=company_id, current_user=seller_a
        )
        print(f"Updated kit 1 successfully. Linked Teams count: {len(kit1_updated.sales_teams)}")
        assert len(kit1_updated.sales_teams) == 1
        assert kit1_updated.sales_teams[0].sales_team_id == team1.id

        # Scenario 6.3: Admin updates to Team 2 -> Should succeed
        kit1_updated_admin = service.update_kit(
            str(kit1.id), tenant_id,
            OpportunityKitUpdate(sales_teams=[team2.id]),
            company_id=company_id, current_user=admin_user
        )
        print(f"Admin updated kit 1 to Team 2 successfully. Linked Teams count: {len(kit1_updated_admin.sales_teams)}")
        assert len(kit1_updated_admin.sales_teams) == 1
        assert kit1_updated_admin.sales_teams[0].sales_team_id == team2.id

        print("\nALL KIT SALES TEAMS INTEGRATION TESTS COMPLETED SUCCESSFULLY!")

    finally:
        # Clean up database test records
        db.query(OpportunityKit).filter(
            OpportunityKit.company_id == company.id,
            OpportunityKit.nome_kit.like("KIT TESTE %")
        ).delete()
        db.commit()
        db.close()

if __name__ == "__main__":
    run_tests()
