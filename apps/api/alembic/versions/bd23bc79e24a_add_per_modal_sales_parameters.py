"""Add per-modal sales parameters (venda, locacao, comodato)

Revision ID: bd23bc79e24a
Revises: 8d8bf5324cdb
Create Date: 2026-03-25 11:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'bd23bc79e24a'
down_revision: Union[str, Sequence[str], None] = '598ae93a26f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Fields per operation type
_TYPES = ['venda', 'locacao', 'comodato']
_FIELDS = [
    ('mkp_padrao',            sa.Numeric(10, 2)),
    ('despesa_administrativa', sa.Numeric(5, 2)),
    ('comissionamento',       sa.Numeric(5, 2)),
    ('pis',                   sa.Numeric(5, 2)),
    ('cofins',                sa.Numeric(5, 2)),
    ('csll',                  sa.Numeric(5, 2)),
    ('irpj',                  sa.Numeric(5, 2)),
    ('iss',                   sa.Numeric(5, 2)),
    ('icms_interno',          sa.Numeric(5, 2)),
    ('icms_externo',          sa.Numeric(5, 2)),
]


def upgrade() -> None:
    for t in _TYPES:
        for field, col_type in _FIELDS:
            op.add_column(
                'company_sales_parameters',
                sa.Column(f'{field}_{t}', col_type, nullable=True, server_default='0.00')
            )


def downgrade() -> None:
    for t in _TYPES:
        for field, _ in _FIELDS:
            op.drop_column('company_sales_parameters', f'{field}_{t}')
