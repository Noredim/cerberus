import React, { useState, useEffect } from 'react';
import { 
    Server, Key, Globe, Shield, CheckCircle2, AlertCircle, 
    Loader2, Save, Activity, RefreshCw, Eye, X, Terminal, 
    Wrench, Package, CreditCard, Check
} from 'lucide-react';
import { api } from '../../../services/api';
import { 
    insideIntegrationApi, 
    type InsideTestConnectionResponse, 
    type IntegrationLogItem 
} from '../../../services/insideIntegrationApi';

interface InsideIntegrationTabProps {
    companyId?: string;
    isReadOnly?: boolean;
}

interface DualInsideConfig {
    id?: string;
    company_id?: string;
    
    // Geral
    base_url?: string;
    hash_token?: string;
    cod_unidade?: number | null;
    is_active?: boolean;

    // Ambiente A - Serviços
    servicos_base_url: string;
    servicos_hash_token: string;
    servicos_cod_unidade: number | null;
    servicos_is_active: boolean;

    // Ambiente B - Produtos / Locação
    produtos_base_url: string;
    produtos_hash_token: string;
    produtos_cod_unidade: number | null;
    produtos_is_active: boolean;
}

export const InsideIntegrationTab: React.FC<InsideIntegrationTabProps> = ({ companyId, isReadOnly = false }) => {
    const [config, setConfig] = useState<DualInsideConfig>({
        servicos_base_url: '',
        servicos_hash_token: '',
        servicos_cod_unidade: null,
        servicos_is_active: false,

        produtos_base_url: '',
        produtos_hash_token: '',
        produtos_cod_unidade: null,
        produtos_is_active: false,
    });

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // Sync state
    const [syncingFormas, setSyncingFormas] = useState(false);
    const [syncFormasResult, setSyncFormasResult] = useState<{ success: boolean; message: string } | null>(null);

    // Test Connection states for both environments
    const [testingServicos, setTestingServicos] = useState(false);
    const [testServicosResult, setTestServicosResult] = useState<InsideTestConnectionResponse | null>(null);

    const [testingProdutos, setTestingProdutos] = useState(false);
    const [testProdutosResult, setTestProdutosResult] = useState<InsideTestConnectionResponse | null>(null);

    // Logs states
    const [logs, setLogs] = useState<IntegrationLogItem[]>([]);
    const [loadingLogs, setLoadingLogs] = useState(false);
    const [selectedLog, setSelectedLog] = useState<IntegrationLogItem | null>(null);

    useEffect(() => {
        if (!companyId) return;

        const loadConfig = async () => {
            setLoading(true);
            setMessage(null);
            try {
                const response = await api.get(`/companies/${companyId}/inside-config`);
                if (response.data) {
                    const d = response.data;
                    setConfig({
                        base_url: d.base_url || '',
                        hash_token: d.hash_token || '',
                        cod_unidade: d.cod_unidade ?? null,
                        is_active: !!d.is_active,

                        // Se campos específicos estiverem vazios, faz fallback com o geral
                        servicos_base_url: d.servicos_base_url || d.base_url || '',
                        servicos_hash_token: d.servicos_hash_token || d.hash_token || '',
                        servicos_cod_unidade: d.servicos_cod_unidade ?? d.cod_unidade ?? null,
                        servicos_is_active: d.servicos_is_active !== undefined ? !!d.servicos_is_active : !!d.is_active,

                        produtos_base_url: d.produtos_base_url || '',
                        produtos_hash_token: d.produtos_hash_token || '',
                        produtos_cod_unidade: d.produtos_cod_unidade ?? null,
                        produtos_is_active: !!d.produtos_is_active,
                    });
                }
            } catch (err: any) {
                console.error('Erro ao carregar configurações do Inside ERP:', err);
                setMessage({ type: 'error', text: 'Não foi possível carregar as configurações de integração.' });
            } finally {
                setLoading(false);
            }
        };

        loadConfig();
        fetchLogs();
    }, [companyId]);

    const fetchLogs = async () => {
        if (!companyId) return;
        setLoadingLogs(true);
        try {
            const res = await insideIntegrationApi.getLogs(companyId, 1, 30);
            setLogs(res.items || []);
        } catch (err) {
            console.error('Erro ao buscar logs da integração:', err);
        } finally {
            setLoadingLogs(false);
        }
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!companyId) return false;

        setSaving(true);
        setMessage(null);
        try {
            const payload = {
                // Manter sincronismo com base legada
                base_url: config.servicos_base_url.trim() || config.produtos_base_url.trim() || null,
                hash_token: config.servicos_hash_token.trim() || config.produtos_hash_token.trim() || null,
                cod_unidade: config.servicos_cod_unidade !== null ? Number(config.servicos_cod_unidade) : (config.produtos_cod_unidade !== null ? Number(config.produtos_cod_unidade) : null),
                is_active: config.servicos_is_active || config.produtos_is_active,

                // Ambiente A - Serviços
                servicos_base_url: config.servicos_base_url.trim() || null,
                servicos_hash_token: config.servicos_hash_token.trim() || null,
                servicos_cod_unidade: config.servicos_cod_unidade !== null && config.servicos_cod_unidade !== undefined ? Number(config.servicos_cod_unidade) : null,
                servicos_is_active: config.servicos_is_active,

                // Ambiente B - Produtos
                produtos_base_url: config.produtos_base_url.trim() || null,
                produtos_hash_token: config.produtos_hash_token.trim() || null,
                produtos_cod_unidade: config.produtos_cod_unidade !== null && config.produtos_cod_unidade !== undefined ? Number(config.produtos_cod_unidade) : null,
                produtos_is_active: config.produtos_is_active,
            };

            await api.put(`/companies/${companyId}/inside-config`, payload);
            setMessage({ type: 'success', text: 'Configurações dos ambientes de integração salvas com sucesso!' });
            return true;
        } catch (err: any) {
            console.error('Erro ao salvar configurações do Inside ERP:', err);
            setMessage({ type: 'error', text: err.response?.data?.detail || 'Erro ao salvar configurações de integração.' });
            return false;
        } finally {
            setSaving(false);
        }
    };

    const handleTestServicos = async () => {
        if (!companyId) return;
        setTestingServicos(true);
        setTestServicosResult(null);
        try {
            const saved = await handleSave();
            if (!saved) {
                setTestServicosResult({
                    success: false,
                    status_code: 400,
                    message: 'Não foi possível salvar as configurações antes de testar a conexão.',
                    latency_ms: 0,
                    error: 'Erro ao salvar'
                });
                return;
            }
            const result = await insideIntegrationApi.testConnection(companyId, 'SERVICOS');
            setTestServicosResult(result);
            fetchLogs();
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Falha ao testar conexão com Base de Serviços.';
            setTestServicosResult({
                success: false,
                status_code: err.response?.status || 500,
                message: detail,
                latency_ms: 0,
                error: detail
            });
            fetchLogs();
        } finally {
            setTestingServicos(false);
        }
    };

    const handleTestProdutos = async () => {
        if (!companyId) return;
        setTestingProdutos(true);
        setTestProdutosResult(null);
        try {
            const saved = await handleSave();
            if (!saved) {
                setTestProdutosResult({
                    success: false,
                    status_code: 400,
                    message: 'Não foi possível salvar as configurações antes de testar a conexão.',
                    latency_ms: 0,
                    error: 'Erro ao salvar'
                });
                return;
            }
            const result = await insideIntegrationApi.testConnection(companyId, 'PRODUTOS');
            setTestProdutosResult(result);
            fetchLogs();
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Falha ao testar conexão com Base de Produtos.';
            setTestProdutosResult({
                success: false,
                status_code: err.response?.status || 500,
                message: detail,
                latency_ms: 0,
                error: detail
            });
            fetchLogs();
        } finally {
            setTestingProdutos(false);
        }
    };

    const handleSyncFormas = async () => {
        if (!companyId) return;
        setSyncingFormas(true);
        setSyncFormasResult(null);
        try {
            await handleSave();
            const res = await insideIntegrationApi.syncFormasPagamento(companyId, 'SERVICOS');
            setSyncFormasResult({
                success: true,
                message: res.mensagem || `Sincronização concluída: ${res.total_processados || 0} formas processadas.`
            });
            fetchLogs();
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Falha ao sincronizar formas de pagamento com o Inside ERP.';
            setSyncFormasResult({
                success: false,
                message: detail
            });
            fetchLogs();
        } finally {
            setSyncingFormas(false);
        }
    };

    if (!companyId) {
        return (
            <div className="p-8 text-center bg-bg-deep/50 rounded-xl border border-border-subtle">
                <Server className="w-12 h-12 mx-auto text-text-muted mb-3" />
                <h4 className="text-base font-bold text-text-primary mb-1">Empresa ainda não salva</h4>
                <p className="text-sm text-text-muted max-w-md mx-auto">
                    Salve os dados básicos da empresa antes de configurar os parâmetros de conexão com o Inside ERP.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary mb-2" />
                <span className="text-sm font-medium">Carregando configurações dos ambientes Inside ERP...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <div className="space-y-8">
                {/* Header Superior */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
                    <div>
                        <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                            <Server className="w-5 h-5 text-brand-primary" />
                            Integração Inside ERP (Ambientes A &amp; B)
                        </h3>
                        <p className="text-xs text-text-muted mt-0.5">
                            Configure os endpoints locais e tokens de segurança para a Base de Serviços e Base de Produtos/Locação.
                        </p>
                    </div>

                    {!isReadOnly && (
                        <button
                            type="button"
                            onClick={() => handleSave()}
                            disabled={saving}
                            className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2 rounded-lg font-bold hover:bg-brand-primary/90 transition-all shadow-md shadow-brand-primary/20 disabled:opacity-50 cursor-pointer text-xs"
                        >
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            Salvar Configurações dos Ambientes
                        </button>
                    )}
                </div>

                {message && (
                    <div
                        className={`p-4 rounded-lg flex items-center gap-3 text-sm ${
                            message.type === 'success'
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-500'
                                : 'bg-brand-danger/10 border border-brand-danger/30 text-brand-danger'
                        }`}
                    >
                        {message.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 shrink-0" />
                        )}
                        <span>{message.text}</span>
                    </div>
                )}

                {/* Grid dos 2 Ambientes */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* AMBIENTE A: BASE DE SERVIÇOS */}
                    <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-5 shadow-sm">
                        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                    <Wrench className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                        Ambiente A: Base de Serviços
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                            BASE A
                                        </span>
                                    </h4>
                                    <p className="text-[11px] text-text-muted">Destino para serviços, mão de obra e instalações.</p>
                                </div>
                            </div>

                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.servicos_is_active}
                                    onChange={(e) => setConfig({ ...config, servicos_is_active: e.target.checked })}
                                    disabled={isReadOnly}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-bg-deep peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-subtle after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 border border-border-subtle"></div>
                                <span className="ml-2 text-xs font-bold text-text-primary">
                                    {config.servicos_is_active ? <span className="text-emerald-500">Ativa</span> : <span className="text-text-muted">Inativa</span>}
                                </span>
                            </label>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-indigo-500" />
                                    URL Base do Service (Base A - Serviços)
                                </label>
                                <input
                                    type="text"
                                    value={config.servicos_base_url}
                                    onChange={(e) => setConfig({ ...config, servicos_base_url: e.target.value })}
                                    disabled={isReadOnly}
                                    placeholder="Ex: http://192.168.1.100:65191"
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-indigo-500 transition-colors text-xs text-text-primary font-mono placeholder:font-sans"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                    <Key className="w-3.5 h-3.5 text-indigo-500" />
                                    Hash Token de Autenticação (Base A)
                                </label>
                                <input
                                    type="text"
                                    value={config.servicos_hash_token}
                                    onChange={(e) => setConfig({ ...config, servicos_hash_token: e.target.value })}
                                    disabled={isReadOnly}
                                    placeholder="Ex: 8f3c71a9-3990-4c2f-b441-..."
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-indigo-500 transition-colors text-xs text-text-primary font-mono placeholder:font-sans"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                                    Código da Unidade (codUnidade - Base A)
                                </label>
                                <input
                                    type="number"
                                    value={config.servicos_cod_unidade !== null && config.servicos_cod_unidade !== undefined ? config.servicos_cod_unidade : ''}
                                    onChange={(e) => setConfig({ ...config, servicos_cod_unidade: e.target.value ? parseInt(e.target.value, 10) : null })}
                                    disabled={isReadOnly}
                                    placeholder="Ex: 1"
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-indigo-500 transition-colors text-xs text-text-primary font-mono"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={handleTestServicos}
                                disabled={testingServicos || !config.servicos_base_url || !config.servicos_hash_token}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border border-border-subtle bg-bg-deep text-text-primary hover:bg-surface-hover hover:border-indigo-500/50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                                {testingServicos ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                                ) : (
                                    <Activity className="w-3.5 h-3.5 text-indigo-500" />
                                )}
                                Testar Conexão: Base A (Serviços)
                            </button>
                        </div>

                        {testServicosResult && (
                            <div
                                className={`p-3 rounded-xl border text-xs ${
                                    testServicosResult.success
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-brand-danger/10 border-brand-danger/30 text-brand-danger'
                                }`}
                            >
                                <div className="font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        {testServicosResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-brand-danger" />}
                                        {testServicosResult.success ? 'Conexão OK (Base A)' : 'Falha na Conexão (Base A)'}
                                    </span>
                                    {testServicosResult.latency_ms > 0 && (
                                        <span className="font-mono">{testServicosResult.latency_ms}ms</span>
                                    )}
                                </div>
                                <p className="text-[11px] opacity-90 mt-1">{testServicosResult.message}</p>
                            </div>
                        )}
                    </div>


                    {/* AMBIENTE B: BASE DE PRODUTOS / LOCAÇÃO */}
                    <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-5 shadow-sm">
                        <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                    <Package className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                                        Ambiente B: Base de Produtos
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                            BASE B
                                        </span>
                                    </h4>
                                    <p className="text-[11px] text-text-muted">Destino para produtos, mercadorias, locação e comodato.</p>
                                </div>
                            </div>

                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={config.produtos_is_active}
                                    onChange={(e) => setConfig({ ...config, produtos_is_active: e.target.checked })}
                                    disabled={isReadOnly}
                                    className="sr-only peer"
                                />
                                <div className="w-9 h-5 bg-bg-deep peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-subtle after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600 border border-border-subtle"></div>
                                <span className="ml-2 text-xs font-bold text-text-primary">
                                    {config.produtos_is_active ? <span className="text-emerald-500">Ativa</span> : <span className="text-text-muted">Inativa</span>}
                                </span>
                            </label>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5 text-emerald-500" />
                                    URL Base do Service (Base B - Produtos)
                                </label>
                                <input
                                    type="text"
                                    value={config.produtos_base_url}
                                    onChange={(e) => setConfig({ ...config, produtos_base_url: e.target.value })}
                                    disabled={isReadOnly}
                                    placeholder="Ex: http://192.168.1.101:65191"
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-emerald-500 transition-colors text-xs text-text-primary font-mono placeholder:font-sans"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                    <Key className="w-3.5 h-3.5 text-emerald-500" />
                                    Hash Token de Autenticação (Base B)
                                </label>
                                <input
                                    type="text"
                                    value={config.produtos_hash_token}
                                    onChange={(e) => setConfig({ ...config, produtos_hash_token: e.target.value })}
                                    disabled={isReadOnly}
                                    placeholder="Ex: 2a98a2004d2efccc40cb0867..."
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-emerald-500 transition-colors text-xs text-text-primary font-mono placeholder:font-sans"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                                    Código da Unidade (codUnidade - Base B)
                                </label>
                                <input
                                    type="number"
                                    value={config.produtos_cod_unidade !== null && config.produtos_cod_unidade !== undefined ? config.produtos_cod_unidade : ''}
                                    onChange={(e) => setConfig({ ...config, produtos_cod_unidade: e.target.value ? parseInt(e.target.value, 10) : null })}
                                    disabled={isReadOnly}
                                    placeholder="Ex: 2"
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-emerald-500 transition-colors text-xs text-text-primary font-mono"
                                />
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={handleTestProdutos}
                                disabled={testingProdutos || !config.produtos_base_url || !config.produtos_hash_token}
                                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold rounded-lg border border-border-subtle bg-bg-deep text-text-primary hover:bg-surface-hover hover:border-emerald-500/50 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                            >
                                {testingProdutos ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
                                ) : (
                                    <Activity className="w-3.5 h-3.5 text-emerald-500" />
                                )}
                                Testar Conexão: Base B (Produtos)
                            </button>
                        </div>

                        {testProdutosResult && (
                            <div
                                className={`p-3 rounded-xl border text-xs ${
                                    testProdutosResult.success
                                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                        : 'bg-brand-danger/10 border-brand-danger/30 text-brand-danger'
                                }`}
                            >
                                <div className="font-bold flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        {testProdutosResult.success ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <AlertCircle className="w-4 h-4 text-brand-danger" />}
                                        {testProdutosResult.success ? 'Conexão OK (Base B)' : 'Falha na Conexão (Base B)'}
                                    </span>
                                    {testProdutosResult.latency_ms > 0 && (
                                        <span className="font-mono">{testProdutosResult.latency_ms}ms</span>
                                    )}
                                </div>
                                <p className="text-[11px] opacity-90 mt-1">{testProdutosResult.message}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Ações de Carga & Sincronização */}
            <div className="bg-surface rounded-2xl border border-border-subtle p-6 space-y-4 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-brand-primary" />
                            Carga e Sincronização de Tabelas
                        </h4>
                        <p className="text-xs text-text-muted mt-0.5">
                            Importe e correlacione dados mestres cadastrados no Inside ERP diretamente para o Cerberus.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={handleSyncFormas}
                            disabled={syncingFormas || isReadOnly || (!config.servicos_base_url && !config.produtos_base_url)}
                            className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/20 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                        >
                            {syncingFormas ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                            Sincronizar Formas de Pagamento
                        </button>
                    </div>
                </div>

                {syncFormasResult && (
                    <div
                        className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 ${
                            syncFormasResult.success
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-brand-danger/10 border-brand-danger/30 text-brand-danger'
                        }`}
                    >
                        <span className="flex items-center gap-1.5 font-medium">
                            {syncFormasResult.success ? <Check className="w-4 h-4 text-emerald-500 shrink-0" /> : <AlertCircle className="w-4 h-4 text-brand-danger shrink-0" />}
                            {syncFormasResult.message}
                        </span>
                        <button
                            type="button"
                            onClick={() => setSyncFormasResult(null)}
                            className="text-[11px] font-bold underline cursor-pointer shrink-0"
                        >
                            Fechar
                        </button>
                    </div>
                )}
            </div>

            {/* Histórico de Auditoria / Logs */}
            <div className="space-y-4 pt-4 border-t border-border-subtle">
                <div className="flex items-center justify-between">
                    <div>
                        <h4 className="text-sm font-bold text-text-primary flex items-center gap-2">
                            <Terminal className="w-4 h-4 text-brand-primary" />
                            Histórico de Auditoria &amp; Logs da Integração
                        </h4>
                        <p className="text-xs text-text-muted mt-0.5">
                            Registro de todas as chamadas HTTP e testes de conexão nos ambientes A e B.
                        </p>
                    </div>

                    <button
                        type="button"
                        onClick={fetchLogs}
                        disabled={loadingLogs}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border-subtle hover:bg-surface-hover text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingLogs ? 'animate-spin text-brand-primary' : ''}`} />
                        Atualizar
                    </button>
                </div>

                {logs.length === 0 ? (
                    <div className="p-8 text-center bg-bg-deep/40 rounded-xl border border-dashed border-border-subtle">
                        <Terminal className="w-8 h-8 mx-auto text-text-muted mb-2 opacity-50" />
                        <p className="text-xs text-text-muted font-medium">Nenhum registro de integração realizado até o momento.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto border border-border-subtle rounded-xl bg-surface">
                        <table className="w-full text-left border-collapse text-xs font-mono">
                            <thead>
                                <tr className="bg-bg-deep border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider">
                                    <th className="py-2.5 px-4">Data / Hora</th>
                                    <th className="py-2.5 px-3">Ambiente / Método</th>
                                    <th className="py-2.5 px-4">Endpoint</th>
                                    <th className="py-2.5 px-3">Status</th>
                                    <th className="py-2.5 px-3">Latência</th>
                                    <th className="py-2.5 px-3 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle font-sans">
                                {logs.map((log) => {
                                    const isSuccess = log.status_code && log.status_code >= 200 && log.status_code < 300;
                                    const isServicos = log.endpoint.includes('SERVICOS');
                                    const isProdutos = log.endpoint.includes('PRODUTOS');
                                    return (
                                        <tr key={log.id} className="hover:bg-bg-deep/50 transition-colors">
                                            <td className="py-2.5 px-4 text-text-muted whitespace-nowrap text-xs font-mono">
                                                {new Date(log.created_at).toLocaleString('pt-BR')}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="flex items-center gap-1.5">
                                                    {isServicos && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                                                            BASE A
                                                        </span>
                                                    )}
                                                    {isProdutos && (
                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold font-mono bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                            BASE B
                                                        </span>
                                                    )}
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                                                        {log.http_method}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-4 text-text-primary font-mono text-xs truncate max-w-xs" title={log.endpoint}>
                                                {log.endpoint}
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                                                        isSuccess
                                                            ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                            : 'bg-brand-danger/10 text-brand-danger border border-brand-danger/20'
                                                    }`}
                                                >
                                                    {log.status_code || 'ERR'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 text-text-muted font-mono text-xs whitespace-nowrap">
                                                {log.execution_time_ms !== null && log.execution_time_ms !== undefined ? `${log.execution_time_ms}ms` : '-'}
                                            </td>
                                            <td className="py-2.5 px-3 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLog(log)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs rounded border border-border-subtle bg-bg-deep hover:bg-surface-hover text-text-primary transition-colors cursor-pointer"
                                                >
                                                    <Eye className="w-3.5 h-3.5 text-brand-primary" />
                                                    Ver Detalhes
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal de Detalhes do Log */}
            {selectedLog && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
                    <div className="bg-surface border border-border-subtle rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between p-5 border-b border-border-subtle">
                            <div>
                                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                                    <Terminal className="w-5 h-5 text-brand-primary" />
                                    Detalhes do Log de Integração
                                </h3>
                                <p className="text-xs text-text-muted mt-0.5 font-mono">
                                    {selectedLog.http_method} {selectedLog.endpoint} - {new Date(selectedLog.created_at).toLocaleString('pt-BR')}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-deep transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto space-y-4 text-xs font-mono">
                            {selectedLog.error_message && (
                                <div className="p-3 bg-brand-danger/10 border border-brand-danger/30 rounded-lg text-brand-danger">
                                    <span className="font-bold">Erro: </span>
                                    {selectedLog.error_message}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                    Payload de Envio (Request JSON):
                                </label>
                                <pre className="p-4 rounded-xl bg-bg-deep border border-border-subtle text-text-primary overflow-x-auto max-h-60 leading-relaxed">
                                    {JSON.stringify(selectedLog.request_payload, null, 2) || 'Nenhum payload enviado'}
                                </pre>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[11px] font-bold text-text-muted uppercase tracking-wider">
                                    Payload de Resposta (Response JSON):
                                </label>
                                <pre className="p-4 rounded-xl bg-bg-deep border border-border-subtle text-text-primary overflow-x-auto max-h-60 leading-relaxed">
                                    {JSON.stringify(selectedLog.response_payload, null, 2) || 'Nenhuma resposta retornada'}
                                </pre>
                            </div>
                        </div>

                        <div className="p-4 border-t border-border-subtle bg-bg-deep/50 rounded-b-2xl flex justify-end">
                            <button
                                type="button"
                                onClick={() => setSelectedLog(null)}
                                className="px-4 py-2 rounded-lg bg-surface border border-border-subtle text-text-primary hover:bg-surface-hover text-xs font-semibold cursor-pointer"
                            >
                                Fechar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InsideIntegrationTab;
