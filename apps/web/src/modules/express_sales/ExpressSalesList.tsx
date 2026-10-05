import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2, Copy, Zap, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import Modal from '../../components/modals/Modal';

interface ExpressBudgetSummary {
  id: string;
  numero_orcamento: string;
  titulo: string;
  status: string;
  data_orcamento: string;
  customer_nome: string;
  vendedor_nome?: string;
  responsavel_nome?: string;
  sales_team_nome?: string;
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
  EM_LANCAMENTO: 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200',
  ENVIADO_APROVACAO: 'bg-blue-100 text-blue-800 dark:bg-blue-900/60 dark:text-blue-200',
  RETORNADO_VENDEDOR: 'bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200',
  APROVADO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-200',
  CANCELADO: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
  GANHO: 'bg-teal-100 text-teal-800 dark:bg-teal-900/60 dark:text-teal-200',
  PERDIDO: 'bg-rose-100 text-rose-800 dark:bg-rose-900/60 dark:text-rose-200',
};

const statusLabels: Record<string, string> = {
  EM_LANCAMENTO: 'Em Lançamento',
  ENVIADO_APROVACAO: 'Em Aprovação',
  RETORNADO_VENDEDOR: 'Devolvido',
  APROVADO: 'Aprovado',
  CANCELADO: 'Cancelado',
  GANHO: 'Ganho',
  PERDIDO: 'Perdido',
};

export function ExpressSalesList() {
  const navigate = useNavigate();
  const [budgets, setBudgets] = useState<ExpressBudgetSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [responsaveis, setResponsaveis] = useState<any[]>([]);
  const [vendedorFilter, setVendedorFilter] = useState('');
  const [responsavelFilter, setResponsavelFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const itemsPerPage = 25;

  const [budgetToDelete, setBudgetToDelete] = useState<ExpressBudgetSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  useEffect(() => {
    const loadFiltersData = async () => {
      try {
        const [vendedoresRes, usersRes] = await Promise.all([
          api.get('/professionals', { params: { limit: 500 } }),
          api.get('/users', { params: { limit: 500 } }),
        ]);
        setVendedores(Array.isArray(vendedoresRes.data) ? vendedoresRes.data : vendedoresRes.data.items || []);
        setResponsaveis(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.items || []);
      } catch (err) {
        console.error('Erro ao carregar dados de filtros:', err);
      }
    };
    loadFiltersData();
  }, []);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, vendedorFilter, responsavelFilter]);

  useEffect(() => {
    loadBudgets();
  }, [page, debouncedSearch, statusFilter, vendedorFilter, responsavelFilter]);

  const loadBudgets = async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * itemsPerPage;
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: itemsPerPage.toString(),
        express_only: 'true',
      });
      if (debouncedSearch) params.append('q', debouncedSearch);
      if (statusFilter) params.append('status', statusFilter);
      if (vendedorFilter) params.append('vendedor_id', vendedorFilter);
      if (responsavelFilter) params.append('responsavel_id', responsavelFilter);

      const res = await api.get(`/sales-budgets?${params.toString()}`);
      setBudgets(res.data.items || []);
      setTotalItems(res.data.total || 0);
      setTotalPages(Math.ceil((res.data.total || 0) / itemsPerPage));
    } catch (err) {
      console.error('Erro ao carregar vendas express:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateClick = async (budget: ExpressBudgetSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Deseja duplicar a venda express "${budget.titulo}"?`)) return;
    setDuplicatingId(budget.id);
    try {
      const response = await api.post(`/sales-budgets/${budget.id}/duplicate`);
      const clone = response.data;
      navigate(`/comercial/vendas-express/${clone.id}`);
    } catch (err: any) {
      console.error('Erro ao duplicar venda express:', err);
      const msg = err.response?.data?.detail || err.message || 'Erro desconhecido';
      alert(`Falha ao duplicar venda express: ${msg}`);
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleDeleteClick = (budget: ExpressBudgetSummary, e: React.MouseEvent) => {
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
      console.error('Erro ao excluir venda express:', err);
      const msg = err.response?.data?.detail || err.message || 'Erro desconhecido';
      setDeleteError(`Falha ao excluir venda express: ${msg}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 space-y-6 pb-20 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
              <Zap className="w-3.5 h-3.5" />
              Varejo & Comercial Ágil
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2.5 mt-1">
            <span>Vendas Express</span>
          </h1>
          <p className="text-text-muted text-sm mt-0.5">
            Gerencie e lance vendas express com cálculo ágil de kits de produtos e recorrência mensal
          </p>
        </div>
        <Button
          onClick={() => navigate('/comercial/vendas-express/novo')}
          className="flex items-center gap-2 bg-brand-primary text-white font-bold px-5 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all"
        >
          <Plus className="w-4 h-4" />
          Nova Venda Express
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por título, número ou cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border-subtle rounded-xl bg-bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3.5 py-2 border border-border-subtle rounded-xl bg-bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
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
        <select
          value={vendedorFilter}
          onChange={(e) => setVendedorFilter(e.target.value)}
          className="px-3.5 py-2 border border-border-subtle rounded-xl bg-bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
        >
          <option value="">Todos os vendedores</option>
          {vendedores.map((v: any) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
        <select
          value={responsavelFilter}
          onChange={(e) => setResponsavelFilter(e.target.value)}
          className="px-3.5 py-2 border border-border-subtle rounded-xl bg-bg-surface text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
        >
          <option value="">Todos os responsáveis</option>
          {responsaveis.map((r: any) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Grid Table */}
      {loading ? (
        <div className="p-12 text-center text-text-muted bg-bg-surface border border-border-subtle rounded-2xl">
          <p className="font-medium animate-pulse">Carregando listagem de Vendas Express...</p>
        </div>
      ) : budgets.length === 0 ? (
        <div className="text-center py-16 px-4 bg-bg-surface border border-border-subtle rounded-2xl space-y-4 shadow-sm">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-600 rounded-2xl flex items-center justify-center mx-auto">
            <Zap className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-text-primary">Nenhuma Venda Express Encontrada</h3>
            <p className="text-sm text-text-muted mt-1 max-w-md mx-auto">
              {search || statusFilter || vendedorFilter || responsavelFilter
                ? 'Nenhum resultado corresponde aos filtros selecionados. Tente limpar os filtros para visualizar todas.'
                : 'Comece criando sua primeira Venda Express com seleção rápida de kits e cálculo automático.'}
            </p>
          </div>
          <Button
            onClick={() => navigate('/comercial/vendas-express/novo')}
            className="bg-brand-primary text-white font-bold px-5 py-2.5 rounded-xl inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Criar Primeira Venda Express
          </Button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border-subtle bg-bg-surface shadow-sm transition-all duration-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse text-left">
              <thead>
                <tr className="bg-bg-deep/45 text-text-muted border-b border-border-subtle/80">
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Nº Venda</th>
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Venda Express</th>
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Cliente</th>
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Vendedor</th>
                  <th className="py-3.5 px-5 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">Total Venda</th>
                  <th className="py-3.5 px-5 text-right text-xs font-bold uppercase tracking-wider whitespace-nowrap">Margem</th>
                  <th className="py-3.5 px-5 text-center text-xs font-bold uppercase tracking-wider whitespace-nowrap">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50">
                {budgets.map((b) => (
                  <tr
                    key={b.id}
                    onClick={() => navigate(`/comercial/vendas-express/${b.id}`)}
                    className="group hover:bg-bg-subtle/60 cursor-pointer transition-colors"
                  >
                    <td className="py-4 px-5 align-middle font-mono text-xs font-bold text-text-primary whitespace-nowrap">
                      <span className="bg-bg-subtle px-2 py-0.5 rounded border border-border-subtle">
                        {b.numero_orcamento || '—'}
                      </span>
                    </td>
                    <td className="py-4 px-5 align-middle max-w-[280px]">
                      <span className="font-semibold text-text-primary group-hover:text-brand-primary transition-colors line-clamp-2" title={b.titulo}>
                        {b.titulo}
                      </span>
                    </td>
                    <td className="py-4 px-5 align-middle max-w-[220px]">
                      <span className="text-text-muted text-sm line-clamp-2" title={b.customer_nome || '—'}>
                        {b.customer_nome || '—'}
                      </span>
                    </td>
                    <td className="py-4 px-5 align-middle">
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap ${statusColors[b.status] || 'bg-slate-100 text-slate-800'}`}>
                        {statusLabels[b.status] || b.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 align-middle text-text-muted text-sm max-w-[160px] truncate" title={b.vendedor_nome || b.responsavel_nome || '—'}>
                      {b.vendedor_nome || b.responsavel_nome || '—'}
                    </td>
                    <td className="py-4 px-5 text-right align-middle">
                      <div className="font-bold text-text-primary text-sm whitespace-nowrap tabular-nums">
                        {formatCurrency(b.total_venda + b.total_faturamento_rental)}
                      </div>
                      {b.valor_mensal_total_rental > 0 && (
                        <div className="text-[11px] text-text-muted">
                          {formatCurrency(b.valor_mensal_total_rental)}/mês
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-5 text-right align-middle">
                      <span className="inline-flex items-center justify-center px-2 py-0.5 rounded border border-border-subtle bg-bg-deep font-bold text-brand-primary text-xs tabular-nums shadow-sm">
                        {Number(b.margem_geral || 0).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-4 px-5 text-center align-middle">
                      <div className="flex items-center justify-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); navigate(`/comercial/vendas-express/${b.id}`); }}
                          className="p-1.5 rounded-lg hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-colors"
                          title="Visualizar / Editar Venda Express"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDuplicateClick(b, e)}
                          disabled={duplicatingId === b.id}
                          className="p-1.5 rounded-lg hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary disabled:opacity-50 transition-colors"
                          title="Duplicar Venda Express"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteClick(b, e)}
                          className="p-1.5 rounded-lg hover:bg-rose-500/10 text-text-muted hover:text-rose-600 transition-colors"
                          title="Excluir Venda Express"
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

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-border-subtle bg-bg-deep/40">
              <div className="text-xs text-text-muted">
                Mostrando <span className="font-semibold text-text-primary">{(page - 1) * itemsPerPage + 1}</span> a{' '}
                <span className="font-semibold text-text-primary">
                  {Math.min(page * itemsPerPage, totalItems)}
                </span>{' '}
                de <span className="font-semibold text-text-primary">{totalItems}</span> vendas express
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
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-semibold transition-colors ${
                        page === p
                          ? 'bg-brand-primary text-white shadow-sm'
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

      {/* Modal de Exclusão */}
      <Modal
        isOpen={!!budgetToDelete}
        onClose={() => !isDeleting && setBudgetToDelete(null)}
        title="Excluir Venda Express"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-700 dark:text-rose-400">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-semibold text-sm">Tem certeza que deseja excluir esta venda express?</p>
              <p className="text-xs mt-1 leading-relaxed">
                Essa ação é definitiva. A proposta <strong>{budgetToDelete?.titulo}</strong> ({budgetToDelete?.numero_orcamento}) será permanentemente removida.
              </p>
            </div>
          </div>

          {deleteError && (
            <div className="text-sm text-rose-600 bg-rose-50 p-3 rounded-lg font-medium border border-rose-200">
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
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Sim, Excluir Venda Express'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ExpressSalesList;
