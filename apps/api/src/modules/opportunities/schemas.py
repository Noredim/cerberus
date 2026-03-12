from pydantic import BaseModel, Field
from typing import Optional, List
from decimal import Decimal
from datetime import date, datetime
from enum import Enum
from uuid import UUID

class TipoCliente(str, Enum):
    PRIVADO = "PRIVADO"
    PUBLICO = "PUBLICO"

class TipoOperacao(str, Enum):
    VENDA = "VENDA"
    COMODATO_LOCACAO = "COMODATO_LOCACAO"

class StatusOportunidade(str, Enum):
    RASCUNHO = "RASCUNHO"
    EM_FORMACAO = "EM_FORMACAO"
    EM_COTACAO = "EM_COTACAO"
    EM_ANALISE = "EM_ANALISE"
    PRECIFICADO = "PRECIFICADO"
    PROPOSTA_EMITIDA = "PROPOSTA_EMITIDA"
    GANHA = "GANHA"
    PERDIDA = "PERDIDA"
    CANCELADA = "CANCELADA"

# Parameters Schemas
class OpportunityParametersSalesBase(BaseModel):
    mkp_padrao: Decimal = Field(default=Decimal("0.00"), max_digits=10, decimal_places=2)
    percentual_despesas_administrativas: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    percentual_comissao_padrao: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    pis_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    cofins_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    csll_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    irpj_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    iss_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)

class OpportunityParametersRentBase(BaseModel):
    prazo_contrato_meses: int = 12
    tipo_receita: str = "COMODATO"
    modo_precificacao: str = "CALCULAR_PRECO"
    margem_padrao_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    comissao_receita_liquida_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    pis_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    cofins_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    irpj_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    csll_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    iss_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    fator_margem_locacao: Decimal = Field(default=Decimal("0.000000"), max_digits=14, decimal_places=6)
    taxa_juros_mensal_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    taxa_manutencao_anual_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)

# Oppportunity Base Schemas
class OpportunityBase(BaseModel):
    titulo_oportunidade: str = Field(..., max_length=255)
    cliente_id: Optional[str] = None
    tipo_cliente: TipoCliente = TipoCliente.PRIVADO
    tipo_operacao: TipoOperacao = TipoOperacao.VENDA
    possui_instalacao: bool = False
    possui_manutencao: bool = False
    status: StatusOportunidade = StatusOportunidade.RASCUNHO
    data_abertura: Optional[date] = None
    responsavel_comercial: Optional[str] = None
    origem_oportunidade: Optional[str] = None
    observacoes: Optional[str] = None
    empresa_id: UUID
    perfil_tributario_origem_id: UUID

class OpportunityCreate(OpportunityBase):
    pass

class OpportunityUpdate(BaseModel):
    titulo_oportunidade: Optional[str] = Field(None, max_length=255)
    cliente_id: Optional[str] = None
    tipo_cliente: Optional[TipoCliente] = None
    tipo_operacao: Optional[TipoOperacao] = None
    possui_instalacao: Optional[bool] = None
    possui_manutencao: Optional[bool] = None
    status: Optional[StatusOportunidade] = None
    responsavel_comercial: Optional[str] = None
    origem_oportunidade: Optional[str] = None
    observacoes: Optional[str] = None

class OpportunityOut(OpportunityBase):
    id: UUID
    numero_oportunidade: str
    tenant_id: str
    valor_total_calculado: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    margem_estimada: Decimal = Field(default=Decimal("0.00"), max_digits=10, decimal_places=2)
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class OpportunityListOut(OpportunityOut):
    pass

# Opportunity Items Schemas
class TipoItem(str, Enum):
    PRODUTO = "PRODUTO"
    KIT = "KIT"

class OpportunityItemBase(BaseModel):
    descricao_manual: Optional[str] = None
    produto_id: Optional[UUID] = None
    tipo_item: TipoItem = TipoItem.PRODUTO
    quantidade: Decimal = Field(default=Decimal("1.0000"), max_digits=15, decimal_places=4)
    unidade: Optional[str] = None
    valor_venda_unitario: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=2)
    observacoes: Optional[str] = None

class OpportunityItemCreate(OpportunityItemBase):
    pass

class OpportunityItemUpdate(BaseModel):
    descricao_manual: Optional[str] = None
    produto_id: Optional[UUID] = None
    tipo_item: Optional[TipoItem] = None
    quantidade: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    unidade: Optional[str] = None
    valor_venda_unitario: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=2)
    observacoes: Optional[str] = None

class OpportunityItemOut(OpportunityItemBase):
    id: UUID
    opportunity_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class OpportunityItemKitBase(BaseModel):
    produto_id: UUID
    quantidade: Decimal = Field(default=Decimal("1.0000"), max_digits=15, decimal_places=4)
    observacoes: Optional[str] = None

class OpportunityItemKitCreate(OpportunityItemKitBase):
    pass

class OpportunityItemKitOut(OpportunityItemKitBase):
    id: UUID
    item_pai_id: UUID

    class Config:
        from_attributes = True

# Opportunity Budget Schemas
class OpportunityBudgetBase(BaseModel):
    tipo_orcamento: str = "REVENDA"
    fornecedor_id: Optional[UUID] = None
    nome_fornecedor_manual: Optional[str] = None
    cnpj_fornecedor: Optional[str] = None
    moeda: str = "BRL"
    cambio: Decimal = Field(default=Decimal("1.0000"), max_digits=10, decimal_places=4)
    data_cotacao: Optional[date] = None
    aliquota_orcamento: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    criar_cenario_difal: bool = False
    is_new_supplier: Optional[bool] = False

class OpportunityBudgetCreate(OpportunityBudgetBase):
    pass


class OpportunityBudgetUpdate(BaseModel):
    tipo_orcamento: Optional[str] = None
    fornecedor_id: Optional[UUID] = None
    nome_fornecedor_manual: Optional[str] = None
    cnpj_fornecedor: Optional[str] = None
    moeda: Optional[str] = None
    cambio: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=4)
    data_cotacao: Optional[date] = None
    aliquota_orcamento: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=2)
    criar_cenario_difal: Optional[bool] = None

class OpportunityBudgetItemBase(BaseModel):
    codigo_fornecedor: Optional[str] = None
    descricao: Optional[str] = None
    quantidade: Decimal = Field(default=Decimal("1.0000"), max_digits=15, decimal_places=4)
    unidade: Optional[str] = None
    ncm: Optional[str] = None
    ipi_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    icms_percentual: Decimal = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    valor_unitario: Decimal = Field(default=Decimal("0.00"), max_digits=15, decimal_places=6)
    
    uf_origem: Optional[str] = None
    uf_destino: Optional[str] = None
    operacao_interestadual: Optional[bool] = False
    aliquota_orcamento_aplicada: Optional[Decimal] = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    aliquota_interna_destino: Optional[Decimal] = Field(default=Decimal("0.00"), max_digits=5, decimal_places=2)
    valor_icms_origem: Optional[Decimal] = Field(default=Decimal("0.00"), max_digits=15, decimal_places=6)
    valor_difal_base: Optional[Decimal] = Field(default=Decimal("0.00"), max_digits=15, decimal_places=6)
    valor_icms_st: Optional[Decimal] = Field(default=Decimal("0.00"), max_digits=15, decimal_places=6)
    diferenca_difal_st: Optional[Decimal] = Field(default=Decimal("0.00"), max_digits=15, decimal_places=6)
    valor_difal_aplicado: Optional[Decimal] = Field(default=Decimal("0.00"), max_digits=15, decimal_places=6)
    custo_com_difal: Optional[Decimal] = Field(default=Decimal("0.00"), max_digits=15, decimal_places=6)
    criar_cenario_difal_aplicado: Optional[bool] = False

    produto_id: Optional[UUID] = None
    oportunidade_item_id_vinculado: Optional[UUID] = None

class OpportunityBudgetItemCreate(OpportunityBudgetItemBase):
    pass

class OpportunityBudgetManualCreate(OpportunityBudgetBase):
    items: List[OpportunityBudgetItemCreate] = []

class OpportunityBudgetItemUpdate(BaseModel):
    codigo_fornecedor: Optional[str] = None
    descricao: Optional[str] = None
    quantidade: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)
    unidade: Optional[str] = None
    ncm: Optional[str] = None
    ipi_percentual: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=2)
    icms_percentual: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=2)
    valor_unitario: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=6)
    
    uf_origem: Optional[str] = None
    uf_destino: Optional[str] = None
    operacao_interestadual: Optional[bool] = None
    aliquota_orcamento_aplicada: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=2)
    aliquota_interna_destino: Optional[Decimal] = Field(default=None, max_digits=5, decimal_places=2)
    valor_icms_origem: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=6)
    valor_difal_base: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=6)
    valor_icms_st: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=6)
    diferenca_difal_st: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=6)
    valor_difal_aplicado: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=6)
    custo_com_difal: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=6)
    criar_cenario_difal_aplicado: Optional[bool] = None

    produto_id: Optional[UUID] = None
    oportunidade_item_id_vinculado: Optional[UUID] = None

class OpportunityBudgetItemOut(OpportunityBudgetItemBase):
    id: UUID
    orcamento_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Nested schemas for Product Budget History endpoint ---
class SupplierBriefOut(BaseModel):
    id: UUID
    razao_social: str
    nome_fantasia: Optional[str] = None
    cnpj: Optional[str] = None
    uf: Optional[str] = None

    class Config:
        from_attributes = True


class BudgetBriefOut(BaseModel):
    id: UUID
    tipo_orcamento: Optional[str] = None
    nome_fornecedor_manual: Optional[str] = None
    cnpj_fornecedor: Optional[str] = None
    moeda: Optional[str] = "BRL"
    cambio: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=6)
    data_cotacao: Optional[date] = None
    origem_lancamento: Optional[str] = None
    valor_total_itens: Optional[Decimal] = Field(default=None, max_digits=18, decimal_places=6)
    valor_total_orcamento: Optional[Decimal] = Field(default=None, max_digits=18, decimal_places=6)
    supplier: Optional[SupplierBriefOut] = None

    class Config:
        from_attributes = True


class ProductBudgetItemWithBudgetOut(OpportunityBudgetItemBase):
    id: UUID
    orcamento_id: UUID
    created_at: datetime
    updated_at: datetime
    budget: Optional[BudgetBriefOut] = None

    class Config:
        from_attributes = True


class OpportunityBudgetOut(OpportunityBudgetBase):
    id: UUID
    opportunity_id: UUID
    valor_total_itens: Decimal = Field(default=Decimal("0.00"), max_digits=18, decimal_places=6)
    valor_total_impostos: Decimal = Field(default=Decimal("0.00"), max_digits=18, decimal_places=6)
    valor_total_orcamento: Decimal = Field(default=Decimal("0.00"), max_digits=18, decimal_places=6)
    created_at: datetime
    updated_at: datetime
    
    items: Optional[List[OpportunityBudgetItemOut]] = []

    class Config:
        from_attributes = True

# Opportunity Parameters Schemas (duplicated class names removed — using the ones at top)
class OpportunityParametersSalesCreate(OpportunityParametersSalesBase):
    pass

class OpportunityParametersSalesUpdate(OpportunityParametersSalesBase):
    pass

class OpportunityParametersSalesOut(OpportunityParametersSalesBase):
    id: UUID
    opportunity_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
