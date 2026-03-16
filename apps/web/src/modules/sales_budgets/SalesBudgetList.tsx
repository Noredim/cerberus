import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, Search, Copy, Eye } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';

interface SalesBudgetSummary {
  id: string;
  numero_orcamento: string;
  titulo: string;
  status: string;
  data_orcamento: string;
  customer_nome: string;
  total_venda: number;
  margem_media: number;
  created_at: string;
}

const statusColors: Record<string, string> = {
  RASCUNHO: 'bg-amber-100 text-amber-800',
  APROVADO: 'bg-emerald-100 text-emerald-800',
  ARQUIVADO: 'bg-gray-100 text-gray-600',
};

const statusLabels: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  APROVADO: 'Aprovado',
  ARQUIVADO: 'Arquivado',
};

function MarginBadge({ margin }: { margin: number }) {
  let cls = 'text-rose-600 bg-rose-50';
  let label = 'Crítico';
  if (margin >= 15) { cls = 'text-emerald-600 bg-emerald-50'; label = 'Saudável'; }
  else if (margin >= 5) { cls = 'text-amber-600 bg-amber-50'; label = 'Atenção'; }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {margin.toFixed(1)}% — {label}
    </span>
  );
}

export function SalesBudgetList() {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<SalesBudgetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    loadBudgets();
  }, []);

  const loadBudgets = async () => {
    try {
      const res = await api.get('/sales-budgets');
      setBudgets(res.data);
    } catch (err) {
      console.error('Erro ao carregar orçamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicate = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/sales-budgets/${id}/duplicate`);
      loadBudgets();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = budgets.filter(b => {
    const matchSearch = !search || b.titulo.toLowerCase().includes(search.toLowerCase()) ||
      b.numero_orcamento?.toLowerCase().includes(search.toLowerCase()) ||
      b.customer_nome?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Receipt className="w-7 h-7 text-brand-primary" />
            Orçamentos de Venda
          </h1>
          <p className="text-text-muted text-sm mt-1">Gerencie seus orçamentos de venda de mercadorias e serviços</p>
        </div>
        <Button onClick={() => navigate('/orcamentos-vendas/novo')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Orçamento
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por título, número ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        >
          <option value="">Todos os status</option>
          <option value="RASCUNHO">Rascunho</option>
          <option value="APROVADO">Aprovado</option>
          <option value="ARQUIVADO">Arquivado</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <Receipt className="w-12 h-12 text-text-muted mx-auto opacity-40" />
          <p className="text-text-muted">
            {budgets.length === 0 ? 'Nenhum orçamento criado ainda.' : 'Nenhum resultado encontrado.'}
          </p>
          {budgets.length === 0 && (
            <Button onClick={() => navigate('/orcamentos-vendas/novo')} variant="outline" className="mt-2">
              <Plus className="w-4 h-4 mr-1" /> Criar primeiro orçamento
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-deep text-text-muted border-b border-border-subtle">
                <th className="text-left py-3 px-4 font-semibold">Nº</th>
                <th className="text-left py-3 px-4 font-semibold">Título</th>
                <th className="text-left py-3 px-4 font-semibold">Cliente</th>
                <th className="text-left py-3 px-4 font-semibold">Status</th>
                <th className="text-right py-3 px-4 font-semibold">Total Venda</th>
                <th className="text-right py-3 px-4 font-semibold">Margem</th>
                <th className="text-left py-3 px-4 font-semibold">Data</th>
                <th className="text-center py-3 px-4 font-semibold">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => navigate(`/orcamentos-vendas/${b.id}`)}
                  className="border-b border-border-subtle hover:bg-bg-deep/50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 font-mono text-xs text-brand-primary font-semibold">{b.numero_orcamento}</td>
                  <td className="py-3 px-4 text-text-primary font-medium">{b.titulo}</td>
                  <td className="py-3 px-4 text-text-muted">{b.customer_nome || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusColors[b.status] || ''}`}>
                      {statusLabels[b.status] || b.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-text-primary">
                    {b.total_venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <MarginBadge margin={b.margem_media} />
                  </td>
                  <td className="py-3 px-4 text-text-muted text-xs">
                    {new Date(b.data_orcamento).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/orcamentos-vendas/${b.id}`); }}
                        className="p-1.5 rounded hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-colors"
                        title="Visualizar"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDuplicate(b.id, e)}
                        className="p-1.5 rounded hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-colors"
                        title="Duplicar"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
