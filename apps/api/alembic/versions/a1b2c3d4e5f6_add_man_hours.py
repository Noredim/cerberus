"""add_man_hours_table

Revision ID: a1b2c3d4e5f6
Revises: bd23bc79e24a
Create Date: 2026-03-30 17:37:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '628ea409ff67'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'man_hours',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.String(), nullable=False),
        sa.Column('vigencia', sa.Integer(), nullable=False),

        sa.Column('hora_normal', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('hora_extra', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('hora_extra_adicional_noturno', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('hora_extra_domingos_feriados', sa.Numeric(precision=18, scale=4), nullable=False),
        sa.Column('hora_extra_domingos_feriados_noturno', sa.Numeric(precision=18, scale=4), nullable=False),

        sa.Column('ativo', sa.Boolean(), nullable=False, server_default=sa.text('true')),

        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('updated_by', sa.String(), nullable=True),

        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['updated_by'], ['users.id'], ondelete='SET NULL'),

        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'tenant_id', 'company_id', 'role_id', 'vigencia',
            name='uq_man_hours_tenant_company_role_year'
        ),
    )
    op.create_index(op.f('ix_man_hours_company_id'), 'man_hours', ['company_id'], unique=False)
    op.create_index(op.f('ix_man_hours_tenant_id'), 'man_hours', ['tenant_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_man_hours_tenant_id'), table_name='man_hours')
    op.drop_index(op.f('ix_man_hours_company_id'), table_name='man_hours')
    op.drop_table('man_hours')
