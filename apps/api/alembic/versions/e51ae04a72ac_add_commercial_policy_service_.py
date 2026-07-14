"""add_commercial_policy_service_commissions

Revision ID: e51ae04a72ac
Revises: 4d88c47b3f49
Create Date: 2026-07-14 08:45:36.550000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e51ae04a72ac'
down_revision: Union[str, Sequence[str], None] = '4d88c47b3f49'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('commercial_policy_service_commissions',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('commercial_policy_id', sa.UUID(), nullable=False),
    sa.Column('own_service_id', sa.UUID(), nullable=False),
    sa.Column('commission_installments', sa.Integer(), nullable=False),
    sa.Column('ativo', sa.Boolean(), nullable=False, server_default=sa.text('true')),
    sa.Column('display_order', sa.Integer(), nullable=True),
    sa.Column('tenant_id', sa.String(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['commercial_policy_id'], ['company_commercial_policies.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['own_service_id'], ['own_services.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('commercial_policy_id', 'own_service_id', name='uq_policy_service')
    )
    op.create_index(op.f('ix_commercial_policy_service_commissions_commercial_policy_id'), 'commercial_policy_service_commissions', ['commercial_policy_id'], unique=False)
    op.create_index(op.f('ix_commercial_policy_service_commissions_own_service_id'), 'commercial_policy_service_commissions', ['own_service_id'], unique=False)
    op.create_index(op.f('ix_commercial_policy_service_commissions_tenant_id'), 'commercial_policy_service_commissions', ['tenant_id'], unique=False)

    # Add commercial_policy_id to sales_budgets
    op.add_column('sales_budgets', sa.Column('commercial_policy_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_sales_budgets_commercial_policy', 'sales_budgets', 'company_commercial_policies', ['commercial_policy_id'], ['id'], ondelete='SET NULL')

    # Add commercial_policy_id and comissionamento_detalhado to opportunity_kits
    op.add_column('opportunity_kits', sa.Column('commercial_policy_id', sa.UUID(), nullable=True))
    op.add_column('opportunity_kits', sa.Column('comissionamento_detalhado', sa.dialects.postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.create_foreign_key('fk_opportunity_kits_commercial_policy', 'opportunity_kits', 'company_commercial_policies', ['commercial_policy_id'], ['id'], ondelete='SET NULL')

    # Add kit_comissionamento_detalhado to rental_budget_items
    op.add_column('rental_budget_items', sa.Column('kit_comissionamento_detalhado', sa.dialects.postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('rental_budget_items', 'kit_comissionamento_detalhado')
    
    op.drop_constraint('fk_opportunity_kits_commercial_policy', 'opportunity_kits', type_='foreignkey')
    op.drop_column('opportunity_kits', 'comissionamento_detalhado')
    op.drop_column('opportunity_kits', 'commercial_policy_id')

    op.drop_constraint('fk_sales_budgets_commercial_policy', 'sales_budgets', type_='foreignkey')
    op.drop_column('sales_budgets', 'commercial_policy_id')

    op.drop_index(op.f('ix_commercial_policy_service_commissions_tenant_id'), table_name='commercial_policy_service_commissions')
    op.drop_index(op.f('ix_commercial_policy_service_commissions_own_service_id'), table_name='commercial_policy_service_commissions')
    op.drop_index(op.f('ix_commercial_policy_service_commissions_commercial_policy_id'), table_name='commercial_policy_service_commissions')
    op.drop_table('commercial_policy_service_commissions')

