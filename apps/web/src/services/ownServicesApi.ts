import { api } from './api';

export interface OwnServiceItem {
  id: string;
  own_service_id: string;
  role_id: string;
  role_name: string | null;
  fator: number;
  tempo_hhmmss: string;
  // Legacy kept for compatibility
  tempo_minutos: number;
  tempo_total_minutos: number;
}

export interface OwnServiceItemCreate {
  role_id: string;
  fator: number;
}

export interface OwnServiceCreate {
  nome_servico: string;
  unidade?: string | null;
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
  unidade: string | null;
  vigencia: number;
  descricao: string | null;
  tempo_total_minutos: number;
  fator_consolidado: number;
  tempo_consolidado_hhmmss: string;
  ativo: boolean;
  items: OwnServiceItem[];
}

export interface OwnServiceListItem {
  id: string;
  nome_servico: string;
  unidade: string | null;
  vigencia: number;
  tempo_total_minutos: number;
  fator_consolidado: number;
  tempo_consolidado_hhmmss: string;
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

/**
 * Convert a decimal factor (hours) to HH:MM:SS string.
 * e.g. fator=1.5 → '01:30:00', fator=0.25 → '00:15:00'
 */
export function fatorToHHMMSS(fator: number): string {
  const totalSeconds = Math.round(fator * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Calculate consolidated fator as average and return { fator, hhmmss }.
 */
export function calcFatorConsolidado(fatores: number[]): { fator: number; hhmmss: string } {
  if (fatores.length === 0) return { fator: 0, hhmmss: '00:00:00' };
  const avg = fatores.reduce((a, b) => a + b, 0) / fatores.length;
  return { fator: parseFloat(avg.toFixed(4)), hhmmss: fatorToHHMMSS(avg) };
}

/** @deprecated Use fatorToHHMMSS instead. Kept for backward compatibility. */
export function formatMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
