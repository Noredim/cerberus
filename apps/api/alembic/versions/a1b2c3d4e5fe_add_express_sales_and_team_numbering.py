"""add express sales, kit fixed pricing and team numbering

Revision ID: a1b2c3d4e5fe
Revises: a1b2c3d4e5fd
Create Date: 2026-10-05 10:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5fe'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5fd'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. company_sales_teams -> nomenclatura_orcamento, numero_proposta
    if 'company_sales_teams' in insp.get_table_names():
        team_cols = [c['name'] for c in insp.get_columns('company_sales_teams')]
        if 'nomenclatura_orcamento' not in team_cols:
            op.add_column('company_sales_teams', sa.Column('nomenclatura_orcamento', sa.String(20), nullable=True))
        if 'numero_proposta' not in team_cols:
            op.add_column('company_sales_teams', sa.Column('numero_proposta', sa.Integer(), server_default='1', nullable=False))

    # 2. opportunity_kits -> tipo_precificacao, valor_venda_fixo, valor_locacao_mensal_fixo
    if 'opportunity_kits' in insp.get_table_names():
        kit_cols = [c['name'] for c in insp.get_columns('opportunity_kits')]
        if 'tipo_precificacao' not in kit_cols:
            op.add_column('opportunity_kits', sa.Column('tipo_precificacao', sa.String(50), server_default='DINAMICO_CUSTO', nullable=False))
        if 'valor_venda_fixo' not in kit_cols:
            op.add_column('opportunity_kits', sa.Column('valor_venda_fixo', sa.Numeric(15, 4), nullable=True))
        if 'valor_locacao_mensal_fixo' not in kit_cols:
            op.add_column('opportunity_kits', sa.Column('valor_locacao_mensal_fixo', sa.Numeric(15, 4), nullable=True))

    # 3. sales_budget_history -> diff_changes
    if 'sales_budget_history' in insp.get_table_names():
        hist_cols = [c['name'] for c in insp.get_columns('sales_budget_history')]
        if 'diff_changes' not in hist_cols:
            op.add_column('sales_budget_history', sa.Column('diff_changes', JSONB, nullable=True))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'sales_budget_history' in insp.get_table_names():
        hist_cols = [c['name'] for c in insp.get_columns('sales_budget_history')]
        if 'diff_changes' in hist_cols:
            op.drop_column('sales_budget_history', 'diff_changes')

    if 'opportunity_kits' in insp.get_table_names():
        kit_cols = [c['name'] for c in insp.get_columns('opportunity_kits')]
        for col in ['tipo_precificacao', 'valor_venda_fixo', 'valor_locacao_mensal_fixo']:
            if col in kit_cols:
                op.drop_column('opportunity_kits', col)

    if 'company_sales_teams' in insp.get_table_names():
        team_cols = [c['name'] for c in insp.get_columns('company_sales_teams')]
        for col in ['nomenclatura_orcamento', 'numero_proposta']:
            if col in team_cols:
                op.drop_column('company_sales_teams', col)
