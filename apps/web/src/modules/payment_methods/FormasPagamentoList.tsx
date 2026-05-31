import React, { useEffect, useState } from 'react';
import {
    CreditCard,
    Search,
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

export interface FormaPagamentoParcela {
    id?: string;
    sequencia: number;
    descricao: string;
    intervalo_dias: number;
    percentual?: number | null;
    valor_fixo?: number | null;
}

export interface FormaPagamento {
    id: string;
    descricao: string;
    tipo_uso: 'COMPRA' | 'VENDA' | 'AMBOS';
    tipo_distribuicao: 'PERCENTUAL' | 'RATEIO_IGUAL' | 'VALOR_FIXO';
    ativo: boolean;
    observacao?: string | null;
    updated_at: string;
    parcelas: FormaPagamentoParcela[];
}

const FormasPagamentoList: React.FC = () => {
    const navigate = useNavigate();
    const [formas, setFormas] = useState<FormaPagamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const loadFormas = async () => {
        setLoading(true);
        try {
            const response = await api.get('/cadastro/formas-pagamento');
            setFormas(response.data);
        } catch (err) {
            console.error('Erro ao buscar formas de pagamento:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFormas();
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Deseja realmente excluir a forma de pagamento "${name}"?`)) return;
        try {
            await api.delete(`/cadastro/formas-pagamento/${id}`);
            setFormas(prev => prev.filter(f => f.id !== id));
        } catch (err: any) {
            console.error(err);
            const errorMsg = err.response?.data?.detail || 'Erro ao excluir forma de pagamento.';
            alert(errorMsg);
        }
    };

    const filteredFormas = formas.filter(f => 
        f.descricao.toLowerCase().includes(search.toLowerCase()) ||
        f.tipo_uso.toLowerCase().includes(search.toLowerCase()) ||
        f.tipo_distribuicao.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6 w-full">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
                        Formas de <span className="text-brand-primary">Pagamento</span>
                    </h1>
                    <p className="text-text-muted mt-1">Gerencie as condições comerciais de parcelamento para Vendas e Compras.</p>
                </div>

                <button
                    onClick={() => navigate('/cadastros/formas-pagamento/novo')}
                    className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm"
                >
                    <Plus className="w-5 h-5" />
                    Nova Forma
                </button>
            </header>

            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm flex flex-col">
                <div className="p-5 border-b border-border-subtle flex items-center justify-between bg-surface gap-4">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                        <input
                            type="text"
                            placeholder="Buscar por descrição, tipo..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                        />
                    </div>
                </div>

                <div className="min-h-[200px]">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
                            <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                <th className="px-6 py-3 font-semibold">Descrição</th>
                                <th className="px-6 py-3 font-semibold">Tipo Uso</th>
                                <th className="px-6 py-3 font-semibold">Distribuição</th>
                                <th className="px-6 py-3 font-semibold">Parcelas</th>
                                <th className="px-6 py-3 font-semibold">Status</th>
                                <th className="px-6 py-3 font-semibold">Última Modificação</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            <AnimatePresence mode='popLayout'>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-10 text-center text-text-muted">
                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                                            Carregando formas de pagamento...
                                        </td>
                                    </tr>
                                ) : filteredFormas.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-10 text-center text-text-muted">
                                            Nenhuma forma de pagamento cadastrada.
                                        </td>
                                    </tr>
                                ) : filteredFormas.map((forma, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        transition={{ delay: i * 0.03 }}
                                        key={forma.id}
                                        className="group hover:bg-bg-deep transition-colors"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-md bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                                                    <CreditCard className="w-4 h-4" />
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-text-primary">{forma.descricao}</span>
                                                    {forma.observacao && (
                                                        <span className="text-xs text-text-muted truncate max-w-[250px]">{forma.observacao}</span>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 text-[10px] font-bold bg-bg-deep border border-border-subtle rounded text-text-muted uppercase tracking-tight">
                                                {forma.tipo_uso}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 text-[10px] font-bold bg-bg-deep border border-border-subtle rounded text-text-muted uppercase tracking-tight">
                                                {forma.tipo_distribuicao.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-primary">
                                            {forma.parcelas?.length || 0}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md w-fit ${forma.ativo ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-danger/10 text-brand-danger'}`}>
                                                {forma.ativo ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                {forma.ativo ? 'ATIVO' : 'INATIVO'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-muted">
                                            {forma.updated_at ? new Date(forma.updated_at).toLocaleDateString('pt-BR') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={() => setOpenDropdown(openDropdown === forma.id ? null : forma.id)}
                                                className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {openDropdown === forma.id && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                                    <div className="absolute right-8 top-10 mt-2 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                                                        <div className="py-1 flex flex-col">
                                                            <button
                                                                onClick={() => navigate(`/cadastros/formas-pagamento/editar/${forma.id}`)}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                            >
                                                                <Edit2 className="w-4 h-4" /> Editar Forma
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleDelete(forma.id, forma.descricao);
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

export default FormasPagamentoList;
