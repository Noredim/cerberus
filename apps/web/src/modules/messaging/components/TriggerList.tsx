import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, ToggleLeft, ToggleRight, Loader2, Zap } from 'lucide-react';
import { getTriggers, deleteTrigger, toggleTrigger } from '../../../services/messagingService';
import TriggerForm from './TriggerForm';

interface Trigger {
    id: string;
    action_key: string;
    action_label: string;
    is_active: boolean;
    subject_template: string;
    body_template: string;
    recipients_type: string;
    recipients_fixed?: string[];
    recipients_roles?: string[];
    created_at: string;
}

const TriggerList: React.FC = () => {
    const [triggers, setTriggers] = useState<Trigger[]>([]);
    const [loading, setLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingTrigger, setEditingTrigger] = useState<Trigger | null>(null);

    const loadTriggers = async () => {
        setLoading(true);
        try {
            const data = await getTriggers();
            setTriggers(data);
        } catch (error) {
            console.error('Failed to load triggers', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTriggers();
    }, []);

    const handleCreate = () => {
        setEditingTrigger(null);
        setIsFormOpen(true);
    };

    const handleEdit = (trigger: Trigger) => {
        setEditingTrigger(trigger);
        setIsFormOpen(true);
    };

    const handleDelete = async (id: string, label: string) => {
        if (!window.confirm(`Remover o trigger "${label}"?`)) return;
        try {
            await deleteTrigger(id);
            await loadTriggers();
        } catch (error: any) {
            alert(error.response?.data?.detail || 'Erro ao remover trigger.');
        }
    };

    const handleToggle = async (id: string) => {
        try {
            await toggleTrigger(id);
            await loadTriggers();
        } catch (error: any) {
            alert(error.response?.data?.detail || 'Erro ao alternar trigger.');
        }
    };

    const handleFormSuccess = () => {
        setIsFormOpen(false);
        setEditingTrigger(null);
        loadTriggers();
    };

    const recipientsLabel = (trigger: Trigger) => {
        if (trigger.recipients_type === 'FIXED') {
            return `${trigger.recipients_fixed?.length || 0} e-mail(s) fixo(s)`;
        }
        if (trigger.recipients_type === 'ROLE_BASED') {
            return `Roles: ${trigger.recipients_roles?.join(', ') || '-'}`;
        }
        return 'Dinâmico';
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                <span className="ml-2 text-text-muted">Carregando triggers...</span>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-text-muted">
                    {triggers.length} trigger(s) configurado(s)
                </p>
                <button
                    onClick={handleCreate}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-all hover:scale-[1.02] shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Novo Trigger
                </button>
            </div>

            {/* Trigger Cards */}
            {triggers.length === 0 ? (
                <div className="text-center py-12 bg-surface border border-border-subtle rounded-xl">
                    <Zap className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
                    <p className="text-text-muted text-sm">Nenhum trigger configurado.</p>
                    <p className="text-text-muted text-xs mt-1">Crie um trigger para disparar e-mails automaticamente.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {triggers.map(trigger => (
                        <div
                            key={trigger.id}
                            className={`bg-surface border rounded-xl p-4 transition-all ${
                                trigger.is_active
                                    ? 'border-border-subtle'
                                    : 'border-border-subtle opacity-60'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono ${
                                            trigger.is_active
                                                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500'
                                        }`}>
                                            {trigger.action_key}
                                        </span>
                                        {trigger.is_active ? (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                                                Ativo
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500">
                                                Inativo
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="text-sm font-semibold text-text-primary">{trigger.action_label}</h4>
                                    <p className="text-xs text-text-muted mt-1 truncate">
                                        Assunto: {trigger.subject_template}
                                    </p>
                                    <p className="text-xs text-text-muted mt-0.5">
                                        Destinatários: {recipientsLabel(trigger)}
                                    </p>
                                </div>

                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => handleToggle(trigger.id)}
                                        className="p-2 rounded-lg hover:bg-bg-deep text-text-muted hover:text-text-primary transition-colors"
                                        title={trigger.is_active ? 'Desativar' : 'Ativar'}
                                    >
                                        {trigger.is_active ? (
                                            <ToggleRight className="w-5 h-5 text-green-500" />
                                        ) : (
                                            <ToggleLeft className="w-5 h-5" />
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleEdit(trigger)}
                                        className="p-2 rounded-lg hover:bg-bg-deep text-text-muted hover:text-brand-primary transition-colors"
                                        title="Editar"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(trigger.id, trigger.action_label)}
                                        className="p-2 rounded-lg hover:bg-red-50 text-text-muted hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
                                        title="Remover"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Trigger Form Modal */}
            {isFormOpen && (
                <TriggerForm
                    trigger={editingTrigger}
                    onClose={() => { setIsFormOpen(false); setEditingTrigger(null); }}
                    onSuccess={handleFormSuccess}
                />
            )}
        </div>
    );
};

export default TriggerList;
