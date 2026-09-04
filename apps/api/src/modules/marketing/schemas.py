from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from decimal import Decimal


# ─── CAMPANHAS ───

class CampaignBase(BaseModel):
    nome: str = Field(..., max_length=255)
    descricao: Optional[str] = None
    status: str = Field(default="RASCUNHO")  # RASCUNHO, ATIVA, PAUSADA, ENCERRADA
    canal_origem: Optional[str] = "META_ADS"
    orcamento_total: Optional[Decimal] = None
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None
    sales_team_id: Optional[UUID] = None


class CampaignCreate(CampaignBase):
    pass


class CampaignUpdate(BaseModel):
    nome: Optional[str] = None
    descricao: Optional[str] = None
    status: Optional[str] = None
    canal_origem: Optional[str] = None
    orcamento_total: Optional[Decimal] = None
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None
    sales_team_id: Optional[UUID] = None


class CampaignResponse(CampaignBase):
    id: UUID
    tenant_id: str
    company_id: UUID
    created_by_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sales_team_nome: Optional[str] = None
    landing_pages_count: int = 0
    leads_count: int = 0
    views_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ─── LANDING PAGES ───

class LandingPageBase(BaseModel):
    slug: str = Field(..., max_length=100)
    custom_domain: Optional[str] = Field(None, max_length=255)
    is_default_for_domain: bool = False
    titulo: str = Field(..., max_length=255)
    subtitulo: Optional[str] = None
    texto_cta: str = Field(default="Quero uma Proposta Personalizada", max_length=100)
    url_imagem_banner: Optional[str] = None
    url_imagem_fundo: Optional[str] = None
    url_video: Optional[str] = None
    configuracao_formulario: Dict[str, Any] = Field(default_factory=lambda: {
        "campos": ["nome", "telefone", "email", "cidade", "mensagem"],
        "obrigatorios": ["nome", "telefone"]
    })
    configuracao_conteudo: Dict[str, Any] = Field(default_factory=lambda: {
        "beneficios": [],
        "faq": []
    })
    cor_primaria: str = Field(default="#1E40AF", max_length=20)
    cor_secundaria: str = Field(default="#F59E0B", max_length=20)
    scripts_cabecalho: Optional[str] = None
    scripts_rodape: Optional[str] = None
    ativo: bool = True


class LandingPageCreate(LandingPageBase):
    campaign_id: UUID


class LandingPageUpdate(BaseModel):
    slug: Optional[str] = None
    custom_domain: Optional[str] = None
    is_default_for_domain: Optional[bool] = None
    titulo: Optional[str] = None
    subtitulo: Optional[str] = None
    texto_cta: Optional[str] = None
    url_imagem_banner: Optional[str] = None
    url_imagem_fundo: Optional[str] = None
    url_video: Optional[str] = None
    configuracao_formulario: Optional[Dict[str, Any]] = None
    configuracao_conteudo: Optional[Dict[str, Any]] = None
    cor_primaria: Optional[str] = None
    cor_secundaria: Optional[str] = None
    scripts_cabecalho: Optional[str] = None
    scripts_rodape: Optional[str] = None
    ativo: Optional[bool] = None


class LandingPageResponse(LandingPageBase):
    id: UUID
    tenant_id: str
    campaign_id: UUID
    campaign_nome: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    submissions_count: int = 0
    views_count: int = 0

    model_config = ConfigDict(from_attributes=True)


# ─── PÚBLICO (LANDING PAGE RENDER & CONVERSÃO) ───

class PublicLandingPageResponse(BaseModel):
    id: UUID
    slug: str
    custom_domain: Optional[str] = None
    titulo: str
    subtitulo: Optional[str] = None
    texto_cta: str
    url_imagem_banner: Optional[str] = None
    url_imagem_fundo: Optional[str] = None
    url_video: Optional[str] = None
    configuracao_formulario: Dict[str, Any]
    configuracao_conteudo: Dict[str, Any]
    cor_primaria: str
    cor_secundaria: str
    scripts_cabecalho: Optional[str] = None
    scripts_rodape: Optional[str] = None
    campaign_nome: str
    company_nome: Optional[str] = None
    company_logo_url: Optional[str] = None
    url_logo: Optional[str] = None
    nome_empresa: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PublicSubmissionCreate(BaseModel):
    landing_page_id: UUID
    dados_formulario: Dict[str, Any]
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    utm_term: Optional[str] = None
    referrer: Optional[str] = None
    session_id: Optional[str] = None
    honeypot: Optional[str] = None  # Anti-spam: se preenchido, rejeitar silenciosamente


class PublicSubmissionResponse(BaseModel):
    success: bool
    message: str
    lead_created: bool


class PublicEventCreate(BaseModel):
    landing_page_id: UUID
    session_id: Optional[str] = None
    event_type: str  # PAGE_VIEW, VIDEO_PLAY, CTA_CLICK, FORM_START, FORM_SUBMIT
    metadata: Optional[Dict[str, Any]] = None


# ─── SUBMISSÕES & MÉTRICAS ───

class SubmissionResponse(BaseModel):
    id: UUID
    landing_page_id: UUID
    campaign_id: UUID
    lead_id: Optional[UUID] = None
    dados_formulario: Dict[str, Any]
    utm_source: Optional[str] = None
    utm_medium: Optional[str] = None
    utm_campaign: Optional[str] = None
    utm_content: Optional[str] = None
    utm_term: Optional[str] = None
    referrer: Optional[str] = None
    status: str
    created_at: datetime
    lead_nome: Optional[str] = None
    lead_status: Optional[str] = None
    vendedor_nome: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class CampaignMetricsResponse(BaseModel):
    campaign_id: UUID
    campaign_nome: str
    status: str
    total_views: int
    total_cta_clicks: int
    total_form_starts: int
    total_submissions: int
    conversion_rate: float
    leads_generated: int
    top_utm_sources: List[Dict[str, Any]]
