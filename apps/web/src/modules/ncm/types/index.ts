export interface Ncm {
    id: string;
    codigo: string;
    descricao: string;
    data_inicio: string;
    data_fim: string;
    tipo_ato_ini?: string;
    numero_ato_ini?: string;
    ano_ato_ini?: string;
    importacao_id?: string;
    created_at: string;
    updated_at: string;
}

export interface NcmFilters {
    codigo?: string;
    descricao?: string;
    active_only?: boolean;
}

export interface NcmImportResult {
    total_processados: number;
    total_inseridos: number;
    total_atualizados: number;
    total_ignorados: number;
    importacao_id: string;
}

export interface NcmPaginatedResponse {
    items: Ncm[];
    total: number;
    skip: number;
    limit: number;
}

export interface TaxBenefit {
    id: string;
    nome: string;
    descricao?: string;
    esfera: string;
    tributo_alvo: string;
    tipo_beneficio: string;
    ativo: boolean;
}
