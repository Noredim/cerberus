import os
import shutil
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, File, UploadFile
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, List
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company, check_not_engenharia_preco
from src.modules.users.models import User
from src.modules.document_templates import service
from src.modules.document_templates.schemas import (
    TemplateCreate, TemplateUpdate, TemplateOut, DocumentRenderRequest,
    LetterheadCreate, LetterheadUpdate, LetterheadOut, LetterheadPreviewRequest
)

router = APIRouter(
    prefix="/document-templates", 
    tags=["Document Templates"],
    dependencies=[Depends(check_not_engenharia_preco)]
)


# --- LETTERHEADS (PAPÉIS TIMBRADOS) ---

@router.post("/letterheads/upload-image")
async def upload_letterhead_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")

    allowed_extensions = {".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Formato de imagem não suportado. Utilize PNG, JPG, WEBP ou SVG.")

    upload_dir = "uploads/letterheads"
    os.makedirs(upload_dir, exist_ok=True)

    filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    url = f"/uploads/letterheads/{filename}"
    return {"url": url, "filename": file.filename}

@router.get("/letterheads", response_model=List[LetterheadOut])
def list_letterheads(
    is_active: Optional[bool] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return service.list_letterheads(db, current_user.tenant_id, company_id, is_active, search)


@router.post("/letterheads", response_model=LetterheadOut)
def create_letterhead(
    data: LetterheadCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    return service.create_letterhead(db, current_user.tenant_id, company_id, data)


@router.post("/letterheads/preview")
def preview_letterhead(
    data: LetterheadPreviewRequest,
    current_user: User = Depends(get_current_user)
):
    rendered_html = service.preview_letterhead(data)
    return {"html": rendered_html}


@router.get("/letterheads/{letterhead_id}", response_model=LetterheadOut)
def get_letterhead(
    letterhead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    lh = service.get_letterhead(db, current_user.tenant_id, company_id, str(letterhead_id))
    if not lh:
        raise HTTPException(status_code=404, detail="Papel Timbrado não encontrado")
    return lh


@router.put("/letterheads/{letterhead_id}", response_model=LetterheadOut)
def update_letterhead(
    letterhead_id: UUID,
    data: LetterheadUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    lh = service.update_letterhead(db, current_user.tenant_id, company_id, str(letterhead_id), data)
    if not lh:
        raise HTTPException(status_code=404, detail="Papel Timbrado não encontrado")
    return lh


@router.delete("/letterheads/{letterhead_id}")
def delete_letterhead(
    letterhead_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header obrigatório")
    success = service.delete_letterhead(db, current_user.tenant_id, company_id, str(letterhead_id))
    if not success:
        raise HTTPException(status_code=404, detail="Papel Timbrado não encontrado")
    return {"success": True, "message": "Papel Timbrado removido com sucesso"}


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
