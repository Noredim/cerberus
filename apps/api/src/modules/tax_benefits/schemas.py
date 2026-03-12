from pydantic import BaseModel, ConfigDict, Field, field_validator
import re
from typing import Optional, List, Any
from datetime import date
from decimal import Decimal
from uuid import UUID

# STRICT P0 JSON Validation for the Rule Engine
# This structure guarantees the Tax Engine will never stumble on a malformed JSON 

class BenefitCondicoes(BaseModel):
    uf: List[str] = []
    municipio_ibge: List[str] = []
    cnae_incluir: List[str] = []
    cnae_excluir: List[str] = []
    ncm_incluir: List[str] = []
    ncm_excluir: List[str] = []
    operacao: List[str] = Field(default_factory=list, description="VENDA, SERVICO, LOCACAO, etc")
    cliente_tipo: List[str] = Field(default_factory=list, description="CONTRIBUINTE, CONSUMIDOR_FINAL")
    valor_min: Optional[Decimal] = None
    valor_max: Optional[Decimal] = None

    @field_validator('ncm_incluir', 'ncm_excluir', mode='before')
    @classmethod
    def clean_ncms(cls, v):
        if not v: return v
        return [re.sub(r'\D', '', item) if isinstance(item, str) else item for item in v]

class BenefitEfeitos(BaseModel):
    aliquota_nova: Optional[Decimal] = None
    reducao_percentual: Optional[Decimal] = None
    base_reduzida_percentual: Optional[Decimal] = None
    credito_percentual: Optional[Decimal] = None
    observacao_nf: Optional[str] = None

class BenefitVigencia(BaseModel):
    inicio: date
    fim: Optional[date] = None

class RegraJsonSchema(BaseModel):
    condicoes: BenefitCondicoes
    efeitos: BenefitEfeitos
    vigencia: BenefitVigencia
    prioridade: int = 100

class TaxBenefitBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    esfera: str = Field(..., pattern="^(MUNICIPAL|ESTADUAL|FEDERAL)$")
    tributo_alvo: str = Field(..., pattern="^(ISS|ICMS|IPI|PIS|COFINS|IRPJ|CSLL|OUTRO)$")
    tipo_beneficio: str = Field(..., pattern="^(REDUCAO_ALIQUOTA|ISENCAO|DIFERIMENTO|CREDITO_PRESUMIDO|BASE_CALCULO_REDUZIDA|OUTRO)$")
    regra_json: RegraJsonSchema # P0 enforcement here
    requer_habilitacao: bool = False
    documento_base: Optional[str] = None
    ativo: bool = True

class TaxBenefitOut(TaxBenefitBase):
    id: UUID
    tenant_id: UUID
    model_config = ConfigDict(from_attributes=True)

# DTO: Vinculo do benefício com a Empresa (M:N)
class CompanyBenefitBase(BaseModel):
    benefit_id: str
    vigencia_inicio: date
    vigencia_fim: Optional[date] = None
    prioridade: int = 100
    status: str = "ATIVO"
    observacao: Optional[str] = None

class CompanyBenefitOut(CompanyBenefitBase):
    id: UUID
    company_id: UUID
    model_config = ConfigDict(from_attributes=True)
