from fastapi import APIRouter, Depends, Query, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User

from . import schemas
from .service import PurchaseBudgetService

router = APIRouter(
    prefix="/purchase-budgets",
    tags=["Purchase Budgets"]
)

@router.get("", response_model=List[schemas.PurchaseBudgetOut])
def list_budgets(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    supplier_id: Optional[str] = None,
    sales_budget_id: Optional[UUID] = None,
    licitacao_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    """
    Listar orcamentos de compra.
    """
    return PurchaseBudgetService.get_budgets(db, current_user.tenant_id, skip, limit, supplier_id, sales_budget_id, company_id, licitacao_id)

@router.get("/{budget_id}", response_model=schemas.PurchaseBudgetOut)
def get_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return PurchaseBudgetService.get_budget_by_id(db, current_user.tenant_id, budget_id, company_id)

@router.post("", response_model=schemas.PurchaseBudgetOut)
def create_budget(
    data: schemas.PurchaseBudgetCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    return PurchaseBudgetService.create_budget(db, current_user.tenant_id, company_id, data)

@router.put("/{budget_id}", response_model=schemas.PurchaseBudgetOut)
def update_budget(
    budget_id: UUID,
    data: schemas.PurchaseBudgetUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    return PurchaseBudgetService.update_budget(db, current_user.tenant_id, UUID(company_id), budget_id, data)

@router.post("/{budget_id}/negotiations", response_model=schemas.PurchaseBudgetNegotiationOut)
def add_negotiation(
    budget_id: UUID,
    data: schemas.PurchaseBudgetNegotiationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PurchaseBudgetService.add_negotiation(db, current_user.tenant_id, budget_id, data)



@router.post("/import/{supplier_id}")
async def import_budgets_excel(
    supplier_id: str,
    file: UploadFile = File(...),
    dolar_orcamento: bool = Query(False),
    valor_conversao: Optional[float] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contents = await file.read()
    result = PurchaseBudgetService.parse_excel_items(
        db=db,
        tenant_id=current_user.tenant_id,
        supplier_id=supplier_id,
        file_bytes=contents,
        dolar_orcamento=dolar_orcamento,
        valor_conversao=valor_conversao
    )
    return result

@router.post("/import/link-product/{supplier_id}")
def link_product_to_supplier(
    supplier_id: str,
    data: schemas.ProductSupplierLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = PurchaseBudgetService.link_supplier_product(
        db=db,
        tenant_id=current_user.tenant_id,
        supplier_id=supplier_id,
        product_id=data.product_id,
        codigo_fornecedor=data.codigo_fornecedor
    )
    return {"message": "Product linked successfully", "id": str(result.id)}

@router.delete("/{budget_id}", status_code=204)
def delete_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    PurchaseBudgetService.delete_budget(db, current_user.tenant_id, budget_id, company_id)
    return None
