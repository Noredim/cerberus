"""add_taxa_juros_mensal_to_formas_pagamento

Revision ID: f2a3b4c5d6e7
Revises: f1a2b3c4d5e6
Create Date: 2026-09-02 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f2a3b4c5d6e7'
down_revision = 'f1a2b3c4d5e6'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'formas_pagamento',
        sa.Column('taxa_juros_mensal', sa.Numeric(10, 6), nullable=False, server_default='0.000000')
    )


def downgrade():
    op.drop_column('formas_pagamento', 'taxa_juros_mensal')
