from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List, Any
import re

_SKIP_UPPER = {'cnpj', 'cep', 'email', 'municipality_id', 'state_id', 'cnae_codigo'}

def _uppercase_strings(data: dict, skip: set = _SKIP_UPPER) -> dict:
    if not isinstance(data, dict):
        return data
    for key, val in data.items():
        if key not in skip and isinstance(val, str):
            data[key] = val.upper()
    return data
from datetime import date
from decimal import Decimal
from uuid import UUID

# DTO: CNPJ LOOKUP RESPONSE
class CnpjIntegrationResult(BaseModel):
    cnpj: str
    razao_social: str
    nome_fantasia: Optional[str] = None
    natureza_juridica_codigo: Optional[str] = None
    data_abertura: Optional[date] = None
    situacao_cadastral: Optional[str] = None
    porte: Optional[str] = None
    # Endereço
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cep: Optional[str] = None
    municipio_ibge: Optional[str] = None
    uf: Optional[str] = None
    # CNAEs
    cnae_principal: Optional[str] = None
    cnaes_secundarios: List[str] = []

# DTO: COMPANY CNAE
class CompanyCnaeBase(BaseModel):
    cnae_codigo: str
    tipo: str = Field(..., pattern="^(PRIMARIO|SECUNDARIO)$")
    
    model_config = ConfigDict(from_attributes=True)

# DTO: COMPANY TAX PROFILE
class CompanyTaxProfileBase(BaseModel):
    vigencia_inicio: date
    regime_tributario: str = Field(..., pattern="^(SIMPLES_NACIONAL|LUCRO_PRESUMIDO|LUCRO_REAL|MEI|OUTRO)$")
    contribuinte_icms: bool = False
    contribuinte_iss: bool = True
    inscricao_estadual: Optional[str] = None
    inscricao_municipal: Optional[str] = None
    regime_iss: str = "FIXO"
    regime_icms: str = "NAO_APLICA"
    observacoes: Optional[str] = None

class CompanyTaxProfileOut(CompanyTaxProfileBase):
    id: UUID
    vigencia_fim: Optional[date]
    model_config = ConfigDict(from_attributes=True)

class CompanyBenefitCreate(BaseModel):
    benefit_id: str
    vigencia_inicio: date
    vigencia_fim: Optional[date] = None
    prioridade: int = 100
    status: str = "ATIVO"
    observacao: Optional[str] = None

class TaxBenefitSimpleOut(BaseModel):
    id: UUID
    nome: str
    model_config = ConfigDict(from_attributes=True)

class CompanyBenefitOut(BaseModel):
    id: UUID
    status: str
    benefit: TaxBenefitSimpleOut
    model_config = ConfigDict(from_attributes=True)

class CompanyQsaBase(BaseModel):
    nome: str
    qualificacao: Optional[str] = None
    pais_origem: Optional[str] = None
    nome_rep_legal: Optional[str] = None
    qualificacao_rep_legal: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class CompanySalesParameterBase(BaseModel):
    mkp_padrao: Decimal = Decimal('0.00')
    despesa_administrativa: Decimal = Decimal('0.00')
    comissionamento: Decimal = Decimal('0.00')
    pis: Decimal = Decimal('0.00')
    cofins: Decimal = Decimal('0.00')
    csll: Decimal = Decimal('0.00')
    irpj: Decimal = Decimal('0.00')
    iss: Decimal = Decimal('0.00')
    icms_interno: Decimal = Decimal('0.00')
    icms_externo: Decimal = Decimal('0.00')

    # Venda de Equipamentos e Serviços
    mkp_padrao_venda: Decimal = Decimal('0.00')
    despesa_administrativa_venda: Decimal = Decimal('0.00')
    comissionamento_venda: Decimal = Decimal('0.00')
    pis_venda: Decimal = Decimal('0.00')
    cofins_venda: Decimal = Decimal('0.00')
    csll_venda: Decimal = Decimal('0.00')
    irpj_venda: Decimal = Decimal('0.00')
    iss_venda: Decimal = Decimal('0.00')
    icms_interno_venda: Decimal = Decimal('0.00')
    icms_externo_venda: Decimal = Decimal('0.00')

    # Locação de Equipamentos
    mkp_padrao_locacao: Decimal = Decimal('0.00')
    despesa_administrativa_locacao: Decimal = Decimal('0.00')
    comissionamento_locacao: Decimal = Decimal('0.00')
    pis_locacao: Decimal = Decimal('0.00')
    cofins_locacao: Decimal = Decimal('0.00')
    csll_locacao: Decimal = Decimal('0.00')
    irpj_locacao: Decimal = Decimal('0.00')
    iss_locacao: Decimal = Decimal('0.00')
    icms_interno_locacao: Decimal = Decimal('0.00')
    icms_externo_locacao: Decimal = Decimal('0.00')

    # Comodato de Equipamentos
    mkp_padrao_comodato: Decimal = Decimal('0.00')
    despesa_administrativa_comodato: Decimal = Decimal('0.00')
    comissionamento_comodato: Decimal = Decimal('0.00')
    pis_comodato: Decimal = Decimal('0.00')
    cofins_comodato: Decimal = Decimal('0.00')
    csll_comodato: Decimal = Decimal('0.00')
    irpj_comodato: Decimal = Decimal('0.00')
    iss_comodato: Decimal = Decimal('0.00')
    icms_interno_comodato: Decimal = Decimal('0.00')
    icms_externo_comodato: Decimal = Decimal('0.00')

    model_config = ConfigDict(from_attributes=True)

class CompanySalesParameterOut(CompanySalesParameterBase):
    id: UUID
    company_id: UUID

class CompanyCreate(BaseModel):
    cnpj: str = Field(..., min_length=14, max_length=14)
    tipo: str = "MATRIZ"
    razao_social: str
    nome_fantasia: Optional[str] = None
    natureza_juridica_codigo: Optional[str] = None
    natureza_juridica_descricao: Optional[str] = None
    data_abertura: Optional[date] = None
    situacao_cadastral: Optional[str] = None
    porte: Optional[str] = None
    capital_social: Optional[Decimal] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cep: Optional[str] = None
    municipality_id: str
    state_id: str
    
    nomenclatura_orcamento: str = Field("OV", max_length=20)
    numero_proposta: int = 1
    
    # Nested relations during creation
    cnaes: List[CompanyCnaeBase]
    initial_tax_profile: CompanyTaxProfileBase
    benefits: List[CompanyBenefitCreate] = []
    qsa: List[CompanyQsaBase] = []

    @model_validator(mode='before')
    @classmethod
    def uppercase_all(cls, data):
        return _uppercase_strings(data) if isinstance(data, dict) else data

    @field_validator('cnpj', mode='before')
    @classmethod
    def clean_cnpj(cls, v):
        return re.sub(r'\D', '', v) if isinstance(v, str) else v

class CompanyUpdate(BaseModel):
    # Almost same as Create but initial_tax_profile is NOT mandatory as it's modified via history
    cnpj: Optional[str] = Field(None, min_length=14, max_length=14)
    tipo: Optional[str] = None
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    natureza_juridica_codigo: Optional[str] = None
    natureza_juridica_descricao: Optional[str] = None
    data_abertura: Optional[date] = None
    situacao_cadastral: Optional[str] = None
    porte: Optional[str] = None
    capital_social: Optional[Decimal] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cep: Optional[str] = None
    municipality_id: Optional[str] = None
    state_id: Optional[str] = None
    
    nomenclatura_orcamento: Optional[str] = Field(None, max_length=20)
    numero_proposta: Optional[int] = None
    
    cnaes: Optional[List[CompanyCnaeBase]] = None
    initial_tax_profile: Optional[CompanyTaxProfileBase] = None
    benefits: Optional[List[CompanyBenefitCreate]] = None
    qsa: Optional[List[CompanyQsaBase]] = None

    @model_validator(mode='before')
    @classmethod
    def uppercase_all(cls, data):
        return _uppercase_strings(data) if isinstance(data, dict) else data

    @field_validator('cnpj', mode='before')
    @classmethod
    def clean_cnpj(cls, v):
        if v is None: return v
        return re.sub(r'\D', '', v) if isinstance(v, str) else v

class CompanyOut(BaseModel):
    id: UUID
    cnpj: str
    tipo: str
    razao_social: str
    nome_fantasia: Optional[str] = None
    data_abertura: Optional[date] = None
    situacao_cadastral: Optional[str] = None
    porte: Optional[str] = None
    capital_social: Optional[Decimal] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cep: Optional[str] = None
    status: str
    natureza_juridica_codigo: Optional[str]
    natureza_juridica_descricao: Optional[str]
    municipality_id: str
    state_id: str
    logo_url: Optional[str] = None
    nomenclatura_orcamento: str
    numero_proposta: int
    
    # We optionally include lists inside Company payload
    # It depends on how much hydration is needed.
    cnaes: List[CompanyCnaeBase] = []
    tax_profiles: List[CompanyTaxProfileOut] = []
    benefits: List[CompanyBenefitOut] = []
    qsa: List[CompanyQsaBase] = []
    sales_parameters: Optional[CompanySalesParameterOut] = None
    
    model_config = ConfigDict(from_attributes=True)
