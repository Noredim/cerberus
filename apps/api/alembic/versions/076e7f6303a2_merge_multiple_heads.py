"""merge multiple heads

Revision ID: 076e7f6303a2
Revises: f21ced20f061, f3a9d8c7b6a5
Create Date: 2026-08-28 12:40:39.628059

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '076e7f6303a2'
down_revision: Union[str, Sequence[str], None] = ('f21ced20f061', 'f3a9d8c7b6a5')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
