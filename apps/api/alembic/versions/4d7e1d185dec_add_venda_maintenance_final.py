"""add_venda_maintenance_final

Revision ID: 4d7e1d185dec
Revises: e74f85e92cdb
Create Date: 2026-03-25 21:04:23.416208

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '4d7e1d185dec'
down_revision: Union[str, None] = 'e74f85e92cdb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('sales_budgets', sa.Column('venda_havera_manutencao', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('sales_budgets', sa.Column('venda_qtd_meses_manutencao', sa.Integer(), nullable=False, server_default='0'))


def downgrade() -> None:
    op.drop_column('sales_budgets', 'venda_qtd_meses_manutencao')
    op.drop_column('sales_budgets', 'venda_havera_manutencao')
