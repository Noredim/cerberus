import React, { useEffect, useState } from 'react';
import {
    FileText,
    UploadCloud,
    RefreshCw,
    Search,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Layers,
    Trash2,
    Eye,
    X,
    Calendar,
    Printer,
    ChevronDown,
    FileSpreadsheet
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../../services/api';
import { NfeBatchImportModal } from './NfeBatchImportModal';
import { NfeBatchClassifyModal } from './NfeBatchClassifyModal';
import { NfeMonthlyReportPrintModal } from './NfeMonthlyReportPrintModal';

interface FiscalDocumentItem {
    id: string;
    access_key: string;
    nNF: string | null;
    serie: string | null;
    mod: string | null;
    natOp: string | null;
    dhEmi: string | null;
    competencia: string | null;
    issuer_cnpj: string | null;
    issuer_name: string | null;
    issuer_ie: string | null;
    uf_emit: string | null;
    recipient_cnpj: string | null;
    recipient_name: string | null;
    uf_dest: string | null;
    aplicacao: string | null;
    tipo_tributacao: string | null;
    status_classificacao: string | null;
    divergencia_flag: boolean;
    vProd: number | null;
    vNF: number | null;
    vBC: number | null;
    vICMS: number | null;
    vBCST: number | null;
    vICMSST: number | null;
    vIPI: number | null;
    vPIS: number | null;
    vCOFINS: number | null;
    vFrete: number | null;
    nProt: string | null;
    dhRecbto: string | null;
    cStat: string | null;
    xMotivo: string | null;
    created_at: string;
}

interface MonthlyMetrics {
    total_notes: number;
    total_vNF: number;
    total_vProd: number;
    total_vICMS: number;
    total_vICMSST: number;
    total_vIPI: number;
    total_vPIS: number;
    total_vCOFINS: number;
    total_suppliers: number;
    pending_classification_count: number;
    divergence_count: number;
}

const APLICACOES_LABELS: Record<string, string> = {
    REVENDA: 'Revenda',
    MATERIAL_APLICADO: 'Material Aplicado',
    MATERIAL_COMODATO: 'Material para Comodato',
    CONSUMO_INTERNO: 'Consumo Interno / Uso e Consumo',
    OUTRAS_REMESSAS: 'Outras Remessas',
    RETORNO_CONSERTO: 'Retorno de Conserto',
    COMBUSTIVEL: 'Combustível',
    CANCELAMENTO: 'Cancelamento',
    INSUMO: 'Insumo',
    ATIVO_IMOBILIZADO: 'Ativo Imobilizado'
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

export const NfeMonthlyTrackerList: React.FC = () => {
    const navigate = useNavigate();

    // Data states
    const [documents, setDocuments] = useState<FiscalDocumentItem[]>([]);
    const [metrics, setMetrics] = useState<MonthlyMetrics>({
        total_notes: 0,
        total_vNF: 0,
        total_vProd: 0,
        total_vICMS: 0,
        total_vICMSST: 0,
        total_vIPI: 0,
        total_vPIS: 0,
        total_vCOFINS: 0,
        total_suppliers: 0,
        pending_classification_count: 0,
        divergence_count: 0
    });
    const [loading, setLoading] = useState(true);

    // Date/Competência state: "YYYY-MM"
    const [currentCompetencia, setCurrentCompetencia] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });

    const [availableCompetencias, setAvailableCompetencias] = useState<string[]>([]);

    const fetchAvailableCompetencias = async () => {
        try {
            const res = await api.get('/fiscal/acompanhamento-nfe/competencias');
            const list: string[] = res.data || [];
            setAvailableCompetencias(list);
            if (list.length > 0 && currentCompetencia !== 'ALL' && !list.includes(currentCompetencia)) {
                setCurrentCompetencia(list[0]);
            }
        } catch (error) {
            console.error('Erro ao carregar competências disponíveis:', error);
        }
    };

    useEffect(() => {
        fetchAvailableCompetencias();
    }, []);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedAplicacao, setSelectedAplicacao] = useState('');
    const [selectedTributacao, setSelectedTributacao] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [selectedUf, setSelectedUf] = useState('');
    const [onlyDivergences, setOnlyDivergences] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Selection for Batch actions
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [selectAllMatching, setSelectAllMatching] = useState(false);

    // Modals
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [isReportDropdownOpen, setIsReportDropdownOpen] = useState(false);

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const params: Record<string, any> = {
                page,
                size: 25
            };
            if (currentCompetencia && currentCompetencia !== 'ALL') {
                params.competencia = currentCompetencia;
            }
            if (searchTerm) params.search = searchTerm;
            if (selectedAplicacao) params.aplicacao = selectedAplicacao;
            if (selectedTributacao) params.tipo_tributacao = selectedTributacao;
            if (selectedStatus) params.status_classificacao = selectedStatus;
            if (selectedUf) params.uf_emit = selectedUf;
            if (onlyDivergences) params.divergencia_flag = true;

            const response = await api.get('/fiscal/acompanhamento-nfe', { params });
            setDocuments(response.data.items);
            setMetrics(response.data.metrics);
            setTotalPages(response.data.pages || 1);
        } catch (error) {
            console.error('Erro ao carregar documentos de acompanhamento mensal:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setSelectedIds([]);
        setSelectAllMatching(false);
        fetchDocuments();
    }, [currentCompetencia, page, selectedAplicacao, selectedTributacao, selectedStatus, selectedUf, onlyDivergences]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        setSelectedIds([]);
        setSelectAllMatching(false);
        fetchDocuments();
    };

    const changeCompetenciaMonth = (delta: number) => {
        let baseComp = currentCompetencia;
        if (!baseComp || baseComp === 'ALL') {
            const now = new Date();
            baseComp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        }
        const [yStr, mStr] = baseComp.split('-');
        let year = parseInt(yStr, 10);
        let month = parseInt(mStr, 10) + delta;

        if (month > 12) {
            month = 1;
            year += 1;
        } else if (month < 1) {
            month = 12;
            year -= 1;
        }

        const newComp = `${year}-${String(month).padStart(2, '0')}`;
        setCurrentCompetencia(newComp);
        setPage(1);
        setSelectedIds([]);
        setSelectAllMatching(false);
    };

    const formatCompetenciaLabel = (compStr: string) => {
        if (!compStr || compStr === 'ALL') return 'Todas as Competências';
        const [year, month] = compStr.split('-');
        const monthNames = [
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
            'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        ];
        const mIdx = parseInt(month, 10) - 1;
        return `${monthNames[mIdx] || month} / ${year}`;
    };

    const formatCurrency = (val: number | null) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(documents.map(d => d.id));
        } else {
            setSelectedIds([]);
            setSelectAllMatching(false);
        }
    };

    const toggleSelectId = (id: string) => {
        setSelectedIds(prev => {
            const next = prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id];
            if (next.length !== documents.length) {
                setSelectAllMatching(false);
            }
            return next;
        });
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Deseja realmente excluir este documento fiscal?')) return;
        try {
            await api.delete(`/fiscal/acompanhamento-nfe/${id}`);
            fetchDocuments();
            setSelectedIds(prev => prev.filter(i => i !== id));
        } catch (err: any) {
            console.error('Erro ao excluir documento:', err);
            alert(err.response?.data?.detail || 'Erro ao excluir documento.');
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedAplicacao('');
        setSelectedTributacao('');
        setSelectedStatus('');
        setSelectedUf('');
        setOnlyDivergences(false);
        setPage(1);
        setSelectedIds([]);
        setSelectAllMatching(false);
    };

    return (
        <div className="space-y-6 w-full pb-12">
            {/* Header */}
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-text-primary flex items-center gap-2">
                        <FileText className="w-7 h-7 text-brand-primary" />
                        Acompanhamento Mensal de NF-e
                    </h1>
                    <p className="text-text-muted text-xs mt-1">
                        Importe, classifique e acompanhe o fluxo fiscal das notas fiscais por competência mensal.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white px-4 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                    >
                        <UploadCloud className="w-4 h-4" />
                        Importar XMLs
                    </button>

                    <button
                        disabled={selectedIds.length === 0 && !selectAllMatching}
                        onClick={() => setIsClassifyModalOpen(true)}
                        className="flex items-center gap-2 border border-border-subtle bg-surface hover:bg-bg-deep disabled:opacity-40 text-text-primary px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    >
                        <Layers className="w-4 h-4 text-brand-primary" />
                        Classificar em Lote ({selectAllMatching ? metrics.total_notes : selectedIds.length})
                    </button>

                    {/* Menu Dropdown de Relatórios */}
                    <div className="relative">
                        <button
                            onClick={() => setIsReportDropdownOpen(prev => !prev)}
                            className="flex items-center gap-2 border border-border-subtle bg-surface hover:bg-bg-deep text-text-primary px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition-all cursor-pointer"
                        >
                            <Printer className="w-4 h-4 text-brand-primary" />
                            Relatórios
                            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
                        </button>

                        {isReportDropdownOpen && (
                            <div className="absolute right-0 mt-2 w-72 bg-surface border border-border-subtle rounded-xl shadow-2xl z-40 overflow-hidden py-1">
                                <button
                                    onClick={() => {
                                        setIsReportDropdownOpen(false);
                                        setIsReportModalOpen(true);
                                    }}
                                    className="w-full text-left px-4 py-3 hover:bg-bg-deep text-xs font-bold text-text-primary flex items-center gap-2.5 transition-colors cursor-pointer"
                                >
                                    <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                                    <span>RELATÓRIO ACOMPANHAMENTO MENSAL</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={fetchDocuments}
                        className="p-2 border border-border-subtle bg-surface hover:bg-bg-deep text-text-primary rounded-lg transition-colors cursor-pointer"
                        title="Atualizar Dados"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </header>

            {/* Seletor de Competência Mensal */}
            <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-lg">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">Competência Selecionada</span>
                        <div className="text-base font-bold text-text-primary">{formatCompetenciaLabel(currentCompetencia)}</div>
                    </div>
                </div>

                <div className="flex items-center gap-2 bg-bg-deep p-1.5 rounded-lg border border-border-subtle">
                    <button
                        onClick={() => {
                            setCurrentCompetencia('ALL');
                            setPage(1);
                        }}
                        className={`px-3 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                            currentCompetencia === 'ALL'
                                ? 'bg-brand-primary text-white shadow-sm'
                                : 'text-text-secondary hover:text-text-primary hover:bg-surface'
                        }`}
                    >
                        Todas
                    </button>

                    <div className="w-px h-4 bg-border-subtle mx-1" />

                    <button
                        onClick={() => changeCompetenciaMonth(-1)}
                        className="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        title="Mês Anterior"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>

                    <select
                        value={currentCompetencia}
                        onChange={e => {
                            setCurrentCompetencia(e.target.value);
                            setPage(1);
                        }}
                        className="bg-transparent text-xs font-bold text-text-primary px-2 py-1 focus:outline-none cursor-pointer"
                    >
                        {availableCompetencias.length === 0 ? (
                            <option value="ALL">Sem lançamentos</option>
                        ) : (
                            availableCompetencias.map(comp => (
                                <option key={comp} value={comp}>
                                    {formatCompetenciaLabel(comp)}
                                </option>
                            ))
                        )}
                    </select>

                    <button
                        onClick={() => changeCompetenciaMonth(1)}
                        className="p-1 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        title="Próximo Mês"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Cards de Indicadores Resumidos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
                <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Qtd de Notas</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{metrics.total_notes}</span>
                </div>

                <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Valor Total Notas</span>
                    <span className="text-xl font-bold text-brand-primary block mt-1">{formatCurrency(metrics.total_vNF)}</span>
                </div>

                <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Valor Produtos</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{formatCurrency(metrics.total_vProd)}</span>
                </div>

                <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Total ICMS</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{formatCurrency(metrics.total_vICMS)}</span>
                </div>

                <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Total ICMS ST</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{formatCurrency(metrics.total_vICMSST)}</span>
                </div>

                <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">Fornecedores</span>
                    <span className="text-xl font-bold text-text-primary block mt-1">{metrics.total_suppliers}</span>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-surface rounded-xl p-4 border border-border-subtle shadow-sm space-y-4">
                <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Buscar por Nº NF-e, Chave de Acesso ou Fornecedor..."
                            className="w-full bg-bg-deep border border-border-subtle rounded-lg pl-9 pr-4 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <select
                            value={selectedAplicacao}
                            onChange={e => { setSelectedAplicacao(e.target.value); setPage(1); }}
                            className="bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                        >
                            <option value="">Todas Aplicações</option>
                            {Object.entries(APLICACOES_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>

                        <select
                            value={selectedTributacao}
                            onChange={e => { setSelectedTributacao(e.target.value); setPage(1); }}
                            className="bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                        >
                            <option value="">Todas Tributações</option>
                            {Object.entries(TRIBUTACAO_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                            ))}
                        </select>

                        <select
                            value={selectedStatus}
                            onChange={e => { setSelectedStatus(e.target.value); setPage(1); }}
                            className="bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                        >
                            <option value="">Todos Status</option>
                            <option value="CLASSIFICADO">Classificado</option>
                            <option value="PENDENTE">Pendente</option>
                        </select>

                        <button
                            type="button"
                            onClick={clearFilters}
                            className="p-2 border border-border-subtle bg-bg-deep hover:bg-surface text-text-muted hover:text-text-primary rounded-lg transition-colors cursor-pointer"
                            title="Limpar Filtros"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </form>
            </div>

            {/* Main Table */}
            <div className="bg-surface rounded-xl border border-border-subtle shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-16 text-center text-text-muted flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-primary mb-2" />
                        Carregando movimentação fiscal mensal...
                    </div>
                ) : documents.length === 0 ? (
                    <div className="py-16 text-center text-text-muted space-y-3">
                        <FileText className="w-12 h-12 mx-auto text-border-subtle" />
                        <p className="text-sm font-semibold text-text-primary">Nenhuma nota fiscal encontrada para a competência {formatCompetenciaLabel(currentCompetencia)}.</p>
                        <p className="text-xs text-text-muted">Utilize o botão "Importar XMLs" para cadastrar notas ou altere o filtro para visualizar todas as competências.</p>
                        {currentCompetencia !== 'ALL' && (
                            <button
                                onClick={() => {
                                    setCurrentCompetencia('ALL');
                                    setPage(1);
                                }}
                                className="mt-2 inline-flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-brand-primary/90 transition-all cursor-pointer shadow-sm"
                            >
                                Ver Todas as Competências
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        {selectedIds.length === documents.length && metrics.total_notes > documents.length && (
                            <div className="bg-brand-primary/10 border border-brand-primary/30 rounded-lg p-3 mx-4 mt-3 flex items-center justify-between text-xs text-text-primary">
                                <span>
                                    {selectAllMatching ? (
                                        <>Todas as <strong>{metrics.total_notes}</strong> notas desta competência estão selecionadas para classificação em lote.</>
                                    ) : (
                                        <>Você selecionou <strong>{documents.length}</strong> notas desta página. Deseja selecionar todas as <strong>{metrics.total_notes}</strong> notas da competência?</>
                                    )}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setSelectAllMatching(prev => !prev)}
                                    className="font-bold text-brand-primary underline hover:text-brand-primary/80 cursor-pointer ml-4 whitespace-nowrap"
                                >
                                    {selectAllMatching ? 'Limpar Seleção Global' : `Selecionar todas as ${metrics.total_notes} notas`}
                                </button>
                            </div>
                        )}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-bg-deep border-b border-border-subtle text-xs text-text-muted uppercase font-semibold">
                                    <tr className="text-[11px]">
                                        <th className="px-3 py-3 w-8 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.length === documents.length && documents.length > 0}
                                                onChange={handleSelectAll}
                                                className="rounded text-brand-primary focus:ring-brand-primary"
                                            />
                                        </th>
                                        <th className="px-3 py-3 whitespace-nowrap">Nº NF / Chave</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Aplicação / Tributação</th>
                                        <th className="px-3 py-3 text-center whitespace-nowrap">Série</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Nat. Operação</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Protocolo / Autorização</th>
                                        <th className="px-3 py-3 whitespace-nowrap">Fornecedor (Origem / CNPJ / I.E)</th>
                                        <th className="px-3 py-3 text-right whitespace-nowrap">Base ICMS</th>
                                        <th className="px-3 py-3 text-right whitespace-nowrap">Valor ICMS</th>
                                        <th className="px-3 py-3 text-right whitespace-nowrap">Base ST</th>
                                        <th className="px-3 py-3 text-right whitespace-nowrap">ICMS ST</th>
                                        <th className="px-3 py-3 text-right whitespace-nowrap">Valor Prod</th>
                                        <th className="px-3 py-3 text-right whitespace-nowrap">Frete</th>
                                        <th className="px-3 py-3 text-right whitespace-nowrap">Valor NF-e</th>
                                        <th className="px-3 py-3 text-center whitespace-nowrap">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border-subtle text-[11px]">
                                    {documents.map(doc => {
                                        const isSelected = selectedIds.includes(doc.id);
                                        return (
                                            <tr key={doc.id} className={`hover:bg-bg-deep/40 transition-colors ${isSelected ? 'bg-brand-primary/5' : ''}`}>
                                                <td className="px-3 py-3 text-center">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleSelectId(doc.id)}
                                                        className="rounded text-brand-primary focus:ring-brand-primary"
                                                    />
                                                </td>
                                                {/* 1. Numero da Nota fiscal Com a Chave de acesso na mesma linha como tag */}
                                                <td className="px-3 py-3 font-mono">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="font-bold text-text-primary text-xs">Nº {doc.nNF || '-'}</span>
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-bg-deep border border-border-subtle text-text-muted font-mono font-medium whitespace-nowrap inline-block tracking-tighter select-all" title={doc.access_key}>
                                                            {doc.access_key}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* 2. Aplicação e Tributação na mesma linha e coluna */}
                                                <td className="px-3 py-3">
                                                    <div className="flex flex-col gap-1">
                                                        <span className="font-semibold text-text-primary">
                                                            {formatAplicacaoLabel(doc.aplicacao)}
                                                        </span>
                                                        <span className="inline-self-start text-[10px] font-bold text-brand-primary bg-brand-primary/10 px-1.5 py-0.5 rounded border border-brand-primary/20">
                                                            {formatTributacaoLabel(doc.tipo_tributacao)}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* 3. Serie da nota */}
                                                <td className="px-3 py-3 text-center font-bold text-text-secondary">
                                                    {doc.serie || '1'}
                                                </td>
                                                {/* 4. Natureza da operação */}
                                                <td className="px-3 py-3 text-text-secondary break-words whitespace-normal min-w-[120px]" title={doc.natOp || ''}>
                                                    {doc.natOp || '-'}
                                                </td>
                                                {/* 5. Numero de protocolo com A Dta hora da autorização e situação como TAG na mesma linha */}
                                                <td className="px-3 py-3">
                                                    <div className="flex items-center gap-1.5 flex-wrap font-mono">
                                                        <span className="font-semibold text-text-primary">{doc.nProt || '-'}</span>
                                                        {doc.dhRecbto && (
                                                            <span className="text-[10px] text-text-muted">
                                                                {new Date(doc.dhRecbto).toLocaleString('pt-BR')}
                                                            </span>
                                                        )}
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                                            doc.cStat === '100' || !doc.cStat
                                                                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                                                                : doc.cStat === '101'
                                                                ? 'bg-red-500/10 text-red-600 border-red-500/20'
                                                                : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                        }`}>
                                                            {doc.cStat ? `${doc.cStat} - ${doc.xMotivo || 'Autorizado'}` : 'Autorizada'}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* 6. Nome do fornecedor com o Estado de Origen, CNPJ e I.E como TAG na mesma linha */}
                                                <td className="px-3 py-3">
                                                    <div className="font-bold text-text-primary">{doc.issuer_name || '-'}</div>
                                                    <div className="flex items-center gap-1 mt-1 flex-wrap font-mono text-[10px]">
                                                        <span className="px-1.5 py-0.5 rounded font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                                                            {doc.uf_emit || 'UF'}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded bg-bg-deep text-text-muted border border-border-subtle">
                                                            {doc.issuer_cnpj || '-'}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 border border-purple-500/20">
                                                            IE: {doc.issuer_ie || 'ISENTO/N/I'}
                                                        </span>
                                                    </div>
                                                </td>
                                                {/* 7. Valor total base de cálculo da nota fiscal */}
                                                <td className="px-3 py-3 text-right font-mono text-text-secondary">
                                                    {formatCurrency(doc.vBC)}
                                                </td>
                                                {/* 8. Valor de ICMS */}
                                                <td className="px-3 py-3 text-right font-mono text-text-secondary">
                                                    {formatCurrency(doc.vICMS)}
                                                </td>
                                                {/* 9. Valor total base ST (quando a nota atender trazer no XML a informação de ICMS ST) */}
                                                <td className="px-3 py-3 text-right font-mono text-text-secondary">
                                                    {doc.vBCST ? formatCurrency(doc.vBCST) : '-'}
                                                </td>
                                                {/* 10. Valor total icms ST (quando a nota atender trazer no XML a informação de ICMS ST) */}
                                                <td className="px-3 py-3 text-right font-mono text-text-secondary">
                                                    {doc.vICMSST ? formatCurrency(doc.vICMSST) : '-'}
                                                </td>
                                                {/* 11. Valor total de Produtos */}
                                                <td className="px-3 py-3 text-right font-mono text-text-secondary">
                                                    {formatCurrency(doc.vProd)}
                                                </td>
                                                {/* 12. Valor total de Frete (quando tiver informação no XML) */}
                                                <td className="px-3 py-3 text-right font-mono text-text-secondary">
                                                    {doc.vFrete ? formatCurrency(doc.vFrete) : '-'}
                                                </td>
                                                {/* 13. Valor total Nota fiscal */}
                                                <td className="px-3 py-3 text-right font-mono font-bold text-text-primary text-xs">
                                                    {formatCurrency(doc.vNF)}
                                                </td>
                                                <td className="px-3 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            onClick={() => navigate(`/fiscal/acompanhamento-nfe/${doc.id}`)}
                                                            className="p-1.5 rounded hover:bg-bg-deep text-text-muted hover:text-brand-primary transition-colors cursor-pointer"
                                                            title="Visualizar Detalhes"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(doc.id)}
                                                            className="p-1.5 rounded hover:bg-bg-deep text-text-muted hover:text-brand-danger transition-colors cursor-pointer"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="p-4 border-t border-border-subtle bg-bg-deep flex items-center justify-between text-xs text-text-muted">
                            <div>
                                Exibindo página <strong className="text-text-primary">{page}</strong> de <strong className="text-text-primary">{totalPages}</strong>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    disabled={page === 1}
                                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                                    className="p-1.5 rounded border border-border-subtle bg-surface hover:bg-bg-deep disabled:opacity-40 text-text-primary cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <button
                                    disabled={page >= totalPages}
                                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                                    className="p-1.5 rounded border border-border-subtle bg-surface hover:bg-bg-deep disabled:opacity-40 text-text-primary cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Modals */}
            <NfeBatchImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onImportSuccess={() => {
                    setCurrentCompetencia('ALL');
                    setPage(1);
                    fetchDocuments();
                    setSelectedIds([]);
                }}
            />

            <NfeBatchClassifyModal
                isOpen={isClassifyModalOpen}
                selectedIds={selectedIds}
                selectAllMatching={selectAllMatching}
                totalMatchingCount={metrics.total_notes}
                filterParams={{
                    competencia: currentCompetencia,
                    search: searchTerm,
                    aplicacao: selectedAplicacao,
                    tipo_tributacao: selectedTributacao,
                    status_classificacao: selectedStatus,
                    uf_emit: selectedUf,
                    divergencia_flag: onlyDivergences
                }}
                onClose={() => setIsClassifyModalOpen(false)}
                onSuccess={() => {
                    fetchDocuments();
                    setSelectedIds([]);
                    setSelectAllMatching(false);
                }}
            />

            <NfeMonthlyReportPrintModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                currentCompetencia={currentCompetencia}
            />
        </div>
    );
};

export default NfeMonthlyTrackerList;

