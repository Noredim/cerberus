"""add_own_service_history

Revision ID: e7f8a9b0c1d2
Revises: b8c7d6e5f4a3
Create Date: 2026-08-03 14:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'e7f8a9b0c1d2'
down_revision = 'b8c7d6e5f4a3'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS own_service_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        own_service_id UUID NOT NULL REFERENCES own_services(id) ON DELETE CASCADE,
        user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        user_name VARCHAR(255),
        user_email VARCHAR(255),
        acao VARCHAR(50) NOT NULL,
        detalhes_alteracao TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
    );
    CREATE INDEX IF NOT EXISTS ix_own_service_history_tenant_id ON own_service_history(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_own_service_history_own_service_id ON own_service_history(own_service_id);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS own_service_history CASCADE;")
