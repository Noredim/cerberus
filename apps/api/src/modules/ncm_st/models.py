import uuid
import datetime
from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, Numeric, Integer, Index
from sqlalchemy.orm import relationship
from src.core.base import Base

def generate_uuid():
    return str(uuid.uuid4())

class NcmStHeader(Base):
    __tablename__ = "cad_ncm_st"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    state_id = Column(String, ForeignKey("states.id", ondelete="CASCADE"), index=True, nullable=False)
    description = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    created_by = Column(String, nullable=True) # User ID
    updated_by = Column(String, nullable=True) # User ID

    tenant = relationship("Tenant")
    state = relationship("State")

    __table_args__ = (
        Index('ix_cad_ncm_st_uf_desc', 'state_id', 'description'),
    )

class NcmStItem(Base):
    __tablename__ = "cad_ncm_st_item"

    id = Column(String, primary_key=True, default=generate_uuid)
    cad_ncm_st_id = Column(String, ForeignKey("cad_ncm_st.id", ondelete="CASCADE"), index=True, nullable=False)
    
    item = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True)
    ncm_sh = Column(String(20), nullable=True)
    ncm_normalizado = Column(String(20), index=True, nullable=True)
    cest = Column(String(20), nullable=True)
    descricao = Column(String, nullable=True)
    observacoes = Column(String, nullable=True)
    vigencia_inicio = Column(DateTime, index=True, nullable=True)
    fundamento = Column(String, nullable=True)
    segmento_anexo = Column(String(255), nullable=True)
    cest_normalizado = Column(String(20), index=True, nullable=True)
    mva_percent = Column(Numeric(10, 4), nullable=True)
    vigencia_fim = Column(DateTime, index=True, nullable=True)
    
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    header = relationship("NcmStHeader", backref="items")
