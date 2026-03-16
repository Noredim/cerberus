import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Numeric, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.core.base import Base

class PaymentCondition(Base):
    __tablename__ = "payment_conditions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    descricao = Column(String(100), nullable=False)
    prazo = Column(Integer, nullable=False, default=0) # e.g. 30 days
    parcelas = Column(Integer, nullable=False, default=1) # number of installments

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

class PurchaseBudget(Base):
    __tablename__ = "purchase_budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    
    supplier_id = Column(String, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True)
    payment_condition_id = Column(UUID(as_uuid=True), ForeignKey("payment_conditions.id", ondelete="SET NULL"), nullable=True)

    data_orcamento = Column(DateTime(timezone=True), nullable=False, default=func.now())
    validade = Column(DateTime(timezone=True), nullable=True)
    numero_orcamento = Column(String(50), nullable=True)
    vendedor_nome = Column(String(100), nullable=True)
    vendedor_telefone = Column(String(50), nullable=True)
    vendedor_email = Column(String(100), nullable=True)
    
    tipo_orcamento = Column(String(50), nullable=False) # 'REVENDA', 'ATIVO_IMOBILIZADO_USO_CONSUMO'
    frete_tipo = Column(String(10), nullable=False) # 'CIF', 'FOB'
    frete_percent = Column(Numeric(10, 4), nullable=False, default=0)
    ipi_calculado = Column(Boolean, nullable=False, default=False)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    supplier = relationship("Supplier")
    payment_condition = relationship("PaymentCondition")
    items = relationship("PurchaseBudgetItem", back_populates="budget", cascade="all, delete-orphan")
    negotiations = relationship("PurchaseBudgetNegotiation", back_populates="budget", cascade="all, delete-orphan")

    @property
    def supplier_nome_fantasia(self):
        return self.supplier.nome_fantasia if self.supplier else None

    @property
    def supplier_cnpj(self):
        return self.supplier.cnpj if self.supplier else None

    @property
    def valor_total(self):
        return sum(item.total_item for item in self.items) if self.items else 0


class PurchaseBudgetItem(Base):
    __tablename__ = "purchase_budget_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_id = Column(UUID(as_uuid=True), ForeignKey("purchase_budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    
    codigo_fornecedor = Column(String(100), nullable=True)
    ncm = Column(String(20), nullable=True)
    valor_unitario = Column(Numeric(15, 4), nullable=False, default=0)
    
    frete_percent = Column(Numeric(10, 4), nullable=False, default=0)
    frete_valor = Column(Numeric(15, 4), nullable=False, default=0)
    
    ipi_percent = Column(Numeric(10, 4), nullable=False, default=0)
    ipi_valor = Column(Numeric(15, 4), nullable=False, default=0)
    
    icms_percent = Column(Numeric(10, 4), nullable=False, default=0)
    
    total_item = Column(Numeric(15, 4), nullable=False, default=0)

    # Relationships
    budget = relationship("PurchaseBudget", back_populates="items")
    product = relationship("Product")
    negotiation_items = relationship("PurchaseBudgetNegotiationItem", back_populates="budget_item", cascade="all, delete-orphan")

    @property
    def product_nome(self):
        return self.product.nome if self.product else None


class PurchaseBudgetNegotiation(Base):
    __tablename__ = "purchase_budget_negotiations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_id = Column(UUID(as_uuid=True), ForeignKey("purchase_budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    
    data_negociacao = Column(DateTime(timezone=True), nullable=False, default=func.now())
    desconto_percent = Column(Numeric(10, 4), nullable=True, default=0) # Geral
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    budget = relationship("PurchaseBudget", back_populates="negotiations")
    items = relationship("PurchaseBudgetNegotiationItem", back_populates="negotiation", cascade="all, delete-orphan")


class PurchaseBudgetNegotiationItem(Base):
    __tablename__ = "purchase_budget_negotiation_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    negotiation_id = Column(UUID(as_uuid=True), ForeignKey("purchase_budget_negotiations.id", ondelete="CASCADE"), nullable=False, index=True)
    budget_item_id = Column(UUID(as_uuid=True), ForeignKey("purchase_budget_items.id", ondelete="CASCADE"), nullable=False, index=True)
    
    valor_original = Column(Numeric(15, 4), nullable=False, default=0)
    desconto_percent = Column(Numeric(10, 4), nullable=True, default=0)
    valor_final = Column(Numeric(15, 4), nullable=False, default=0)

    # Relationships
    negotiation = relationship("PurchaseBudgetNegotiation", back_populates="items")
    budget_item = relationship("PurchaseBudgetItem", back_populates="negotiation_items")
