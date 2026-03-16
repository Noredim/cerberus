from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from .schemas import ProductCreate, ProductUpdate, ProductOut, MvaLookupResult
from .service import ProductService
from src.modules.purchase_budgets.models import PurchaseBudgetItem, PurchaseBudget
from src.modules.purchase_budgets.schemas import PurchaseBudgetItemOut

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

@router.get("/{product_id}/budgets")
def list_product_budgets(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Retornar histórico de itens de orçamento para o produto
    items = db.query(PurchaseBudgetItem).join(PurchaseBudget).filter(
        PurchaseBudgetItem.product_id == str(product_id),
        PurchaseBudget.tenant_id == current_user.tenant_id
    ).order_by(PurchaseBudget.data_orcamento.desc()).limit(20).all()
    
    print(f"DEBUG_GET_BUDGETS: found {len(items)} for product {product_id} tenant {current_user.tenant_id}", flush=True)

    result = []
    for item in items:
        # Prepara um dicionário com os campos esperados
        res = {
            "id": item.id,
            "valor_unitario": item.valor_unitario,
            "ipi_percent": item.ipi_percent,
            "icms_percent": item.icms_percent,
            "created_at": getattr(item.budget, 'created_at', None),
            "budget": {
                "numero_orcamento": getattr(item.budget, 'numero_orcamento', None),
                "data_orcamento": item.budget.data_orcamento,
                "supplier_nome_fantasia": item.budget.supplier.nome_fantasia if getattr(item.budget, 'supplier', None) else None,
                "supplier_razao_social": item.budget.supplier.razao_social if getattr(item.budget, 'supplier', None) else None,
            }
        }
        result.append(res)
    return result

@router.post("/{product_id}/budgets/manual")
def create_manual_product_budget(
    product_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Dummy implementation for now or call budget service
    return {"status": "ok"}
