import { api } from './api';

export interface InsideTestConnectionResponse {
    success: boolean;
    status_code: number;
    message: string;
    latency_ms: number;
    data?: any;
    error?: string;
}

export interface IntegrationLogItem {
    id: string;
    company_id: string;
    integration_type: string;
    endpoint: string;
    http_method: string;
    status_code?: number;
    request_payload?: any;
    response_payload?: any;
    execution_time_ms?: number;
    error_message?: string;
    created_at: string;
}

export interface IntegrationLogsPaginated {
    items: IntegrationLogItem[];
    total: number;
    page: number;
    size: number;
}

export interface InsideMappingCheckItem {
    tipo: string;
    item_id?: string;
    nome_descricao: string;
    codigo_service?: number;
    status: 'OK' | 'PENDENTE';
    mensagem?: string;
}

export interface InsideDryRunResponse {
    is_valid: boolean;
    status_conexao: boolean;
    mensagem: string;
    itens_analisados: number;
    itens_pendentes: number;
    checklist: InsideMappingCheckItem[];
    payloads: {
        prospect?: any;
        orcamento?: any;
        produtos?: any;
        servicos?: any;
        antecipacao?: any;
    };
}

export const insideIntegrationApi = {
    testConnection: async (companyId: string, targetEnv: 'SERVICOS' | 'PRODUTOS' | 'DEFAULT' = 'DEFAULT'): Promise<InsideTestConnectionResponse> => {
        const response = await api.post<InsideTestConnectionResponse>(`/companies/${companyId}/inside/test-connection`, null, {
            params: { target_env: targetEnv }
        });
        return response.data;
    },

    getLogs: async (companyId: string, page: number = 1, size: number = 20): Promise<IntegrationLogsPaginated> => {
        const response = await api.get<IntegrationLogsPaginated>(`/companies/${companyId}/inside/logs`, {
            params: { page, size }
        });
        return response.data;
    },

    dryRunSalesBudget: async (companyId: string, budgetId: string): Promise<InsideDryRunResponse> => {
        const response = await api.post<InsideDryRunResponse>(`/companies/${companyId}/inside/dry-run/sales-budget/${budgetId}`);
        return response.data;
    },

    syncFormasPagamento: async (companyId: string, targetEnv: 'SERVICOS' | 'PRODUTOS' | 'DEFAULT' = 'SERVICOS'): Promise<any> => {
        const response = await api.post(`/companies/${companyId}/inside/sync/formas-pagamento`, null, {
            params: { target_env: targetEnv }
        });
        return response.data;
    },

    testEstoqueConnection: async (companyId: string): Promise<InsideTestConnectionResponse> => {
        const response = await api.post<InsideTestConnectionResponse>(`/companies/${companyId}/inside/test-estoque-connection`);
        return response.data;
    },

    consultarEstoque: async (
        companyId: string,
        params?: { nome?: string; cod_produto?: string; tipo_estoque?: string }
    ): Promise<any[]> => {
        const response = await api.get<any[]>(`/companies/${companyId}/inside/estoque/consulta`, {
            params
        });
        return response.data;
    },

    syncProductStock: async (companyId: string, productId: string): Promise<any> => {
        const response = await api.post(`/companies/${companyId}/inside/products/${productId}/sync`);
        return response.data;
    },

    getCorrelationAnalysis: async (companyId: string, filterStockOnly: boolean = false): Promise<{
        summary: {
            total_inside: number;
            linked_count: number;
            exact_match_count: number;
            high_similarity_count: number;
            medium_similarity_count: number;
            low_similarity_count: number;
            unmatched_count: number;
        };
        items: Array<{
            inside: {
                empresa?: string;
                fantasia?: string;
                codEstoque?: string;
                tipoEstoque?: string;
                codProduto?: string;
                descricao?: string;
                preco?: number;
                custo?: number;
                entrada?: number;
                saida?: number;
                saldo?: number;
            };
            tier: 'LINKED' | 'EXACT_MATCH' | 'HIGH_SIMILARITY' | 'MEDIUM_SIMILARITY' | 'LOW_SIMILARITY' | 'UNMATCHED';
            similarity_ratio: number;
            is_linked: boolean;
            suggested_product?: {
                id: string;
                codigo: string;
                nome: string;
                codigo_service?: number;
                categoria?: string;
                part_number?: string;
                ultimo_preco_compra?: number;
            } | null;
        }>;
    }> => {
        const response = await api.get(`/companies/${companyId}/inside/correlation/analysis`, {
            params: { filter_stock_only: filterStockOnly }
        });
        return response.data;
    },

    linkProductManually: async (companyId: string, productId: string, codProduto: number): Promise<any> => {
        const response = await api.post(`/companies/${companyId}/inside/correlation/link`, null, {
            params: { product_id: productId, cod_produto: codProduto }
        });
        return response.data;
    },

    autoLinkExact: async (companyId: string): Promise<{
        success: boolean;
        linked_count: number;
        errors: string[];
        message: string;
    }> => {
        const response = await api.post(`/companies/${companyId}/inside/correlation/auto-link-exact`);
        return response.data;
    },

    batchLinkProducts: async (companyId: string, items: Array<{ product_id: string; cod_produto: number }>): Promise<{
        success: boolean;
        linked_count: number;
        errors: string[];
        message: string;
    }> => {
        const response = await api.post(`/companies/${companyId}/inside/correlation/batch-link`, {
            items
        });
        return response.data;
    },

    importProductFromInside: async (companyId: string, codProduto: number): Promise<any> => {
        const response = await api.post(`/companies/${companyId}/inside/correlation/import-product`, null, {
            params: { cod_produto: codProduto }
        });
        return response.data;
    },
};


