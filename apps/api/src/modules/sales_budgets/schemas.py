from pydantic import BaseModel, Field, ConfigDict, model_validator
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
    EM_LANCAMENTO = "EM_LANCAMENTO"
    ENVIADO_APROVACAO = "ENVIADO_APROVACAO"
    RETORNADO_VENDEDOR = "RETORNADO_VENDEDOR"
    APROVADO = "APROVADO"
    CANCELADO = "CANCELADO"
    GANHO = "GANHO"
    PERDIDO = "PERDIDO"


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
    kit_faturamento_separado: Optional[bool] = Field(default=False)
    
    kit_investimento_total: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_comissao: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_perc_comissao: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    kit_vlr_instal_calc: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_parcela_locacao: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    kit_venda_unit_monitoramento: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    
    prazo_contrato: int = 36
    usa_taxa_manut_padrao: bool = True
    taxa_manutencao_anual_item: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    perc_instalacao_item: Optional[Decimal] = Field(default=None, max_digits=6, decimal_places=4)
    valor_instalacao_item: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    fator_margem: Decimal = Field(default=1, max_digits=10, decimal_places=4)

    @model_validator(mode="before")
    @classmethod
    def round_decimals(cls, data):
        if isinstance(data, dict):
            decimal_fields_4 = [
                "custo_op_mensal_kit", "kit_custo_produtos", "kit_custo_servicos",
                "kit_pis", "kit_cofins", "kit_csll", "kit_irpj", "kit_iss",
                "quantidade", "custo_aquisicao_unit", "ipi_unit", "frete_unit",
                "icms_st_unit", "difal_unit", "kit_vlt_manut", "kit_valor_mensal",
                "kit_valor_impostos", "kit_receita_liquida", "kit_lucro_mensal",
                "kit_margem", "kit_investimento_total", "kit_comissao",
                "kit_perc_comissao", "kit_vlr_instal_calc", "kit_parcela_locacao",
                "kit_venda_unit_monitoramento", "taxa_manutencao_anual_item",
                "perc_instalacao_item", "valor_instalacao_item", "fator_margem"
            ]
            for field in decimal_fields_4:
                val = data.get(field)
                if val is not None:
                    try:
                        data[field] = round(float(val), 4)
                    except (ValueError, TypeError):
                        pass
            if "kit_taxa_juros_mensal" in data and data["kit_taxa_juros_mensal"] is not None:
                try:
                    data["kit_taxa_juros_mensal"] = round(float(data["kit_taxa_juros_mensal"]), 6)
                except (ValueError, TypeError):
                    pass
        return data


class RentalBudgetItemCreate(RentalBudgetItemBase):
    pass


class RentalBudgetItemOut(RentalBudgetItemBase):
    id: UUID
    custo_total_aquisicao: Decimal = Decimal('0.00')
    custo_manut_mensal: Decimal = Decimal('0.00')
    custo_total_mensal: Decimal = Decimal('0.00')
    valor_venda_equipamento: Decimal = Decimal('0.00')
    parcela_locacao: Decimal = Decimal('0.00')
    manutencao_locacao: Decimal = Decimal('0.00')
    valor_mensal: Decimal = Decimal('0.00')
    perc_impostos_total: Decimal = Decimal('0.00')
    impostos_mensal: Decimal = Decimal('0.00')
    receita_liquida_mensal: Decimal = Decimal('0.00')
    perc_comissao: Decimal = Decimal('0.00')
    comissao_mensal: Decimal = Decimal('0.00')
    lucro_mensal: Decimal = Decimal('0.00')
    margem: Decimal = Decimal('0.00')
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
    icms_abatido_unit: Decimal = Field(default=0, max_digits=15, decimal_places=4)


class SalesBudgetItemCreate(SalesBudgetItemBase):
    pass


class SalesBudgetItemOut(SalesBudgetItemBase):
    id: UUID
    venda_unit: Decimal = Decimal('0.00')
    frete_venda_unit: Decimal = Decimal('0.00')
    pis_unit: Decimal = Decimal('0.00')
    cofins_unit: Decimal = Decimal('0.00')
    csll_unit: Decimal = Decimal('0.00')
    irpj_unit: Decimal = Decimal('0.00')
    icms_unit: Decimal = Decimal('0.00')
    icms_abatido_unit: Decimal = Decimal('0.00')
    iss_unit: Decimal = Decimal('0.00')
    despesa_adm_unit: Decimal = Decimal('0.00')
    comissao_unit: Decimal = Decimal('0.00')
    lucro_unit: Decimal = Decimal('0.00')
    margem_unit: Decimal = Decimal('0.00')
    total_venda: Decimal = Decimal('0.00')
    product_nome: Optional[str] = None
    product_codigo: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# ─── Budget ───

class SalesBudgetBase(BaseModel):
    model_config = ConfigDict(extra='ignore')
    customer_id: str
    vendedor_id: Optional[str] = None
    forma_pagamento_id: Optional[UUID] = None
    data_vencimento_inicial: Optional[datetime] = None
    forma_pagamento_snapshot: Optional[dict] = None
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

    # Venda margin factors (markup)
    venda_markup_produtos: Decimal = Field(default=1.0, max_digits=10, decimal_places=4)
    venda_markup_servicos: Decimal = Field(default=1.0, max_digits=10, decimal_places=4)
    venda_markup_instalacao: Decimal = Field(default=1.0, max_digits=10, decimal_places=4)
    venda_markup_manutencao: Decimal = Field(default=1.0, max_digits=10, decimal_places=4)
    venda_havera_manutencao: bool = False
    venda_qtd_meses_manutencao: int = 0

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
    responsavel_ids: List[str] = []
    items: List[SalesBudgetItemCreate] = []
    rental_items: List[RentalBudgetItemCreate] = []


class SalesBudgetUpdate(SalesBudgetBase):
    responsavel_ids: List[str] = []
    items: List[SalesBudgetItemCreate] = []
    rental_items: List[RentalBudgetItemCreate] = []


class SalesBudgetHeaderUpdate(BaseModel):
    titulo: Optional[str] = None
    customer_id: Optional[str] = None


class SalesBudgetStatusUpdate(BaseModel):
    status: BudgetStatusEnum


class SalesBudgetHistoryOut(BaseModel):
    id: UUID
    sales_budget_id: UUID
    tenant_id: str
    versao: int
    status_anterior: str
    status_novo: str
    usuario_id: str
    cargo_usuario: Optional[str] = None
    descricao: str
    data_movimentacao: datetime

    model_config = ConfigDict(from_attributes=True)


class SalesBudgetApprovalOut(BaseModel):
    id: UUID
    sales_budget_id: UUID
    tenant_id: str
    usuario_aprovador_id: str
    cargo_aprovador: str
    data_aprovacao: datetime
    observacao: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class WorkflowTransitionSchema(BaseModel):
    justificativa: str = Field(..., min_length=1, description="Justificativa obrigatória para movimentação")


class SalesBudgetOut(SalesBudgetBase):
    id: UUID
    tenant_id: str
    company_id: UUID
    numero_orcamento: Optional[str] = None
    status: BudgetStatusEnum
    versao: int = 1
    valor_total: Decimal = Decimal('0.00')
    items: List[SalesBudgetItemOut] = []
    rental_items: List[RentalBudgetItemOut] = []
    responsavel_ids: List[str] = []
    history: List[SalesBudgetHistoryOut] = []
    approvals: List[SalesBudgetApprovalOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
