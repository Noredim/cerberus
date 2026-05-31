"""Add payment methods and planning

Revision ID: 5d68ae3a762c
Revises: b2243c882153
Create Date: 2026-05-30 21:47:51.361078

"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB, UUID


# revision identifiers, used by Alembic.
revision: str = '5d68ae3a762c'
down_revision: Union[str, Sequence[str], None] = 'b2243c882153'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Create formas_pagamento table
    op.create_table('formas_pagamento',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('descricao', sa.String(length=100), nullable=False),
        sa.Column('tipo_uso', sa.String(length=20), nullable=False),
        sa.Column('tipo_distribuicao', sa.String(length=20), nullable=False),
        sa.Column('ativo', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('observacao', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE')
    )
    op.create_index(op.f('ix_formas_pagamento_tenant_id'), 'formas_pagamento', ['tenant_id'], unique=False)

    # 2. Create formas_pagamento_parcelas table
    op.create_table('formas_pagamento_parcelas',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('forma_pagamento_id', sa.UUID(), nullable=False),
        sa.Column('sequencia', sa.Integer(), nullable=False),
        sa.Column('descricao', sa.String(length=100), nullable=False),
        sa.Column('intervalo_dias', sa.Integer(), nullable=False),
        sa.Column('percentual', sa.Numeric(precision=10, scale=4), nullable=True),
        sa.Column('valor_fixo', sa.Numeric(precision=15, scale=4), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['forma_pagamento_id'], ['formas_pagamento.id'], ondelete='CASCADE')
    )
    op.create_index(op.f('ix_formas_pagamento_parcelas_forma_pagamento_id'), 'formas_pagamento_parcelas', ['forma_pagamento_id'], unique=False)

    # 3. Create planejamento_financeiro table
    op.create_table('planejamento_financeiro',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('company_id', sa.UUID(), nullable=False),
        sa.Column('origem_tipo', sa.String(length=30), nullable=False),
        sa.Column('origem_id', sa.UUID(), nullable=False),
        sa.Column('numero_parcela', sa.Integer(), nullable=False),
        sa.Column('descricao', sa.String(length=150), nullable=False),
        sa.Column('data_prevista', sa.Date(), nullable=False),
        sa.Column('valor_previsto', sa.Numeric(precision=15, scale=4), nullable=False),
        sa.Column('tipo_movimento', sa.String(length=20), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False, server_default='PREVISTO'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['company_id'], ['companies.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE')
    )
    op.create_index(op.f('ix_planejamento_financeiro_tenant_id'), 'planejamento_financeiro', ['tenant_id'], unique=False)
    op.create_index(op.f('ix_planejamento_financeiro_company_id'), 'planejamento_financeiro', ['company_id'], unique=False)
    op.create_index(op.f('ix_planejamento_financeiro_origem_id'), 'planejamento_financeiro', ['origem_id'], unique=False)

    # 4. Migrate old data from payment_conditions to formas_pagamento
    bind = op.get_bind()
    res = bind.execute(sa.text("SELECT id, tenant_id, descricao, prazo, parcelas FROM payment_conditions"))
    rows = res.fetchall()
    for row in rows:
        pc_id, tenant_id, pc_descricao, prazo, parcelas = row
        # Insert main FormaPagamento using the same UUID
        bind.execute(sa.text(
            "INSERT INTO formas_pagamento (id, tenant_id, descricao, tipo_uso, tipo_distribuicao, ativo, created_at, updated_at) "
            "VALUES (:id, :tenant_id, :descricao, 'COMPRA', 'RATEIO_IGUAL', true, now(), now())"
        ), {"id": pc_id, "tenant_id": tenant_id, "descricao": pc_descricao})
        
        # Insert dynamic installments
        for i in range(1, parcelas + 1):
            part_id = uuid.uuid4()
            part_desc = "Entrada" if (i == 1 and prazo == 0) else f"Parcela {i}"
            part_days = prazo + 30 * (i - 1)
            bind.execute(sa.text(
                "INSERT INTO formas_pagamento_parcelas (id, forma_pagamento_id, sequencia, descricao, intervalo_dias, percentual, valor_fixo) "
                "VALUES (:id, :forma_pagamento_id, :sequencia, :descricao, :intervalo_dias, null, null)"
            ), {
                "id": part_id,
                "forma_pagamento_id": pc_id,
                "sequencia": i,
                "descricao": part_desc,
                "intervalo_dias": part_days
            })

    # 5. Modify purchase_budgets
    op.drop_constraint('purchase_budgets_payment_condition_id_fkey', 'purchase_budgets', type_='foreignkey')
    op.alter_column('purchase_budgets', 'payment_condition_id', new_column_name='forma_pagamento_id')
    op.create_foreign_key('purchase_budgets_forma_pagamento_id_fkey', 'purchase_budgets', 'formas_pagamento', ['forma_pagamento_id'], ['id'], ondelete='SET NULL')
    
    op.add_column('purchase_budgets', sa.Column('data_vencimento_inicial', sa.DateTime(timezone=True), nullable=True))
    op.add_column('purchase_budgets', sa.Column('forma_pagamento_snapshot', JSONB, nullable=True))

    # 6. Drop old payment_conditions table
    op.drop_index('ix_payment_conditions_tenant_id', table_name='payment_conditions')
    op.drop_table('payment_conditions')

    # 7. Modify sales_budgets
    op.add_column('sales_budgets', sa.Column('forma_pagamento_id', sa.UUID(), nullable=True))
    op.add_column('sales_budgets', sa.Column('data_vencimento_inicial', sa.DateTime(timezone=True), nullable=True))
    op.add_column('sales_budgets', sa.Column('forma_pagamento_snapshot', JSONB, nullable=True))
    op.create_foreign_key('sales_budgets_forma_pagamento_id_fkey', 'sales_budgets', 'formas_pagamento', ['forma_pagamento_id'], ['id'], ondelete='SET NULL')
    op.create_index(op.f('ix_sales_budgets_forma_pagamento_id'), 'sales_budgets', ['forma_pagamento_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Drop foreign key and columns on sales_budgets
    op.drop_constraint('sales_budgets_forma_pagamento_id_fkey', 'sales_budgets', type_='foreignkey')
    op.drop_index(op.f('ix_sales_budgets_forma_pagamento_id'), table_name='sales_budgets')
    op.drop_column('sales_budgets', 'forma_pagamento_snapshot')
    op.drop_column('sales_budgets', 'data_vencimento_inicial')
    op.drop_column('sales_budgets', 'forma_pagamento_id')

    # 2. Recreate payment_conditions table
    op.create_table('payment_conditions',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.String(), nullable=False),
        sa.Column('descricao', sa.String(length=100), nullable=False),
        sa.Column('prazo', sa.Integer(), nullable=False),
        sa.Column('parcelas', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_payment_conditions_tenant_id'), 'payment_conditions', ['tenant_id'], unique=False)

    # 3. Restore purchase_budgets column and constraint
    op.drop_constraint('purchase_budgets_forma_pagamento_id_fkey', 'purchase_budgets', type_='foreignkey')
    op.drop_column('purchase_budgets', 'forma_pagamento_snapshot')
    op.drop_column('purchase_budgets', 'data_vencimento_inicial')
    op.alter_column('purchase_budgets', 'forma_pagamento_id', new_column_name='payment_condition_id')
    op.create_foreign_key('purchase_budgets_payment_condition_id_fkey', 'purchase_budgets', 'payment_conditions', ['payment_condition_id'], ['id'], ondelete='SET NULL')

    # 4. Drop new tables
    op.drop_index(op.f('ix_planejamento_financeiro_origem_id'), table_name='planejamento_financeiro')
    op.drop_index(op.f('ix_planejamento_financeiro_company_id'), table_name='planejamento_financeiro')
    op.drop_index(op.f('ix_planejamento_financeiro_tenant_id'), table_name='planejamento_financeiro')
    op.drop_table('planejamento_financeiro')
    
    op.drop_index(op.f('ix_formas_pagamento_parcelas_forma_pagamento_id'), table_name='formas_pagamento_parcelas')
    op.drop_table('formas_pagamento_parcelas')

    op.drop_index(op.f('ix_formas_pagamento_tenant_id'), table_name='formas_pagamento')
    op.drop_table('formas_pagamento')

