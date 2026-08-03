import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Plus, Edit2, Trash2, Loader2, FileText, Search, AlertTriangle, X } from 'lucide-react';
import { api } from '../../services/api';


const formatDate = (date: string) => new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

interface PurchaseBudget {
  id: string;
  numero_orcamento?: string;
  data_orcamento: string;
  vendedor_nome: string;
  tipo_orcamento: string;
  supplier_nome_fantasia: string;
  valor_total: number;
  created_at: string;
}

const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

export function BudgetsList() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;
  const [budgets, setBudgets] = useState<PurchaseBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [blockedModal, setBlockedModal] = useState<{ isOpen: boolean; message: string } | null>(null);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/purchase-budgets', {
        params: {
          skip: (page - 1) * pageSize,
          limit: pageSize,
          q: debouncedSearch || undefined
        }
      });
      setBudgets(response.data as PurchaseBudget[]);
      const count = parseInt(response.headers['x-total-count'] || '0', 10);
      setTotalCount(count);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDeleteBudget = async (row: PurchaseBudget) => {
    if (!window.confirm(`Deseja realmente excluir a cotação ${row.numero_orcamento || row.id}?`)) {
      return;
    }
    try {
      setIsDeleting(row.id);
      await api.delete(`/purchase-budgets/${row.id}`);
      load();
    } catch (err: any) {
      console.error('Erro ao excluir orçamento:', err);
      const errorMsg = err.response?.data?.detail || 'Erro ao excluir orçamento de compras.';
      setBlockedModal({
        isOpen: true,
        message: errorMsg
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-6 w-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h1 className="text-3xl font-display font-bold text-text-primary tracking-tight">
               Orçamentos de <span className="text-brand-primary">Compra</span>
           </h1>
           <p className="text-text-muted mt-1">Gerenciamento de cotações, formação de preço e custos de aquisição.</p>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => navigate('/orcamentos-compras/novo')}
            className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm shadow-brand-primary/20"
          >
            <Plus className="w-5 h-5" />
            Novo Orçamento
          </button>
        </div>
      </header>

      {/* Bar de Busca */}
      <div className="card p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar cotação por nome do fornecedor ou num. da cotação..."
            className="w-full bg-bg-deep border border-border-subtle rounded-md pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="card w-full overflow-hidden">
        <div className="min-h-[200px] overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-[11px] font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle">
              <tr>
                <th className="px-6 py-4">Num. da Cotação</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Fornecedor</th>
                <th className="px-6 py-4">Vendedor</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4">Valor do Orçamento</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle bg-surface">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                    Carregando orçamentos...
                  </td>
                </tr>
              ) : (!budgets || budgets.length === 0) ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-text-muted flex flex-col items-center justify-center">
                    <FileText className="w-12 h-12 text-text-muted/30 mb-3" />
                    Nenhum orçamento encontrado.
                  </td>
                </tr>
              ) : (
                budgets.map((row) => (
                  <tr key={row.id} className="group hover:bg-bg-deep/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-medium">
                      {row.numero_orcamento || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary">
                      {formatDate(row.data_orcamento)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-primary font-medium">
                      {row.supplier_nome_fantasia || row.vendedor_nome || 'FORNECEDOR'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-muted">
                      {row.vendedor_nome || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge variant={row.tipo_orcamento === 'REVENDA' ? 'success' : 'info'}>
                        {row.tipo_orcamento}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-text-primary">
                      {formatCurrency(row.valor_total || 0)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/orcamentos-compras/${row.id}`)}
                          className="p-2 rounded-md hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-all cursor-pointer"
                          title="Ver/Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteBudget(row)}
                          disabled={isDeleting === row.id}
                          className="p-2 rounded-md hover:bg-brand-danger/10 text-text-muted hover:text-brand-danger transition-all cursor-pointer disabled:opacity-50"
                          title="Excluir Cotação"
                        >
                          <Trash2 className="w-4 h-4 text-brand-danger" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border-subtle bg-surface px-6 py-4">
            <div className="flex flex-1 justify-between sm:hidden">
              <button
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page === 1}
                className="relative inline-flex items-center rounded-md border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg-deep disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Anterior
              </button>
              <button
                onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                disabled={page === totalPages}
                className="relative ml-3 inline-flex items-center rounded-md border border-border-subtle bg-surface px-4 py-2 text-sm font-medium text-text-muted hover:bg-bg-deep disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Próximo
              </button>
            </div>
            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-text-muted">
                  Mostrando <span className="font-semibold text-text-primary">{(page - 1) * pageSize + 1}</span> a{' '}
                  <span className="font-semibold text-text-primary">
                    {Math.min(page * pageSize, totalCount)}
                  </span>{' '}
                  de <span className="font-semibold text-text-primary">{totalCount}</span> resultados
                </p>
              </div>
              <div>
                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                  <button
                    onClick={() => setPage(1)}
                    disabled={page === 1}
                    className="relative inline-flex items-center rounded-l-md px-3 py-2 text-text-muted ring-1 ring-inset ring-border-subtle hover:bg-bg-deep focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Primeira
                  </button>
                  <button
                    onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                    disabled={page === 1}
                    className="relative inline-flex items-center px-3 py-2 text-text-muted ring-1 ring-inset ring-border-subtle hover:bg-bg-deep focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Anterior
                  </button>
                  <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-text-primary ring-1 ring-inset ring-border-subtle">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center px-3 py-2 text-text-muted ring-1 ring-inset ring-border-subtle hover:bg-bg-deep focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Próxima
                  </button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={page === totalPages}
                    className="relative inline-flex items-center rounded-r-md px-3 py-2 text-text-muted ring-1 ring-inset ring-border-subtle hover:bg-bg-deep focus:z-20 focus:outline-offset-0 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Última
                  </button>
                </nav>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Aviso: Oportunidade Vinculada */}
      {blockedModal?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="card w-full max-w-md shadow-2xl border-none p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-brand-danger/10 flex items-center justify-center text-brand-danger shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-text-primary">Não é possível excluir</h3>
                <p className="text-sm text-text-muted mt-2 leading-relaxed">
                  {blockedModal.message}
                </p>
              </div>
              <button
                onClick={() => setBlockedModal(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-full hover:bg-bg-deep transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setBlockedModal(null)}
                className="bg-brand-primary text-white px-5 py-2 rounded-md font-medium text-sm hover:bg-brand-primary/90 transition-colors shadow-sm cursor-pointer"
              >
                Compreendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

