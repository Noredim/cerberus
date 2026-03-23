import { api } from './api';

export interface Professional {
  id: string;
  tenant_id: string;
  name: string;
  cpf: string;
  role_id: string;
  user_id: string | null;
  role?: { id: string; name: string };
  user?: { id: string; name: string };
}

export interface CreateProfessionalDTO {
  name: string;
  cpf: string;
  role_id: string;
  user_id?: string | null;
}

export interface UpdateProfessionalDTO {
  name?: string;
  cpf?: string;
  role_id?: string;
  user_id?: string | null;
}

export interface AvailableUser {
  id: string;
  name: string;
  email: string;
}

export const professionalApi = {
  getProfessionals: async (): Promise<Professional[]> => {
    const response = await api.get('/professionals');
    return response.data;
  },

  getAvailableUsers: async (): Promise<AvailableUser[]> => {
    const response = await api.get('/professionals/available-users');
    return response.data;
  },

  createProfessional: async (data: CreateProfessionalDTO): Promise<Professional> => {
    const response = await api.post('/professionals', data);
    return response.data;
  },

  updateProfessional: async (id: string, data: UpdateProfessionalDTO): Promise<Professional> => {
    const response = await api.put(`/professionals/${id}`, data);
    return response.data;
  },

  deleteProfessional: async (id: string): Promise<void> => {
    await api.delete(`/professionals/${id}`);
  },
};
