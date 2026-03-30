import { api } from './api';

export interface ManHour {
  id: string;
  tenant_id: string;
  company_id: string;
  role_id: string;
  role_name: string | null;
  vigencia: number;
  hora_normal: number;
  hora_extra: number;
  hora_extra_adicional_noturno: number;
  hora_extra_domingos_feriados: number;
  hora_extra_domingos_feriados_noturno: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface ManHourCreate {
  role_id: string;
  vigencia: number;
  hora_normal: number;
  hora_extra: number;
  hora_extra_adicional_noturno: number;
  hora_extra_domingos_feriados: number;
  hora_extra_domingos_feriados_noturno: number;
}

export type ManHourUpdate = Partial<ManHourCreate>;

const BASE = '/man-hours';

export const manHoursApi = {
  list: (): Promise<ManHour[]> =>
    api.get(BASE).then((res: any) => res.data),

  get: (id: string): Promise<ManHour> =>
    api.get(`${BASE}/${id}`).then((res: any) => res.data),

  create: (data: ManHourCreate): Promise<ManHour> =>
    api.post(BASE, data).then((res: any) => res.data),

  update: (id: string, data: ManHourUpdate): Promise<ManHour> =>
    api.put(`${BASE}/${id}`, data).then((res: any) => res.data),

  remove: (id: string): Promise<void> =>
    api.delete(`${BASE}/${id}`).then(() => undefined),
};
