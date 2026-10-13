"""add inside multi stock table and team erp flag

Revision ID: a1b2c3d4e602
Revises: a1b2c3d4e601
Create Date: 2026-10-12 07:10:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e602'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e601'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. Add utiliza_apenas_itens_erp to company_sales_teams
    if 'company_sales_teams' in insp.get_table_names():
        team_cols = [c['name'] for c in insp.get_columns('company_sales_teams')]
        if 'utiliza_apenas_itens_erp' not in team_cols:
            op.add_column(
                'company_sales_teams',
                sa.Column('utiliza_apenas_itens_erp', sa.Boolean(), server_default='false', nullable=False)
            )

    # 2. Create product_inside_stocks table
    if 'product_inside_stocks' not in insp.get_table_names():
        op.create_table(
            'product_inside_stocks',
            sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
            sa.Column('product_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=False, index=True),
            sa.Column('empresa_erp', sa.String(50), nullable=False, index=True),
            sa.Column('tipo_estoque', sa.String(50), nullable=False, index=True),
            sa.Column('cod_estoque', sa.String(50), nullable=True),
            sa.Column('cod_produto_erp', sa.Integer(), nullable=False, index=True),
            sa.Column('saldo', sa.Numeric(15, 4), server_default='0.0', nullable=False),
            sa.Column('custo', sa.Numeric(15, 4), server_default='0.0', nullable=False),
            sa.Column('preco', sa.Numeric(15, 4), server_default='0.0', nullable=False),
            sa.Column('last_sync_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('raw_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
            sa.UniqueConstraint('product_id', 'empresa_erp', 'tipo_estoque', name='uq_product_inside_stock_emp_tipo')
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'product_inside_stocks' in insp.get_table_names():
        op.drop_table('product_inside_stocks')

    if 'company_sales_teams' in insp.get_table_names():
        team_cols = [c['name'] for c in insp.get_columns('company_sales_teams')]
        if 'utiliza_apenas_itens_erp' in team_cols:
            op.drop_column('company_sales_teams', 'utiliza_apenas_itens_erp')
