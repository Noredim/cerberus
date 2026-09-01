"""add_leads_module_tables

Revision ID: a1b2c3d4e5f7
Revises: 076e7f6303a2
Create Date: 2026-08-31 14:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f7'
down_revision = '076e7f6303a2'
branch_labels = None
depends_on = None


def upgrade():
    # 1. Tabela de Filas por Equipe de Vendas
    op.execute("""
    CREATE TABLE IF NOT EXISTS lead_queue_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        sales_team_id UUID NOT NULL REFERENCES company_sales_teams(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        ordem_posicao INT NOT NULL DEFAULT 1,
        ativo BOOLEAN NOT NULL DEFAULT TRUE,
        ultima_atribuicao_em TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_lead_queue_team_user UNIQUE (sales_team_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS ix_lead_queue_members_tenant_id ON lead_queue_members(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_lead_queue_members_company_id ON lead_queue_members(company_id);
    CREATE INDEX IF NOT EXISTS ix_lead_queue_members_sales_team_id ON lead_queue_members(sales_team_id);
    CREATE INDEX IF NOT EXISTS ix_lead_queue_members_user_id ON lead_queue_members(user_id);
    """)

    # 2. Tabela Principal de Leads
    op.execute("""
    CREATE TABLE IF NOT EXISTS leads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        sales_team_id UUID REFERENCES company_sales_teams(id) ON DELETE SET NULL,
        
        nome_contato VARCHAR(255) NOT NULL,
        razao_social VARCHAR(255),
        cpf_cnpj VARCHAR(20),
        email VARCHAR(255),
        telefone VARCHAR(50),
        cargo_contato VARCHAR(100),
        
        origem VARCHAR(50) NOT NULL DEFAULT 'LIGACAO',
        canal VARCHAR(100),
        status VARCHAR(30) NOT NULL DEFAULT 'NOVO',
        tipo_distribuicao VARCHAR(30) NOT NULL DEFAULT 'ROUND_ROBIN',
        
        vendedor_atribuido_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        vendedor_responsavel_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        data_atribuicao TIMESTAMP WITH TIME ZONE,
        data_aceite TIMESTAMP WITH TIME ZONE,
        
        customer_id VARCHAR REFERENCES customers(id) ON DELETE SET NULL,
        sales_budget_id UUID REFERENCES sales_budgets(id) ON DELETE SET NULL,
        
        motivo_perda VARCHAR(100),
        detalhes_perda TEXT,
        observacoes TEXT,
        
        created_by_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_leads_tenant_id ON leads(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_leads_company_id ON leads(company_id);
    CREATE INDEX IF NOT EXISTS ix_leads_sales_team_id ON leads(sales_team_id);
    CREATE INDEX IF NOT EXISTS ix_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS ix_leads_vendedor_atribuido_id ON leads(vendedor_atribuido_id);
    CREATE INDEX IF NOT EXISTS ix_leads_vendedor_responsavel_id ON leads(vendedor_responsavel_id);
    CREATE INDEX IF NOT EXISTS ix_leads_cpf_cnpj ON leads(cpf_cnpj);
    """)

    # 3. Tabela de Histórico de Distribuição
    op.execute("""
    CREATE TABLE IF NOT EXISTS lead_distribution_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        vendedor_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        tentativa_numero INT NOT NULL DEFAULT 1,
        tipo_atribuicao VARCHAR(30) NOT NULL,
        data_atribuicao TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        data_resposta TIMESTAMP WITH TIME ZONE,
        resultado VARCHAR(30) NOT NULL DEFAULT 'AGUARDANDO',
        motivo_recusa VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_lead_dist_hist_lead_id ON lead_distribution_history(lead_id);
    CREATE INDEX IF NOT EXISTS ix_lead_dist_hist_vendedor_id ON lead_distribution_history(vendedor_id);
    """)

    # 4. Tabela de Timeline e Andamentos
    op.execute("""
    CREATE TABLE IF NOT EXISTS lead_timeline (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
        tipo_evento VARCHAR(50) NOT NULL,
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT,
        metadados JSONB,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_lead_timeline_lead_id ON lead_timeline(lead_id);
    """)

    # 5. Tabela de Tarefas e Atividades do Lead
    op.execute("""
    CREATE TABLE IF NOT EXISTS lead_tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
        user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        titulo VARCHAR(255) NOT NULL,
        descricao TEXT,
        tipo VARCHAR(50) NOT NULL DEFAULT 'LIGACAO',
        data_agendamento TIMESTAMP WITH TIME ZONE NOT NULL,
        hora_inicio VARCHAR(10),
        hora_fim VARCHAR(10),
        concluida BOOLEAN NOT NULL DEFAULT FALSE,
        concluida_em TIMESTAMP WITH TIME ZONE,
        resultado TEXT,
        google_event_id VARCHAR(255),
        google_sync_status VARCHAR(30) DEFAULT 'PENDING',
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS ix_lead_tasks_tenant_id ON lead_tasks(tenant_id);
    CREATE INDEX IF NOT EXISTS ix_lead_tasks_company_id ON lead_tasks(company_id);
    CREATE INDEX IF NOT EXISTS ix_lead_tasks_lead_id ON lead_tasks(lead_id);
    CREATE INDEX IF NOT EXISTS ix_lead_tasks_user_id ON lead_tasks(user_id);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS lead_tasks CASCADE;")
    op.execute("DROP TABLE IF EXISTS lead_timeline CASCADE;")
    op.execute("DROP TABLE IF EXISTS lead_distribution_history CASCADE;")
    op.execute("DROP TABLE IF EXISTS leads CASCADE;")
    op.execute("DROP TABLE IF EXISTS lead_queue_members CASCADE;")
