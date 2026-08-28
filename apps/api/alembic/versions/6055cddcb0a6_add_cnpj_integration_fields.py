"""Add CNPJ integration fields

Revision ID: 6055cddcb0a6
Revises: 3d7c3b9e4a12
Create Date: 2026-03-06 17:06:15.825034

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '6055cddcb0a6'
down_revision: Union[str, Sequence[str], None] = '3d7c3b9e4a12'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS companies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            status VARCHAR(50) DEFAULT 'ATIVA',
            tipo VARCHAR(50) DEFAULT 'MATRIZ',
            cnpj VARCHAR(14) NOT NULL,
            razao_social VARCHAR(255) NOT NULL,
            nome_fantasia VARCHAR(255),
            natureza_juridica_codigo VARCHAR(10),
            natureza_juridica_descricao VARCHAR(255),
            data_abertura DATE,
            situacao_cadastral VARCHAR(100),
            porte VARCHAR(100),
            capital_social NUMERIC(15, 2),
            email VARCHAR(255),
            telefone VARCHAR(50),
            logradouro VARCHAR(255),
            numero VARCHAR(50),
            complemento VARCHAR(255),
            bairro VARCHAR(255),
            cep VARCHAR(20),
            municipality_id VARCHAR,
            state_id VARCHAR,
            logo_url VARCHAR(500),
            origem_dados_cnpj VARCHAR(50) DEFAULT 'INTEGRACAO',
            cnpj_snapshot_json JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS cnae_catalog (
            cnae_codigo VARCHAR(20) PRIMARY KEY,
            descricao VARCHAR NOT NULL,
            versao VARCHAR(50) DEFAULT '2.0',
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS company_cnaes (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            cnae_codigo VARCHAR(20) NOT NULL,
            tipo VARCHAR(20) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS company_tax_profiles (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            vigencia_inicio DATE NOT NULL,
            vigencia_fim DATE,
            regime_tributario VARCHAR(50) NOT NULL,
            contribuinte_icms BOOLEAN DEFAULT FALSE,
            contribuinte_iss BOOLEAN DEFAULT TRUE,
            inscricao_estadual VARCHAR(50),
            inscricao_municipal VARCHAR(50),
            regime_iss VARCHAR(50) DEFAULT 'FIXO',
            regime_icms VARCHAR(50) DEFAULT 'NAO_APLICA',
            perfil_tarifario_st BOOLEAN DEFAULT TRUE,
            observacoes VARCHAR,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS tax_benefits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            nome VARCHAR(255) NOT NULL,
            descricao VARCHAR,
            esfera VARCHAR(50) NOT NULL,
            tributo_alvo VARCHAR(50) NOT NULL,
            tipo_beneficio VARCHAR(100) NOT NULL,
            regra_json JSONB NOT NULL,
            requer_habilitacao BOOLEAN DEFAULT FALSE,
            documento_base VARCHAR(255),
            ativo BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS company_benefits (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            benefit_id UUID NOT NULL REFERENCES tax_benefits(id) ON DELETE CASCADE,
            vigencia_inicio DATE NOT NULL,
            vigencia_fim DATE,
            prioridade INTEGER DEFAULT 100,
            status VARCHAR(50) DEFAULT 'ATIVO',
            observacao VARCHAR,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
    """))

    op.create_table('cnpj_query_cache',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('cnpj', sa.String(length=14), nullable=False),
    sa.Column('provider', sa.String(length=50), nullable=False),
    sa.Column('response_body_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('mapped_body_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('fetched_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('hash_resposta', sa.String(length=255), nullable=True),
    sa.Column('status', sa.String(length=50), nullable=True),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_cnpj_query_cache_cnpj'), 'cnpj_query_cache', ['cnpj'], unique=False)
    op.create_table('company_cnpj_query_logs',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tenant_id', sa.String(), nullable=False),
    sa.Column('company_id', sa.UUID(), nullable=True),
    sa.Column('cnpj_consultado', sa.String(length=14), nullable=False),
    sa.Column('provider', sa.String(length=50), nullable=False),
    sa.Column('http_status', sa.Integer(), nullable=True),
    sa.Column('provider_status', sa.String(length=50), nullable=True),
    sa.Column('response_time_ms', sa.Integer(), nullable=True),
    sa.Column('from_cache', sa.Boolean(), nullable=True),
    sa.Column('response_body_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('mapped_body_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('consulted_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('consulted_by_user_id', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('company_qsa',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('company_id', sa.UUID(), nullable=False),
    sa.Column('nome', sa.String(length=255), nullable=False),
    sa.Column('qualificacao', sa.String(length=255), nullable=True),
    sa.Column('pais_origem', sa.String(length=255), nullable=True),
    sa.Column('nome_rep_legal', sa.String(length=255), nullable=True),
    sa.Column('qualificacao_rep_legal', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    conn.execute(sa.text("ALTER TABLE cnae_catalog ALTER COLUMN descricao TYPE VARCHAR;"))

    conn.execute(sa.text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj_consultado_em TIMESTAMP WITH TIME ZONE;"))
    conn.execute(sa.text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj_consulta_origem VARCHAR(50);"))
    conn.execute(sa.text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj_json_ultimo_retorno JSONB;"))
    conn.execute(sa.text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj_status_ultima_consulta VARCHAR(50);"))
    conn.execute(sa.text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS cnpj_mensagem_ultima_consulta VARCHAR(255);"))

    conn.execute(sa.text("DROP INDEX IF EXISTS idx_companies_tenant_cnpj;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_company_cnaes_primary;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_company_cnaes_unique;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_tax_profiles_active;"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('company_qsa')
    op.drop_table('company_cnpj_query_logs')
    op.drop_index(op.f('ix_cnpj_query_cache_cnpj'), table_name='cnpj_query_cache')
    op.drop_table('cnpj_query_cache')
