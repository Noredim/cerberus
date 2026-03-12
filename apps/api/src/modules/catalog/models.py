import uuid
import enum
import datetime
from sqlalchemy import Column, String, ForeignKey, Enum, Boolean, Integer, DateTime, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from src.core.base import Base

def generate_uuid():
    return str(uuid.uuid4())

class SyncJobStatus(enum.Enum):
    RUNNING = "RUNNING"
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"

class State(Base):
    __tablename__ = "states"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    ibge_id = Column(Integer, index=True, nullable=False)
    
    sigla = Column(String(2), index=True, nullable=False)
    nome = Column(String(100), index=True, nullable=False)
    regiao_nome = Column(String(50), nullable=True)
    regiao_sigla = Column(String(5), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    last_sync_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint('tenant_id', 'ibge_id', name='uq_state_tenant_ibge_id'),
    )

    tenant = relationship("Tenant")

class City(Base):
    __tablename__ = "cities"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    ibge_id = Column(Integer, index=True, nullable=False)
    state_id = Column(String, ForeignKey("states.id", ondelete="CASCADE"), index=True, nullable=False)
    
    nome = Column(String(150), index=True, nullable=False)
    microregiao = Column(String(150), nullable=True)
    mesorregiao = Column(String(150), nullable=True)
    
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)
    last_sync_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint('tenant_id', 'ibge_id', name='uq_city_tenant_ibge_id'),
    )

    tenant = relationship("Tenant")
    state = relationship("State", backref="cities")

class IbgeSyncJob(Base):
    __tablename__ = "ibge_sync_jobs"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    
    started_at = Column(DateTime, default=datetime.datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
    
    status = Column(Enum(SyncJobStatus), default=SyncJobStatus.RUNNING, nullable=False)
    summary_json = Column(JSON, nullable=True) # Counter: states_created, states_updated, etc.
    error_message = Column(String, nullable=True)
    triggered_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    tenant = relationship("Tenant")
    user = relationship("User")
