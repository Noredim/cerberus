"""add inside erp phase 1 correlation fields and company config

Revision ID: a1b2c3d4e5fb
Revises: a1b2c3d4e5fa
Create Date: 2026-10-05 07:15:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5fb'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    # 1. products -> codigo_service
    if 'products' in insp.get_table_names():
        prod_cols = [c['name'] for c in insp.get_columns('products')]
        if 'codigo_service' not in prod_cols:
            op.add_column(
                'products',
                sa.Column('codigo_service', sa.Integer(), nullable=True)
            )

    # 2. own_services -> codigo_service
    if 'own_services' in insp.get_table_names():
        serv_cols = [c['name'] for c in insp.get_columns('own_services')]
        if 'codigo_service' not in serv_cols:
            op.add_column(
                'own_services',
                sa.Column('codigo_service', sa.Integer(), nullable=True)
            )

    # 3. professionals -> codigo_service
    if 'professionals' in insp.get_table_names():
        prof_cols = [c['name'] for c in insp.get_columns('professionals')]
        if 'codigo_service' not in prof_cols:
            op.add_column(
                'professionals',
                sa.Column('codigo_service', sa.Integer(), nullable=True)
            )

    # 4. formas_pagamento -> codigo_service
    if 'formas_pagamento' in insp.get_table_names():
        fp_cols = [c['name'] for c in insp.get_columns('formas_pagamento')]
        if 'codigo_service' not in fp_cols:
            op.add_column(
                'formas_pagamento',
                sa.Column('codigo_service', sa.Integer(), nullable=True)
            )

    # 5. customers -> codigo_cliente_service
    if 'customers' in insp.get_table_names():
        cust_cols = [c['name'] for c in insp.get_columns('customers')]
        if 'codigo_cliente_service' not in cust_cols:
            op.add_column(
                'customers',
                sa.Column('codigo_cliente_service', sa.Integer(), nullable=True)
            )

    # 6. company_inside_configs table
    if 'company_inside_configs' not in insp.get_table_names():
        op.create_table(
            'company_inside_configs',
            sa.Column('id', UUID(as_uuid=True), primary_key=True),
            sa.Column('company_id', UUID(as_uuid=True), sa.ForeignKey('companies.id', ondelete='CASCADE'), nullable=False, unique=True),
            sa.Column('base_url', sa.String(length=255), nullable=True),
            sa.Column('hash_token', sa.String(length=255), nullable=True),
            sa.Column('cod_unidade', sa.Integer(), nullable=True),
            sa.Column('is_active', sa.Boolean(), server_default='false', nullable=False),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
            sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False)
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)

    if 'company_inside_configs' in insp.get_table_names():
        op.drop_table('company_inside_configs')

    if 'customers' in insp.get_table_names():
        cust_cols = [c['name'] for c in insp.get_columns('customers')]
        if 'codigo_cliente_service' in cust_cols:
            op.drop_column('customers', 'codigo_cliente_service')

    if 'formas_pagamento' in insp.get_table_names():
        fp_cols = [c['name'] for c in insp.get_columns('formas_pagamento')]
        if 'codigo_service' in fp_cols:
            op.drop_column('formas_pagamento', 'codigo_service')

    if 'professionals' in insp.get_table_names():
        prof_cols = [c['name'] for c in insp.get_columns('professionals')]
        if 'codigo_service' in prof_cols:
            op.drop_column('professionals', 'codigo_service')

    if 'own_services' in insp.get_table_names():
        serv_cols = [c['name'] for c in insp.get_columns('own_services')]
        if 'codigo_service' in serv_cols:
            op.drop_column('own_services', 'codigo_service')

    if 'products' in insp.get_table_names():
        prod_cols = [c['name'] for c in insp.get_columns('products')]
        if 'codigo_service' in prod_cols:
            op.drop_column('products', 'codigo_service')
