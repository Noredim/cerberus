"""Add company logo_url

Revision ID: 04a8f746b8f2
Revises: 1b7070ba6588
Create Date: 2026-03-06 17:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '04a8f746b8f2'
down_revision: Union[str, Sequence[str], None] = '1b7070ba6588'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('companies', 'logo_url')
