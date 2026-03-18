from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal

class OpportunityKitItemBase(BaseModel):
    product_id: UUID
    descricao_item: str
    quantidade_no_kit: Decimal = Field(default=Decimal(1))

class OpportunityKitItemCreate(OpportunityKitItemBase):
    pass

class ProductSimpleResponse(BaseModel):
    codigo: str

    class Config:
        from_attributes = True

class OpportunityKitItemResponse(OpportunityKitItemBase):
    id: UUID
    kit_id: UUID
    product: Optional[ProductSimpleResponse] = None
    
    class Config:
        from_attributes = True

class OpportunityKitBase(BaseModel):
    nome_kit: str
    descricao_kit: Optional[str] = None
    quantidade_kits: int = Field(default=1)
    tipo_contrato: str
    
    prazo_contrato_meses: int
    prazo_instalacao_meses: int = Field(default=0)
    
    fator_margem_locacao: Decimal = Field(default=Decimal(1.0))
    taxa_juros_mensal: Decimal = Field(default=Decimal(0.0))
    taxa_manutencao_anual: Decimal = Field(default=Decimal(0.0))
    
    aliq_pis: Decimal = Field(default=Decimal(0.0))
    aliq_cofins: Decimal = Field(default=Decimal(0.0))
    aliq_csll: Decimal = Field(default=Decimal(0.0))
    aliq_irpj: Decimal = Field(default=Decimal(0.0))
    aliq_iss: Decimal = Field(default=Decimal(0.0))
    
    custo_manut_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_suporte_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_seguro_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_logistica_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_software_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_itens_acessorios_mensal_kit: Decimal = Field(default=Decimal(0.0))

class OpportunityKitCreate(OpportunityKitBase):
    items: List[OpportunityKitItemCreate] = []

class OpportunityKitUpdate(BaseModel):
    items: Optional[List[OpportunityKitItemCreate]] = None
    nome_kit: Optional[str] = None
    descricao_kit: Optional[str] = None
    quantidade_kits: Optional[int] = None
    tipo_contrato: Optional[str] = None
    
    prazo_contrato_meses: Optional[int] = None
    prazo_instalacao_meses: Optional[int] = None
    
    fator_margem_locacao: Optional[Decimal] = None
    taxa_juros_mensal: Optional[Decimal] = None
    taxa_manutencao_anual: Optional[Decimal] = None
    
    aliq_pis: Optional[Decimal] = None
    aliq_cofins: Optional[Decimal] = None
    aliq_csll: Optional[Decimal] = None
    aliq_irpj: Optional[Decimal] = None
    aliq_iss: Optional[Decimal] = None
    
    custo_manut_mensal_kit: Optional[Decimal] = None
    custo_suporte_mensal_kit: Optional[Decimal] = None
    custo_seguro_mensal_kit: Optional[Decimal] = None
    custo_logistica_mensal_kit: Optional[Decimal] = None
    custo_software_mensal_kit: Optional[Decimal] = None
    custo_itens_acessorios_mensal_kit: Optional[Decimal] = None

class OpportunityKitFinancialSummary(BaseModel):
    prazo_mensalidades: int
    custo_operacional_mensal_kit: Decimal
    custo_aquisicao_kit: Decimal
    custo_aquisicao_produtos: Decimal
    custo_aquisicao_servicos: Decimal
    custo_aquisicao_total: Decimal
    total_difal_kit: Decimal
    depreciacao_mensal_kit: Decimal
    custo_total_mensal_kit: Decimal
    tx_locacao: Decimal
    valor_base_venda: Decimal
    valor_parcela_locacao: Decimal
    manutencao_mensal: Decimal
    valor_mensal_antes_impostos: Decimal
    aliq_total_impostos: Decimal
    valor_impostos: Decimal
    valor_mensal_kit: Decimal
    receita_liquida_mensal_kit: Decimal
    lucro_mensal_kit: Decimal
    margem_kit: Decimal

class OpportunityKitItemFinancialSummary(BaseModel):
    id: Optional[UUID] = None
    product_id: UUID
    custo_base_unitario_item: Decimal
    custo_total_item_no_kit: Decimal

class OpportunityKitResponse(OpportunityKitBase):
    id: UUID
    items: List[OpportunityKitItemResponse]
    summary: Optional[OpportunityKitFinancialSummary] = None
    item_summaries: Optional[List[OpportunityKitItemFinancialSummary]] = None

    class Config:
        from_attributes = True
