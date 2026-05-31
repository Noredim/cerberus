import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Numeric, Integer, Text, Date
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.core.base import Base
import src.modules.companies.models

class FormaPagamento(Base):
    __tablename__ = "formas_pagamento"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    descricao = Column(String(100), nullable=False)
    tipo_uso = Column(String(20), nullable=False)  # 'COMPRA', 'VENDA', 'AMBOS'
    tipo_distribuicao = Column(String(20), nullable=False)  # 'PERCENTUAL', 'RATEIO_IGUAL', 'VALOR_FIXO'
    ativo = Column(Boolean, nullable=False, default=True)
    observacao = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    parcelas = relationship(
        "FormaPagamentoParcela", 
        back_populates="forma_pagamento", 
        cascade="all, delete-orphan", 
        order_by="FormaPagamentoParcela.sequencia"
    )


class FormaPagamentoParcela(Base):
    __tablename__ = "formas_pagamento_parcelas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    forma_pagamento_id = Column(UUID(as_uuid=True), ForeignKey("formas_pagamento.id", ondelete="CASCADE"), nullable=False, index=True)
    sequencia = Column(Integer, nullable=False)
    descricao = Column(String(100), nullable=False)
    intervalo_dias = Column(Integer, nullable=False)
    percentual = Column(Numeric(10, 4), nullable=True)
    valor_fixo = Column(Numeric(15, 4), nullable=True)

    # Relationships
    forma_pagamento = relationship("FormaPagamento", back_populates="parcelas")


class PlanejamentoFinanceiro(Base):
    __tablename__ = "planejamento_financeiro"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    origem_tipo = Column(String(30), nullable=False)  # 'SALES_BUDGET', 'PURCHASE_BUDGET'
    origem_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    numero_parcela = Column(Integer, nullable=False)
    descricao = Column(String(150), nullable=False)
    data_prevista = Column(Date, nullable=False)
    valor_previsto = Column(Numeric(15, 4), nullable=False)
    tipo_movimento = Column(String(20), nullable=False)  # 'RECEBIMENTO', 'PAGAMENTO'
    status = Column(String(20), nullable=False, default='PREVISTO')  # 'PREVISTO', 'REALIZADO'

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    company = relationship("Company")
