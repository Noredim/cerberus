import { api } from '../../../services/api';
import type { Customer, CustomerCreate, CustomerUpdate } from '../types';

export const customerApi = {
    list: async (params?: { q?: string; tipo?: string; skip?: number; limit?: number }) => {
        const response = await api.get<Customer[]>('/cadastro/clientes', { params });
        return response.data;
    },

    get: async (id: string) => {
        const response = await api.get<Customer>(`/cadastro/clientes/${id}`);
        return response.data;
    },

    create: async (data: CustomerCreate) => {
        const response = await api.post<Customer>('/cadastro/clientes', data);
        return response.data;
    },

    update: async (id: string, data: CustomerUpdate) => {
        const response = await api.put<Customer>(`/cadastro/clientes/${id}`, data);
        return response.data;
    },

    delete: async (id: string) => {
        await api.delete(`/cadastro/clientes/${id}`);
    }
};
