from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, List
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company, check_not_engenharia_preco
from src.modules.users.models import User
from src.modules.document_templates import service
from src.modules.document_templates.schemas import (
    TemplateCreate, TemplateUpdate, TemplateOut, DocumentRenderRequest
)

router = APIRouter(
    prefix="/document-templates", 
    tags=["Document Templates"],
    dependencies=[Depends(check_not_engenharia_preco)]
)


@router.get("/variables-catalog")
def get_variables_catalog(
    current_user: User = Depends(get_current_user)
):
    return service.VARIABLES_CATALOG


@router.get("", response_model=List[TemplateOut])
def list_templates(
    status: Optional[str] = Query(None),
    modulo: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return service.list_templates(db, current_user.tenant_id, company_id, status, modulo, tipo)


@router.get("/{template_id}", response_model=TemplateOut)
def get_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    template = service.get_template(db, current_user.tenant_id, company_id, str(template_id))
    if not template:
        raise HTTPException(status_code=404, detail="Modelo de documento não encontrado")
    return template


@router.post("", response_model=TemplateOut)
def create_template(
    data: TemplateCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    try:
        return service.create_template(db, current_user.tenant_id, company_id, data, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{template_id}", response_model=TemplateOut)
def update_template(
    template_id: UUID,
    data: TemplateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    try:
        template = service.update_template(db, current_user.tenant_id, company_id, str(template_id), data, current_user.id)
        if not template:
            raise HTTPException(status_code=404, detail="Modelo de documento não encontrado")
        return template
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{template_id}/duplicate", response_model=TemplateOut)
def duplicate_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    clone = service.duplicate_template(db, current_user.tenant_id, company_id, str(template_id), current_user.id)
    if not clone:
        raise HTTPException(status_code=404, detail="Modelo de documento não encontrado")
    return clone


@router.post("/{template_id}/publish", response_model=TemplateOut)
def publish_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    template = service.publish_template(db, current_user.tenant_id, company_id, str(template_id), current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Modelo de documento não encontrado")
    return template


@router.post("/{template_id}/deactivate", response_model=TemplateOut)
def deactivate_template(
    template_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    template = service.deactivate_template(db, current_user.tenant_id, company_id, str(template_id), current_user.id)
    if not template:
        raise HTTPException(status_code=404, detail="Modelo de documento não encontrado")
    return template


@router.post("/{template_id}/render")
def render_template(
    template_id: UUID,
    request: DocumentRenderRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    try:
        rendered_html = service.render_template(db, current_user.tenant_id, company_id, str(template_id), request, current_user.id)
        return {"html": rendered_html}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
