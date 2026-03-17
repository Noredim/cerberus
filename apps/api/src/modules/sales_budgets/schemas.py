from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from enum import Enum


class ItemTypeEnum(str, Enum):
    MERCADORIA = "MERCADORIA"
    SERVICO_INSTALACAO = "SERVICO_INSTALACAO"
    SERVICO_MANUTENCAO = "SERVICO_MANUTENCAO"


class BudgetStatusEnum(str, Enum):
    RASCUNHO = "RASCUNHO"
    APROVADO = "APROVADO"
    ARQUIVADO = "ARQUIVADO"


# --- Items ---
class SalesBudgetItemBase(BaseModel):
    model_config = ConfigDict(extra='ignore')
    product_id: Optional[UUID] = None
    tipo_item: ItemTypeEnum
    descricao_servico: Optional[str] = None
    usa_parametros_padrao: bool = True
    custo_unit_base: Decimal = Field(default=0, max_digits=15, decimal_places=4)
    markup: Decimal = Field(default=1.0, max_digits=10, decimal_places=4)
    quantidade: Decimal = Field(default=1, max_digits=15, decimal_places=4)
    # Override percentages (when usa_parametros_padrao = False)
    perc_frete_venda: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_pis: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_cofins: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_csll: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_irpj: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_icms: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_iss: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_despesa_adm: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_comissao: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    tem_st: bool = False


class SalesBudgetItemCreate(SalesBudgetItemBase):
    pass


class SalesBudgetItemOut(SalesBudgetItemBase):
    id: UUID
    venda_unit: Decimal = 0
    frete_venda_unit: Decimal = 0
    pis_unit: Decimal = 0
    cofins_unit: Decimal = 0
    csll_unit: Decimal = 0
    irpj_unit: Decimal = 0
    icms_unit: Decimal = 0
    iss_unit: Decimal = 0
    despesa_adm_unit: Decimal = 0
    comissao_unit: Decimal = 0
    lucro_unit: Decimal = 0
    margem_unit: Decimal = 0
    total_venda: Decimal = 0
    product_nome: Optional[str] = None
    product_codigo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --- Budget ---
class SalesBudgetBase(BaseModel):
    model_config = ConfigDict(extra='ignore')
    customer_id: str
    titulo: str
    observacoes: Optional[str] = None
    data_orcamento: datetime
    markup_padrao: Decimal = Field(default=1.0, max_digits=10, decimal_places=4)
    perc_despesa_adm: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_comissao: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_frete_venda: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_pis: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_cofins: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_csll: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_irpj: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_iss: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_icms_interno: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_icms_externo: Decimal = Field(default=0, max_digits=6, decimal_places=4)


class SalesBudgetCreate(SalesBudgetBase):
    responsavel_ids: List[UUID] = []
    items: List[SalesBudgetItemCreate]


class SalesBudgetUpdate(SalesBudgetBase):
    responsavel_ids: List[UUID] = []
    items: List[SalesBudgetItemCreate]


class SalesBudgetStatusUpdate(BaseModel):
    status: BudgetStatusEnum


class SalesBudgetOut(SalesBudgetBase):
    id: UUID
    tenant_id: str
    company_id: UUID
    numero_orcamento: Optional[str] = None
    status: BudgetStatusEnum
    items: List[SalesBudgetItemOut] = []
    responsavel_ids: List[UUID] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
