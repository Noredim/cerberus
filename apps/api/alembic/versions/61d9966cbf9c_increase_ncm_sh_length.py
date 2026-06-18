"""increase_ncm_sh_length

Revision ID: 61d9966cbf9c
Revises: 1023f9448fcb
Create Date: 2026-06-18 03:23:17.388160

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '61d9966cbf9c'
down_revision: Union[str, Sequence[str], None] = '1023f9448fcb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column('cad_ncm_st_item', 'ncm_sh',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(length=500),
               existing_nullable=True)
    op.alter_column('cad_ncm_st_item', 'ncm_normalizado',
               existing_type=sa.VARCHAR(length=20),
               type_=sa.String(length=500),
               existing_nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('cad_ncm_st_item', 'ncm_normalizado',
               existing_type=sa.String(length=500),
               type_=sa.VARCHAR(length=20),
               existing_nullable=True)
    op.alter_column('cad_ncm_st_item', 'ncm_sh',
               existing_type=sa.String(length=500),
               type_=sa.VARCHAR(length=20),
               existing_nullable=True)
