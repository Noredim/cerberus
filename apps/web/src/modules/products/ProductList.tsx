import React, { useEffect, useState } from 'react';
import {
    Package,
    Search,
    Filter,
    MoreVertical,
    Plus,
    CheckCircle2,
    XCircle,
    Loader2,
    Edit2,
    Trash2,
    Activity,
    Briefcase,
    ArrowRight,
    Key
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { productApi } from './api/productApi';
import { useAuth } from '../../contexts/AuthContext';
import type { Product } from './types';

const formatCurrency = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const ProductList: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const isAdmin = user?.roles?.includes('Administrador');

    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const fetchProducts = async () => {
        setLoading(true);
        try {
            const data = await productApi.list({
                q: search,
                tipo: typeFilter || undefined
            });
            setProducts(data);
        } catch (error) {
            console.error('Error fetching products:', error);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 300);
        return () => clearTimeout(timer);
    }, [search, typeFilter]);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Certeza que deseja excluir o produto "${name}"? Esta ação não pode ser desfeita.`)) return;
        try {
            await productApi.delete(id);
            fetchProducts();
        } catch (error: any) {
            console.error('Delete error:', error);
            const msg = error.response?.data?.detail || 'Erro ao excluir produto.';
            alert(msg);
        }
    };

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                        Gestão de <span className="text-brand-primary">Produtos</span>
                    </h1>
                    <p className="text-text-muted mt-1">Cadastre e gerencie equipamentos, serviços e suas regras fiscais.</p>
                </div>

                <div className="flex gap-4">
                    <button
                        onClick={() => navigate('/cadastro/produtos/novo')}
                        className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm shadow-brand-primary/20"
                    >
                        <Plus className="w-5 h-5" />
                        Novo Produto
                    </button>
                </div>
            </header>

            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm flex flex-col">
                <div className="p-5 border-b border-border-subtle flex flex-col md:flex-row md:items-center justify-between bg-surface gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por nome, SKU ou NCM..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                        />
                    </div>
                    <div className="flex gap-3">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="bg-bg-deep border border-border-subtle rounded-md py-1.5 px-3 text-sm text-text-primary focus:border-brand-primary outline-none transition-colors"
                        >
                            <option value="">Todos os Tipos</option>
                            <option value="EQUIPAMENTO">Equipamento</option>
                            <option value="SERVICO">Serviço</option>
                            <option value="LICENCA">Licença</option>
                        </select>
                        <button className="p-1.5 rounded-md hover:bg-bg-deep text-text-muted border border-border-subtle transition-colors cursor-pointer" title="Configurações de Filtro">
                            <Filter className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="min-h-[200px] overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle">
                            <tr>
                                <th className="px-6 py-4">Produto</th>
                                <th className="px-6 py-4">SKU / Código</th>
                                <th className="px-6 py-4">Finalidade</th>
                                <th className="px-6 py-4">VLR Revenda</th>
                                <th className="px-6 py-4">VLR Uso/Consumo</th>
                                <th className="px-6 py-4">Fiscal (NCM/CMT)</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            <AnimatePresence mode='popLayout'>
                                {loading ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-12 text-center text-text-muted">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                                            Carregando produtos...
                                        </td>
                                    </tr>
                                ) : products.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-text-muted">
                                            Nenhum produto cadastrado.
                                        </td>
                                    </tr>
                                ) : products.map((product, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.03 }}
                                        key={product.id}
                                        className="group hover:bg-bg-deep/50 transition-colors"
                                    >
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${product.tipo === 'EQUIPAMENTO'
                                                    ? 'bg-brand-primary/10 text-brand-primary'
                                                    : product.tipo === 'SERVICO'
                                                    ? 'bg-indigo-500/10 text-indigo-500'
                                                    : 'bg-emerald-500/10 text-emerald-500'
                                                    }`}>
                                                    {product.tipo === 'EQUIPAMENTO' ? <Package className="w-5 h-5" /> : product.tipo === 'SERVICO' ? <Activity className="w-5 h-5" /> : <Key className="w-5 h-5" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-text-primary text-sm">{product.nome}</span>
                                                    <span className="text-xs text-text-muted">{product.unidade || 'UN'} | {product.categoria || 'Sem categoria'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="text-sm font-mono text-text-muted bg-bg-deep px-2 py-0.5 rounded border border-border-subtle">
                                                {product.codigo}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${product.finalidade === 'REVENDA'
                                                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                                }`}>
                                                <Briefcase className="w-3 h-3" />
                                                {product.finalidade}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-text-primary text-sm">
                                                    {formatCurrency(product.vlr_referencia_revenda)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-text-primary text-sm">
                                                    {formatCurrency(product.vlr_referencia_uso_consumo)}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                                            {product.tipo === 'EQUIPAMENTO' ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-text-primary">{product.ncm_codigo || '-'}</span>
                                                    <span className="text-[10px] text-text-muted">CEST: {product.cest_codigo || 'N/A'}</span>
                                                </div>
                                            ) : product.tipo === 'SERVICO' ? (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-text-primary">{product.cmt_codigo || '-'}</span>
                                                    <span className="text-[10px] text-indigo-500 font-bold uppercase">Serviço Municipal</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-text-primary">{product.ncm_codigo || '-'}</span>
                                                    <span className="text-[10px] text-emerald-500 font-bold uppercase">Software / Licença</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {product.ativo ? (
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md bg-brand-success/10 text-brand-success uppercase">
                                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                                    Ativo
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md bg-brand-danger/10 text-brand-danger uppercase">
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    Inativo
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => navigate(`/cadastro/produtos/detalhes/${product.id}`)}
                                                    className="p-2 rounded-md hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-all cursor-pointer"
                                                    title="Detalhes"
                                                >
                                                    <ArrowRight className="w-4 h-4" />
                                                </button>
                                                <div className="relative">
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setOpenDropdown(openDropdown === product.id ? null : product.id);
                                                        }}
                                                        className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                    {openDropdown === product.id && (
                                                        <>
                                                            <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                                            <div className="absolute right-0 top-full mt-2 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                                                                <div className="py-1 flex flex-col">
                                                                    {isAdmin ? (
                                                                        <>
                                                                            <button
                                                                                onClick={() => navigate(`/cadastro/produtos/editar/${product.id}`)}
                                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                                            >
                                                                                <Edit2 className="w-4 h-4" /> Editar
                                                                            </button>
                                                                            <button
                                                                                onClick={() => {
                                                                                    setOpenDropdown(null);
                                                                                    handleDelete(product.id, product.nome);
                                                                                }}
                                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-brand-danger hover:bg-brand-danger/10 transition-colors w-full text-left"
                                                                            >
                                                                                <Trash2 className="w-4 h-4" /> Excluir
                                                                            </button>
                                                                        </>
                                                                    ) : (
                                                                        <button
                                                                            onClick={() => navigate(`/cadastro/produtos/detalhes/${product.id}`)}
                                                                            className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                                        >
                                                                            <ArrowRight className="w-4 h-4" /> Ver Detalhes
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
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



export default ProductList;
