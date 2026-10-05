from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from typing import Optional, List
from uuid import UUID
import re
from datetime import datetime
from enum import Enum

_SKIP_UPPER = {'cnpj', 'cep', 'email', 'municipality_id', 'state_id', 'codigo_cliente_service'}

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

def validate_cpf(cpf: str) -> bool:
    if len(cpf) != 11 or cpf == cpf[0] * 11:
        return False
    # Digit 1
    s = sum(int(cpf[i]) * (10 - i) for i in range(9))
    d1 = (s * 10 % 11) % 10
    if d1 != int(cpf[9]):
        return False
    # Digit 2
    s = sum(int(cpf[i]) * (11 - i) for i in range(10))
    d2 = (s * 10 % 11) % 10
    return d2 == int(cpf[10])

def validate_cnpj(cnpj: str) -> bool:
    if len(cnpj) != 14 or cnpj == cnpj[0] * 14:
        return False
    # Digit 1
    weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s = sum(int(cnpj[i]) * weights1[i] for i in range(12))
    d1 = 11 - (s % 11)
    d1 = 0 if d1 >= 10 else d1
    if d1 != int(cnpj[12]):
        return False
    # Digit 2
    weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    s = sum(int(cnpj[i]) * weights2[i] for i in range(13))
    d2 = 11 - (s % 11)
    d2 = 0 if d2 >= 10 else d2
    return d2 == int(cnpj[13])

class CustomerBase(BaseModel):
    company_id: Optional[UUID] = None
    codigo_cliente_service: Optional[int] = None
    cnpj: str = Field(..., min_length=11, max_length=18, description="CPF (11 dígitos) ou CNPJ (14 dígitos)")
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
    def process_empty_strings(cls, data):
        if isinstance(data, dict):
            for k, v in list(data.items()):
                if v == "":
                    data[k] = None
            return _uppercase_strings(data)
        return data

    @field_validator('cnpj', mode='before')
    @classmethod
    def clean_cnpj(cls, v):
        if not isinstance(v, str):
            return v
        cleaned = re.sub(r'\D', '', v)
        if len(cleaned) == 11:
            if not validate_cpf(cleaned):
                raise ValueError("CPF inválido.")
            return cleaned
        elif len(cleaned) == 14:
            if not validate_cnpj(cleaned):
                raise ValueError("CNPJ inválido.")
            return cleaned
        else:
            raise ValueError("O documento deve ser um CPF válido (11 dígitos) ou CNPJ válido (14 dígitos).")

class CustomerCreate(CustomerBase):
    pass

class CustomerUpdate(BaseModel):
    codigo_cliente_service: Optional[int] = None
    cnpj: Optional[str] = None
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
    def process_empty_strings(cls, data):
        if isinstance(data, dict):
            for k, v in list(data.items()):
                if v == "":
                    data[k] = None
            return _uppercase_strings(data)
        return data

    @field_validator('cnpj', mode='before')
    @classmethod
    def clean_cnpj(cls, v):
        if not v:
            return None
        cleaned = re.sub(r'\D', '', str(v))
        if not cleaned:
            return None
        if len(cleaned) == 11:
            if not validate_cpf(cleaned):
                raise ValueError("CPF inválido.")
            return cleaned
        elif len(cleaned) == 14:
            if not validate_cnpj(cleaned):
                raise ValueError("CNPJ inválido.")
            return cleaned
        else:
            raise ValueError("O documento deve ser um CPF válido (11 dígitos) ou CNPJ válido (14 dígitos).")

class CustomerOut(BaseModel):
    id: str
    tenant_id: Optional[str] = None
    company_id: Optional[UUID] = None
    codigo_cliente_service: Optional[int] = None
    cnpj: Optional[str] = None
    razao_social: Optional[str] = ""
    nome_fantasia: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    
    tipo: Optional[str] = "PRIVADO"
    esfera: Optional[str] = None
    
    # Endereço
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    municipality_id: Optional[str] = None
    state_id: Optional[str] = None
    
    active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    city_nome: Optional[str] = None
    state_sigla: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)
