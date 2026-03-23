import { api } from './api';

export interface FunctionalProfilePayload {
    name: string;
    margin_factor_limit: number;
    view_director_consolidation: boolean;
}

export interface FunctionalProfileResponse extends FunctionalProfilePayload {
    id: string;
    tenant_id: string;
    is_protected: boolean;
}

export const getProfiles = async (): Promise<FunctionalProfileResponse[]> => {
    const response = await api.get('/profiles');
    return response.data;
};

export const createFunctionalProfile = async (data: FunctionalProfilePayload): Promise<FunctionalProfileResponse> => {
    const response = await api.post('/profiles', data);
    return response.data;
};

export const updateFunctionalProfile = async (id: string, data: Partial<FunctionalProfilePayload>): Promise<FunctionalProfileResponse> => {
    const response = await api.put(`/profiles/${id}`, data);
    return response.data;
};

export const deleteFunctionalProfile = async (id: string): Promise<void> => {
    await api.delete(`/profiles/${id}`);
};
