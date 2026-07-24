"""create nfe xml analysis tables

Revision ID: 8266e8cd5d00
Revises: d230ab033867
Create Date: 2026-07-24 08:55:26.235282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8266e8cd5d00'
down_revision: Union[str, Sequence[str], None] = 'd230ab033867'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


from sqlalchemy.dialects import postgresql

def upgrade() -> None:
    """Upgrade schema."""
    # 1. nfe_analyses
    op.create_table(
        'nfe_analyses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('xml_content', sa.Text(), nullable=False),
        sa.Column('file_name', sa.String(), nullable=True),
        sa.Column('file_hash', sa.String(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_nfe_analyses_tenant_id'), 'nfe_analyses', ['tenant_id'], unique=False)

    # 2. fiscal_documents
    op.create_table(
        'fiscal_documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('nfe_analysis_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('access_key', sa.String(length=44), nullable=False),
        sa.Column('nNF', sa.String(length=20), nullable=True),
        sa.Column('serie', sa.String(length=10), nullable=True),
        sa.Column('mod', sa.String(length=10), nullable=True),
        sa.Column('dhEmi', sa.DateTime(timezone=True), nullable=True),
        sa.Column('issuer_cnpj', sa.String(length=20), nullable=True),
        sa.Column('issuer_name', sa.String(length=200), nullable=True),
        sa.Column('recipient_cnpj', sa.String(length=20), nullable=True),
        sa.Column('recipient_name', sa.String(length=200), nullable=True),
        sa.Column('vProd', sa.Numeric(precision=19, scale=4), nullable=True),
        sa.Column('vNF', sa.Numeric(precision=19, scale=4), nullable=True),
        sa.Column('cStat', sa.String(length=10), nullable=True),
        sa.Column('xMotivo', sa.String(length=250), nullable=True),
        sa.Column('nProt', sa.String(length=50), nullable=True),
        sa.Column('dhRecbto', sa.DateTime(timezone=True), nullable=True),
        sa.Column('xml_version', sa.String(length=10), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['nfe_analysis_id'], ['nfe_analyses.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('tenant_id', 'access_key', name='uq_tenant_access_key')
    )
    op.create_index(op.f('ix_fiscal_documents_access_key'), 'fiscal_documents', ['access_key'], unique=False)
    op.create_index(op.f('ix_fiscal_documents_nfe_analysis_id'), 'fiscal_documents', ['nfe_analysis_id'], unique=False)
    op.create_index(op.f('ix_fiscal_documents_tenant_id'), 'fiscal_documents', ['tenant_id'], unique=False)

    # 3. fiscal_document_items
    op.create_table(
        'fiscal_document_items',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('fiscal_document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nItem', sa.Integer(), nullable=False),
        sa.Column('cProd', sa.String(length=100), nullable=True),
        sa.Column('xProd', sa.String(length=250), nullable=True),
        sa.Column('NCM', sa.String(length=20), nullable=True),
        sa.Column('CFOP', sa.String(length=10), nullable=True),
        sa.Column('uCom', sa.String(length=20), nullable=True),
        sa.Column('qCom', sa.Numeric(precision=19, scale=6), nullable=True),
        sa.Column('vUnCom', sa.Numeric(precision=19, scale=6), nullable=True),
        sa.Column('vProd', sa.Numeric(precision=19, scale=4), nullable=True),
        sa.Column('tributos', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(['fiscal_document_id'], ['fiscal_documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('fiscal_document_id', 'nItem', name='uq_fiscal_document_item_nitem')
    )
    op.create_index(op.f('ix_fiscal_document_items_fiscal_document_id'), 'fiscal_document_items', ['fiscal_document_id'], unique=False)

    # 4. fiscal_document_installments
    op.create_table(
        'fiscal_document_installments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('fiscal_document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('nDup', sa.String(length=50), nullable=True),
        sa.Column('dVenc', sa.Date(), nullable=True),
        sa.Column('vDup', sa.Numeric(precision=19, scale=4), nullable=True),
        sa.ForeignKeyConstraint(['fiscal_document_id'], ['fiscal_documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_fiscal_document_installments_fiscal_document_id'), 'fiscal_document_installments', ['fiscal_document_id'], unique=False)

    # 5. fiscal_document_payments
    op.create_table(
        'fiscal_document_payments',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('fiscal_document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('tPag', sa.String(length=10), nullable=True),
        sa.Column('vPag', sa.Numeric(precision=19, scale=4), nullable=True),
        sa.ForeignKeyConstraint(['fiscal_document_id'], ['fiscal_documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_fiscal_document_payments_fiscal_document_id'), 'fiscal_document_payments', ['fiscal_document_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('fiscal_document_payments')
    op.drop_table('fiscal_document_installments')
    op.drop_table('fiscal_document_items')
    op.drop_table('fiscal_documents')
    op.drop_table('nfe_analyses')
