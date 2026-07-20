import uuid
from sqlalchemy import Column, String, DateTime, ForeignKey, Boolean, Numeric, Text, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from src.core.base import Base
import src.modules.own_services.models  # ensure OwnService is in registry for mapper
from src.modules.companies.models import SalesTeam


class OpportunityKit(Base):
    __tablename__ = "opportunity_kits"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    sales_budget_id = Column(UUID(as_uuid=True), ForeignKey("sales_budgets.id", ondelete="CASCADE"), nullable=True, index=True)
    sales_proposal_id = Column(UUID(as_uuid=True), ForeignKey("sales_proposals.id", ondelete="CASCADE"), nullable=True, index=True)
    licitacao_id = Column(UUID(as_uuid=True), ForeignKey("licitacoes.id", ondelete="CASCADE"), nullable=True, index=True)
    licitacao_item_id = Column(UUID(as_uuid=True), ForeignKey("licitacao_items.id", ondelete="CASCADE"), nullable=True, index=True)
    commercial_policy_id = Column(UUID(as_uuid=True), ForeignKey("company_commercial_policies.id", ondelete="SET NULL"), nullable=True, index=True)
    comissionamento_detalhado = Column(JSONB, nullable=True)
    
    # Dados Gerais
    nome_kit = Column(String(255), nullable=False)
    descricao_kit = Column(Text, nullable=True)
    quantidade_kits = Column(Integer, nullable=False, default=1)
    tipo_contrato = Column(String(50), nullable=False)  # COMODATO, LOCACAO, VENDA_EQUIPAMENTOS, INSTALACAO
    considerar_st_ou_difal = Column(String(50), nullable=False, server_default="DIFAL", default="DIFAL")
    forma_execucao = Column(String(50), nullable=True)  # Global execution form for VENDA_EQUIPAMENTOS    
    # Prazos do Contrato
    prazo_contrato_meses = Column(Integer, nullable=False)
    prazo_instalacao_meses = Column(Integer, nullable=False, default=0)
    
    # Parâmetros Financeiros
    fator_margem_locacao = Column(Numeric(10, 4), nullable=False, default=1.0)
    taxa_juros_mensal = Column(Numeric(10, 6), nullable=False, default=0.0)
    taxa_manutencao_anual = Column(Numeric(10, 4), nullable=False, default=0.0)
    
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
    faturamento_servico_separado = Column(Boolean, nullable=False, default=False)
    
    # Parâmetros de Monitoramento
    custo_monitoramento_unitario = Column(Numeric(15, 4), nullable=False, default=0.0)
    fator_monitoramento = Column(Numeric(10, 4), nullable=False, default=1.0)
    
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
    tipo_comissionamento = Column(String(50), nullable=False, default="TRADICIONAL")
    perc_dsr = Column(Numeric(6, 4), nullable=False, default=0.0)
    perc_fgts = Column(Numeric(6, 4), nullable=False, default=0.0)
    perc_inss = Column(Numeric(6, 4), nullable=False, default=0.0)
    perc_demais_incidencias = Column(Numeric(6, 4), nullable=False, default=0.0)
    perc_despesa_operacional = Column(Numeric(6, 4), nullable=False, default=0.0)

    
    # Custos Operacionais Mensais
    custo_manut_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_suporte_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_seguro_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_logistica_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_software_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    custo_itens_acessorios_mensal_kit = Column(Numeric(15, 4), nullable=False, default=0.0)
    
    # Target Margin (Margem Alvo) fields
    margem_minima_desejada = Column(Numeric(6, 4), nullable=True)
    fator_minimo_calculado = Column(Numeric(10, 4), nullable=True)
    valor_venda_minimo = Column(Numeric(15, 4), nullable=True)
    lucro_minimo = Column(Numeric(15, 4), nullable=True)
    margem_minima_resultante = Column(Numeric(6, 4), nullable=True)
    
    # Financial fields
    custo_total = Column(Numeric(15, 4), nullable=False, default=0.0)
    venda_total = Column(Numeric(15, 4), nullable=False, default=0.0)
    lucro_estimado = Column(Numeric(15, 4), nullable=False, default=0.0)
    margem_geral = Column(Numeric(10, 4), nullable=False, default=0.0)
    custo_unitario = Column(Numeric(15, 4), nullable=False, default=0.0)
    venda_unitario = Column(Numeric(15, 4), nullable=False, default=0.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    company = relationship("Company")
    commercial_policy = relationship("CommercialPolicy")
    licitacao = relationship("Licitacao", back_populates="kits", foreign_keys=[licitacao_id])
    licitacao_item = relationship("LicitacaoItem", back_populates="kits", foreign_keys=[licitacao_item_id])
    items = relationship("OpportunityKitItem", back_populates="kit", cascade="all, delete-orphan")
    costs = relationship("OpportunityKitCost", back_populates="kit", cascade="all, delete-orphan")
    monthly_costs = relationship("OpportunityKitMonthlyCost", back_populates="kit", cascade="all, delete-orphan")
    sales_teams = relationship("OpportunityKitSalesTeam", back_populates="kit", cascade="all, delete-orphan")


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
    
    tipo_item = Column(String(50), nullable=False, default="PRODUTO") # 'PRODUTO' ou 'SERVICO_PROPRIO'
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id", ondelete="RESTRICT"), nullable=True, index=True)
    own_service_id = Column(UUID(as_uuid=True), ForeignKey("own_services.id", ondelete="RESTRICT"), nullable=True, index=True)
    
    descricao_item = Column(String(255), nullable=False)
    quantidade_no_kit = Column(Numeric(15, 4), nullable=False, default=1.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    kit = relationship("OpportunityKit", back_populates="items")
    product = relationship("Product")
    own_service = relationship("OwnService")


class OpportunityKitMonthlyCost(Base):
    __tablename__ = "kit_custos_mensais"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    kit_id = Column(UUID(as_uuid=True), ForeignKey("opportunity_kits.id", ondelete="CASCADE"), nullable=False, index=True)
    
    servico = Column(String(255), nullable=False)
    tipo_custo = Column(String(50), nullable=False)
    quantidade = Column(Numeric(15, 4), nullable=False, default=1.0)
    valor_unitario = Column(Numeric(15, 4), nullable=False, default=0.0)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    kit = relationship("OpportunityKit", back_populates="monthly_costs")


class OpportunityKitSalesTeam(Base):
    __tablename__ = "opportunity_kit_sales_teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    opportunity_kit_id = Column(UUID(as_uuid=True), ForeignKey("opportunity_kits.id", ondelete="CASCADE"), nullable=False)
    sales_team_id = Column(UUID(as_uuid=True), ForeignKey("company_sales_teams.id", ondelete="CASCADE"), nullable=False)

    kit = relationship("OpportunityKit", back_populates="sales_teams")
    sales_team = relationship("SalesTeam")

    @property
    def nome_equipe(self):
        return self.sales_team.nome if self.sales_team else None


