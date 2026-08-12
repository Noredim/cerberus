import { api } from './api';

export interface BackupSettings {
  id: string;
  target_ip: string | null;
  target_dir: string | null;
  ssh_user: string | null;
  ssh_port: number;
  has_ssh_password: boolean;
  cron_expression: string;
  retention_count: number;
  is_active: boolean;
  last_backup_at: string | null;
  last_backup_status: string | null;
  last_backup_message: string | null;
  updated_at: string | null;
}

export interface BackupSettingsUpdate {
  target_ip?: string | null;
  target_dir?: string | null;
  ssh_user?: string | null;
  ssh_port?: number;
  ssh_password?: string | null;
  clear_ssh_password?: boolean;
  cron_expression?: string;
  retention_count?: number;
  is_active?: boolean;
}

export interface TestDestinationRequest {
  target_ip?: string | null;
  target_dir?: string | null;
  ssh_user?: string | null;
  ssh_port?: number;
  ssh_password?: string | null;
  use_saved_password?: boolean;
}

export interface TestDestinationResponse {
  success: boolean;
  message: string;
}

export interface BackupFileItem {
  filename: string;
  size_formatted: string;
  size_bytes: number;
  created_at: string;
}

export interface RunBackupResponse {
  success: boolean;
  message: string;
  filename: string;
  remote_destination?: string | null;
}

export const backupApi = {
  getSettings: async (): Promise<BackupSettings> => {
    const res = await api.get<BackupSettings>('/backup/settings');
    return res.data;
  },

  updateSettings: async (data: BackupSettingsUpdate): Promise<BackupSettings> => {
    const res = await api.put<BackupSettings>('/backup/settings', data);
    return res.data;
  },

  testDestination: async (data: TestDestinationRequest): Promise<TestDestinationResponse> => {
    const res = await api.post<TestDestinationResponse>('/backup/test', data);
    return res.data;
  },

  runBackupNow: async (): Promise<RunBackupResponse> => {
    const res = await api.post<RunBackupResponse>('/backup/run');
    return res.data;
  },

  listBackupFiles: async (): Promise<BackupFileItem[]> => {
    const res = await api.get<BackupFileItem[]>('/backup/list');
    return res.data;
  },

  deleteBackupFile: async (filename: string): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete<{ success: boolean; message: string }>(`/backup/${encodeURIComponent(filename)}`);
    return res.data;
  },

  downloadBackupFile: async (filename: string): Promise<Blob> => {
    const res = await api.get(`/backup/download/${encodeURIComponent(filename)}`, {
      responseType: 'blob',
    });
    return res.data;
  },
};
