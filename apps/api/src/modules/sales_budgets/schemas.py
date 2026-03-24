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


# ─── Rental (Locação) Items ───

class RentalBudgetItemBase(BaseModel):
    model_config = ConfigDict(extra='ignore')
    product_id: Optional[UUID] = None
    opportunity_kit_id: Optional[UUID] = None
    custo_op_mensal_kit: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    
    is_kit_instalacao: bool = False
    tipo_contrato_kit: Optional[str] = None
    kit_taxa_juros_mensal: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=6)
    kit_custo_produtos: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_custo_servicos: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_pis: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    kit_cofins: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    kit_csll: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    kit_irpj: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    kit_iss: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    
    quantidade: Decimal = Field(default=1, max_digits=15, decimal_places=4)
    custo_aquisicao_unit: Decimal = Field(default=0, max_digits=15, decimal_places=4)
    ipi_unit: Decimal = Field(default=0, max_digits=15, decimal_places=4)
    frete_unit: Decimal = Field(default=0, max_digits=15, decimal_places=4)
    icms_st_unit: Decimal = Field(default=0, max_digits=15, decimal_places=4)
    difal_unit: Decimal = Field(default=0, max_digits=15, decimal_places=4)
    
    kit_vlt_manut: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_valor_mensal: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_valor_impostos: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_receita_liquida: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_lucro_mensal: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_margem: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=4)
    prazo_contrato: int = 36
    usa_taxa_manut_padrao: bool = True
    taxa_manutencao_anual_item: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_instalacao_item: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    valor_instalacao_item: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    fator_margem: Decimal = Field(default=1, max_digits=10, decimal_places=4)


class RentalBudgetItemCreate(RentalBudgetItemBase):
    pass


class RentalBudgetItemOut(RentalBudgetItemBase):
    id: UUID
    custo_total_aquisicao: Decimal = 0
    custo_manut_mensal: Decimal = 0
    custo_total_mensal: Decimal = 0
    valor_venda_equipamento: Decimal = 0
    parcela_locacao: Decimal = 0
    manutencao_locacao: Decimal = 0
    valor_mensal: Decimal = 0
    perc_impostos_total: Decimal = 0
    impostos_mensal: Decimal = 0
    receita_liquida_mensal: Decimal = 0
    perc_comissao: Decimal = 0
    comissao_mensal: Decimal = 0
    lucro_mensal: Decimal = 0
    margem: Decimal = 0
    product_nome: Optional[str] = None
    product_codigo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Sale Items ───

class SalesBudgetItemBase(BaseModel):
    model_config = ConfigDict(extra='ignore')
    product_id: Optional[UUID] = None
    opportunity_kit_id: Optional[UUID] = None
    tipo_item: ItemTypeEnum
    descricao_servico: Optional[str] = None
    usa_parametros_padrao: bool = True
    custo_unit_base: Decimal = Field(default=0, max_digits=15, decimal_places=4)
    markup: Decimal = Field(default=1.0, max_digits=10, decimal_places=4)
    quantidade: Decimal = Field(default=1, max_digits=15, decimal_places=4)
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


# ─── Budget ───

class SalesBudgetBase(BaseModel):
    model_config = ConfigDict(extra='ignore')
    customer_id: str
    vendedor_id: Optional[str] = None
    titulo: str
    observacoes: Optional[str] = None
    data_orcamento: datetime

    # Sale tab defaults
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

    # Rental tab defaults
    prazo_contrato_meses: int = 36
    prazo_instalacao_meses: int = 1
    taxa_juros_mensal: Decimal = Field(default=0, max_digits=10, decimal_places=6)
    taxa_manutencao_anual: Decimal = Field(default=5, max_digits=6, decimal_places=4)
    tipo_receita_rental: str = "LOCACAO_PURA"
    fator_margem_padrao: Decimal = Field(default=1, max_digits=6, decimal_places=4)
    fator_manutencao_padrao: Decimal = Field(default=1, max_digits=6, decimal_places=4)
    perc_instalacao_padrao: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_comissao_rental: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_pis_rental: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_cofins_rental: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_csll_rental: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_irpj_rental: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_iss_rental: Decimal = Field(default=0, max_digits=6, decimal_places=4)
    perc_comissao_diretoria: Decimal = Field(default=0, max_digits=6, decimal_places=4)


class SalesBudgetCreate(SalesBudgetBase):
    responsavel_ids: List[UUID] = []
    items: List[SalesBudgetItemCreate] = []
    rental_items: List[RentalBudgetItemCreate] = []


class SalesBudgetUpdate(SalesBudgetBase):
    responsavel_ids: List[UUID] = []
    items: List[SalesBudgetItemCreate] = []
    rental_items: List[RentalBudgetItemCreate] = []


class SalesBudgetStatusUpdate(BaseModel):
    status: BudgetStatusEnum


class SalesBudgetOut(SalesBudgetBase):
    id: UUID
    tenant_id: str
    company_id: UUID
    numero_orcamento: Optional[str] = None
    status: BudgetStatusEnum
    items: List[SalesBudgetItemOut] = []
    rental_items: List[RentalBudgetItemOut] = []
    responsavel_ids: List[UUID] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
