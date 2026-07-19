"""add_imap_configs

Revision ID: a8b8c8d8e8f8
Revises: c2a5a5a1f6f1
Create Date: 2026-07-19 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8b8c8d8e8f8'
down_revision: Union[str, Sequence[str], None] = 'c2a5a5a1f6f1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add columns to email_configs
    op.add_column('email_configs', sa.Column('imap_host', sa.String(length=255), nullable=True))
    op.add_column('email_configs', sa.Column('imap_port', sa.Integer(), nullable=True, server_default='993'))
    op.add_column('email_configs', sa.Column('imap_user', sa.String(length=255), nullable=True))
    op.add_column('email_configs', sa.Column('imap_password_encrypted', sa.String(length=512), nullable=True))
    op.add_column('email_configs', sa.Column('imap_use_ssl', sa.Boolean(), nullable=True, server_default='true'))
    op.add_column('email_configs', sa.Column('imap_use_tls', sa.Boolean(), nullable=True, server_default='false'))


def downgrade() -> None:
    # Remove columns from email_configs
    op.drop_column('email_configs', 'imap_use_tls')
    op.drop_column('email_configs', 'imap_use_ssl')
    op.drop_column('email_configs', 'imap_password_encrypted')
    op.drop_column('email_configs', 'imap_user')
    op.drop_column('email_configs', 'imap_port')
    op.drop_column('email_configs', 'imap_host')
