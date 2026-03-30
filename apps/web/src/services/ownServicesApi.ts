import { api } from './api';

export interface OwnServiceItem {
  id: string;
  own_service_id: string;
  role_id: string;
  role_name: string | null;
  tempo_horas: number;
  tempo_minutos: number;
  tempo_total_minutos: number;
}

export interface OwnServiceItemCreate {
  role_id: string;
  tempo_horas: number;
  tempo_minutos: number;
}

export interface OwnServiceCreate {
  nome_servico: string;
  vigencia: number;
  descricao?: string;
  items: OwnServiceItemCreate[];
}

export type OwnServiceUpdate = Partial<OwnServiceCreate>;

export interface OwnServiceResponse {
  id: string;
  tenant_id: string;
  company_id: string;
  nome_servico: string;
  vigencia: number;
  descricao: string | null;
  tempo_total_minutos: number;
  ativo: boolean;
  items: OwnServiceItem[];
}

export interface OwnServiceListItem {
  id: string;
  nome_servico: string;
  vigencia: number;
  tempo_total_minutos: number;
  qt_cargos: number;
}

const BASE = '/own-services';

export const ownServicesApi = {
  list: (): Promise<OwnServiceListItem[]> =>
    api.get(BASE).then((r: any) => r.data),

  get: (id: string): Promise<OwnServiceResponse> =>
    api.get(`${BASE}/${id}`).then((r: any) => r.data),

  create: (data: OwnServiceCreate): Promise<OwnServiceResponse> =>
    api.post(BASE, data).then((r: any) => r.data),

  update: (id: string, data: OwnServiceUpdate): Promise<OwnServiceResponse> =>
    api.put(`${BASE}/${id}`, data).then((r: any) => r.data),

  remove: (id: string): Promise<void> =>
    api.delete(`${BASE}/${id}`).then(() => undefined),
};

/** Format minutes as HH:MM */
export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
