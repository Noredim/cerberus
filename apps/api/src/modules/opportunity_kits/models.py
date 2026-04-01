import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Numeric, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from src.core.base import Base


class OpportunityKit(Base):
    __tablename__ = "opportunity_kits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_budget_id = Column(UUID(as_uuid=True), ForeignKey("sales_budgets.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Dados Gerais
    nome_kit = Column(String(255), nullable=False)
    descricao_kit = Column(Text, nullable=True)
    quantidade_kits = Column(Integer, nullable=False, default=1)
    tipo_contrato = Column(String(50), nullable=False)  # COMODATO, LOCACAO, VENDA_EQUIPAMENTOS, INSTALACAO
    
    # Prazos do Contrato
    prazo_contrato_meses = Column(Integer, nullable=False)
    prazo_instalacao_meses = Column(Integer, nullable=False, default=0)
    
    # Parâmetros Financeiros
    fator_margem_locacao = Column(Numeric(10, 4), nullable=False, default=1.0)
    taxa_juros_mensal = Column(Numeric(10, 6), nullable=False, default=0.0)
    taxa_manutencao_anual = Column(Numeric(6, 4), nullable=False, default=0.0)
    
    # Flags de Instalação e Manutenção
    instalacao_inclusa = Column(Boolean, nullable=False, default=False)
    percentual_instalacao = Column(Numeric(10, 4), nullable=True)
    manutencao_inclusa = Column(Boolean, nullable=False, default=False)
    fator_manutencao = Column(Numeric(10, 4), nullable=True)
    fator_margem_instalacao = Column(Numeric(10, 4), nullable=False, default=1.0)
    fator_margem_manutencao = Column(Numeric(10, 4), nullable=False, default=1.0)
    fator_margem_servicos_produtos = Column(Numeric(10, 4), nullable=False, default=1.0)
    havera_manutencao = Column(Boolean, nullable=False, default=False)
    qtd_meses_manutencao = Column(Integer, nullable=True)
    
    # Impostos sobre Receita
    aliq_pis = Column(Numeric(6, 4), nullable=False, default=0.0)
    aliq_cofins = Column(Numeric(6, 4), nullable=False, default=0.0)
    aliq_csll = Column(Numeric(6, 4), nullable=False, default=0.0)
    aliq_irpj = Column(Numeric(6, 4), nullable=False, default=0.0)
    aliq_iss = Column(Numeric(6, 4), nullable=False, default=0.0)
    aliq_icms = Column(Numeric(6, 4), nullable=False, default=0.0)
    
    # Parâmetros Específicos para a modalidade VENDA_EQUIPAMENTOS
    perc_frete_venda = Column(Numeric(6, 4), nullable=False, default=0.0)
    perc_despesas_adm = Column(Numeric(6, 4), nullable=False, default=0.0)
    perc_comissao = Column(Numeric(6, 4), nullable=False, default=0.0)

    
    # Custos Operacionais Mensais
    custo_manut_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_suporte_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_seguro_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_logistica_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_software_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_itens_acessorios_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    company = relationship("Company")
    items = relationship("OpportunityKitItem", back_populates="kit", cascade="all, delete-orphan")
    costs = relationship("OpportunityKitCost", back_populates="kit", cascade="all, delete-orphan")


class OpportunityKitCost(Base):
    __tablename__ = "opportunity_kit_costs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kit_id = Column(UUID(as_uuid=True), ForeignKey("opportunity_kits.id", ondelete="CASCADE"), nullable=False, index=True)
    
    tipo_item = Column(String(50), nullable=False, default="PRODUTO") # 'PRODUTO' ou 'SERVICO_PROPRIO'
    forma_execucao = Column(String(50), nullable=True) # Ex: 'H. NORMAL', aplicável somente se SERVICO_PROPRIO
    
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True, index=True)
    own_service_id = Column(UUID(as_uuid=True), ForeignKey("own_services.id", ondelete="RESTRICT"), nullable=True, index=True)
    
    tipo_custo = Column(String(50), nullable=False) # Seguro apólice, Logística/veículos, Loc. software, Manut pred./corretiva
    quantidade = Column(Numeric(15, 4), nullable=False, default=1.0)
    valor_unitario = Column(Numeric(15, 4), nullable=False, default=0.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    kit = relationship("OpportunityKit", back_populates="costs")
    product = relationship("Product")
    own_service = relationship("OwnService")


class OpportunityKitItem(Base):
    __tablename__ = "opportunity_kit_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kit_id = Column(UUID(as_uuid=True), ForeignKey("opportunity_kits.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    descricao_item = Column(String(255), nullable=False)
    quantidade_no_kit = Column(Numeric(15, 4), nullable=False, default=1.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    kit = relationship("OpportunityKit", back_populates="items")
    product = relationship("Product")
