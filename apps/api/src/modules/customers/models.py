from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from src.core.base import Base
from datetime import datetime
import uuid
from sqlalchemy.dialects.postgresql import UUID
from typing import Optional

class Customer(Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint('tenant_id', 'cnpj', name='uq_customer_tenant_cnpj'),
    )

    id = Column(String, primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, index=True, nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Identificação
    cnpj = Column(String, index=True, nullable=False)
    razao_social = Column(String, nullable=False)
    nome_fantasia = Column(String)
    
    # Categorização
    tipo = Column(String(20), nullable=False, default="PRIVADO") # PRIVADO, PUBLICO
    esfera = Column(String(20)) # MUNICIPAL, ESTADUAL, FEDERAL, AUTARQUIA
    
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
    def city_nome(self) -> Optional[str]:
        return self.city.nome if self.city else None

    @property
    def state_sigla(self) -> Optional[str]:
        return self.state.sigla if self.state else None
