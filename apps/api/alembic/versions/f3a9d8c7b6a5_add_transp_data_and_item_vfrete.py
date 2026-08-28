"""add transp_data and item vfrete

Revision ID: f3a9d8c7b6a5
Revises: a8f9e0b1c2d3
Create Date: 2026-08-28 12:25:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'f3a9d8c7b6a5'
down_revision = 'a8f9e0b1c2d3'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    conn.execute(sa.text('ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS transp_data JSONB;'))
    conn.execute(sa.text('ALTER TABLE fiscal_document_items ADD COLUMN IF NOT EXISTS "vFrete" numeric(19,4) DEFAULT 0;'))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text('ALTER TABLE fiscal_document_items DROP COLUMN IF EXISTS "vFrete";'))
    conn.execute(sa.text('ALTER TABLE fiscal_documents DROP COLUMN IF EXISTS transp_data;'))
