"""add inside product cache fields

Revision ID: a1b2c3d4e600
Revises: a1b2c3d4e5ff
Create Date: 2026-10-07 09:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e600'
down_revision = 'a1b2c3d4e5ff'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('products', sa.Column('inside_last_sync_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('products', sa.Column('inside_cached_custo', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('products', sa.Column('inside_cached_saldo', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('products', sa.Column('inside_cached_preco', sa.Numeric(precision=15, scale=4), nullable=True))
    op.add_column('products', sa.Column('inside_cached_raw', postgresql.JSONB(astext_type=sa.Text()), nullable=True))


def downgrade() -> None:
    op.drop_column('products', 'inside_cached_raw')
    op.drop_column('products', 'inside_cached_preco')
    op.drop_column('products', 'inside_cached_saldo')
    op.drop_column('products', 'inside_cached_custo')
    op.drop_column('products', 'inside_last_sync_at')
