"""add permite_venda_express to sales teams

Revision ID: a1b2c3d4e601
Revises: a1b2c3d4e600
Create Date: 2026-10-07 09:57:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e601'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e600'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'company_sales_teams' in insp.get_table_names():
        team_cols = [c['name'] for c in insp.get_columns('company_sales_teams')]
        if 'permite_venda_express' not in team_cols:
            op.add_column('company_sales_teams', sa.Column('permite_venda_express', sa.Boolean(), server_default='false', nullable=False))


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'company_sales_teams' in insp.get_table_names():
        team_cols = [c['name'] for c in insp.get_columns('company_sales_teams')]
        if 'permite_venda_express' in team_cols:
            op.drop_column('company_sales_teams', 'permite_venda_express')
