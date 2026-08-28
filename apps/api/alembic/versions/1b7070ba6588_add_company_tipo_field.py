"""Add company tipo field

Revision ID: 1b7070ba6588
Revises: 6055cddcb0a6
Create Date: 2026-03-06 17:29:40.834312

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '1b7070ba6588'
down_revision: Union[str, Sequence[str], None] = '6055cddcb0a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS tipo VARCHAR(50);"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('companies', 'tipo')
