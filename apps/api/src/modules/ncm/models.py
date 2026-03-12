from sqlalchemy import Column, String, DateTime, Date, ForeignKey, Index, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from src.core.base import Base
import uuid
from sqlalchemy.sql import func

class NcmImportacao(Base):
    __tablename__ = "ncm_importacao"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    data_ultima_atualizacao_ncm = Column(String(50)) # Keeping as string to match JSON raw meta
    ato = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    nomenclaturas = relationship("Ncm", back_populates="importacao", cascade="all, delete-orphan")

class Ncm(Base):
    __tablename__ = "ncm"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    importacao_id = Column(UUID(as_uuid=True), ForeignKey("ncm_importacao.id", ondelete="SET NULL"), nullable=True)
    
    codigo = Column(String(20), nullable=False, index=True)
    descricao = Column(Text, nullable=False)
    data_inicio = Column(Date, nullable=False)
    data_fim = Column(Date, nullable=False)
    
    tipo_ato_ini = Column(String(100))
    numero_ato_ini = Column(String(20))
    ano_ato_ini = Column(String(4))
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    importacao = relationship("NcmImportacao", back_populates="nomenclaturas")

    __table_args__ = (
        UniqueConstraint('codigo', 'data_inicio', 'data_fim', name='uq_ncm_codigo_vigencia'),
        Index('ix_ncm_codigo_vigencia', 'codigo', 'data_inicio', 'data_fim'),
    )
