export type TipoCliente = 'PRIVADO' | 'PUBLICO';
export type TipoOperacao = 'VENDA' | 'COMODATO_LOCACAO';
export type StatusOportunidade =
    | 'RASCUNHO'
    | 'EM_FORMACAO'
    | 'EM_COTACAO'
    | 'EM_ANALISE'
    | 'PRECIFICADO'
    | 'PROPOSTA_EMITIDA'
    | 'GANHA'
    | 'PERDIDA'
    | 'CANCELADA';

export interface OpportunityParametersSales {
    id: string;
    opportunity_id: string;
    mkp_padrao: number;
    percentual_despesas_administrativas: number;
    percentual_comissao_padrao: number;
    pis_percentual: number;
    cofins_percentual: number;
    csll_percentual: number;
    irpj_percentual: number;
    iss_percentual: number;
}

export type OpportunityParametersSalesUpdatePayload = Omit<OpportunityParametersSales, 'id' | 'opportunity_id'>;

export interface OpportunityParametersRent {
    id: string;
    opportunity_id: string;
    prazo_contrato_meses: number;
    tipo_receita: 'COMODATO' | 'LOCACAO_PURA';
    modo_precificacao: 'CALCULAR_PRECO' | 'ANALISAR_PRECO';
    margem_padrao_percentual: number;
    comissao_receita_liquida_percentual: number;
    pis_percentual: number;
    cofins_percentual: number;
    irpj_percentual: number;
    csll_percentual: number;
    iss_percentual: number;
    fator_margem_locacao: number;
    taxa_juros_mensal_percentual: number;
    taxa_manutencao_anual_percentual: number;
}

export interface Opportunity {
    id: string;
    numero_oportunidade: string;
    titulo_oportunidade: string;
    cliente_id?: string;
    tipo_cliente: TipoCliente;
    tipo_operacao: TipoOperacao;
    possui_instalacao: boolean;
    possui_manutencao: boolean;
    status: StatusOportunidade;
    data_abertura?: string;
    responsavel_comercial?: string;
    origem_oportunidade?: string;
    observacoes?: string;
    empresa_id: string;
    perfil_tributario_origem_id: string;
    valor_total_calculado: number;
    margem_estimada: number;
    created_at: string;
    updated_at: string;
}

export interface OpportunityCreatePayload {
    titulo_oportunidade: string;
    cliente_id?: string;
    tipo_cliente: TipoCliente;
    tipo_operacao: TipoOperacao;
    possui_instalacao: boolean;
    possui_manutencao: boolean;
    status: StatusOportunidade;
    data_abertura?: string;
    responsavel_comercial?: string;
    origem_oportunidade?: string;
    observacoes?: string;
    empresa_id: string;
    perfil_tributario_origem_id: string;
}

export interface OpportunityUpdatePayload extends Partial<OpportunityCreatePayload> { }

export type TipoItem = 'PRODUTO' | 'KIT';

export interface OpportunityItem {
    id: string;
    opportunity_id: string;
    descricao_manual?: string;
    produto_id?: string;
    tipo_item: TipoItem;
    quantidade: number;
    unidade?: string;
    valor_venda_unitario: number;
    observacoes?: string;
    created_at: string;
    updated_at: string;
}

export interface OpportunityItemCreatePayload {
    descricao_manual?: string;
    produto_id?: string;
    tipo_item: TipoItem;
    quantidade: number;
    unidade?: string;
    valor_venda_unitario: number;
    observacoes?: string;
}

export interface OpportunityItemUpdatePayload extends Partial<OpportunityItemCreatePayload> { }

export interface OpportunityItemKit {
    id: string;
    item_pai_id: string;
    produto_id: string;
    quantidade: number;
    observacoes?: string;
}

export interface OpportunityItemKitCreatePayload {
    produto_id: string;
    quantidade: number;
    observacoes?: string;
}

export interface OpportunityBudgetItem {
    id: string;
    orcamento_id: string;
    codigo_fornecedor?: string;
    descricao?: string;
    quantidade: number;
    unidade?: string;
    ncm?: string;
    ipi_percentual: number;
    icms_percentual: number;
    valor_unitario: number;
    produto_id?: string;
    oportunidade_item_id_vinculado?: string;
}

export type OpportunityBudgetItemCreatePayload = Omit<OpportunityBudgetItem, 'id' | 'orcamento_id' | 'oportunidade_item_id_vinculado' | 'produto_id'> & { produto_id?: string };

export interface OpportunityBudget {
    id: string;
    opportunity_id: string;
    tipo_orcamento: 'REVENDA' | 'ATIVO_IMOBILIZADO';
    fornecedor_id?: string;
    nome_fornecedor_manual?: string;
    cnpj_fornecedor?: string;
    moeda: string;
    cambio: number;
    data_cotacao?: string;
    valor_total_itens: number;
    valor_total_impostos: number;
    valor_total_orcamento: number;
    created_at: string;
    updated_at: string;
    is_new_supplier?: boolean;
    aliquota_orcamento?: number;
    criar_cenario_difal?: boolean;
    items?: OpportunityBudgetItem[];
}

export interface OpportunityBudgetManualCreatePayload {
    tipo_orcamento: 'REVENDA' | 'ATIVO_IMOBILIZADO';
    fornecedor_id?: string;
    nome_fornecedor_manual?: string;
    cnpj_fornecedor?: string;
    moeda: string;
    cambio: number;
    data_cotacao?: string;
    aliquota_orcamento?: number;
    criar_cenario_difal?: boolean;
    items: OpportunityBudgetItemCreatePayload[];
}
