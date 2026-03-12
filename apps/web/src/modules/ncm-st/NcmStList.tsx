import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Filter,
    Edit2,
    Trash2,
    ChevronRight,
    ClipboardList,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { NcmStHeader } from './types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

const NcmStList: React.FC = () => {
    const navigate = useNavigate();
    const [headers, setHeaders] = useState<NcmStHeader[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

    const fetchHeaders = async () => {
        try {
            setLoading(true);
            const response = await api.get('/cadastro/ncm-st/');
            setHeaders(response.data);
        } catch (error) {
            console.error('Erro ao buscar cadastros NCM ST:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHeaders();
    }, []);

    const filteredHeaders = headers.filter(h => {
        const matchesSearch = h.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (h.state_sigla && h.state_sigla.toLowerCase().includes(searchTerm.toLowerCase()));

        const matchesStatus = statusFilter === 'all' ? true :
            statusFilter === 'active' ? h.is_active : !h.is_active;

        return matchesSearch && matchesStatus;
    });

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este cadastro?')) return;
        try {
            await api.delete(`/cadastro/ncm-st/${id}`);
            fetchHeaders();
        } catch (error) {
            alert('Erro ao excluir cadastro.');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <ClipboardList className="w-8 h-8 text-brand-primary" />
                        Cadastro de NCM ST por UF
                    </h1>
                    <p className="text-text-muted mt-1">
                        Gerencie as tabelas de Substituição Tributária por Estado.
                    </p>
                </div>
                <Button
                    onClick={() => navigate('/cadastros/ncm-st/novo')}
                    className="flex items-center gap-2 shadow-lg hover:shadow-brand-primary/20 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Novo Cadastro
                </Button>
            </div>

            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <Input
                            placeholder="Pesquisar por descrição ou UF..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full md:w-auto">
                        <Filter className="w-4 h-4 text-text-muted" />
                        <select
                            className="bg-bg-offset border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                        >
                            <option value="all">Todos os Status</option>
                            <option value="active">Ativos</option>
                            <option value="inactive">Inativos</option>
                        </select>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border-subtle">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-bg-deep border-bottom border-border-subtle">
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">UF</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">Descrição</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">Itens</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">Última Atualização</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                                            Carregando...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredHeaders.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                                        Nenhum registro encontrado.
                                    </td>
                                </tr>
                            ) : filteredHeaders.map((h) => (
                                <tr
                                    key={h.id}
                                    className="hover:bg-bg-deep/50 transition-colors group cursor-pointer"
                                    onClick={() => navigate(`/cadastros/ncm-st/${h.id}`)}
                                >
                                    <td className="px-6 py-4">
                                        <span className="font-bold text-brand-primary bg-brand-primary/5 px-2 py-1 rounded">
                                            {h.state_sigla}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-text-primary group-hover:text-brand-primary transition-colors">
                                        {h.description}
                                    </td>
                                    <td className="px-6 py-4">
                                        {h.is_active ? (
                                            <Badge variant="success" className="flex w-fit items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Ativo
                                            </Badge>
                                        ) : (
                                            <Badge variant="neutral" className="flex w-fit items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Inativo
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="bg-bg-deep px-2.5 py-1 rounded-full text-xs font-semibold border border-border-subtle">
                                            {h.item_count || 0} itens
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-muted">
                                        {new Date(h.updated_at).toLocaleDateString('pt-BR')}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div
                                            className="flex items-center justify-end gap-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => navigate(`/cadastros/ncm-st/${h.id}`)}
                                                className="text-brand-primary hover:bg-brand-primary/10"
                                            >
                                                Ver Detalhes
                                                <ChevronRight className="w-4 h-4 ml-1" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => navigate(`/cadastros/ncm-st/editar/${h.id}`)}
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-brand-danger hover:bg-brand-danger/10"
                                                onClick={() => handleDelete(h.id)}
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
};

export default NcmStList;
