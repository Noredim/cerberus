import sys
sys.path.append('.')

import uuid
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.core.base import Base
from src.modules.tenants.models import Tenant
from src.modules.users.models import User, UserCompany
from src.modules.companies.models import Company, CommercialPolicy, SalesTeam, SalesTeamMember, SalesTeamPolicy
from src.modules.companies.schemas import SalesTeamCreateUpdate, SalesTeamMemberCreate, SalesTeamPolicyCreate
from src.modules.companies.router import create_sales_team, update_sales_team, delete_sales_team, list_sales_teams, list_eligible_users
from src.modules.own_services.models import OwnService
from src.modules.roles.models import Role
from src.modules.professionals.models import Professional

def run_tests():
    print("Initializing test database connection...")
    import os
    db_url = os.getenv("DATABASE_URL", "postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Get admin user and its tenant
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

        # Fetch or create a test company using existing company's state and city if available
        company = db.query(Company).filter(Company.tenant_id == tenant_id).first()
        if not company:
            # Let's find any company in the db to copy city and state
            any_company = db.query(Company).first()
            if any_company:
                m_id = any_company.municipality_id
                s_id = any_company.state_id
            else:
                # Let's check a city and state from db
                from src.modules.catalog.models import City, State
                any_city = db.query(City).first()
                m_id = any_city.id if any_city else "1302603" # Manaus
                any_state = db.query(State).first()
                s_id = any_state.id if any_state else "13" # AM
            
            company = Company(
                id=uuid.uuid4(),
                tenant_id=tenant_id,
                cnpj="12345678901234",
                razao_social="Test Sales Team Company",
                municipality_id=m_id,
                state_id=s_id
            )
            db.add(company)
            db.flush()

        # Create two test users in the company
        user1 = db.query(User).filter(User.email == "user1@st.com").first()
        if not user1:
            user1 = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Vendedor 1",
                email="user1@st.com",
                password_hash="hash"
            )
            db.add(user1)
            db.flush()
            uc1 = UserCompany(user_id=user1.id, company_id=company.id)
            db.add(uc1)

        user2 = db.query(User).filter(User.email == "user2@st.com").first()
        if not user2:
            user2 = User(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                name="Gerente 1",
                email="user2@st.com",
                password_hash="hash"
            )
            db.add(user2)
            db.flush()
            uc2 = UserCompany(user_id=user2.id, company_id=company.id)
            db.add(uc2)

        # Create an active commercial policy
        policy_active = db.query(CommercialPolicy).filter(
            CommercialPolicy.company_id == company.id,
            CommercialPolicy.nome_politica == "Active Policy Test"
        ).first()
        if not policy_active:
            policy_active = CommercialPolicy(
                id=uuid.uuid4(),
                company_id=company.id,
                nome_politica="Active Policy Test",
                fator_limite=Decimal("1.5000"),
                manutencao_ano_percentual=Decimal("10.00"),
                comissao_percentual=Decimal("5.00"),
                ativo=True
            )
            db.add(policy_active)

        # Create an inactive commercial policy
        policy_inactive = db.query(CommercialPolicy).filter(
            CommercialPolicy.company_id == company.id,
            CommercialPolicy.nome_politica == "Inactive Policy Test"
        ).first()
        if not policy_inactive:
            policy_inactive = CommercialPolicy(
                id=uuid.uuid4(),
                company_id=company.id,
                nome_politica="Inactive Policy Test",
                fator_limite=Decimal("1.2000"),
                manutencao_ano_percentual=Decimal("5.00"),
                comissao_percentual=Decimal("3.00"),
                ativo=False
            )
            db.add(policy_inactive)

        db.commit()

        # Ensure relationships are hydrated
        db.refresh(company)
        db.refresh(user1)
        db.refresh(user2)
        db.refresh(policy_active)
        db.refresh(policy_inactive)

        print("\n--- Test 1: List Eligible Users ---")
        eligible = list_eligible_users(company_id=company.id, db=db, current_user=user2)
        emails = [u.email for u in eligible]
        print(f"Eligible user emails: {emails}")
        assert "user1@st.com" in emails, "Vendedor 1 should be eligible"
        assert "user2@st.com" in emails, "Gerente 1 should be eligible"
        print("List eligible users passed!")

        print("\n--- Test 2: Create Sales Team with Active Policy ---")
        payload = SalesTeamCreateUpdate(
            nome="Equipe Alfa",
            ativo=True,
            members=[
                SalesTeamMemberCreate(user_id=user1.id, cargo="VENDEDOR"),
                SalesTeamMemberCreate(user_id=user2.id, cargo="GERENTE")
            ],
            policies=[
                SalesTeamPolicyCreate(commercial_policy_id=policy_active.id)
            ]
        )

        team = create_sales_team(company_id=company.id, payload=payload, db=db, current_user=user2)
        print(f"Created Sales Team: ID={team.id}, Nome={team.nome}")
        assert team.nome == "Equipe Alfa"
        assert len(team.members) == 2
        assert len(team.policies) == 1
        assert team.policies[0].commercial_policy_id == policy_active.id
        print("Create Sales Team passed!")

        print("\n--- Test 3: Validation Error on Inactive Policy ---")
        payload_invalid = SalesTeamCreateUpdate(
            nome="Equipe Invalida",
            ativo=True,
            members=[],
            policies=[
                SalesTeamPolicyCreate(commercial_policy_id=policy_inactive.id)
            ]
        )
        try:
            create_sales_team(company_id=company.id, payload=payload_invalid, db=db, current_user=user2)
            assert False, "Should have failed with active check"
        except Exception as e:
            print(f"Caught expected error: {e.detail}")
            assert "está inativa e não pode ser vinculada" in e.detail

        print("\n--- Test 4: Validation Error on Company Membership ---")
        # User from outer universe
        dummy_user_id = str(uuid.uuid4())
        payload_invalid_member = SalesTeamCreateUpdate(
            nome="Equipe Invalida Membro",
            ativo=True,
            members=[
                SalesTeamMemberCreate(user_id=dummy_user_id, cargo="VENDEDOR")
            ],
            policies=[]
        )
        try:
            create_sales_team(company_id=company.id, payload=payload_invalid_member, db=db, current_user=user2)
            assert False, "Should have failed with company membership check"
        except Exception as e:
            print(f"Caught expected error: {e.detail}")
            assert "não pertence a esta empresa" in e.detail

        print("\n--- Test 5: List Sales Teams ---")
        teams_list = list_sales_teams(company_id=company.id, db=db, current_user=user2)
        print(f"Total teams found: {len(teams_list)}")
        assert len(teams_list) >= 1
        assert any(t.nome == "Equipe Alfa" for t in teams_list)
        print("List Sales Teams passed!")

        print("\n--- Test 6: Update Sales Team ---")
        update_payload = SalesTeamCreateUpdate(
            nome="Equipe Alfa Modificada",
            ativo=False,
            members=[
                SalesTeamMemberCreate(user_id=user1.id, cargo="GERENTE")  # Change cargo
            ],
            policies=[]  # Remove policy
        )
        updated = update_sales_team(team_id=team.id, payload=update_payload, db=db, current_user=user2)
        print(f"Updated team: Nome={updated.nome}, Ativo={updated.ativo}, Members={len(updated.members)}, Policies={len(updated.policies)}")
        assert updated.nome == "Equipe Alfa Modificada"
        assert updated.ativo is False
        assert len(updated.members) == 1
        assert updated.members[0].cargo == "GERENTE"
        assert len(updated.policies) == 0
        print("Update Sales Team passed!")

        print("\n--- Test 7: Delete Sales Team ---")
        delete_sales_team(team_id=team.id, db=db, current_user=user2)
        teams_post_delete = list_sales_teams(company_id=company.id, db=db, current_user=user2)
        assert not any(t.id == team.id for t in teams_post_delete)
        print("Delete Sales Team passed!")

        print("\nALL SALES TEAMS TESTS PASSED!")

    finally:
        db.close()

if __name__ == "__main__":
    run_tests()
