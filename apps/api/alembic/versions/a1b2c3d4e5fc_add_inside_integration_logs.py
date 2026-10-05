"""add inside integration logs table

Revision ID: a1b2c3d4e5fc
Revises: a1b2c3d4e5fb
Create Date: 2026-10-05 08:30:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5fc'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5fb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'integration_logs' not in insp.get_table_names():
        op.create_table(
            'integration_logs',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('company_id', UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False),
            sa.Column('integration_type', sa.String(50), nullable=False, default='INSIDE_ERP'),
            sa.Column('endpoint', sa.String(255), nullable=False),
            sa.Column('http_method', sa.String(10), nullable=False),
            sa.Column('status_code', sa.Integer(), nullable=True),
            sa.Column('request_payload', JSONB, nullable=True),
            sa.Column('response_payload', JSONB, nullable=True),
            sa.Column('execution_time_ms', sa.Integer(), nullable=True),
            sa.Column('error_message', sa.Text(), nullable=True),
            sa.Column('user_id', UUID(as_uuid=True), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        )
        op.create_index('ix_integration_logs_company_id', 'integration_logs', ['company_id'])
        op.create_index('ix_integration_logs_integration_type', 'integration_logs', ['integration_type'])
        op.create_index('ix_integration_logs_created_at', 'integration_logs', ['created_at'])


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    if 'integration_logs' in insp.get_table_names():
        op.drop_table('integration_logs')
