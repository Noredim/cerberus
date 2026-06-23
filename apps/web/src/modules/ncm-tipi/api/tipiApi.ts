import { api } from '../../../services/api';
import type { TipiImportacao, TipiImportacaoPaginated, NcmTipiPaginated } from '../types';

export const tipiApi = {
    importar: async (file: File, vigencia: string): Promise<TipiImportacao> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('vigencia', vigencia);

        const response = await api.post<TipiImportacao>('/cadastro/tipi/importar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    listImportacoes: async (skip = 0, limit = 100): Promise<TipiImportacaoPaginated> => {
        const params = new URLSearchParams({
            skip: skip.toString(),
            limit: limit.toString(),
        });
        const response = await api.get<TipiImportacaoPaginated>(`/cadastro/tipi/importacoes?${params.toString()}`);
        return response.data;
    },

    listValores: async (skip = 0, limit = 100, codigoNcm?: string): Promise<NcmTipiPaginated> => {
        const params = new URLSearchParams({
            skip: skip.toString(),
            limit: limit.toString(),
        });
        if (codigoNcm) {
            params.append('codigo_ncm', codigoNcm);
        }
        const response = await api.get<NcmTipiPaginated>(`/cadastro/tipi/valores?${params.toString()}`);
        return response.data;
    },
};
