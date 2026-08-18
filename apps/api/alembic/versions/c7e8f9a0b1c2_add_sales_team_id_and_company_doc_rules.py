"""add_sales_team_id_and_company_doc_rules

Revision ID: c7e8f9a0b1c2
Revises: b1a2c3d4e5f6
Create Date: 2026-08-18 09:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'c7e8f9a0b1c2'
down_revision = 'b1a2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    DO $$
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'sales_budgets' AND column_name = 'sales_team_id'
        ) THEN
            ALTER TABLE sales_budgets ADD COLUMN sales_team_id UUID REFERENCES company_sales_teams(id) ON DELETE SET NULL;
            CREATE INDEX IF NOT EXISTS ix_sales_budgets_sales_team_id ON sales_budgets(sales_team_id);
        END IF;
    END $$;
    """)

    op.execute("""
    CREATE TABLE IF NOT EXISTS company_document_rules (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        tipo_documento VARCHAR(50) NOT NULL,
        sales_team_id UUID NOT NULL REFERENCES company_sales_teams(id) ON DELETE CASCADE,
        document_template_id UUID REFERENCES documento_modelo(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_company_doc_rule_team UNIQUE (company_id, tipo_documento, sales_team_id)
    );
    CREATE INDEX IF NOT EXISTS ix_company_doc_rules_tenant_id ON company_document_rules(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_company_doc_rules_company_id ON company_document_rules(company_id);
    CREATE INDEX IF NOT EXISTS ix_company_doc_rules_sales_team_id ON company_document_rules(sales_team_id);
    CREATE INDEX IF NOT EXISTS ix_company_doc_rules_doc_template_id ON company_document_rules(document_template_id);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS company_document_rules CASCADE;")
    op.execute("""
    DO $$
    BEGIN
        IF EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'sales_budgets' AND column_name = 'sales_team_id'
        ) THEN
            ALTER TABLE sales_budgets DROP COLUMN sales_team_id;
        END IF;
    END $$;
    """)
