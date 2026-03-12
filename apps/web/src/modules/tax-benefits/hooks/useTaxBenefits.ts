import { useState, useCallback } from 'react';
import { api } from '../../../services/api';
import type { TaxBenefit } from '../types';

export const useTaxBenefits = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBenefits = useCallback(async (search?: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get<TaxBenefit[]>(`/tax-benefits`, {
                params: { search }
            });
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao carregar benefícios');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const getBenefit = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get<TaxBenefit>(`/tax-benefits/${id}`);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao carregar detalhes do benefício');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const saveBenefit = useCallback(async (data: Partial<TaxBenefit>) => {
        setLoading(true);
        setError(null);
        try {
            const response = data.id
                ? await api.put<TaxBenefit>(`/tax-benefits/${data.id}`, data)
                : await api.post<TaxBenefit>(`/tax-benefits`, data);
            return response.data;
        } catch (err: any) {
            setError(err.response?.data?.message || 'Erro ao salvar benefício');
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        fetchBenefits,
        getBenefit,
        saveBenefit
    };
};
