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
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE email_configs ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255);"))
    conn.execute(sa.text("ALTER TABLE email_configs ADD COLUMN IF NOT EXISTS imap_port INTEGER DEFAULT 993;"))
    conn.execute(sa.text("ALTER TABLE email_configs ADD COLUMN IF NOT EXISTS imap_user VARCHAR(255);"))
    conn.execute(sa.text("ALTER TABLE email_configs ADD COLUMN IF NOT EXISTS imap_password_encrypted VARCHAR(512);"))
    conn.execute(sa.text("ALTER TABLE email_configs ADD COLUMN IF NOT EXISTS imap_use_ssl BOOLEAN DEFAULT TRUE;"))
    conn.execute(sa.text("ALTER TABLE email_configs ADD COLUMN IF NOT EXISTS imap_use_tls BOOLEAN DEFAULT FALSE;"))


def downgrade() -> None:
    op.drop_column('email_configs', 'imap_use_tls')
    op.drop_column('email_configs', 'imap_use_ssl')
    op.drop_column('email_configs', 'imap_password_encrypted')
    op.drop_column('email_configs', 'imap_user')
    op.drop_column('email_configs', 'imap_port')
    op.drop_column('email_configs', 'imap_host')
