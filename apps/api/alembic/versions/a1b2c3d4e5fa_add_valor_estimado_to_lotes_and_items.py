"""add valor_estimado to licitacao_lotes and licitacao_items

Revision ID: a1b2c3d4e5fa
Revises: a1b2c3d4e5f9
Create Date: 2026-09-28 15:20:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5fa'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema safely checking if column already exists."""
    conn = op.get_bind()
    insp = sa.inspect(conn)

    lotes_cols = [c['name'] for c in insp.get_columns('licitacao_lotes')]
    if 'valor_total_estimado' not in lotes_cols:
        op.add_column(
            'licitacao_lotes',
            sa.Column('valor_total_estimado', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0.0')
        )

    items_cols = [c['name'] for c in insp.get_columns('licitacao_items')]
    if 'valor_unitario_estimado' not in items_cols:
        op.add_column(
            'licitacao_items',
            sa.Column('valor_unitario_estimado', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0.0')
        )
    if 'valor_total_estimado' not in items_cols:
        op.add_column(
            'licitacao_items',
            sa.Column('valor_total_estimado', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0.0')
        )


def downgrade() -> None:
    """Downgrade schema."""
    conn = op.get_bind()
    insp = sa.inspect(conn)

    items_cols = [c['name'] for c in insp.get_columns('licitacao_items')]
    if 'valor_total_estimado' in items_cols:
        op.drop_column('licitacao_items', 'valor_total_estimado')
    if 'valor_unitario_estimado' in items_cols:
        op.drop_column('licitacao_items', 'valor_unitario_estimado')

    lotes_cols = [c['name'] for c in insp.get_columns('licitacao_lotes')]
    if 'valor_total_estimado' in lotes_cols:
        op.drop_column('licitacao_lotes', 'valor_total_estimado')
