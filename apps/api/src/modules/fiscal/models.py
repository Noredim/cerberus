import uuid
from typing import Optional
from sqlalchemy import Column, String, Numeric, Boolean, Text, DateTime, ForeignKey, Integer, Date, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from src.core.base import Base
from src.modules.users.models import User

JSONType = JSON().with_variant(JSONB, "postgresql")

class NcmRule(Base):
    __tablename__ = "ncm_rules"

    ncm = Column(String, primary_key=True)
    cest = Column(String)
    mva = Column(Numeric(5, 4))
    st_flag = Column(Boolean, default=False)
    benefit_flag = Column(Boolean, default=False)
    uf = Column(String, nullable=False)


class NfeAnalysis(Base):
    __tablename__ = "nfe_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    xml_content = Column(Text, nullable=False)
    file_name = Column(String, nullable=True)
    file_hash = Column(String, nullable=True)
    status = Column(String(20), default="PENDING")  # 'PENDING', 'PROCESSED', 'ERROR'
    error_message = Column(Text, nullable=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    fiscal_document = relationship("FiscalDocument", back_populates="analysis", uselist=False, cascade="all, delete-orphan")


class FiscalDocument(Base):
    __tablename__ = "fiscal_documents"
    __table_args__ = (
        UniqueConstraint("tenant_id", "access_key", name="uq_fiscal_documents_tenant_access_key"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    nfe_analysis_id = Column(UUID(as_uuid=True), ForeignKey("nfe_analyses.id", ondelete="CASCADE"), nullable=True, index=True)
    
    access_key = Column(String(44), nullable=False, index=True)
    nNF = Column(String(20), nullable=True)
    serie = Column(String(10), nullable=True)
    mod = Column(String(10), nullable=True)
    natOp = Column(String(200), nullable=True)
    dhEmi = Column(DateTime(timezone=True), nullable=True)
    competencia = Column(String(7), nullable=True, index=True)  # YYYY-MM
    
    issuer_cnpj = Column(String(20), nullable=True)
    issuer_name = Column(String(200), nullable=True)
    issuer_ie = Column(String(20), nullable=True)
    uf_emit = Column(String(2), nullable=True)
    
    recipient_cnpj = Column(String(20), nullable=True)
    recipient_name = Column(String(200), nullable=True)
    uf_dest = Column(String(2), nullable=True)
    
    # Classification fields
    aplicacao = Column(String(50), nullable=True, index=True)
    tipo_tributacao = Column(String(50), nullable=True, index=True)
    status_classificacao = Column(String(30), default="PENDENTE", index=True)
    data_classificacao = Column(DateTime(timezone=True), nullable=True)
    usuario_classificacao_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    observacao_classificacao = Column(Text, nullable=True)
    divergencia_flag = Column(Boolean, default=False, index=True)
    
    # Financial and Tax Totals
    vProd = Column(Numeric(19, 4), nullable=True)
    vNF = Column(Numeric(19, 4), nullable=True)
    vBC = Column(Numeric(19, 4), default=0)
    vICMS = Column(Numeric(19, 4), default=0)
    vBCST = Column(Numeric(19, 4), default=0)
    vICMSST = Column(Numeric(19, 4), default=0)
    vFCP = Column(Numeric(19, 4), default=0)
    vFCPST = Column(Numeric(19, 4), default=0)
    vIPI = Column(Numeric(19, 4), default=0)
    vPIS = Column(Numeric(19, 4), default=0)
    vCOFINS = Column(Numeric(19, 4), default=0)
    vFrete = Column(Numeric(19, 4), default=0)
    vSeg = Column(Numeric(19, 4), default=0)
    vDesc = Column(Numeric(19, 4), default=0)
    vOutro = Column(Numeric(19, 4), default=0)
    
    cStat = Column(String(10), nullable=True)
    xMotivo = Column(String(250), nullable=True)
    nProt = Column(String(50), nullable=True)
    dhRecbto = Column(DateTime(timezone=True), nullable=True)
    xml_version = Column(String(10), nullable=True)
    xml_raw = Column(Text, nullable=True)
    transp_data = Column(JSONType, nullable=True)

    # Status e Origem de Importação (NF-e Resumida por Evento)
    status_importacao = Column(String(30), default="COMPLETA", index=True)  # COMPLETA, RESUMIDA_EVENTO, PENDENTE_COMPLEMENTACAO
    origem_importacao = Column(String(30), default="XML_NFE")              # XML_NFE, EVENTO_CANCELAMENTO, INTEGRACAO, IMPORTACAO_MANUAL
    dados_completos = Column(Boolean, default=True)
    xml_nfe_original_importado = Column(Boolean, default=True)
    criada_por_evento = Column(Boolean, default=False, index=True)
    ano_mes_emissao = Column(String(7), nullable=True)                      # YYYY-MM extraído da chave
    codigo_uf = Column(String(2), nullable=True)                             # Código UF extraído da chave

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    analysis = relationship("NfeAnalysis", back_populates="fiscal_document")
    items = relationship("FiscalDocumentItem", back_populates="fiscal_document", cascade="all, delete-orphan")
    installments = relationship("FiscalDocumentInstallment", back_populates="fiscal_document", cascade="all, delete-orphan")
    payments = relationship("FiscalDocumentPayment", back_populates="fiscal_document", cascade="all, delete-orphan")
    histories = relationship("FiscalNfeHistory", back_populates="fiscal_document", cascade="all, delete-orphan")
    events = relationship("FiscalDocumentEvent", back_populates="fiscal_document", cascade="all, delete-orphan")
    usuario_classificacao = relationship("User", foreign_keys=[usuario_classificacao_id])

    @property
    def transp(self):
        if self.transp_data:
            return self.transp_data
        if self.xml_raw:
            try:
                from src.modules.fiscal.parser import NFeXmlParser
                parsed = NFeXmlParser.parse_xml(self.xml_raw)
                return parsed.get("transp")
            except Exception:
                return None
        return None


class FiscalDocumentEvent(Base):
    __tablename__ = "fiscal_document_events"
    __table_args__ = (
        UniqueConstraint("tenant_id", "access_key", "event_type", "event_sequence", "registration_protocol", name="uq_fiscal_doc_event"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    fiscal_document_id = Column(UUID(as_uuid=True), ForeignKey("fiscal_documents.id", ondelete="CASCADE"), nullable=True, index=True)
    
    access_key = Column(String(44), nullable=False, index=True)
    event_type = Column(String(10), nullable=False)                         # e.g., '110111'
    event_sequence = Column(Integer, default=1)
    event_description = Column(String(200), nullable=True)                 # e.g., 'Cancelamento'
    event_datetime = Column(DateTime(timezone=True), nullable=True)
    registration_datetime = Column(DateTime(timezone=True), nullable=True)
    request_protocol = Column(String(50), nullable=True)
    registration_protocol = Column(String(50), nullable=True)
    justification = Column(Text, nullable=True)
    environment = Column(String(5), nullable=True)                           # '1' = Produção, '2' = Homologação
    authority_code = Column(String(10), nullable=True)
    status_code = Column(String(10), nullable=True)                          # SEFAZ cStat (e.g. '135')
    status_message = Column(String(250), nullable=True)                      # SEFAZ xMotivo
    processing_status = Column(String(20), default="CONFIRMED")              # 'CONFIRMED', 'REJECTED', 'PENDING'
    raw_xml = Column(Text, nullable=True)
    xml_hash = Column(String(64), nullable=True)
    imported_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    fiscal_document = relationship("FiscalDocument", back_populates="events")
    user = relationship("User", foreign_keys=[imported_by])


class FiscalDocumentItem(Base):
    __tablename__ = "fiscal_document_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiscal_document_id = Column(UUID(as_uuid=True), ForeignKey("fiscal_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    nItem = Column(Integer, nullable=False)
    cProd = Column(String(100), nullable=True)
    xProd = Column(String(250), nullable=True)
    NCM = Column(String(20), nullable=True)
    CFOP = Column(String(10), nullable=True)
    uCom = Column(String(20), nullable=True)
    qCom = Column(Numeric(19, 6), nullable=True)
    vUnCom = Column(Numeric(19, 6), nullable=True)
    vProd = Column(Numeric(19, 4), nullable=True)
    vFrete = Column(Numeric(19, 4), default=0)
    
    # Store all taxes structure as JSON
    tributos = Column(JSONType, nullable=True)

    # Relationships
    fiscal_document = relationship("FiscalDocument", back_populates="items")


class FiscalDocumentInstallment(Base):
    __tablename__ = "fiscal_document_installments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiscal_document_id = Column(UUID(as_uuid=True), ForeignKey("fiscal_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    nDup = Column(String(50), nullable=True)
    dVenc = Column(Date, nullable=True)
    vDup = Column(Numeric(19, 4), nullable=True)

    # Relationships
    fiscal_document = relationship("FiscalDocument", back_populates="installments")


class FiscalDocumentPayment(Base):
    __tablename__ = "fiscal_document_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiscal_document_id = Column(UUID(as_uuid=True), ForeignKey("fiscal_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    
    tPag = Column(String(10), nullable=True)
    vPag = Column(Numeric(19, 4), nullable=True)

    # Relationships
    fiscal_document = relationship("FiscalDocument", back_populates="payments")


class FiscalNfeHistory(Base):
    __tablename__ = "fiscal_nfe_histories"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    fiscal_document_id = Column(UUID(as_uuid=True), ForeignKey("fiscal_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    
    action = Column(String(50), nullable=False)  # IMPORTACAO, CLASSIFICACAO, RECLASSIFICACAO, etc.
    previous_values = Column(JSONB, nullable=True)
    new_values = Column(JSONB, nullable=True)
    justification = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())

    # Relationships
    fiscal_document = relationship("FiscalDocument", back_populates="histories")
    user = relationship("User", foreign_keys=[user_id])

    @property
    def user_name(self) -> Optional[str]:
        if self.user:
            return getattr(self.user, 'full_name', None) or getattr(self.user, 'email', None)
        return None

