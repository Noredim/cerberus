import React, { useEffect, useState } from 'react';
import {
    Globe,
    RefreshCcw,
    Search,
    Filter,
    MoreVertical,
    Plus,
    CheckCircle2,
    XCircle,
    Loader2,
    History as HistoryIcon,
    Edit2,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import StateModal from '../../components/modals/StateModal';

interface State {
    id: string;
    sigla: string;
    nome: string;
    regiao_nome: string;
    is_active: boolean;
    last_sync_at?: string;
}

const StatesList: React.FC = () => {
    const navigate = useNavigate();
    const [states, setStates] = useState<State[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [search, setSearch] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingState, setEditingState] = useState<State | null>(null);

    // Dropdown State
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const fetchStates = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/catalog/states?search=${search}`);
            setStates(response.data);
        } catch (error) {
            console.error('Error fetching states:', error);
            setStates([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStates();
    }, [search]);

    const handleSync = async () => {
        setSyncing(true);
        try {
            const response = await api.post('/catalog/integrations/ibge/sync-locations');
            const result = response.data;
            alert(`Sincronização concluída!\nEstados: ${result.summary_json.states_created} criados, ${result.summary_json.states_updated} atualizados.\nMunicípios: ${result.summary_json.cities_created} criados, ${result.summary_json.cities_updated} atualizados.`);
            fetchStates();
        } catch (error) {
            console.error('Sync error:', error);
            alert('Falha na sincronização.');
        } finally {
            setSyncing(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Certeza que deseja excluir este Estado? Isso removerá as cidades dependentes.")) return;
        try {
            await api.delete(`/catalog/states/${id}`);
            fetchStates();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Erro ao excluir estado.');
        }
    };

    const openEditModal = (state: State) => {
        setEditingState(state);
        setIsModalOpen(true);
        setOpenDropdown(null);
    };

    const openCreateModal = () => {
        setEditingState(null);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                        Cadastro de <span className="text-brand-primary">Estados</span>
                    </h1>
                    <p className="text-text-muted mt-1">Gerencie as Unidades Federativas e sincronize com o IBGE.</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="flex items-center gap-2 bg-surface border border-border-subtle text-text-primary px-4 py-2 rounded-md font-medium hover:bg-bg-deep transition-colors min-h-[40px] cursor-pointer disabled:opacity-50"
                    >
                        {syncing ? (
                            <Loader2 className="w-5 h-5 animate-spin text-brand-primary" />
                        ) : (
                            <RefreshCcw className="w-5 h-5 text-brand-primary" />
                        )}
                        Sync IBGE
                    </button>
                    <button
                        onClick={() => navigate('/cadastros/jobs')}
                        className="flex items-center gap-2 bg-surface border border-border-subtle text-text-primary px-4 py-2 rounded-md font-medium hover:bg-bg-deep transition-colors min-h-[40px] cursor-pointer"
                    >
                        <HistoryIcon className="w-5 h-5 text-text-muted" />
                        Ver Jobs
                    </button>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Estado
                    </button>
                </div>
            </header>

            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou sigla..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="p-1.5 rounded-md hover:bg-bg-deep text-text-muted border border-border-subtle transition-colors cursor-pointer"><Filter className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
                            <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                <th className="px-6 py-3 font-semibold">Estado</th>
                                <th className="px-6 py-3 font-semibold">Sigla</th>
                                <th className="px-6 py-3 font-semibold">Região</th>
                                <th className="px-6 py-3 font-semibold">Status</th>
                                <th className="px-6 py-3 font-semibold">Última Sinc.</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            <AnimatePresence mode='popLayout'>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                                            Carregando estados...
                                        </td>
                                    </tr>
                                ) : states.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                                            Nenhum estado encontrado. Sincronize com o IBGE.
                                        </td>
                                    </tr>
                                ) : states.map((state, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.03 }}
                                        key={state.id}
                                        className="group hover:bg-bg-deep transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-md bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                                    <Globe className="w-4 h-4" />
                                                </div>
                                                <span className="font-medium text-text-primary">{state.nome}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-muted font-mono">{state.sigla}</td>
                                        <td className="px-6 py-4 text-sm text-text-muted">{state.regiao_nome}</td>
                                        <td className="px-6 py-4">
                                            <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md w-fit ${state.is_active ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-danger/10 text-brand-danger'}`}>
                                                {state.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                {state.is_active ? 'ATIVO' : 'INATIVO'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-muted">
                                            {state.last_sync_at ? new Date(state.last_sync_at).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={() => setOpenDropdown(openDropdown === state.id ? null : state.id)}
                                                className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {/* Action Dropdown Menu */}
                                            {openDropdown === state.id && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                                    <div className="absolute right-8 top-10 mt-2 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                                                        <div className="py-1 flex flex-col">
                                                            <button
                                                                onClick={() => openEditModal(state)}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                            >
                                                                <Edit2 className="w-4 h-4" /> Editar Estado
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleDelete(state.id);
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-brand-danger hover:bg-brand-danger/10 transition-colors w-full text-left"
                                                            >
                                                                <Trash2 className="w-4 h-4" /> Excluir
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>
                </div>
                <div className="p-4 bg-[#f8f9fa] dark:bg-bg-deep flex items-center justify-between border-t border-border-subtle mt-auto">
                    <span className="text-xs text-text-muted font-medium">Exibindo {states.length} estados</span>
                    <div className="flex gap-2">
                        <button className="px-3 py-1.5 rounded-md bg-transparent text-xs text-text-muted border border-border-subtle opacity-50 cursor-not-allowed">Anterior</button>
                        <button className="px-3 py-1.5 rounded-md bg-transparent text-xs text-text-muted border border-border-subtle opacity-50 cursor-not-allowed">Próxima</button>
                    </div>
                </div>
            </div>

            <StateModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchStates}
                stateData={editingState}
            />
        </div>
    );
};

export default StatesList;
