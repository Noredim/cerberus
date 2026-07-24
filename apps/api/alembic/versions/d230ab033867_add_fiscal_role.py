"""add fiscal role

Revision ID: d230ab033867
Revises: 7a492a470414
Create Date: 2026-07-24 08:47:07.517836

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd230ab033867'
down_revision: Union[str, Sequence[str], None] = '7a492a470414'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("COMMIT")
    connection = op.get_bind()
    result = connection.execute(sa.text(
        "SELECT 1 FROM pg_enum "
        "JOIN pg_type ON pg_enum.enumtypid = pg_type.oid "
        "WHERE pg_type.typname = 'userroleenum' AND enumlabel = 'FISCAL'"
    )).fetchone()
    if not result:
        connection.execute(sa.text("ALTER TYPE userroleenum ADD VALUE 'FISCAL'"))


def downgrade() -> None:
    """Downgrade schema."""
    pass
