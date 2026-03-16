from fastapi import APIRouter, Depends, Query, File, UploadFile, HTTPException
from sqlalchemy.orm import Session
from typing import List
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PurchaseBudgetService.get_budgets(db, current_user.tenant_id, skip, limit)

@router.get("/{budget_id}", response_model=schemas.PurchaseBudgetOut)
def get_budget(
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PurchaseBudgetService.get_budget_by_id(db, current_user.tenant_id, budget_id)

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

@router.post("/{budget_id}/negotiations", response_model=schemas.PurchaseBudgetNegotiationOut)
def add_negotiation(
    budget_id: UUID,
    data: schemas.PurchaseBudgetNegotiationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PurchaseBudgetService.add_negotiation(db, current_user.tenant_id, budget_id, data)

@router.get("/payment-conditions", response_model=List[schemas.PaymentConditionOut])
def list_payment_conditions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PurchaseBudgetService.get_payment_conditions(db, current_user.tenant_id)

@router.post("/payment-conditions", response_model=schemas.PaymentConditionOut)
def create_payment_condition(
    data: schemas.PaymentConditionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PurchaseBudgetService.create_payment_condition(db, current_user.tenant_id, data)

@router.post("/import/{supplier_id}")
async def import_budgets_excel(
    supplier_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    contents = await file.read()
    result = PurchaseBudgetService.parse_excel_items(
        db=db,
        tenant_id=current_user.tenant_id,
        supplier_id=supplier_id,
        file_bytes=contents
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
