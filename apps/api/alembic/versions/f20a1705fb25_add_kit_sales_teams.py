"""add_kit_sales_teams

Revision ID: f20a1705fb25
Revises: 61352a5e6e5d
Create Date: 2026-07-20 11:40:00.033694

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f20a1705fb25'
down_revision: Union[str, Sequence[str], None] = '61352a5e6e5d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('opportunity_kit_sales_teams',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('opportunity_kit_id', sa.UUID(), nullable=False),
    sa.Column('sales_team_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['opportunity_kit_id'], ['opportunity_kits.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sales_team_id'], ['company_sales_teams.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('opportunity_kit_sales_teams')

