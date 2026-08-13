import uuid
from typing import Optional
from sqlalchemy import Column, String, Numeric, Text, DateTime, ForeignKey, Integer, UniqueConstraint, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from src.core.base import Base

JSONType = JSON().with_variant(JSONB, "postgresql")



class TaxRecoveryAnalysis(Base):
    __tablename__ = "tax_recovery_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    entry_purpose = Column(String(50), nullable=False)  # REVENDA, USO_CONSUMO, ATIVO_IMOBILIZADO
    real_destination = Column(String(50), nullable=False)  # REVENDA, USO_CONSUMO, ATIVO_IMOBILIZADO
    status = Column(String(30), default="RASCUNHO", index=True)  # RASCUNHO, EM_PROCESSAMENTO, PROCESSADA, PROCESSADA_COM_PENDENCIAS, CONCLUIDA, CANCELADA

    total_notes_count = Column(Integer, default=0)
    total_notes_value = Column(Numeric(19, 4), default=0)
    total_icms_st_original = Column(Numeric(19, 4), default=0)
    total_difal_original = Column(Numeric(19, 4), default=0)
    total_icms_st_recalculated = Column(Numeric(19, 4), default=0)
    total_difal_recalculated = Column(Numeric(19, 4), default=0)
    total_to_recover = Column(Numeric(19, 4), default=0)
    total_to_collect = Column(Numeric(19, 4), default=0)
    net_balance = Column(Numeric(19, 4), default=0)
    pending_items_count = Column(Integer, default=0)
    pending_notes_value = Column(Numeric(19, 4), default=0)

    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    documents = relationship("TaxRecoveryDocument", back_populates="tax_recovery", cascade="all, delete-orphan")
    creator = relationship("User", foreign_keys=[created_by])
    updater = relationship("User", foreign_keys=[updated_by])
    tenant = relationship("Tenant", foreign_keys=[tenant_id])


class TaxRecoveryDocument(Base):
    __tablename__ = "tax_recovery_documents"
    __table_args__ = (
        UniqueConstraint("tax_recovery_id", "fiscal_document_id", name="uq_tax_recovery_doc"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tax_recovery_id = Column(UUID(as_uuid=True), ForeignKey("tax_recovery_analyses.id", ondelete="CASCADE"), nullable=False, index=True)
    fiscal_document_id = Column(UUID(as_uuid=True), ForeignKey("fiscal_documents.id", ondelete="RESTRICT"), nullable=False, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    calculation_status = Column(String(30), default="OK")  # OK, PENDENTE_PARAMETRIZACAO, ERRO
    status_message = Column(Text, nullable=True)

    icms_st_original = Column(Numeric(19, 4), default=0)
    difal_original = Column(Numeric(19, 4), default=0)
    icms_st_recalculated = Column(Numeric(19, 4), default=0)
    difal_recalculated = Column(Numeric(19, 4), default=0)
    total_to_recover = Column(Numeric(19, 4), default=0)
    total_to_collect = Column(Numeric(19, 4), default=0)
    net_balance = Column(Numeric(19, 4), default=0)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    tax_recovery = relationship("TaxRecoveryAnalysis", back_populates="documents")
    fiscal_document = relationship("FiscalDocument")
    item_results = relationship("TaxRecoveryItemResult", back_populates="tax_recovery_document", cascade="all, delete-orphan")


class TaxRecoveryItemResult(Base):
    __tablename__ = "tax_recovery_item_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tax_recovery_document_id = Column(UUID(as_uuid=True), ForeignKey("tax_recovery_documents.id", ondelete="CASCADE"), nullable=False, index=True)
    fiscal_document_item_id = Column(UUID(as_uuid=True), ForeignKey("fiscal_document_items.id", ondelete="CASCADE"), nullable=False, index=True)
    nItem = Column(Integer, nullable=False)
    status = Column(String(30), default="SEM_DIFERENCA", index=True)  # A_RECUPERAR, A_RECOLHER, SEM_DIFERENCA, PENDENTE_PARAMETRIZACAO

    icms_st_original = Column(Numeric(19, 4), default=0)
    icms_st_recalculated = Column(Numeric(19, 4), default=0)
    icms_st_diff = Column(Numeric(19, 4), default=0)

    difal_original = Column(Numeric(19, 4), default=0)
    difal_recalculated = Column(Numeric(19, 4), default=0)
    difal_diff = Column(Numeric(19, 4), default=0)

    total_to_recover = Column(Numeric(19, 4), default=0)
    total_to_collect = Column(Numeric(19, 4), default=0)
    net_balance = Column(Numeric(19, 4), default=0)

    original_scenario_json = Column(JSONType, nullable=True)
    destination_scenario_json = Column(JSONType, nullable=True)
    audit_memory_json = Column(JSONType, nullable=True)
    pending_reasons = Column(JSONType, nullable=True)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    tax_recovery_document = relationship("TaxRecoveryDocument", back_populates="item_results")
    fiscal_document_item = relationship("FiscalDocumentItem")
