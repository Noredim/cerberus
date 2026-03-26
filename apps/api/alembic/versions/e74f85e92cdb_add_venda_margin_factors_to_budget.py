"""add_venda_margin_factors_to_budget

Revision ID: e74f85e92cdb
Revises: bd23bc79e24a
Create Date: 2026-03-25 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e74f85e92cdb'
down_revision: Union[str, Sequence[str], None] = 'bd23bc79e24a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sales_budgets', sa.Column('venda_markup_produtos', sa.Numeric(precision=10, scale=4), nullable=False, server_default='1.0000'))
    op.add_column('sales_budgets', sa.Column('venda_markup_servicos', sa.Numeric(precision=10, scale=4), nullable=False, server_default='1.0000'))
    op.add_column('sales_budgets', sa.Column('venda_markup_instalacao', sa.Numeric(precision=10, scale=4), nullable=False, server_default='1.0000'))
    op.add_column('sales_budgets', sa.Column('venda_markup_manutencao', sa.Numeric(precision=10, scale=4), nullable=False, server_default='1.0000'))


def downgrade() -> None:
    op.drop_column('sales_budgets', 'venda_markup_manutencao')
    op.drop_column('sales_budgets', 'venda_markup_instalacao')
    op.drop_column('sales_budgets', 'venda_markup_servicos')
    op.drop_column('sales_budgets', 'venda_markup_produtos')
