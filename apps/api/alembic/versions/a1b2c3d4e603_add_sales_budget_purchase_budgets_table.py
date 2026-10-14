"""add sales_budget_purchase_budgets table

Revision ID: a1b2c3d4e603
Revises: a1b2c3d4e602
Create Date: 2026-10-13 20:50:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e603'
down_revision = 'a1b2c3d4e602'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'sales_budget_purchase_budgets',
        sa.Column('sales_budget_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('sales_budgets.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('purchase_budget_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('purchase_budgets.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
    )
    op.create_index('ix_sb_pb_sales_budget_id', 'sales_budget_purchase_budgets', ['sales_budget_id'])
    op.create_index('ix_sb_pb_purchase_budget_id', 'sales_budget_purchase_budgets', ['purchase_budget_id'])

    # Backfill existing links from purchase_budgets.sales_budget_id into the new junction table
    op.execute("""
        INSERT INTO sales_budget_purchase_budgets (sales_budget_id, purchase_budget_id, created_at)
        SELECT sales_budget_id, id, now()
        FROM purchase_budgets
        WHERE sales_budget_id IS NOT NULL
        ON CONFLICT DO NOTHING;
    """)


def downgrade():
    op.drop_index('ix_sb_pb_purchase_budget_id', table_name='sales_budget_purchase_budgets')
    op.drop_index('ix_sb_pb_sales_budget_id', table_name='sales_budget_purchase_budgets')
    op.drop_table('sales_budget_purchase_budgets')
