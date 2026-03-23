import { api } from './api';

export interface Role {
  id: string;
  tenant_id: string;
  company_id: string;
  name: string;
  can_perform_sale: boolean;
}

export interface CreateRoleDTO {
  company_id: string;
  name: string;
  can_perform_sale: boolean;
}

export interface UpdateRoleDTO {
  company_id?: string;
  name?: string;
  can_perform_sale?: boolean;
}

export const roleApi = {
  getRoles: async (): Promise<Role[]> => {
    const response = await api.get('/roles');
    return response.data;
  },

  createRole: async (data: CreateRoleDTO): Promise<Role> => {
    const response = await api.post('/roles', data);
    return response.data;
  },

  updateRole: async (id: string, data: UpdateRoleDTO): Promise<Role> => {
    const response = await api.put(`/roles/${id}`, data);
    return response.data;
  },

  deleteRole: async (id: string): Promise<void> => {
    await api.delete(`/roles/${id}`);
  },
};
