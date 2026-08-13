"""add_tax_recovery_tables

Revision ID: a9f8e7d6c5b4
Revises: e7f8a9b0c1d2
Create Date: 2026-08-13 13:40:00.000000

"""
from alembic import op
import sqlalchemy as sa

revision = 'a9f8e7d6c5b4'
down_revision = 'f1e2d3c4b5a6'
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    CREATE TABLE IF NOT EXISTS tax_recovery_analyses (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        entry_purpose VARCHAR(50) NOT NULL,
        real_destination VARCHAR(50) NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'RASCUNHO',
        
        total_notes_count INT DEFAULT 0,
        total_notes_value NUMERIC(19, 4) DEFAULT 0,
        total_icms_st_original NUMERIC(19, 4) DEFAULT 0,
        total_difal_original NUMERIC(19, 4) DEFAULT 0,
        total_icms_st_recalculated NUMERIC(19, 4) DEFAULT 0,
        total_difal_recalculated NUMERIC(19, 4) DEFAULT 0,
        total_to_recover NUMERIC(19, 4) DEFAULT 0,
        total_to_collect NUMERIC(19, 4) DEFAULT 0,
        net_balance NUMERIC(19, 4) DEFAULT 0,
        pending_items_count INT DEFAULT 0,
        pending_notes_value NUMERIC(19, 4) DEFAULT 0,

        created_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        updated_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ix_tax_recovery_analyses_tenant_id ON tax_recovery_analyses(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_tax_recovery_analyses_status ON tax_recovery_analyses(status);

    CREATE TABLE IF NOT EXISTS tax_recovery_documents (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tax_recovery_id UUID NOT NULL REFERENCES tax_recovery_analyses(id) ON DELETE CASCADE,
        fiscal_document_id UUID NOT NULL REFERENCES fiscal_documents(id) ON DELETE RESTRICT,
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        
        calculation_status VARCHAR(30) DEFAULT 'OK',
        status_message TEXT,
        
        icms_st_original NUMERIC(19, 4) DEFAULT 0,
        difal_original NUMERIC(19, 4) DEFAULT 0,
        icms_st_recalculated NUMERIC(19, 4) DEFAULT 0,
        difal_recalculated NUMERIC(19, 4) DEFAULT 0,
        total_to_recover NUMERIC(19, 4) DEFAULT 0,
        total_to_collect NUMERIC(19, 4) DEFAULT 0,
        net_balance NUMERIC(19, 4) DEFAULT 0,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

        CONSTRAINT uq_tax_recovery_doc UNIQUE (tax_recovery_id, fiscal_document_id)
    );

    CREATE INDEX IF NOT EXISTS ix_tax_recovery_docs_recovery_id ON tax_recovery_documents(tax_recovery_id);
    CREATE INDEX IF NOT EXISTS ix_tax_recovery_docs_fiscal_doc_id ON tax_recovery_documents(fiscal_document_id);
    CREATE INDEX IF NOT EXISTS ix_tax_recovery_docs_tenant_id ON tax_recovery_documents(tenant_id);

    CREATE TABLE IF NOT EXISTS tax_recovery_item_results (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tax_recovery_document_id UUID NOT NULL REFERENCES tax_recovery_documents(id) ON DELETE CASCADE,
        fiscal_document_item_id UUID NOT NULL REFERENCES fiscal_document_items(id) ON DELETE CASCADE,
        nItem INT NOT NULL,
        status VARCHAR(30) NOT NULL DEFAULT 'SEM_DIFERENCA',
        
        icms_st_original NUMERIC(19, 4) DEFAULT 0,
        icms_st_recalculated NUMERIC(19, 4) DEFAULT 0,
        icms_st_diff NUMERIC(19, 4) DEFAULT 0,
        
        difal_original NUMERIC(19, 4) DEFAULT 0,
        difal_recalculated NUMERIC(19, 4) DEFAULT 0,
        difal_diff NUMERIC(19, 4) DEFAULT 0,
        
        total_to_recover NUMERIC(19, 4) DEFAULT 0,
        total_to_collect NUMERIC(19, 4) DEFAULT 0,
        net_balance NUMERIC(19, 4) DEFAULT 0,

        original_scenario_json JSONB,
        destination_scenario_json JSONB,
        audit_memory_json JSONB,
        pending_reasons JSONB,

        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ix_tax_recovery_item_results_doc_id ON tax_recovery_item_results(tax_recovery_document_id);
    CREATE INDEX IF NOT EXISTS ix_tax_recovery_item_results_item_id ON tax_recovery_item_results(fiscal_document_item_id);
    CREATE INDEX IF NOT EXISTS ix_tax_recovery_item_results_status ON tax_recovery_item_results(status);
    """)


def downgrade():
    op.execute("""
    DROP TABLE IF EXISTS tax_recovery_item_results CASCADE;
    DROP TABLE IF EXISTS tax_recovery_documents CASCADE;
    DROP TABLE IF EXISTS tax_recovery_analyses CASCADE;
    """)
