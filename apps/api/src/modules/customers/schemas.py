from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List
import re
from datetime import datetime
from enum import Enum

_SKIP_UPPER = {'cnpj', 'cep', 'email', 'municipality_id', 'state_id'}

def _uppercase_strings(data: dict, skip: set = _SKIP_UPPER) -> dict:
    if not isinstance(data, dict):
        return data
    for key, val in data.items():
        if key not in skip and isinstance(val, str):
            data[key] = val.upper()
    return data

class CustomerType(str, Enum):
    PRIVADO = "PRIVADO"
    PUBLICO = "PUBLICO"

class CustomerEsfera(str, Enum):
    MUNICIPAL = "MUNICIPAL"
    ESTADUAL = "ESTADUAL"
    FEDERAL = "FEDERAL"
    AUTARQUIA = "AUTARQUIA"

class CustomerBase(BaseModel):
    cnpj: str = Field(..., min_length=14, max_length=14)
    razao_social: str
    nome_fantasia: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    
    tipo: CustomerType = CustomerType.PRIVADO
    esfera: Optional[CustomerEsfera] = None
    
    # Endereço
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    municipality_id: Optional[str] = None
    state_id: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def uppercase_all(cls, data):
        return _uppercase_strings(data) if isinstance(data, dict) else data

    @field_validator('cnpj', mode='before')
    @classmethod
    def clean_cnpj(cls, v):
        return re.sub(r'\D', '', v) if isinstance(v, str) else v

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    tipo: Optional[CustomerType] = None
    esfera: Optional[CustomerEsfera] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    municipality_id: Optional[str] = None
    state_id: Optional[str] = None
    active: Optional[bool] = None

    @model_validator(mode='before')
    @classmethod
    def uppercase_all(cls, data):
        return _uppercase_strings(data) if isinstance(data, dict) else data

class CustomerOut(CustomerBase):
    id: str
    tenant_id: str
    active: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
