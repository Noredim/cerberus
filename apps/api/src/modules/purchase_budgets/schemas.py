from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from enum import Enum

class BudgetTypeEnum(str, Enum):
    REVENDA = 'REVENDA'
    ATIVO_IMOBILIZADO_USO_CONSUMO = 'ATIVO_IMOBILIZADO_USO_CONSUMO'

class FreightTypeEnum(str, Enum):
    CIF = 'CIF'
    FOB = 'FOB'

class ProductSupplierLinkCreate(BaseModel):
    product_id: UUID
    codigo_fornecedor: str

class PaymentConditionBase(BaseModel):
    descricao: str
    prazo: int = 0
    parcelas: int = 1

class PaymentConditionCreate(PaymentConditionBase):
    pass

class PaymentConditionOut(PaymentConditionBase):
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# --- Items ---
class PurchaseBudgetItemBase(BaseModel):
    product_id: UUID
    codigo_fornecedor: Optional[str] = None
    ncm: Optional[str] = None
    quantidade: Decimal = Field(default=1, max_digits=15, decimal_places=4)
    valor_unitario: Decimal = Field(default=0, max_digits=15, decimal_places=4)
    
    # Se omitido no frontend, deverá herdar do cabeçalho
    frete_percent: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=4)
    ipi_percent: Decimal = Field(default=0, max_digits=10, decimal_places=4)
    icms_percent: Decimal = Field(default=0, max_digits=10, decimal_places=4)

class PurchaseBudgetItemCreate(PurchaseBudgetItemBase):
    model_config = ConfigDict(extra='ignore')

class PurchaseBudgetItemOut(PurchaseBudgetItemBase):
    id: UUID
    budget_id: UUID
    frete_valor: Decimal
    ipi_valor: Decimal
    total_item: Decimal
    frete_percent: Decimal = Field(default=0, max_digits=10, decimal_places=4)
    product_nome: Optional[str] = None
    product_codigo: Optional[str] = None
    quantidade: Decimal = Field(default=1, max_digits=15, decimal_places=4)

    class Config:
        from_attributes = True

# --- Negotiations ---
class NegotiationItemBase(BaseModel):
    budget_item_id: UUID
    desconto_percent: Optional[Decimal] = Field(default=0, max_digits=10, decimal_places=4)
    valor_final: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)

class NegotiationItemCreate(NegotiationItemBase):
    pass

class NegotiationItemOut(NegotiationItemBase):
    id: UUID
    negotiation_id: UUID
    valor_original: Decimal
    valor_final: Decimal

    class Config:
        from_attributes = True

class PurchaseBudgetNegotiationBase(BaseModel):
    data_negociacao: datetime
    desconto_percent: Optional[Decimal] = Field(default=0, max_digits=10, decimal_places=4)

class PurchaseBudgetNegotiationCreate(PurchaseBudgetNegotiationBase):
    items: List[NegotiationItemCreate] = []

class PurchaseBudgetNegotiationOut(PurchaseBudgetNegotiationBase):
    id: UUID
    budget_id: UUID
    created_at: datetime
    updated_at: datetime
    items: List[NegotiationItemOut] = []

    class Config:
        from_attributes = True

# --- Budgets ---
class PurchaseBudgetBase(BaseModel):
    model_config = ConfigDict(extra='ignore')
    supplier_id: str
    payment_condition_id: Optional[UUID] = None
    numero_orcamento: Optional[str] = None
    data_orcamento: datetime
    validade: Optional[datetime] = None
    vendedor_nome: Optional[str] = None
    vendedor_telefone: Optional[str] = None
    vendedor_email: Optional[str] = None
    tipo_orcamento: BudgetTypeEnum
    frete_tipo: FreightTypeEnum
    frete_percent: Decimal = Field(default=0, max_digits=10, decimal_places=4)
    ipi_calculado: bool = False

class PurchaseBudgetCreate(PurchaseBudgetBase):
    items: List[PurchaseBudgetItemCreate]

class PurchaseBudgetUpdate(PurchaseBudgetBase):
    items: List[PurchaseBudgetItemCreate]

class PurchaseBudgetOut(PurchaseBudgetBase):
    id: UUID
    tenant_id: str
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    items: List[PurchaseBudgetItemOut] = []
    negotiations: List[PurchaseBudgetNegotiationOut] = []
    
    # Nested info for frontend
    supplier_nome_fantasia: Optional[str] = None
    supplier_cnpj: Optional[str] = None
    valor_total: Decimal = Field(default=0, max_digits=15, decimal_places=4)

    class Config:
        from_attributes = True
