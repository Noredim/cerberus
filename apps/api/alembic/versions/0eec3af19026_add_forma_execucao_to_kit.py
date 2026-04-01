"""add_forma_execucao_to_kit

Revision ID: 0eec3af19026
Revises: c3d491799897
Create Date: 2026-04-01 13:56:01.685474

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0eec3af19026'
down_revision: Union[str, Sequence[str], None] = 'c3d491799897'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('opportunity_kits', sa.Column('forma_execucao', sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('opportunity_kits', 'forma_execucao')
