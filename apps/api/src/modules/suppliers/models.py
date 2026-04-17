from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from src.core.base import Base
from datetime import datetime
import uuid
from sqlalchemy.dialects.postgresql import UUID

class Supplier(Base):
    __tablename__ = "suppliers"

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, index=True, nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Identificação
    cnpj = Column(String, index=True, nullable=False)
    razao_social = Column(String, nullable=False)
    nome_fantasia = Column(String)
    
    # Contato
    email = Column(String)
    telefone = Column(String)
    
    # Endereço
    cep = Column(String)
    logradouro = Column(String)
    numero = Column(String)
    complemento = Column(String)
    bairro = Column(String)
    
    # Relacionamentos com catálogo
    municipality_id = Column(String, ForeignKey("cities.id"))
    state_id = Column(String, ForeignKey("states.id"))
    
    # Status e Auditoria
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    city = relationship("City")
    state = relationship("State")

    @property
    def uf(self):
        return self.state.sigla if self.state else None
