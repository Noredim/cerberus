"""add_nfe_monthly_tracker_fields

Revision ID: 9a8b7c6d5e4f
Revises: 8266e8cd5d00
Create Date: 2026-07-28 17:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '9a8b7c6d5e4f'
down_revision = '8266e8cd5d00'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Add columns to fiscal_documents
    op.add_column('fiscal_documents', sa.Column('uf_emit', sa.String(length=2), nullable=True))
    op.add_column('fiscal_documents', sa.Column('uf_dest', sa.String(length=2), nullable=True))
    op.add_column('fiscal_documents', sa.Column('competencia', sa.String(length=7), nullable=True))
    op.create_index(op.f('ix_fiscal_documents_competencia'), 'fiscal_documents', ['competencia'], unique=False)
    
    op.add_column('fiscal_documents', sa.Column('aplicacao', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_fiscal_documents_aplicacao'), 'fiscal_documents', ['aplicacao'], unique=False)
    
    op.add_column('fiscal_documents', sa.Column('tipo_tributacao', sa.String(length=50), nullable=True))
    op.create_index(op.f('ix_fiscal_documents_tipo_tributacao'), 'fiscal_documents', ['tipo_tributacao'], unique=False)
    
    op.add_column('fiscal_documents', sa.Column('status_classificacao', sa.String(length=30), server_default='PENDENTE', nullable=True))
    op.create_index(op.f('ix_fiscal_documents_status_classificacao'), 'fiscal_documents', ['status_classificacao'], unique=False)
    
    op.add_column('fiscal_documents', sa.Column('data_classificacao', sa.DateTime(timezone=True), nullable=True))
    op.add_column('fiscal_documents', sa.Column('usuario_classificacao_id', sa.String(), nullable=True))
    op.create_foreign_key('fk_fiscal_documents_usuario_classificacao', 'fiscal_documents', 'users', ['usuario_classificacao_id'], ['id'], ondelete='SET NULL')
    
    op.add_column('fiscal_documents', sa.Column('observacao_classificacao', sa.Text(), nullable=True))
    op.add_column('fiscal_documents', sa.Column('divergencia_flag', sa.Boolean(), server_default='false', nullable=True))
    op.create_index(op.f('ix_fiscal_documents_divergencia_flag'), 'fiscal_documents', ['divergencia_flag'], unique=False)
    
    # Financial tax total columns
    op.add_column('fiscal_documents', sa.Column('vBC', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vICMS', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vBCST', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vICMSST', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vFCP', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vFCPST', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vIPI', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vPIS', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vCOFINS', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vFrete', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vSeg', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vDesc', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('vOutro', sa.Numeric(precision=19, scale=4), server_default='0', nullable=True))
    op.add_column('fiscal_documents', sa.Column('xml_raw', sa.Text(), nullable=True))

    # Multi-tenant Unique Constraint
    op.create_unique_constraint('uq_fiscal_documents_tenant_access_key', 'fiscal_documents', ['tenant_id', 'access_key'])

    # 2. Create fiscal_nfe_histories table
    op.create_table(
        'fiscal_nfe_histories',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('fiscal_document_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('fiscal_documents.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tenant_id', sa.String(), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('action', sa.String(length=50), nullable=False),
        sa.Column('previous_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('new_values', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('justification', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True)
    )
    op.create_index(op.f('ix_fiscal_nfe_histories_fiscal_document_id'), 'fiscal_nfe_histories', ['fiscal_document_id'], unique=False)
    op.create_index(op.f('ix_fiscal_nfe_histories_tenant_id'), 'fiscal_nfe_histories', ['tenant_id'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_fiscal_nfe_histories_tenant_id'), table_name='fiscal_nfe_histories')
    op.drop_index(op.f('ix_fiscal_nfe_histories_fiscal_document_id'), table_name='fiscal_nfe_histories')
    op.drop_table('fiscal_nfe_histories')

    op.drop_constraint('uq_fiscal_documents_tenant_access_key', 'fiscal_documents', type_='unique')
    op.drop_constraint('fk_fiscal_documents_usuario_classificacao', 'fiscal_documents', type_='foreignkey')

    op.drop_column('fiscal_documents', 'xml_raw')
    op.drop_column('fiscal_documents', 'vOutro')
    op.drop_column('fiscal_documents', 'vDesc')
    op.drop_column('fiscal_documents', 'vSeg')
    op.drop_column('fiscal_documents', 'vFrete')
    op.drop_column('fiscal_documents', 'vCOFINS')
    op.drop_column('fiscal_documents', 'vPIS')
    op.drop_column('fiscal_documents', 'vIPI')
    op.drop_column('fiscal_documents', 'vFCPST')
    op.drop_column('fiscal_documents', 'vFCP')
    op.drop_column('fiscal_documents', 'vICMSST')
    op.drop_column('fiscal_documents', 'vBCST')
    op.drop_column('fiscal_documents', 'vICMS')
    op.drop_column('fiscal_documents', 'vBC')

    op.drop_index(op.f('ix_fiscal_documents_divergencia_flag'), table_name='fiscal_documents')
    op.drop_column('fiscal_documents', 'divergencia_flag')
    op.drop_column('fiscal_documents', 'observacao_classificacao')
    op.drop_column('fiscal_documents', 'usuario_classificacao_id')
    op.drop_column('fiscal_documents', 'data_classificacao')

    op.drop_index(op.f('ix_fiscal_documents_status_classificacao'), table_name='fiscal_documents')
    op.drop_column('fiscal_documents', 'status_classificacao')

    op.drop_index(op.f('ix_fiscal_documents_tipo_tributacao'), table_name='fiscal_documents')
    op.drop_column('fiscal_documents', 'tipo_tributacao')

    op.drop_index(op.f('ix_fiscal_documents_aplicacao'), table_name='fiscal_documents')
    op.drop_column('fiscal_documents', 'aplicacao')

    op.drop_index(op.f('ix_fiscal_documents_competencia'), table_name='fiscal_documents')
    op.drop_column('fiscal_documents', 'competencia')

    op.drop_column('fiscal_documents', 'uf_dest')
    op.drop_column('fiscal_documents', 'uf_emit')
