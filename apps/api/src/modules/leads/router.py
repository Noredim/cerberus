from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, List

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.leads import service
from src.modules.leads.schemas import (
    LeadCreate, LeadUpdate, LeadRejectRequest, LeadLossRequest, LeadConvertRequest,
    LeadTimelineCreate, LeadTaskCreate, LeadTaskUpdate, LeadQueueOrderUpdate,
    LeadQueueToggleActive, LeadSimpleResponse, LeadDetailResponse, LeadMetricsResponse,
    LeadTimelineResponse, LeadTaskResponse, LeadQueueMemberResponse
)

router = APIRouter(prefix="/leads", tags=["Leads"])


@router.get("/metrics", response_model=LeadMetricsResponse)
def get_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.get_lead_metrics(db, current_user.tenant_id, UUID(company_id), current_user)


@router.get("", response_model=List[LeadSimpleResponse])
def list_leads(
    tab: Optional[str] = Query(None, description="meus | aguardando | equipe | todos"),
    status: Optional[str] = Query(None),
    origem: Optional[str] = Query(None),
    sales_team_id: Optional[UUID] = Query(None),
    q: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    leads, _ = service.list_leads(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user,
        tab=tab,
        status=status,
        origem=origem,
        sales_team_id=sales_team_id,
        q=q,
        skip=skip,
        limit=limit
    )
    return leads


@router.post("", response_model=LeadSimpleResponse)
def create_lead(
    data: LeadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    lead = service.create_lead(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user,
        data=data
    )
    now = service.datetime.now(service.timezone.utc)
    return service._enrich_lead_response(lead, now)


# ─── Queue Management ───

@router.get("/queue/{sales_team_id}", response_model=List[LeadQueueMemberResponse])
def get_team_queue(
    sales_team_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.list_queue_members(db, current_user.tenant_id, UUID(company_id), sales_team_id)


@router.put("/queue/{sales_team_id}/order")
def reorder_team_queue(
    sales_team_id: UUID,
    data: LeadQueueOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    service.update_queue_order(db, sales_team_id, data)
    return {"message": "Ordem da fila atualizada com sucesso"}


@router.put("/queue/members/{member_id}/toggle-active")
def toggle_queue_member(
    member_id: UUID,
    data: LeadQueueToggleActive,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    service.toggle_queue_member_active(db, member_id, data.ativo)
    return {"message": "Status do membro atualizado na fila"}


# ─── Lead Details & Actions ───

@router.get("/{lead_id}", response_model=LeadDetailResponse)
def get_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.get_lead(
        db=db,
        lead_id=lead_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user
    )


@router.put("/{lead_id}", response_model=LeadSimpleResponse)
def update_lead(
    lead_id: UUID,
    data: LeadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    lead = service.update_lead(
        db=db,
        lead_id=lead_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user,
        data=data
    )
    now = service.datetime.now(service.timezone.utc)
    return service._enrich_lead_response(lead, now)


@router.post("/{lead_id}/accept", response_model=LeadSimpleResponse)
def accept_lead(
    lead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.accept_lead(
        db=db,
        lead_id=lead_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user
    )


@router.post("/{lead_id}/reject", response_model=LeadSimpleResponse)
def reject_lead(
    lead_id: UUID,
    data: LeadRejectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.reject_lead(
        db=db,
        lead_id=lead_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user,
        data=data
    )


@router.post("/{lead_id}/loss", response_model=LeadSimpleResponse)
def mark_loss(
    lead_id: UUID,
    data: LeadLossRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.mark_lead_lost(
        db=db,
        lead_id=lead_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user,
        data=data
    )


@router.post("/{lead_id}/convert")
def convert_to_opportunity(
    lead_id: UUID,
    data: LeadConvertRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.convert_lead_to_opportunity(
        db=db,
        lead_id=lead_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user,
        data=data
    )


# ─── Timeline & Tasks ───

@router.post("/{lead_id}/timeline", response_model=LeadTimelineResponse)
def add_timeline_entry(
    lead_id: UUID,
    data: LeadTimelineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.add_timeline_entry(
        db=db,
        lead_id=lead_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user,
        data=data
    )


@router.post("/{lead_id}/tasks", response_model=LeadTaskResponse)
def schedule_task(
    lead_id: UUID,
    data: LeadTaskCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.create_task(
        db=db,
        lead_id=lead_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user,
        data=data
    )


@router.put("/tasks/{task_id}", response_model=LeadTaskResponse)
def update_task(
    task_id: UUID,
    data: LeadTaskUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return service.update_task(
        db=db,
        task_id=task_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user,
        data=data
    )


@router.delete("/tasks/{task_id}")
def delete_task(
    task_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    success = service.delete_task(
        db=db,
        task_id=task_id,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user=current_user
    )
    return {"success": success, "message": "Tarefa excluída com sucesso."}
