import { api } from './api';

export interface Letterhead {
  id: string;
  tenant_id: string;
  company_id: string;
  nome: string;
  descricao?: string | null;
  conteudo_html: string;
  conteudo_css?: string | null;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface LetterheadCreate {
  nome: string;
  descricao?: string | null;
  conteudo_html: string;
  conteudo_css?: string | null;
  is_active: boolean;
  is_default: boolean;
}

export type LetterheadUpdate = LetterheadCreate;

export interface LetterheadPreviewRequest {
  conteudo_html: string;
  conteudo_css?: string | null;
  sample_content?: string | null;
}

export const letterheadApi = {
  listLetterheads: async (params?: { is_active?: boolean; search?: string }): Promise<Letterhead[]> => {
    const res = await api.get<Letterhead[]>('/document-templates/letterheads', { params });
    return res.data;
  },

  getLetterhead: async (id: string): Promise<Letterhead> => {
    const res = await api.get<Letterhead>(`/document-templates/letterheads/${id}`);
    return res.data;
  },

  createLetterhead: async (data: LetterheadCreate): Promise<Letterhead> => {
    const res = await api.post<Letterhead>('/document-templates/letterheads', data);
    return res.data;
  },

  updateLetterhead: async (id: string, data: LetterheadUpdate): Promise<Letterhead> => {
    const res = await api.put<Letterhead>(`/document-templates/letterheads/${id}`, data);
    return res.data;
  },

  deleteLetterhead: async (id: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete<{ success: boolean; message: string }>(`/document-templates/letterheads/${id}`);
    return res.data;
  },

  previewLetterhead: async (data: LetterheadPreviewRequest): Promise<{ html: string }> => {
    const res = await api.post<{ html: string }>('/document-templates/letterheads/preview', data);
    return res.data;
  },

  uploadImage: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ url: string; filename: string }>('/document-templates/letterheads/upload-image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
