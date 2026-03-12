import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Users,
    AlertCircle,
    CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { customerApi } from './api/customerApi';
import type { Customer } from './types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';

const CustomerList: React.FC = () => {
    const navigate = useNavigate();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            const data = await customerApi.list();
            setCustomers(data);
        } catch (error) {
            console.error('Erro ao buscar clientes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCustomers();
    }, []);

    const filteredCustomers = customers.filter(c => {
        const search = searchTerm.toLowerCase();
        return (
            c.razao_social.toLowerCase().includes(search) ||
            c.cnpj.includes(search) ||
            (c.nome_fantasia && c.nome_fantasia.toLowerCase().includes(search))
        );
    });

    const handleDelete = async (id: string) => {
        if (!window.confirm('Tem certeza que deseja excluir este cliente?')) return;
        try {
            await customerApi.delete(id);
            fetchCustomers();
        } catch (error) {
            alert('Erro ao excluir cliente.');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <Users className="w-8 h-8 text-brand-primary" />
                        Clientes
                    </h1>
                    <p className="text-text-muted mt-1">
                        Gerencie a base de clientes do sistema.
                    </p>
                </div>
                <Button
                    onClick={() => navigate('/cadastros/clientes/novo')}
                    className="flex items-center gap-2 shadow-lg hover:shadow-brand-primary/20 transition-all"
                >
                    <Plus className="w-4 h-4" />
                    Novo Cliente
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
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">Cliente</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">Tipo/Esfera</th>
                                <th className="px-6 py-4 text-sm font-semibold text-text-muted uppercase tracking-wider">CNPJ</th>
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
                            ) : filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                                        Nenhum cliente encontrado.
                                    </td>
                                </tr>
                            ) : filteredCustomers.map((c) => (
                                <tr
                                    key={c.id}
                                    className="hover:bg-bg-deep/50 transition-colors group cursor-pointer"
                                    onClick={() => navigate(`/cadastros/clientes/editar/${c.id}`)}
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-text-primary group-hover:text-brand-primary transition-colors">
                                                {c.razao_social}
                                            </span>
                                            {c.nome_fantasia && (
                                                <span className="text-xs text-text-muted">{c.nome_fantasia}</span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col gap-1">
                                            <Badge variant={c.tipo === 'PUBLICO' ? 'warning' : 'info'} className="w-fit text-[10px] py-0 px-1.5">
                                                {c.tipo}
                                            </Badge>
                                            {c.esfera && (
                                                <span className="text-[10px] text-text-muted font-medium uppercase tracking-tighter shadow-sm">
                                                    {c.esfera}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium">
                                        {c.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}
                                    </td>
                                    <td className="px-6 py-4">
                                        {c.active ? (
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
                                                onClick={() => navigate(`/cadastros/clientes/editar/${c.id}`)}
                                                title="Editar"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon-sm"
                                                className="text-brand-danger hover:bg-brand-danger/10"
                                                onClick={() => handleDelete(c.id)}
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

export default CustomerList;
