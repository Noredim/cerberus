"""add_own_services_tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-03-30 18:38:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── own_services (header) ─────────────────────────────────────────────────
    op.create_table(
        'own_services',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('nome_servico', sa.String(200), nullable=False),
        sa.Column('vigencia', sa.Integer(), nullable=False),
        sa.Column('descricao', sa.Text(), nullable=True),
        sa.Column('tempo_total_minutos', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'tenant_id', 'company_id', 'nome_servico', 'vigencia',
            name='uq_own_services_name_year',
        ),
    )
    op.create_index('ix_own_services_tenant_id', 'own_services', ['tenant_id'])
    op.create_index('ix_own_services_company_id', 'own_services', ['company_id'])

    # ── own_service_items (detail) ────────────────────────────────────────────
    op.create_table(
        'own_service_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('own_service_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.String(), nullable=False),
        sa.Column('tempo_horas', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tempo_minutos', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tempo_total_minutos', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['own_service_id'], ['own_services.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'own_service_id', 'role_id',
            name='uq_own_service_items_service_role',
        ),
    )
    op.create_index('ix_own_service_items_service_id', 'own_service_items', ['own_service_id'])


def downgrade() -> None:
    op.drop_index('ix_own_service_items_service_id', table_name='own_service_items')
    op.drop_table('own_service_items')
    op.drop_index('ix_own_services_company_id', table_name='own_services')
    op.drop_index('ix_own_services_tenant_id', table_name='own_services')
    op.drop_table('own_services')
