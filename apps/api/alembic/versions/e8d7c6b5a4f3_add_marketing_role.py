"""add marketing role

Revision ID: e8d7c6b5a4f3
Revises: a1b2c3d4e5f8
Create Date: 2026-09-03 21:35:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'e8d7c6b5a4f3'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("COMMIT")
    connection = op.get_bind()
    result = connection.execute(sa.text(
        "SELECT 1 FROM pg_enum "
        "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
        "WHERE pg_type.typname = 'userroleenum' AND enumlabel = 'MARKETING'"
    )).fetchone()
    if not result:
        connection.execute(sa.text("ALTER TYPE userroleenum ADD VALUE 'MARKETING'"))


def downgrade() -> None:
    """Downgrade schema."""
    pass
