from sqlalchemy import Column, String, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from src.core.base import Base
from sqlalchemy.sql import func

class CepCache(Base):
    __tablename__ = "cep_cache"
    
    cep = Column(String(8), primary_key=True)
    logradouro = Column(String(255))
    bairro = Column(String(255))
    cidade = Column(String(255))
    uf = Column(String(2))
    ibge = Column(String(7), nullable=True)
    fonte = Column(String(50), default="viacep")
    raw_json = Column(JSONB)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
