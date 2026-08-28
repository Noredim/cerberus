"""add_kit_despesas_adm_to_rental_items

Revision ID: 9b47f7a58a9c
Revises: 7c31db4f2893
Create Date: 2026-07-04 11:08:22.629127

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9b47f7a58a9c'
down_revision: Union[str, Sequence[str], None] = '7c31db4f2893'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_companies_tenant_cnpj;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_company_cnaes_primary;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_company_cnaes_unique;"))
    conn.execute(sa.text("DROP INDEX IF EXISTS idx_tax_profiles_active;"))
    conn.execute(sa.text("ALTER TABLE rental_budget_items ADD COLUMN IF NOT EXISTS kit_despesas_adm NUMERIC(15, 4);"))
    conn.execute(sa.text("ALTER TABLE rental_budget_items ADD COLUMN IF NOT EXISTS kit_perc_despesas_adm NUMERIC(6, 4);"))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('rental_budget_items', 'kit_perc_despesas_adm')
    op.drop_column('rental_budget_items', 'kit_despesas_adm')
