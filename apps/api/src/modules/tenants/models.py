import uuid
import datetime
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from src.core.base import Base

def generate_uuid():
    return str(uuid.uuid4())

class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(String, primary_key=True, default=generate_uuid)
    cnpj = Column(String, unique=True, index=True, nullable=False)
    razao_social = Column(String, nullable=False)
    nome_fantasia = Column(String)
    municipality_id = Column(String) # Será foreign key depois
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    cnaes = relationship("TenantCnae", back_populates="tenant", cascade="all, delete-orphan")

class TenantCnae(Base):
    __tablename__ = "tenant_cnaes"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    cnae = Column(String, nullable=False)
    descricao = Column(String)
    is_primary = Column(Boolean, default=False)

    tenant = relationship("Tenant", back_populates="cnaes")
