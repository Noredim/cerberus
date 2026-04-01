from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.opportunity_kits.schemas import (
    OpportunityKitCreate, OpportunityKitUpdate, OpportunityKitResponse, OpportunityKitFinancialSummary
)
from src.modules.opportunity_kits.service import OpportunityKitService

router = APIRouter(prefix="/opportunity-kits", tags=["Opportunity Kits"])

@router.get("/company/{company_id}", response_model=List[OpportunityKitResponse])
def list_kits_by_company(
    company_id: UUID,
    sales_budget_id: Optional[UUID] = None,
    tipo_contrato: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = OpportunityKitService(db)
    return service.list_kits(
        current_user.tenant_id, 
        str(company_id), 
        str(sales_budget_id) if sales_budget_id else None,
        tipo_contrato
    )
@router.get("/{kit_id}", response_model=OpportunityKitResponse)
def get_kit(
    kit_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = OpportunityKitService(db)
    kit = service.get_kit(str(kit_id), current_user.tenant_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit não encontrado")
    return kit

@router.post("/company/{company_id}", response_model=OpportunityKitResponse)
def create_kit(
    company_id: UUID,
    data: OpportunityKitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = OpportunityKitService(db)
    try:
        return service.create_kit(current_user.tenant_id, str(company_id), data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{kit_id}", response_model=OpportunityKitResponse)
@router.patch("/{kit_id}", response_model=OpportunityKitResponse)
def update_kit(
    kit_id: UUID,
    data: OpportunityKitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = OpportunityKitService(db)
    try:
        kit = service.update_kit(str(kit_id), current_user.tenant_id, data)
        if not kit:
            raise HTTPException(status_code=404, detail="Kit não encontrado")
        return kit
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/preview")
def preview_kit_financials(
    data: OpportunityKitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    service = OpportunityKitService(db)
    return service.recalculate_kit_preview(current_user.tenant_id, str(company_id), data)

