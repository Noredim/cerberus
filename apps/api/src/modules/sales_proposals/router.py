from fastapi import APIRouter, Depends, Query, Path, HTTPException
from sqlalchemy.orm import Session
from typing import List, Any
from uuid import UUID

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.sales_proposals.schemas import (
    SalesProposalResponse,
    SalesProposalCreate,
    SalesProposalUpdate,
    SalesProposalUpdateFactors,
    ChangeResponsavelRequest,
    AddKitRequest,
    SalesProposalKitResponse
)
from src.modules.sales_proposals.service import sales_proposal_service

router = APIRouter(prefix="/sales-proposals", tags=["Sales Proposals"])

@router.get("", response_model=List[SalesProposalResponse])
def list_proposals(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return sales_proposal_service.get_list(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        skip=skip,
        limit=limit
    )

@router.post("", response_model=SalesProposalResponse)
def create_proposal(
    data: SalesProposalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return sales_proposal_service.create(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        user_id=str(current_user.id),
        data=data
    )

@router.get("/{id}", response_model=SalesProposalResponse)
def get_proposal(
    id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return sales_proposal_service.get_by_id(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        proposal_id=id
    )

@router.put("/{id}", response_model=SalesProposalResponse)
def update_proposal(
    data: SalesProposalUpdate,
    id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return sales_proposal_service.update(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        proposal_id=id,
        user_id=str(current_user.id),
        data=data
    )

@router.put("/{id}/factors", response_model=SalesProposalResponse)
def update_proposal_factors(
    data: SalesProposalUpdateFactors,
    id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return sales_proposal_service.update_factors(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        proposal_id=id,
        user_id=str(current_user.id),
        data=data
    )

@router.post("/{id}/apply-factors")
def apply_factors_to_kits(
    id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    sales_proposal_service.apply_factors_to_kits(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        proposal_id=id,
        user_id=str(current_user.id)
    )
    return {"message": "Fatores globais aplicados aos kits vinculados"}

@router.put("/{id}/responsavel", response_model=SalesProposalResponse)
def change_responsavel(
    data: ChangeResponsavelRequest,
    id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return sales_proposal_service.change_responsavel(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        proposal_id=id,
        user_id=str(current_user.id),
        new_responsavel_id=data.responsavel_id
    )

@router.delete("/{id}")
def delete_proposal(
    id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    sales_proposal_service.delete_proposal(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        proposal_id=id,
        user_id=str(current_user.id)
    )
    return {"message": "Proposta excluída com sucesso"}

@router.post("/{id}/kits", response_model=SalesProposalKitResponse)
def add_kit_to_proposal(
    data: AddKitRequest,
    id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return sales_proposal_service.add_kit(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        proposal_id=id,
        user_id=str(current_user.id),
        kit_id=data.opportunity_kit_id
    )

@router.delete("/{id}/kits/{kit_id}")
def remove_kit_from_proposal(
    id: UUID = Path(...),
    kit_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    sales_proposal_service.remove_kit(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        proposal_id=id,
        user_id=str(current_user.id),
        kit_id=kit_id
    )
    return {"message": "Kit removido com sucesso"}

@router.post("/{id}/apply-factors-to-kits")
def apply_factors_to_kits(
    id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id: raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    sales_proposal_service.apply_factors_to_all_kits(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        proposal_id=id,
        user_id=str(current_user.id)
    )
    return {"message": "Fatores globais aplicados em todos os kits com sucesso"}
