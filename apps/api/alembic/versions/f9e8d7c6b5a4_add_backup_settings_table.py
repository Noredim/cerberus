"""add_backup_settings_table

Revision ID: f9e8d7c6b5a4
Revises: e7f8a9b0c1d2
Create Date: 2026-08-12 15:45:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'f9e8d7c6b5a4'
down_revision = 'e7f8a9b0c1d2'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS backup_settings (
        id VARCHAR PRIMARY KEY,
        target_ip VARCHAR(255),
        target_dir VARCHAR(512),
        ssh_user VARCHAR(255) DEFAULT 'root',
        ssh_port INTEGER NOT NULL DEFAULT 22,
        ssh_password VARCHAR(512),
        cron_expression VARCHAR(100) NOT NULL DEFAULT '0 2 * * *',
        retention_count INTEGER NOT NULL DEFAULT 3,
        is_active BOOLEAN NOT NULL DEFAULT FALSE,
        last_backup_at TIMESTAMP WITH TIME ZONE,
        last_backup_status VARCHAR(50),
        last_backup_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS backup_settings CASCADE;")
