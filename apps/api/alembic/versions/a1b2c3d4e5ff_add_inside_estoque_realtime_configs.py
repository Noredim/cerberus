"""add inside estoque realtime configs

Revision ID: a1b2c3d4e5ff
Revises: a1b2c3d4e5fe
Create Date: 2026-10-07 08:45:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5ff'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'company_inside_configs' in insp.get_table_names():
        existing_cols = [c['name'] for c in insp.get_columns('company_inside_configs')]

        # Ambiente C (Consulta de Estoque & Custos em Tempo Real)
        if 'estoque_base_url' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('estoque_base_url', sa.String(255), nullable=True))
        if 'estoque_api_key' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('estoque_api_key', sa.String(255), nullable=True))
        if 'estoque_cod_empresa' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('estoque_cod_empresa', sa.String(50), nullable=True))
        if 'estoque_tipo_padrao' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('estoque_tipo_padrao', sa.String(50), server_default='NOVOS', nullable=True))
        if 'estoque_is_active' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('estoque_is_active', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'company_inside_configs' in insp.get_table_names():
        existing_cols = [c['name'] for c in insp.get_columns('company_inside_configs')]
        for col in [
            'estoque_base_url', 'estoque_api_key', 'estoque_cod_empresa', 'estoque_tipo_padrao', 'estoque_is_active'
        ]:
            if col in existing_cols:
                op.drop_column('company_inside_configs', col)
