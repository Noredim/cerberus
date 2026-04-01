"""remove_tempo_horas_from_own_service_items

Revision ID: 5049a9581ee9
Revises: b1c2d3e4f5a6
Create Date: 2026-03-31 14:18:38.925483

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '5049a9581ee9'
down_revision: Union[str, Sequence[str], None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("UPDATE own_service_items SET tempo_minutos = tempo_total_minutos;")
    op.drop_column('own_service_items', 'tempo_horas')

def downgrade() -> None:
    """Downgrade schema."""
    op.add_column('own_service_items', sa.Column('tempo_horas', sa.Integer(), nullable=False, server_default='0'))
    op.execute("UPDATE own_service_items SET tempo_horas = tempo_total_minutos / 60, tempo_minutos = tempo_total_minutos % 60;")
