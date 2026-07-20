"""add usar_produtos_gerais to sales_budgets

Revision ID: 2072da565118
Revises: a8b8c8d8e8f8
Create Date: 2026-07-20 09:29:42.549372

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '2072da565118'
down_revision: Union[str, Sequence[str], None] = 'a8b8c8d8e8f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('sales_budgets', sa.Column('usar_produtos_gerais', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sales_budgets', 'usar_produtos_gerais')
