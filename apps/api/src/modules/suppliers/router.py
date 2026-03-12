from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from .schemas import SupplierCreate, SupplierUpdate, SupplierOut
from .service import SupplierService

router = APIRouter(prefix="/cadastro/fornecedores", tags=["Suppliers"])

@router.post("", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_supplier(
    payload: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = SupplierService(db)
    # Check for existing CNPJ in same tenant
    from .models import Supplier
    existing = db.query(Supplier).filter(
        Supplier.tenant_id == current_user.tenant_id,
        Supplier.cnpj == payload.cnpj
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Fornecedor já cadastrado com este CNPJ.")
        
    return service.create_supplier(current_user.tenant_id, payload)

@router.get("", response_model=List[SupplierOut])
def list_suppliers(
    q: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = SupplierService(db)
    return service.list_suppliers(current_user.tenant_id, q, skip, limit)

@router.get("/{supplier_id}", response_model=SupplierOut)
def get_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = SupplierService(db)
    supplier = service.get_supplier(current_user.tenant_id, supplier_id)
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    return supplier

@router.put("/{supplier_id}", response_model=SupplierOut)
def update_supplier(
    supplier_id: str,
    payload: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = SupplierService(db)
    supplier = service.update_supplier(current_user.tenant_id, supplier_id, payload)
    if not supplier:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    return supplier

@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_supplier(
    supplier_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = SupplierService(db)
    success = service.delete_supplier(current_user.tenant_id, supplier_id)
    if not success:
        raise HTTPException(status_code=404, detail="Fornecedor não encontrado.")
    return None
