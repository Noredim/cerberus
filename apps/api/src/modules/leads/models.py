import uuid
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, DateTime, ForeignKey, UniqueConstraint
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from src.core.base import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_team_id = Column(UUID(as_uuid=True), ForeignKey("company_sales_teams.id", ondelete="SET NULL"), nullable=True, index=True)

    # Informações de Contato e Empresa
    nome_contato = Column(String(255), nullable=False)
    razao_social = Column(String(255), nullable=True)
    cpf_cnpj = Column(String(20), nullable=True, index=True)
    email = Column(String(255), nullable=True)
    telefone = Column(String(50), nullable=True)
    cargo_contato = Column(String(100), nullable=True)

    # Classificação e Origem
    # Origem: LIGACAO, VISITA, EMAIL, REDES_SOCIAIS, POS_VISITA, INDICACAO, SITE, OUTROS
    origem = Column(String(50), nullable=False, default="LIGACAO")
    canal = Column(String(100), nullable=True)

    # Status e Distribuição
    # Status: NOVO, AGUARDANDO_ACEITE, ASSUMIDO, EM_ATENDIMENTO, QUALIFICADO, CONVERTIDO, PERDIDO
    status = Column(String(30), nullable=False, default="NOVO", index=True)
    # Tipo Distribuicao: DIRETA_VENDEDOR, DIRECIONADO_MANUAL, ROUND_ROBIN
    tipo_distribuicao = Column(String(30), nullable=False, default="ROUND_ROBIN")

    # Atribuição e Responsabilidade
    vendedor_atribuido_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    vendedor_responsavel_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    data_atribuicao = Column(DateTime(timezone=True), nullable=True)
    data_aceite = Column(DateTime(timezone=True), nullable=True)

    # Relacionamento Comercial / Conversão
    customer_id = Column(String, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True, index=True)
    sales_budget_id = Column(UUID(as_uuid=True), ForeignKey("sales_budgets.id", ondelete="SET NULL"), nullable=True, index=True)

    # Perda
    motivo_perda = Column(String(100), nullable=True)
    detalhes_perda = Column(Text, nullable=True)

    # Observações Gerais
    observacoes = Column(Text, nullable=True)

    # Auditoria
    created_by_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    company = relationship("Company")
    sales_team = relationship("SalesTeam")
    vendedor_atribuido = relationship("User", foreign_keys=[vendedor_atribuido_id])
    vendedor_responsavel = relationship("User", foreign_keys=[vendedor_responsavel_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    customer = relationship("Customer")
    sales_budget = relationship("SalesBudget")

    distribution_history = relationship(
        "LeadDistributionHistory",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="desc(LeadDistributionHistory.created_at)"
    )
    timeline = relationship(
        "LeadTimeline",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="desc(LeadTimeline.created_at)"
    )
    tasks = relationship(
        "LeadTask",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="asc(LeadTask.data_agendamento)"
    )


class LeadQueueMember(Base):
    __tablename__ = "lead_queue_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_team_id = Column(UUID(as_uuid=True), ForeignKey("company_sales_teams.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    ordem_posicao = Column(Integer, nullable=False, default=1)
    ativo = Column(Boolean, nullable=False, default=True)
    ultima_atribuicao_em = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint('sales_team_id', 'user_id', name='uq_lead_queue_team_user'),
    )

    company = relationship("Company")
    sales_team = relationship("SalesTeam")
    user = relationship("User")


class LeadDistributionHistory(Base):
    __tablename__ = "lead_distribution_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    vendedor_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    tentativa_numero = Column(Integer, nullable=False, default=1)
    tipo_atribuicao = Column(String(30), nullable=False)  # ROUND_ROBIN, DIRECIONADO_MANUAL
    data_atribuicao = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    data_resposta = Column(DateTime(timezone=True), nullable=True)
    resultado = Column(String(30), nullable=False, default="AGUARDANDO")  # AGUARDANDO, ACEITO_EXPLICITO, ACEITO_ABERTURA, RECUSADO, TIMEOUT, CANCELADO
    motivo_recusa = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    lead = relationship("Lead", back_populates="distribution_history")
    vendedor = relationship("User")


class LeadTimeline(Base):
    __tablename__ = "lead_timeline"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    tipo_evento = Column(String(50), nullable=False)  # CRIACAO, ATRIBUICAO, ACEITE, RECUSA, TIMEOUT, ANDAMENTO, TAREFA_CRIADA, TAREFA_CONCLUIDA, CONVERSAO, PERDA, EDICAO
    titulo = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=True)
    metadados = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    lead = relationship("Lead", back_populates="timeline")
    user = relationship("User")


class LeadTask(Base):
    __tablename__ = "lead_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    lead_id = Column(UUID(as_uuid=True), ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    titulo = Column(String(255), nullable=False)
    descricao = Column(Text, nullable=True)
    tipo = Column(String(50), nullable=False, default="LIGACAO")  # LIGACAO, REUNIAO_PRESENCIAL, REUNIAO_ONLINE, EMAIL, WHATSAPP, VISITA, OUTRO
    data_agendamento = Column(DateTime(timezone=True), nullable=False)
    hora_inicio = Column(String(10), nullable=True)
    hora_fim = Column(String(10), nullable=True)
    fuso_horario = Column(String(50), nullable=True, default="America/Manaus")
    participantes = Column(Text, nullable=True)
    retroativo = Column(Boolean, nullable=False, default=False)
    concluida = Column(Boolean, nullable=False, default=False)
    concluida_em = Column(DateTime(timezone=True), nullable=True)
    resultado = Column(Text, nullable=True)

    google_event_id = Column(String(255), nullable=True)
    google_sync_status = Column(String(30), nullable=True, default="PENDING")

    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

    lead = relationship("Lead", back_populates="tasks")
    user = relationship("User")
