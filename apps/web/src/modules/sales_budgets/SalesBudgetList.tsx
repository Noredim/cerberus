import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, Search, Copy, Eye, Trash2, Info } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { OpportunityCreateModal } from '../../components/modals/OpportunityCreateModal';

interface SalesBudgetSummary {
  id: string;
  numero_orcamento: string;
  titulo: string;
  status: string;
  data_orcamento: string;
  customer_nome: string;
  total_venda: number;
  margem_venda: number;
  total_faturamento_rental: number;
  valor_mensal_total_rental: number;
  prazo_max_rental: number;
  margem_rental: number;
  margem_geral: number;
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
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Tem certeza que deseja excluir este orçamento?')) return;
    try {
      await api.delete(`/sales-budgets/${id}`);
      loadBudgets();
    } catch (err) {
      console.error('Erro ao excluir orçamento:', err);
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
            Oportunidades
          </h1>
          <p className="text-text-muted text-sm mt-1">Gerencie suas oportunidades de negócio empresariais</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova Oportunidade
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
            {budgets.length === 0 ? 'Nenhuma oportunidade criada ainda.' : 'Nenhum resultado encontrado.'}
          </p>
          {budgets.length === 0 && (
            <Button onClick={() => setIsCreateModalOpen(true)} variant="outline" className="mt-2">
              <Plus className="w-4 h-4 mr-1" /> Criar primeira oportunidade
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-deep text-text-muted border-b border-border-subtle">
                <th className="text-left py-3 px-4 font-semibold uppercase tracking-wider">Oportunidade</th>
                <th className="text-left py-3 px-4 font-semibold uppercase tracking-wider">Cliente</th>
                <th className="text-left py-3 px-4 font-semibold uppercase tracking-wider">Status</th>
                <th className="text-right py-3 px-4 font-semibold uppercase tracking-wider">Resumo Venda</th>
                <th className="text-right py-3 px-4 font-semibold uppercase tracking-wider">Resumo Locação</th>
                <th className="text-right py-3 px-4 font-semibold uppercase tracking-wider whitespace-nowrap">Margem Geral</th>
                <th className="text-center py-3 px-4 font-semibold uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => (
                <tr
                  key={b.id}
                  onClick={() => navigate(`/orcamentos-vendas/${b.id}`)}
                  className="border-b border-border-subtle hover:bg-bg-deep/50 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4 w-1/4 max-w-[250px]">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-semibold text-text-primary line-clamp-2" title={b.titulo}>
                        {b.titulo}
                      </span>
                      <span className="text-xs font-mono text-brand-primary font-medium">
                        {b.numero_orcamento}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 w-1/5 max-w-[200px]">
                    <div className="text-sm text-text-muted line-clamp-2" title={b.customer_nome || '—'}>
                      {b.customer_nome || '—'}
                    </div>
                  </td>
                  <td className="py-3 px-4 w-32">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide tracking-wider ${statusColors[b.status] || ''}`}>
                      {statusLabels[b.status] || b.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <span className="font-semibold text-text-primary text-sm whitespace-nowrap">
                        {b.total_venda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                      {b.total_venda > 0 ? (
                        <MarginBadge margin={b.margem_venda} />
                      ) : (
                        <span className="text-xs text-text-muted">—</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {b.total_faturamento_rental > 0 ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <Tooltip content={
                          <div className="text-left space-y-1">
                            <p><span className="text-text-muted">Valor Mensal:</span> {b.valor_mensal_total_rental.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            <p><span className="text-text-muted">Prazo:</span> {b.prazo_max_rental} meses</p>
                          </div>
                        }>
                          <div className="flex items-center gap-1 cursor-help">
                            <span className="font-semibold text-brand-primary text-sm whitespace-nowrap">
                              {b.total_faturamento_rental.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                            <Info className="w-3.5 h-3.5 text-text-muted opacity-70" />
                          </div>
                        </Tooltip>
                        <MarginBadge margin={b.margem_rental} />
                      </div>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {b.margem_geral > 0 ? (
                      <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-md bg-bg-deep border border-border-subtle font-bold text-brand-primary text-xs">
                        {b.margem_geral.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
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
                      <button
                        onClick={(e) => handleDelete(b.id, e)}
                        className="p-1.5 rounded hover:bg-rose-100 text-text-muted hover:text-rose-600 transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <OpportunityCreateModal 
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(id) => {
          setIsCreateModalOpen(false);
          navigate(`/orcamentos-vendas/${id}`);
        }}
      />
    </div>
  );
}
