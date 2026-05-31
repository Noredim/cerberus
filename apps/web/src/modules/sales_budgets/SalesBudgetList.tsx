import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Receipt, Search, Eye, Trash2, Info } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { OpportunityCreateModal } from '../../components/modals/OpportunityCreateModal';
import Modal from '../../components/modals/Modal';
import { AlertCircle } from 'lucide-react';

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
  EM_LANCAMENTO: 'bg-slate-100 text-slate-800 border border-slate-200',
  ENVIADO_APROVACAO: 'bg-blue-100 text-blue-800 border border-blue-200',
  RETORNADO_VENDEDOR: 'bg-amber-100 text-amber-800 border border-amber-200',
  APROVADO: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
  CANCELADO: 'bg-rose-100 text-rose-800 border border-rose-200',
  GANHO: 'bg-teal-100 text-teal-800 border border-teal-200',
  PERDIDO: 'bg-rose-100 text-rose-800 border border-rose-200',
};

const statusLabels: Record<string, string> = {
  EM_LANCAMENTO: 'Em Lançamento',
  ENVIADO_APROVACAO: 'Em Aprovação',
  RETORNADO_VENDEDOR: 'Devolvido',
  APROVADO: 'Aprovado',
  CANCELADO: 'Cancelado',
  GANHO: 'Orçamento Ganho',
  PERDIDO: 'Perdido',
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
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 25;

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState<SalesBudgetSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1); // Reset to first page on new search
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    loadBudgets();
  }, [page, debouncedSearch, statusFilter]);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * itemsPerPage;
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: itemsPerPage.toString(),
      });
      if (debouncedSearch) params.append('q', debouncedSearch);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/sales-budgets?${params.toString()}`);
      setBudgets(res.data.items || []);
      setTotalItems(res.data.total || 0);
      setTotalPages(Math.ceil((res.data.total || 0) / itemsPerPage));
    } catch (err) {
      console.error('Erro ao carregar orçamentos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (budget: SalesBudgetSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setBudgetToDelete(budget);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!budgetToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/sales-budgets/${budgetToDelete.id}`);
      await loadBudgets();
      setBudgetToDelete(null);
    } catch (err: any) {
      console.error('Erro ao excluir orçamento:', err);
      const msg = err.response?.data?.detail || err.message || 'Erro desconhecido';
      setDeleteError(`Falha ao excluir orçamento: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const filtered = budgets;

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
          <option value="EM_LANCAMENTO">Em Lançamento</option>
          <option value="ENVIADO_APROVACAO">Em Aprovação</option>
          <option value="RETORNADO_VENDEDOR">Devolvido</option>
          <option value="APROVADO">Aprovado</option>
          <option value="CANCELADO">Cancelado</option>
          <option value="GANHO">Ganho</option>
          <option value="PERDIDO">Perdido</option>
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
                        onClick={(e) => handleDeleteClick(b, e)}
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
          
          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle bg-bg-deep/50">
              <div className="text-sm text-text-muted">
                Mostrando <span className="font-medium text-text-primary">{(page - 1) * itemsPerPage + 1}</span> a{' '}
                <span className="font-medium text-text-primary">
                  {Math.min(page * itemsPerPage, totalItems)}
                </span>{' '}
                de <span className="font-medium text-text-primary">{totalItems}</span> resultados
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1 text-xs"
                >
                  Anterior
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-7 h-7 rounded flex items-center justify-center text-xs font-medium transition-colors ${
                        page === p
                          ? 'bg-brand-primary text-white'
                          : 'text-text-muted hover:bg-border-subtle'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <Button
                  variant="outline"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-xs"
                >
                  Próxima
                </Button>
              </div>
            </div>
          )}
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

      <Modal
        isOpen={!!budgetToDelete}
        onClose={() => !isDeleting && setBudgetToDelete(null)}
        title="Excluir Oportunidade"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-semibold text-sm">Tem certeza que deseja excluir esta oportunidade?</p>
              <p className="text-sm mt-1">Essa ação não poderá ser desfeita. O orçamento <strong>{budgetToDelete?.titulo}</strong> será permanentemente apagado.</p>
            </div>
          </div>
          
          {deleteError && (
             <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded font-medium border border-rose-100">
               {deleteError}
             </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-subtle">
            <Button
              variant="outline"
              onClick={() => setBudgetToDelete(null)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Sim, Excluir Oportunidade'}
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
