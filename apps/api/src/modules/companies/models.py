from sqlalchemy import Column, String, DateTime, Numeric, Date, Boolean, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from src.core.base import Base
from src.modules.tenants.models import Tenant
from src.modules.catalog.models import State, City  # FKs: companies
import uuid
from sqlalchemy.sql import func

class CnaeCatalog(Base):
    __tablename__ = "cnae_catalog"
    cnae_codigo = Column(String(20), primary_key=True)
    descricao = Column(String, nullable=False)
    versao = Column(String(50), default="2.0")
    created_at = Column(DateTime(timezone=True), default=func.now())

class Company(Base):
    __tablename__ = "companies"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(50), default="ATIVA")
    tipo = Column(String(50), default="MATRIZ") # MATRIZ, FILIAL
    cnpj = Column(String(14), nullable=False)
    razao_social = Column(String(255), nullable=False)
    nome_fantasia = Column(String(255))
    natureza_juridica_codigo = Column(String(10))
    natureza_juridica_descricao = Column(String(255))
    data_abertura = Column(Date)
    situacao_cadastral = Column(String(100))
    porte = Column(String(100))
    capital_social = Column(Numeric(15, 2))
    email = Column(String(255))
    telefone = Column(String(50))
    
    logradouro = Column(String(255))
    numero = Column(String(50))
    complemento = Column(String(255))
    bairro = Column(String(255))
    cep = Column(String(20))
    municipality_id = Column(String, ForeignKey("cities.id"), nullable=False)
    state_id = Column(String, ForeignKey("states.id"), nullable=False)
    
    logo_url = Column(String(500))
    
    origem_dados_cnpj = Column(String(50), default="INTEGRACAO")
    cnpj_snapshot_json = Column(JSONB)
    
    # CNPJ Integration Metadata
    cnpj_consultado_em = Column(DateTime(timezone=True))
    cnpj_consulta_origem = Column(String(50), default="MANUAL") # MANUAL, RECEITAWS, CACHE
    cnpj_json_ultimo_retorno = Column(JSONB)
    cnpj_status_ultima_consulta = Column(String(50))
    cnpj_mensagem_ultima_consulta = Column(String(255))
    
    nomenclatura_orcamento = Column(String(20), default="OV")
    numero_proposta = Column(Integer, default=1)
    
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    cnaes = relationship("CompanyCnae", back_populates="company", cascade="all, delete-orphan")
    users = relationship("UserCompany", back_populates="company", cascade="all, delete-orphan")
    tax_profiles = relationship("CompanyTaxProfile", back_populates="company", cascade="all, delete-orphan")
    benefits = relationship("CompanyBenefit", back_populates="company", cascade="all, delete-orphan")
    qsa = relationship("CompanyQsa", back_populates="company", cascade="all, delete-orphan")
    sales_parameters = relationship("CompanySalesParameter", back_populates="company", uselist=False, cascade="all, delete-orphan")

class CompanyCnae(Base):
    __tablename__ = "company_cnaes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    cnae_codigo = Column(String(20), nullable=False)
    tipo = Column(String(20), nullable=False) # PRIMARIO, SECUNDARIO
    created_at = Column(DateTime(timezone=True), default=func.now())

    company = relationship("Company", back_populates="cnaes")

class CompanyTaxProfile(Base):
    __tablename__ = "company_tax_profiles"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    vigencia_inicio = Column(Date, nullable=False)
    vigencia_fim = Column(Date, nullable=True) # Null = API's active profile
    regime_tributario = Column(String(50), nullable=False)
    contribuinte_icms = Column(Boolean, default=False)
    contribuinte_iss = Column(Boolean, default=True)
    inscricao_estadual = Column(String(50))
    inscricao_municipal = Column(String(50))
    regime_iss = Column(String(50), default='FIXO')
    regime_icms = Column(String(50), default='NAO_APLICA')
    perfil_tarifario_st = Column(Boolean, default=True)
    observacoes = Column(String)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    company = relationship("Company", back_populates="tax_profiles")

class TaxBenefit(Base):
    __tablename__ = "tax_benefits"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    nome = Column(String(255), nullable=False)
    descricao = Column(String)
    esfera = Column(String(50), nullable=False)
    tributo_alvo = Column(String(50), nullable=False)
    tipo_beneficio = Column(String(100), nullable=False)
    regra_json = Column(JSONB, nullable=False) # MUST match the strict Pydantic Rule schemas
    requer_habilitacao = Column(Boolean, default=False)
    documento_base = Column(String(255))
    ativo = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    companies = relationship("CompanyBenefit", back_populates="benefit", cascade="all, delete-orphan")

class CompanyBenefit(Base):
    __tablename__ = "company_benefits"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    benefit_id = Column(UUID(as_uuid=True), ForeignKey("tax_benefits.id", ondelete="CASCADE"), nullable=False)
    vigencia_inicio = Column(Date, nullable=False)
    vigencia_fim = Column(Date)
    prioridade = Column(Integer, default=100)
    status = Column(String(50), default='ATIVO')
    observacao = Column(String)
    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    company = relationship("Company", back_populates="benefits")
    benefit = relationship("TaxBenefit", back_populates="companies")

class CompanySalesParameter(Base):
    __tablename__ = "company_sales_parameters"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True)
    
    mkp_padrao = Column(Numeric(10, 2), default=0.00)
    despesa_administrativa = Column(Numeric(5, 2), default=0.00)
    comissionamento = Column(Numeric(5, 2), default=0.00)
    pis = Column(Numeric(5, 2), default=0.00)
    cofins = Column(Numeric(5, 2), default=0.00)
    csll = Column(Numeric(5, 2), default=0.00)
    irpj = Column(Numeric(5, 2), default=0.00)
    iss = Column(Numeric(5, 2), default=0.00)
    icms_interno = Column(Numeric(5, 2), default=0.00)
    icms_externo = Column(Numeric(5, 2), default=0.00)
    frete_venda_padrao = Column(Numeric(5, 2), default=0.00)

    # Per-operation-type parameters
    mkp_padrao_venda = Column(Numeric(10, 2), default=0.00)
    despesa_administrativa_venda = Column(Numeric(5, 2), default=0.00)
    comissionamento_venda = Column(Numeric(5, 2), default=0.00)
    pis_venda = Column(Numeric(5, 2), default=0.00)
    cofins_venda = Column(Numeric(5, 2), default=0.00)
    csll_venda = Column(Numeric(5, 2), default=0.00)
    irpj_venda = Column(Numeric(5, 2), default=0.00)
    iss_venda = Column(Numeric(5, 2), default=0.00)
    icms_interno_venda = Column(Numeric(5, 2), default=0.00)
    icms_externo_venda = Column(Numeric(5, 2), default=0.00)

    mkp_padrao_locacao = Column(Numeric(10, 2), default=0.00)
    despesa_administrativa_locacao = Column(Numeric(5, 2), default=0.00)
    comissionamento_locacao = Column(Numeric(5, 2), default=0.00)
    pis_locacao = Column(Numeric(5, 2), default=0.00)
    cofins_locacao = Column(Numeric(5, 2), default=0.00)
    csll_locacao = Column(Numeric(5, 2), default=0.00)
    irpj_locacao = Column(Numeric(5, 2), default=0.00)
    iss_locacao = Column(Numeric(5, 2), default=0.00)
    icms_interno_locacao = Column(Numeric(5, 2), default=0.00)
    icms_externo_locacao = Column(Numeric(5, 2), default=0.00)

    mkp_padrao_comodato = Column(Numeric(10, 2), default=0.00)
    despesa_administrativa_comodato = Column(Numeric(5, 2), default=0.00)
    comissionamento_comodato = Column(Numeric(5, 2), default=0.00)
    pis_comodato = Column(Numeric(5, 2), default=0.00)
    cofins_comodato = Column(Numeric(5, 2), default=0.00)
    csll_comodato = Column(Numeric(5, 2), default=0.00)
    irpj_comodato = Column(Numeric(5, 2), default=0.00)
    iss_comodato = Column(Numeric(5, 2), default=0.00)
    icms_interno_comodato = Column(Numeric(5, 2), default=0.00)
    icms_externo_comodato = Column(Numeric(5, 2), default=0.00)

    created_at = Column(DateTime(timezone=True), default=func.now())
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now())

    company = relationship("Company", back_populates="sales_parameters")


class CompanyCnpjQueryLog(Base):
    __tablename__ = "company_cnpj_query_logs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    cnpj_consultado = Column(String(14), nullable=False)
    provider = Column(String(50), nullable=False)
    http_status = Column(Integer)
    provider_status = Column(String(50))
    response_time_ms = Column(Integer)
    from_cache = Column(Boolean, default=False)
    response_body_json = Column(JSONB)
    mapped_body_json = Column(JSONB)
    consulted_at = Column(DateTime(timezone=True), default=func.now())
    consulted_by_user_id = Column(String, nullable=True)

class CnpjQueryCache(Base):
    __tablename__ = "cnpj_query_cache"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cnpj = Column(String(14), index=True, nullable=False)
    provider = Column(String(50), nullable=False)
    response_body_json = Column(JSONB)
    mapped_body_json = Column(JSONB)
    fetched_at = Column(DateTime(timezone=True), default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)
    hash_resposta = Column(String(255))
    status = Column(String(50))

class CompanyQsa(Base):
    __tablename__ = "company_qsa"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    nome = Column(String(255), nullable=False)
    qualificacao = Column(String(255))
    pais_origem = Column(String(255))
    nome_rep_legal = Column(String(255))
    qualificacao_rep_legal = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=func.now())

    company = relationship("Company", back_populates="qsa")
