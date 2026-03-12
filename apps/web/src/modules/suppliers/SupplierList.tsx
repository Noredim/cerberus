import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Building2,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Supplier } from './types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

const SupplierList: React.FC = () => {
    const navigate = useNavigate();
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchSuppliers = async () => {
        try {
            setLoading(true);
            const response = await api.get('/cadastro/fornecedores');
            setSuppliers(response.data);
        } catch (error) {
            console.error('Erro ao buscar fornecedores:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSuppliers();
    }, []);

    const filteredSuppliers = suppliers.filter(s => {
        const search = searchTerm.toLowerCase();
        return (
            s.razao_social.toLowerCase().includes(search) ||
            s.cnpj.includes(search) ||
            (s.nome_fantasia && s.nome_fantasia.toLowerCase().includes(search))
        );
    });

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este fornecedor?')) return;
        try {
            await api.delete(`/cadastro/fornecedores/${id}`);
            fetchSuppliers();
        } catch (error) {
            alert('Erro ao excluir fornecedor.');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <Building2 className="w-8 h-8 text-brand-primary" />
                        Fornecedores
                    </h1>
                    <p className="text-text-muted mt-1">
                        Gerencie a base de fornecedores do sistema.
                    </p>
                </div>
                <Button
                    onClick={() => navigate('/cadastros/fornecedores/novo')}
                    className="flex items-center gap-2 shadow-lg hover:shadow-brand-primary/20 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Novo Fornecedor
                </Button>
            </div>

            <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between mb-6">
                    <div className="relative flex-1 w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <Input
                            placeholder="Pesquisar por Razão Social, CNPJ ou Nome Fantasia..."
                            className="pl-10"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border-subtle">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-bg-deep border-bottom border-border-subtle">
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">Fornecedor</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">CNPJ</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">Cidade/UF</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                                        <div className="flex items-center justify-center gap-2">
                                            <div className="w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
                                            Carregando...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                                        Nenhum fornecedor encontrado.
                                    </td>
                                </tr>
                            ) : filteredSuppliers.map((s) => (
                                <tr
                                    key={s.id}
                                    className="hover:bg-bg-deep/50 transition-colors group cursor-pointer"
                                    onClick={() => navigate(`/cadastros/fornecedores/editar/${s.id}`)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-text-primary group-hover:text-brand-primary transition-colors">
                                                {s.razao_social}
                                            </span>
                                            {s.nome_fantasia && (
                                                <span className="text-xs text-text-muted">{s.nome_fantasia}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium">
                                        {s.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-muted">
                                        {s.bairro ? `${s.bairro}, ` : ''}{s.state_id || ''}
                                    </td>
                                    <td className="px-6 py-4">
                                        {s.active ? (
                                            <Badge variant="success" className="flex w-fit items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Ativo
                                            </Badge>
                                        ) : (
                                            <Badge variant="neutral" className="flex w-fit items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> Inativo
                                            </Badge>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div
                                            className="flex items-center justify-end gap-2"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                onClick={() => navigate(`/cadastros/fornecedores/editar/${s.id}`)}
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-brand-danger hover:bg-brand-danger/10"
                                                onClick={() => handleDelete(s.id)}
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

export default SupplierList;
