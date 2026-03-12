from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from .schemas import CustomerCreate, CustomerUpdate, CustomerOut
from .service import CustomerService
from typing import List

router = APIRouter(prefix="/cadastro/clientes", tags=["Clientes"])

@router.post("", response_model=CustomerOut)
def create_customer(
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = CustomerService(db)
    return service.create_customer(current_user.tenant_id, payload)

@router.get("", response_model=List[CustomerOut])
def list_customers(
    q: str = Query(None),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = CustomerService(db)
    return service.list_customers(current_user.tenant_id, q, skip, limit)

@router.get("/{id}", response_model=CustomerOut)
def get_customer(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = CustomerService(db)
    customer = service.get_customer(current_user.tenant_id, id)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return customer

@router.put("/{id}", response_model=CustomerOut)
def update_customer(
    id: str,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = CustomerService(db)
    customer = service.update_customer(current_user.tenant_id, id, payload)
    if not customer:
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return customer

@router.delete("/{id}")
def delete_customer(
    id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = CustomerService(db)
    if not service.delete_customer(current_user.tenant_id, id):
        raise HTTPException(status_code=404, detail="Cliente não encontrado")
    return {"message": "Cliente excluído com sucesso"}
