import logging
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
import uuid
import datetime
from typing import Optional

from src.modules.opportunities.models import (
    Opportunity, OpportunityParametersSales, OpportunityParametersRent,
    OpportunityItem, OpportunityItemKit
)
from src.modules.opportunities.schemas import (
    OpportunityCreate, OpportunityUpdate, TipoOperacao,
    OpportunityItemCreate, OpportunityItemUpdate, OpportunityItemKitCreate,
    OpportunityParametersSalesCreate, OpportunityParametersSalesUpdate
)
from src.modules.companies.models import Company, CompanySalesParameter

logger = logging.getLogger(__name__)

def generate_opportunity_number() -> str:
    """Gera um identificador legível para a oportunidade"""
    prefix = "OPP"
    timestamp = datetime.datetime.now().strftime("%y%m%d")
    short_hash = str(uuid.uuid4()).split('-')[0].upper()
    return f"{prefix}-{timestamp}-{short_hash}"

def create_opportunity(db: Session, tenant_id: str, opp_in: OpportunityCreate) -> Opportunity:
    # Validate company belongs to tenant
    company = db.query(Company).filter(
        Company.id == opp_in.empresa_id,
        Company.tenant_id == tenant_id
    ).first()
    
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    # Retrieve Company Default Sales Parameters
    comp_sales_params = db.query(CompanySalesParameter).filter(
        CompanySalesParameter.company_id == opp_in.empresa_id
    ).first()

    # Create Header
    opp_obj = Opportunity(
        tenant_id=tenant_id,
        numero_oportunidade=generate_opportunity_number(),
        titulo_oportunidade=opp_in.titulo_oportunidade,
        cliente_id=opp_in.cliente_id,
        tipo_cliente=opp_in.tipo_cliente,
        tipo_operacao=opp_in.tipo_operacao,
        possui_instalacao=opp_in.possui_instalacao,
        possui_manutencao=opp_in.possui_manutencao,
        status=opp_in.status,
        data_abertura=opp_in.data_abertura or datetime.date.today(),
        responsavel_comercial=opp_in.responsavel_comercial,
        origem_oportunidade=opp_in.origem_oportunidade,
        observacoes=opp_in.observacoes,
        empresa_id=opp_in.empresa_id,
        perfil_tributario_origem_id=opp_in.perfil_tributario_origem_id,
    )

    db.add(opp_obj)
    db.flush() # flush to get opp_obj.id

    # Create corresponding param profile
    if opp_in.tipo_operacao == TipoOperacao.VENDA:
        params = OpportunityParametersSales(
            opportunity_id=opp_obj.id,
            mkp_padrao=comp_sales_params.mkp_padrao if comp_sales_params else 0.00,
            percentual_despesas_administrativas=comp_sales_params.despesa_administrativa if comp_sales_params else 0.00,
            percentual_comissao_padrao=comp_sales_params.comissionamento if comp_sales_params else 0.00,
            pis_percentual=comp_sales_params.pis if comp_sales_params else 0.00,
            cofins_percentual=comp_sales_params.cofins if comp_sales_params else 0.00,
            csll_percentual=comp_sales_params.csll if comp_sales_params else 0.00,
            irpj_percentual=comp_sales_params.irpj if comp_sales_params else 0.00,
            iss_percentual=comp_sales_params.iss if comp_sales_params else 0.00,
        )
        db.add(params)
    else:
        # COMODATO / LOCACAO
        iss_val = comp_sales_params.iss if comp_sales_params else 0.00
        # Regra do prompt: "se tipo_receita = LOCACAO_PURA, preencher automaticamente com 0,00"
        # O tipo default é COMODATO, mas pode ser configurado depois. Vamos usar o da empresa por segurança ou 0.
        params = OpportunityParametersRent(
            opportunity_id=opp_obj.id,
            pis_percentual=comp_sales_params.pis if comp_sales_params else 0.00,
            cofins_percentual=comp_sales_params.cofins if comp_sales_params else 0.00,
            irpj_percentual=comp_sales_params.irpj if comp_sales_params else 0.00,
            csll_percentual=comp_sales_params.csll if comp_sales_params else 0.00,
            iss_percentual=iss_val
        )
        db.add(params)

    db.commit()
    db.refresh(opp_obj)
    return opp_obj

def get_opportunities(db: Session, tenant_id: str, skip: int = 0, limit: int = 100):
    return db.query(Opportunity).filter(Opportunity.tenant_id == tenant_id).order_by(Opportunity.created_at.desc()).offset(skip).limit(limit).all()

def get_opportunity_by_id(db: Session, tenant_id: str, opp_id: str):
    return db.query(Opportunity).filter(
        Opportunity.id == opp_id,
        Opportunity.tenant_id == tenant_id
    ).first()

def update_opportunity(db: Session, tenant_id: str, opp_id: str, opp_in: OpportunityUpdate):
    opp = get_opportunity_by_id(db, tenant_id, opp_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
        
    update_data = opp_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(opp, key, value)
        
    db.commit()
    db.refresh(opp)
    return opp

def delete_opportunity(db: Session, tenant_id: str, opp_id: str):
    opp = get_opportunity_by_id(db, tenant_id, opp_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
        
    db.delete(opp)
    db.commit()
    return True

# ========================================== #
# OPORTUNIDADE ITEMS
# ========================================== #

def get_items(db: Session, opp_id: str):
    return db.query(OpportunityItem).filter(
        OpportunityItem.opportunity_id == opp_id
    ).order_by(OpportunityItem.created_at.desc()).all()

def get_item(db: Session, item_id: str):
    return db.query(OpportunityItem).filter(OpportunityItem.id == item_id).first()

def add_item(db: Session, opp_id: str, item_in: OpportunityItemCreate):
    item = OpportunityItem(
        opportunity_id=opp_id,
        descricao_manual=item_in.descricao_manual,
        produto_id=item_in.produto_id,
        tipo_item=item_in.tipo_item,
        quantidade=item_in.quantidade,
        unidade=item_in.unidade,
        valor_venda_unitario=item_in.valor_venda_unitario,
        observacoes=item_in.observacoes
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return item

def update_item(db: Session, item_id: str, item_in: OpportunityItemUpdate):
    item = get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    update_data = item_in.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(item, key, value)
        
    db.commit()
    db.refresh(item)
    return item

def remove_item(db: Session, item_id: str):
    item = get_item(db, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    db.delete(item)
    db.commit()
    return True

# ========================================== #
# KITS (Sub-items)
# ========================================== #

def get_kit_items(db: Session, parent_item_id: str):
    return db.query(OpportunityItemKit).filter(
        OpportunityItemKit.item_pai_id == parent_item_id
    ).all()

def add_kit_item(db: Session, parent_item_id: str, kit_item_in: OpportunityItemKitCreate):
    kit_item = OpportunityItemKit(
        item_pai_id=parent_item_id,
        produto_id=kit_item_in.produto_id,
        quantidade=kit_item_in.quantidade,
        observacoes=kit_item_in.observacoes
    )
    db.add(kit_item)
    db.commit()
    db.refresh(kit_item)
    return kit_item

def remove_kit_item(db: Session, kit_item_id: str):
    kit_item = db.query(OpportunityItemKit).filter(OpportunityItemKit.id == kit_item_id).first()
    if not kit_item:
        raise HTTPException(status_code=404, detail="Kit Item not found")
    
    db.delete(kit_item)
    db.commit()
    return True

# ========================================== #
# SALES PARAMETERS
# ========================================== #

def get_opportunity_parameters_sales(db: Session, opp_id: str) -> Optional[OpportunityParametersSales]:
    return db.query(OpportunityParametersSales).filter(OpportunityParametersSales.opportunity_id == opp_id).first()

def upsert_opportunity_parameters_sales(db: Session, opp_id: str, params_in: OpportunityParametersSalesUpdate):
    # Check if opp exists to link
    opp = db.query(Opportunity).filter(Opportunity.id == opp_id).first()
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
        
    existing_params = get_opportunity_parameters_sales(db, opp_id)
    
    if existing_params:
        update_data = params_in.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(existing_params, key, value)
        db.commit()
        db.refresh(existing_params)
        return existing_params
    else:
        new_params = OpportunityParametersSales(
            opportunity_id=opp_id,
            **params_in.model_dump()
        )
        db.add(new_params)
        db.commit()
        db.refresh(new_params)
        return new_params

