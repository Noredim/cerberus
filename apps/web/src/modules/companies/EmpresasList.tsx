import React, { useEffect, useState } from 'react';
import {
    Building2,
    Search,
    Filter,
    MoreVertical,
    Plus,
    CheckCircle2,
    XCircle,
    Loader2,
    Edit2,
    Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { Company } from './types';

const EmpresasList: React.FC = () => {
    const navigate = useNavigate();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const fetchCompanies = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/companies?search=${search}`);
            setCompanies(response.data);
        } catch (error) {
            console.error('Error fetching companies:', error);
            setCompanies([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchCompanies();
    }, [search]);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Certeza que deseja excluir a empresa "${name}"? Esta ação não pode ser desfeita.`)) return;
        try {
            await api.delete(`/companies/${id}`);
            fetchCompanies();
        } catch (error) {
            console.error('Delete error:', error);
            alert('Erro ao excluir empresa.');
        }
    };

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                        Gestão de <span className="text-brand-primary">Empresas</span>
                    </h1>
                    <p className="text-text-muted mt-1">Gerencie o cadastro de empresas e seus perfis tributários.</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/empresas/novo')}
                        className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm"
                    >
                        <Plus className="w-5 h-5" />
                        Nova Empresa
                    </button>
                </div>
            </header>

            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm flex flex-col">
                <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por nome ou CNPJ..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                        />
                    </div>
                    <div className="flex gap-2">
                        <button className="p-1.5 rounded-md hover:bg-bg-deep text-text-muted border border-border-subtle transition-colors cursor-pointer"><Filter className="w-5 h-5" /></button>
                    </div>
                </div>

                <div className="min-h-[200px]">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
                            <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                <th className="px-6 py-3 font-semibold">Empresa</th>
                                <th className="px-6 py-3 font-semibold">CNPJ</th>
                                <th className="px-6 py-3 font-semibold">Perfil Tributário</th>
                                <th className="px-6 py-3 font-semibold">Benefícios Ativos</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            <AnimatePresence mode='popLayout'>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-text-muted">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                                            Carregando empresas...
                                        </td>
                                    </tr>
                                ) : companies.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-text-muted">
                                            Nenhuma empresa encontrada.
                                        </td>
                                    </tr>
                                ) : companies.map((company, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.03 }}
                                        key={company.id}
                                        className="group hover:bg-bg-deep transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-md bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                                    <Building2 className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-text-primary">{company.nome_fantasia || company.razao_social}</span>
                                                    <span className="text-xs text-text-muted truncate max-w-[200px]">{company.razao_social}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-muted font-mono">{company.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")}</td>
                                        <td className="px-6 py-4">
                                            {company.tax_profiles && company.tax_profiles.some(p => p.vigencia_fim === null) ? (
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md bg-brand-success/10 text-brand-success w-fit uppercase">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {company.tax_profiles.find(p => p.vigencia_fim === null)?.regime_tributario.replace('_', ' ')}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md bg-brand-danger/10 text-brand-danger w-fit uppercase">
                                                    <XCircle className="w-3 h-3" />
                                                    Sem Perfil
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-2">
                                                {company.benefits && company.benefits.filter(b => b.status === "ATIVO").length > 0 ? (
                                                    company.benefits.filter(b => b.status === "ATIVO").map(b => (
                                                        <span key={b.id} className="text-[10px] font-bold px-2 py-1 rounded-md bg-brand-primary/10 text-brand-primary border border-brand-primary/20 whitespace-nowrap">
                                                            {b.benefit.nome}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-text-muted italic">Nenhum</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/empresas/detalhes/${company.id}`)}
                                                    className="flex items-center gap-1 p-1.5 px-3 rounded-md hover:bg-brand-primary/10 text-brand-primary font-bold text-[11px] transition-all cursor-pointer uppercase tracking-wider"
                                                    title="Mostrar detalhes"
                                                >
                                                    Mostrar Detalhes
                                                </button>
                                                <button
                                                    onClick={() => setOpenDropdown(openDropdown === company.id ? null : company.id)}
                                                    className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </div>

                                            {openDropdown === company.id && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                                    <div className="absolute right-8 top-10 mt-2 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                                                        <div className="py-1 flex flex-col">
                                                            <button
                                                                onClick={() => navigate(`/empresas/editar/${company.id}`)}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                            >
                                                                <Edit2 className="w-4 h-4" /> Editar Detalhes
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleDelete(company.id, company.nome_fantasia || company.razao_social);
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
            </div>
        </div>
    );
};

export default EmpresasList;
