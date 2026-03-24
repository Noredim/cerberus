"""add_frete_desp_adm_comissao_kits

Revision ID: a2ccae627d89
Revises: c6c5280c35f2
Create Date: 2026-03-24 15:11:20.593464

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a2ccae627d89'
down_revision: Union[str, Sequence[str], None] = 'c6c5280c35f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('opportunity_kits', sa.Column('perc_frete_venda', sa.Numeric(precision=6, scale=4), server_default='0.0', nullable=False))
    op.add_column('opportunity_kits', sa.Column('perc_despesas_adm', sa.Numeric(precision=6, scale=4), server_default='0.0', nullable=False))
    op.add_column('opportunity_kits', sa.Column('perc_comissao', sa.Numeric(precision=6, scale=4), server_default='0.0', nullable=False))

def downgrade() -> None:
    op.drop_column('opportunity_kits', 'perc_comissao')
    op.drop_column('opportunity_kits', 'perc_despesas_adm')
    op.drop_column('opportunity_kits', 'perc_frete_venda')
