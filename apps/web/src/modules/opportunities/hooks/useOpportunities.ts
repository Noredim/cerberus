import { useState, useCallback } from 'react';
import { api } from '../../../services/api';
import type {
    Opportunity, OpportunityCreatePayload, OpportunityUpdatePayload,
    OpportunityItem, OpportunityItemCreatePayload, OpportunityItemUpdatePayload,
    OpportunityItemKit, OpportunityItemKitCreatePayload,
    OpportunityParametersSales, OpportunityParametersSalesUpdatePayload,
    OpportunityBudget, OpportunityBudgetItem
} from '../types';

export function useOpportunities() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getOpportunities = useCallback(async (skip = 0, limit = 100): Promise<Opportunity[]> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/opportunities/', { params: { skip, limit } });
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar oportunidades');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const getOpportunity = useCallback(async (id: string): Promise<Opportunity> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/opportunities/${id}`);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar oportunidade');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const createOpportunity = useCallback(async (data: OpportunityCreatePayload): Promise<Opportunity> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post('/opportunities/', data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao criar oportunidade');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateOpportunity = useCallback(async (id: string, data: OpportunityUpdatePayload): Promise<Opportunity> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.put(`/ opportunities / ${id} `, data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao atualizar oportunidade');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteOpportunity = useCallback(async (id: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            await api.delete(`/ opportunities / ${id} `);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao deletar oportunidade');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // --- ITEMS ---
    const getItems = useCallback(async (oppId: string): Promise<OpportunityItem[]> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/opportunities/${oppId}/items`);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar itens');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const createItem = useCallback(async (oppId: string, data: OpportunityItemCreatePayload): Promise<OpportunityItem> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post(`/opportunities/${oppId}/items`, data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao criar item');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateItem = useCallback(async (itemId: string, data: OpportunityItemUpdatePayload): Promise<OpportunityItem> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.put(`/opportunities/items/${itemId}`, data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao atualizar item');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteItem = useCallback(async (itemId: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            await api.delete(`/opportunities/items/${itemId}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao deletar item');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // --- KITS ---
    const getKitItems = useCallback(async (itemId: string): Promise<OpportunityItemKit[]> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/opportunities/items/${itemId}/kits`);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar subitens do kit');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const createKitItem = useCallback(async (itemId: string, data: OpportunityItemKitCreatePayload): Promise<OpportunityItemKit> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post(`/opportunities/items/${itemId}/kits`, data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao adicionar kit');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteKitItem = useCallback(async (kitId: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            await api.delete(`/opportunities/items/kits/${kitId}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao remover kit');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // --- BUDGETS (ORÇAMENTOS) ---
    const downloadBudgetTemplate = useCallback(async (): Promise<void> => {
        try {
            const response = await api.get('/opportunities/budgets/template/download', {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'modelo_orcamento.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err: any) {
            console.error('Erro ao baixar modelo:', err);
        }
    }, []);

    const getBudgets = useCallback(async (oppId: string): Promise<OpportunityBudget[]> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/opportunities/${oppId}/budgets`);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar orçamentos');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const uploadBudgetExcel = useCallback(async (
        oppId: string,
        file: File,
        tipoOrcamento: 'REVENDA' | 'ATIVO_IMOBILIZADO'
    ): Promise<OpportunityBudget> => {
        setLoading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('tipo_orcamento', tipoOrcamento);

            const response = await api.post(`/opportunities/${oppId}/budgets/upload`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao importar orçamento via Excel');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const deleteBudget = useCallback(async (id: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            await api.delete(`/opportunities/budgets/${id}`);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao deletar orçamento');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const createManualBudget = useCallback(async (
        oppId: string,
        data: any // using any here temporarily to avoid complex type export matching in this step, but it is OpportunityBudgetManualCreatePayload
    ): Promise<OpportunityBudget> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post(`/opportunities/${oppId}/budgets/manual`, data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao criar orçamento manual');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const linkBudgetItem = useCallback(async (itemId: string, oppItemId: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            await api.put(`/opportunities/budgets/items/${itemId}/link`, { opp_item_id: oppItemId });
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao vincular item');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const unlinkBudgetItem = useCallback(async (itemId: string): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            await api.put(`/opportunities/budgets/items/${itemId}/unlink`);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao desvincular item');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const createProductFromBudgetItem = useCallback(async (itemId: string, companyId: string): Promise<OpportunityBudgetItem> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post(`/opportunities/budgets/items/${itemId}/create-product`, { company_id: companyId });
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao criar produto assistido');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    // --- PARAMETERS ---
    const getParametersSales = useCallback(async (id: string): Promise<OpportunityParametersSales> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get(`/opportunities/${id}/parameters/sales`);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao carregar parâmetros de venda');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const updateParametersSales = useCallback(async (id: string, data: OpportunityParametersSalesUpdatePayload): Promise<OpportunityParametersSales> => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.put(`/opportunities/${id}/parameters/sales`, data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao atualizar parâmetros de venda');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        getOpportunities,
        getOpportunity,
        createOpportunity,
        updateOpportunity,
        deleteOpportunity,
        getItems,
        createItem,
        updateItem,
        deleteItem,
        getKitItems,
        createKitItem,
        deleteKitItem,
        downloadBudgetTemplate,
        getBudgets,
        uploadBudgetExcel,
        deleteBudget,
        createManualBudget,
        linkBudgetItem,
        unlinkBudgetItem,
        createProductFromBudgetItem,

        getParametersSales,
        updateParametersSales
    };
}
