"""enable unaccent extension for accent-insensitive search

Revision ID: a0b1c2d3e4f5
Revises: 5049a9581ee9
Create Date: 2026-04-01 09:40:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a0b1c2d3e4f5'
down_revision = 'cd14b0761cd9'
branch_labels = None
depends_on = None


def upgrade():
    # Enable the unaccent extension for accent-insensitive text search.
    # This is idempotent — safe to run on databases where it already exists.
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent;")


def downgrade():
    # Intentionally a no-op: removing unaccent would break existing functionality.
    pass
