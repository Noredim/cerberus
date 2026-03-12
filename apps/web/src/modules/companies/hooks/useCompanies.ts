import { useState, useCallback } from 'react';
import { api } from '../../../services/api';
import type { Company, CNPJLookupResult, CompanySalesParameter } from '../types';

export const useCompanies = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchCompanies = useCallback(async (search?: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get<Company[]>(`/companies`, {
                params: { search }
            });
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao carregar empresas');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getCompany = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get<Company>(`/companies/${id}`);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao carregar detalhes da empresa');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const saveCompany = useCallback(async (data: Partial<Company>) => {
        setLoading(true);
        setError(null);
        try {
            const response = data.id
                ? await api.put<Company>(`/companies/${data.id}`, data)
                : await api.post<Company>(`/companies`, data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao salvar empresa');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const uploadLogo = useCallback(async (id: string, file: File) => {
        setLoading(true);
        setError(null);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post<Company>(`/companies/${id}/logo`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao fazer upload da logo');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const lookupCNPJ = useCallback(async (cnpj: string, forceRefresh: boolean = false) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get<CNPJLookupResult>(`/companies/cnpj/${cnpj.replace(/\D/g, '')}/consultar`, {
                params: { force_refresh: forceRefresh }
            });
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'CNPJ não encontrado ou erro na consulta');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const getSalesParameters = useCallback(async (id: string) => {
        try {
            const response = await api.get<CompanySalesParameter>(`/companies/${id}/sales-parameters`);
            return response.data;
        } catch (err: any) {
            console.error('Erro ao buscar parâmetros de vendas:', err);
            return null;
        }
    }, []);

    const saveSalesParameters = useCallback(async (id: string, data: CompanySalesParameter) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.put<CompanySalesParameter>(`/companies/${id}/sales-parameters`, data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao salvar parâmetros de vendas');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        fetchCompanies,
        getCompany,
        saveCompany,
        lookupCNPJ,
        uploadLogo,
        getSalesParameters,
        saveSalesParameters
    };
};
