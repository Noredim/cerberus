from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from .schemas import NcmOut, NcmCreate, NcmUpdate, NcmImportSchema, NcmImportResult, NcmPaginatedResponse
from .services.ncm_service import NcmService
from typing import List, Optional
from uuid import UUID
from src.modules.tax_benefits.schemas import TaxBenefitOut

router = APIRouter(prefix="/ncm", tags=["NCM"])

@router.get("/", response_model=NcmPaginatedResponse)
def list_ncm(
    skip: int = 0,
    limit: int = 100,
    codigo: Optional[str] = None,
    descricao: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NcmService(db)
    items, total = service.get_all(skip, limit, codigo, descricao, active_only)
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@router.get("/{ncm_id}", response_model=NcmOut)
def get_ncm(
    ncm_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NcmService(db)
    return service.get_by_id(ncm_id)

@router.post("/", response_model=NcmOut)
def create_ncm(
    payload: NcmCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NcmService(db)
    return service.create(payload)

@router.put("/{ncm_id}", response_model=NcmOut)
def update_ncm(
    ncm_id: UUID,
    payload: NcmUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NcmService(db)
    return service.update(ncm_id, payload)

@router.delete("/{ncm_id}")
def delete_ncm(
    ncm_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NcmService(db)
    service.delete(ncm_id)
    return {"message": "NCM excluído com sucesso."}

@router.post("/importar-json", response_model=NcmImportResult)
def import_ncm_json(
    payload: NcmImportSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NcmService(db)
    return service.import_json(payload)

@router.get("/check-benefits/{ncm_code}", response_model=List[TaxBenefitOut])
def get_ncm_benefits_by_code(
    ncm_code: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint para consultar benefícios vinculados a um código NCM específico.
    Utilizado para exibir tags informativas na tela de produtos.
    """
    service = NcmService(db)
    # Filtramos por tenant
    benefits = service.get_linked_benefits(ncm_code)
    # Garantir que apenas benefícios do mesmo tenant sejam retornados
    return [b for b in benefits if str(b.tenant_id) == str(current_user.tenant_id)]

@router.get("/{ncm_id}/benefits", response_model=List[TaxBenefitOut])
def get_ncm_benefits(
    ncm_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = NcmService(db)
    ncm = service.get_by_id(ncm_id)
    return service.get_linked_benefits(ncm.codigo)
