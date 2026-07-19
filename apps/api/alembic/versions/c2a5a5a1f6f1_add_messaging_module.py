"""add_messaging_module

Revision ID: c2a5a5a1f6f1
Revises: e51ae04a72ac
Create Date: 2026-07-19 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'c2a5a5a1f6f1'
down_revision: Union[str, Sequence[str], None] = 'e51ae04a72ac'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create table email_configs
    op.create_table(
        'email_configs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('smtp_host', sa.String(length=255), nullable=False),
        sa.Column('smtp_port', sa.Integer(), nullable=False, server_default='587'),
        sa.Column('smtp_user', sa.String(length=255), nullable=False),
        sa.Column('smtp_password_encrypted', sa.String(length=512), nullable=False),
        sa.Column('smtp_use_tls', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('smtp_use_ssl', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sender_name', sa.String(length=255), nullable=False),
        sa.Column('sender_email', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_configs_tenant_id'), 'email_configs', ['tenant_id'], unique=False)

    # 2. Create type RecipientsTypeEnum if not exists
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'recipientstypeenum') THEN CREATE TYPE recipientstypeenum AS ENUM ('FIXED', 'DYNAMIC', 'ROLE_BASED'); END IF; END $$;")

    # 3. Create table email_triggers
    op.create_table(
        'email_triggers',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('action_key', sa.String(length=100), nullable=False),
        sa.Column('action_label', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('subject_template', sa.String(length=500), nullable=False),
        sa.Column('body_template', sa.Text(), nullable=False),
        sa.Column('recipients_type', postgresql.ENUM('FIXED', 'DYNAMIC', 'ROLE_BASED', name='recipientstypeenum', create_type=False), nullable=False, server_default='FIXED'),
        sa.Column('recipients_fixed', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('recipients_roles', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_triggers_tenant_id'), 'email_triggers', ['tenant_id'], unique=False)

    # 4. Create type EmailStatusEnum if not exists
    op.execute("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'emailstatusenum') THEN CREATE TYPE emailstatusenum AS ENUM ('PENDING', 'RETRYING', 'SENT', 'FAILED'); END IF; END $$;")

    # 5. Create table email_logs
    op.create_table(
        'email_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('trigger_id', sa.String(), nullable=True),
        sa.Column('action_key', sa.String(length=100), nullable=False),
        sa.Column('source_module', sa.String(length=100), nullable=False),
        sa.Column('source_entity_id', sa.String(), nullable=True),
        sa.Column('requested_by_user_id', sa.String(), nullable=True),
        sa.Column('requested_by_user_name', sa.String(length=255), nullable=False),
        sa.Column('recipient_email', sa.String(length=255), nullable=False),
        sa.Column('subject', sa.String(length=500), nullable=False),
        sa.Column('body_preview', sa.String(length=500), nullable=True),
        sa.Column('status', postgresql.ENUM('PENDING', 'RETRYING', 'SENT', 'FAILED', name='emailstatusenum', create_type=False), nullable=False, server_default='PENDING'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_retries', sa.Integer(), nullable=False, server_default='5'),
        sa.Column('next_retry_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['trigger_id'], ['email_triggers.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['requested_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_logs_tenant_id'), 'email_logs', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_email_logs_action_key'), 'email_logs', ['action_key'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_email_logs_action_key'), table_name='email_logs')
    op.drop_index(op.f('ix_email_logs_tenant_id'), table_name='email_logs')
    op.drop_table('email_logs')
    
    op.execute("DROP TYPE IF EXISTS emailstatusenum;")

    op.drop_index(op.f('ix_email_triggers_tenant_id'), table_name='email_triggers')
    op.drop_table('email_triggers')

    op.execute("DROP TYPE IF EXISTS recipientstypeenum;")

    op.drop_index(op.f('ix_email_configs_tenant_id'), table_name='email_configs')
    op.drop_table('email_configs')
