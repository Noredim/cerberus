"""add_kit_minimum_margin_fields

Revision ID: 0c2984f83950
Revises: 61d9966cbf9c
Create Date: 2026-06-18 04:54:17.757413

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0c2984f83950'
down_revision: Union[str, Sequence[str], None] = '61d9966cbf9c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('opportunity_kits', sa.Column('margem_minima_desejada', sa.Numeric(precision=6, scale=4), nullable=True))
    op.add_column('opportunity_kits', sa.Column('fator_minimo_calculado', sa.Numeric(precision=10, scale=4), nullable=True))
    op.add_column('opportunity_kits', sa.Column('valor_venda_minimo', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('opportunity_kits', sa.Column('lucro_minimo', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('opportunity_kits', sa.Column('margem_minima_resultante', sa.Numeric(precision=6, scale=4), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('opportunity_kits', 'margem_minima_resultante')
    op.drop_column('opportunity_kits', 'lucro_minimo')
    op.drop_column('opportunity_kits', 'valor_venda_minimo')
    op.drop_column('opportunity_kits', 'fator_minimo_calculado')
    op.drop_column('opportunity_kits', 'margem_minima_desejada')
