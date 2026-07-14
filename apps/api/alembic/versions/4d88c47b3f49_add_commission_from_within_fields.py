"""add_commission_from_within_fields

Revision ID: 4d88c47b3f49
Revises: 9b47f7a58a9c
Create Date: 2026-07-13 16:54:00.493167

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '4d88c47b3f49'
down_revision: Union[str, Sequence[str], None] = '9b47f7a58a9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # company_commercial_policies
    op.add_column('company_commercial_policies', sa.Column('tipo_comissionamento', sa.String(length=50), nullable=False, server_default='TRADICIONAL'))
    op.add_column('company_commercial_policies', sa.Column('dsr_percentual', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'))
    op.add_column('company_commercial_policies', sa.Column('fgts_percentual', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'))
    op.add_column('company_commercial_policies', sa.Column('inss_percentual', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'))
    op.add_column('company_commercial_policies', sa.Column('demais_incidencias_percentual', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'))
    op.add_column('company_commercial_policies', sa.Column('despesa_operacional_percentual', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0'))

    # opportunity_kits
    op.add_column('opportunity_kits', sa.Column('tipo_comissionamento', sa.String(length=50), nullable=False, server_default='TRADICIONAL'))
    op.add_column('opportunity_kits', sa.Column('perc_dsr', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))
    op.add_column('opportunity_kits', sa.Column('perc_fgts', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))
    op.add_column('opportunity_kits', sa.Column('perc_inss', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))
    op.add_column('opportunity_kits', sa.Column('perc_demais_incidencias', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))
    op.add_column('opportunity_kits', sa.Column('perc_despesa_operacional', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))

    # rental_budget_items
    op.add_column('rental_budget_items', sa.Column('dsr_mensal', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))
    op.add_column('rental_budget_items', sa.Column('fgts_mensal', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))
    op.add_column('rental_budget_items', sa.Column('inss_mensal', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))
    op.add_column('rental_budget_items', sa.Column('demais_incidencias_mensal', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))
    op.add_column('rental_budget_items', sa.Column('despesa_operacional_mensal', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))

    # sales_budget_items
    op.add_column('sales_budget_items', sa.Column('dsr_unit', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))
    op.add_column('sales_budget_items', sa.Column('fgts_unit', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))
    op.add_column('sales_budget_items', sa.Column('inss_unit', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))
    op.add_column('sales_budget_items', sa.Column('demais_incidencias_unit', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))
    op.add_column('sales_budget_items', sa.Column('despesa_operacional_unit', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))

    # sales_budgets
    op.add_column('sales_budgets', sa.Column('tipo_comissionamento', sa.String(length=50), nullable=False, server_default='TRADICIONAL'))
    op.add_column('sales_budgets', sa.Column('perc_dsr', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))
    op.add_column('sales_budgets', sa.Column('perc_fgts', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))
    op.add_column('sales_budgets', sa.Column('perc_inss', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))
    op.add_column('sales_budgets', sa.Column('perc_demais_incidencias', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))
    op.add_column('sales_budgets', sa.Column('perc_despesa_operacional', sa.Numeric(precision=6, scale=4), nullable=False, server_default='0'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sales_budgets', 'perc_despesa_operacional')
    op.drop_column('sales_budgets', 'perc_demais_incidencias')
    op.drop_column('sales_budgets', 'perc_inss')
    op.drop_column('sales_budgets', 'perc_fgts')
    op.drop_column('sales_budgets', 'perc_dsr')
    op.drop_column('sales_budgets', 'tipo_comissionamento')

    op.drop_column('sales_budget_items', 'despesa_operacional_unit')
    op.drop_column('sales_budget_items', 'demais_incidencias_unit')
    op.drop_column('sales_budget_items', 'inss_unit')
    op.drop_column('sales_budget_items', 'fgts_unit')
    op.drop_column('sales_budget_items', 'dsr_unit')

    op.drop_column('rental_budget_items', 'despesa_operacional_mensal')
    op.drop_column('rental_budget_items', 'demais_incidencias_mensal')
    op.drop_column('rental_budget_items', 'inss_mensal')
    op.drop_column('rental_budget_items', 'fgts_mensal')
    op.drop_column('rental_budget_items', 'dsr_mensal')

    op.drop_column('opportunity_kits', 'perc_despesa_operacional')
    op.drop_column('opportunity_kits', 'perc_demais_incidencias')
    op.drop_column('opportunity_kits', 'perc_inss')
    op.drop_column('opportunity_kits', 'perc_fgts')
    op.drop_column('opportunity_kits', 'perc_dsr')
    op.drop_column('opportunity_kits', 'tipo_comissionamento')

    op.drop_column('company_commercial_policies', 'despesa_operacional_percentual')
    op.drop_column('company_commercial_policies', 'demais_incidencias_percentual')
    op.drop_column('company_commercial_policies', 'inss_percentual')
    op.drop_column('company_commercial_policies', 'fgts_percentual')
    op.drop_column('company_commercial_policies', 'dsr_percentual')
    op.drop_column('company_commercial_policies', 'tipo_comissionamento')
