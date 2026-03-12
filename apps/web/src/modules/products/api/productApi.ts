import { api } from '../../../services/api';
import type { Product, ProductCreate, ProductUpdate, MvaLookupResult } from '../types';

export const productApi = {
    list: async (params?: { q?: string; tipo?: string; skip?: number; limit?: number }) => {
        const response = await api.get<Product[]>('/cadastro/produtos', { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Product>(`/cadastro/produtos/${id}`);
        return response.data;
    },

    create: async (data: ProductCreate) => {
        const response = await api.post<Product>('/cadastro/produtos', data);
        return response.data;
    },

    update: async (id: string, data: ProductUpdate) => {
        const response = await api.put<Product>(`/cadastro/produtos/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/cadastro/produtos/${id}`);
    },

    previewMva: async (ncm: string, company_id: string, finalidade: string) => {
        const response = await api.get<MvaLookupResult>('/cadastro/produtos/mva-preview', {
            params: { ncm, company_id, finalidade }
        });
        return response.data;
    },

    checkBenefits: async (ncm: string) => {
        const response = await api.get<any[]>(`/ncm/check-benefits/${ncm}`);
        return response.data;
    },

    getBudgets: async (productId: string) => {
        const response = await api.get<any[]>(`/cadastro/produtos/${productId}/budgets`);
        return response.data;
    },

    createManualBudget: async (productId: string, data: any) => {
        const response = await api.post(`/cadastro/produtos/${productId}/budgets/manual`, data);
        return response.data;
    }
};
