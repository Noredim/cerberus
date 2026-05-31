"""add_opportunity_approval_workflow

Revision ID: 084c0976a56c
Revises: 5d68ae3a762c
Create Date: 2026-05-31 00:52:27.233918

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '084c0976a56c'
down_revision: Union[str, Sequence[str], None] = '5d68ae3a762c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add columns to sales_budgets
    op.add_column('sales_budgets', sa.Column('versao', sa.Integer(), nullable=False, server_default='1'))
    op.add_column('sales_budgets', sa.Column('valor_total', sa.Numeric(precision=15, scale=4), nullable=False, server_default='0'))

    # 2. Migrate existing status RASCUNHO to EM_LANCAMENTO
    op.execute("UPDATE sales_budgets SET status = 'EM_LANCAMENTO' WHERE status = 'RASCUNHO'")

    # 3. Create sales_budget_history table
    op.create_table(
        'sales_budget_history',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('sales_budget_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('versao', sa.Integer(), nullable=False),
        sa.Column('status_anterior', sa.String(), nullable=False),
        sa.Column('status_novo', sa.String(), nullable=False),
        sa.Column('usuario_id', sa.String(), nullable=False),
        sa.Column('cargo_usuario', sa.String(), nullable=True),
        sa.Column('descricao', sa.Text(), nullable=False),
        sa.Column('data_movimentacao', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['sales_budget_id'], ['sales_budgets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_id'], ['users.id'], ondelete='CASCADE')
    )

    # 4. Create sales_budget_approvals table
    op.create_table(
        'sales_budget_approvals',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('sales_budget_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('usuario_aprovador_id', sa.String(), nullable=False),
        sa.Column('cargo_aprovador', sa.String(), nullable=False),
        sa.Column('data_aprovacao', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('observacao', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['sales_budget_id'], ['sales_budgets.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['usuario_aprovador_id'], ['users.id'], ondelete='CASCADE')
    )


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Drop tables
    op.drop_table('sales_budget_approvals')
    op.drop_table('sales_budget_history')

    # 2. Revert EM_LANCAMENTO to RASCUNHO
    op.execute("UPDATE sales_budgets SET status = 'RASCUNHO' WHERE status = 'EM_LANCAMENTO'")

    # 3. Drop columns from sales_budgets
    op.drop_column('sales_budgets', 'valor_total')
    op.drop_column('sales_budgets', 'versao')
