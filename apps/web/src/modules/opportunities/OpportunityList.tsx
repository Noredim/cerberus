import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Handshake, Building2, Calendar, LayoutGrid, FileText } from 'lucide-react';
import { useOpportunities } from './hooks/useOpportunities';
import type { Opportunity } from './types';

export function OpportunityList() {
    const navigate = useNavigate();
    const { getOpportunities, loading, error } = useOpportunities();
    const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchOpps = async () => {
            try {
                const data = await getOpportunities();
                setOpportunities(data);
            } catch (err) {
                console.error('Failed to fetch opportunities:', err);
            }
        };
        fetchOpps();
    }, [getOpportunities]);

    const filteredOpps = opportunities.filter((op) =>
        op.titulo_oportunidade.toLowerCase().includes(searchTerm.toLowerCase()) ||
        op.numero_oportunidade.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'GANHA':
                return 'bg-green-100 text-green-800 border-green-200';
            case 'PERDIDA':
            case 'CANCELADA':
                return 'bg-red-100 text-red-800 border-red-200';
            case 'RASCUNHO':
                return 'bg-gray-100 text-gray-800 border-gray-200';
            default:
                return 'bg-blue-100 text-blue-800 border-blue-200';
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
                        <Handshake className="text-brand-primary" size={28} />
                        Oportunidades Comerciais
                    </h1>
                    <p className="text-text-secondary mt-1">Gerencie propostas, orçamentos e formação de preços</p>
                </div>
                <button
                    onClick={() => navigate('/oportunidades/nova')}
                    className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-brand-primary/90 transition-colors shadow-sm"
                >
                    <Plus size={20} />
                    <span>Nova Oportunidade</span>
                </button>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                    {error}
                </div>
            )}

            {/* Filters */}
            <div className="bg-surface border border-divider rounded-xl p-4 shadow-sm flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por Título ou Código (ex: OPP-XXX)..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-divider rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all text-sm"
                    />
                </div>
            </div>

            {/* Table */}
            <div className="bg-surface border border-divider rounded-xl shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-theme-bg/50 border-b border-divider text-xs uppercase tracking-wider text-text-muted">
                                <th className="p-4 font-semibold">Oportunidade</th>
                                <th className="p-4 font-semibold">Operação</th>
                                <th className="p-4 font-semibold">Valor Total</th>
                                <th className="p-4 font-semibold">Data Base</th>
                                <th className="p-4 font-semibold text-center">Status</th>
                                <th className="p-4 font-semibold text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-divider">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-text-muted">
                                        <div className="flex justify-center items-center gap-2">
                                            <div className="animate-spin w-5 h-5 border-2 border-brand-primary border-t-transparent rounded-full" />
                                            <span>Carregando Oportunidades...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredOpps.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-text-muted">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <FileText size={40} className="text-divider opacity-50" />
                                            <p>Nenhuma oportunidade encontrada</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredOpps.map((opp) => (
                                    <tr key={opp.id} className="hover:bg-theme-bg/30 transition-colors group">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-brand-primary/10 text-brand-primary flex items-center justify-center flex-shrink-0">
                                                    <Handshake size={20} />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-text-primary group-hover:text-brand-primary transition-colors line-clamp-1">
                                                        {opp.titulo_oportunidade}
                                                    </h3>
                                                    <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                                                        <span className="font-mono bg-theme-bg px-1.5 py-0.5 rounded border border-divider text-[10px]">{opp.numero_oportunidade}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2 text-sm text-text-secondary">
                                                <LayoutGrid size={14} className="text-text-muted" />
                                                {opp.tipo_operacao === 'VENDA' ? 'Venda' : 'Locação/Comodato'}
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-text-muted mt-1">
                                                <Building2 size={12} />
                                                {opp.tipo_cliente === 'PRIVADO' ? 'Privado' : 'Público'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-sm font-semibold text-text-primary">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(opp.valor_total_calculado)}
                                            </div>
                                            {(opp.margem_estimada > 0) && (
                                                <div className="text-xs text-green-600 mt-1 font-medium">
                                                    Margem: {opp.margem_estimada}%
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-1.5 text-sm text-text-secondary">
                                                <Calendar size={14} className="text-text-muted" />
                                                {opp.data_abertura ? new Date(opp.data_abertura).toLocaleDateString('pt-BR') : '-'}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`inline-flex items-center justify-center px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider rounded-full border ${getStatusColor(opp.status)}`}>
                                                {opp.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => navigate(`/oportunidades/${opp.id}`)}
                                                className="text-sm text-brand-primary hover:text-brand-primary/80 font-medium px-3 py-1.5 rounded hover:bg-brand-primary/10 transition-colors"
                                            >
                                                Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
