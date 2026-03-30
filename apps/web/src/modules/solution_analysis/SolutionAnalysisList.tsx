import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, GitCompare, Search, Eye, Pencil, Trash2, Printer } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { PrintReportModal } from './PrintReportModal';

interface AnalysisSummary {
  id: string;
  titulo: string;
  tipo_analise: string;
  nome_solucao_a: string | null;
  nome_solucao_b: string | null;
  nome_solucao_c: string | null;
  criado_por_nome: string | null;
  usuario_id: string | null;
  created_at: string;
  updated_at: string;
  qtde_linhas: number;
  total_a: number;
  total_b: number;
  total_c: number;
  melhor_solucao_geral: string | null;
}

const BRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const tipoLabel: Record<string, string> = {
  REVENDA: 'Revenda',
  LOCACAO: 'Locação/Comodato',
};

function BestBadge({ sol, nomes }: { sol: string | null; nomes: Record<string, string> }) {
  if (!sol) return <span className="text-text-muted text-xs">—</span>;
  if (sol === 'EMPATE')
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
        Empate
      </span>
    );
  const label = nomes[sol] || `Solução ${sol}`;
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
      {label}
    </span>
  );
}

export function SolutionAnalysisList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [printAnaliseId, setPrintAnaliseId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data } = await api.get('/solution-analysis');
      setAnalyses(data);
    } catch (err) {
      console.error('Erro ao carregar análises:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Excluir esta análise?')) return;
    try {
      await api.delete(`/solution-analysis/${id}`);
      loadData();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = analyses.filter(
    (a) => !search || a.titulo.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <GitCompare className="w-7 h-7 text-brand-primary" />
            Análise de Soluções
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Compare até 3 soluções por custo e identifique a melhor opção
          </p>
        </div>
        <Button onClick={() => navigate('/comercial/comparativos/novo')} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Nova Análise
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder="Buscar por título..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Carregando...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <GitCompare className="w-12 h-12 text-text-muted mx-auto opacity-40" />
          <p className="text-text-muted">
            {analyses.length === 0 ? 'Nenhuma análise criada ainda.' : 'Nenhum resultado.'}
          </p>
          {analyses.length === 0 && (
            <Button onClick={() => navigate('/comercial/comparativos/novo')} variant="outline">
              <Plus className="w-4 h-4 mr-1" /> Criar primeira análise
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-subtle">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-deep text-text-muted border-b border-border-subtle">
                <th className="text-left py-3 px-4 font-semibold uppercase tracking-wider">Título</th>
                <th className="text-left py-3 px-4 font-semibold uppercase tracking-wider">Tipo</th>
                <th className="text-left py-3 px-4 font-semibold uppercase tracking-wider">Proprietário</th>
                <th className="text-center py-3 px-4 font-semibold uppercase tracking-wider">Linhas</th>
                <th className="text-right py-3 px-4 font-semibold uppercase tracking-wider whitespace-nowrap">Total A</th>
                <th className="text-right py-3 px-4 font-semibold uppercase tracking-wider whitespace-nowrap">Total B</th>
                <th className="text-right py-3 px-4 font-semibold uppercase tracking-wider whitespace-nowrap">Total C</th>
                <th className="text-center py-3 px-4 font-semibold uppercase tracking-wider">Melhor</th>
                <th className="text-center py-3 px-4 font-semibold uppercase tracking-wider">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const isOwner = a.usuario_id === user?.id;
                const nomes: Record<string, string> = {
                  A: a.nome_solucao_a || 'Solução A',
                  B: a.nome_solucao_b || 'Solução B',
                  C: a.nome_solucao_c || 'Solução C',
                };
                return (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/comercial/comparativos/${a.id}`)}
                    className="border-b border-border-subtle hover:bg-bg-deep/50 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-text-primary line-clamp-1">{a.titulo}</span>
                        <span className="text-xs text-text-muted block mt-0.5">
                          {new Date(a.created_at).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-text-secondary text-xs">
                      <span className="px-2 py-0.5 bg-bg-deep rounded border border-border-subtle font-medium">
                        {tipoLabel[a.tipo_analise] || a.tipo_analise}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-text-muted text-sm">{a.criado_por_nome || '—'}</td>
                    <td className="py-3 px-4 text-center text-text-secondary">{a.qtde_linhas}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-text-primary">{BRL(a.total_a)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-text-primary">{BRL(a.total_b)}</td>
                    <td className="py-3 px-4 text-right tabular-nums text-text-primary">{BRL(a.total_c)}</td>
                    <td className="py-3 px-4 text-center">
                      <BestBadge sol={a.melhor_solucao_geral} nomes={nomes} />
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/comercial/comparativos/${a.id}`); }}
                            className="p-1.5 rounded hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-colors"
                            title="Visualizar"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setPrintAnaliseId(a.id); }}
                            className="p-1.5 rounded hover:bg-slate-100 text-text-muted hover:text-slate-700 transition-colors"
                            title="Imprimir Análise"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        {isOwner && (
                          <>
                            <button
                              onClick={(e) => { e.stopPropagation(); navigate(`/comercial/comparativos/${a.id}`); }}
                              className="p-1.5 rounded hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-colors"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(a.id, e)}
                              className="p-1.5 rounded hover:bg-rose-100 text-text-muted hover:text-rose-600 transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Print Report Modal — triggered from list row */}
      <PrintReportModal
        isOpen={!!printAnaliseId}
        onClose={() => setPrintAnaliseId(null)}
        analise={null}
        analiseId={printAnaliseId ?? undefined}
      />
    </div>
  );
}
