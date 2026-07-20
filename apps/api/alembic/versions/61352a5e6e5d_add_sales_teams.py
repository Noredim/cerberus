"""add_sales_teams

Revision ID: 61352a5e6e5d
Revises: 2072da565118
Create Date: 2026-07-20 11:21:35.080453

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '61352a5e6e5d'
down_revision: Union[str, Sequence[str], None] = '2072da565118'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('company_sales_teams',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('tenant_id', sa.String(), nullable=False),
    sa.Column('company_id', sa.UUID(), nullable=False),
    sa.Column('nome', sa.String(length=100), nullable=False),
    sa.Column('ativo', sa.Boolean(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('company_sales_team_members',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('sales_team_id', sa.UUID(), nullable=False),
    sa.Column('user_id', sa.String(), nullable=False),
    sa.Column('cargo', sa.String(length=20), nullable=False),
    sa.ForeignKeyConstraint(['sales_team_id'], ['company_sales_teams.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_table('company_sales_team_policies',
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('sales_team_id', sa.UUID(), nullable=False),
    sa.Column('commercial_policy_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['commercial_policy_id'], ['company_commercial_policies.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['sales_team_id'], ['company_sales_teams.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('company_sales_team_policies')
    op.drop_table('company_sales_team_members')
    op.drop_table('company_sales_teams')

