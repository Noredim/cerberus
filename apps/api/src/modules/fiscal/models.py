import uuid
from sqlalchemy import Column, String, Numeric, Boolean, Text, DateTime, ForeignKey, Integer, Date
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from src.core.base import Base

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

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    nfe_analysis_id = Column(UUID(as_uuid=True), ForeignKey("nfe_analyses.id", ondelete="CASCADE"), nullable=True, index=True)
    
    access_key = Column(String(44), nullable=False, index=True)
    nNF = Column(String(20), nullable=True)
    serie = Column(String(10), nullable=True)
    mod = Column(String(10), nullable=True)
    dhEmi = Column(DateTime(timezone=True), nullable=True)
    
    issuer_cnpj = Column(String(20), nullable=True)
    issuer_name = Column(String(200), nullable=True)
    recipient_cnpj = Column(String(20), nullable=True)
    recipient_name = Column(String(200), nullable=True)
    
    vProd = Column(Numeric(19, 4), nullable=True)
    vNF = Column(Numeric(19, 4), nullable=True)
    
    cStat = Column(String(10), nullable=True)
    xMotivo = Column(String(250), nullable=True)
    nProt = Column(String(50), nullable=True)
    dhRecbto = Column(DateTime(timezone=True), nullable=True)
    xml_version = Column(String(10), nullable=True)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    analysis = relationship("NfeAnalysis", back_populates="fiscal_document")
    items = relationship("FiscalDocumentItem", back_populates="fiscal_document", cascade="all, delete-orphan")
    installments = relationship("FiscalDocumentInstallment", back_populates="fiscal_document", cascade="all, delete-orphan")
    payments = relationship("FiscalDocumentPayment", back_populates="fiscal_document", cascade="all, delete-orphan")


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
    
    # Store all taxes structure as JSONB
    tributos = Column(JSONB, nullable=True)

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
