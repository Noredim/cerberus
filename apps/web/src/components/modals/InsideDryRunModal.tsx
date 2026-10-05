import React, { useState, useEffect } from 'react';
import { 
    X, CheckCircle2, AlertTriangle, AlertCircle, 
    Loader2, Server, Copy, Check, FileJson, ListChecks, ShieldAlert 
} from 'lucide-react';
import { 
    insideIntegrationApi, 
    type InsideDryRunResponse 
} from '../../services/insideIntegrationApi';

interface InsideDryRunModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: string;
    budgetId: string;
    budgetTitle?: string;
}

export const InsideDryRunModal: React.FC<InsideDryRunModalProps> = ({
    isOpen,
    onClose,
    companyId,
    budgetId,
    budgetTitle,
}) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<InsideDryRunResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'checklist' | 'payloads'>('checklist');
    const [selectedPayload, setSelectedPayload] = useState<string>('orcamento');
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isOpen || !companyId || !budgetId) return;

        const runSimulation = async () => {
            setLoading(true);
            setError(null);
            setData(null);
            try {
                const res = await insideIntegrationApi.dryRunSalesBudget(companyId, budgetId);
                setData(res);
            } catch (err: any) {
                console.error('Erro na simulação do Inside ERP:', err);
                setError(err.response?.data?.detail || 'Não foi possível executar a simulação da integração.');
            } finally {
                setLoading(false);
            }
        };

        runSimulation();
    }, [isOpen, companyId, budgetId]);

    const handleCopyJson = (content: any) => {
        if (!content) return;
        navigator.clipboard.writeText(JSON.stringify(content, null, 2));
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-surface border border-border-subtle rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-border-subtle">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-brand-primary/10 border border-brand-primary/20 text-brand-primary">
                            <Server className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                                Simulação de Integração Inside ERP (Dry-Run)
                            </h3>
                            <p className="text-xs text-text-muted mt-0.5">
                                {budgetTitle || `Orçamento #${budgetId}`}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-deep transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto space-y-6 flex-1">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center p-16 text-text-muted">
                            <Loader2 className="w-10 h-10 animate-spin text-brand-primary mb-3" />
                            <h4 className="text-sm font-bold text-text-primary mb-1">Analisando Orçamento e Cadastros</h4>
                            <p className="text-xs text-text-muted">Validando correlações de produtos, serviços, vendedor e cliente...</p>
                        </div>
                    ) : error ? (
                        <div className="p-6 rounded-xl bg-brand-danger/10 border border-brand-danger/30 text-brand-danger space-y-2">
                            <div className="flex items-center gap-2 font-bold text-sm">
                                <AlertCircle className="w-5 h-5" />
                                Erro na Execução da Simulação
                            </div>
                            <p className="text-xs">{error}</p>
                        </div>
                    ) : data ? (
                        <>
                            {/* Summary Card */}
                            <div
                                className={`p-5 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                                    data.is_valid
                                        ? 'bg-emerald-500/10 border-emerald-500/30'
                                        : 'bg-amber-500/10 border-amber-500/30'
                                }`}
                            >
                                <div className="flex items-start gap-3.5">
                                    {data.is_valid ? (
                                        <CheckCircle2 className="w-6 h-6 text-emerald-500 shrink-0 mt-0.5" />
                                    ) : (
                                        <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                                    )}
                                    <div>
                                        <h4
                                            className={`text-sm font-bold ${
                                                data.is_valid
                                                    ? 'text-emerald-600 dark:text-emerald-400'
                                                    : 'text-amber-600 dark:text-amber-400'
                                            }`}
                                        >
                                            {data.is_valid
                                                ? 'Orçamento 100% Elegível para o Inside ERP'
                                                : 'Ajustes de Mapeamento Necessários'}
                                        </h4>
                                        <p className="text-xs text-text-muted mt-0.5">{data.mensagem}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0 text-xs font-mono">
                                    <div className="px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-text-primary text-center">
                                        <span className="text-[10px] text-text-muted block uppercase">Analisados</span>
                                        <span className="font-bold text-sm">{data.itens_analisados}</span>
                                    </div>
                                    <div className="px-3 py-1.5 rounded-lg bg-surface border border-border-subtle text-center">
                                        <span className="text-[10px] text-text-muted block uppercase">Pendentes</span>
                                        <span className={`font-bold text-sm ${data.itens_pendentes > 0 ? 'text-brand-danger' : 'text-emerald-500'}`}>
                                            {data.itens_pendentes}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Tabs Switcher */}
                            <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('checklist')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        activeTab === 'checklist'
                                            ? 'bg-brand-primary text-white shadow-sm'
                                            : 'text-text-muted hover:text-text-primary hover:bg-bg-deep'
                                    }`}
                                >
                                    <ListChecks className="w-4 h-4" />
                                    Checklist de De-Para ({data.checklist.length})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('payloads')}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                                        activeTab === 'payloads'
                                            ? 'bg-brand-primary text-white shadow-sm'
                                            : 'text-text-muted hover:text-text-primary hover:bg-bg-deep'
                                    }`}
                                >
                                    <FileJson className="w-4 h-4" />
                                    Visualizar Payloads JSON
                                </button>
                            </div>

                            {/* Tab 1: Checklist */}
                            {activeTab === 'checklist' && (
                                <div className="space-y-3">
                                    <div className="overflow-x-auto border border-border-subtle rounded-xl bg-surface">
                                        <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                                <tr className="bg-bg-deep border-b border-border-subtle text-text-muted uppercase text-[10px] tracking-wider font-mono">
                                                    <th className="py-2.5 px-4">Tipo</th>
                                                    <th className="py-2.5 px-4">Item / Descrição</th>
                                                    <th className="py-2.5 px-3">Cód. Inside</th>
                                                    <th className="py-2.5 px-3">Status</th>
                                                    <th className="py-2.5 px-4">Diagnóstico</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-subtle">
                                                {data.checklist.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-bg-deep/40 transition-colors">
                                                        <td className="py-3 px-4 whitespace-nowrap">
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-bg-deep border border-border-subtle text-text-muted">
                                                                {item.tipo}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 font-semibold text-text-primary">
                                                            {item.nome_descricao}
                                                        </td>
                                                        <td className="py-3 px-3 font-mono text-xs">
                                                            {item.codigo_service !== null && item.codigo_service !== undefined ? (
                                                                <span className="text-text-primary font-bold">#{item.codigo_service}</span>
                                                            ) : (
                                                                <span className="text-text-muted italic">-</span>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3">
                                                            <span
                                                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                                    item.status === 'OK'
                                                                        ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                                                        : 'bg-brand-danger/10 text-brand-danger border border-brand-danger/20'
                                                                }`}
                                                            >
                                                                {item.status}
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-4 text-xs text-text-muted">
                                                            {item.mensagem || '-'}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                            {/* Tab 2: Payloads JSON */}
                            {activeTab === 'payloads' && (
                                <div className="space-y-4">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex items-center gap-2">
                                            {['orcamento', 'prospect', 'produtos', 'servicos', 'antecipacao'].map((pKey) => {
                                                const hasData = !!data.payloads[pKey as keyof typeof data.payloads];
                                                if (!hasData) return null;
                                                return (
                                                    <button
                                                        key={pKey}
                                                        type="button"
                                                        onClick={() => setSelectedPayload(pKey)}
                                                        className={`px-3 py-1.5 rounded-md text-xs font-mono capitalize transition-all cursor-pointer ${
                                                            selectedPayload === pKey
                                                                ? 'bg-bg-deep border border-brand-primary text-brand-primary font-bold'
                                                                : 'bg-surface border border-border-subtle text-text-muted hover:text-text-primary'
                                                        }`}
                                                    >
                                                        {pKey}
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handleCopyJson(data.payloads[selectedPayload as keyof typeof data.payloads])}
                                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md border border-border-subtle bg-bg-deep hover:bg-surface-hover text-text-primary transition-colors cursor-pointer"
                                        >
                                            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                            {copied ? 'Copiado!' : 'Copiar JSON'}
                                        </button>
                                    </div>

                                    <div className="relative">
                                        <pre className="p-4 rounded-xl bg-bg-deep border border-border-subtle text-text-primary font-mono text-xs overflow-x-auto max-h-80 leading-relaxed">
                                            {JSON.stringify(
                                                data.payloads[selectedPayload as keyof typeof data.payloads] || {},
                                                null,
                                                2
                                            )}
                                        </pre>
                                    </div>
                                </div>
                            )}
                        </>
                    ) : null}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border-subtle bg-bg-deep/50 rounded-b-2xl flex items-center justify-between">
                    <span className="text-[11px] text-text-muted font-mono flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                        Ambiente de Simulação Segura (Nenhum dado é gravado no ERP)
                    </span>

                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-lg bg-surface border border-border-subtle text-text-primary hover:bg-surface-hover text-xs font-semibold cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InsideDryRunModal;
