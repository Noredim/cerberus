import uuid
from typing import Optional
from decimal import Decimal
from datetime import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Numeric, Integer, Boolean
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.core.base import Base

class Licitacao(Base):
    __tablename__ = "licitacoes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    numero_edital = Column(String(100), nullable=False)
    descricao = Column(Text, nullable=True)
    data_publicacao = Column(DateTime(timezone=True), nullable=True)
    data_licitacao = Column(DateTime(timezone=True), nullable=True)
    data_limite_questionamento = Column(DateTime(timezone=True), nullable=True)
    po_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    # Status: Criada, Em Análise/Precificação, Aprovada para Envio, Ganha, Perdida, Suspensa, Cancelada
    status = Column(String(50), nullable=False, default="Criada")
    
    # Modalidades: Pregão, Concorrência, Concurso, Leilão
    modalidade = Column(String(50), nullable=False)
    
    # Tipos: Menor preço, Melhor técnica, Técnica e preço, Maior retorno econômico, Maior desconto
    tipo_licitacao = Column(String(50), nullable=False)
    
    # Métricas consolidadas globais
    valor_total_estimado = Column(Numeric(15, 4), nullable=False, default=0.0)
    valor_total_venda = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_total = Column(Numeric(15, 4), nullable=False, default=0.0)
    lucro_estimado = Column(Numeric(15, 4), nullable=False, default=0.0)
    margem_ponderada_global = Column(Numeric(10, 4), nullable=False, default=0.0)
    precisa_aprovacao_diretoria = Column(Boolean, nullable=False, default=False)
    aprovado_diretoria = Column(Boolean, nullable=False, default=False)
    totais_status = Column(String(50), nullable=False, default="PENDENTE_RECALCULO")
    totais_atualizados_em = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    company = relationship("Company")
    customer = relationship("Customer")
    po = relationship("User", foreign_keys=[po_id])
    lotes = relationship("LicitacaoLote", back_populates="licitacao", cascade="all, delete-orphan")
    purchase_budgets = relationship("PurchaseBudget", back_populates="licitacao", foreign_keys="[PurchaseBudget.licitacao_id]")
    kits = relationship("OpportunityKit", back_populates="licitacao", foreign_keys="[OpportunityKit.licitacao_id]")
    analistas = relationship("LicitacaoAnalista", back_populates="licitacao", cascade="all, delete-orphan")
    history = relationship("LicitacaoHistory", back_populates="licitacao", cascade="all, delete-orphan", order_by="LicitacaoHistory.data_movimentacao.desc()")
    checklist_grupos = relationship("LicitacaoChecklistGrupo", back_populates="licitacao", cascade="all, delete-orphan", order_by="LicitacaoChecklistGrupo.ordem.asc()")
    checklist_aplicacoes = relationship("LicitacaoChecklistAplicacao", back_populates="licitacao", cascade="all, delete-orphan")
    tarefas = relationship("LicitacaoTarefa", back_populates="licitacao", cascade="all, delete-orphan", order_by="LicitacaoTarefa.created_at.desc()")

    @property
    def customer_nome(self):
        return self.customer.nome_fantasia or self.customer.razao_social if self.customer else None

    @property
    def po_nome(self):
        return self.po.name if self.po else None


class LicitacaoLote(Base):
    __tablename__ = "licitacao_lotes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    licitacao_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacoes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    numero: Mapped[str] = mapped_column(String(50), nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    custo_total: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=0.0)
    venda_total: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=0.0)
    lucro_estimado: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=0.0)
    margem_geral: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=0.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    licitacao = relationship("Licitacao", back_populates="lotes")
    items = relationship("LicitacaoItem", back_populates="lote", cascade="all, delete-orphan")


class LicitacaoItem(Base):
    __tablename__ = "licitacao_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    lote_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacao_lotes.id", ondelete="CASCADE"), nullable=False, index=True)
    
    codigo: Mapped[str] = mapped_column(String(100), nullable=False)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    quantidade: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=1.0)
    tipo_fornecimento: Mapped[str] = mapped_column(String(50), nullable=False, default="Unitário")
    total_meses: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    quantidade_total: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=1.0)
    
    custo_unitario: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=0.0)
    custo_total: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=0.0)
    venda_unitario: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=0.0)
    venda_total: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=0.0)
    lucro_estimado: Mapped[Decimal] = mapped_column(Numeric(15, 4), nullable=False, default=0.0)
    margem_geral: Mapped[Decimal] = mapped_column(Numeric(10, 4), nullable=False, default=0.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    lote = relationship("LicitacaoLote", back_populates="items")
    kits = relationship("OpportunityKit", back_populates="licitacao_item", cascade="all, delete-orphan", foreign_keys="[OpportunityKit.licitacao_item_id]")


class LicitacaoAnalista(Base):
    __tablename__ = "licitacao_analistas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    licitacao_id = Column(UUID(as_uuid=True), ForeignKey("licitacoes.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    data_zero = Column(DateTime(timezone=True), nullable=False)
    prazo_dias_uteis = Column(Integer, nullable=False, default=4)
    data_limite = Column(DateTime(timezone=True), nullable=False)

    # Relationships
    licitacao = relationship("Licitacao", back_populates="analistas")
    usuario = relationship("User")

    @property
    def usuario_nome(self):
        return self.usuario.name if self.usuario else None


class LicitacaoHistory(Base):
    __tablename__ = "licitacao_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    licitacao_id = Column(UUID(as_uuid=True), ForeignKey("licitacoes.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String, nullable=False)
    usuario_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    descricao = Column(Text, nullable=False)
    data_movimentacao = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    licitacao = relationship("Licitacao", back_populates="history")
    usuario = relationship("User")

    @property
    def usuario_nome(self):
        return self.usuario.name if self.usuario else None


class LicitacaoChecklistGrupo(Base):
    __tablename__ = "licitacao_checklist_grupos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    licitacao_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacoes.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(100), nullable=False)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    licitacao = relationship("Licitacao", back_populates="checklist_grupos")
    items = relationship("LicitacaoChecklistItem", back_populates="grupo", cascade="all, delete-orphan", order_by="LicitacaoChecklistItem.ordem.asc()")


class LicitacaoChecklistItem(Base):
    __tablename__ = "licitacao_checklist_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grupo_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacao_checklist_grupos.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    nome: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Pendente") # Pendente, Concluído, Não Aplicável
    usuario_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    data_conclusao: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    ordem: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # Relationships
    grupo = relationship("LicitacaoChecklistGrupo", back_populates="items")
    usuario = relationship("User")
    aplicacoes = relationship("LicitacaoChecklistAplicacao", back_populates="item", cascade="all, delete-orphan")
    tarefas = relationship("LicitacaoTarefa", back_populates="checklist_item")

    @property
    def usuario_nome(self):
        return self.usuario.name if self.usuario else None


class LicitacaoChecklistAplicacao(Base):
    __tablename__ = "licitacao_checklist_aplicacoes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    licitacao_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacoes.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    item_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacao_checklist_items.id", ondelete="CASCADE"), nullable=False, index=True)
    usuario_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Pendente") # Pendente, Concluído, Não Aplicável
    observacao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    data_conclusao: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    licitacao = relationship("Licitacao", back_populates="checklist_aplicacoes")
    item = relationship("LicitacaoChecklistItem", back_populates="aplicacoes")
    usuario = relationship("User")
    tarefas = relationship("LicitacaoTarefa", back_populates="checklist_aplicacao")

    @property
    def usuario_nome(self):
        return self.usuario.name if self.usuario else None


class LicitacaoTarefa(Base):
    __tablename__ = "licitacao_tarefas"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    licitacao_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacoes.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    checklist_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacao_checklist_items.id", ondelete="SET NULL"), nullable=True)
    checklist_aplicacao_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacao_checklist_aplicacoes.id", ondelete="SET NULL"), nullable=True)
    titulo: Mapped[str] = mapped_column(String(255), nullable=False)
    descricao: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    responsavel_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    criador_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    data_limite: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="Pendente") # Pendente, Em Andamento, Concluída, Cancelada
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    licitacao = relationship("Licitacao", back_populates="tarefas")
    checklist_item = relationship("LicitacaoChecklistItem", back_populates="tarefas")
    checklist_aplicacao = relationship("LicitacaoChecklistAplicacao", back_populates="tarefas")
    responsavel = relationship("User", foreign_keys=[responsavel_id])
    criador = relationship("User", foreign_keys=[criador_id])
    andamentos = relationship("LicitacaoTarefaAndamento", back_populates="tarefa", cascade="all, delete-orphan", order_by="LicitacaoTarefaAndamento.created_at.desc()")

    @property
    def responsavel_nome(self):
        return self.responsavel.name if self.responsavel else None

    @property
    def criador_nome(self):
        return self.criador.name if self.criador else None


class LicitacaoTarefaAndamento(Base):
    __tablename__ = "licitacao_tarefa_andamentos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tarefa_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("licitacao_tarefas.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    usuario_id: Mapped[str] = mapped_column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    descricao: Mapped[str] = mapped_column(Text, nullable=False)
    status_anterior: Mapped[str] = mapped_column(String(50), nullable=False)
    status_novo: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    # Relationships
    tarefa = relationship("LicitacaoTarefa", back_populates="andamentos")
    usuario = relationship("User")

    @property
    def usuario_nome(self):
        return self.usuario.name if self.usuario else None
