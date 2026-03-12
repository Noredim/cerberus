import React, { useState, useEffect, useCallback } from 'react';
import {
    ArrowLeft,
    Upload,
    Search,
    CheckCircle2,
    FileSpreadsheet,
    Calendar,
    Settings,
    MoreHorizontal
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { NcmStHeader, NcmStItem } from './types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import NcmStImportModal from './components/NcmStImportModal';

const NcmStDetails: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const [header, setHeader] = useState<NcmStHeader | null>(null);
    const [items, setItems] = useState<NcmStItem[]>([]);
    const [totalItems, setTotalItems] = useState(0);
    const [loading, setLoading] = useState(true);
    const [itemsLoading, setItemsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [page, setPage] = useState(0);
    const [pageSize] = useState(25);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [importSummary, setImportSummary] = useState<any>(null);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
            setPage(0); // Reset page on search
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    const fetchDetails = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const response = await api.get(`/cadastro/ncm-st/${id}`);
            setHeader(response.data);
        } catch (error) {
            console.error('Erro ao buscar detalhes:', error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    const fetchItems = useCallback(async () => {
        if (!id) return;
        try {
            setItemsLoading(true);
            const response = await api.get(`/cadastro/ncm-st/${id}/itens`, {
                params: {
                    skip: page * pageSize,
                    limit: pageSize,
                    q: debouncedSearch || undefined
                }
            });
            setItems(response.data.items);
            setTotalItems(response.data.total);
        } catch (error) {
            console.error('Erro ao buscar itens:', error);
        } finally {
            setItemsLoading(false);
        }
    }, [id, page, pageSize, debouncedSearch]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const handleImportSuccess = (summary: any) => {
        setImportSummary(summary);
        fetchDetails();
        fetchItems();
        // Clear summary after 10 seconds
        setTimeout(() => setImportSummary(null), 10000);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    if (!header) return <div className="p-8 text-center text-text-muted">Cadastro não encontrado.</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-12">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/cadastros/ncm-st')}
                    className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    Voltar para Listagem
                </button>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => navigate(`/cadastros/ncm-st/editar/${header.id}`)}>
                        <Settings className="w-4 h-4 mr-2" />
                        Configurações do Cadastro
                    </Button>
                </div>
            </div>

            <Card className="p-6 border-l-4 border-l-brand-primary overflow-hidden relative">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="flex items-center gap-3">
                            <Badge variant="neutral" className="bg-brand-primary/10 text-brand-primary font-bold text-lg px-3 py-1">
                                {header.state_sigla}
                            </Badge>
                            <h1 className="text-2xl font-bold text-text-primary">
                                {header.description}
                            </h1>
                        </div>
                        <div className="flex flex-wrap items-center gap-4 text-sm text-text-muted">
                            <span className="flex items-center gap-1">
                                <FileSpreadsheet className="w-4 h-4" />
                                {header.item_count || 0} itens vinculados
                            </span>
                            <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                Atualizado em {new Date(header.updated_at).toLocaleDateString('pt-BR')}
                            </span>
                        </div>
                    </div>
                    <Button
                        onClick={() => setIsImportModalOpen(true)}
                        className="bg-brand-primary hover:shadow-lg hover:shadow-brand-primary/20 flex items-center gap-2 h-12 px-6"
                    >
                        <Upload className="w-5 h-5" />
                        Importar CSV
                    </Button>
                </div>

                {importSummary && (
                    <div className="mt-4 bg-brand-success/10 border border-brand-success/20 p-4 rounded-xl flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                        <div className="flex items-center gap-3">
                            <CheckCircle2 className="w-6 h-6 text-brand-success" />
                            <div>
                                <p className="text-sm font-bold text-text-primary">{importSummary.message}</p>
                                <p className="text-xs text-text-muted">Processados: {importSummary.total_processed} | Erros: {importSummary.error_count}</p>
                            </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setImportSummary(null)}>Fechar</Button>
                    </div>
                )}
            </Card>

            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        Itens Importados
                        <span className="text-xs font-normal text-text-muted bg-bg-deep px-2 py-0.5 rounded border border-border-subtle">
                            Página {page + 1}
                        </span>
                    </h2>
                    <div className="relative max-w-sm flex-1 ml-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <Input
                            placeholder="Filtrar nesta página por NCM ou CEST..."
                            className="pl-10 h-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="bg-surface rounded-xl border border-border-subtle shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-bg-deep border-b border-border-subtle">
                                    <th className="px-4 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">NCM</th>
                                    <th className="px-4 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">CEST</th>
                                    <th className="px-4 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">Descrição</th>
                                    <th className="px-4 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">Anexo/Segmento</th>
                                    <th className="px-4 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">MVA %</th>
                                    <th className="px-4 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider">Vigência</th>
                                    <th className="px-4 py-4 text-[11px] font-bold text-text-muted uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {itemsLoading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                                                <p className="text-text-muted font-medium">Carregando itens...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : items.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-20 text-center text-text-muted">
                                            <div className="max-w-xs mx-auto space-y-4">
                                                <FileSpreadsheet className="w-12 h-12 mx-auto opacity-20" />
                                                <p>{debouncedSearch ? 'Nenhum item encontrado para esta busca.' : 'Nenhum item importado ainda para este cadastro.'}</p>
                                                {!debouncedSearch && (
                                                    <Button variant="ghost" className="text-brand-primary" onClick={() => setIsImportModalOpen(true)}>
                                                        Importar Itens Agora
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ) : items.map((item) => (
                                    <tr key={item.id} className="hover:bg-bg-deep/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-sm text-text-primary">{item.ncm_normalizado}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-text-muted">{item.cest_normalizado}</td>
                                        <td className="px-4 py-3 text-sm truncate max-w-xs" title={item.descricao}>{item.descricao}</td>
                                        <td className="px-4 py-3 text-xs text-text-muted">{item.segmento_anexo}</td>
                                        <td className="px-4 py-3 font-bold text-brand-primary">
                                            {item.mva_percent ? `${Number(item.mva_percent).toFixed(2)}%` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-text-muted">
                                            {item.vigencia_inicio ? new Date(item.vigencia_inicio).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button className="p-1.5 rounded-full hover:bg-bg-deep text-text-muted transition-colors">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-bg-deep flex items-center justify-between border-t border-border-subtle">
                        <p className="text-xs text-text-muted">
                            Mostrando {items.length} de {totalItems} itens
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={page === 0}
                                onClick={() => setPage(p => p - 1)}
                                className="h-8 px-3"
                            >
                                Anterior
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                disabled={(page + 1) * pageSize >= totalItems}
                                onClick={() => setPage(p => p + 1)}
                                className="h-8 px-3"
                            >
                                Próxima
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <NcmStImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                headerId={header.id}
                onSuccess={handleImportSuccess}
            />
        </div>
    );
};

export default NcmStDetails;
