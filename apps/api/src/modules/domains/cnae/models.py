from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from src.core.base import Base

class CnaeDomain(Base):
    __tablename__ = "dim_cnae"
    __table_args__ = {"schema": "gov"}

    codigo = Column(String(10), primary_key=True)
    descricao = Column(Text, nullable=False)
    codigo_norm = Column(String(10), index=True)
    descricao_norm = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    source_file = Column(Text)
    source_loaded_at = Column(DateTime(timezone=True))
