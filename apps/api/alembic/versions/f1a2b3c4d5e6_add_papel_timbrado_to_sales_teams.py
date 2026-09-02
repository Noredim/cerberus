"""add_papel_timbrado_to_sales_teams

Revision ID: f1a2b3c4d5e6
Revises: e5f6a7b8c9d0
Create Date: 2026-09-01 17:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'f1a2b3c4d5e6'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('company_sales_teams', sa.Column('papel_timbrado_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_company_sales_teams_papel_timbrado_id'), 'company_sales_teams', ['papel_timbrado_id'], unique=False)
    op.create_foreign_key(
        'fk_company_sales_teams_papel_timbrado',
        'company_sales_teams', 'papel_timbrado',
        ['papel_timbrado_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade():
    op.drop_constraint('fk_company_sales_teams_papel_timbrado', 'company_sales_teams', type_='foreignkey')
    op.drop_index(op.f('ix_company_sales_teams_papel_timbrado_id'), table_name='company_sales_teams')
    op.drop_column('company_sales_teams', 'papel_timbrado_id')
