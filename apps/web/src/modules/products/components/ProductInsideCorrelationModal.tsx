import React, { useEffect, useState } from 'react';
import {
    Boxes,
    X,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Link2,
    Search,
    ArrowRight,
    Loader2,
    Sparkles,
    Check,
    PackagePlus,
    CheckSquare,
    Square
} from 'lucide-react';
import { insideIntegrationApi } from '../../../services/insideIntegrationApi';

interface CorrelationModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId: string;
    onSuccess?: () => void;
}

const formatCurrency = (val?: number | null) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
};

const formatNumber = (val?: number | null) => {
    if (val === undefined || val === null) return '-';
    return new Intl.NumberFormat('pt-BR').format(val);
};

export const ProductInsideCorrelationModal: React.FC<CorrelationModalProps> = ({
    isOpen,
    onClose,
    companyId,
    onSuccess
}) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [selectedTier, setSelectedTier] = useState<string>('ALL');
    const [filterStockOnly, setFilterStockOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [linkingId, setLinkingId] = useState<string | null>(null);
    const [autoLinking, setAutoLinking] = useState(false);
    const [batchLinking, setBatchLinking] = useState(false);
    const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
    const [importingCod, setImportingCod] = useState<number | null>(null);
    const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    const fetchData = async () => {
        if (!companyId) return;
        setLoading(true);
        setFeedbackMsg(null);
        try {
            const res = await insideIntegrationApi.getCorrelationAnalysis(companyId, filterStockOnly);
            setData(res);
            setSelectedKeys(new Set());
        } catch (err: any) {
            console.error('Erro ao carregar análise de correlação:', err);
            setFeedbackMsg({
                type: 'error',
                text: err.response?.data?.detail || 'Erro ao consultar análise de estoque no Inside ERP.'
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen, companyId, filterStockOnly]);

    if (!isOpen) return null;

    const getItemKey = (item: any): string => {
        return `${item.inside?.codProduto}_${item.suggested_product?.id || 'none'}`;
    };

    const handleAutoLinkExact = async () => {
        setAutoLinking(true);
        setFeedbackMsg(null);
        try {
            const res = await insideIntegrationApi.autoLinkExact(companyId);
            setFeedbackMsg({ type: 'success', text: res.message });
            fetchData();
            if (onSuccess) onSuccess();
        } catch (err: any) {
            setFeedbackMsg({
                type: 'error',
                text: err.response?.data?.detail || 'Erro ao executar vínculo automático.'
            });
        } finally {
            setAutoLinking(false);
        }
    };

    const handleBatchLinkSelected = async () => {
        const toLink: Array<{ product_id: string; cod_produto: number }> = [];
        items.forEach((item: any) => {
            const key = getItemKey(item);
            if (selectedKeys.has(key) && item.suggested_product?.id) {
                const codProd = parseInt(String(item.inside?.codProduto), 10);
                if (!isNaN(codProd)) {
                    toLink.push({ product_id: item.suggested_product.id, cod_produto: codProd });
                }
            }
        });

        if (toLink.length === 0) return;

        setBatchLinking(true);
        setFeedbackMsg(null);
        try {
            const res = await insideIntegrationApi.batchLinkProducts(companyId, toLink);
            setFeedbackMsg({ type: 'success', text: res.message });
            setSelectedKeys(new Set());
            fetchData();
            if (onSuccess) onSuccess();
        } catch (err: any) {
            setFeedbackMsg({
                type: 'error',
                text: err.response?.data?.detail || 'Erro ao vincular produtos em lote.'
            });
        } finally {
            setBatchLinking(false);
        }
    };

    const handleLinkSingle = async (item: any) => {
        const prodId = item.suggested_product?.id;
        const codProd = parseInt(String(item.inside?.codProduto), 10);
        if (!prodId || isNaN(codProd)) return;

        setLinkingId(prodId);
        setFeedbackMsg(null);
        try {
            await insideIntegrationApi.linkProductManually(companyId, prodId, codProd);
            setFeedbackMsg({
                type: 'success',
                text: `Produto '${item.suggested_product.nome}' vinculado ao código Inside #${codProd} com sucesso!`
            });
            fetchData();
            if (onSuccess) onSuccess();
        } catch (err: any) {
            setFeedbackMsg({
                type: 'error',
                text: err.response?.data?.detail || 'Erro ao vincular produto.'
            });
        } finally {
            setLinkingId(null);
        }
    };

    const handleImportSingle = async (codProduto: number) => {
        setImportingCod(codProduto);
        setFeedbackMsg(null);
        try {
            const res = await insideIntegrationApi.importProductFromInside(companyId, codProduto);
            setFeedbackMsg({
                type: 'success',
                text: `Produto '${res.nome}' importado e vinculado com SKU ${res.codigo}!`
            });
            fetchData();
            if (onSuccess) onSuccess();
        } catch (err: any) {
            setFeedbackMsg({
                type: 'error',
                text: err.response?.data?.detail || 'Erro ao importar produto do Inside.'
            });
        } finally {
            setImportingCod(null);
        }
    };

    const items = data?.items || [];
    const summary = data?.summary || {
        total_inside: 0,
        linked_count: 0,
        exact_match_count: 0,
        high_similarity_count: 0,
        medium_similarity_count: 0,
        low_similarity_count: 0,
        unmatched_count: 0
    };

    const filteredItems = items.filter((item: any) => {
        // Filter by tier
        if (selectedTier === 'LINKED' && item.tier !== 'LINKED') return false;
        if (selectedTier === 'EXACT_MATCH' && item.tier !== 'EXACT_MATCH') return false;
        if (selectedTier === 'HIGH' && item.tier !== 'HIGH_SIMILARITY') return false;
        if (selectedTier === 'MEDIUM' && item.tier !== 'MEDIUM_SIMILARITY') return false;
        if (selectedTier === 'LOW' && item.tier !== 'LOW_SIMILARITY') return false;
        if (selectedTier === 'UNMATCHED' && item.tier !== 'UNMATCHED') return false;
        if (selectedTier === 'SIMILAR_25_80' && !['HIGH_SIMILARITY', 'MEDIUM_SIMILARITY', 'LOW_SIMILARITY'].includes(item.tier)) return false;

        // Filter by search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const descInside = (item.inside?.descricao || '').toLowerCase();
            const codInside = String(item.inside?.codProduto || '');
            const nomeCerberus = (item.suggested_product?.nome || '').toLowerCase();
            const skuCerberus = (item.suggested_product?.codigo || '').toLowerCase();
            const pnCerberus = (item.suggested_product?.part_number || '').toLowerCase();
            return descInside.includes(q) || codInside.includes(q) || nomeCerberus.includes(q) || skuCerberus.includes(q) || pnCerberus.includes(q);
        }

        return true;
    });

    const eligibleFilteredItems = filteredItems.filter(
        (item: any) => item.tier !== 'LINKED' && !item.is_linked && item.suggested_product?.id
    );

    const isAllEligibleSelected =
        eligibleFilteredItems.length > 0 &&
        eligibleFilteredItems.every((item: any) => selectedKeys.has(getItemKey(item)));

    const toggleSelectAllEligible = () => {
        const next = new Set(selectedKeys);
        if (isAllEligibleSelected) {
            eligibleFilteredItems.forEach((item: any) => next.delete(getItemKey(item)));
        } else {
            eligibleFilteredItems.forEach((item: any) => next.add(getItemKey(item)));
        }
        setSelectedKeys(next);
    };

    const toggleSelectItem = (item: any) => {
        if (item.tier === 'LINKED' || item.is_linked || !item.suggested_product?.id) return;
        const key = getItemKey(item);
        const next = new Set(selectedKeys);
        if (next.has(key)) {
            next.delete(key);
        } else {
            next.add(key);
        }
        setSelectedKeys(next);
    };

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-2 sm:p-4 lg:p-6 animate-in fade-in duration-200">
            <div className="bg-surface border border-border-subtle rounded-3xl max-w-7xl w-full max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
                {/* Header Superior */}
                <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border-subtle bg-bg-deep/40">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                            <Boxes className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-base sm:text-lg font-bold text-text-primary">
                                    Conciliação &amp; Vínculo de Produtos (Inside ERP)
                                </h3>
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                                    Estoque Novos
                                </span>
                            </div>
                            <p className="text-xs text-text-muted mt-0.5">
                                Correlacione os itens físicos do almoxarifado do ERP com a base de produtos do Cerberus para sincronizar estoques e custos em tempo real.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={fetchData}
                            disabled={loading || batchLinking || autoLinking}
                            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface border border-border-subtle transition-colors cursor-pointer"
                            title="Recarregar Análise"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-500' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-surface border border-border-subtle transition-colors cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Feedback Toast */}
                {feedbackMsg && (
                    <div
                        className={`mx-6 mt-4 p-3.5 rounded-2xl flex items-center justify-between text-xs border ${
                            feedbackMsg.type === 'success'
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                                : 'bg-brand-danger/10 border-brand-danger/30 text-brand-danger'
                        }`}
                    >
                        <span className="flex items-center gap-2 font-semibold">
                            {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                            {feedbackMsg.text}
                        </span>
                        <button
                            type="button"
                            onClick={() => setFeedbackMsg(null)}
                            className="font-bold underline cursor-pointer ml-4"
                        >
                            Fechar
                        </button>
                    </div>
                )}

                {/* Cards de Resumo Estatístico */}
                <div className="px-5 sm:px-6 py-3.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 bg-bg-deep/20 border-b border-border-subtle">
                    <button
                        type="button"
                        onClick={() => setSelectedTier('ALL')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            selectedTier === 'ALL'
                                ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 shadow-xs'
                                : 'bg-surface border-border-subtle text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <span className="text-[10px] font-bold uppercase block">Total ERP</span>
                        <span className="text-base font-bold font-mono">{summary.total_inside}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedTier('LINKED')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            selectedTier === 'LINKED'
                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 shadow-xs'
                                : 'bg-surface border-border-subtle text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <span className="text-[10px] font-bold uppercase block text-emerald-600 dark:text-emerald-400">Vinculados</span>
                        <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">{summary.linked_count}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedTier('EXACT_MATCH')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            selectedTier === 'EXACT_MATCH'
                                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-600 dark:text-indigo-400 shadow-xs'
                                : 'bg-surface border-border-subtle text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <span className="text-[10px] font-bold uppercase block text-indigo-600 dark:text-indigo-400">Match 100%</span>
                        <span className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">{summary.exact_match_count}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedTier('HIGH')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            selectedTier === 'HIGH'
                                ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-xs'
                                : 'bg-surface border-border-subtle text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <span className="text-[10px] font-bold uppercase block text-blue-600 dark:text-blue-400">Alta (80-99%)</span>
                        <span className="text-base font-bold font-mono text-blue-600 dark:text-blue-400">{summary.high_similarity_count}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedTier('MEDIUM')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            selectedTier === 'MEDIUM'
                                ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 shadow-xs'
                                : 'bg-surface border-border-subtle text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <span className="text-[10px] font-bold uppercase block text-amber-600 dark:text-amber-400">Média (50-79%)</span>
                        <span className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">{summary.medium_similarity_count}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedTier('LOW')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            selectedTier === 'LOW'
                                ? 'bg-orange-500/15 border-orange-500/40 text-orange-600 dark:text-orange-400 shadow-xs'
                                : 'bg-surface border-border-subtle text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <span className="text-[10px] font-bold uppercase block text-orange-600 dark:text-orange-400">Baixa (25-49%)</span>
                        <span className="text-base font-bold font-mono text-orange-600 dark:text-orange-400">{summary.low_similarity_count}</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setSelectedTier('UNMATCHED')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                            selectedTier === 'UNMATCHED'
                                ? 'bg-gray-500/15 border-gray-500/40 text-text-primary shadow-xs'
                                : 'bg-surface border-border-subtle text-text-muted hover:text-text-primary'
                        }`}
                    >
                        <span className="text-[10px] font-bold uppercase block">Sem Vínculo</span>
                        <span className="text-base font-bold font-mono">{summary.unmatched_count}</span>
                    </button>
                </div>

                {/* Barra de Filtros e Ação em Lote */}
                <div className="p-3.5 px-5 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-border-subtle bg-surface/50">
                    <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:w-72">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Filtrar por nome, SKU, PN ou código..."
                                className="w-full pl-9 pr-4 py-2 bg-bg-deep border border-border-subtle rounded-xl text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-cyan-500"
                            />
                        </div>

                        <label className="flex items-center gap-2 text-xs font-medium text-text-primary cursor-pointer shrink-0">
                            <input
                                type="checkbox"
                                checked={filterStockOnly}
                                onChange={(e) => setFilterStockOnly(e.target.checked)}
                                className="rounded text-cyan-600 focus:ring-0 cursor-pointer"
                            />
                            Apenas com Saldo &gt; 0
                        </label>

                        {eligibleFilteredItems.length > 0 && (
                            <button
                                type="button"
                                onClick={toggleSelectAllEligible}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-surface border border-border-subtle hover:bg-bg-deep text-text-primary transition-all cursor-pointer"
                                title="Marcar ou desmarcar todos os itens elegíveis na listagem atual"
                            >
                                {isAllEligibleSelected ? (
                                    <>
                                        <CheckSquare className="w-4 h-4 text-brand-primary" />
                                        <span>Desmarcar Todos ({eligibleFilteredItems.length})</span>
                                    </>
                                ) : (
                                    <>
                                        <Square className="w-4 h-4 text-text-muted" />
                                        <span>Selecionar Todos ({eligibleFilteredItems.length})</span>
                                    </>
                                )}
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        {summary.exact_match_count > 0 && (
                            <button
                                type="button"
                                onClick={handleAutoLinkExact}
                                disabled={autoLinking || batchLinking || loading}
                                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm shadow-emerald-600/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {autoLinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                Vincular Match 100% ({summary.exact_match_count})
                            </button>
                        )}
                    </div>
                </div>

                {/* Banner de Ação em Lote Flutuante / Fixo */}
                {selectedKeys.size > 0 && (
                    <div className="bg-brand-primary/10 border-b border-brand-primary/20 px-6 py-2.5 flex items-center justify-between animate-in slide-in-from-top-2 duration-150">
                        <div className="flex items-center gap-2 text-xs font-bold text-brand-primary">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{selectedKeys.size} item(ns) selecionado(s) para vinculação</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedKeys(new Set())}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                            >
                                Cancelar Seleção
                            </button>
                            <button
                                type="button"
                                onClick={handleBatchLinkSelected}
                                disabled={batchLinking || loading}
                                className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-bold bg-brand-primary text-white hover:bg-brand-primary/90 shadow-md shadow-brand-primary/20 transition-all cursor-pointer disabled:opacity-50"
                            >
                                {batchLinking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                                Vincular Selecionados ({selectedKeys.size})
                            </button>
                        </div>
                    </div>
                )}

                {/* Tabela de Itens com Visualização Ampla e Sem Cortes */}
                <div className="overflow-y-auto flex-1 p-4 sm:p-6 bg-bg-deep/10">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-20 text-text-muted">
                            <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mb-2" />
                            <span className="text-xs font-medium">Analisando similaridades com o Inside ERP...</span>
                        </div>
                    ) : filteredItems.length === 0 ? (
                        <div className="text-center py-16 bg-bg-deep/40 rounded-2xl border border-dashed border-border-subtle">
                            <Boxes className="w-10 h-10 text-text-muted mx-auto mb-2 opacity-50" />
                            <p className="text-xs font-semibold text-text-primary">Nenhum produto encontrado com os filtros selecionados.</p>
                            <p className="text-[11px] text-text-muted mt-0.5">Tente alterar os termos de busca ou mudar a faixa de similaridade.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {filteredItems.map((item: any, idx: number) => {
                                const isLinked = item.tier === 'LINKED' || item.is_linked;
                                const isExact = item.tier === 'EXACT_MATCH';
                                const isHigh = item.tier === 'HIGH_SIMILARITY';
                                const isMedium = item.tier === 'MEDIUM_SIMILARITY';
                                const isLow = item.tier === 'LOW_SIMILARITY';

                                const ratioPct = (item.similarity_ratio * 100).toFixed(1);
                                const itemKey = getItemKey(item);
                                const isSelected = selectedKeys.has(itemKey);
                                const canSelect = !isLinked && item.suggested_product?.id;

                                return (
                                    <div
                                        key={`${item.inside?.codProduto}-${idx}`}
                                        onClick={() => canSelect && toggleSelectItem(item)}
                                        className={`p-4 rounded-2xl border transition-all ${
                                            isSelected
                                                ? 'bg-brand-primary/10 border-brand-primary/60 ring-2 ring-brand-primary/20 shadow-sm'
                                                : isLinked
                                                ? 'bg-emerald-500/5 border-emerald-500/25'
                                                : isExact
                                                ? 'bg-indigo-500/5 border-indigo-500/25 hover:border-indigo-500/50'
                                                : isHigh
                                                ? 'bg-blue-500/5 border-blue-500/25 hover:border-blue-500/50'
                                                : isMedium
                                                ? 'bg-amber-500/5 border-amber-500/25 hover:border-amber-500/50'
                                                : 'bg-surface border-border-subtle hover:border-border-strong'
                                        } ${canSelect ? 'cursor-pointer' : ''}`}
                                    >
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                            {/* Coluna 1: Checkbox + Item Inside ERP */}
                                            <div className="flex-1 flex items-start gap-3 min-w-0">
                                                {/* Checkbox de seleção */}
                                                <div className="pt-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                    {canSelect ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleSelectItem(item)}
                                                            className="p-0.5 rounded text-text-muted hover:text-brand-primary transition-colors cursor-pointer"
                                                            title={isSelected ? "Desmarcar para vincular" : "Marcar para vincular em lote"}
                                                        >
                                                            {isSelected ? (
                                                                <CheckSquare className="w-5 h-5 text-brand-primary" />
                                                            ) : (
                                                                <Square className="w-5 h-5 text-border-strong hover:text-text-primary" />
                                                            )}
                                                        </button>
                                                    ) : isLinked ? (
                                                        <div className="w-5 h-5 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                                                            <Check className="w-4 h-4" />
                                                        </div>
                                                    ) : (
                                                        <div className="w-5 h-5" />
                                                    )}
                                                </div>

                                                {/* Informações Inside ERP com Nome Inteiro */}
                                                <div className="flex-1 space-y-1.5 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-bg-deep text-text-muted border border-border-subtle shrink-0">
                                                            ERP #{item.inside?.codProduto}
                                                        </span>
                                                        <span
                                                            className="text-xs font-bold text-text-primary leading-relaxed break-words"
                                                            title={item.inside?.descricao}
                                                        >
                                                            {item.inside?.descricao}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center gap-3 text-[11px] text-text-muted pt-0.5 flex-wrap">
                                                        <span className="bg-surface px-2 py-0.5 rounded border border-border-subtle">
                                                            Saldo: <b className="font-mono text-emerald-600 dark:text-emerald-400">{formatNumber(item.inside?.saldo)}</b>
                                                        </span>
                                                        <span className="bg-surface px-2 py-0.5 rounded border border-border-subtle">
                                                            Custo Médio: <b className="font-mono text-amber-600 dark:text-amber-400">{formatCurrency(item.inside?.custo)}</b>
                                                        </span>
                                                        <span className="bg-surface px-2 py-0.5 rounded border border-border-subtle">
                                                            Tabela: <b className="font-mono text-text-primary">{formatCurrency(item.inside?.preco)}</b>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Coluna 2: Indicador Central de Similaridade / Vínculo */}
                                            <div className="flex items-center gap-2 shrink-0 justify-center px-2">
                                                {isLinked ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                        <Check className="w-3.5 h-3.5" /> Vinculado
                                                    </span>
                                                ) : isExact ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                                                        <Sparkles className="w-3.5 h-3.5" /> Match Exato (100%)
                                                    </span>
                                                ) : isHigh ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                                                        {ratioPct}% Similar
                                                    </span>
                                                ) : isMedium ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                        {ratioPct}% Similar
                                                    </span>
                                                ) : isLow ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                                                        {ratioPct}% Similar
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-gray-500/15 text-text-muted border border-border-subtle">
                                                        Sem Vínculo
                                                    </span>
                                                )}
                                                <ArrowRight className="w-4 h-4 text-text-muted hidden lg:block" />
                                            </div>

                                            {/* Coluna 3: Produto Cerberus com Nome Completo + Botões de Ação */}
                                            <div className="flex-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-w-0" onClick={(e) => e.stopPropagation()}>
                                                {item.suggested_product ? (
                                                    <div className="space-y-1 min-w-0 flex-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shrink-0">
                                                                {item.suggested_product.codigo}
                                                            </span>
                                                            <span
                                                                className="text-xs font-bold text-text-primary leading-relaxed break-words"
                                                                title={item.suggested_product.nome}
                                                            >
                                                                {item.suggested_product.nome}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-[10px] text-text-muted flex-wrap">
                                                            <span className="bg-bg-deep px-1.5 py-0.5 rounded border border-border-subtle">
                                                                {item.suggested_product.categoria || 'Sem categoria'}
                                                            </span>
                                                            {item.suggested_product.part_number && (
                                                                <span className="bg-bg-deep px-1.5 py-0.5 rounded border border-border-subtle font-mono">
                                                                    PN: {item.suggested_product.part_number}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="text-xs text-text-muted italic flex-1 py-1">
                                                        Nenhum produto correspondente cadastrado no Cerberus
                                                    </div>
                                                )}

                                                {/* Ações individuais */}
                                                <div className="flex items-center gap-2 shrink-0 justify-end">
                                                    {!isLinked && item.suggested_product && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleLinkSingle(item)}
                                                            disabled={linkingId === item.suggested_product.id || batchLinking}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-brand-primary text-white hover:bg-brand-primary/90 shadow-xs cursor-pointer transition-all disabled:opacity-50"
                                                            title={`Vincular #${item.inside?.codProduto} a ${item.suggested_product?.nome}`}
                                                        >
                                                            {linkingId === item.suggested_product.id ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <Link2 className="w-3.5 h-3.5" />
                                                            )}
                                                            Vincular
                                                        </button>
                                                    )}

                                                    {!isLinked && !item.suggested_product && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleImportSingle(parseInt(item.inside.codProduto, 10))}
                                                            disabled={importingCod === parseInt(item.inside.codProduto, 10) || batchLinking}
                                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-xs cursor-pointer transition-all disabled:opacity-50"
                                                            title={`Criar novo produto no Cerberus a partir de #${item.inside?.codProduto}`}
                                                        >
                                                            {importingCod === parseInt(item.inside.codProduto, 10) ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                            ) : (
                                                                <PackagePlus className="w-3.5 h-3.5" />
                                                            )}
                                                            Importar p/ Cerberus
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Modal */}
                <div className="p-4 px-6 border-t border-border-subtle bg-bg-deep/40 flex items-center justify-between">
                    <p className="text-[11px] text-text-muted">
                        Exibindo <b className="text-text-primary">{filteredItems.length}</b> de <b className="text-text-primary">{items.length}</b> produtos do estoque de Novos.
                    </p>
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2 rounded-xl text-xs font-bold bg-surface border border-border-subtle hover:bg-bg-deep text-text-primary transition-colors cursor-pointer"
                    >
                        Fechar
                    </button>
                </div>
            </div>
        </div>
    );
};
