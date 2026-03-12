from sqlalchemy import Column, String, DateTime, Numeric, Date, Boolean, ForeignKey, Integer, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from src.core.base import Base
import uuid
from sqlalchemy.sql import func
from decimal import Decimal

class Opportunity(Base):
    __tablename__ = "opportunities"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    numero_oportunidade = Column(String(50), unique=True, nullable=False) # Auto generated
    titulo_oportunidade = Column(String(255), nullable=False)
    
    cliente_id = Column(String, ForeignKey("customers.id"))
    tipo_cliente = Column(String(20), default="PRIVADO") # PRIVADO | PUBLICO
    tipo_operacao = Column(String(50), default="VENDA") # VENDA | COMODATO_LOCACAO
    
    possui_instalacao = Column(Boolean, default=False)
    possui_manutencao = Column(Boolean, default=False)
    
    status = Column(String(50), default="RASCUNHO") # RASCUNHO | EM_FORMACAO | EM_COTACAO | EM_ANALISE | PRECIFICADO | PROPOSTA_EMITIDA | GANHA | PERDIDA | CANCELADA
    
    data_abertura = Column(Date, default=func.current_date())
    responsavel_comercial = Column(String(255))
    origem_oportunidade = Column(String(100))
    observacoes = Column(Text)
    
    empresa_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="RESTRICT"), nullable=False)
    perfil_tributario_origem_id = Column(UUID(as_uuid=True), ForeignKey("company_tax_profiles.id", ondelete="RESTRICT"), nullable=False)
    
    valor_total_calculado = Column(Numeric(15, 2), default=0.00)
    margem_estimada = Column(Numeric(10, 2), default=0.00)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    # Relationships
    customer = relationship("Customer")
    company = relationship("Company")
    tax_profile = relationship("CompanyTaxProfile")
    
    parameters_sales = relationship("OpportunityParametersSales", back_populates="opportunity", uselist=False, cascade="all, delete-orphan")
    parameters_rent = relationship("OpportunityParametersRent", back_populates="opportunity", uselist=False, cascade="all, delete-orphan")
    
    items = relationship("OpportunityItem", back_populates="opportunity", cascade="all, delete-orphan")
    budgets = relationship("OpportunityBudget", back_populates="opportunity", cascade="all, delete-orphan")
    installations = relationship("OpportunityInstallation", back_populates="opportunity", cascade="all, delete-orphan")
    maintenances = relationship("OpportunityMaintenance", back_populates="opportunity", cascade="all, delete-orphan")

class OpportunityParametersSales(Base):
    __tablename__ = "opportunity_parameters_sales"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    mkp_padrao = Column(Numeric(10, 2), default=0.00)
    percentual_despesas_administrativas = Column(Numeric(5, 2), default=0.00)
    percentual_comissao_padrao = Column(Numeric(5, 2), default=0.00)
    
    pis_percentual = Column(Numeric(5, 2), default=0.00)
    cofins_percentual = Column(Numeric(5, 2), default=0.00)
    csll_percentual = Column(Numeric(5, 2), default=0.00)
    irpj_percentual = Column(Numeric(5, 2), default=0.00)
    iss_percentual = Column(Numeric(5, 2), default=0.00)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    opportunity = relationship("Opportunity", back_populates="parameters_sales")

class OpportunityParametersRent(Base):
    __tablename__ = "opportunity_parameters_rent"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    prazo_contrato_meses = Column(Integer, default=12)
    tipo_receita = Column(String(50), default="COMODATO") # COMODATO | LOCACAO_PURA
    modo_precificacao = Column(String(50), default="CALCULAR_PRECO") # CALCULAR_PRECO | ANALISAR_PRECO
    
    margem_padrao_percentual = Column(Numeric(5, 2), default=0.00)
    comissao_receita_liquida_percentual = Column(Numeric(5, 2), default=0.00)
    
    pis_percentual = Column(Numeric(5, 2), default=0.00)
    cofins_percentual = Column(Numeric(5, 2), default=0.00)
    irpj_percentual = Column(Numeric(5, 2), default=0.00)
    csll_percentual = Column(Numeric(5, 2), default=0.00)
    iss_percentual = Column(Numeric(5, 2), default=0.00)
    
    fator_margem_locacao = Column(Numeric(14, 6), default=0.000000)
    taxa_juros_mensal_percentual = Column(Numeric(5, 2), default=0.00)
    taxa_manutencao_anual_percentual = Column(Numeric(5, 2), default=0.00)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    opportunity = relationship("Opportunity", back_populates="parameters_rent")

class OpportunityItem(Base):
    __tablename__ = "opportunity_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    
    descricao_manual = Column(String(255))
    produto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    
    tipo_item = Column(String(50), default="PRODUTO") # PRODUTO | KIT
    quantidade = Column(Numeric(15, 4), default=1)
    unidade = Column(String(20))
    valor_venda_unitario = Column(Numeric(15, 2))
    observacoes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    opportunity = relationship("Opportunity", back_populates="items")
    product = relationship("Product")
    kit_items = relationship("OpportunityItemKit", back_populates="item_pai", cascade="all, delete-orphan", foreign_keys="[OpportunityItemKit.item_pai_id]")

class OpportunityItemKit(Base):
    __tablename__ = "opportunity_items_kit"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    item_pai_id = Column(UUID(as_uuid=True), ForeignKey("opportunity_items.id", ondelete="CASCADE"), nullable=False)
    produto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    quantidade = Column(Numeric(15, 4), default=1)
    observacoes = Column(Text)
    
    item_pai = relationship("OpportunityItem", back_populates="kit_items", foreign_keys=[item_pai_id])
    product = relationship("Product")

class OpportunityBudget(Base):
    __tablename__ = "opportunity_budgets"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    
    tipo_orcamento = Column(String(50), default="REVENDA") # REVENDA | ATIVO_IMOBILIZADO_USO_CONSUMO
    fornecedor_id = Column(String, ForeignKey("suppliers.id"))
    nome_fornecedor_manual = Column(String(255))
    cnpj_fornecedor = Column(String(20))
    
    aliquota_orcamento = Column(Numeric(5, 2), default=0.00)
    criar_cenario_difal = Column(Boolean, default=False)
    
    moeda = Column(String(10), default="BRL")
    cambio = Column(Numeric(15, 6), default=1.0)
    data_cotacao = Column(Date)
    data_orcamento = Column(Date)
    numero_orcamento = Column(String(100))
    nome_vendedor = Column(String(255))
    arquivo_original = Column(String(500))
    origem_lancamento = Column(String(50), default="MANUAL") # UPLOAD_XLSX | MANUAL
    
    valor_total_itens = Column(Numeric(18, 6), default=0.0)
    valor_total_impostos = Column(Numeric(18, 6), default=0.0)
    valor_total_orcamento = Column(Numeric(18, 6), default=0.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    opportunity = relationship("Opportunity", back_populates="budgets")
    supplier = relationship("Supplier")
    items = relationship("OpportunityBudgetItem", back_populates="budget", cascade="all, delete-orphan")

class OpportunityBudgetItem(Base):
    __tablename__ = "opportunity_budget_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    orcamento_id = Column(UUID(as_uuid=True), ForeignKey("opportunity_budgets.id", ondelete="CASCADE"), nullable=False)
    
    codigo_fornecedor = Column(String(100))
    descricao = Column(String(255))
    quantidade = Column(Numeric(15, 4), default=1)
    unidade = Column(String(20))
    ncm = Column(String(10))
    ipi_percentual = Column(Numeric(5, 2), default=0.00)
    icms_percentual = Column(Numeric(5, 2), default=0.00)
    valor_unitario = Column(Numeric(15, 6), default=0.00)
    
    # Campos DIFAL
    uf_origem = Column(String(2))
    uf_destino = Column(String(2))
    operacao_interestadual = Column(Boolean, default=False)
    aliquota_orcamento_aplicada = Column(Numeric(5, 2), default=0.00)
    aliquota_interna_destino = Column(Numeric(5, 2), default=0.00)
    valor_icms_origem = Column(Numeric(15, 6), default=0.00)
    valor_difal_base = Column(Numeric(15, 6), default=0.00)
    valor_icms_st = Column(Numeric(15, 6), default=0.00)
    diferenca_difal_st = Column(Numeric(15, 6), default=0.00)
    valor_difal_aplicado = Column(Numeric(15, 6), default=0.00)
    custo_com_difal = Column(Numeric(15, 6), default=0.00)
    criar_cenario_difal_aplicado = Column(Boolean, default=False)
    
    produto_id = Column(UUID(as_uuid=True), ForeignKey("products.id"))
    oportunidade_item_id_vinculado = Column(UUID(as_uuid=True), ForeignKey("opportunity_items.id", ondelete="SET NULL")) # 1:1 linked item
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    budget = relationship("OpportunityBudget", back_populates="items")
    product = relationship("Product")
    linked_item = relationship("OpportunityItem", foreign_keys=[oportunidade_item_id_vinculado])

class OpportunityInstallation(Base):
    __tablename__ = "opportunity_installation_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    oportunidade_item_id_relacionado = Column(UUID(as_uuid=True), ForeignKey("opportunity_items.id", ondelete="CASCADE"))
    produto_servico_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    quantidade = Column(Numeric(15, 4), default=1)
    valor_unitario = Column(Numeric(15, 2), default=0.00)
    observacoes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    opportunity = relationship("Opportunity", back_populates="installations")
    related_item = relationship("OpportunityItem", foreign_keys=[oportunidade_item_id_relacionado])
    product = relationship("Product")

class OpportunityMaintenance(Base):
    __tablename__ = "opportunity_maintenance_items"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_id = Column(UUID(as_uuid=True), ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False)
    oportunidade_item_id_relacionado = Column(UUID(as_uuid=True), ForeignKey("opportunity_items.id", ondelete="CASCADE"))
    produto_servico_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    
    quantidade = Column(Numeric(15, 4), default=1)
    valor_unitario = Column(Numeric(15, 2), default=0.00)
    observacoes = Column(Text)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    
    opportunity = relationship("Opportunity", back_populates="maintenances")
    related_item = relationship("OpportunityItem", foreign_keys=[oportunidade_item_id_relacionado])
    product = relationship("Product")
