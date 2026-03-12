import React, { useEffect, useState } from 'react';
import {
    MapPin,
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
import CityModal from '../../components/modals/CityModal';

interface City {
    id: string;
    nome: string;
    state_id: string;
    ibge_id: number;
    microregiao?: string;
    mesorregiao?: string;
    is_active: boolean;
    state?: {
        id: string;
        sigla: string;
        nome: string;
    };
}

interface State {
    id: string;
    sigla: string;
    nome: string;
}

const CitiesList: React.FC = () => {
    const navigate = useNavigate();
    const [cities, setCities] = useState<City[]>([]);
    const [states, setStates] = useState<State[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedStateId, setSelectedStateId] = useState('');
    const [page, setPage] = useState(1);
    const [total, setTotal] = useState(0);
    const pageSize = 50;

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCity, setEditingCity] = useState<City | null>(null);

    // Dropdown State
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const fetchStates = async () => {
        try {
            const response = await api.get('/catalog/states');
            setStates(response.data);
        } catch (error) {
            console.error('Error fetching states:', error);
            setStates([]);
        }
    };

    const fetchCities = async () => {
        setLoading(true);
        try {
            let url = `/catalog/cities?search=${search}&page=${page}&page_size=${pageSize}`;
            if (selectedStateId) url += `&state_id=${selectedStateId}`;

            const response = await api.get(url);
            setCities(response.data.items || response.data); // Support fallback if api hasn't reloaded yet
            setTotal(response.data.total || 0);
        } catch (error) {
            console.error('Error fetching cities:', error);
            setCities([]);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm("Certeza que deseja excluir este Município?")) return;
        try {
            await api.delete(`/catalog/cities/${id}`);
            fetchCities();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Erro ao excluir município.');
        }
    };

    const openEditModal = (city: City) => {
        setEditingCity(city);
        setIsModalOpen(true);
        setOpenDropdown(null);
    };

    const openCreateModal = () => {
        setEditingCity(null);
        setIsModalOpen(true);
    };

    useEffect(() => {
        fetchStates();
    }, []);

    // Resetar página quando os filtros mudam
    useEffect(() => {
        setPage(1);
    }, [search, selectedStateId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCities();
        }, 300);
        return () => clearTimeout(timer);
    }, [search, selectedStateId, page]);

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                        Cadastro de <span className="text-brand-primary">Municípios</span>
                    </h1>
                    <p className="text-text-muted mt-1">Gerencie as cidades e visualize informações regionais.</p>
                </div>

                <div className="flex gap-4">
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
                        Novo Município
                    </button>
                </div>
            </header>

            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm overflow-hidden flex flex-col">
                <div className="p-5 border-b border-border-subtle flex flex-col md:flex-row items-center justify-between bg-surface gap-4">
                    <div className="relative flex-1 w-full md:max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por nome..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                        />
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <select
                            value={selectedStateId}
                            onChange={(e) => setSelectedStateId(e.target.value)}
                            className="bg-bg-deep border border-border-subtle rounded-md py-1.5 px-3 text-sm text-text-primary outline-none focus:border-brand-primary transition-colors cursor-pointer min-w-[150px]"
                        >
                            <option value="">Todos os Estados</option>
                            {states.map(s => (
                                <option key={s.id} value={s.id}>{s.sigla} - {s.nome}</option>
                            ))}
                        </select>
                        <button className="p-1.5 rounded-md hover:bg-bg-deep text-text-muted border border-border-subtle transition-colors cursor-pointer"><Filter className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
                            <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                <th className="px-6 py-3 font-semibold">Município</th>
                                <th className="px-6 py-3 font-semibold">UF</th>
                                <th className="px-6 py-3 font-semibold">Microrregião</th>
                                <th className="px-6 py-3 font-semibold">Mesorregião</th>
                                <th className="px-6 py-3 font-semibold">Status</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            <AnimatePresence mode='popLayout'>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                                            Carregando municípios...
                                        </td>
                                    </tr>
                                ) : cities.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-10 text-center text-text-muted">
                                            Nenhum município encontrado.
                                        </td>
                                    </tr>
                                ) : cities.map((city, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.01 }}
                                        key={city.id}
                                        className="group hover:bg-bg-deep transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-md bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                                    <MapPin className="w-4 h-4" />
                                                </div>
                                                <span className="font-medium text-text-primary">{city.nome}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-text-primary">{city.state?.sigla || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-text-muted">{city.microregiao || '-'}</td>
                                        <td className="px-6 py-4 text-sm text-text-muted">{city.mesorregiao || '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md w-fit ${city.is_active ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-danger/10 text-brand-danger'}`}>
                                                {city.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                {city.is_active ? 'ATIVO' : 'INATIVO'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={() => setOpenDropdown(openDropdown === city.id ? null : city.id)}
                                                className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {/* Action Dropdown Menu */}
                                            {openDropdown === city.id && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                                    <div className="absolute right-8 top-10 mt-2 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                                                        <div className="py-1 flex flex-col">
                                                            <button
                                                                onClick={() => openEditModal(city)}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                            >
                                                                <Edit2 className="w-4 h-4" /> Editar Município
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleDelete(city.id);
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
                    <span className="text-xs text-text-muted font-medium">Exibindo {cities.length} de {total} municípios totais</span>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                            className={`px-3 py-1.5 rounded-md bg-transparent text-xs text-text-muted border border-border-subtle transition-colors ${page === 1 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-deep cursor-pointer text-text-primary'}`}
                        >
                            Anterior
                        </button>
                        <button
                            disabled={cities.length < pageSize}
                            onClick={() => setPage(p => p + 1)}
                            className={`px-3 py-1.5 rounded-md bg-transparent text-xs text-text-muted border border-border-subtle transition-colors ${(cities.length < pageSize) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-bg-deep cursor-pointer text-text-primary'}`}
                        >
                            Próxima
                        </button>
                    </div>
                </div>
            </div>

            <CityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchCities}
                cityData={editingCity}
                states={states}
            />
        </div>
    );
};

export default CitiesList;
