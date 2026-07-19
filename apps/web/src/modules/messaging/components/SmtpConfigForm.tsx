import React, { useState, useEffect } from 'react';
import { Save, Send, Loader2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { getSmtpConfig, saveSmtpConfig, testSmtpConfig } from '../../../services/messagingService';

interface SmtpConfigFormProps {
    onSaved?: () => void;
}

const SmtpConfigForm: React.FC<SmtpConfigFormProps> = ({ onSaved }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [showImapPassword, setShowImapPassword] = useState(false);
    const [hasExistingConfig, setHasExistingConfig] = useState(false);

    const [form, setForm] = useState({
        smtp_host: '',
        smtp_port: 587,
        smtp_user: '',
        smtp_password: '',
        smtp_use_tls: true,
        smtp_use_ssl: false,
        sender_name: '',
        sender_email: '',
        // IMAP Fields
        imap_host: '',
        imap_port: 993,
        imap_user: '',
        imap_password: '',
        imap_use_ssl: true,
        imap_use_tls: false,
    });

    const [testEmail, setTestEmail] = useState('');

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const config = await getSmtpConfig();
            if (config) {
                setForm({
                    smtp_host: config.smtp_host || '',
                    smtp_port: config.smtp_port || 587,
                    smtp_user: config.smtp_user || '',
                    smtp_password: '',
                    smtp_use_tls: config.smtp_use_tls ?? true,
                    smtp_use_ssl: config.smtp_use_ssl ?? false,
                    sender_name: config.sender_name || '',
                    sender_email: config.sender_email || '',
                    // IMAP Fields
                    imap_host: config.imap_host || '',
                    imap_port: config.imap_port || 993,
                    imap_user: config.imap_user || '',
                    imap_password: '',
                    imap_use_ssl: config.imap_use_ssl ?? true,
                    imap_use_tls: config.imap_use_tls ?? false,
                });
                setHasExistingConfig(true);
            }
        } catch (error) {
            console.error('Failed to load SMTP config', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setTestResult(null);
        try {
            await saveSmtpConfig(form);
            setHasExistingConfig(true);
            onSaved?.();
            setTestResult({ success: true, message: 'Configurações de SMTP e IMAP salvas com sucesso!' });
        } catch (error: any) {
            setTestResult({ success: false, message: error.response?.data?.detail || 'Erro ao salvar configurações.' });
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!testEmail) {
            setTestResult({ success: false, message: 'Informe um e-mail para teste.' });
            return;
        }
        setTesting(true);
        setTestResult(null);
        try {
            const result = await testSmtpConfig({
                recipient_email: testEmail,
                smtp_host: form.smtp_host,
                smtp_port: form.smtp_port,
                smtp_user: form.smtp_user,
                smtp_password: form.smtp_password,
                smtp_use_tls: form.smtp_use_tls,
                smtp_use_ssl: form.smtp_use_ssl,
                sender_name: form.sender_name,
                sender_email: form.sender_email,
            });
            setTestResult(result);
        } catch (error: any) {
            setTestResult({ success: false, message: error.response?.data?.detail || 'Falha no teste.' });
        } finally {
            setTesting(false);
        }
    };


    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                <span className="ml-2 text-text-muted">Carregando configuração...</span>
            </div>
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-6">
            {/* Status Badge */}
            <div className="flex items-center gap-2">
                {hasExistingConfig ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        <CheckCircle className="w-3.5 h-3.5" /> Configurado
                    </span>
                ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <XCircle className="w-3.5 h-3.5" /> Não configurado
                    </span>
                )}
            </div>

            {/* Server Settings */}
            <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Servidor SMTP</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Host SMTP</label>
                        <input
                            type="text"
                            value={form.smtp_host}
                            onChange={e => setForm({ ...form, smtp_host: e.target.value })}
                            placeholder="smtp.gmail.com"
                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Porta</label>
                        <input
                            type="number"
                            value={form.smtp_port}
                            onChange={e => setForm({ ...form, smtp_port: parseInt(e.target.value) || 587 })}
                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                            required
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Usuário</label>
                        <input
                            type="text"
                            value={form.smtp_user}
                            onChange={e => setForm({ ...form, smtp_user: e.target.value })}
                            placeholder="user@example.com"
                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Senha</label>
                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={form.smtp_password}
                                onChange={e => setForm({ ...form, smtp_password: e.target.value })}
                                placeholder={hasExistingConfig ? "••••••• (manter atual)" : "Senha SMTP"}
                                className="w-full px-3 py-2 pr-10 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                                required={!hasExistingConfig}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.smtp_use_tls}
                            onChange={e => setForm({ ...form, smtp_use_tls: e.target.checked, smtp_use_ssl: e.target.checked ? false : form.smtp_use_ssl })}
                            className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary/30"
                        />
                        STARTTLS
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.smtp_use_ssl}
                            onChange={e => setForm({ ...form, smtp_use_ssl: e.target.checked, smtp_use_tls: e.target.checked ? false : form.smtp_use_tls })}
                            className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary/30"
                        />
                        SSL
                    </label>
                </div>
            </div>

            {/* Sender Settings */}
            <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Remetente</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Nome do Remetente</label>
                        <input
                            type="text"
                            value={form.sender_name}
                            onChange={e => setForm({ ...form, sender_name: e.target.value })}
                            placeholder="Cerberus - Sales Engine"
                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">E-mail do Remetente</label>
                        <input
                            type="email"
                            value={form.sender_email}
                            onChange={e => setForm({ ...form, sender_email: e.target.value })}
                            placeholder="noreply@empresa.com.br"
                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                            required
                        />
                    </div>
                </div>
            </div>

            {/* IMAP Settings */}
            <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Servidor IMAP (Recebimento - Opcional)</h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-text-secondary mb-1">Host IMAP</label>
                        <input
                            type="text"
                            value={form.imap_host}
                            onChange={e => setForm({ ...form, imap_host: e.target.value })}
                            placeholder="imap.gmail.com"
                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Porta IMAP</label>
                        <input
                            type="number"
                            value={form.imap_port}
                            onChange={e => setForm({ ...form, imap_port: parseInt(e.target.value) || 0 })}
                            placeholder="993"
                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Usuário IMAP</label>
                        <input
                            type="text"
                            value={form.imap_user}
                            onChange={e => setForm({ ...form, imap_user: e.target.value })}
                            placeholder="noreplay@servicent.com.br"
                            className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-text-secondary mb-1">Senha IMAP</label>
                        <div className="relative">
                            <input
                                type={showImapPassword ? "text" : "password"}
                                value={form.imap_password}
                                onChange={e => setForm({ ...form, imap_password: e.target.value })}
                                placeholder={hasExistingConfig ? "••••••••••••" : "Senha do IMAP"}
                                className="w-full pl-3 pr-10 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                            />
                            <button
                                type="button"
                                onClick={() => setShowImapPassword(!showImapPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-all"
                            >
                                {showImapPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.imap_use_ssl}
                            onChange={e => setForm({ ...form, imap_use_ssl: e.target.checked, imap_use_tls: e.target.checked ? false : form.imap_use_tls })}
                            className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary/30"
                        />
                        SSL (Recomendado)
                    </label>
                    <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                        <input
                            type="checkbox"
                            checked={form.imap_use_tls}
                            onChange={e => setForm({ ...form, imap_use_tls: e.target.checked, imap_use_ssl: e.target.checked ? false : form.imap_use_ssl })}
                            className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary/30"
                        />
                        STARTTLS
                    </label>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-all hover:scale-[1.02] shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar Configurações
                </button>
            </div>

            {/* Test Section */}
            {hasExistingConfig && (
                <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Testar Conexão</h3>
                    <div className="flex items-end gap-3">
                        <div className="flex-1">
                            <label className="block text-sm font-medium text-text-secondary mb-1">E-mail para teste</label>
                            <input
                                type="email"
                                value={testEmail}
                                onChange={e => setTestEmail(e.target.value)}
                                placeholder="seu-email@exemplo.com"
                                className="w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep text-text-primary focus:ring-2 focus:ring-brand-primary/30 focus:border-brand-primary transition-all text-sm"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleTest}
                            disabled={testing}
                            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                        >
                            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Enviar Teste
                        </button>
                    </div>
                </div>
            )}

            {/* Result Message */}
            {testResult && (
                <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                    testResult.success
                        ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                        : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                }`}>
                    {testResult.success ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    {testResult.message}
                </div>
            )}
        </form>
    );
};

export default SmtpConfigForm;
