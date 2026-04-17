from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from .schemas import CustomerCreate, CustomerUpdate, CustomerOut
from .service import CustomerService
from typing import List

router = APIRouter(prefix="/cadastro/clientes", tags=["Clientes"])

@router.post("", response_model=CustomerOut)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_company_id: str = Depends(get_active_company)
):
    service = CustomerService(db)
    if not payload.company_id and active_company_id:
        from uuid import UUID
        payload.company_id = UUID(active_company_id)
    return service.create_customer(current_user.tenant_id, payload)

@router.get("", response_model=List[CustomerOut])
def list_customers(
    q: str = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_company_id: str = Depends(get_active_company)
):
    service = CustomerService(db)
    return service.list_customers(current_user.tenant_id, q, skip, limit, active_company_id)

@router.get("/{id}", response_model=CustomerOut)
def get_customer(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_company_id: str = Depends(get_active_company)
):
    service = CustomerService(db)
    customer = service.get_customer(current_user.tenant_id, id, active_company_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return customer

@router.put("/{id}", response_model=CustomerOut)
def update_customer(
    id: str,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_company_id: str = Depends(get_active_company)
):
    service = CustomerService(db)
    customer = service.update_customer(current_user.tenant_id, id, payload, active_company_id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return customer

@router.delete("/{id}")
def delete_customer(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_company_id: str = Depends(get_active_company)
):
    service = CustomerService(db)
    if not service.delete_customer(current_user.tenant_id, id, active_company_id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"message": "Cliente excluído com sucesso"}
