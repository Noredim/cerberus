"""increase_part_number_length_in_products

Revision ID: 7a492a470414
Revises: f20a1705fb25
Create Date: 2026-07-20 14:57:40.413823

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a492a470414'
down_revision: Union[str, Sequence[str], None] = 'f20a1705fb25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('products', 'part_number',
                    existing_type=sa.String(length=50),
                    type_=sa.String(length=100),
                    existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('products', 'part_number',
                    existing_type=sa.String(length=100),
                    type_=sa.String(length=50),
                    existing_nullable=True)
