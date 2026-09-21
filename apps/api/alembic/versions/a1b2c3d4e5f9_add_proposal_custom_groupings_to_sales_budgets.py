"""add proposal_custom_groupings to sales_budgets

Revision ID: a1b2c3d4e5f9
Revises: f3e2d1c0b9a8
Create Date: 2026-09-18 11:25:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f9'
down_revision: Union[str, Sequence[str], None] = 'f3e2d1c0b9a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'sales_budgets',
        sa.Column('proposal_custom_groupings', sa.JSON(), server_default='[]', nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('sales_budgets', 'proposal_custom_groupings')
