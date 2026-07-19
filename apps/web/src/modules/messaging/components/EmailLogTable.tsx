import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Send, Loader2, ChevronLeft, ChevronRight, Eye, Filter } from 'lucide-react';
import { getLogs, resendEmail, getAvailableActions } from '../../../services/messagingService';

interface EmailLogEntry {
    id: string;
    action_key: string;
    source_module: string;
    source_entity_id?: string;
    requested_by_user_name: string;
    recipient_email: string;
    subject: string;
    body_preview?: string;
    status: string;
    error_message?: string;
    retry_count: number;
    max_retries: number;
    sent_at?: string;
    created_at: string;
}

interface AvailableAction {
    key: string;
    label: string;
    module: string;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-400', label: 'Pendente' },
    RETRYING: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', label: 'Reenviando' },
    SENT: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', label: 'Enviado' },
    FAILED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', label: 'Falha' },
};

const EmailLogTable: React.FC = () => {
    const [logs, setLogs] = useState<EmailLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [resending, setResending] = useState<string | null>(null);
    const [actions, setActions] = useState<AvailableAction[]>([]);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    const [filters, setFilters] = useState({
        status: '',
        action_key: '',
        date_from: '',
        date_to: '',
        page: 1,
        page_size: 15,
    });

    const loadLogs = useCallback(async () => {
        setLoading(true);
        try {
            const params: any = { page: filters.page, page_size: filters.page_size };
            if (filters.status) params.status = filters.status;
            if (filters.action_key) params.action_key = filters.action_key;
            if (filters.date_from) params.date_from = filters.date_from;
            if (filters.date_to) params.date_to = filters.date_to;

            const result = await getLogs(params);
            setLogs(result.data);
            setTotal(result.total);
        } catch (error) {
            console.error('Failed to load logs', error);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        loadLogs();
    }, [loadLogs]);

    useEffect(() => {
        getAvailableActions().then(setActions).catch(() => {});
    }, []);

    const handleResend = async (logId: string) => {
        if (!window.confirm('Reenviar este e-mail?')) return;
        setResending(logId);
        try {
            await resendEmail(logId);
            await loadLogs();
        } catch (error: any) {
            alert(error.response?.data?.detail || 'Erro ao reenviar.');
        } finally {
            setResending(null);
        }
    };

    const totalPages = Math.ceil(total / filters.page_size);

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('pt-BR', {
            day: '2-digit', month: '2-digit', year: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div className="space-y-4">
            {/* Filters */}
            <div className="bg-surface border border-border-subtle rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-text-muted" />
                    <span className="text-sm font-semibold text-text-primary">Filtros</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select
                        value={filters.status}
                        onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })}
                        className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary text-sm"
                    >
                        <option value="">Todos os status</option>
                        <option value="PENDING">Pendente</option>
                        <option value="RETRYING">Reenviando</option>
                        <option value="SENT">Enviado</option>
                        <option value="FAILED">Falha</option>
                    </select>

                    <select
                        value={filters.action_key}
                        onChange={e => setFilters({ ...filters, action_key: e.target.value, page: 1 })}
                        className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary text-sm"
                    >
                        <option value="">Todas as ações</option>
                        {actions.map(a => (
                            <option key={a.key} value={a.key}>{a.label}</option>
                        ))}
                    </select>

                    <input
                        type="date"
                        value={filters.date_from}
                        onChange={e => setFilters({ ...filters, date_from: e.target.value, page: 1 })}
                        className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary text-sm"
                        placeholder="Data início"
                    />

                    <input
                        type="date"
                        value={filters.date_to}
                        onChange={e => setFilters({ ...filters, date_to: e.target.value, page: 1 })}
                        className="px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary text-sm"
                        placeholder="Data fim"
                    />
                </div>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                    <span className="ml-2 text-text-muted">Carregando logs...</span>
                </div>
            ) : logs.length === 0 ? (
                <div className="text-center py-12 bg-surface border border-border-subtle rounded-xl">
                    <Send className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
                    <p className="text-text-muted text-sm">Nenhum log de envio encontrado.</p>
                </div>
            ) : (
                <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border-subtle bg-bg-deep">
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Data</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Ação</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Módulo</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Usuário</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Destinatário</th>
                                    <th className="text-left px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Assunto</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Tentativas</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                                    <th className="text-center px-4 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {logs.map(log => {
                                    const statusStyle = STATUS_STYLES[log.status] || STATUS_STYLES.PENDING;
                                    const isExpanded = expandedLog === log.id;

                                    return (
                                        <React.Fragment key={log.id}>
                                            <tr className="hover:bg-bg-deep/50 transition-colors">
                                                <td className="px-4 py-3 text-text-secondary whitespace-nowrap text-xs">{formatDate(log.created_at)}</td>
                                                <td className="px-4 py-3">
                                                    <span className="font-mono text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-1.5 py-0.5 rounded">
                                                        {log.action_key}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-text-secondary text-xs">{log.source_module}</td>
                                                <td className="px-4 py-3 text-text-primary font-medium text-xs">{log.requested_by_user_name}</td>
                                                <td className="px-4 py-3 text-text-secondary text-xs truncate max-w-[180px]">{log.recipient_email}</td>
                                                <td className="px-4 py-3 text-text-secondary text-xs truncate max-w-[200px]">{log.subject}</td>
                                                <td className="px-4 py-3 text-center text-text-muted text-xs">{log.retry_count}/{log.max_retries}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusStyle.bg} ${statusStyle.text}`}>
                                                        {statusStyle.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                                                            className="p-1.5 rounded-lg hover:bg-bg-deep text-text-muted hover:text-text-primary transition-colors"
                                                            title="Detalhes"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                        </button>
                                                        {log.status === 'FAILED' && (
                                                            <button
                                                                onClick={() => handleResend(log.id)}
                                                                disabled={resending === log.id}
                                                                className="p-1.5 rounded-lg hover:bg-blue-50 text-text-muted hover:text-blue-600 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
                                                                title="Reenviar"
                                                            >
                                                                {resending === log.id ? (
                                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                ) : (
                                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={9} className="px-4 py-3 bg-bg-deep/50">
                                                        <div className="space-y-2 text-xs">
                                                            {log.error_message && (
                                                                <div className="px-3 py-2 rounded bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800">
                                                                    <strong>Erro:</strong> {log.error_message}
                                                                </div>
                                                            )}
                                                            {log.body_preview && (
                                                                <div className="px-3 py-2 rounded bg-surface border border-border-subtle">
                                                                    <strong className="text-text-primary">Preview:</strong>
                                                                    <p className="text-text-muted mt-1 whitespace-pre-wrap">{log.body_preview}</p>
                                                                </div>
                                                            )}
                                                            <div className="flex gap-4 text-text-muted">
                                                                {log.source_entity_id && <span>Entidade: {log.source_entity_id}</span>}
                                                                {log.sent_at && <span>Enviado em: {formatDate(log.sent_at)}</span>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle">
                            <span className="text-xs text-text-muted">
                                {total} registro(s) — Página {filters.page} de {totalPages}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                                    disabled={filters.page <= 1}
                                    className="p-1.5 rounded-lg hover:bg-bg-deep text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                                    disabled={filters.page >= totalPages}
                                    className="p-1.5 rounded-lg hover:bg-bg-deep text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default EmailLogTable;
