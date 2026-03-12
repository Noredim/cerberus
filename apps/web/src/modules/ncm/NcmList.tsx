import React, { useEffect, useState } from 'react';
import {
    Search,
    Plus,
    Loader2,
    Edit2,
    UploadCloud,
    Calendar,
    ChevronLeft,
    ChevronRight,
    Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ncmApi } from './api/ncmApi';
import type { Ncm, NcmFilters } from './types';
import { NcmImportModal } from './components/NcmImportModal';

const NcmList: React.FC = () => {
    const navigate = useNavigate();
    const [ncms, setNcms] = useState<Ncm[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [skip, setSkip] = useState(0);
    const [limit] = useState(20);
    const [filters, setFilters] = useState<NcmFilters>({
        codigo: '',
        descricao: '',
        active_only: true
    });
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const fetchNcms = async () => {
        setLoading(true);
        try {
            const data = await ncmApi.list(skip, limit, filters);
            console.log('NCM Data:', data);
            setNcms(data.items);
            setTotal(data.total);
        } catch (error) {
            console.error('Error fetching NCMs:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchNcms();
    }, [skip, filters.codigo, filters.descricao, filters.active_only]);

    const handleDelete = async (id: string, code: string) => {
        if (!window.confirm(`Deseja realmente excluir o NCM ${code}?`)) return;
        try {
            await ncmApi.delete(id);
            fetchNcms();
        } catch (error) {
            alert('Erro ao excluir NCM.');
        }
    };

    const handlePageChange = (newSkip: number) => {
        setSkip(newSkip);
    };

    return (
        <div className="space-y-6 w-full ">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                        Gestão de <span className="text-brand-primary">NCM</span>
                    </h1>
                    <p className="text-text-muted mt-1">Nomenclatura Comum do Mercosul.</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 bg-bg-deep text-text-primary px-4 py-2 rounded-md font-medium border border-border-subtle hover:bg-bg-deep/80 transition-colors min-h-[40px] cursor-pointer"
                    >
                        <UploadCloud className="w-5 h-5" />
                        Importar JSON
                    </button>
                    <button
                        onClick={() => navigate('/ncms/novo')}
                        className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm"
                    >
                        <Plus className="w-5 h-5" />
                        Novo NCM
                    </button>
                </div>
            </header>

            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm flex flex-col">
                <div className="p-5 border-b border-border-subtle flex items-center bg-surface gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por código..."
                            value={filters.codigo}
                            onChange={(e) => setFilters(prev => ({ ...prev, codigo: e.target.value }))}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                        />
                    </div>
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por descrição..."
                            value={filters.descricao}
                            onChange={(e) => setFilters(prev => ({ ...prev, descricao: e.target.value }))}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                        />
                    </div>
                </div>

                <div className="min-h-[300px] overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
                            <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                <th className="px-6 py-3 font-semibold w-32">Código</th>
                                <th className="px-6 py-3 font-semibold">Descrição</th>
                                <th className="px-6 py-3 font-semibold w-40">Vigência</th>
                                <th className="px-6 py-3 font-semibold w-48">Ato Legal</th>
                                <th className="px-6 py-3 font-semibold text-right w-24">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {loading ? (
                                <tr key="loading">
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                                            <p className="text-sm text-text-muted">Carregando nomenclaturas...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : ncms.length === 0 ? (
                                <tr key="empty">
                                    <td colSpan={5} className="px-6 py-12 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <Calendar className="w-12 h-12 text-text-muted/30" />
                                            <p className="text-text-muted font-medium">Nenhum NCM encontrado.</p>
                                            <button
                                                onClick={() => navigate('/ncms/novo')}
                                                className="text-brand-primary text-sm font-medium hover:underline cursor-pointer"
                                            >
                                                Cadastrar o primeiro NCM
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                ncms.map((ncm) => (
                                    <tr
                                        key={ncm.id}
                                        className="hover:bg-bg-deep/50 transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-sm font-semibold text-brand-primary bg-brand-primary/5 px-2 py-0.5 rounded">
                                                {ncm.codigo}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm text-text-primary font-medium line-clamp-2" title={ncm.descricao}>
                                                {ncm.descricao}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-1.5 text-xs text-text-muted">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>{ncm.data_inicio ? new Date(ncm.data_inicio).toLocaleDateString('pt-BR') : '-'} a</span>
                                                </div>
                                                <span className="text-xs text-text-muted ml-4.5">{ncm.data_fim ? new Date(ncm.data_fim).toLocaleDateString('pt-BR') : '-'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {ncm.tipo_ato_ini ? (
                                                <p className="text-xs text-text-primary capitalize bg-bg-deep px-2 py-1 rounded inline-block border border-border-subtle">
                                                    {ncm.tipo_ato_ini.toLowerCase()} {ncm.numero_ato_ini}/{ncm.ano_ato_ini}
                                                </p>
                                            ) : (
                                                <span className="text-xs text-text-muted">-</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => navigate(`/ncms/detalhes/${ncm.id}`)}
                                                    className="p-1.5 hover:bg-bg-deep text-text-muted hover:text-brand-primary rounded-md transition-all cursor-pointer"
                                                    title="Ver Detalhes"
                                                >
                                                    <Search className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => navigate(`/ncms/editar/${ncm.id}`)}
                                                    className="p-1.5 hover:bg-bg-deep text-text-muted hover:text-brand-primary rounded-md transition-all cursor-pointer"
                                                    title="Editar"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(ncm.id, ncm.codigo)}
                                                    className="p-1.5 hover:bg-bg-deep text-text-muted hover:text-red-500 rounded-md transition-all cursor-pointer"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-4 border-t border-border-subtle flex items-center justify-between text-sm text-text-muted bg-surface/50 rounded-b-lg">
                    <p>
                        Mostrando <span className="font-semibold text-text-primary">{ncms.length}</span> de{' '}
                        <span className="font-semibold text-text-primary">{total}</span> resultados
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={skip === 0 || loading}
                            onClick={() => handlePageChange(skip - limit)}
                            className="p-1.5 rounded-md border border-border-subtle hover:bg-bg-deep disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                            disabled={skip + limit >= total || loading}
                            onClick={() => handlePageChange(skip + limit)}
                            className="p-1.5 rounded-md border border-border-subtle hover:bg-bg-deep disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            <NcmImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => {
                    setIsImportModalOpen(false);
                    setSkip(0);
                    fetchNcms();
                }}
            />
        </div>
    );
};

export default NcmList;
