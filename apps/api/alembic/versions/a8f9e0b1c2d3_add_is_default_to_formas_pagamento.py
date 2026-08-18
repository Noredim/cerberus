"""add_is_default_to_formas_pagamento

Revision ID: a8f9e0b1c2d3
Revises: c7e8f9a0b1c2
Create Date: 2026-08-18 13:54:30.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a8f9e0b1c2d3'
down_revision = 'c7e8f9a0b1c2'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('formas_pagamento', sa.Column('is_default', sa.Boolean(), nullable=False, server_default=sa.text('false')))


def downgrade():
    op.drop_column('formas_pagamento', 'is_default')
