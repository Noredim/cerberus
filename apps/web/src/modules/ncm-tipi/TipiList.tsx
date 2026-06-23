import React, { useEffect, useState } from 'react';
import {
    Search,
    Loader2,
    UploadCloud,
    Calendar,
    ChevronLeft,
    ChevronRight,
    History,
    Percent,
    Database
} from 'lucide-react';
import { tipiApi } from './api/tipiApi';
import type { TipiImportacao, NcmTipi } from './types';
import { TipiImportModal } from './components/TipiImportModal';

export const TipiList: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'importacoes' | 'valores'>('importacoes');
    
    // Importações State
    const [importacoes, setImportacoes] = useState<TipiImportacao[]>([]);
    const [totalImports, setTotalImports] = useState(0);
    const [skipImports, setSkipImports] = useState(0);
    const [loadingImports, setLoadingImports] = useState(true);

    // Valores State
    const [valores, setValores] = useState<NcmTipi[]>([]);
    const [totalValores, setTotalValores] = useState(0);
    const [skipValores, setSkipValores] = useState(0);
    const [loadingValores, setLoadingValores] = useState(true);
    const [codigoFilter, setCodigoFilter] = useState('');

    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const limit = 20;

    const fetchImportacoes = async () => {
        setLoadingImports(true);
        try {
            const data = await tipiApi.listImportacoes(skipImports, limit);
            setImportacoes(data.items);
            setTotalImports(data.total);
        } catch (error) {
            console.error('Erro ao buscar importações TIPI:', error);
        } finally {
            setLoadingImports(false);
        }
    };

    const fetchValores = async () => {
        setLoadingValores(true);
        try {
            const data = await tipiApi.listValores(skipValores, limit, codigoFilter);
            setValores(data.items);
            setTotalValores(data.total);
        } catch (error) {
            console.error('Erro ao buscar alíquotas TIPI:', error);
        } finally {
            setLoadingValores(false);
        }
    };

    useEffect(() => {
        if (activeTab === 'importacoes') {
            fetchImportacoes();
        } else {
            fetchValores();
        }
    }, [activeTab, skipImports, skipValores, codigoFilter]);

    const handleImportSuccess = () => {
        setIsImportModalOpen(false);
        setSkipImports(0);
        setSkipValores(0);
        if (activeTab === 'importacoes') {
            fetchImportacoes();
        } else {
            fetchValores();
        }
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '-';
        // Handle timezone shift for display
        const dateObj = new Date(dateStr);
        return new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
    };

    const formatDateTime = (dateTimeStr: string) => {
        if (!dateTimeStr) return '-';
        return new Date(dateTimeStr).toLocaleString('pt-BR');
    };

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                        Tabela <span className="text-brand-primary">TIPI</span>
                    </h1>
                    <p className="text-text-muted mt-1">
                        Gerencie as alíquotas do IPI associadas à Nomenclatura Comum do Mercosul (NCM).
                    </p>
                </div>

                <div>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-lg font-bold hover:bg-brand-primary/90 transition-all cursor-pointer shadow-sm"
                    >
                        <UploadCloud className="w-5 h-5" />
                        Importar Planilha TIPI
                    </button>
                </div>
            </header>

            {/* Tabs */}
            <div className="border-b border-border-subtle flex gap-4">
                <button
                    onClick={() => { setActiveTab('importacoes'); }}
                    className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 cursor-pointer ${
                        activeTab === 'importacoes'
                            ? 'border-brand-primary text-brand-primary'
                            : 'border-transparent text-text-muted hover:text-text-primary'
                    }`}
                >
                    <History className="w-4 h-4" />
                    Histórico de Importações
                </button>
                <button
                    onClick={() => { setActiveTab('valores'); }}
                    className={`flex items-center gap-2 px-4 py-3 font-semibold text-sm transition-all border-b-2 cursor-pointer ${
                        activeTab === 'valores'
                            ? 'border-brand-primary text-brand-primary'
                            : 'border-transparent text-text-muted hover:text-text-primary'
                    }`}
                >
                    <Percent className="w-4 h-4" />
                    Alíquotas por NCM
                </button>
            </div>

            {activeTab === 'importacoes' ? (
                /* Tab 1: Histórico de Importações */
                <div className="bg-surface rounded-xl border border-border-subtle shadow-sm flex flex-col">
                    <div className="min-h-[300px] overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#f8f9fa] dark:bg-bg-deep border-b border-border-subtle">
                                <tr className="text-xs text-text-muted uppercase tracking-wider">
                                    <th className="px-6 py-3 font-semibold">Arquivo</th>
                                    <th className="px-6 py-3 font-semibold">Vigência</th>
                                    <th className="px-6 py-3 font-semibold text-center">Status</th>
                                    <th className="px-6 py-3 font-semibold text-center">Importados</th>
                                    <th className="px-6 py-3 font-semibold text-center">Ignorados</th>
                                    <th className="px-6 py-3 font-semibold text-center">Erros</th>
                                    <th className="px-6 py-3 font-semibold text-right">Data de Processamento</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {loadingImports ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                                                <p className="text-sm text-text-muted">Carregando histórico...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : importacoes.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Database className="w-12 h-12 text-text-muted/30" />
                                                <p className="text-text-muted font-medium">Nenhuma importação encontrada.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    importacoes.map((imp) => (
                                        <tr key={imp.id} className="hover:bg-bg-deep/30 transition-colors">
                                            <td className="px-6 py-4 font-medium text-text-primary">
                                                {imp.arquivo_nome}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-text-primary font-mono">
                                                {formatDate(imp.vigencia)}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-full ${
                                                    imp.status === 'CONCLUIDO'
                                                        ? 'bg-green-500/10 text-green-600'
                                                        : imp.status === 'PROCESSANDO'
                                                        ? 'bg-blue-500/10 text-blue-600'
                                                        : 'bg-red-500/10 text-red-600'
                                                }`}>
                                                    {imp.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm font-semibold text-green-600">
                                                {imp.total_importados}
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm font-semibold text-yellow-600">
                                                {imp.total_ignorados}
                                            </td>
                                            <td className="px-6 py-4 text-center text-sm font-semibold text-red-600">
                                                {imp.total_erros}
                                            </td>
                                            <td className="px-6 py-4 text-right text-xs text-text-muted">
                                                {formatDateTime(imp.created_at)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-border-subtle flex items-center justify-between text-sm text-text-muted bg-surface/50 rounded-b-lg">
                        <p>
                            Mostrando <span className="font-semibold text-text-primary">{importacoes.length}</span> de{' '}
                            <span className="font-semibold text-text-primary">{totalImports}</span> resultados
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={skipImports === 0 || loadingImports}
                                onClick={() => setSkipImports(skipImports - limit)}
                                className="p-1.5 rounded-md border border-border-subtle hover:bg-bg-deep disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                disabled={skipImports + limit >= totalImports || loadingImports}
                                onClick={() => setSkipImports(skipImports + limit)}
                                className="p-1.5 rounded-md border border-border-subtle hover:bg-bg-deep disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                /* Tab 2: Alíquotas por NCM */
                <div className="bg-surface rounded-xl border border-border-subtle shadow-sm flex flex-col">
                    <div className="p-5 border-b border-border-subtle flex items-center bg-surface gap-4">
                        <div className="relative flex-1 max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Filtrar por código NCM..."
                                value={codigoFilter}
                                onChange={(e) => {
                                    setSkipValores(0);
                                    setCodigoFilter(e.target.value);
                                }}
                                className="w-full bg-bg-deep border border-border-subtle rounded-lg py-2 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                            />
                        </div>
                    </div>

                    <div className="min-h-[300px] overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-[#f8f9fa] dark:bg-bg-deep border-b border-border-subtle">
                                <tr className="text-xs text-text-muted uppercase tracking-wider">
                                    <th className="px-6 py-3 font-semibold w-40">NCM</th>
                                    <th className="px-6 py-3 font-semibold">Descrição NCM</th>
                                    <th className="px-6 py-3 font-semibold w-40 text-center">Alíquota TIPI</th>
                                    <th className="px-6 py-3 font-semibold w-40 text-right">Vigência</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {loadingValores ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-2">
                                                <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                                                <p className="text-sm text-text-muted">Carregando alíquotas...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : valores.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <Calendar className="w-12 h-12 text-text-muted/30" />
                                                <p className="text-text-muted font-medium">Nenhuma alíquota encontrada.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    valores.map((val) => (
                                        <tr key={val.id} className="hover:bg-bg-deep/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <span className="font-mono text-sm font-semibold text-brand-primary bg-brand-primary/5 px-2.5 py-1 rounded">
                                                    {val.codigo_ncm}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-text-primary max-w-xl truncate" title={val.descricao_ncm}>
                                                {val.descricao_ncm}
                                            </td>
                                            <td className="px-6 py-4 text-center font-mono font-bold text-text-primary text-base">
                                                {parseFloat(val.aliquota.toString()).toFixed(2)}%
                                            </td>
                                            <td className="px-6 py-4 text-right text-sm text-text-muted font-mono">
                                                {formatDate(val.vigencia)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 border-t border-border-subtle flex items-center justify-between text-sm text-text-muted bg-surface/50 rounded-b-lg">
                        <p>
                            Mostrando <span className="font-semibold text-text-primary">{valores.length}</span> de{' '}
                            <span className="font-semibold text-text-primary">{totalValores}</span> resultados
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={skipValores === 0 || loadingValores}
                                onClick={() => setSkipValores(skipValores - limit)}
                                className="p-1.5 rounded-md border border-border-subtle hover:bg-bg-deep disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                disabled={skipValores + limit >= totalValores || loadingValores}
                                onClick={() => setSkipValores(skipValores + limit)}
                                className="p-1.5 rounded-md border border-border-subtle hover:bg-bg-deep disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <TipiImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={handleImportSuccess}
            />
        </div>
    );
};
