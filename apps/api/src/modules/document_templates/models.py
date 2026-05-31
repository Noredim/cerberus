import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.core.base import Base


class DocumentTemplate(Base):
    __tablename__ = "documento_modelo"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    
    nome = Column(String(255), nullable=False)
    tipo_documento = Column(String(100), nullable=False)  # CGF, CONTRATO, PROPOSTA_COMERCIAL, etc.
    modulo_origem = Column(String(100), nullable=False)   # OPORTUNIDADE, CONTRATO, ORDEM_SERVICO, etc.
    status = Column(String(50), nullable=False, default="RASCUNHO")  # RASCUNHO, VIGENTE, INATIVO
    versao = Column(Integer, nullable=False, default=1)
    conteudo_html = Column(Text, nullable=False)
    descricao = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    company = relationship("Company")
    versions = relationship("DocumentVersion", back_populates="template", cascade="all, delete-orphan", order_by="DocumentVersion.versao.desc()")
    variables = relationship("DocumentVariable", back_populates="template", cascade="all, delete-orphan")
    audits = relationship("DocumentAudit", back_populates="template", cascade="all, delete-orphan", order_by="DocumentAudit.data_hora.desc()")


class DocumentVersion(Base):
    __tablename__ = "documento_versao"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    modelo_id = Column(UUID(as_uuid=True), ForeignKey("documento_modelo.id", ondelete="CASCADE"), nullable=False, index=True)
    versao = Column(Integer, nullable=False)
    conteudo_html = Column(Text, nullable=False)
    usuario_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    data_publicacao = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    template = relationship("DocumentTemplate", back_populates="versions")
    usuario = relationship("User")


class DocumentVariable(Base):
    __tablename__ = "documento_variavel"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    modelo_id = Column(UUID(as_uuid=True), ForeignKey("documento_modelo.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(100), nullable=False)  # e.g., "cliente_nome"
    origem = Column(String(100), nullable=False)  # e.g., "CLIENTE", "OPORTUNIDADE"
    campo = Column(String(100), nullable=False)  # e.g., "razao_social", "numero_orcamento"
    tipo = Column(String(50), nullable=False, default="TEXTO")  # TEXTO, NUMERO, IMAGEM
    obrigatoria = Column(Boolean, nullable=False, default=False)

    template = relationship("DocumentTemplate", back_populates="variables")


class DocumentAudit(Base):
    __tablename__ = "documento_auditoria"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    modelo_id = Column(UUID(as_uuid=True), ForeignKey("documento_modelo.id", ondelete="CASCADE"), nullable=False, index=True)
    usuario_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    acao = Column(String(100), nullable=False)  # CRIACAO, EDICAO, DUPLICACAO, PUBLICACAO, GERACAO
    data_hora = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    template = relationship("DocumentTemplate", back_populates="audits")
    usuario = relationship("User")
