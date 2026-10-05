"""add inside dual environment configs

Revision ID: a1b2c3d4e5fd
Revises: a1b2c3d4e5fc
Create Date: 2026-10-05 09:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5fd'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5fc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'company_inside_configs' in insp.get_table_names():
        existing_cols = [c['name'] for c in insp.get_columns('company_inside_configs')]

        # Ambiente A (Serviços)
        if 'servicos_base_url' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('servicos_base_url', sa.String(255), nullable=True))
        if 'servicos_hash_token' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('servicos_hash_token', sa.String(255), nullable=True))
        if 'servicos_cod_unidade' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('servicos_cod_unidade', sa.Integer(), nullable=True))
        if 'servicos_is_active' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('servicos_is_active', sa.Boolean(), server_default='false', nullable=False))

        # Ambiente B (Produtos / Locação / Comodato)
        if 'produtos_base_url' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('produtos_base_url', sa.String(255), nullable=True))
        if 'produtos_hash_token' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('produtos_hash_token', sa.String(255), nullable=True))
        if 'produtos_cod_unidade' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('produtos_cod_unidade', sa.Integer(), nullable=True))
        if 'produtos_is_active' not in existing_cols:
            op.add_column('company_inside_configs', sa.Column('produtos_is_active', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'company_inside_configs' in insp.get_table_names():
        existing_cols = [c['name'] for c in insp.get_columns('company_inside_configs')]
        for col in [
            'servicos_base_url', 'servicos_hash_token', 'servicos_cod_unidade', 'servicos_is_active',
            'produtos_base_url', 'produtos_hash_token', 'produtos_cod_unidade', 'produtos_is_active'
        ]:
            if col in existing_cols:
                op.drop_column('company_inside_configs', col)
