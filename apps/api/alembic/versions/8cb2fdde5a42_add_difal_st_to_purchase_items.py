"""Add difal and st to purchase items

Revision ID: 8cb2fdde5a42
Revises: d63873eee5e3
Create Date: 2026-05-31 13:28:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8cb2fdde5a42'
down_revision: Union[str, Sequence[str], None] = 'd63873eee5e3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('purchase_budget_items', sa.Column('difal_unitario', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0.0'))
    op.add_column('purchase_budget_items', sa.Column('st_unitario', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0.0'))


def downgrade() -> None:
    op.drop_column('purchase_budget_items', 'st_unitario')
    op.drop_column('purchase_budget_items', 'difal_unitario')
