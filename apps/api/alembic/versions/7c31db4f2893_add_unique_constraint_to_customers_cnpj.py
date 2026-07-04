"""add_unique_constraint_to_customers_cnpj

Revision ID: 7c31db4f2893
Revises: 200bf1b3c53c
Create Date: 2026-07-04 10:33:06.580595

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7c31db4f2893'
down_revision: Union[str, Sequence[str], None] = '200bf1b3c53c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_unique_constraint('uq_customer_tenant_cnpj', 'customers', ['tenant_id', 'cnpj'])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint('uq_customer_tenant_cnpj', 'customers', type_='unique')
