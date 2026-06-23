export interface TipiImportacao {
    id: string;
    arquivo_nome: string;
    vigencia: string;
    total_linhas: number;
    total_importados: number;
    total_ignorados: number;
    total_erros: number;
    status: 'PROCESSANDO' | 'CONCLUIDO' | 'ERRO';
    created_at: string;
    updated_at: string;
}

export interface NcmTipi {
    id: string;
    ncm_id: string;
    importacao_id: string;
    aliquota: number;
    vigencia: string;
    codigo_ncm?: string;
    descricao_ncm?: string;
}

export interface TipiImportacaoPaginated {
    items: TipiImportacao[];
    total: number;
    skip: number;
    limit: number;
}

export interface NcmTipiPaginated {
    items: NcmTipi[];
    total: number;
    skip: number;
    limit: number;
}
