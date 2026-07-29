"""add_natop_and_v007_fields

Revision ID: b8c7d6e5f4a3
Revises: 9a8b7c6d5e4f
Create Date: 2026-07-29 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b8c7d6e5f4a3'
down_revision = '9a8b7c6d5e4f'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add natOp and issuer_ie to fiscal_documents
    op.execute('ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS "natOp" VARCHAR(200);')
    op.execute('ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS issuer_ie VARCHAR(20);')
    
    # 2. Add V007 fields to fiscal_documents
    op.execute("ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS status_importacao VARCHAR(30) DEFAULT 'COMPLETA';")
    op.execute("ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS origem_importacao VARCHAR(30) DEFAULT 'XML_NFE';")
    op.execute("ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS dados_completos BOOLEAN DEFAULT TRUE;")
    op.execute("ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS xml_nfe_original_importado BOOLEAN DEFAULT TRUE;")
    op.execute("ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS criada_por_evento BOOLEAN DEFAULT FALSE;")
    op.execute("ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS ano_mes_emissao VARCHAR(7);")
    op.execute("ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS codigo_uf VARCHAR(2);")

    # 3. Create fiscal_document_events table if not exists
    op.execute("""
    CREATE TABLE IF NOT EXISTS fiscal_document_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
        fiscal_document_id UUID REFERENCES fiscal_documents(id) ON DELETE CASCADE,
        access_key VARCHAR(44) NOT NULL,
        event_type VARCHAR(10) NOT NULL,
        event_sequence INT DEFAULT 1,
        event_description VARCHAR(200),
        event_datetime TIMESTAMPTZ,
        registration_datetime TIMESTAMPTZ,
        request_protocol VARCHAR(50),
        registration_protocol VARCHAR(50),
        justification TEXT,
        environment VARCHAR(5),
        authority_code VARCHAR(10),
        status_code VARCHAR(10),
        status_message VARCHAR(250),
        processing_status VARCHAR(20) DEFAULT 'CONFIRMED',
        raw_xml TEXT,
        xml_hash VARCHAR(64),
        imported_by VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        CONSTRAINT uq_fiscal_doc_event UNIQUE(tenant_id, access_key, event_type, event_sequence, registration_protocol)
    );
    """)
    op.execute("CREATE INDEX IF NOT EXISTS idx_fiscal_doc_events_tenant_key ON fiscal_document_events(tenant_id, access_key);")


def downgrade():
    pass
