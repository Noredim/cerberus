import React, { useState } from 'react';
import {
    Boxes,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Server,
    DollarSign,
    PackageCheck,
    ArrowUpRight,
    ArrowDownRight,
    ShieldCheck,
    Clock,
    Link,
    Loader2,
    Code,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { insideIntegrationApi } from '../../../services/insideIntegrationApi';

interface ProductInsideTabProps {
    productId?: string;
    companyId: string;
    productName?: string;
    codigoService?: number | null;
    insideData?: any;
    insideLastSyncAt?: string | null;
    isReadOnly?: boolean;
    onSyncSuccess?: (result: any) => void;
    onUpdateCodigoService?: (newCode: number | null) => void;
}

const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatNumber = (val?: number | null) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('pt-BR').format(val);
};

export const ProductInsideTab: React.FC<ProductInsideTabProps> = ({
    productId,
    companyId,
    codigoService,
    insideData: initialInsideData,
    insideLastSyncAt: initialSyncAt,
    isReadOnly,
    onSyncSuccess,
    onUpdateCodigoService,
}) => {
    const [syncing, setSyncing] = useState(false);
    const [insideData, setInsideData] = useState<any>(initialInsideData);
    const [lastSyncAt, setLastSyncAt] = useState<string | null>(initialSyncAt || null);
    const [syncMsg, setSyncMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [manualCode, setManualCode] = useState<string>(codigoService ? String(codigoService) : '');
    const [savingCode, setSavingCode] = useState(false);
    const [showRawJson, setShowRawJson] = useState(false);

    const isIntegrated = !!(codigoService || (insideData && insideData.codProduto));

    const handleSync = async () => {
        if (!productId || !companyId) {
            setSyncMsg({ type: 'error', text: 'Salve o produto antes de sincronizar com o Inside ERP.' });
            return;
        }

        setSyncing(true);
        setSyncMsg(null);
        try {
            const res = await insideIntegrationApi.syncProductStock(companyId, productId);
            setInsideData(res.raw || res);
            setLastSyncAt(res.inside_last_sync_at || new Date().toISOString());
            if (res.codigo_service && onUpdateCodigoService) {
                onUpdateCodigoService(res.codigo_service);
                setManualCode(String(res.codigo_service));
            }
            if (onSyncSuccess) {
                onSyncSuccess(res);
            }
            setSyncMsg({ type: 'success', text: 'Dados de estoque e custos sincronizados em tempo real com o Inside ERP!' });
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Erro ao sincronizar dados com o Inside ERP.';
            setSyncMsg({ type: 'error', text: detail });
        } finally {
            setSyncing(false);
        }
    };

    const handleSaveManualCode = async () => {
        if (!productId || !companyId) return;
        const codeNum = parseInt(manualCode.trim(), 10);
        if (isNaN(codeNum) || codeNum <= 0) {
            setSyncMsg({ type: 'error', text: 'Informe um código numérico válido para o Inside ERP.' });
            return;
        }

        setSavingCode(true);
        setSyncMsg(null);
        try {
            const res = await insideIntegrationApi.linkProductManually(companyId, productId, codeNum);
            setInsideData(res.raw || res);
            setLastSyncAt(res.inside_last_sync_at || new Date().toISOString());
            if (onUpdateCodigoService) {
                onUpdateCodigoService(codeNum);
            }
            if (onSyncSuccess) {
                onSyncSuccess(res);
            }
            setSyncMsg({ type: 'success', text: `Código #${codeNum} vinculado e sincronizado com sucesso!` });
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Erro ao vincular código com o Inside ERP.';
            setSyncMsg({ type: 'error', text: detail });
        } finally {
            setSavingCode(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header de Status da Integração */}
            <div className="bg-surface rounded-2xl border border-border-subtle p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                            <Boxes className="w-5 h-5" />
                        </div>
                        <h3 className="text-base font-bold text-text-primary">
                            Integração Inside ERP (Estoque &amp; Custos)
                        </h3>
                        {isIntegrated ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Integrado ao Inside
                                <span className="font-mono font-bold">#{codigoService || insideData?.codProduto}</span>
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <AlertCircle className="w-3.5 h-3.5" />
                                Não Vinculado ao Inside
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-text-muted flex items-center gap-2">
                        {lastSyncAt ? (
                            <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-text-muted" />
                                Última consulta em tempo real: <span className="font-medium text-text-primary">{new Date(lastSyncAt).toLocaleString('pt-BR')}</span>
                            </span>
                        ) : (
                            <span>Nenhuma consulta realizada para este item até o momento.</span>
                        )}
                    </p>
                </div>

                {!isReadOnly && productId && (
                    <button
                        type="button"
                        onClick={handleSync}
                        disabled={syncing}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-md shadow-cyan-600/20 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Consultando Inside...' : 'Consultar / Atualizar Agora'}
                    </button>
                )}
            </div>

            {/* Mensagem de Feedback */}
            {syncMsg && (
                <div
                    className={`p-4 rounded-xl flex items-center justify-between text-xs border ${
                        syncMsg.type === 'success'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-brand-danger/10 border-brand-danger/30 text-brand-danger'
                    }`}
                >
                    <span className="flex items-center gap-2 font-medium">
                        {syncMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                        {syncMsg.text}
                    </span>
                    <button
                        type="button"
                        onClick={() => setSyncMsg(null)}
                        className="font-bold underline cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            )}

            {/* Grid dos Cards de Dados */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Identificação no ERP */}
                <div className="bg-surface rounded-2xl border border-border-subtle p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
                        <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            <Server className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-text-primary">Identificação no ERP</h4>
                            <p className="text-[10px] text-text-muted">Unidade e almoxarifado</p>
                        </div>
                    </div>

                    <div className="space-y-2.5 text-xs">
                        <div>
                            <span className="text-[10px] font-bold uppercase text-text-muted">Empresa / Unidade:</span>
                            <p className="font-semibold text-text-primary">
                                {insideData?.fantasia || (insideData?.empresa ? `Empresa ${insideData.empresa}` : 'Stelmat Teleinformática')}
                            </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <span className="text-[10px] font-bold uppercase text-text-muted">Cód. Almoxarifado:</span>
                                <p className="font-mono font-bold text-text-primary">{insideData?.codEstoque || '1'}</p>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold uppercase text-text-muted">Tipo de Estoque:</span>
                                <span className="inline-block font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
                                    {insideData?.tipoEstoque || 'NOVOS'}
                                </span>
                            </div>
                        </div>
                        <div>
                            <span className="text-[10px] font-bold uppercase text-text-muted">Cód. Produto Inside:</span>
                            <p className="font-mono font-bold text-text-primary text-sm">
                                {insideData?.codProduto || codigoService ? `#${insideData?.codProduto || codigoService}` : 'Não vinculado'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Card 2: Saldo & Movimentação Física */}
                <div className="bg-surface rounded-2xl border border-border-subtle p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
                        <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <PackageCheck className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-text-primary">Posição de Almoxarifado</h4>
                            <p className="text-[10px] text-text-muted">Saldo físico disponível</p>
                        </div>
                    </div>

                    <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                            <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">Saldo Atual em Estoque:</span>
                            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                {formatNumber(insideData?.saldo)} <span className="text-xs font-sans font-normal opacity-80">un</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                            <div className="flex items-center gap-1.5">
                                <ArrowDownRight className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                <div>
                                    <span className="text-[10px] font-bold text-text-muted uppercase">Entradas:</span>
                                    <p className="font-mono font-bold text-text-primary">{formatNumber(insideData?.entrada)}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <ArrowUpRight className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <div>
                                    <span className="text-[10px] font-bold text-text-muted uppercase">Saídas:</span>
                                    <p className="font-mono font-bold text-text-primary">{formatNumber(insideData?.saida)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Card 3: Custos & Formação de Preço */}
                <div className="bg-surface rounded-2xl border border-border-subtle p-5 shadow-sm space-y-4">
                    <div className="flex items-center gap-2 pb-3 border-b border-border-subtle">
                        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20">
                            <DollarSign className="w-4 h-4" />
                        </div>
                        <div>
                            <h4 className="text-xs font-bold text-text-primary">Custos &amp; Preços Inside</h4>
                            <p className="text-[10px] text-text-muted">Custo contábil padrão</p>
                        </div>
                    </div>

                    <div className="space-y-3 text-xs">
                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                            <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">
                                Custo Médio Contábil (Default):
                            </span>
                            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                                {formatCurrency(insideData?.custo)}
                            </div>
                            <p className="text-[9px] text-text-muted mt-1 leading-tight">
                                Utilizado como custo base nos orçamentos. Isento de acréscimo de ST/DIFAL de entrada.
                            </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-border-subtle">
                            <div>
                                <span className="text-[10px] font-bold text-text-muted uppercase">Preço de Tabela ERP:</span>
                                <p className="font-mono font-bold text-text-primary">{formatCurrency(insideData?.preco)}</p>
                            </div>
                            <div className="flex items-center gap-1 text-[10px] text-emerald-500 font-bold">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                Custo Final Consolidado
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Painel de Vínculo Manual de Código */}
            {!isReadOnly && productId && (
                <div className="bg-surface rounded-2xl border border-border-subtle p-6 shadow-sm space-y-4">
                    <div className="flex items-center gap-2">
                        <Link className="w-4 h-4 text-brand-primary" />
                        <h4 className="text-sm font-bold text-text-primary">Vínculo Direto de Código Inside ERP</h4>
                    </div>
                    <p className="text-xs text-text-muted">
                        Caso queira vincular este produto a um código de produto específico do ERP Inside (ex: #7670), digite o código abaixo e clique em salvar:
                    </p>

                    <div className="flex flex-col sm:flex-row items-center gap-3 max-w-md">
                        <div className="relative w-full">
                            <input
                                type="number"
                                value={manualCode}
                                onChange={(e) => setManualCode(e.target.value)}
                                placeholder="Ex: 7670"
                                className="w-full px-4 py-2 bg-bg-deep border border-border-subtle rounded-xl text-xs font-mono font-bold text-text-primary focus:outline-none focus:border-brand-primary"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveManualCode}
                            disabled={savingCode || !manualCode.trim()}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md shadow-brand-primary/20 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                            {savingCode ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                            Vincular &amp; Sincronizar
                        </button>
                    </div>
                </div>
            )}

            {/* Visualização de Resposta Bruta da API */}
            {insideData && (
                <div className="bg-surface rounded-2xl border border-border-subtle p-4 shadow-sm">
                    <button
                        type="button"
                        onClick={() => setShowRawJson(!showRawJson)}
                        className="flex items-center justify-between w-full text-xs font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    >
                        <span className="flex items-center gap-2">
                            <Code className="w-4 h-4 text-cyan-500" />
                            Payload JSON Retornado pelo Inside ERP
                        </span>
                        {showRawJson ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    {showRawJson && (
                        <pre className="mt-3 p-4 rounded-xl bg-bg-deep border border-border-subtle text-[11px] font-mono text-text-primary overflow-x-auto max-h-60 leading-relaxed">
                            {JSON.stringify(insideData, null, 2)}
                        </pre>
                    )}
                </div>
            )}
        </div>
    );
};
