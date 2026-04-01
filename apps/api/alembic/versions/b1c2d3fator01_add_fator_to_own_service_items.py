"""add fator to own_service_items and migrate old data

Revision ID: b1c2d3fator01
Revises: a0b1c2d3e4f5
Create Date: 2026-04-01 10:25:00.000000

Replaces tempo_minutos with fator (decimal) for own_service_items.
Old data is migrated: fator = tempo_minutos / 60.0
Also recalculates tempo_total_minutos on own_services as avg(fator) * 60.
"""
from alembic import op
import sqlalchemy as sa

revision = 'b1c2d3fator01'
down_revision = 'a0b1c2d3e4f5'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add fator column (nullable first for migration)
    op.add_column(
        'own_service_items',
        sa.Column('fator', sa.Numeric(precision=10, scale=4), nullable=True)
    )

    # 2. Migrate old data: fator = tempo_minutos / 60.0
    op.execute("""
        UPDATE own_service_items
        SET fator = ROUND(tempo_minutos::numeric / 60.0, 4)
        WHERE fator IS NULL
    """)

    # 3. Set default and make not-nullable
    op.execute("UPDATE own_service_items SET fator = 0 WHERE fator IS NULL")
    op.alter_column('own_service_items', 'fator', nullable=False)

    # 4. Recalculate tempo_total_minutos on own_services header as avg(fator)*60
    op.execute("""
        UPDATE own_services os
        SET tempo_total_minutos = COALESCE((
            SELECT ROUND(AVG(osi.fator) * 60)
            FROM own_service_items osi
            WHERE osi.own_service_id = os.id
        ), 0)
    """)


def downgrade():
    # Restore tempo_minutos from fator (approximate)
    op.execute("""
        UPDATE own_service_items
        SET tempo_minutos = ROUND(fator * 60)
    """)
    op.drop_column('own_service_items', 'fator')
