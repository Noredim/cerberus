"""Add kit override fields to rental_budget_items

Revision ID: b1c2d3e4f5a6
Revises: a1b2c3d4e5f6
Create Date: 2026-03-31 12:24:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add kit financial override columns to rental_budget_items.

    These columns persist the calculated kit financials so that reloading
    the opportunity does not zero out the locação/manutenção items.
    """
    op.add_column('rental_budget_items',
        sa.Column('kit_vlt_manut', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('rental_budget_items',
        sa.Column('kit_valor_mensal', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('rental_budget_items',
        sa.Column('kit_valor_impostos', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('rental_budget_items',
        sa.Column('kit_receita_liquida', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('rental_budget_items',
        sa.Column('kit_lucro_mensal', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('rental_budget_items',
        sa.Column('kit_margem', sa.Numeric(precision=10, scale=4), nullable=True))


def downgrade() -> None:
    """Remove kit financial override columns from rental_budget_items."""
    op.drop_column('rental_budget_items', 'kit_margem')
    op.drop_column('rental_budget_items', 'kit_lucro_mensal')
    op.drop_column('rental_budget_items', 'kit_receita_liquida')
    op.drop_column('rental_budget_items', 'kit_valor_impostos')
    op.drop_column('rental_budget_items', 'kit_valor_mensal')
    op.drop_column('rental_budget_items', 'kit_vlt_manut')
