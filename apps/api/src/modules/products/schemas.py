from pydantic import BaseModel, ConfigDict, Field, field_validator
import re
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from enum import Enum

class ProductType(str, Enum):
    EQUIPAMENTO = "EQUIPAMENTO"
    SERVICO = "SERVICO"

class ProductFinalidade(str, Enum):
    REVENDA = "REVENDA"
    ATIVO = "ATIVO"

class ProductBase(BaseModel):
    company_id: UUID
    nome: str
    descricao: Optional[str] = None
    tipo: ProductType
    finalidade: ProductFinalidade
    unidade: Optional[str] = None
    categoria: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    part_number: Optional[str] = None
    ncm_codigo: Optional[str] = None
    cest_codigo: Optional[str] = None
    cmt_codigo: Optional[str] = None
    ativo: bool = True

    @field_validator('ncm_codigo', mode='before')
    @classmethod
    def clean_ncm(cls, v):
        if v is None: return v
        return re.sub(r'\D', '', v) if isinstance(v, str) else v

class ProductSupplierCreate(BaseModel):
    model_config = ConfigDict(extra='ignore')

    supplier_id: str
    codigo_externo: str
    unidade: str
    fator_conversao: str

class ProductSupplierOut(ProductSupplierCreate):
    id: UUID
    product_id: UUID
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class ProductCreate(ProductBase):
    codigo: Optional[str] = None # Optional because it can be auto-generated
    suppliers: List[ProductSupplierCreate] = []

class ProductUpdate(BaseModel):
    company_id: Optional[UUID] = None
    nome: Optional[str] = None
    descricao: Optional[str] = None
    tipo: Optional[ProductType] = None
    finalidade: Optional[ProductFinalidade] = None
    unidade: Optional[str] = None
    categoria: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    part_number: Optional[str] = None
    ncm_codigo: Optional[str] = None
    cest_codigo: Optional[str] = None
    cmt_codigo: Optional[str] = None
    ativo: Optional[bool] = None
    suppliers: Optional[List[ProductSupplierCreate]] = None

    @field_validator('ncm_codigo', mode='before')
    @classmethod
    def clean_ncm(cls, v):
        if v is None: return v
        return re.sub(r'\D', '', v) if isinstance(v, str) else v

from src.modules.tax_benefits.schemas import TaxBenefitOut

class ProductOut(ProductBase):
    id: UUID
    tenant_id: str
    codigo: str
    created_at: datetime
    updated_at: datetime
    tax_benefits: List[TaxBenefitOut] = []
    suppliers: List[ProductSupplierOut] = []

    model_config = ConfigDict(from_attributes=True)

class MvaLookupResult(BaseModel):
    mva_percent: Optional[float] = None
    ncm_base: Optional[str] = None
    description: Optional[str] = None
    found: bool = False
