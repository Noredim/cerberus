"""add_perfil_tarifario_st

Revision ID: f8be831f6665
Revises: c8f5ba3f5ad2
Create Date: 2026-04-17 20:03:41.398726

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f8be831f6665'
down_revision: Union[str, Sequence[str], None] = 'c8f5ba3f5ad2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE company_tax_profiles ADD COLUMN IF NOT EXISTS perfil_tarifario_st BOOLEAN;"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('company_tax_profiles', 'perfil_tarifario_st')
