import { api } from './api';

// --- SMTP Config ---

export const getSmtpConfig = async () => {
    const res = await api.get('/messaging/config');
    return res.data;
};

export const saveSmtpConfig = async (data: {
    smtp_host: string;
    smtp_port: number;
    smtp_user: string;
    smtp_password: string;
    smtp_use_tls: boolean;
    smtp_use_ssl: boolean;
    sender_name: string;
    sender_email: string;
    // IMAP Configuration
    imap_host?: string;
    imap_port?: number;
    imap_user?: string;
    imap_password?: string;
    imap_use_ssl?: boolean;
    imap_use_tls?: boolean;
}) => {
    const res = await api.post('/messaging/config', data);
    return res.data;
};

export const updateSmtpConfig = async (data: {
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_password?: string;
    smtp_use_tls?: boolean;
    smtp_use_ssl?: boolean;
    sender_name?: string;
    sender_email?: string;
    // IMAP Configuration
    imap_host?: string;
    imap_port?: number;
    imap_user?: string;
    imap_password?: string;
    imap_use_ssl?: boolean;
    imap_use_tls?: boolean;
}) => {
    const res = await api.put('/messaging/config', data);
    return res.data;
};


export const testSmtpConfig = async (data: {
    recipient_email: string;
    subject?: string;
    body?: string;
    smtp_host?: string;
    smtp_port?: number;
    smtp_user?: string;
    smtp_password?: string;
    smtp_use_tls?: boolean;
    smtp_use_ssl?: boolean;
    sender_name?: string;
    sender_email?: string;
}) => {
    const res = await api.post('/messaging/config/test', data);
    return res.data;
};


// --- Triggers ---

export const getTriggers = async () => {
    const res = await api.get('/messaging/triggers');
    return res.data;
};

export const createTrigger = async (data: {
    action_key: string;
    action_label: string;
    is_active?: boolean;
    subject_template: string;
    body_template: string;
    recipients_type: string;
    recipients_fixed?: string[];
    recipients_roles?: string[];
}) => {
    const res = await api.post('/messaging/triggers', data);
    return res.data;
};

export const updateTrigger = async (id: string, data: {
    action_label?: string;
    is_active?: boolean;
    subject_template?: string;
    body_template?: string;
    recipients_type?: string;
    recipients_fixed?: string[];
    recipients_roles?: string[];
}) => {
    const res = await api.put(`/messaging/triggers/${id}`, data);
    return res.data;
};

export const deleteTrigger = async (id: string) => {
    const res = await api.delete(`/messaging/triggers/${id}`);
    return res.data;
};

export const toggleTrigger = async (id: string) => {
    const res = await api.patch(`/messaging/triggers/${id}/toggle`);
    return res.data;
};

// --- Logs ---

export const getLogs = async (params: {
    status?: string;
    action_key?: string;
    date_from?: string;
    date_to?: string;
    page?: number;
    page_size?: number;
}) => {
    const res = await api.get('/messaging/logs', { params });
    return {
        data: res.data,
        total: parseInt(res.headers['x-total-count'] || '0', 10),
    };
};

export const getLogDetail = async (id: string) => {
    const res = await api.get(`/messaging/logs/${id}`);
    return res.data;
};

export const resendEmail = async (id: string) => {
    const res = await api.post(`/messaging/logs/${id}/resend`);
    return res.data;
};

// --- Available Actions ---

export const getAvailableActions = async () => {
    const res = await api.get('/messaging/actions');
    return res.data;
};
