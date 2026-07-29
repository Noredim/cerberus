import React, { useState, useEffect } from 'react';
import {
    X,
    FileSpreadsheet,
    Calendar,
    Loader2,
    ArrowLeft,
    FileText,
    Download,
    Building2,
    Eye,
    AlertCircle
} from 'lucide-react';
import { api } from '../../../services/api';

interface NfeMonthlyReportPrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentCompetencia: string;
}

interface RecipientOption {
    cnpj: string;
    name: string;
    uf: string;
}

const APLICACOES_LABELS: Record<string, string> = {
    REVENDA: 'Revenda',
    MATERIAL_APLICADO: 'Material Aplicado',
    MATERIAL_COMODATO: 'Material para Comodato',
    CONSUMO_INTERNO: 'Consumo Interno',
    OUTRAS_REMESSAS: 'Outras Remessas',
    RETORNO_CONSERTO: 'Retorno de Conserto',
    COMBUSTIVEL: 'Combustível',
    CANCELAMENTO: 'Cancelamento'
};

const TRIBUTACAO_LABELS: Record<string, string> = {
    ICMS_ST: 'ICMS ST',
    ST_DESTACADO: 'ST Destacado',
    DIFAL_ST: 'DIFAL ST',
    DIFAL: 'DIFAL',
    NAO_TRIBUTADA: 'Operação Não Tributada',
    OPERACAO_NORMAL: 'Operação Normal',
    CANCELAMENTO: 'Cancelamento',
    ANTECIPACAO_ICMS: 'Antecipação ICMS',
    ANTECIPACAO_ST: 'Antecipação ST'
};

const formatAplicacaoLabel = (val: string | null | undefined): string => {
    if (!val) return 'Pendente';
    const key = val.trim().toUpperCase();
    if (APLICACOES_LABELS[key]) return APLICACOES_LABELS[key];
    return val
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase());
};

const formatTributacaoLabel = (val: string | null | undefined): string => {
    if (!val) return 'Pendente';
    const key = val.trim().toUpperCase();
    if (TRIBUTACAO_LABELS[key]) return TRIBUTACAO_LABELS[key];
    return val
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, l => l.toUpperCase());
};

const formatCurrency = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(val);
};

const formatCompetenciaLabel = (compStr: string) => {
    if (!compStr || compStr === 'ALL') return 'Todas as Competências';
    const [year, month] = compStr.split('-');
    if (!year || !month) return compStr;
    const monthNames = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];
    const mIdx = parseInt(month, 10) - 1;
    return `${monthNames[mIdx] || month} / ${year}`;
};

export const NfeMonthlyReportPrintModal: React.FC<NfeMonthlyReportPrintModalProps> = ({
    isOpen,
    onClose,
    currentCompetencia
}) => {
    const [selectedCompetencia, setSelectedCompetencia] = useState<string>(currentCompetencia || 'ALL');
    const [availableCompetencias, setAvailableCompetencias] = useState<string[]>([]);
    const [selectedRecipientCnpj, setSelectedRecipientCnpj] = useState<string>('');
    const [recipientsList, setRecipientsList] = useState<RecipientOption[]>([]);
    const [isPrintMode, setIsPrintMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [reportDocs, setReportDocs] = useState<any[]>([]);

    useEffect(() => {
        const loadCompetencias = async () => {
            try {
                const res = await api.get('/fiscal/acompanhamento-nfe/competencias');
                const list: string[] = res.data || [];
                setAvailableCompetencias(list);
                if (list.length > 0 && !currentCompetencia) {
                    setSelectedCompetencia(list[0]);
                }
            } catch (e) {
                console.error('Erro ao carregar competências disponíveis:', e);
            }
        };

        if (isOpen) {
            loadCompetencias();
            setSelectedCompetencia(currentCompetencia || 'ALL');
            setSelectedRecipientCnpj('');
            setIsPrintMode(false);
            fetchReportData(currentCompetencia || 'ALL');
        }
    }, [isOpen, currentCompetencia]);

    const fetchReportData = async (comp: string) => {
        setLoading(true);
        try {
            const params: Record<string, any> = {
                page: 1,
                size: 5000
            };
            if (comp && comp !== 'ALL') {
                params.competencia = comp;
            }
            const response = await api.get('/fiscal/acompanhamento-nfe', { params });
            const docs = response.data.items || [];
            setReportDocs(docs);

            const recMap = new Map<string, RecipientOption>();
            docs.forEach((d: any) => {
                if (d.recipient_cnpj && !recMap.has(d.recipient_cnpj)) {
                    recMap.set(d.recipient_cnpj, {
                        cnpj: d.recipient_cnpj,
                        name: d.recipient_name || d.recipient_cnpj,
                        uf: d.uf_dest || ''
                    });
                }
            });
            const list = Array.from(recMap.values());
            setRecipientsList(list);
            
            if (list.length > 0) {
                setSelectedRecipientCnpj(list[0].cnpj);
            } else {
                setSelectedRecipientCnpj('');
            }
            return docs;
        } catch (error) {
            console.error('Erro ao carregar dados do relatório:', error);
            return [];
        } finally {
            setLoading(false);
        }
    };

    const handleCompetenciaChange = (newComp: string) => {
        setSelectedCompetencia(newComp);
        fetchReportData(newComp);
    };

    if (!isOpen) return null;

    const filteredDocs = reportDocs.filter(d => d.recipient_cnpj === selectedRecipientCnpj);
    const selectedRecipientObj = recipientsList.find(r => r.cnpj === selectedRecipientCnpj);
    const isSelectionValid = Boolean(selectedRecipientCnpj && selectedRecipientObj);

    const handleDownloadPdf = async () => {
        if (!isSelectionValid) {
            alert('A seleção da Empresa Destinatária é obrigatória para gerar o relatório.');
            return;
        }

        setDownloadingPdf(true);
        try {
            const params: Record<string, any> = {
                recipient_cnpj: selectedRecipientCnpj
            };
            if (selectedCompetencia && selectedCompetencia !== 'ALL') {
                params.competencia = selectedCompetencia;
            }

            const response = await api.get('/fiscal/acompanhamento-nfe/pdf', {
                params,
                responseType: 'blob'
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            
            window.open(url, '_blank');

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `relatorio_acompanhamento_mensal_${selectedCompetencia}_${selectedRecipientCnpj}.pdf`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Erro ao gerar relatório PDF:', error);
            alert('Erro ao gerar o relatório em PDF. Por favor, tente novamente.');
        } finally {
            setDownloadingPdf(false);
        }
    };

    const handleExportCSV = () => {
        if (!isSelectionValid || !filteredDocs || filteredDocs.length === 0) {
            alert('Selecione uma Empresa Destinatária válida com dados para exportar.');
            return;
        }

        const headers = [
            'Número NF-e',
            'Chave de Acesso',
            'Aplicação Fiscal',
            'Tipo Tributação',
            'Série',
            'Natureza da Operação',
            'Número Protocolo',
            'Data/Hora Autorização',
            'Situação',
            'Razão Social Fornecedor',
            'UF Origem',
            'CNPJ Fornecedor',
            'I.E. Fornecedor',
            'Destinatário Razão Social',
            'Destinatário CNPJ',
            'Destinatário UF',
            'Base de Cálculo ICMS (R$)',
            'Valor ICMS (R$)',
            'Base ICMS ST (R$)',
            'Valor ICMS ST (R$)',
            'Valor Produtos (R$)',
            'Valor Frete (R$)',
            'Valor Total NF-e (R$)'
        ];

        const rows = filteredDocs.map((d: any) => [
            `"${d.nNF || ''}"`,
            `"${d.access_key || ''}"`,
            `"${formatAplicacaoLabel(d.aplicacao)}"`,
            `"${formatTributacaoLabel(d.tipo_tributacao)}"`,
            `"${d.serie || '1'}"`,
            `"${(d.natOp || '').replace(/"/g, '""')}"`,
            `"${d.nProt || ''}"`,
            `"${d.dhRecbto ? new Date(d.dhRecbto).toLocaleString('pt-BR') : ''}"`,
            `"${d.cStat ? `${d.cStat} - ${d.xMotivo || ''}` : 'Autorizada'}"`,
            `"${(d.issuer_name || '').replace(/"/g, '""')}"`,
            `"${d.uf_emit || ''}"`,
            `"${d.issuer_cnpj || ''}"`,
            `"${d.issuer_ie || ''}"`,
            `"${(d.recipient_name || '').replace(/"/g, '""')}"`,
            `"${d.recipient_cnpj || ''}"`,
            `"${d.uf_dest || ''}"`,
            (d.vBC || 0).toFixed(2).replace('.', ','),
            (d.vICMS || 0).toFixed(2).replace('.', ','),
            (d.vBCST || 0).toFixed(2).replace('.', ','),
            (d.vICMSST || 0).toFixed(2).replace('.', ','),
            (d.vProd || 0).toFixed(2).replace('.', ','),
            (d.vFrete || 0).toFixed(2).replace('.', ','),
            (d.vNF || 0).toFixed(2).replace('.', ',')
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map((e: any) => e.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `relatorio_acompanhamento_mensal_${selectedCompetencia}_${selectedRecipientCnpj}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const competenciaOptions = [
        { value: 'ALL', label: 'Todas as Competências' },
        ...availableCompetencias.map(c => ({
            value: c,
            label: formatCompetenciaLabel(c)
        }))
    ];

    // Modo de Pré-visualização na Tela
    if (isPrintMode) {
        const totalVBC = filteredDocs.reduce((acc, d) => acc + (d.vBC || 0), 0);
        const totalVICMS = filteredDocs.reduce((acc, d) => acc + (d.vICMS || 0), 0);
        const totalVBCST = filteredDocs.reduce((acc, d) => acc + (d.vBCST || 0), 0);
        const totalVICMSST = filteredDocs.reduce((acc, d) => acc + (d.vICMSST || 0), 0);
        const totalVProd = filteredDocs.reduce((acc, d) => acc + (d.vProd || 0), 0);
        const totalVFrete = filteredDocs.reduce((acc, d) => acc + (d.vFrete || 0), 0);
        const totalVNF = filteredDocs.reduce((acc, d) => acc + (d.vNF || 0), 0);

        return (
            <div className="fixed inset-0 z-50 bg-slate-950/90 overflow-y-auto p-4 sm:p-6">
                <div className="max-w-7xl mx-auto mb-4 bg-slate-900 border border-slate-800 p-4 rounded-xl flex items-center justify-between shadow-2xl text-white">
                    <button
                        onClick={() => setIsPrintMode(false)}
                        className="flex items-center gap-2 text-xs font-bold text-slate-300 hover:text-white bg-slate-800 px-3 py-2 rounded-lg transition-colors cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" /> Voltar ao Selecionador
                    </button>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md"
                        >
                            <FileSpreadsheet className="w-4 h-4" /> Baixar Excel (.csv)
                        </button>
                        <button
                            onClick={handleDownloadPdf}
                            disabled={downloadingPdf || !isSelectionValid}
                            className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md disabled:opacity-50"
                        >
                            {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            Gerar e Baixar PDF (A4 Paisagem)
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="max-w-7xl mx-auto bg-white text-slate-900 p-6 rounded-xl shadow-2xl font-sans text-xs">
                    <div className="border-b-2 border-slate-900 pb-3 mb-3 flex items-start justify-between gap-4">
                        <div className="space-y-1">
                            <h1 className="text-lg font-extrabold uppercase tracking-tight text-slate-900">RELATÓRIO ACOMPANHAMENTO MENSAL DE NF-E</h1>
                            
                            <div className="flex flex-col gap-1 text-xs text-slate-700 pt-1">
                                <div>
                                    Competência: <strong className="text-slate-900 font-bold">{formatCompetenciaLabel(selectedCompetencia)}</strong>
                                </div>
                                <div className="text-xs text-slate-900 font-medium bg-slate-100 px-2.5 py-1 rounded border border-slate-300 inline-block">
                                    <strong>Empresa Destinatária:</strong>{' '}
                                    {selectedRecipientObj ? (
                                        <span>
                                            <strong className="text-slate-900 font-bold">{selectedRecipientObj.name}</strong> — CNPJ: <span className="font-mono">{selectedRecipientObj.cnpj}</span> {selectedRecipientObj.uf ? `(${selectedRecipientObj.uf})` : ''}
                                        </span>
                                    ) : (
                                        <span className="text-slate-500 italic">Nenhuma Selecionada</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="text-right text-[10px] text-slate-600 space-y-0.5 shrink-0">
                            <div>Total de Registros: <strong className="text-slate-900 font-bold">{filteredDocs.length}</strong></div>
                            <div>Gerado em: <strong>{new Date().toLocaleString('pt-BR')}</strong></div>
                            <div className="text-[9px] text-slate-400">Formato A4 Paisagem</div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-20 text-center text-slate-500 flex flex-col items-center justify-center">
                            <Loader2 className="w-8 h-8 animate-spin text-brand-primary mb-2" />
                            Carregando dados para visualização...
                        </div>
                    ) : filteredDocs.length === 0 ? (
                        <div className="py-16 text-center text-slate-500 flex flex-col items-center justify-center space-y-3">
                            <p className="text-sm font-semibold text-slate-700">Nenhuma nota fiscal encontrada para a empresa destinatária selecionada nesta competência.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-[9px]">
                                <thead>
                                    <tr className="bg-slate-900 text-white uppercase text-[8px] tracking-wider font-bold">
                                        <th className="p-1.5 border border-slate-700">Nº NF / Chave</th>
                                        <th className="p-1.5 border border-slate-700">Aplicação / Tributação</th>
                                        <th className="p-1.5 border border-slate-700 text-center">Série</th>
                                        <th className="p-1.5 border border-slate-700">Nat. Operação</th>
                                        <th className="p-1.5 border border-slate-700">Protocolo / Autorização / Situação</th>
                                        <th className="p-1.5 border border-slate-700">Fornecedor (Origem / CNPJ / I.E)</th>
                                        <th className="p-1.5 border border-slate-700 text-right">Base ICMS</th>
                                        <th className="p-1.5 border border-slate-700 text-right">Valor ICMS</th>
                                        <th className="p-1.5 border border-slate-700 text-right">Base ST</th>
                                        <th className="p-1.5 border border-slate-700 text-right">ICMS ST</th>
                                        <th className="p-1.5 border border-slate-700 text-right">Valor Prod</th>
                                        <th className="p-1.5 border border-slate-700 text-right">Frete</th>
                                        <th className="p-1.5 border border-slate-700 text-right">Valor Total NF</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredDocs.map((doc, idx) => (
                                        <tr key={doc.id || idx} className={idx % 2 === 0 ? 'bg-slate-50' : 'bg-white'}>
                                            <td className="p-1.5 border border-slate-200 font-mono">
                                                <div className="font-bold text-slate-900 text-[10px]">Nº {doc.nNF || '-'}</div>
                                                <div className="text-[8px] text-slate-700 bg-slate-100 px-1 py-0.5 rounded border border-slate-300 font-mono mt-0.5 whitespace-nowrap inline-block tracking-tighter select-all">{doc.access_key}</div>
                                            </td>
                                            <td className="p-1.5 border border-slate-200 font-semibold">
                                                <div className="text-slate-900">{formatAplicacaoLabel(doc.aplicacao)}</div>
                                                <div className="text-[8px] text-brand-primary font-bold">{formatTributacaoLabel(doc.tipo_tributacao)}</div>
                                            </td>
                                            <td className="p-1.5 border border-slate-200 text-center font-bold text-slate-700">
                                                {doc.serie || '1'}
                                            </td>
                                            <td className="p-1.5 border border-slate-200 text-slate-700 break-words whitespace-normal min-w-[110px]">
                                                {doc.natOp || '-'}
                                            </td>
                                            <td className="p-1.5 border border-slate-200 font-mono">
                                                <div className="font-semibold text-slate-900">{doc.nProt || '-'}</div>
                                                {doc.dhRecbto && <div className="text-[7.5px] text-slate-500">{new Date(doc.dhRecbto).toLocaleString('pt-BR')}</div>}
                                                <div className="text-[7.5px] font-bold text-emerald-800 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200 mt-0.5 inline-block whitespace-nowrap">
                                                    {doc.cStat ? `${doc.cStat} - ${doc.xMotivo || 'Autorizado'}` : 'Autorizada'}
                                                </div>
                                            </td>
                                            <td className="p-1.5 border border-slate-200">
                                                <div className="font-bold text-slate-900">{doc.issuer_name || '-'}</div>
                                                <div className="flex items-center gap-1 font-mono text-[7.5px] mt-0.5 flex-wrap">
                                                    <span className="px-1 py-0.2 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200">{doc.uf_emit || 'UF'}</span>
                                                    <span className="px-1 py-0.2 rounded bg-slate-100 text-slate-700 border border-slate-200">{doc.issuer_cnpj || '-'}</span>
                                                    <span className="px-1 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200">IE: {doc.issuer_ie || 'ISENTO'}</span>
                                                </div>
                                            </td>
                                            <td className="p-1.5 border border-slate-200 text-right font-mono">
                                                {formatCurrency(doc.vBC)}
                                            </td>
                                            <td className="p-1.5 border border-slate-200 text-right font-mono">
                                                {formatCurrency(doc.vICMS)}
                                            </td>
                                            <td className="p-1.5 border border-slate-200 text-right font-mono">
                                                {doc.vBCST ? formatCurrency(doc.vBCST) : '-'}
                                            </td>
                                            <td className="p-1.5 border border-slate-200 text-right font-mono font-semibold">
                                                {doc.vICMSST ? formatCurrency(doc.vICMSST) : '-'}
                                            </td>
                                            <td className="p-1.5 border border-slate-200 text-right font-mono font-medium">
                                                {formatCurrency(doc.vProd)}
                                            </td>
                                            <td className="p-1.5 border border-slate-200 text-right font-mono">
                                                {doc.vFrete ? formatCurrency(doc.vFrete) : '-'}
                                            </td>
                                            <td className="p-1.5 border border-slate-200 text-right font-mono font-bold text-slate-900">
                                                {formatCurrency(doc.vNF)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-slate-900 text-white font-bold uppercase text-[8px]">
                                        <td colSpan={6} className="p-2 border border-slate-700 text-right">
                                            Totais Agregados do Relatório:
                                        </td>
                                        <td className="p-2 border border-slate-700 text-right font-mono">
                                            {formatCurrency(totalVBC)}
                                        </td>
                                        <td className="p-2 border border-slate-700 text-right font-mono">
                                            {formatCurrency(totalVICMS)}
                                        </td>
                                        <td className="p-2 border border-slate-700 text-right font-mono">
                                            {formatCurrency(totalVBCST)}
                                        </td>
                                        <td className="p-2 border border-slate-700 text-right font-mono text-cyan-300">
                                            {formatCurrency(totalVICMSST)}
                                        </td>
                                        <td className="p-2 border border-slate-700 text-right font-mono">
                                            {formatCurrency(totalVProd)}
                                        </td>
                                        <td className="p-2 border border-slate-700 text-right font-mono">
                                            {formatCurrency(totalVFrete)}
                                        </td>
                                        <td className="p-2 border border-slate-700 text-right font-mono text-amber-400 text-[9px]">
                                            {formatCurrency(totalVNF)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Modal Padrão de Escolha de Competência e Destinatário
    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface rounded-2xl border border-border-subtle shadow-2xl max-w-md w-full p-6 space-y-6">
                <div className="flex items-center justify-between border-b border-border-subtle pb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-xl">
                            <FileText className="w-6 h-6" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-text-primary">RELATÓRIO ACOMPANHAMENTO MENSAL</h3>
                            <p className="text-xs text-text-muted">Selecione a competência e o destinatário obrigatório</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-text-muted hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* Seletor de Competência Dinâmica com Lançamentos */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                            <Calendar className="w-4 h-4 text-brand-primary" />
                            Competência do Relatório
                        </label>
                        
                        <select
                            value={selectedCompetencia}
                            onChange={e => handleCompetenciaChange(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-xl p-3 text-xs font-bold text-text-primary focus:outline-none focus:border-brand-primary cursor-pointer"
                        >
                            {competenciaOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <span className="text-[10px] text-text-muted block">
                            Exibe apenas as competências que possuem lançamentos gravados no sistema.
                        </span>
                    </div>

                    {/* Seletor Obrigatorio de Empresa Destinatária das Notas */}
                    <div className="space-y-2 pt-1">
                        <label className="text-xs font-bold text-text-primary flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                                <Building2 className="w-4 h-4 text-brand-primary" />
                                Empresa Destinatária das Notas
                            </span>
                            <span className="text-[10px] text-amber-500 font-bold uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                                Obrigatorio
                            </span>
                        </label>

                        {loading ? (
                            <div className="flex items-center gap-2 text-xs text-text-muted py-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-primary" />
                                Carregando empresas destinatárias...
                            </div>
                        ) : recipientsList.length === 0 ? (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                Nenhuma empresa destinatária encontrada para esta competência.
                            </div>
                        ) : (
                            <select
                                value={selectedRecipientCnpj}
                                onChange={e => setSelectedRecipientCnpj(e.target.value)}
                                className={`w-full bg-bg-deep border rounded-xl p-3 text-xs font-bold focus:outline-none cursor-pointer ${
                                    !isSelectionValid
                                        ? 'border-amber-500/60 text-amber-500 focus:border-amber-500'
                                        : 'border-border-subtle text-text-primary focus:border-brand-primary'
                                }`}
                            >
                                <option value="" disabled>-- Selecione a Empresa Destinatária (Obrigatório) --</option>
                                {recipientsList.map(r => (
                                    <option key={r.cnpj} value={r.cnpj}>
                                        {r.name} — CNPJ: {r.cnpj} {r.uf ? `(${r.uf})` : ''}
                                    </option>
                                ))}
                            </select>
                        )}
                        <span className="text-[10px] text-text-muted block">
                            Selecione a empresa recebedora dos XMLs para emitir o relatório contábil/fiscal.
                        </span>
                    </div>

                    <div className="p-3 bg-bg-deep rounded-xl border border-border-subtle space-y-1 text-xs text-text-muted">
                        <div className="font-bold text-text-primary">Resumo do Filtro:</div>
                        <ul className="list-disc list-inside text-[11px] space-y-0.5">
                            <li><strong>Competência:</strong> {formatCompetenciaLabel(selectedCompetencia)}</li>
                            <li><strong>Destinatário Selecionado:</strong> {selectedRecipientObj ? selectedRecipientObj.name : 'Pendente de seleção'}</li>
                        </ul>
                    </div>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t border-border-subtle">
                    <button
                        onClick={handleDownloadPdf}
                        disabled={downloadingPdf || loading || !isSelectionValid || filteredDocs.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-bold px-4 py-3 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 shadow-md"
                    >
                        {downloadingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                        Gerar e Baixar Relatório PDF (A4 Paisagem)
                    </button>

                    <button
                        onClick={() => setIsPrintMode(true)}
                        disabled={loading || !isSelectionValid || filteredDocs.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-surface hover:bg-bg-deep border border-border-subtle text-text-primary font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                        <Eye className="w-4 h-4 text-brand-primary" />
                        Pré-visualizar Tabela na Tela
                    </button>

                    <button
                        onClick={handleExportCSV}
                        disabled={loading || !isSelectionValid || filteredDocs.length === 0}
                        className="w-full flex items-center justify-center gap-2 bg-surface hover:bg-bg-deep border border-border-subtle text-text-primary font-bold px-4 py-2.5 rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50"
                    >
                        <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                        Baixar em Planilha Excel (.csv)
                    </button>
                </div>
            </div>
        </div>
    );
};
