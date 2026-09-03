"""add_marketing_module_tables

Revision ID: a1b2c3d4e5f8
Revises: f2a3b4c5d6e7
Create Date: 2026-09-03 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f8'
down_revision = 'f2a3b4c5d6e7'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Campanhas de Marketing
    op.execute("""
    CREATE TABLE IF NOT EXISTS marketing_campaigns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        sales_team_id UUID REFERENCES company_sales_teams(id) ON DELETE SET NULL,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        status VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO',
        canal_origem VARCHAR(100) DEFAULT 'META_ADS',
        orcamento_total NUMERIC(15, 2),
        data_inicio TIMESTAMP WITH TIME ZONE,
        data_fim TIMESTAMP WITH TIME ZONE,
        created_by_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_marketing_campaigns_tenant_id ON marketing_campaigns(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_campaigns_company_id ON marketing_campaigns(company_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_campaigns_sales_team_id ON marketing_campaigns(sales_team_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_campaigns_status ON marketing_campaigns(status);
    """)

    # 2. Landing Pages (com suporte a multi-domínio e slug)
    op.execute("""
    CREATE TABLE IF NOT EXISTS marketing_landing_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
        slug VARCHAR(100) NOT NULL,
        custom_domain VARCHAR(255),
        is_default_for_domain BOOLEAN NOT NULL DEFAULT FALSE,
        titulo VARCHAR(255) NOT NULL,
        subtitulo TEXT,
        texto_cta VARCHAR(100) NOT NULL DEFAULT 'Quero uma Proposta Personalizada',
        url_imagem_banner VARCHAR(500),
        url_imagem_fundo VARCHAR(500),
        url_video VARCHAR(500),
        configuracao_formulario JSONB NOT NULL DEFAULT '{"campos": ["nome", "telefone", "email", "cidade", "mensagem"], "obrigatorios": ["nome", "telefone"]}'::jsonb,
        configuracao_conteudo JSONB NOT NULL DEFAULT '{"beneficios": [], "faq": []}'::jsonb,
        cor_primaria VARCHAR(20) NOT NULL DEFAULT '#1E40AF',
        cor_secundaria VARCHAR(20) NOT NULL DEFAULT '#F59E0B',
        scripts_cabecalho TEXT,
        scripts_rodape TEXT,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_mkt_lp_tenant_slug UNIQUE (tenant_id, slug)
    );
    CREATE INDEX IF NOT EXISTS ix_marketing_landing_pages_tenant_id ON marketing_landing_pages(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_landing_pages_campaign_id ON marketing_landing_pages(campaign_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_landing_pages_slug ON marketing_landing_pages(slug);
    CREATE INDEX IF NOT EXISTS ix_marketing_landing_pages_custom_domain ON marketing_landing_pages(custom_domain);
    """)

    # 3. Submissões de Formulário da Landing Page
    op.execute("""
    CREATE TABLE IF NOT EXISTS marketing_submissions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        landing_page_id UUID NOT NULL REFERENCES marketing_landing_pages(id) ON DELETE CASCADE,
        campaign_id UUID NOT NULL REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
        lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
        dados_formulario JSONB NOT NULL,
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100),
        utm_content VARCHAR(100),
        utm_term VARCHAR(100),
        referrer VARCHAR(500),
        ip_address_hash VARCHAR(64),
        user_agent VARCHAR(500),
        status VARCHAR(30) NOT NULL DEFAULT 'CONVERTIDO',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_marketing_submissions_tenant_id ON marketing_submissions(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_submissions_landing_page_id ON marketing_submissions(landing_page_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_submissions_campaign_id ON marketing_submissions(campaign_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_submissions_lead_id ON marketing_submissions(lead_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_submissions_created_at ON marketing_submissions(created_at);
    """)

    # 4. Telemetria e Eventos de Acesso
    op.execute("""
    CREATE TABLE IF NOT EXISTS marketing_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        landing_page_id UUID NOT NULL REFERENCES marketing_landing_pages(id) ON DELETE CASCADE,
        session_id VARCHAR(64),
        event_type VARCHAR(50) NOT NULL,
        metadata JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_marketing_events_landing_page_id ON marketing_events(landing_page_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_events_session_id ON marketing_events(session_id);
    CREATE INDEX IF NOT EXISTS ix_marketing_events_event_type ON marketing_events(event_type);
    CREATE INDEX IF NOT EXISTS ix_marketing_events_created_at ON marketing_events(created_at);
    """)


def downgrade():
    op.execute("""
    DROP TABLE IF EXISTS marketing_events CASCADE;
    DROP TABLE IF EXISTS marketing_submissions CASCADE;
    DROP TABLE IF EXISTS marketing_landing_pages CASCADE;
    DROP TABLE IF EXISTS marketing_campaigns CASCADE;
    """)
