"""add google calendar integrations tables

Revision ID: b2c3d4e5f6a8
Revises: a1b2c3d4e5f7
Create Date: 2026-08-31 14:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a8'
down_revision: Union[str, None] = 'a1b2c3d4e5f7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Tabela de Integração de Usuário com Google
    op.create_table(
        'user_google_integrations',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('google_email', sa.String(length=255), nullable=False),
        sa.Column('google_user_id', sa.String(length=255), nullable=True),
        sa.Column('access_token_encrypted', sa.String(length=1024), nullable=False),
        sa.Column('refresh_token_encrypted', sa.String(length=1024), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('scopes', postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default='[]'),
        sa.Column('calendar_id', sa.String(length=255), nullable=False, server_default='primary'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('last_sync_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_user_google_integration_user')
    )
    op.create_index('ix_user_google_integrations_user_id', 'user_google_integrations', ['user_id'])
    op.create_index('ix_user_google_integrations_tenant_id', 'user_google_integrations', ['tenant_id'])

    # 2. Tabela de Logs de Sincronização de Calendário
    op.create_table(
        'calendar_event_sync_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('entity_type', sa.String(length=50), nullable=False), # ex: 'LEAD_TASK'
        sa.Column('entity_id', sa.String(length=255), nullable=False),
        sa.Column('google_event_id', sa.String(length=255), nullable=True),
        sa.Column('action', sa.String(length=30), nullable=False), # 'CREATE', 'UPDATE', 'DELETE'
        sa.Column('status', sa.String(length=30), nullable=False), # 'SUCCESS', 'FAILED', 'SKIPPED'
        sa.Column('error_detail', sa.Text(), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_calendar_event_sync_entity', 'calendar_event_sync_logs', ['entity_type', 'entity_id'])
    op.create_index('ix_calendar_event_sync_user', 'calendar_event_sync_logs', ['user_id'])


def downgrade() -> None:
    op.drop_table('calendar_event_sync_logs')
    op.drop_table('user_google_integrations')
