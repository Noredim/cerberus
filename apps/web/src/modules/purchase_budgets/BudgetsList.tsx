import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Plus, Edit2, Loader2, FileText } from 'lucide-react';
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
  const [page] = useState(1);
  const pageSize = 10;
  const [budgets, setBudgets] = useState<PurchaseBudget[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const response = await api.get('/purchase-budgets', {
          params: { skip: (page - 1) * pageSize, limit: pageSize }
        });
        setBudgets(response.data as PurchaseBudget[]);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [page, pageSize]);

  return (
    <div className="space-y-6 w-full">
      <header className="flex items-center justify-between">
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
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-primary" />
                    Carregando orçamentos...
                  </td>
                </tr>
              ) : (!budgets || budgets.length === 0) ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-text-muted flex flex-col items-center justify-center">
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
                      {row.supplier_nome_fantasia || 'N/A'}
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
                      <button
                        onClick={() => navigate(`/orcamentos-compras/${row.id}`)}
                        className="p-2 rounded-md hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-all cursor-pointer"
                        title="Ver/Editar"
                      >
                        <Edit2 className="w-4 h-4" />
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
