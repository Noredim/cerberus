import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Numeric, Text, Integer, Sequence
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.core.base import Base


class SalesProposal(Base):
    __tablename__ = "sales_proposals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    vendedor_id = Column(String, ForeignKey("professionals.id", ondelete="SET NULL"), nullable=True, index=True)
    responsavel_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    # Identificação
    numero_sequencial = Column(Integer, nullable=False)
    numero_proposta = Column(String(50), nullable=False, unique=True, index=True)
    titulo = Column(String(150), nullable=False)
    observacoes = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="RASCUNHO")

    # Fatores e Despesas Iniciais da Proposta
    fator_margem_produtos = Column(Numeric(10, 4), nullable=True)
    fator_margem_servicos = Column(Numeric(10, 4), nullable=True)
    fator_margem_instalacao = Column(Numeric(10, 4), nullable=True)
    fator_margem_manutencao = Column(Numeric(10, 4), nullable=True)
    frete_venda = Column(Numeric(10, 4), nullable=True)
    despesas_adm = Column(Numeric(10, 4), nullable=True)
    comissao = Column(Numeric(10, 4), nullable=True)

    # Meta
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    company = relationship("Company")
    customer = relationship("Customer")
    vendedor = relationship("Professional")
    responsavel = relationship("User")
    
    kits = relationship("SalesProposalKit", back_populates="proposal", cascade="all, delete-orphan")
    logs = relationship("SalesProposalLog", back_populates="proposal", cascade="all, delete-orphan", order_by="desc(SalesProposalLog.created_at)")


class SalesProposalKit(Base):
    __tablename__ = "sales_proposal_kits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id = Column(UUID(as_uuid=True), ForeignKey("sales_proposals.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_kit_id = Column(UUID(as_uuid=True), ForeignKey("opportunity_kits.id", ondelete="CASCADE"), nullable=False, index=True)
    
    quantidade_override = Column(Numeric(15, 4), nullable=True) # Caso o qty precise ser overriding independentemente

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    proposal = relationship("SalesProposal", back_populates="kits")
    opportunity_kit = relationship("OpportunityKit")


class SalesProposalLog(Base):
    __tablename__ = "sales_proposal_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id = Column(UUID(as_uuid=True), ForeignKey("sales_proposals.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    
    acao = Column(String(100), nullable=False) # Ex: "CRIACAO", "MUDANCA_RESPONSAVEL", "EDICAO_KITS", "ATUALIZACAO_FATORES"
    detalhes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=func.now())

    proposal = relationship("SalesProposal", back_populates="logs")
    user = relationship("User")
