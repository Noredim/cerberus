"""add_papel_timbrado_table

Revision ID: f1e2d3c4b5a6
Revises: f9e8d7c6b5a4
Create Date: 2026-08-12 16:42:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f1e2d3c4b5a6'
down_revision = 'f9e8d7c6b5a4'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS papel_timbrado (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        nome VARCHAR(255) NOT NULL,
        descricao TEXT,
        conteudo_html TEXT NOT NULL,
        conteudo_css TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ix_papel_timbrado_tenant_id ON papel_timbrado(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_papel_timbrado_company_id ON papel_timbrado(company_id);

    ALTER TABLE documento_modelo 
    ADD COLUMN IF NOT EXISTS papel_timbrado_id UUID REFERENCES papel_timbrado(id) ON DELETE SET NULL;

    CREATE INDEX IF NOT EXISTS ix_documento_modelo_papel_timbrado_id ON documento_modelo(papel_timbrado_id);
    """)


def downgrade():
    op.execute("""
    ALTER TABLE documento_modelo DROP COLUMN IF EXISTS papel_timbrado_id;
    DROP TABLE IF EXISTS papel_timbrado CASCADE;
    """)
