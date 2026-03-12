from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from .schemas import ProductCreate, ProductUpdate, ProductOut, MvaLookupResult
from .service import ProductService
from src.modules.opportunities import services_budget
from src.modules.opportunities.schemas import (
    OpportunityBudgetItemOut,
    OpportunityBudgetManualCreate,
    OpportunityBudgetOut,
    ProductBudgetItemWithBudgetOut
)

router = APIRouter(prefix="/cadastro/produtos", tags=["Products"])

@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ProductService(db)
    return service.create_product(current_user.tenant_id, payload)

@router.get("", response_model=List[ProductOut])
def list_products(
    q: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ProductService(db)
    return service.list_products(current_user.tenant_id, q, tipo, skip, limit)

@router.get("/mva-preview", response_model=MvaLookupResult)
def preview_mva(
    ncm: str,
    company_id: UUID,
    finalidade: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint para o frontend consultar o MVA em tempo real ao preencher o NCM.
    """
    service = ProductService(db)
    mva_data = service.get_product_mva(current_user.tenant_id, ncm, str(company_id), finalidade)
    
    if not mva_data:
        return MvaLookupResult(found=False)
        
    return MvaLookupResult(
        found=True,
        mva_percent=mva_data["mva_percent"],
        ncm_base=mva_data["ncm_match"],
        description=mva_data["descricao"]
    )

@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ProductService(db)
    product = service.get_product(current_user.tenant_id, str(product_id))
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return product

@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ProductService(db)
    product = service.update_product(current_user.tenant_id, str(product_id), payload)
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ProductService(db)
    success = service.delete_product(current_user.tenant_id, str(product_id))
    if not success:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return None

@router.get("/{product_id}/budgets", response_model=List[ProductBudgetItemWithBudgetOut])
def get_product_budgets(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retorna o histórico de preços/orçamentos de um produto específico.
    """
    return services_budget.get_product_budget_history(db, str(product_id))

@router.post("/{product_id}/budgets/manual", response_model=OpportunityBudgetOut)
def create_product_manual_budget(
    product_id: UUID,
    budget_in: OpportunityBudgetManualCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cria um lançamento avulso de orçamento para o produto.
    Automaticamente amarra à 'Oportunidade de Sistema' do Tenant.
    """
    opp_id = services_budget.ensure_mdm_opportunity(db, current_user.tenant_id)
    
    # Injetamos o product_id em todos os itens se não enviado
    for item in budget_in.items:
        if not item.produto_id:
            item.produto_id = product_id
            
    return services_budget.create_manual_budget(db, current_user.tenant_id, opp_id, budget_in)
