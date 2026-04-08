import pytest
from sqlalchemy.orm import Session
from uuid import uuid4
from datetime import datetime
from src.modules.companies.models import Company
from src.modules.sales_proposals.models import SalesProposal, SalesProposalKit, SalesProposalLog
from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.sales_proposals.service import sales_proposal_service
from src.modules.sales_proposals.schemas import SalesProposalCreate

def test_generate_proposal_number(db_session: Session):
    tenant_id = "test-tenant-sp-1"
    company_id = uuid4()
    user_id = "user-123"
    
    # 1. Create a fake company
    company = Company(
        id=str(company_id),
        tenant_id=tenant_id,
        name="Test Sales Proposal Co",
        nomenclatura_orcamento="STM",
        numero_proposta=14
    )
    db_session.add(company)
    db_session.commit()
    
    # 2. Add proposal
    data = SalesProposalCreate(
        titulo="Projeto Alfa",
        customer_id=str(uuid4())
    )
    
    proposal = sales_proposal_service.create(db_session, tenant_id, company_id, user_id, data)
    
    assert proposal.numero_sequencial == 14
    
    # Expect numbering to be "STM-14/YEAR"
    current_year = datetime.now().year
    assert proposal.numero_proposta == f"STM-14/{current_year}"
    assert proposal.responsavel_id == user_id
    assert proposal.titulo == "Projeto Alfa"
    
    # Check that company's current sequence is now updated to 15
    db_session.refresh(company)
    assert company.numero_proposta == 15

def test_first_kit_factor_injection(db_session: Session):
    tenant_id = "test-tenant-sp-1"
    company_id = uuid4()
    user_id = "user-123"
    
    # Company
    company = Company(id=str(company_id), tenant_id=tenant_id, name="Test Company")
    db_session.add(company)
    
    # Proposal
    proposal = SalesProposal(
        id=uuid4(),
        tenant_id=tenant_id,
        company_id=company_id,
        numero_sequencial=1,
        numero_proposta=f"P-1/{datetime.now().year}",
        titulo="Proposta Sem Fatores",
        customer_id=str(uuid4())
        # All factors are default to None/0 by the model
    )
    db_session.add(proposal)
    db_session.commit()

    # Create dummy opportunity kit
    kit = OpportunityKit(
        id=uuid4(),
        tenant_id=tenant_id,
        company_id=company_id,
        nome_kit="Kit Teste Fatores",
        fator_margem_servicos_produtos=1.5,
        fator_margem_instalacao=2.0,
        fator_margem_manutencao=3.0,
        perc_frete_venda=5.0,
        perc_despesas_adm=10.0,
        perc_comissao=15.0
    )
    db_session.add(kit)
    db_session.commit()
    
    # Add Kit
    prop_kit = sales_proposal_service.add_kit(db_session, tenant_id, company_id, proposal.id, user_id, kit.id)
    
    # Assert
    db_session.refresh(proposal)
    assert prop_kit is not None
    assert proposal.fator_margem_produtos == 1.5
    assert proposal.fator_margem_servicos == 1.5
    assert proposal.fator_margem_instalacao == 2.0
    assert proposal.fator_margem_manutencao == 3.0
    assert proposal.frete_venda == 5.0
    assert proposal.despesas_adm == 10.0
    assert proposal.comissao == 15.0
    
    # Make sure second kit doesn't override it if we already have factors
    kit2 = OpportunityKit(
        id=uuid4(),
        tenant_id=tenant_id,
        company_id=company_id,
        nome_kit="Kit Teste Fatores 2",
        fator_margem_servicos_produtos=9.9
    )
    db_session.add(kit2)
    db_session.commit()
    
    sales_proposal_service.add_kit(db_session, tenant_id, company_id, proposal.id, user_id, kit2.id)
    db_session.refresh(proposal)
    assert proposal.fator_margem_produtos == 1.5  # Remains 1.5 because it was not zero

def test_global_factor_application(db_session: Session):
    tenant_id = "test-tenant-sp-1"
    company_id = uuid4()
    user_id = "user-123"
    
    # Proposal with known factors
    proposal = SalesProposal(
        id=uuid4(),
        tenant_id=tenant_id,
        company_id=company_id,
        titulo="Global factors test",
        customer_id=str(uuid4()),
        fator_margem_produtos=8.8,
        frete_venda=20.0
    )
    db_session.add(proposal)
    
    # Kit linked
    kit = OpportunityKit(id=uuid4(), tenant_id=tenant_id, company_id=company_id, nome_kit="Kit A", fator_margem_servicos_produtos=1.1, perc_frete_venda=1.0)
    db_session.add(kit)
    db_session.commit()
    
    db_session.add(SalesProposalKit(proposal_id=proposal.id, opportunity_kit_id=kit.id))
    db_session.commit()

    # Apply global factors
    sales_proposal_service.apply_factors_to_all_kits(db_session, tenant_id, company_id, proposal.id, user_id)
    
    db_session.refresh(kit)
    assert kit.fator_margem_servicos_produtos == 8.8
    assert kit.perc_frete_venda == 20.0
    
    # Also verify log creation
    log = db_session.query(SalesProposalLog).filter_by(proposal_id=proposal.id, acao="APLICACAO_FATORES_KITS").first()
    assert log is not None
