import uuid
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, DateTime, ForeignKey, Numeric, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from src.core.base import Base


class MarketingCampaign(Base):
    __tablename__ = "marketing_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_team_id = Column(UUID(as_uuid=True), ForeignKey("company_sales_teams.id", ondelete="SET NULL"), nullable=True, index=True)

    nome = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="RASCUNHO", index=True)  # RASCUNHO, ATIVA, PAUSADA, ENCERRADA
    canal_origem = Column(String(100), default="META_ADS")  # META_ADS, GOOGLE_ADS, ORGANICO, EMAIL, OUTROS
    orcamento_total = Column(Numeric(15, 2), nullable=True)
    data_inicio = Column(DateTime(timezone=True), nullable=True)
    data_fim = Column(DateTime(timezone=True), nullable=True)

    created_by_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    sales_team = relationship("SalesTeam")
    landing_pages = relationship("MarketingLandingPage", back_populates="campaign", cascade="all, delete-orphan")
    submissions = relationship("MarketingSubmission", back_populates="campaign", cascade="all, delete-orphan")


class MarketingLandingPage(Base):
    __tablename__ = "marketing_landing_pages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("marketing_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)

    slug = Column(String(100), nullable=False, index=True)
    custom_domain = Column(String(255), nullable=True, index=True)
    is_default_for_domain = Column(Boolean, default=False, nullable=False)

    titulo = Column(String(255), nullable=False)
    subtitulo = Column(Text, nullable=True)
    texto_cta = Column(String(100), default="Quero uma Proposta Personalizada", nullable=False)
    url_imagem_banner = Column(String(500), nullable=True)
    url_imagem_fundo = Column(String(500), nullable=True)
    url_video = Column(String(500), nullable=True)

    configuracao_formulario = Column(JSONB, nullable=False, default=lambda: {
        "campos": ["nome", "telefone", "email", "cidade", "mensagem"],
        "obrigatorios": ["nome", "telefone"]
    })
    configuracao_conteudo = Column(JSONB, nullable=False, default=lambda: {
        "beneficios": [],
        "faq": []
    })

    cor_primaria = Column(String(20), default="#1E40AF", nullable=False)
    cor_secundaria = Column(String(20), default="#F59E0B", nullable=False)
    scripts_cabecalho = Column(Text, nullable=True)
    scripts_rodape = Column(Text, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("tenant_id", "slug", name="uq_mkt_lp_tenant_slug"),
    )

    # Relationships
    campaign = relationship("MarketingCampaign", back_populates="landing_pages")
    submissions = relationship("MarketingSubmission", back_populates="landing_page", cascade="all, delete-orphan")
    events = relationship("MarketingEvent", back_populates="landing_page", cascade="all, delete-orphan")


class MarketingSubmission(Base):
    __tablename__ = "marketing_submissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    landing_page_id = Column(UUID(as_uuid=True), ForeignKey("marketing_landing_pages.id", ondelete="CASCADE"), nullable=False, index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("marketing_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)

    dados_formulario = Column(JSONB, nullable=False)
    utm_source = Column(String(100), nullable=True)
    utm_medium = Column(String(100), nullable=True)
    utm_campaign = Column(String(100), nullable=True)
    utm_content = Column(String(100), nullable=True)
    utm_term = Column(String(100), nullable=True)
    referrer = Column(String(500), nullable=True)
    ip_address_hash = Column(String(64), nullable=True)
    user_agent = Column(String(500), nullable=True)
    status = Column(String(30), default="CONVERTIDO", nullable=False)  # CONVERTIDO, SPAM_BLOQUEADO, ERRO_LEAD

    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False, index=True)

    # Relationships
    campaign = relationship("MarketingCampaign", back_populates="submissions")
    landing_page = relationship("MarketingLandingPage", back_populates="submissions")
    lead = relationship("Lead")


class MarketingEvent(Base):
    __tablename__ = "marketing_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    landing_page_id = Column(UUID(as_uuid=True), ForeignKey("marketing_landing_pages.id", ondelete="CASCADE"), nullable=False, index=True)
    session_id = Column(String(64), nullable=True, index=True)
    event_type = Column(String(50), nullable=False, index=True)  # PAGE_VIEW, VIDEO_PLAY, CTA_CLICK, FORM_START, FORM_SUBMIT
    metadata_ = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False, index=True)

    # Relationships
    landing_page = relationship("MarketingLandingPage", back_populates="events")
