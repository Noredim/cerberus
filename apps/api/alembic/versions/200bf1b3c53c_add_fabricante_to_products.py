"""add_fabricante_to_products

Revision ID: 200bf1b3c53c
Revises: ef8b47e3c890
Create Date: 2026-06-22 16:01:30.196662

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '200bf1b3c53c'
down_revision: Union[str, Sequence[str], None] = 'ef8b47e3c890'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('products', sa.Column('fabricante', sa.String(length=100), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('products', 'fabricante')
