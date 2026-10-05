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
};
