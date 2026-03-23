from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.profiles.models import FunctionalProfile
from src.modules.profiles.schemas import FunctionalProfileCreate, FunctionalProfileUpdate, FunctionalProfileResponse

router = APIRouter(prefix="/profiles", tags=["Functional Profiles"])

@router.get("", response_model=List[FunctionalProfileResponse])
def list_profiles(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    profiles = db.query(FunctionalProfile).filter(
        FunctionalProfile.tenant_id == current_user.tenant_id
    ).order_by(FunctionalProfile.name).all()
    return profiles

@router.post("", response_model=FunctionalProfileResponse, status_code=status.HTTP_201_CREATED)
def create_profile(
    payload: FunctionalProfileCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    new_profile = FunctionalProfile(
        tenant_id=current_user.tenant_id,
        name=payload.name,
        margin_factor_limit=payload.margin_factor_limit,
        view_director_consolidation=payload.view_director_consolidation,
        is_protected=False  # Users cannot create protected profiles manually
    )
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return new_profile

@router.put("/{profile_id}", response_model=FunctionalProfileResponse)
def update_profile(
    profile_id: str,
    payload: FunctionalProfileUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = db.query(FunctionalProfile).filter(
        FunctionalProfile.id == profile_id,
        FunctionalProfile.tenant_id == current_user.tenant_id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")

    if payload.name is not None:
        profile.name = payload.name
    if payload.margin_factor_limit is not None:
        profile.margin_factor_limit = payload.margin_factor_limit
    if payload.view_director_consolidation is not None:
        profile.view_director_consolidation = payload.view_director_consolidation

    db.commit()
    db.refresh(profile)
    return profile

@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_profile(
    profile_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    profile = db.query(FunctionalProfile).filter(
        FunctionalProfile.id == profile_id,
        FunctionalProfile.tenant_id == current_user.tenant_id
    ).first()

    if not profile:
        raise HTTPException(status_code=404, detail="Perfil não encontrado.")

    if profile.is_protected:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este é um perfil nativo do sistema e não pode ser excluído."
        )

    db.delete(profile)
    db.commit()
    return None
