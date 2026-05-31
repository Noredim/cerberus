import sys
import uuid
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append('/app')
import src.main
from src.modules.document_templates import service
from src.modules.document_templates.schemas import TemplateCreate, TemplateUpdate, DocumentRenderRequest
from src.modules.document_templates.models import DocumentTemplate, DocumentVersion, DocumentVariable, DocumentAudit

# Inside container, we connect using db host on port 5432
engine = create_engine("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# We start a transaction block so we can rollback at the end
db.begin()

try:
    tenant_id = "test-tenant"
    company_id = uuid.uuid4()
    user_id = "test-user-id"

    # Ensure company exists
    from src.modules.companies.models import Company
    company = db.query(Company).first()
    if company:
        company_id = company.id
        tenant_id = str(company.tenant_id)
    else:
        # Create a mock company
        company = Company(
            id=company_id,
            tenant_id=tenant_id,
            razao_social="Empresa Teste LTDA",
            cnpj="12345678000199",
            municipality_id=1,
            regime_tributario="SIMPLE",
            is_active=True
        )
        db.add(company)
        db.flush()

    # Find or create a mock user
    from src.modules.users.models import User
    user = db.query(User).filter(User.tenant_id == tenant_id).first()
    if user:
        user_id = str(user.id)
    else:
        user = User(
            id=user_id,
            tenant_id=tenant_id,
            name="Usuario Teste",
            email="teste@cerberus.com.br",
            password_hash="fake",
            is_active=True
        )
        db.add(user)
        db.flush()

    print("--- Test 1: Validation of Missing Mandatory Variables ---")
    # For OPORTUNIDADE, the mandatory variables in VARIABLES_CATALOG are:
    # 'cliente_nome', 'empresa_nome', 'valor_proposta'
    # Let's try creating a template missing 'valor_proposta'
    invalid_data = TemplateCreate(
        nome="CGF Invalido",
        tipo_documento="CGF",
        modulo_origem="OPORTUNIDADE",
        conteudo_html="Este documento pertence ao cliente {{cliente_nome}} da empresa {{empresa_nome}}.",
        descricao="Modelo teste sem valor da proposta",
        variables=[]
    )
    
    try:
        service.create_template(db, tenant_id, str(company_id), invalid_data, user_id)
        assert False, "Should have failed validation because 'valor_proposta' is missing!"
    except ValueError as e:
        print(f"Test 1 Passed! Threw expected validation error: {e}")

    print("\n--- Test 2: Successful Creation with All Mandatory Variables ---")
    valid_data = TemplateCreate(
        nome="CGF Proposta Valida",
        tipo_documento="PROPOSTA_COMERCIAL",
        modulo_origem="OPORTUNIDADE",
        conteudo_html="Cliente: {{cliente_nome}} | Emitente: {{empresa_nome}} | Valor: {{valor_proposta}}.",
        descricao="Modelo teste com todas as variaveis obrigatorias",
        variables=[]
    )
    
    template = service.create_template(db, tenant_id, str(company_id), valid_data, user_id)
    assert template is not None
    assert template.id is not None
    assert template.status == "RASCUNHO"
    assert template.versao == 1
    
    # Verify that variable entities were generated automatically from catalog
    variables = db.query(DocumentVariable).filter(DocumentVariable.modelo_id == template.id).all()
    assert len(variables) == 7 # the count of OPORTUNIDADE catalog variables
    print(f"Test 2 Passed! Template created with ID {template.id} and {len(variables)} variables.")

    print("\n--- Test 3: Edit/Update Template Draft ---")
    update_data = TemplateUpdate(
        nome="CGF Proposta Valida - Atualizada",
        tipo_documento="PROPOSTA_COMERCIAL",
        modulo_origem="OPORTUNIDADE",
        conteudo_html="Cliente: {{cliente_nome}} | Emitente: {{empresa_nome}} | Valor: {{valor_proposta}} | Numero: {{oportunidade_numero}}",
        descricao="Descricao atualizada",
        variables=[]
    )
    updated_template = service.update_template(db, tenant_id, str(company_id), str(template.id), update_data, user_id)
    assert updated_template is not None
    assert updated_template.nome == "CGF Proposta Valida - Atualizada"
    assert "oportunidade_numero" in updated_template.conteudo_html
    print("Test 3 Passed!")

    print("\n--- Test 4: Publish Template ---")
    published = service.publish_template(db, tenant_id, str(company_id), str(template.id), user_id)
    assert published is not None
    assert published.status == "VIGENTE"
    
    # Check that a version snapshot record was created
    versions = db.query(DocumentVersion).filter(DocumentVersion.modelo_id == template.id).all()
    assert len(versions) == 1
    assert versions[0].conteudo_html == published.conteudo_html
    print("Test 4 Passed!")

    print("\n--- Test 5: Prevent Editing Vigent Templates ---")
    try:
        service.update_template(db, tenant_id, str(company_id), str(template.id), update_data, user_id)
        assert False, "Should have failed because editing published/vigent template is prohibited!"
    except ValueError as e:
        print(f"Test 5 Passed! Threw expected error: {e}")

    print("\n--- Test 6: Duplicate/Version Published Template ---")
    # Duplicating a vigent template creates a new rascunho version incremented by 1
    clone = service.duplicate_template(db, tenant_id, str(company_id), str(template.id), user_id)
    assert clone is not None
    assert clone.status == "RASCUNHO"
    assert clone.versao == 2
    assert clone.nome == f"{published.nome} (Nova Versão)"
    print("Test 6 Passed!")

    print("\n--- Test 7: Automatic Inactivation of Previous Version on Publish ---")
    # Let's publish the new clone (v2)
    # The valid variables are already present in clone's HTML
    published_v2 = service.publish_template(db, tenant_id, str(company_id), str(clone.id), user_id)
    assert published_v2 is not None
    assert published_v2.status == "VIGENTE"
    
    # Check that the previous v1 template is now automatically INATIVO
    db.refresh(template)
    assert template.status == "INATIVO"
    print("Test 7 Passed!")

    print("\n--- Test 8: Render Template with SalesBudget Replacements ---")
    # Let's find or create a SalesBudget
    from src.modules.sales_budgets.models import SalesBudget
    from src.modules.customers.models import Customer
    budget = db.query(SalesBudget).filter(SalesBudget.tenant_id == tenant_id, SalesBudget.company_id == company_id).first()
    if not budget:
        # Create a mock Customer
        customer = Customer(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            razao_social="Cliente Teste SA",
            cnpj="98765432000188",
            active=True
        )
        db.add(customer)
        db.flush()
        
        budget = SalesBudget(
            id=uuid.uuid4(),
            tenant_id=tenant_id,
            company_id=company_id,
            customer_id=customer.id,
            numero_orcamento="OP-2026-999",
            titulo="Proposta de Software",
            valor_total=154300.50,
            status="EM_ANALISE"
        )
        db.add(budget)
        db.flush()

    render_req = DocumentRenderRequest(oportunidade_id=str(budget.id))
    rendered_content = service.render_template(db, tenant_id, str(company_id), str(published_v2.id), render_req, user_id)
    assert rendered_content is not None
    
    # Check replacements
    expected_customer_name = budget.customer.nome_fantasia or budget.customer.razao_social if budget.customer else ""
    assert expected_customer_name in rendered_content
    expected_company_name = budget.company.razao_social if budget.company else ""
    assert expected_company_name in rendered_content
    if budget.valor_total:
        formatted_val = f"{float(budget.valor_total):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")  # type: ignore
        assert formatted_val in rendered_content
    print("Test 8 Passed! Rendered HTML content:")
    print(rendered_content)

    print("\nAll Document Templates integration tests completed successfully!")

except Exception as e:
    print(f"Test failed with error: {e}")
    raise e
finally:
    # Always rollback transaction to prevent database pollution
    db.rollback()
    db.close()
