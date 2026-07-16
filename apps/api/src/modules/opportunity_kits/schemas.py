from pydantic import BaseModel, Field
from typing import List, Optional, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal

class OpportunityKitItemBase(BaseModel):
    tipo_item: str = Field(default="PRODUTO")
    product_id: Optional[UUID] = None
    own_service_id: Optional[UUID] = None
    descricao_item: str
    quantidade_no_kit: Decimal = Field(default=Decimal(1))

class OpportunityKitItemCreate(OpportunityKitItemBase):
    pass

class SupplierSimpleResponse(BaseModel):
    id: str
    razao_social: str
    nome_fantasia: Optional[str] = None

    class Config:
        from_attributes = True

class ProductSupplierSimpleResponse(BaseModel):
    supplier: SupplierSimpleResponse

    class Config:
        from_attributes = True

class ProductSimpleResponse(BaseModel):
    codigo: str
    nome: str
    fornecedor_ultimo_preco: Optional[SupplierSimpleResponse] = None
    suppliers: List[ProductSupplierSimpleResponse] = []

    class Config:
        from_attributes = True

class OwnServiceSimpleResponse(BaseModel):
    id: UUID
    nome_servico: str

    class Config:
        from_attributes = True

class OpportunityKitItemResponse(OpportunityKitItemBase):
    id: UUID
    kit_id: UUID
    product: Optional[ProductSimpleResponse] = None
    own_service: Optional[OwnServiceSimpleResponse] = None
    
    class Config:
        from_attributes = True

class OpportunityKitCostBase(BaseModel):
    tipo_item: str = Field(default="PRODUTO")
    product_id: Optional[UUID] = None
    own_service_id: Optional[UUID] = None
    forma_execucao: Optional[str] = None
    tipo_custo: str
    quantidade: Decimal = Field(default=Decimal(1))
    valor_unitario: Decimal = Field(default=Decimal(0))

class OpportunityKitCostCreate(OpportunityKitCostBase):
    pass

class OpportunityKitCostResponse(OpportunityKitCostBase):
    id: UUID
    kit_id: UUID
    product: Optional[ProductSimpleResponse] = None
    own_service: Optional[OwnServiceSimpleResponse] = None
    
    class Config:
        from_attributes = True

class OpportunityKitMonthlyCostBase(BaseModel):
    servico: str
    tipo_custo: str
    quantidade: Decimal = Field(default=Decimal(1))
    valor_unitario: Decimal = Field(default=Decimal(0))

class OpportunityKitMonthlyCostCreate(OpportunityKitMonthlyCostBase):
    pass

class OpportunityKitMonthlyCostResponse(OpportunityKitMonthlyCostBase):
    id: UUID
    kit_id: UUID

    class Config:
        from_attributes = True


class OpportunityKitBase(BaseModel):
    sales_budget_id: Optional[UUID] = None
    licitacao_id: Optional[UUID] = None
    licitacao_item_id: Optional[UUID] = None
    nome_kit: str
    descricao_kit: Optional[str] = None
    quantidade_kits: int = Field(default=1)
    tipo_contrato: str
    considerar_st_ou_difal: Optional[str] = Field(default="DIFAL")
    forma_execucao: Optional[str] = None
    
    prazo_contrato_meses: int
    prazo_instalacao_meses: int = Field(default=0)
    
    fator_margem_locacao: Decimal = Field(default=Decimal(1.0))
    taxa_juros_mensal: Decimal = Field(default=Decimal(0.0))
    taxa_manutencao_anual: Decimal = Field(default=Decimal(0.0))
    
    instalacao_inclusa: bool = Field(default=False)
    percentual_instalacao: Optional[Decimal] = None
    manutencao_inclusa: bool = Field(default=False)
    fator_manutencao: Optional[Decimal] = None
    
    fator_margem_instalacao: Decimal = Field(default=Decimal(1.0))
    fator_margem_manutencao: Decimal = Field(default=Decimal(1.0))
    fator_margem_servicos_produtos: Decimal = Field(default=Decimal(1.0))
    havera_manutencao: bool = Field(default=False)
    qtd_meses_manutencao: Optional[int] = None
    faturamento_servico_separado: bool = Field(default=False)
    
    aliq_pis: Decimal = Field(default=Decimal(0.0))
    aliq_cofins: Decimal = Field(default=Decimal(0.0))
    aliq_csll: Decimal = Field(default=Decimal(0.0))
    aliq_irpj: Decimal = Field(default=Decimal(0.0))
    aliq_iss: Decimal = Field(default=Decimal(0.0))
    aliq_icms: Decimal = Field(default=Decimal(0.0))
    
    perc_frete_venda: Decimal = Field(default=Decimal(0.0))
    perc_despesas_adm: Decimal = Field(default=Decimal(0.0))
    perc_comissao: Decimal = Field(default=Decimal(0.0))
    tipo_comissionamento: str = "TRADICIONAL"
    perc_dsr: Decimal = Field(default=Decimal(0.0))
    perc_fgts: Decimal = Field(default=Decimal(0.0))
    perc_inss: Decimal = Field(default=Decimal(0.0))
    perc_demais_incidencias: Decimal = Field(default=Decimal(0.0))
    perc_despesa_operacional: Decimal = Field(default=Decimal(0.0))
    
    custo_manut_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_suporte_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_seguro_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_logistica_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_software_mensal_kit: Decimal = Field(default=Decimal(0.0))
    custo_itens_acessorios_mensal_kit: Decimal = Field(default=Decimal(0.0))
    
    # Parâmetros de Monitoramento
    custo_monitoramento_unitario: Decimal = Field(default=Decimal(0.0))
    fator_monitoramento: Decimal = Field(default=Decimal(1.0))
    
    # Target Margin (Margem Alvo)
    margem_minima_desejada: Optional[Decimal] = Field(default=None)

    commercial_policy_id: Optional[UUID] = None
    comissionamento_detalhado: Optional[Any] = None

class OpportunityKitCreate(OpportunityKitBase):
    items: List[OpportunityKitItemCreate] = []
    costs: List[OpportunityKitCostCreate] = []
    monthly_costs: List[OpportunityKitMonthlyCostCreate] = []


class OpportunityKitUpdate(BaseModel):
    items: Optional[List[OpportunityKitItemCreate]] = None
    costs: Optional[List[OpportunityKitCostCreate]] = None
    monthly_costs: Optional[List[OpportunityKitMonthlyCostCreate]] = None

    nome_kit: Optional[str] = None
    descricao_kit: Optional[str] = None
    quantidade_kits: Optional[int] = None
    tipo_contrato: Optional[str] = None
    considerar_st_ou_difal: Optional[str] = None
    forma_execucao: Optional[str] = None
    
    prazo_contrato_meses: Optional[int] = None
    prazo_instalacao_meses: Optional[int] = None
    
    fator_margem_locacao: Optional[Decimal] = None
    taxa_juros_mensal: Optional[Decimal] = None
    taxa_manutencao_anual: Optional[Decimal] = None
    
    instalacao_inclusa: Optional[bool] = None
    percentual_instalacao: Optional[Decimal] = None
    manutencao_inclusa: Optional[bool] = None
    fator_manutencao: Optional[Decimal] = None
    
    fator_margem_instalacao: Optional[Decimal] = None
    fator_margem_manutencao: Optional[Decimal] = None
    fator_margem_servicos_produtos: Optional[Decimal] = None
    havera_manutencao: Optional[bool] = None
    qtd_meses_manutencao: Optional[int] = None
    faturamento_servico_separado: Optional[bool] = None
    
    aliq_pis: Optional[Decimal] = None
    aliq_cofins: Optional[Decimal] = None
    aliq_csll: Optional[Decimal] = None
    aliq_irpj: Optional[Decimal] = None
    aliq_iss: Optional[Decimal] = None
    aliq_icms: Optional[Decimal] = None
    
    perc_frete_venda: Optional[Decimal] = None
    perc_despesas_adm: Optional[Decimal] = None
    perc_comissao: Optional[Decimal] = None
    tipo_comissionamento: Optional[str] = None
    perc_dsr: Optional[Decimal] = None
    perc_fgts: Optional[Decimal] = None
    perc_inss: Optional[Decimal] = None
    perc_demais_incidencias: Optional[Decimal] = None
    perc_despesa_operacional: Optional[Decimal] = None
    
    custo_manut_mensal_kit: Optional[Decimal] = None
    custo_suporte_mensal_kit: Optional[Decimal] = None
    custo_seguro_mensal_kit: Optional[Decimal] = None
    custo_logistica_mensal_kit: Optional[Decimal] = None
    custo_software_mensal_kit: Optional[Decimal] = None
    custo_itens_acessorios_mensal_kit: Optional[Decimal] = None
    
    custo_monitoramento_unitario: Optional[Decimal] = None
    fator_monitoramento: Optional[Decimal] = None
    
    # Target Margin (Margem Alvo)
    margem_minima_desejada: Optional[Decimal] = None

class OpportunityKitFinancialSummary(BaseModel):
    prazo_mensalidades: Optional[int] = None
    custo_operacional_mensal_kit: Optional[Decimal] = None
    custo_aquisicao_kit: Optional[Decimal] = None
    custo_aquisicao_produtos: Optional[Decimal] = None
    custo_aquisicao_servicos: Optional[Decimal] = None
    custo_aquisicao_total: Optional[Decimal] = None
    total_difal_kit: Optional[Decimal] = None
    custo_total_mensal_kit: Optional[Decimal] = None
    tx_locacao: Optional[Decimal] = None
    
    vlr_instal_calc: Optional[Decimal] = None
    valor_mensal_locacao_base: Optional[Decimal] = None
    vlt_manut: Optional[Decimal] = None
    valor_base_venda: Optional[Decimal] = None
    valor_parcela_locacao: Optional[Decimal] = None
    manutencao_mensal: Optional[Decimal] = None
    valor_mensal_antes_impostos: Optional[Decimal] = None
    aliq_total_impostos: Optional[Decimal] = None
    valor_impostos: Optional[Decimal] = None
    valor_mensal_kit: Optional[Decimal] = None
    receita_liquida_mensal_kit: Optional[Decimal] = None
    lucro_mensal_kit: Optional[Decimal] = None
    margem_kit: Optional[Decimal] = None
    
    # Totalizadores financeiros do Kit
    venda_total: Optional[Decimal] = None
    custo_total: Optional[Decimal] = None
    lucro_estimado: Optional[Decimal] = None
    margem_geral: Optional[Decimal] = None
    custo_unitario: Optional[Decimal] = None
    venda_unitario: Optional[Decimal] = None
    
    # New granular fields
    imposto_instalacao: Optional[Decimal] = Field(default=Decimal(0))
    valor_comissao_locacao: Optional[Decimal] = Field(default=Decimal(0))
    valor_despesas_adm_locacao: Optional[Decimal] = Field(default=Decimal(0))
    vlt_comissao_dsr_loc: Optional[Decimal] = Field(default=Decimal(0))
    vlt_comissao_fgts_loc: Optional[Decimal] = Field(default=Decimal(0))
    vlt_comissao_inss_loc: Optional[Decimal] = Field(default=Decimal(0))
    vlt_comissao_demais_loc: Optional[Decimal] = Field(default=Decimal(0))
    venda_equipamentos_total: Optional[Decimal] = Field(default=Decimal(0))
    lucro_equipamentos: Optional[Decimal] = Field(default=Decimal(0))
    margem_equipamentos: Optional[Decimal] = Field(default=Decimal(0))
    venda_manutencao_total: Optional[Decimal] = Field(default=Decimal(0))
    lucro_manutencao: Optional[Decimal] = Field(default=Decimal(0))
    margem_manutencao: Optional[Decimal] = Field(default=Decimal(0))
    valor_venda_instalacao: Optional[Decimal] = Field(default=Decimal(0))
    valor_venda_manutencao: Optional[Decimal] = Field(default=Decimal(0))
    
    # Monitoramento fields
    venda_unit_monitoramento: Optional[Decimal] = Field(default=Decimal(0))
    receita_total_monitoramento: Optional[Decimal] = Field(default=Decimal(0))
    custo_total_monitoramento: Optional[Decimal] = Field(default=Decimal(0))
    lucro_total_monitoramento: Optional[Decimal] = Field(default=Decimal(0))
    custo_mensal_bloco_7: Optional[Decimal] = Field(default=Decimal(0))
    
    # ROI payback period in months (LOCACAO/COMODATO only)
    roi_meses: Optional[float] = Field(default=0.0)
    roi_equipamento_meses: Optional[float] = Field(default=0.0)
    investimento_total: Optional[Decimal] = Field(default=Decimal(0))
    roi_denominador: Optional[Decimal] = Field(default=Decimal(0))
    # Granular tax/expense breakdown for Fechamento de Venda
    faturamento_total_venda: Optional[Decimal] = Field(default=Decimal(0))
    imposto_equip_loc: Optional[Decimal] = Field(default=Decimal(0))
    vlt_pis: Optional[Decimal] = Field(default=Decimal(0))
    vlt_cofins: Optional[Decimal] = Field(default=Decimal(0))
    vlt_csll: Optional[Decimal] = Field(default=Decimal(0))
    vlt_irpj: Optional[Decimal] = Field(default=Decimal(0))
    vlt_icms: Optional[Decimal] = Field(default=Decimal(0))
    vlt_iss: Optional[Decimal] = Field(default=Decimal(0))
    vlt_frete_venda: Optional[Decimal] = Field(default=Decimal(0))
    vlt_despesas_adm: Optional[Decimal] = Field(default=Decimal(0))
    vlt_comissao: Optional[Decimal] = Field(default=Decimal(0))
    vlt_comissao_dsr: Optional[Decimal] = Field(default=Decimal(0))
    vlt_comissao_fgts: Optional[Decimal] = Field(default=Decimal(0))
    vlt_comissao_inss: Optional[Decimal] = Field(default=Decimal(0))
    vlt_comissao_demais: Optional[Decimal] = Field(default=Decimal(0))
    vlt_despesa_operacional: Optional[Decimal] = Field(default=Decimal(0))
    custo_equip_total_calc: Optional[Decimal] = Field(default=Decimal(0))
    custo_manut_total_calc: Optional[Decimal] = Field(default=Decimal(0))
    
    credito_icms_compra_total: Optional[Decimal] = Field(default=Decimal(0))
    total_st_kit: Optional[Decimal] = Field(default=Decimal(0))
    total_ipi_kit: Optional[Decimal] = Field(default=Decimal(0))
    total_base_cost_total: Optional[Decimal] = Field(default=Decimal(0))
    total_ipi_total: Optional[Decimal] = Field(default=Decimal(0))
    total_st_total: Optional[Decimal] = Field(default=Decimal(0))
    total_difal_total: Optional[Decimal] = Field(default=Decimal(0))
    
    # Target Margin (Margem Alvo) fields
    fator_minimo_calculado: Optional[Decimal] = Field(default=None)
    valor_venda_minimo: Optional[Decimal] = Field(default=None)
    lucro_minimo: Optional[Decimal] = Field(default=None)
    margem_minima_resultante: Optional[Decimal] = Field(default=None)


class OpportunityKitItemFinancialSummary(BaseModel):
    id: Optional[UUID] = None
    tipo_item: str = Field(default="PRODUTO")
    product_id: Optional[UUID] = None
    own_service_id: Optional[UUID] = None
    custo_base_unitario_item: Decimal
    custo_total_item_no_kit: Decimal
    difal_unitario: Decimal = Field(default=Decimal(0))
    difal_total_item: Decimal = Field(default=Decimal(0))
    venda_unitario_item: Decimal = Field(default=Decimal(0))
    venda_total_item: Decimal = Field(default=Decimal(0))
    imposto_venda_item: Decimal = Field(default=Decimal(0))
    icms_abatido: Decimal = Field(default=Decimal(0))
    base_fornecedor: Decimal = Field(default=Decimal(0))
    ipi_unit: Decimal = Field(default=Decimal(0))
    frete_cif_unit: Decimal = Field(default=Decimal(0))
    icms_st_unitario: Decimal = Field(default=Decimal(0))
    icms_st_total: Decimal = Field(default=Decimal(0))
    pis_unit: Decimal = Field(default=Decimal(0))
    cofins_unit: Decimal = Field(default=Decimal(0))
    csll_unit: Decimal = Field(default=Decimal(0))
    irpj_unit: Decimal = Field(default=Decimal(0))
    icms_unit: Decimal = Field(default=Decimal(0))
    iss_unit: Decimal = Field(default=Decimal(0))
    ipi_percent: float = Field(default=0.0)
    icms_st_normal: Decimal = Field(default=Decimal(0))
    cred_outorgado_percent: float = Field(default=0.0)
    cred_outorgado_valor: Decimal = Field(default=Decimal(0))
    is_bit: bool = Field(default=False)
    is_intrastate: bool = Field(default=True)
    uf_origem: str = Field(default="")
    uf_destino: str = Field(default="")
    custo_unit_final: Decimal = Field(default=Decimal(0))

class OpportunityKitResponse(OpportunityKitBase):
    id: UUID
    items: List[OpportunityKitItemResponse]
    costs: List[OpportunityKitCostResponse] = []
    monthly_costs: List[OpportunityKitMonthlyCostResponse] = []

    summary: Optional[OpportunityKitFinancialSummary] = None
    item_summaries: Optional[List[OpportunityKitItemFinancialSummary]] = None

    class Config:
        from_attributes = True
