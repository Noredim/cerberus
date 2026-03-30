import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.core.base import Base


class SolutionAnalysis(Base):
    __tablename__ = "solution_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)

    titulo = Column(String(150), nullable=False)
    tipo_analise = Column(String(20), nullable=False)  # REVENDA | LOCACAO

    nome_solucao_a = Column(String(100), nullable=True)
    nome_solucao_b = Column(String(100), nullable=True)
    nome_solucao_c = Column(String(100), nullable=True)

    # Audit
    usuario_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    criado_por_nome = Column(String(255), nullable=True)
    ultima_alteracao_por_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    ultima_alteracao_por_nome = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    company = relationship("Company")
    usuario = relationship("User", foreign_keys=[usuario_id])
    items = relationship(
        "SolutionAnalysisItem",
        back_populates="analise",
        cascade="all, delete-orphan",
        order_by="SolutionAnalysisItem.sequencia",
    )


class SolutionAnalysisItem(Base):
    __tablename__ = "solution_analysis_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    analise_id = Column(
        UUID(as_uuid=True),
        ForeignKey("solution_analyses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sequencia = Column(Integer, nullable=False, default=0)

    # Solução A
    item_a_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    item_a_nome = Column(String(255), nullable=True)
    qtd_a = Column(Numeric(15, 4), nullable=True)
    vlr_unit_a = Column(Numeric(18, 4), nullable=True)
    vlr_total_a = Column(Numeric(18, 4), nullable=True)

    # Solução B
    item_b_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    item_b_nome = Column(String(255), nullable=True)
    qtd_b = Column(Numeric(15, 4), nullable=True)
    vlr_unit_b = Column(Numeric(18, 4), nullable=True)
    vlr_total_b = Column(Numeric(18, 4), nullable=True)

    # Solução C
    item_c_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True)
    item_c_nome = Column(String(255), nullable=True)
    qtd_c = Column(Numeric(15, 4), nullable=True)
    vlr_unit_c = Column(Numeric(18, 4), nullable=True)
    vlr_total_c = Column(Numeric(18, 4), nullable=True)

    # Result
    melhor_solucao = Column(String(10), nullable=True)   # A | B | C | EMPATE
    diferenca_valor = Column(Numeric(18, 4), nullable=True)
    diferenca_percentual = Column(Numeric(8, 4), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    analise = relationship("SolutionAnalysis", back_populates="items")
    produto_a = relationship("Product", foreign_keys=[item_a_id])
    produto_b = relationship("Product", foreign_keys=[item_b_id])
    produto_c = relationship("Product", foreign_keys=[item_c_id])
