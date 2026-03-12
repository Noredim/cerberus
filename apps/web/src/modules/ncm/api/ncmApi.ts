import { api } from '../../../services/api';
import type { Ncm, NcmFilters, NcmPaginatedResponse, NcmImportResult, TaxBenefit } from '../types';

export const ncmApi = {
    list: async (skip = 0, limit = 100, filters: NcmFilters = {}): Promise<NcmPaginatedResponse> => {
        const params = new URLSearchParams({
            skip: skip.toString(),
            limit: limit.toString(),
            active_only: (filters.active_only ?? true).toString(),
        });

        if (filters.codigo) params.append('codigo', filters.codigo);
        if (filters.descricao) params.append('descricao', filters.descricao);

        const response = await api.get(`/ncm/?${params.toString()}`);
        return response.data;
    },

    getById: async (id: string): Promise<Ncm> => {
        const response = await api.get(`/ncm/${id}`);
        return response.data;
    },

    save: async (data: Partial<Ncm>): Promise<Ncm> => {
        if (data.id) {
            const response = await api.put(`/ncm/${data.id}`, data);
            return response.data;
        } else {
            const response = await api.post('/ncm/', data);
            return response.data;
        }
    },

    delete: async (id: string): Promise<void> => {
        await api.delete(`/ncm/${id}`);
    },

    importJson: async (jsonData: any): Promise<NcmImportResult> => {
        const response = await api.post('/ncm/importar-json', jsonData);
        return response.data;
    },

    getLinkedBenefits: async (id: string): Promise<TaxBenefit[]> => {
        const response = await api.get(`/ncm/${id}/benefits`);
        return response.data;
    }
};
