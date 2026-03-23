from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import exc
from typing import List
import uuid

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.professionals.models import Professional
from src.modules.professionals.schemas import ProfessionalCreate, ProfessionalUpdate, ProfessionalResponse, AvailableUserResponse

router = APIRouter(prefix="/professionals", tags=["Professionals"])

@router.get("", response_model=List[ProfessionalResponse])
def get_professionals(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    professionals = db.query(Professional).options(
        joinedload(Professional.role),
        joinedload(Professional.user)
    ).filter(Professional.tenant_id == current_user.tenant_id).all()
    return professionals

@router.get("/available-users", response_model=List[AvailableUserResponse])
def get_available_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    # Get users strictly in the tenant
    tenant_users = db.query(User).filter(User.tenant_id == current_user.tenant_id).all()
    
    # Get all users already bounded to a professional in this tenant
    bounded_user_ids = db.query(Professional.user_id).filter(
        Professional.tenant_id == current_user.tenant_id,
        Professional.user_id.isnot(None)
    ).all()
    bounded_user_ids_set = {u[0] for u in bounded_user_ids}

    # Filter out bounded users
    available_users = [u for u in tenant_users if str(u.id) not in bounded_user_ids_set]
    return available_users

@router.post("", response_model=ProfessionalResponse, status_code=status.HTTP_201_CREATED)
def create_professional(prof_in: ProfessionalCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    new_prof = Professional(
        id=str(uuid.uuid4()),
        tenant_id=current_user.tenant_id,
        name=prof_in.name,
        cpf=prof_in.cpf,
        role_id=prof_in.role_id,
        user_id=prof_in.user_id
    )
    db.add(new_prof)
    try:
        db.commit()
        db.refresh(new_prof)
    except exc.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Usuário já está vinculado a outro profissional neste tenant ou dados inválidos.")
    return new_prof

@router.put("/{prof_id}", response_model=ProfessionalResponse)
def update_professional(prof_id: str, prof_in: ProfessionalUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prof = db.query(Professional).filter(Professional.id == prof_id, Professional.tenant_id == current_user.tenant_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    
    update_data = prof_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(prof, field, value)
        
    try:
        db.commit()
        db.refresh(prof)
    except exc.IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Usuário já está vinculado a outro profissional neste tenant.")
    return prof

@router.delete("/{prof_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_professional(prof_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    prof = db.query(Professional).filter(Professional.id == prof_id, Professional.tenant_id == current_user.tenant_id).first()
    if not prof:
        raise HTTPException(status_code=404, detail="Profissional não encontrado.")
    
    db.delete(prof)
    db.commit()
