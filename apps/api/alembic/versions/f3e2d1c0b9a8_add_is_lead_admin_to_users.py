"""add is_lead_admin to users

Revision ID: f3e2d1c0b9a8
Revises: e8d7c6b5a4f3
Create Date: 2026-09-09 11:52:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f3e2d1c0b9a8'
down_revision: Union[str, Sequence[str], None] = 'e8d7c6b5a4f3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'users',
        sa.Column('is_lead_admin', sa.Boolean(), server_default='false', nullable=False)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'is_lead_admin')
