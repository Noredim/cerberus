import pytest
from sqlalchemy.orm import Session
from src.modules.products.models import Product
from src.modules.opportunities.models import Opportunity, OpportunityBudget, OpportunityBudgetItem
from src.modules.opportunities import services_budget
from uuid import uuid4

def test_ensure_mdm_opportunity(db_session: Session):
    tenant_id = "test-tenant-123"
    
    # 1. Deve falhar se não houver empresa (conforme implementado)
    with pytest.raises(Exception):
        services_budget.ensure_mdm_opportunity(db_session, tenant_id)
        
    # 2. Criar empresa fake
    from src.modules.companies.models import Company
    company = Company(id=str(uuid4()), tenant_id=tenant_id, name="Test Co")
    db_session.add(company)
    db_session.flush()
    
    # 3. Deve criar a oportunidade de sistema
    opp_id = services_budget.ensure_mdm_opportunity(db_session, tenant_id)
    assert opp_id is not None
    
    opp = db_session.query(Opportunity).filter_by(id=opp_id).first()
    assert opp.titulo_oportunidade == "ORÇAMENTOS AVULSOS - MDM"
    
    # 4. Deve retornar a mesma se chamada de novo
    opp_id_2 = services_budget.ensure_mdm_opportunity(db_session, tenant_id)
    assert opp_id == opp_id_2

def test_product_budget_history(db_session: Session):
    tenant_id = "test-tenant-124"
    product_id = str(uuid4())
    
    # Adicionar item de orçamento vinculado ao produto
    budget_item = OpportunityBudgetItem(
        id=str(uuid4()),
        orcamento_id=str(uuid4()), # won't check relationship here just the query
        descricao="Teste",
        produto_id=product_id,
        quantidade=1,
        valor_unitario=100
    )
    db_session.add(budget_item)
    db_session.commit()
    
    history = services_budget.get_product_budget_history(db_session, product_id)
    assert len(history) == 1
    assert str(history[0].produto_id) == product_id
