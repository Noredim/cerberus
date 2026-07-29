import React, { useEffect, useState } from 'react';
import {
    ArrowLeft,
    Loader2,
    CheckCircle2,
    Building2,
    Copy,
    AlertCircle,
    FileText,
    History,
    PieChart,
    Layers,
    Sliders,
    Calculator,
    Info,
    Save,
    XCircle,
    AlertTriangle,
    Banknote,
    CreditCard,
    CalendarDays
} from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';

const PAYMENT_METHODS_LABELS: Record<string, string> = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Cartão de Débito',
    '05': 'Crédito Loja',
    '10': 'Vale Alimentação',
    '11': 'Vale Refeição',
    '12': 'Vale Presente',
    '13': 'Vale Combustível',
    '14': 'Duplicata Mercantil',
    '15': 'Boleto Bancário',
    '16': 'Depósito Bancário',
    '17': 'PIX / Pagamento Instantâneo',
    '18': 'Transferência Bancária / TED / DOC',
    '19': 'Fidelidade / Cashback',
    '90': 'Sem Pagamento',
    '99': 'Outros'
};

const APLICACOES_OPTIONS = [
    { value: 'REVENDA', label: 'Revenda' },
    { value: 'MATERIAL_APLICADO', label: 'Material Aplicado' },
    { value: 'MATERIAL_COMODATO', label: 'Material para Comodato' },
    { value: 'CONSUMO_INTERNO', label: 'Consumo Interno' },
    { value: 'OUTRAS_REMESSAS', label: 'Outras Remessas' },
    { value: 'RETORNO_CONSERTO', label: 'Retorno de Conserto' },
    { value: 'COMBUSTIVEL', label: 'Combustível' },
    { value: 'CANCELAMENTO', label: 'Cancelamento' }
];

const COMPATIBILIDADE_TRIBUTACAO: Record<string, { value: string; label: string }[]> = {
    REVENDA: [
        { value: 'ICMS_ST', label: 'ICMS ST' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    MATERIAL_APLICADO: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    MATERIAL_COMODATO: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    CONSUMO_INTERNO: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    OUTRAS_REMESSAS: [
        { value: 'ICMS_ST', label: 'ICMS ST' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    RETORNO_CONSERTO: [
        { value: 'ICMS_ST', label: 'ICMS ST' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    COMBUSTIVEL: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    CANCELAMENTO: [
        { value: 'CANCELAMENTO', label: 'Cancelamento' }
    ]
};

interface NfeItem {
    id: string;
    nItem: number;
    cProd: string | null;
    xProd: string | null;
    NCM: string | null;
    CFOP: string | null;
    uCom: string | null;
    qCom: number | null;
    vUnCom: number | null;
    vProd: number | null;
    tributos: Record<string, any> | null;
}

interface NfeInstallment {
    id: string;
    nDup: string | null;
    dVenc: string | null;
    vDup: number | null;
}

interface NfePayment {
    id: string;
    tPag: string | null;
    vPag: number | null;
}

interface FiscalHistory {
    id: string;
    action: string;
    previous_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    justification: string | null;
    user_name?: string | null;
    created_at: string;
}

interface FiscalDocumentDetail {
    id: string;
    access_key: string;
    nNF: string | null;
    serie: string | null;
    mod: string | null;
    dhEmi: string | null;
    competencia: string | null;
    issuer_cnpj: string | null;
    issuer_name: string | null;
    uf_emit: string | null;
    recipient_cnpj: string | null;
    recipient_name: string | null;
    uf_dest: string | null;
    aplicacao: string | null;
    tipo_tributacao: string | null;
    status_classificacao: string | null;
    data_classificacao: string | null;
    observacao_classificacao: string | null;
    divergencia_flag: boolean;
    vProd: number | null;
    vNF: number | null;
    vBC: number | null;
    vICMS: number | null;
    vBCST: number | null;
    vICMSST: number | null;
    vFCP: number | null;
    vFCPST: number | null;
    vIPI: number | null;
    vPIS: number | null;
    vCOFINS: number | null;
    vFrete: number | null;
    vSeg: number | null;
    vDesc: number | null;
    vOutro: number | null;
    cStat: string | null;
    xMotivo: string | null;
    nProt: string | null;
    dhRecbto: string | null;
    xml_version: string | null;
    status_importacao?: string | null;
    origem_importacao?: string | null;
    dados_completos?: boolean | null;
    xml_nfe_original_importado?: boolean | null;
    criada_por_evento?: boolean | null;
    ano_mes_emissao?: string | null;
    codigo_uf?: string | null;
    events?: any[];
    items: NfeItem[];
    installments: NfeInstallment[];
    payments: NfePayment[];
}

export const NfeMonthlyDetailView: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [doc, setDoc] = useState<FiscalDocumentDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [updatingClass, setUpdatingClass] = useState(false);
    const [activeTab, setActiveTab] = useState<'general' | 'items' | 'taxes' | 'financial' | 'history'>('general');
    const [copiedKey, setCopiedKey] = useState(false);
    const [histories, setHistories] = useState<FiscalHistory[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Dynamic Draft state for Header Classification Selects
    const [draftAplicacao, setDraftAplicacao] = useState<string>('REVENDA');
    const [draftTributacao, setDraftTributacao] = useState<string>('ICMS_ST');
    const [observacao, setObservacao] = useState<string>('');

    // Cancel modal state
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [canceling, setCanceling] = useState(false);

    useEffect(() => {
        const fetchDetail = async () => {
            try {
                const response = await api.get(`/fiscal/acompanhamento-nfe/${id}`);
                setDoc(response.data);
                setDraftAplicacao(response.data.aplicacao || 'REVENDA');
                setDraftTributacao(response.data.tipo_tributacao || 'ICMS_ST');
                setObservacao(response.data.observacao_classificacao || '');
            } catch (error) {
                console.error('Error fetching document details:', error);
            } finally {
                setLoading(false);
            }
        };

        if (id) fetchDetail();
    }, [id]);

    const fetchHistory = () => {
        if (!id) return;
        setLoadingHistory(true);
        api.get(`/fiscal/acompanhamento-nfe/${id}/historico`)
            .then(res => setHistories(res.data))
            .catch(err => console.error('Erro ao buscar histórico:', err))
            .finally(() => setLoadingHistory(false));
    };

    useEffect(() => {
        if (activeTab === 'history') {
            fetchHistory();
        }
    }, [activeTab, id]);

    if (loading) {
        return (
            <div className="min-h-[400px] flex flex-col items-center justify-center text-text-muted">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-brand-primary" />
                Carregando detalhes do documento fiscal...
            </div>
        );
    }

    if (!doc) {
        return (
            <div className="space-y-4 max-w-md mx-auto text-center py-12">
                <AlertCircle className="w-12 h-12 text-brand-danger mx-auto" />
                <h2 className="text-xl font-bold text-text-primary">Nota Fiscal Não Encontrada</h2>
                <p className="text-text-muted text-sm">O documento fiscal solicitado não existe ou foi removido.</p>
                <button
                    onClick={() => navigate('/fiscal/acompanhamento-nfe')}
                    className="mt-2 inline-flex items-center gap-2 bg-bg-deep border border-border-subtle px-4 py-2 rounded-md hover:bg-bg-surface text-text-primary text-sm font-medium transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar para a lista
                </button>
            </div>
        );
    }

    const formatCurrency = (val: number | null | undefined) => {
        if (val === null || val === undefined) return 'R$ 0,00';
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
    };

    const formatNumber = (val: number | null | undefined, decimals = 2) => {
        if (val === null || val === undefined) return '0';
        return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(val);
    };

    const copyAccessKey = () => {
        navigator.clipboard.writeText(doc.access_key);
        setCopiedKey(true);
        setTimeout(() => setCopiedKey(false), 2000);
    };

    const hasChanges = doc && doc.status_classificacao !== 'CANCELADA' && (
        draftAplicacao !== (doc.aplicacao || 'REVENDA') ||
        draftTributacao !== (doc.tipo_tributacao || '') ||
        observacao !== (doc.observacao_classificacao || '')
    );

    const handleAplicacaoChange = (newAplicacao: string) => {
        setDraftAplicacao(newAplicacao);
        const permitidas = COMPATIBILIDADE_TRIBUTACAO[newAplicacao] || [];
        const defaultTrib = permitidas.length > 0 ? permitidas[0].value : '';
        setDraftTributacao(defaultTrib);
    };

    const handleSaveClassification = async () => {
        if (!id || !doc) return;
        setUpdatingClass(true);
        try {
            const response = await api.put(`/fiscal/acompanhamento-nfe/${id}/classificacao`, {
                aplicacao: draftAplicacao,
                tipo_tributacao: draftTributacao,
                observacao_classificacao: observacao
            });
            setDoc(prev => prev ? {
                ...prev,
                aplicacao: response.data.aplicacao,
                tipo_tributacao: response.data.tipo_tributacao,
                status_classificacao: 'CLASSIFICADO',
                observacao_classificacao: response.data.observacao_classificacao
            } : null);
            alert('Classificação salva com sucesso!');
            fetchHistory();
        } catch (err) {
            console.error('Erro ao salvar classificação:', err);
            alert('Falha ao salvar a classificação do documento.');
        } finally {
            setUpdatingClass(false);
        }
    };

    const handleConfirmCancel = async () => {
        if (!id || !cancelReason.trim()) return;
        setCanceling(true);
        try {
            const response = await api.post(`/fiscal/acompanhamento-nfe/${id}/cancelar`, {
                justificativa: cancelReason.trim()
            });
            setDoc(prev => prev ? {
                ...prev,
                status_classificacao: 'CANCELADA',
                observacao_classificacao: response.data.observacao_classificacao
            } : null);
            alert('Nota Fiscal cancelada com sucesso!');
            setShowCancelModal(false);
            setCancelReason('');
            fetchHistory();
        } catch (err: any) {
            console.error('Erro ao cancelar documento fiscal:', err);
            alert(err.response?.data?.detail || 'Falha ao cancelar o documento fiscal.');
        } finally {
            setCanceling(false);
        }
    };

    const tributacoesPermitidas = COMPATIBILIDADE_TRIBUTACAO[draftAplicacao] || COMPATIBILIDADE_TRIBUTACAO.REVENDA;

    // Helper de Cálculo de Resumo Tributário em tempo real no rascunho (DIFAL / DIFAL ST / ICMS ST)
    const isDifal = draftTributacao === 'DIFAL' || draftTributacao === 'DIFAL_ST';
    const isIcmsSt = draftTributacao === 'ICMS_ST';

    const calculatedTaxDetails = doc.items.map(item => {
        const qty = item.qCom || 1;
        const unitVal = item.vUnCom || (item.vProd ? item.vProd / qty : 0);
        const vProd = item.vProd || (unitVal * qty);
        
        const ipiTotal = item.tributos?.vIPI ? Number(item.tributos.vIPI) : 0;
        const ipiUnit = qty > 0 ? ipiTotal / qty : 0;
        
        const freteTotal = doc.vFrete && doc.vProd && doc.vProd > 0 ? (doc.vFrete * (vProd / doc.vProd)) : 0;
        const freteUnit = qty > 0 ? freteTotal / qty : 0;

        const aliquotaOrigem = item.tributos?.pICMS ? Number(item.tributos.pICMS) : (doc.vICMS && doc.vProd && doc.vProd > 0 ? (doc.vICMS / doc.vProd) * 100 : 12.0);
        const ufEmit = doc.uf_emit || 'SC';
        const ufDest = doc.uf_dest || 'MT';
        const isInterestadual = ufEmit !== ufDest;

        if (isDifal) {
            const baseComIpiEFrete = unitVal + ipiUnit + freteUnit;
            const icmsOrigemUnit = baseComIpiEFrete * (aliquotaOrigem / 100);
            const baseSemIcms = baseComIpiEFrete - icmsOrigemUnit;
            const aliqDestino = 0.17; // 17% MT
            const divisor = 1 - aliqDestino; // 0.83
            const baseCalculoDifal = baseSemIcms / divisor;
            const icmsDestinoUnit = baseCalculoDifal * aliqDestino;
            const difalUnit = isInterestadual ? Math.max(0, icmsDestinoUnit - icmsOrigemUnit) : 0;
            const difalTotal = difalUnit * qty;

            return {
                item,
                qty,
                unitVal,
                baseComIpiEFrete,
                aliquotaOrigem,
                icmsOrigemUnit,
                baseSemIcms,
                baseCalculoDifal,
                icmsDestinoUnit,
                difalUnit,
                difalTotal
            };
        } else if (isIcmsSt) {
            const mvaPercent = item.tributos?.pMVAST ? Number(item.tributos.pMVAST) : 40.0;
            const baseComMVA = (unitVal + ipiUnit) * (1 + mvaPercent / 100);
            const aliqDestino = 0.17;
            const icmsEntradaEffective = aliquotaOrigem <= 4 ? aliquotaOrigem : 7.0;
            const cred = icmsEntradaEffective / 100;
            const icmsStBruto = (baseComMVA * aliqDestino) - (unitVal * cred);
            const icmsStProtegido = Math.max(0, icmsStBruto);
            const stUnit = isInterestadual ? Math.max(0, icmsStProtegido * (1 - 0.12)) : 0;
            const stTotal = stUnit * qty;

            return {
                item,
                qty,
                unitVal,
                mvaPercent,
                baseComMVA,
                icmsStBruto,
                icmsStProtegido,
                stUnit,
                stTotal
            };
        }
        return { item, qty, unitVal, total: vProd };
    });

    const totalCalculatedTax = isDifal
        ? calculatedTaxDetails.reduce((acc, curr: any) => acc + (curr.difalTotal || 0), 0)
        : isIcmsSt
        ? calculatedTaxDetails.reduce((acc, curr: any) => acc + (curr.stTotal || 0), 0)
        : (doc.vICMSST || doc.vICMS || 0);

    return (
        <div className="space-y-6 w-full pb-12">
            <header className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/fiscal/acompanhamento-nfe')}
                        className="p-2 border border-border-subtle bg-surface hover:bg-bg-deep rounded-md text-text-primary transition-colors cursor-pointer"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
                            NF-e {doc.nNF || '-'} — {doc.issuer_name || 'Fornecedor'}
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                doc.status_classificacao === 'CANCELADA'
                                    ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-500/20'
                                    : doc.status_classificacao === 'CLASSIFICADO'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                                {doc.status_classificacao === 'CANCELADA' ? (
                                    <>
                                        <XCircle className="w-3.5 h-3.5" />
                                        Nota Cancelada
                                    </>
                                ) : doc.status_classificacao === 'CLASSIFICADO' ? (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Classificado
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Pendente de Classificação
                                    </>
                                )}
                            </span>
                        </h1>
                        <p className="text-text-muted text-xs font-mono mt-0.5">Competência: {doc.competencia || '-'}</p>
                    </div>
                </div>
            </header>

            {/* Banner de Aviso de Nota Resumida criada por Evento de Cancelamento */}
            {(doc.criada_por_evento || doc.status_importacao === 'RESUMIDA_EVENTO') && (
                <div className="bg-amber-500/10 border-2 border-amber-500/40 p-4 rounded-xl flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300 shadow-md">
                    <AlertTriangle className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        <h4 className="font-bold text-sm text-amber-900 dark:text-amber-200">
                            NF-e criada a partir de evento de cancelamento
                        </h4>
                        <p className="leading-relaxed text-amber-700 dark:text-amber-300">
                            O XML original da nota ainda não foi importado. Por esse motivo, produtos, valores, destinatário, tributos e demais informações da NF-e não estão disponíveis no momento.
                        </p>
                        <div className="pt-1 flex items-center gap-2 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                            <span className="bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">Situação: CANCELADA</span>
                            <span>•</span>
                            <span>Aguardando XML Original</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Classification Controls Header Card */}
            <div className="bg-surface rounded-xl border border-border-subtle shadow-sm p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-xs font-bold text-brand-primary uppercase tracking-wider">
                    <Sliders className="w-4 h-4" />
                    Classificação Fiscal da Nota
                    {hasChanges && (
                        <span className="bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-full text-[10px] font-semibold border border-amber-500/20">
                            Alterações não salvas
                        </span>
                    )}
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-text-secondary whitespace-nowrap">Aplicação:</label>
                        <select
                            value={draftAplicacao}
                            onChange={(e) => handleAplicacaoChange(e.target.value)}
                            disabled={updatingClass || doc.status_classificacao === 'CANCELADA'}
                            className="bg-bg-deep border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand-primary cursor-pointer disabled:opacity-50"
                        >
                            {APLICACOES_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-text-secondary whitespace-nowrap">Tributação:</label>
                        <select
                            value={draftTributacao}
                            onChange={(e) => setDraftTributacao(e.target.value)}
                            disabled={updatingClass || doc.status_classificacao === 'CANCELADA'}
                            className="bg-bg-deep border border-border-subtle rounded-lg px-3 py-1.5 text-xs font-semibold text-text-primary focus:outline-none focus:border-brand-primary cursor-pointer disabled:opacity-50"
                        >
                            {tributacoesPermitidas.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleSaveClassification}
                        disabled={!hasChanges || updatingClass || doc.status_classificacao === 'CANCELADA'}
                        className="px-4 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                        {updatingClass ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando...
                            </>
                        ) : (
                            <>
                                <Save className="w-3.5 h-3.5" /> Salvar Classificação
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => setShowCancelModal(true)}
                        disabled={updatingClass || doc.status_classificacao === 'CANCELADA'}
                        className="px-3 py-1.5 bg-red-600/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-lg text-xs font-semibold hover:bg-red-600 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer"
                        title="Cancelar Nota Fiscal"
                    >
                        <XCircle className="w-3.5 h-3.5" /> Cancelar Nota
                    </button>
                </div>
            </div>

            {/* DANFE Mirror Card */}
            <div className="bg-surface rounded-xl border border-border-subtle shadow-sm overflow-hidden">
                <div className="p-6 border-b border-border-subtle bg-bg-deep flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="text-xs font-bold text-brand-primary uppercase tracking-wider">Chave de Acesso</div>
                        <div className="flex items-center gap-2">
                            <span className="font-mono text-base font-bold text-text-primary tracking-wide">
                                {doc.access_key.replace(/(.{4})/g, '$1 ').trim()}
                            </span>
                            <button
                                onClick={copyAccessKey}
                                className={`p-1.5 rounded hover:bg-bg-surface transition-colors cursor-pointer text-text-muted hover:text-brand-primary ${copiedKey && 'text-emerald-500'}`}
                                title="Copiar Chave"
                            >
                                <Copy className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-sm bg-surface p-3.5 rounded-lg border border-border-subtle">
                        <div>
                            <span className="text-text-muted block text-[10px] font-bold uppercase">Modelo / Série</span>
                            <span className="text-text-primary font-semibold">{doc.mod || '55'} / {doc.serie || '1'}</span>
                        </div>
                        <div className="w-px h-8 bg-border-subtle" />
                        <div>
                            <span className="text-text-muted block text-[10px] font-bold uppercase">Data de Emissão</span>
                            <span className="text-text-primary font-semibold">
                                {doc.dhEmi ? new Date(doc.dhEmi).toLocaleDateString('pt-BR') : '-'}
                            </span>
                        </div>
                        <div className="w-px h-8 bg-border-subtle" />
                        <div>
                            <span className="text-text-muted block text-[10px] font-bold uppercase">Valor Total</span>
                            <span className="text-text-primary font-bold text-brand-primary">{formatCurrency(doc.vNF)}</span>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border-subtle p-6 bg-surface gap-6">
                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-brand-primary" />
                            Emitente / Fornecedor ({doc.uf_emit || 'UF'})
                        </h3>
                        <div className="text-sm font-bold text-text-primary">{doc.issuer_name || '-'}</div>
                        <div className="text-xs text-text-secondary">CNPJ: <span className="font-mono text-text-primary">{doc.issuer_cnpj || '-'}</span></div>
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-brand-primary" />
                            Destinatário ({doc.uf_dest || 'UF'})
                        </h3>
                        <div className="text-sm font-bold text-text-primary">{doc.recipient_name || '-'}</div>
                        <div className="text-xs text-text-secondary">CNPJ: <span className="font-mono text-text-primary">{doc.recipient_cnpj || '-'}</span></div>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex border-b border-border-subtle gap-4">
                <button
                    onClick={() => setActiveTab('general')}
                    className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'general' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    <FileText className="w-4 h-4" /> Dados Gerais & Classificação
                </button>
                <button
                    onClick={() => setActiveTab('items')}
                    className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'items' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    <Layers className="w-4 h-4" /> Itens da Nota ({doc.items.length})
                </button>
                <button
                    onClick={() => setActiveTab('taxes')}
                    className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'taxes' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    <PieChart className="w-4 h-4" /> Resumo Tributário
                </button>
                <button
                    onClick={() => setActiveTab('financial')}
                    className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'financial' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    <Banknote className="w-4 h-4" /> Dados Financeiros ({doc.installments?.length || 0})
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`py-2.5 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${activeTab === 'history' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                >
                    <History className="w-4 h-4" /> Histórico & Auditoria
                </button>
            </div>

            {/* Tab Contents */}
            <div>
                {activeTab === 'general' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-surface rounded-xl border border-border-subtle p-6 space-y-4">
                            <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider">Classificação Fiscal Registrada</h3>
                            <div className="grid grid-cols-2 gap-4 text-xs">
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <span className="text-text-muted block font-bold text-[10px] uppercase">Aplicação</span>
                                    <span className="font-bold text-text-primary mt-1 block">{doc.aplicacao || 'Não informada'}</span>
                                </div>
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <span className="text-text-muted block font-bold text-[10px] uppercase">Tipo de Tributação</span>
                                    <span className="font-bold text-text-primary mt-1 block">{doc.tipo_tributacao || 'Não informada'}</span>
                                </div>
                            </div>

                            <div className="space-y-1 pt-2">
                                <label className="text-xs font-semibold text-text-primary block">
                                    Observação da Classificação
                                </label>
                                <textarea
                                    value={observacao}
                                    onChange={(e) => setObservacao(e.target.value)}
                                    disabled={doc.status_classificacao === 'CANCELADA'}
                                    rows={2}
                                    placeholder="Justificativa ou observação técnica..."
                                    className="w-full bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary disabled:opacity-50"
                                />
                            </div>
                        </div>

                        <div className="bg-surface rounded-xl border border-border-subtle p-6 space-y-4">
                            <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider">Totais do Documento</h3>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <span className="text-text-muted block text-[10px]">Valor dos Produtos</span>
                                    <span className="font-bold text-text-primary mt-0.5 block">{formatCurrency(doc.vProd)}</span>
                                </div>
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <span className="text-text-muted block text-[10px]">Valor ICMS</span>
                                    <span className="font-bold text-text-primary mt-0.5 block">{formatCurrency(doc.vICMS)}</span>
                                </div>
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <span className="text-text-muted block text-[10px]">Valor ICMS ST</span>
                                    <span className="font-bold text-text-primary mt-0.5 block">{formatCurrency(doc.vICMSST)}</span>
                                </div>
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <span className="text-text-muted block text-[10px]">Valor IPI</span>
                                    <span className="font-bold text-text-primary mt-0.5 block">{formatCurrency(doc.vIPI)}</span>
                                </div>
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <span className="text-text-muted block text-[10px]">Valor PIS</span>
                                    <span className="font-bold text-text-primary mt-0.5 block">{formatCurrency(doc.vPIS)}</span>
                                </div>
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <span className="text-text-muted block text-[10px]">Valor COFINS</span>
                                    <span className="font-bold text-text-primary mt-0.5 block">{formatCurrency(doc.vCOFINS)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'items' && (
                    <div className="bg-surface rounded-xl border border-border-subtle shadow-sm overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-bg-deep border-b border-border-subtle text-xs text-text-muted uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-3 w-16 text-center">Item</th>
                                    <th className="px-6 py-3">Código / Descrição</th>
                                    <th className="px-6 py-3 text-center">NCM</th>
                                    <th className="px-6 py-3 text-center">CFOP</th>
                                    <th className="px-6 py-3 text-right">Qtd</th>
                                    <th className="px-6 py-3 text-right">Unitário</th>
                                    <th className="px-6 py-3 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle text-xs">
                                {doc.items.map(item => (
                                    <tr key={item.id} className="hover:bg-bg-deep/40 transition-colors">
                                        <td className="px-6 py-3.5 text-center font-mono text-text-muted">{item.nItem}</td>
                                        <td className="px-6 py-3.5">
                                            <div className="font-bold text-text-primary">{item.xProd}</div>
                                            <div className="text-text-muted">Cód: {item.cProd || '-'} | Un: {item.uCom || '-'}</div>
                                        </td>
                                        <td className="px-6 py-3.5 text-center font-mono">{item.NCM || '-'}</td>
                                        <td className="px-6 py-3.5 text-center font-mono">{item.CFOP || '-'}</td>
                                        <td className="px-6 py-3.5 text-right">{formatNumber(item.qCom, 4)}</td>
                                        <td className="px-6 py-3.5 text-right">{formatNumber(item.vUnCom, 4)}</td>
                                        <td className="px-6 py-3.5 text-right font-bold text-text-primary">{formatCurrency(item.vProd)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeTab === 'taxes' && (
                    <div className="space-y-6">
                        {/* Summary Header Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="bg-surface p-4 rounded-xl border border-border-subtle">
                                <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider block">Classificação em Prévia / Selecionada</span>
                                <span className="text-sm font-bold text-text-primary mt-1 block">
                                    {draftAplicacao} — {draftTributacao}
                                </span>
                            </div>
                            <div className="bg-surface p-4 rounded-xl border border-border-subtle">
                                <span className="text-text-muted text-[10px] font-bold uppercase tracking-wider block">Alíquota Destino / Origem</span>
                                <span className="text-sm font-bold text-text-primary mt-1 block">
                                    UF Origem: {doc.uf_emit || 'SC'} (12%) | UF Destino: {doc.uf_dest || 'MT'} (17%)
                                </span>
                            </div>
                            <div className="bg-surface p-4 rounded-xl border border-border-subtle bg-brand-primary/5">
                                <span className="text-brand-primary text-[10px] font-bold uppercase tracking-wider block">
                                    {isDifal ? 'Total DIFAL Calculado' : isIcmsSt ? 'Total ICMS ST Calculado' : 'Total Impostos'}
                                </span>
                                <span className="text-lg font-bold text-brand-primary mt-0.5 block">
                                    {formatCurrency(totalCalculatedTax)}
                                </span>
                            </div>
                        </div>

                        {/* Detailed Calculation Table per Product */}
                        <div className="bg-surface rounded-xl border border-border-subtle shadow-sm relative">
                            <div className="p-4 border-b border-border-subtle bg-bg-deep flex items-center justify-between rounded-t-xl">
                                <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2">
                                    <Calculator className="w-4 h-4" />
                                    Detalhamento Tributário por Produto ({doc.items.length} itens)
                                </h3>
                                <span className="text-xs text-text-muted font-mono">
                                    {isDifal ? 'Cálculo por Dentro (LC 190/2021)' : isIcmsSt ? 'Cálculo Substituição Tributária' : 'Resumo Tributário Padrão'}
                                </span>
                            </div>

                            <table className="w-full text-left">
                                <thead className="bg-bg-deep/60 border-b border-border-subtle text-[11px] text-text-muted uppercase font-semibold">
                                    <tr>
                                        <th className="px-4 py-3 w-12 text-center">Item</th>
                                        <th className="px-4 py-3">Descrição / NCM</th>
                                        <th className="px-4 py-3 text-right">Qtd</th>
                                        {isDifal ? (
                                            <>
                                                <th className="px-4 py-3 text-right">Base s/ ICMS</th>
                                                <th className="px-4 py-3 text-right">Base DIFAL (83%)</th>
                                                <th className="px-4 py-3 text-right">ICMS Orig (12%)</th>
                                                <th className="px-4 py-3 text-right">ICMS Dest (17%)</th>
                                                <th className="px-4 py-3 text-right text-brand-primary font-bold">DIFAL / Unid</th>
                                                <th className="px-4 py-3 text-right text-brand-primary font-bold">DIFAL Total</th>
                                            </>
                                        ) : isIcmsSt ? (
                                            <>
                                                <th className="px-4 py-3 text-right">Valor Unit</th>
                                                <th className="px-4 py-3 text-right">MVA (%)</th>
                                                <th className="px-4 py-3 text-right">Base c/ MVA</th>
                                                <th className="px-4 py-3 text-right">ST Bruto</th>
                                                <th className="px-4 py-3 text-right text-brand-primary font-bold">ST / Unid</th>
                                                <th className="px-4 py-3 text-right text-brand-primary font-bold">ST Total</th>
                                            </>
                                        ) : (
                                            <>
                                                <th className="px-4 py-3 text-right">Valor Unit</th>
                                                <th className="px-4 py-3 text-right">Valor Prod</th>
                                                <th className="px-4 py-3 text-right">Status Tributário</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle text-xs">
                                    {calculatedTaxDetails.map((calc: any, idx) => (
                                        <tr key={calc.item.id || idx} className="group relative hover:bg-bg-deep/50 transition-colors cursor-pointer">
                                            <td className="px-4 py-3.5 text-center font-mono text-text-muted">{calc.item.nItem}</td>
                                            <td className="px-4 py-3.5">
                                                <div className="font-bold text-text-primary">{calc.item.xProd}</div>
                                                <div className="text-text-muted font-mono text-[10px]">NCM: {calc.item.NCM || '-'} | CFOP: {calc.item.CFOP || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3.5 text-right font-mono">{formatNumber(calc.qty, 2)}</td>

                                            {isDifal ? (
                                                <>
                                                    <td className="px-4 py-3.5 text-right font-mono">{formatCurrency(calc.baseSemIcms)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono">{formatCurrency(calc.baseCalculoDifal)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono text-text-muted">{formatCurrency(calc.icmsOrigemUnit)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono text-text-muted">{formatCurrency(calc.icmsDestinoUnit)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono font-bold text-brand-primary">{formatCurrency(calc.difalUnit)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono font-bold text-brand-primary relative">
                                                        {formatCurrency(calc.difalTotal)}

                                                        {/* Tooltip Popover de Memória de Cálculo por Produto */}
                                                        <div className={`absolute right-2 z-50 hidden group-hover:block w-80 p-3.5 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 text-left pointer-events-none space-y-2 ${
                                                            idx === 0 ? 'top-full mt-2' : 'bottom-full mb-2'
                                                        }`}>
                                                            <div className="flex items-center justify-between border-b border-gray-700 pb-1.5 font-bold text-brand-primary text-xs">
                                                                <span>Memória de Cálculo (DIFAL por Dentro)</span>
                                                                <span className="text-[10px] text-gray-400 font-mono">Item {calc.item.nItem}</span>
                                                            </div>
                                                            <div className="space-y-1 font-mono text-[11px]">
                                                                <div className="flex justify-between text-gray-300">
                                                                    <span>1. Base c/ IPI e Frete:</span>
                                                                    <span className="font-semibold text-white">{formatCurrency(calc.baseComIpiEFrete)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-gray-300">
                                                                    <span>2. ICMS Origem ({calc.aliquotaOrigem}%):</span>
                                                                    <span className="text-gray-300">{formatCurrency(calc.icmsOrigemUnit)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-gray-300">
                                                                    <span>3. Base sem ICMS:</span>
                                                                    <span className="text-gray-300">{formatCurrency(calc.baseSemIcms)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-amber-400 font-semibold">
                                                                    <span>4. Base DIFAL (÷ 0,83):</span>
                                                                    <span>{formatCurrency(calc.baseCalculoDifal)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-gray-300">
                                                                    <span>5. ICMS Destino (17%):</span>
                                                                    <span>{formatCurrency(calc.icmsDestinoUnit)}</span>
                                                                </div>
                                                                <div className="flex justify-between border-t border-gray-700 pt-1 text-emerald-400 font-bold text-xs">
                                                                    <span>DIFAL / Unidade:</span>
                                                                    <span>{formatCurrency(calc.difalUnit)}</span>
                                                                </div>
                                                                <div className="flex justify-between font-bold text-emerald-300">
                                                                    <span>DIFAL Total ({calc.qty}x):</span>
                                                                    <span>{formatCurrency(calc.difalTotal)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : isIcmsSt ? (
                                                <>
                                                    <td className="px-4 py-3.5 text-right font-mono">{formatCurrency(calc.unitVal)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono">{calc.mvaPercent}%</td>
                                                    <td className="px-4 py-3.5 text-right font-mono">{formatCurrency(calc.baseComMVA)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono text-text-muted">{formatCurrency(calc.icmsStBruto)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono font-bold text-brand-primary">{formatCurrency(calc.stUnit)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono font-bold text-brand-primary relative">
                                                        {formatCurrency(calc.stTotal)}

                                                        {/* Tooltip Popover de Memória de Cálculo ST */}
                                                        <div className={`absolute right-2 z-50 hidden group-hover:block w-80 p-3.5 bg-gray-900 text-white rounded-xl shadow-2xl border border-gray-700 text-left pointer-events-none space-y-2 ${
                                                            idx === 0 ? 'top-full mt-2' : 'bottom-full mb-2'
                                                        }`}>
                                                            <div className="flex items-center justify-between border-b border-gray-700 pb-1.5 font-bold text-brand-primary text-xs">
                                                                <span>Memória de Cálculo (ICMS ST)</span>
                                                                <span className="text-[10px] text-gray-400 font-mono">Item {calc.item.nItem}</span>
                                                            </div>
                                                            <div className="space-y-1 font-mono text-[11px]">
                                                                <div className="flex justify-between text-gray-300">
                                                                    <span>1. Valor Unitário:</span>
                                                                    <span className="font-semibold text-white">{formatCurrency(calc.unitVal)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-gray-300">
                                                                    <span>2. MVA Aplicada:</span>
                                                                    <span>{calc.mvaPercent}%</span>
                                                                </div>
                                                                <div className="flex justify-between text-amber-400 font-semibold">
                                                                    <span>3. Base com MVA:</span>
                                                                    <span>{formatCurrency(calc.baseComMVA)}</span>
                                                                </div>
                                                                <div className="flex justify-between text-gray-300">
                                                                    <span>4. ST Bruto (17%):</span>
                                                                    <span>{formatCurrency(calc.icmsStBruto)}</span>
                                                                </div>
                                                                <div className="flex justify-between border-t border-gray-700 pt-1 text-emerald-400 font-bold text-xs">
                                                                    <span>ST / Unidade (-12%):</span>
                                                                    <span>{formatCurrency(calc.stUnit)}</span>
                                                                </div>
                                                                <div className="flex justify-between font-bold text-emerald-300">
                                                                    <span>ST Total ({calc.qty}x):</span>
                                                                    <span>{formatCurrency(calc.stTotal)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </>
                                            ) : (
                                                <>
                                                    <td className="px-4 py-3.5 text-right font-mono">{formatCurrency(calc.unitVal)}</td>
                                                    <td className="px-4 py-3.5 text-right font-mono font-bold">{formatCurrency(calc.total)}</td>
                                                    <td className="px-4 py-3.5 text-right font-semibold text-text-secondary">Operação Isenta / Normal</td>
                                                </>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Calculation Memory Card */}
                        <div className="bg-surface rounded-xl border border-border-subtle p-5 space-y-3">
                            <h4 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2">
                                <Info className="w-4 h-4" />
                                Memória de Cálculo ({isDifal ? 'DIFAL por Dentro' : isIcmsSt ? 'Substituição Tributária ST' : 'Operação Padrão'})
                            </h4>
                            {isDifal ? (
                                <div className="bg-bg-deep p-4 rounded-lg border border-border-subtle text-xs space-y-2 text-text-secondary">
                                    <p><strong>1. Base com IPI e Frete:</strong> <code className="bg-surface px-1.5 py-0.5 rounded font-mono">Valor Unitário + IPI + Frete</code></p>
                                    <p><strong>2. ICMS de Origem:</strong> <code className="bg-surface px-1.5 py-0.5 rounded font-mono">Base com IPI/Frete × Alíquota de Origem (12%)</code></p>
                                    <p><strong>3. Base Sem ICMS:</strong> <code className="bg-surface px-1.5 py-0.5 rounded font-mono">Base com IPI/Frete - ICMS de Origem</code></p>
                                    <p><strong>4. Base do DIFAL por Dentro:</strong> <code className="bg-surface px-1.5 py-0.5 rounded font-mono">Base Sem ICMS ÷ (1 - 0.17) = Base Sem ICMS ÷ 0.83</code></p>
                                    <p><strong>5. ICMS de Destino:</strong> <code className="bg-surface px-1.5 py-0.5 rounded font-mono">Base do DIFAL × Alíquota Interna de Destino (17%)</code></p>
                                    <p><strong>6. Valor do DIFAL a Recolher por Unidade:</strong> <code className="bg-surface px-1.5 py-0.5 rounded font-mono">max(0, ICMS Destino - ICMS Origem)</code></p>
                                </div>
                            ) : isIcmsSt ? (
                                <div className="bg-bg-deep p-4 rounded-lg border border-border-subtle text-xs space-y-2 text-text-secondary">
                                    <p><strong>1. Base de Cálculo da ST:</strong> <code className="bg-surface px-1.5 py-0.5 rounded font-mono">(Valor Unitário + IPI) × (1 + MVA%)</code></p>
                                    <p><strong>2. ICMS ST Bruto:</strong> <code className="bg-surface px-1.5 py-0.5 rounded font-mono">(Base com MVA × Alíquota Interna 17%) - (Valor Unitário × Crédito Eficiente)</code></p>
                                    <p><strong>3. Aplicação do Crédito Outorgado (12%):</strong> <code className="bg-surface px-1.5 py-0.5 rounded font-mono">max(0, ICMS ST Bruto × (1 - 0.12))</code></p>
                                </div>
                            ) : (
                                <div className="bg-bg-deep p-4 rounded-lg border border-border-subtle text-xs text-text-secondary">
                                    Operação sem recolhimento complementar de DIFAL ou Substituição Tributária.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="bg-surface rounded-xl border border-border-subtle p-6 space-y-4">
                        <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider">Histórico & Auditoria de Alterações</h3>
                        {loadingHistory ? (
                            <div className="text-center py-6 text-xs text-text-muted">Carregando histórico...</div>
                        ) : histories.length === 0 ? (
                            <div className="text-center py-6 text-xs text-text-muted">Nenhum evento registrado no histórico.</div>
                        ) : (
                            <div className="space-y-3">
                                {histories.map(h => (
                                    <div key={h.id} className="bg-bg-deep p-4 rounded-lg border border-border-subtle text-xs space-y-2">
                                        <div className="flex items-center justify-between font-semibold">
                                            <div className="flex items-center gap-2">
                                                <span className={`uppercase font-bold tracking-wider px-2 py-0.5 rounded text-[10px] ${
                                                    h.action === 'CANCELAMENTO'
                                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                                                        : 'bg-brand-primary/10 text-brand-primary'
                                                }`}>
                                                    {h.action}
                                                </span>
                                                {h.user_name && (
                                                    <span className="text-text-secondary text-[11px] font-normal">
                                                        por <strong className="text-text-primary">{h.user_name}</strong>
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-text-muted font-mono">{new Date(h.created_at).toLocaleString('pt-BR')}</span>
                                        </div>
                                        {h.previous_values && h.new_values && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 text-[11px]">
                                                <div className="bg-surface p-2.5 rounded border border-border-subtle">
                                                    <span className="text-text-muted block font-bold text-[10px] uppercase">Valores Anteriores:</span>
                                                    <span className="text-text-secondary block font-mono mt-0.5">
                                                        Status: {h.previous_values.status_classificacao || '-'} | Aplicação: {h.previous_values.aplicacao || '-'} | Tributação: {h.previous_values.tipo_tributacao || '-'}
                                                    </span>
                                                </div>
                                                <div className={`bg-surface p-2.5 rounded border ${
                                                    h.action === 'CANCELAMENTO' ? 'border-red-500/30' : 'border-emerald-500/30'
                                                }`}>
                                                    <span className={`block font-bold text-[10px] uppercase ${
                                                        h.action === 'CANCELAMENTO' ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'
                                                    }`}>
                                                        Novos Valores:
                                                    </span>
                                                    <span className="text-text-primary block font-mono font-bold mt-0.5">
                                                        Status: {h.new_values.status_classificacao || '-'} {h.new_values.tipo_tributacao && `| Tributação: ${h.new_values.tipo_tributacao}`}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        {h.justification && (
                                            <p className="text-text-secondary italic bg-surface p-2.5 rounded border border-border-subtle text-[11px]">
                                                "Justificativa: {h.justification}"
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'financial' && (
                    <div className="space-y-6">
                        {/* Indicadores Resumidos Financeiros */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm flex items-center gap-3">
                                <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                                    <Banknote className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Total em Duplicatas</span>
                                    <span className="text-lg font-bold text-text-primary block mt-0.5">
                                        {formatCurrency(
                                            (doc.installments || []).reduce((acc, item) => acc + (item.vDup || 0), 0)
                                        )}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm flex items-center gap-3">
                                <div className="p-3 bg-brand-primary/10 text-brand-primary rounded-xl">
                                    <CreditCard className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Qtd. de Parcelas</span>
                                    <span className="text-lg font-bold text-text-primary block mt-0.5">
                                        {doc.installments?.length || 0} parcela(s)
                                    </span>
                                </div>
                            </div>

                            <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm flex items-center gap-3">
                                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
                                    <CalendarDays className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Primeiro Vencimento</span>
                                    <span className="text-base font-bold text-text-primary block mt-0.5">
                                        {(() => {
                                            const v = doc.installments?.[0]?.dVenc;
                                            return v ? new Date(v).toLocaleDateString('pt-BR') : '-';
                                        })()}
                                    </span>
                                </div>
                            </div>

                            <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm flex items-center gap-3">
                                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                                    <CalendarDays className="w-6 h-6" />
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Último Vencimento</span>
                                    <span className="text-base font-bold text-text-primary block mt-0.5">
                                        {(() => {
                                            const v = doc.installments?.[doc.installments.length - 1]?.dVenc;
                                            return v ? new Date(v).toLocaleDateString('pt-BR') : '-';
                                        })()}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Seções de Duplicatas e Pagamentos */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Tabela de Duplicatas (2 Colunas) */}
                            <div className="lg:col-span-2 bg-surface rounded-xl border border-border-subtle p-6 shadow-sm space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2">
                                        <Banknote className="w-4 h-4" /> Duplicatas & Vencimentos das Parcelas (&lt;cobr&gt;)
                                    </h3>
                                    <span className="text-xs text-text-muted font-medium">
                                        Total: {doc.installments?.length || 0} parcela(s)
                                    </span>
                                </div>

                                {(!doc.installments || doc.installments.length === 0) ? (
                                    <div className="py-12 text-center text-text-muted space-y-2 bg-bg-deep rounded-lg border border-border-subtle">
                                        <Banknote className="w-10 h-10 mx-auto text-border-subtle" />
                                        <p className="text-xs font-semibold text-text-primary">Nenhuma duplicata mercantil informada no XML.</p>
                                        <p className="text-[11px] text-text-muted">A tag &lt;cobr&gt;&lt;dup&gt; não foi preenchida pelo emitente da NF-e.</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto border border-border-subtle rounded-lg">
                                        <table className="w-full text-left text-xs">
                                            <thead className="bg-bg-deep border-b border-border-subtle text-text-muted uppercase font-semibold">
                                                <tr>
                                                    <th className="px-4 py-3">Nº Parcela / Duplicata</th>
                                                    <th className="px-4 py-3">Vencimento</th>
                                                    <th className="px-4 py-3 text-right">Valor da Parcela</th>
                                                    <th className="px-4 py-3 text-center">% do Total</th>
                                                    <th className="px-4 py-3 text-center">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border-subtle">
                                                {doc.installments.map((inst, index) => {
                                                    const pct = doc.vNF ? ((inst.vDup || 0) / doc.vNF) * 100 : 0;
                                                    return (
                                                        <tr key={inst.id || index} className="hover:bg-bg-deep/40 transition-colors">
                                                            <td className="px-4 py-3 font-bold text-text-primary flex items-center gap-2">
                                                                <span className="w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary font-mono text-[11px] flex items-center justify-center font-bold">
                                                                    {index + 1}
                                                                </span>
                                                                {inst.nDup || `Parcela ${index + 1}`}
                                                            </td>
                                                            <td className="px-4 py-3 font-semibold text-text-primary font-mono">
                                                                {inst.dVenc ? new Date(inst.dVenc).toLocaleDateString('pt-BR') : '-'}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-bold text-brand-primary font-mono">
                                                                {formatCurrency(inst.vDup)}
                                                            </td>
                                                            <td className="px-4 py-3 text-center font-medium text-text-muted">
                                                                {pct.toFixed(1)}%
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                                                    Programado
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            {/* Formas de Pagamento (1 Coluna) */}
                            <div className="bg-surface rounded-xl border border-border-subtle p-6 shadow-sm space-y-4">
                                <h3 className="text-xs font-bold text-brand-primary uppercase tracking-wider flex items-center gap-2">
                                    <CreditCard className="w-4 h-4" /> Formas de Pagamento (&lt;pag&gt;)
                                </h3>

                                {(!doc.payments || doc.payments.length === 0) ? (
                                    <div className="py-12 text-center text-text-muted space-y-2 bg-bg-deep rounded-lg border border-border-subtle">
                                        <CreditCard className="w-10 h-10 mx-auto text-border-subtle" />
                                        <p className="text-xs font-semibold text-text-primary">Nenhuma forma de pagamento detalhada no XML.</p>
                                        <p className="text-[11px] text-text-muted">A tag &lt;pag&gt; não foi informada.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {doc.payments.map((p, idx) => (
                                            <div key={p.id || idx} className="bg-bg-deep p-4 rounded-xl border border-border-subtle flex items-center justify-between">
                                                <div className="space-y-1">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Forma Registrada</span>
                                                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                                                        <span className="font-mono text-brand-primary">[{p.tPag || '99'}]</span>
                                                        {PAYMENT_METHODS_LABELS[p.tPag || ''] || 'Outros / Não Especificado'}
                                                    </span>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Valor Pago</span>
                                                    <span className="text-sm font-bold text-emerald-500 font-mono">
                                                        {formatCurrency(p.vPag)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Modal de Cancelamento de Nota Fiscal */}
            {showCancelModal && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-surface rounded-2xl border border-border-subtle shadow-2xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
                            <div className="p-2.5 bg-red-500/10 rounded-xl">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-base font-bold text-text-primary">Cancelar Nota Fiscal</h3>
                                <p className="text-xs text-text-muted">NF-e {doc.nNF || '-'} — {doc.issuer_name || 'Fornecedor'}</p>
                            </div>
                        </div>

                        <p className="text-xs text-text-secondary">
                            Atenção: Ao cancelar esta nota fiscal, o status será alterado para <strong className="text-red-600 dark:text-red-400">CANCELADA</strong> e o evento será registrado na aba <strong>Histórico & Auditoria</strong> associado ao seu usuário.
                        </p>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-text-primary block">
                                Observação / Motivo do Cancelamento <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                rows={3}
                                placeholder="Descreva obrigatoriamente o motivo do cancelamento fiscal..."
                                className="w-full bg-bg-deep border border-border-subtle rounded-xl p-3 text-xs text-text-primary focus:outline-none focus:border-red-500"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                                onClick={() => {
                                    setShowCancelModal(false);
                                    setCancelReason('');
                                }}
                                disabled={canceling}
                                className="px-4 py-2 border border-border-subtle rounded-xl text-xs font-semibold text-text-primary hover:bg-bg-deep transition-colors cursor-pointer"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleConfirmCancel}
                                disabled={!cancelReason.trim() || canceling}
                                className="px-4 py-2 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-red-600/20"
                            >
                                {canceling ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" /> Cancelando...
                                    </>
                                ) : (
                                    <>
                                        <XCircle className="w-4 h-4" /> Confirmar Cancelamento
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NfeMonthlyDetailView;
