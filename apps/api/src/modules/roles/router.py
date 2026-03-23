from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.roles.models import Role
from src.modules.roles.schemas import RoleCreate, RoleUpdate, RoleResponse

router = APIRouter(prefix="/roles", tags=["Roles"])

@router.get("", response_model=List[RoleResponse])
def get_roles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    roles = db.query(Role).filter(Role.tenant_id == current_user.tenant_id).all()
    return roles

@router.post("", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
def create_role(role_in: RoleCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Optional: Verify company_id exists and belongs to tenant
    new_role = Role(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        company_id=role_in.company_id,
        name=role_in.name,
        can_perform_sale=role_in.can_perform_sale
    )
    db.add(new_role)
    db.commit()
    db.refresh(new_role)
    return new_role

@router.put("/{role_id}", response_model=RoleResponse)
def update_role(role_id: str, role_in: RoleUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == current_user.tenant_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Cargo não encontrado.")
    
    update_data = role_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(role, field, value)
        
    db.commit()
    db.refresh(role)
    return role

@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    role = db.query(Role).filter(Role.id == role_id, Role.tenant_id == current_user.tenant_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="Cargo não encontrado.")
    
    db.delete(role)
    db.commit()
