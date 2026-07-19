import React, { useState, useEffect, useRef } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { createTrigger, updateTrigger, getAvailableActions } from '../../../services/messagingService';

interface TriggerFormProps {
    trigger: {
        id: string;
        action_key: string;
        action_label: string;
        is_active: boolean;
        subject_template: string;
        body_template: string;
        recipients_type: string;
        recipients_fixed?: string[];
        recipients_roles?: string[];
    } | null;
    onClose: () => void;
    onSuccess: () => void;
}

interface Variable {
    name: string;
    description: string;
}

interface AvailableAction {
    key: string;
    label: string;
    module: string;
    variables: Variable[];
}

const ROLE_OPTIONS = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'ENGENHARIA_PRECO', label: 'Engenharia de Preço' },
    { value: 'DIRETORIA', label: 'Diretoria' },
];

const TriggerForm: React.FC<TriggerFormProps> = ({ trigger, onClose, onSuccess }) => {
    const isEditing = !!trigger;
    const [saving, setSaving] = useState(false);
    const [actions, setActions] = useState<AvailableAction[]>([]);
    const [error, setError] = useState('');

    const subjectRef = useRef<HTMLInputElement>(null);
    const bodyRef = useRef<HTMLTextAreaElement>(null);

    const [form, setForm] = useState({
        action_key: trigger?.action_key || '',
        action_label: trigger?.action_label || '',
        is_active: trigger?.is_active ?? true,
        subject_template: trigger?.subject_template || '',
        body_template: trigger?.body_template || '',
        recipients_type: trigger?.recipients_type || 'FIXED',
        recipients_fixed_text: trigger?.recipients_fixed?.join(', ') || '',
        recipients_roles: trigger?.recipients_roles || [],
    });

    useEffect(() => {
        loadActions();
    }, []);

    const loadActions = async () => {
        try {
            const data = await getAvailableActions();
            setActions(data);
        } catch (e) {
            console.error('Failed to load actions', e);
        }
    };

    const handleActionChange = (key: string) => {
        const action = actions.find(a => a.key === key);
        setForm({
            ...form,
            action_key: key,
            action_label: action?.label || form.action_label,
        });
    };

    const handleRoleToggle = (role: string) => {
        const current = form.recipients_roles;
        if (current.includes(role)) {
            setForm({ ...form, recipients_roles: current.filter(r => r !== role) });
        } else {
            setForm({ ...form, recipients_roles: [...current, role] });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSaving(true);

        const payload: any = {
            action_key: form.action_key,
            action_label: form.action_label,
            is_active: form.is_active,
            subject_template: form.subject_template,
            body_template: form.body_template,
            recipients_type: form.recipients_type,
        };

        if (form.recipients_type === 'FIXED') {
            payload.recipients_fixed = form.recipients_fixed_text
                .split(',')
                .map(e => e.trim())
                .filter(e => e.length > 0);
        } else if (form.recipients_type === 'ROLE_BASED') {
            payload.recipients_roles = form.recipients_roles;
        }

        try {
            if (isEditing) {
                await updateTrigger(trigger!.id, payload);
            } else {
                await createTrigger(payload);
            }
            onSuccess();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao salvar trigger.');
        } finally {
            setSaving(false);
        }
    };

    const activeAction = actions.find(a => a.key === form.action_key);

    const insertVariable = (varName: string) => {
        const tag = `{{${varName}}}`;
        const activeEl = document.activeElement;

        if (activeEl === subjectRef.current) {
            const start = subjectRef.current?.selectionStart || 0;
            const end = subjectRef.current?.selectionEnd || 0;
            const val = form.subject_template;
            const newVal = val.substring(0, start) + tag + val.substring(end);
            setForm({ ...form, subject_template: newVal });
            setTimeout(() => {
                if (subjectRef.current) {
                    subjectRef.current.focus();
                    subjectRef.current.setSelectionRange(start + tag.length, start + tag.length);
                }
            }, 50);
        } else {
            const start = bodyRef.current?.selectionStart || 0;
            const end = bodyRef.current?.selectionEnd || 0;
            const val = form.body_template;
            const newVal = val.substring(0, start) + tag + val.substring(end);
            setForm({ ...form, body_template: newVal });
            setTimeout(() => {
                if (bodyRef.current) {
                    bodyRef.current.focus();
                    bodyRef.current.setSelectionRange(start + tag.length, start + tag.length);
                }
            }, 50);
        }
    };

    const handleDragStart = (e: React.DragEvent, varName: string) => {
        e.dataTransfer.setData('text/plain', `{{${varName}}}`);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDropSubject = (e: React.DragEvent) => {
        e.preventDefault();
        const tag = e.dataTransfer.getData('text/plain');
        if (tag) {
            const start = subjectRef.current?.selectionStart || 0;
            const end = subjectRef.current?.selectionEnd || 0;
            const val = form.subject_template;
            const newVal = val.substring(0, start) + tag + val.substring(end);
            setForm({ ...form, subject_template: newVal });
        }
    };

    const handleDropBody = (e: React.DragEvent) => {
        e.preventDefault();
        const tag = e.dataTransfer.getData('text/plain');
        if (tag) {
            const start = bodyRef.current?.selectionStart || 0;
            const end = bodyRef.current?.selectionEnd || 0;
            const val = form.body_template;
            const newVal = val.substring(0, start) + tag + val.substring(end);
            setForm({ ...form, body_template: newVal });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-surface border border-border-subtle rounded-2xl shadow-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto m-4">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
                    <h2 className="text-lg font-bold text-text-primary">
                        {isEditing ? 'Editar Trigger' : 'Novo Trigger'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-bg-deep text-text-muted hover:text-text-primary transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Wrapper */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Form Fields */}
                        <div className="lg:col-span-2 space-y-5">
                            {/* Action Selection */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Ação</label>
                                {isEditing ? (
                                    <div className="px-3 py-2 rounded-lg bg-bg-deep border border-border-subtle text-sm text-text-muted">
                                        <span className="font-mono text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded mr-2">
                                            {form.action_key}
                                        </span>
                                        {form.action_label}
                                    </div>
                                ) : (
                                    <select
                                        value={form.action_key}
                                        onChange={e => handleActionChange(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                                        required
                                    >
                                        <option value="">Selecione uma ação...</option>
                                        {actions.map(a => (
                                            <option key={a.key} value={a.key}>
                                                [{a.module}] {a.label}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>

                            {/* Label */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Nome do Trigger</label>
                                <input
                                    type="text"
                                    value={form.action_label}
                                    onChange={e => setForm({ ...form, action_label: e.target.value })}
                                    placeholder="Ex: Notificar equipe sobre nova oportunidade"
                                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                                    required
                                />
                            </div>

                            {/* Subject Template */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1 flex justify-between items-center">
                                    <span>Assunto do E-mail</span>
                                    <span className="text-[10px] text-text-muted">Use variáveis do painel ao lado</span>
                                </label>
                                <input
                                    ref={subjectRef}
                                    type="text"
                                    value={form.subject_template}
                                    onChange={e => setForm({ ...form, subject_template: e.target.value })}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDropSubject}
                                    placeholder="Ex: Nova oportunidade: {{numero}} - {{cliente}}"
                                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                                    required
                                />
                            </div>

                            {/* Body Template */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1 flex justify-between items-center">
                                    <span>Corpo do E-mail (HTML)</span>
                                    <span className="text-[10px] text-text-muted">Arraste ou solte variáveis aqui</span>
                                </label>
                                <textarea
                                    ref={bodyRef}
                                    value={form.body_template}
                                    onChange={e => setForm({ ...form, body_template: e.target.value })}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDropBody}
                                    placeholder="<p>Olá,</p><p>Uma nova oportunidade foi criada: <strong>{{numero}}</strong></p>"
                                    rows={8}
                                    className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary font-mono"
                                    required
                                />
                            </div>

                            {/* Recipients Type */}
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-2">Destinatários</label>
                                <div className="flex gap-2 mb-3">
                                    {[
                                        { value: 'FIXED', label: 'E-mails Fixos' },
                                        { value: 'ROLE_BASED', label: 'Por Perfil' },
                                        { value: 'DYNAMIC', label: 'Dinâmico' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            onClick={() => setForm({ ...form, recipients_type: opt.value })}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                                                form.recipients_type === opt.value
                                                    ? 'bg-brand-primary text-white'
                                                    : 'bg-bg-deep text-text-muted hover:text-text-primary border border-border-subtle'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>

                                {form.recipients_type === 'FIXED' && (
                                    <div>
                                        <input
                                            type="text"
                                            value={form.recipients_fixed_text}
                                            onChange={e => setForm({ ...form, recipients_fixed_text: e.target.value })}
                                            placeholder="email1@empresa.com, email2@empresa.com"
                                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary text-sm focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary"
                                        />
                                        <p className="text-xs text-text-muted mt-1">Separe múltiplos e-mails por vírgula.</p>
                                    </div>
                                )}

                                {form.recipients_type === 'ROLE_BASED' && (
                                    <div className="space-y-2">
                                        {ROLE_OPTIONS.map(role => (
                                            <label key={role.value} className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={form.recipients_roles.includes(role.value)}
                                                    onChange={() => handleRoleToggle(role.value)}
                                                    className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary/30"
                                                />
                                                {role.label}
                                            </label>
                                        ))}
                                    </div>
                                )}

                                {form.recipients_type === 'DYNAMIC' && (
                                    <p className="text-xs text-text-muted bg-bg-deep border border-border-subtle rounded-lg px-3 py-2">
                                        Os destinatários serão definidos dinamicamente pelo módulo que disparar a ação
                                        (ex: o responsável pela oportunidade).
                                    </p>
                                )}
                            </div>

                            {/* Error */}
                            {error && (
                                <div className="px-4 py-3 rounded-lg text-sm font-medium bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
                                    {error}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="px-4 py-2 text-sm font-semibold text-text-muted hover:text-text-primary transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                    {isEditing ? 'Salvar Alterações' : 'Criar Trigger'}
                                </button>
                            </div>
                        </div>

                        {/* Right Column: Available Variables Panel */}
                        <div className="lg:col-span-1 bg-bg-deep border border-border-subtle rounded-xl p-4 self-start space-y-4">
                            <div>
                                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Variáveis Dinâmicas</h3>
                                <p className="text-[11px] text-text-muted mt-1 leading-relaxed">
                                    Arraste os cards para o assunto/corpo do e-mail ou dê um clique duplo/clique no botão para inserir na posição atual do cursor.
                                </p>
                            </div>

                            {activeAction && activeAction.variables && activeAction.variables.length > 0 ? (
                                <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                                    {activeAction.variables.map(v => (
                                        <div
                                            key={v.name}
                                            draggable
                                            onDragStart={e => handleDragStart(e, v.name)}
                                            onDoubleClick={() => insertVariable(v.name)}
                                            className="group flex items-center justify-between p-2.5 rounded-lg bg-surface border border-border-subtle hover:border-brand-primary cursor-grab active:cursor-grabbing transition-all hover:scale-[1.01] select-none"
                                            title="Clique duplo ou arraste para inserir"
                                        >
                                            <div className="flex-1 pr-2">
                                                <span className="font-mono text-[11px] font-bold text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded">
                                                    {`{{${v.name}}}`}
                                                </span>
                                                <p className="text-[11px] text-text-secondary mt-1.5 group-hover:text-text-primary transition-colors leading-tight">
                                                    {v.description}
                                                </p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => insertVariable(v.name)}
                                                className="opacity-0 group-hover:opacity-100 transition-opacity px-2 py-1 text-[10px] font-bold text-white bg-brand-primary rounded hover:bg-brand-primary/90 shadow-sm shrink-0"
                                            >
                                                Inserir
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-xs text-text-muted border border-dashed border-border-subtle rounded-lg px-3 leading-relaxed">
                                    Selecione uma ação na lista à esquerda para visualizar as variáveis dinâmicas disponíveis.
                                </div>
                            )}
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TriggerForm;
