"""Add cep_cache table

Revision ID: 3d7c3b9e4a12
Revises: 15dde4d9aada
Create Date: 2026-03-05 15:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '3d7c3b9e4a12'
down_revision: Union[str, Sequence[str], None] = '15dde4d9aada'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.create_table('cep_cache',
    sa.Column('cep', sa.String(length=8), nullable=False),
    sa.Column('logradouro', sa.String(length=255), nullable=True),
    sa.Column('bairro', sa.String(length=255), nullable=True),
    sa.Column('cidade', sa.String(length=255), nullable=True),
    sa.Column('uf', sa.String(length=2), nullable=True),
    sa.Column('ibge', sa.String(length=7), nullable=True),
    sa.Column('fonte', sa.String(length=50), nullable=True),
    sa.Column('raw_json', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    sa.PrimaryKeyConstraint('cep')
    )

def downgrade() -> None:
    op.drop_table('cep_cache')
