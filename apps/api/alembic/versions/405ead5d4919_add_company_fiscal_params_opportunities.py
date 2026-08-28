"""add_company_fiscal_params_opportunities

Revision ID: 405ead5d4919
Revises: fa78168e8d63
Create Date: 2026-03-24 10:58:14.902063

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '405ead5d4919'
down_revision: Union[str, Sequence[str], None] = 'fa78168e8d63'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS nomenclatura_orcamento VARCHAR(20);"))
    conn.execute(sa.text("ALTER TABLE companies ADD COLUMN IF NOT EXISTS numero_proposta INTEGER;"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('companies', 'numero_proposta')
    op.drop_column('companies', 'nomenclatura_orcamento')
