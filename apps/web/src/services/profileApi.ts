import { api } from './api';

export interface FunctionalProfilePayload {
    name: string;
    margin_factor_limit: number;
    view_director_consolidation: boolean;
}

export const createFunctionalProfile = async (data: FunctionalProfilePayload) => {
    const response = await api.post('/profiles', data);
    return response.data;
};
