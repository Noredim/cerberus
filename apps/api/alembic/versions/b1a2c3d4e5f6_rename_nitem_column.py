"""rename_nitem_column

Revision ID: b1a2c3d4e5f6
Revises: a9f8e7d6c5b4
Create Date: 2026-08-13 17:50:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'b1a2c3d4e5f6'
down_revision = 'a9f8e7d6c5b4'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tax_recovery_item_results' AND column_name = 'nitem'
        ) THEN
            ALTER TABLE tax_recovery_item_results RENAME COLUMN nitem TO "nItem";
        END IF;
    END $$;
    """)


def downgrade():
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'tax_recovery_item_results' AND column_name = 'nItem'
        ) THEN
            ALTER TABLE tax_recovery_item_results RENAME COLUMN "nItem" TO nitem;
        END IF;
    END $$;
    """)
