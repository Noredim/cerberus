import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Numeric, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.core.base import Base
import src.modules.professionals.models


class SalesBudget(Base):
    __tablename__ = "sales_budgets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String, ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    vendedor_id = Column(String, ForeignKey("professionals.id", ondelete="SET NULL"), nullable=True, index=True)

    numero_orcamento = Column(String(50), nullable=True)
    titulo = Column(String(255), nullable=False)
    observacoes = Column(Text, nullable=True)
    data_orcamento = Column(DateTime(timezone=True), nullable=False, default=func.now())
    status = Column(String(20), nullable=False, default="RASCUNHO")  # RASCUNHO, APROVADO, ARQUIVADO

    # ── Sale tab defaults ──
    markup_padrao = Column(Numeric(10, 4), nullable=False, default=1.0)
    perc_despesa_adm = Column(Numeric(6, 4), nullable=False, default=0)
    perc_comissao = Column(Numeric(6, 4), nullable=False, default=0)
    perc_frete_venda = Column(Numeric(6, 4), nullable=False, default=0)
    perc_pis = Column(Numeric(6, 4), nullable=False, default=0)
    perc_cofins = Column(Numeric(6, 4), nullable=False, default=0)
    perc_csll = Column(Numeric(6, 4), nullable=False, default=0)
    perc_irpj = Column(Numeric(6, 4), nullable=False, default=0)
    perc_iss = Column(Numeric(6, 4), nullable=False, default=0)
    perc_icms_interno = Column(Numeric(6, 4), nullable=False, default=0)
    perc_icms_externo = Column(Numeric(6, 4), nullable=False, default=0)

    # Venda margin factors (markup)
    venda_markup_produtos = Column(Numeric(10, 4), nullable=False, default=1.0)
    venda_markup_servicos = Column(Numeric(10, 4), nullable=False, default=1.0)
    venda_markup_instalacao = Column(Numeric(10, 4), nullable=False, default=1.0)
    venda_markup_manutencao = Column(Numeric(10, 4), nullable=False, default=1.0)
    venda_havera_manutencao = Column(Boolean, nullable=False, default=False)
    venda_qtd_meses_manutencao = Column(Integer, nullable=False, default=0)

    # ── Rental/Comodato tab defaults ──
    prazo_contrato_meses = Column(Integer, nullable=False, default=36)
    prazo_instalacao_meses = Column(Integer, nullable=False, default=1)
    taxa_juros_mensal = Column(Numeric(10, 6), nullable=False, default=0)
    taxa_manutencao_anual = Column(Numeric(6, 4), nullable=False, default=5)
    tipo_receita_rental = Column(String(50), nullable=False, default="LOCACAO_PURA")
    fator_margem_padrao = Column(Numeric(6, 4), nullable=False, default=1)
    fator_manutencao_padrao = Column(Numeric(6, 4), nullable=False, default=1)
    perc_instalacao_padrao = Column(Numeric(6, 4), nullable=False, default=0)
    perc_comissao_rental = Column(Numeric(6, 4), nullable=False, default=0)
    perc_pis_rental = Column(Numeric(6, 4), nullable=False, default=0)
    perc_cofins_rental = Column(Numeric(6, 4), nullable=False, default=0)
    perc_csll_rental = Column(Numeric(6, 4), nullable=False, default=0)
    perc_irpj_rental = Column(Numeric(6, 4), nullable=False, default=0)
    perc_iss_rental = Column(Numeric(6, 4), nullable=False, default=0)
    perc_comissao_diretoria = Column(Numeric(6, 4), nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    company = relationship("Company")
    customer = relationship("Customer")
    vendedor = relationship("Professional")
    items = relationship("SalesBudgetItem", back_populates="budget", cascade="all, delete-orphan")
    rental_items = relationship("RentalBudgetItem", back_populates="budget", cascade="all, delete-orphan")
    responsaveis = relationship("SalesBudgetResponsavel", back_populates="budget", cascade="all, delete-orphan")


class SalesBudgetResponsavel(Base):
    __tablename__ = "sales_budget_responsaveis"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_id = Column(UUID(as_uuid=True), ForeignKey("sales_budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    budget = relationship("SalesBudget", back_populates="responsaveis")
    user = relationship("User")


class SalesBudgetItem(Base):
    __tablename__ = "sales_budget_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_id = Column(UUID(as_uuid=True), ForeignKey("sales_budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_kit_id = Column(UUID(as_uuid=True), ForeignKey("opportunity_kits.id", ondelete="SET NULL"), nullable=True, index=True)

    tipo_item = Column(String(30), nullable=False)  # MERCADORIA, SERVICO_INSTALACAO, SERVICO_MANUTENCAO
    descricao_servico = Column(String(255), nullable=True)
    usa_parametros_padrao = Column(Boolean, nullable=False, default=True)

    # Cost & sale
    custo_unit_base = Column(Numeric(15, 4), nullable=False, default=0)
    markup = Column(Numeric(10, 4), nullable=False, default=1.0)
    venda_unit = Column(Numeric(15, 4), nullable=False, default=0)

    # Freight
    perc_frete_venda = Column(Numeric(6, 4), nullable=False, default=0)
    frete_venda_unit = Column(Numeric(15, 4), nullable=False, default=0)

    # Federal taxes
    perc_pis = Column(Numeric(6, 4), nullable=False, default=0)
    pis_unit = Column(Numeric(15, 4), nullable=False, default=0)
    perc_cofins = Column(Numeric(6, 4), nullable=False, default=0)
    cofins_unit = Column(Numeric(15, 4), nullable=False, default=0)
    perc_csll = Column(Numeric(6, 4), nullable=False, default=0)
    csll_unit = Column(Numeric(15, 4), nullable=False, default=0)
    perc_irpj = Column(Numeric(6, 4), nullable=False, default=0)
    irpj_unit = Column(Numeric(15, 4), nullable=False, default=0)

    # ICMS (merchandise only)
    perc_icms = Column(Numeric(6, 4), nullable=False, default=0)
    icms_unit = Column(Numeric(15, 4), nullable=False, default=0)
    tem_st = Column(Boolean, nullable=False, default=False)

    # ISS (services only)
    perc_iss = Column(Numeric(6, 4), nullable=False, default=0)
    iss_unit = Column(Numeric(15, 4), nullable=False, default=0)

    # Administrative & commission
    perc_despesa_adm = Column(Numeric(6, 4), nullable=False, default=0)
    despesa_adm_unit = Column(Numeric(15, 4), nullable=False, default=0)
    perc_comissao = Column(Numeric(6, 4), nullable=False, default=0)
    comissao_unit = Column(Numeric(15, 4), nullable=False, default=0)

    # Result
    lucro_unit = Column(Numeric(15, 4), nullable=False, default=0)
    margem_unit = Column(Numeric(10, 4), nullable=False, default=0)
    quantidade = Column(Numeric(15, 4), nullable=False, default=1)
    total_venda = Column(Numeric(15, 4), nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    budget = relationship("SalesBudget", back_populates="items")
    product = relationship("Product")
    opportunity_kit = relationship("OpportunityKit")

    @property
    def product_nome(self):
        if self.opportunity_kit:
            return f"Kit: {self.opportunity_kit.nome_kit or 'Personalizado'}"
        return self.product.nome if self.product else self.descricao_servico

    @property
    def product_codigo(self):
        if self.opportunity_kit:
            return "KIT-GLOBAL"
        return self.product.codigo if self.product else None


class RentalBudgetItem(Base):
    """Item de Locação / Comodato — ativo adquirido para projeto de locação."""
    __tablename__ = "rental_budget_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    budget_id = Column(UUID(as_uuid=True), ForeignKey("sales_budgets.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    opportunity_kit_id = Column(UUID(as_uuid=True), ForeignKey("opportunity_kits.id", ondelete="SET NULL"), nullable=True, index=True)
    
    custo_op_mensal_kit = Column(Numeric(15, 4), nullable=True)
    
    is_kit_instalacao = Column(Boolean, nullable=False, default=False)
    tipo_contrato_kit = Column(String(50), nullable=True)
    kit_taxa_juros_mensal = Column(Numeric(15, 6), nullable=True)
    kit_custo_produtos = Column(Numeric(15, 4), nullable=True)
    kit_custo_servicos = Column(Numeric(15, 4), nullable=True)
    
    kit_pis = Column(Numeric(6, 4), nullable=True)
    kit_cofins = Column(Numeric(6, 4), nullable=True)
    kit_csll = Column(Numeric(6, 4), nullable=True)
    kit_irpj = Column(Numeric(6, 4), nullable=True)
    kit_iss = Column(Numeric(6, 4), nullable=True)

    # Kit calculated override values — persisted to survive reloads without re-fetching kit financials
    kit_vlt_manut = Column(Numeric(15, 4), nullable=True)
    kit_valor_mensal = Column(Numeric(15, 4), nullable=True)
    kit_valor_impostos = Column(Numeric(15, 4), nullable=True)
    kit_receita_liquida = Column(Numeric(15, 4), nullable=True)
    kit_lucro_mensal = Column(Numeric(15, 4), nullable=True)
    kit_margem = Column(Numeric(10, 4), nullable=True)

    quantidade = Column(Numeric(15, 4), nullable=False, default=1)

    # ── Acquisition cost breakdown ──
    custo_aquisicao_unit = Column(Numeric(15, 4), nullable=False, default=0)  # Base product price
    ipi_unit = Column(Numeric(15, 4), nullable=False, default=0)
    frete_unit = Column(Numeric(15, 4), nullable=False, default=0)
    icms_st_unit = Column(Numeric(15, 4), nullable=False, default=0)
    difal_unit = Column(Numeric(15, 4), nullable=False, default=0)
    custo_total_aquisicao = Column(Numeric(15, 4), nullable=False, default=0)  # Sum of all above

    # ── Contract terms ──
    prazo_contrato = Column(Integer, nullable=False, default=36)
    usa_taxa_manut_padrao = Column(Boolean, nullable=False, default=True)
    taxa_manutencao_anual_item = Column(Numeric(6, 4), nullable=True)

    # ── Item specific installation (mutually exclusive) ──
    perc_instalacao_item = Column(Numeric(6, 4), nullable=True)
    valor_instalacao_item = Column(Numeric(15, 4), nullable=True)

    # ── Monthly cost structure ──
    custo_manut_mensal = Column(Numeric(15, 4), nullable=False, default=0)
    custo_total_mensal = Column(Numeric(15, 4), nullable=False, default=0)

    # ── Revenue (Price formula) ──
    fator_margem = Column(Numeric(10, 4), nullable=False, default=1)
    valor_venda_equipamento = Column(Numeric(15, 4), nullable=False, default=0)
    parcela_locacao = Column(Numeric(15, 4), nullable=False, default=0)
    manutencao_locacao = Column(Numeric(15, 4), nullable=False, default=0)
    valor_mensal = Column(Numeric(15, 4), nullable=False, default=0)

    # ── Taxes on revenue ──
    perc_impostos_total = Column(Numeric(6, 4), nullable=False, default=0)
    impostos_mensal = Column(Numeric(15, 4), nullable=False, default=0)
    receita_liquida_mensal = Column(Numeric(15, 4), nullable=False, default=0)

    # ── Commission ──
    perc_comissao = Column(Numeric(6, 4), nullable=False, default=0)
    comissao_mensal = Column(Numeric(15, 4), nullable=False, default=0)

    # ── Result ──
    lucro_mensal = Column(Numeric(15, 4), nullable=False, default=0)
    margem = Column(Numeric(10, 4), nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    budget = relationship("SalesBudget", back_populates="rental_items")
    product = relationship("Product")
    opportunity_kit = relationship("OpportunityKit")

    @property
    def product_nome(self):
        if self.opportunity_kit:
            return f"Kit: {self.opportunity_kit.nome_kit or 'Personalizado'}"
        return self.product.nome if self.product else None

    @property
    def product_codigo(self):
        if self.opportunity_kit:
            return "KIT-GLOBAL"
        return self.product.codigo if self.product else None

