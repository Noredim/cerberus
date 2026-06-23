from sqlalchemy import Column, String, DateTime, Date, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.core.base import Base
import uuid
from sqlalchemy.sql import func

class TipiImportacao(Base):
    __tablename__ = "tipi_importacao"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    arquivo_nome = Column(String(255), nullable=False)
    vigencia = Column(Date, nullable=False)
    total_linhas = Column(Integer, nullable=False, default=0)
    total_importados = Column(Integer, nullable=False, default=0)
    total_ignorados = Column(Integer, nullable=False, default=0)
    total_erros = Column(Integer, nullable=False, default=0)
    status = Column(String(50), nullable=False)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    aliquotas = relationship("NcmTipi", back_populates="importacao", cascade="all, delete-orphan")


class NcmTipi(Base):
    __tablename__ = "ncm_tipi"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ncm_id = Column(UUID(as_uuid=True), ForeignKey("ncm.id", ondelete="CASCADE"), nullable=False)
    importacao_id = Column(UUID(as_uuid=True), ForeignKey("tipi_importacao.id", ondelete="CASCADE"), nullable=False)
    aliquota = Column(Numeric(10, 4), nullable=False)
    vigencia = Column(Date, nullable=False)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    ncm = relationship("Ncm", foreign_keys=[ncm_id])
    importacao = relationship("TipiImportacao", back_populates="aliquotas")
