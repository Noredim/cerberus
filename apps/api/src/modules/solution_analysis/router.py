from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.solution_analysis.schemas import (
    SolutionAnalysisCreate,
    SolutionAnalysisUpdate,
    SolutionAnalysisResponse,
    SolutionAnalysisItemCreate,
    SolutionAnalysisItemResponse,
    SolutionAnalysisSummary,
)
from src.modules.solution_analysis.service import SolutionAnalysisService

router = APIRouter(prefix="/solution-analysis", tags=["Solution Analysis"])


@router.get("", response_model=List[SolutionAnalysisSummary])
def list_analyses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    service = SolutionAnalysisService(db)
    return service.list_analyses(current_user.tenant_id, company_id)


@router.post("", response_model=SolutionAnalysisResponse, status_code=201)
def create_analysis(
    data: SolutionAnalysisCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    service = SolutionAnalysisService(db)
    try:
        return service.create_analysis(current_user.tenant_id, company_id, data, current_user)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.get("/{analise_id}", response_model=SolutionAnalysisResponse)
def get_analysis(
    analise_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    analise = service.get_analysis(str(analise_id), current_user.tenant_id)
    if not analise:
        raise HTTPException(status_code=404, detail="Análise não encontrada")
    return analise


@router.put("/{analise_id}", response_model=SolutionAnalysisResponse)
@router.patch("/{analise_id}", response_model=SolutionAnalysisResponse)
def update_analysis(
    analise_id: UUID,
    data: SolutionAnalysisUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    try:
        analise = service.update_analysis(str(analise_id), current_user.tenant_id, data, current_user)
        if not analise:
            raise HTTPException(status_code=404, detail="Análise não encontrada")
        return analise
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{analise_id}", status_code=204)
def delete_analysis(
    analise_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    try:
        deleted = service.delete_analysis(str(analise_id), current_user.tenant_id, current_user)
        if not deleted:
            raise HTTPException(status_code=404, detail="Análise não encontrada")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/{analise_id}/items", response_model=SolutionAnalysisItemResponse, status_code=201)
def add_item(
    analise_id: UUID,
    data: SolutionAnalysisItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    try:
        return service.add_item(str(analise_id), current_user.tenant_id, data, current_user)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


@router.delete("/{analise_id}/items/{item_id}", status_code=204)
def delete_item(
    analise_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    service = SolutionAnalysisService(db)
    try:
        deleted = service.delete_item(str(analise_id), str(item_id), current_user.tenant_id, current_user)
        if not deleted:
            raise HTTPException(status_code=404, detail="Item não encontrado")
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
