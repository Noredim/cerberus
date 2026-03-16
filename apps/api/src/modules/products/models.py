import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.core.base import Base
from sqlalchemy import UniqueConstraint, Numeric
from sqlalchemy import UniqueConstraint

class Product(Base):
    __tablename__ = "products"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    
    codigo = Column(String(50), nullable=False, index=True)
    nome = Column(String(255), nullable=False)
    descricao = Column(Text)
    
    tipo = Column(String(20), nullable=False) # EQUIPAMENTO, SERVICO
    finalidade = Column(String(20), nullable=False) # REVENDA, ATIVO
    
    unidade = Column(String(20))
    categoria = Column(String(100))
    marca = Column(String(100))
    modelo = Column(String(100))
    part_number = Column(String(50))
    
    ncm_codigo = Column(String(20), index=True)
    cest_codigo = Column(String(20), index=True)
    cmt_codigo = Column(String(20), index=True)
    
    ativo = Column(Boolean, default=True)
    
    ultimo_preco_compra = Column(Numeric(15, 4), nullable=True)
    data_ultimo_preco = Column(DateTime(timezone=True), nullable=True)
    fornecedor_ultimo_preco_id = Column(String, ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    company = relationship("Company")
    tenant = relationship("Tenant")
    suppliers = relationship("ProductSupplier", back_populates="product", cascade="all, delete-orphan")


class ProductSupplier(Base):
    __tablename__ = "product_suppliers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = Column(String, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True)
    
    codigo_externo = Column(String(100), nullable=False)
    unidade = Column(String(20), nullable=False)
    fator_conversao = Column(String, nullable=False) # Guardaremos como string decimal ou converteremos para Numeric
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Constraints: The same supplier cannot have two items with the exact same external code
    __table_args__ = (
        UniqueConstraint('supplier_id', 'codigo_externo', name='uq_supplier_codigo_externo'),
    )

    product = relationship("Product", back_populates="suppliers")
    supplier = relationship("Supplier")
