export type NcmStHeader = {
    id: string;
    state_id: string;
    state_sigla?: string;
    description: string;
    is_active: boolean;
    tenant_id: string;
    created_at: string;
    updated_at: string;
    created_by?: string;
    updated_by?: string;
    item_count?: number;
}

export type NcmStHeaderCreate = {
    state_id: string;
    description: string;
    is_active?: boolean;
}

export type NcmStHeaderUpdate = {
    state_id?: string;
    description?: string;
    is_active?: boolean;
}

export type NcmStItem = {
    id: string;
    cad_ncm_st_id: string;
    item?: string;
    is_active: boolean;
    ncm_sh?: string;
    ncm_normalizado?: string;
    cest?: string;
    descricao?: string;
    observacoes?: string;
    vigencia_inicio?: string;
    fundamento?: string;
    segmento_anexo?: string;
    cest_normalizado?: string;
    mva_percent?: number;
    vigencia_fim?: string;
    created_at: string;
    updated_at: string;
}

export type ImportSummary = {
    total_processed: number;
    success_count: number;
    error_count: number;
    message: string;
}

export const NCM_ST_MODULE = 'NCM_ST';
