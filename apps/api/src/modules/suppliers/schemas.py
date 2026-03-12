from pydantic import BaseModel, ConfigDict, Field, field_validator
from typing import Optional, List
import re
from datetime import datetime
from uuid import UUID

class SupplierBase(BaseModel):
    cnpj: str = Field(..., min_length=14, max_length=14)
    razao_social: str
    nome_fantasia: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    
    # Endereço
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    municipality_id: Optional[str] = None
    state_id: Optional[str] = None

    @field_validator('cnpj', mode='before')
    @classmethod
    def clean_cnpj(cls, v):
        return re.sub(r'\D', '', v) if isinstance(v, str) else v

class SupplierCreate(SupplierBase):
    pass

class SupplierUpdate(BaseModel):
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    cep: Optional[str] = None
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    municipality_id: Optional[str] = None
    state_id: Optional[str] = None
    active: Optional[bool] = None

class SupplierOut(SupplierBase):
    id: str # Using str to match model's primary key type (which is UUID-based but stored as String)
    tenant_id: str
    active: bool
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)
