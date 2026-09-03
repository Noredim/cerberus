import os
import shutil
import uuid
from typing import Optional, List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, File, UploadFile
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.marketing.service import MarketingService
from src.modules.marketing.schemas import (
    CampaignCreate, CampaignUpdate, CampaignResponse, CampaignMetricsResponse,
    LandingPageCreate, LandingPageUpdate, LandingPageResponse,
    PublicLandingPageResponse, PublicSubmissionCreate, PublicSubmissionResponse,
    PublicEventCreate, SubmissionResponse
)
from src.modules.companies.models import Company

router = APIRouter(prefix="/marketing", tags=["Marketing"])


# ─── ROTAS PÚBLICAS (LANDING PAGES & CONVERSÃO) ───

@router.get("/public/resolve", response_model=PublicLandingPageResponse)
def resolve_public_landing_page(
    domain: Optional[str] = Query(None),
    slug: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Resolve uma Landing Page pública ativa pelo domínio customizado e/ou pelo slug.
    Usado tanto pela rota padrão /lp/:slug quanto por domínios/subdomínios personalizados.
    """
    lp = MarketingService.resolve_public_landing_page(db, domain=domain, slug=slug)

    campaign = lp.campaign
    company = db.query(Company).filter(Company.id == campaign.company_id).first() if campaign else None

    return PublicLandingPageResponse(
        id=lp.id,
        slug=lp.slug,
        custom_domain=lp.custom_domain,
        titulo=lp.titulo,
        subtitulo=lp.subtitulo,
        texto_cta=lp.texto_cta,
        url_imagem_banner=lp.url_imagem_banner,
        url_imagem_fundo=lp.url_imagem_fundo,
        url_video=lp.url_video,
        configuracao_formulario=lp.configuracao_formulario or {},
        configuracao_conteudo=lp.configuracao_conteudo or {},
        cor_primaria=lp.cor_primaria or "#1E40AF",
        cor_secundaria=lp.cor_secundaria or "#F59E0B",
        scripts_cabecalho=lp.scripts_cabecalho,
        scripts_rodape=lp.scripts_rodape,
        campaign_nome=campaign.nome if campaign else "Campanha",
        company_nome=company.nome_fantasia or company.razao_social if company else None,
        company_logo_url=company.logo_url if company else None
    )


@router.post("/public/submit", response_model=PublicSubmissionResponse)
def submit_public_landing_page(
    payload: PublicSubmissionCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Submissão pública do formulário da Landing Page.
    Cria automaticamente o Lead no Cerberus com distribuição Round Robin se a campanha tiver equipe vinculada.
    """
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    return MarketingService.process_public_submission(
        db=db,
        payload=payload,
        client_ip=client_ip,
        user_agent=user_agent
    )


@router.post("/public/track")
def track_public_event(
    payload: PublicEventCreate,
    db: Session = Depends(get_db)
):
    """
    Endpoint fire-and-forget para telemetria da LP (PAGE_VIEW, CTA_CLICK, VIDEO_PLAY, FORM_START).
    """
    MarketingService.record_public_event(db, payload)
    return {"ok": True}


# ─── ROTAS ADMINISTRATIVAS: CAMPANHAS ───

@router.post("/campaigns", response_model=CampaignResponse)
def create_campaign(
    data: CampaignCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    c = MarketingService.create_campaign(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        current_user_id=current_user.id,
        data=data
    )
    # Return enriched representation
    items = MarketingService.list_campaigns(db, current_user.tenant_id, UUID(company_id), search=c.nome)
    target = next((item for item in items if item["id"] == c.id), None)
    if target:
        return target
    return c


@router.get("/campaigns", response_model=List[CampaignResponse])
def list_campaigns(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    return MarketingService.list_campaigns(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        status=status,
        search=search
    )


@router.get("/campaigns/{campaign_id}", response_model=CampaignResponse)
def get_campaign(
    campaign_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    items = MarketingService.list_campaigns(db, current_user.tenant_id, UUID(company_id))
    target = next((item for item in items if item["id"] == campaign_id), None)
    if not target:
        raise HTTPException(404, "Campanha não encontrada")
    return target


@router.put("/campaigns/{campaign_id}", response_model=CampaignResponse)
def update_campaign(
    campaign_id: UUID,
    data: CampaignUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    MarketingService.update_campaign(db, campaign_id, data)
    items = MarketingService.list_campaigns(db, current_user.tenant_id, UUID(company_id))
    target = next((item for item in items if item["id"] == campaign_id), None)
    if not target:
        raise HTTPException(404, "Campanha não encontrada")
    return target


@router.delete("/campaigns/{campaign_id}")
def delete_campaign(
    campaign_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    MarketingService.delete_campaign(db, campaign_id)
    return {"message": "Campanha excluída com sucesso"}


@router.get("/campaigns/{campaign_id}/metrics", response_model=CampaignMetricsResponse)
def get_campaign_metrics(
    campaign_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return MarketingService.get_campaign_metrics(db, campaign_id)


@router.get("/campaigns/{campaign_id}/submissions", response_model=List[SubmissionResponse])
def get_campaign_submissions(
    campaign_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return MarketingService.list_submissions(db, campaign_id=campaign_id)


# ─── ROTAS ADMINISTRATIVAS: LANDING PAGES ───

@router.post("/landing-pages", response_model=LandingPageResponse)
def create_landing_page(
    data: LandingPageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lp = MarketingService.create_landing_page(db, current_user.tenant_id, data)
    items = MarketingService.list_landing_pages(db, current_user.tenant_id, campaign_id=lp.campaign_id)
    target = next((item for item in items if item["id"] == lp.id), None)
    if target:
        return target
    return lp


@router.get("/landing-pages", response_model=List[LandingPageResponse])
def list_landing_pages(
    campaign_id: Optional[UUID] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return MarketingService.list_landing_pages(db, current_user.tenant_id, campaign_id=campaign_id)


@router.get("/landing-pages/{lp_id}", response_model=LandingPageResponse)
def get_landing_page(
    lp_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items = MarketingService.list_landing_pages(db, current_user.tenant_id)
    target = next((item for item in items if item["id"] == lp_id), None)
    if not target:
        raise HTTPException(404, "Landing Page não encontrada")
    return target


@router.put("/landing-pages/{lp_id}", response_model=LandingPageResponse)
def update_landing_page(
    lp_id: UUID,
    data: LandingPageUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    lp = MarketingService.update_landing_page(db, lp_id, data)
    items = MarketingService.list_landing_pages(db, current_user.tenant_id)
    target = next((item for item in items if item["id"] == lp_id), None)
    if not target:
        raise HTTPException(404, "Landing Page não encontrada")
    return target


@router.delete("/landing-pages/{lp_id}")
def delete_landing_page(
    lp_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    MarketingService.delete_landing_page(db, lp_id)
    return {"message": "Landing Page excluída com sucesso"}


# ─── UPLOAD DE MÍDIA (BANNERS, VÍDEOS, FUNDOS) ───

@router.post("/upload-media")
async def upload_marketing_media(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    allowed_types = [
        "image/jpeg", "image/png", "image/webp", "image/svg+xml",
        "video/mp4", "video/webm"
    ]
    if file.content_type not in allowed_types:
        raise HTTPException(400, "Formato não suportado. Use JPG, PNG, WEBP, SVG ou MP4.")

    upload_dir = "uploads/marketing"
    os.makedirs(upload_dir, exist_ok=True)

    file_ext = file.filename.split(".")[-1].lower()
    filename = f"{uuid.uuid4().hex}.{file_ext}"
    filepath = os.path.join(upload_dir, filename)

    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "url": f"/uploads/marketing/{filename}",
        "filename": filename,
        "content_type": file.content_type
    }
