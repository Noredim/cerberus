import sys
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append('/app')
import src.main
from src.modules.companies.models import Company, SalesTeam, SalesTeamMember, CompanyDocumentRule
from src.modules.document_templates.models import DocumentTemplate
from src.modules.users.models import User
from src.modules.companies.router import save_company_document_rule, list_company_document_rules, resolve_document_template_for_user, delete_company_document_rule
from src.modules.companies.schemas import CompanyDocumentRuleSave

engine = create_engine("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()
db.begin()

try:
    # 1. Setup mock company, user, sales team, document template
    company = db.query(Company).first()
    if not company:
        tenant_id = "test-tenant-docs"
        company = Company(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            razao_social="Empresa Teste Documentos LTDA",
            cnpj="11222333000199",
            municipality_id="1",
            state_id="1"
        )
        db.add(company)
        db.flush()

    tenant_id = str(company.tenant_id)

    user = db.query(User).filter(User.tenant_id == tenant_id).first()
    if not user:
        user = User(
            id=str(uuid.uuid4()),
            tenant_id=tenant_id,
            name="Vendedor Teste",
            email="vendedor@teste.com",
            password_hash="fake"
        )
        db.add(user)
        db.flush()

    # Create a mock SalesTeam
    team = SalesTeam(
        id=uuid.uuid4(),
        tenant_id=tenant_id,
        company_id=company.id,
        nome="Equipe Venda Stelseg",
        ativo=True
    )
    db.add(team)
    db.flush()

    # Bind user to team
    member = SalesTeamMember(
        sales_team_id=team.id,
        user_id=str(user.id),
        cargo="VENDEDOR"
    )
    db.add(member)
    db.flush()

    # Create a mock DocumentTemplate
    template = DocumentTemplate(
        id=uuid.uuid4(),
        tenant_id=str(company.tenant_id),
        company_id=company.id,
        nome="Proposta Comercial Stelseg V1",
        tipo_documento="PROPOSTA_COMERCIAL",
        modulo_origem="OPORTUNIDADE",
        conteudo_html="<h1>Proposta Comercial</h1>",
        status="VIGENTE",
        versao=1
    )
    db.add(template)
    db.flush()

    print("--- Test 1: Save Company Document Rule Binding ---")
    save_payload = CompanyDocumentRuleSave(
        tipo_documento="PROPOSTA_COMERCIAL",
        sales_team_id=team.id,
        document_template_id=template.id
    )
    rule_out = save_company_document_rule(company.id, save_payload, db, user)
    assert rule_out is not None
    assert rule_out.sales_team_id == team.id
    assert rule_out.document_template_id == template.id
    print("Test 1 Passed! Rule created successfully.")

    print("\n--- Test 2: List Company Document Rules ---")
    rules_list = list_company_document_rules(company.id, "PROPOSTA_COMERCIAL", db, user)
    assert len(rules_list) >= 1
    matched = [r for r in rules_list if r.id == rule_out.id]
    assert len(matched) == 1
    assert matched[0].sales_team_nome == "Equipe Venda Stelseg"
    assert matched[0].document_template_nome == "Proposta Comercial Stelseg V1"
    print("Test 2 Passed! Rules listed with sales team and document template names.")

    print("\n--- Test 3: Resolve Document Template for Seller User ---")
    res = resolve_document_template_for_user(company.id, "PROPOSTA_COMERCIAL", sales_team_id=team.id, user_id=str(user.id), db=db, current_user=user)
    assert res is not None
    assert res["document_template_id"] == str(template.id)
    assert res["resolved_by"] == "SALES_TEAM"
    assert res["sales_team_id"] == str(team.id)
    print(f"Test 3 Passed! Resolved template ID: {res['document_template_id']} by {res['resolved_by']}.")

    print("\n--- Test 4: Delete Company Document Rule ---")
    del_res = delete_company_document_rule(company.id, rule_out.id, db, user)
    assert del_res["ok"] is True
    post_delete = list_company_document_rules(company.id, "PROPOSTA_COMERCIAL", db, user)
    deleted_matches = [r for r in post_delete if r.id == rule_out.id]
    assert len(deleted_matches) == 0
    print("Test 4 Passed! Rule deleted successfully.")

    print("\nAll Company Document Rules integration tests passed 100%!")

except Exception as e:
    print(f"Test failed with error: {e}")
    raise e
finally:
    db.rollback()
    db.close()
