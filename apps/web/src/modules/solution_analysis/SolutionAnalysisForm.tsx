import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { AddItemsModal } from './AddItemsModal';
import { PrintReportModal } from './PrintReportModal';
import {
  GitCompare, Plus, Trash2, ArrowLeft, Save,
  TrendingUp, TrendingDown, AlertTriangle, Printer
} from 'lucide-react';

interface AnalysisItem {
  id: string;
  analise_id: string;
  sequencia: number;
  item_a_id: string | null;
  item_a_nome: string | null;
  qtd_a: number | null;
  vlr_unit_a: number | null;
  vlr_total_a: number | null;
  item_b_id: string | null;
  item_b_nome: string | null;
  qtd_b: number | null;
  vlr_unit_b: number | null;
  vlr_total_b: number | null;
  item_c_id: string | null;
  item_c_nome: string | null;
  qtd_c: number | null;
  vlr_unit_c: number | null;
  vlr_total_c: number | null;
  melhor_solucao: string | null;
  diferenca_valor: number | null;
  diferenca_percentual: number | null;
}

interface Analysis {
  id: string;
  titulo: string;
  tipo_analise: string;
  nome_solucao_a: string | null;
  nome_solucao_b: string | null;
  nome_solucao_c: string | null;
  usuario_id: string | null;
  criado_por_nome: string | null;
  created_at: string;
  updated_at: string;
  items: AnalysisItem[];
}

const BRL = (v: number | null | undefined) =>
  v != null ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v) : '—';

const PCT = (v: number | null | undefined) =>
  v != null ? `${Number(v).toFixed(2)}%` : '—';

/** Parse "[SKU-001]Camera Bullet..." → { code: "SKU-001", name: "Camera Bullet..." }
 *  Falls back gracefully for legacy entries stored without the [code] prefix. */
function parseItemNome(raw: string): { code: string | null; name: string } {
  const match = raw.match(/^\[([^\]]+)\](.+)$/);
  if (match) return { code: match[1], name: match[2] };
  return { code: null, name: raw };
}

function SolucaoCell({
  nome, qtd, vlrUnit, vlrTotal, isBest, isTie,
}: {
  nome: string | null;
  qtd: number | null;
  vlrUnit: number | null;
  vlrTotal: number | null;
  isBest: boolean;
  isTie: boolean;
}) {
  if (!nome) {
    return <td className="px-3 py-2 text-center text-text-muted text-xs" colSpan={4}>—</td>;
  }
  let cellCls = 'bg-transparent';
  if (isBest) cellCls = 'bg-emerald-50/60';
  if (isTie) cellCls = 'bg-amber-50/60';
  const { code, name } = parseItemNome(nome);
  return (
    <>
      <td className={`px-3 py-2 text-sm text-text-primary ${cellCls} min-w-[140px] max-w-[200px]`}>
        {code && (
          <span className="block mb-0.5">
            <span className="inline-flex items-center px-1.5 py-0 rounded text-[10px] font-mono font-semibold bg-slate-100 text-slate-500 border border-slate-200 leading-5">
              {code}
            </span>
          </span>
        )}
        <span className="block break-words whitespace-normal leading-tight">{name}</span>
      </td>
      <td className={`px-3 py-2 text-sm text-center tabular-nums ${cellCls}`}>{qtd}</td>
      <td className={`px-3 py-2 text-sm text-right tabular-nums ${cellCls}`}>{BRL(vlrUnit)}</td>
      <td className={`px-3 py-2 text-sm text-right tabular-nums font-medium ${cellCls} ${isBest ? 'text-emerald-700' : isTie ? 'text-amber-700' : ''}`}>
        {BRL(vlrTotal)}
      </td>
    </>
  );
}

function ResultadoCell({ item, nomes }: { item: AnalysisItem; nomes: Record<string, string> }) {
  const { melhor_solucao, diferenca_valor, diferenca_percentual } = item;
  if (!melhor_solucao) {
    return (
      <td className="px-3 py-2 text-text-muted text-xs text-center" colSpan={3}>
        <span className="text-xs">Sem comparação</span>
      </td>
    );
  }
  const label = melhor_solucao === 'EMPATE' ? 'Empate' : nomes[melhor_solucao] || `Sol. ${melhor_solucao}`;
  return (
    <>
      <td className="px-3 py-2 text-center">
        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${melhor_solucao === 'EMPATE' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
          {label}
        </span>
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-sm text-rose-600 font-medium">
        {BRL(diferenca_valor)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums text-sm text-rose-600 font-medium">
        {PCT(diferenca_percentual)}
      </td>
    </>
  );
}

export function SolutionAnalysisForm() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Extract ID from URL
  const pathParts = window.location.pathname.split('/');
  const urlId = pathParts[pathParts.length - 1];
  const isNew = urlId === 'novo';
  const analiseId = isNew ? null : urlId;

  const [analise, setAnalise] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPrintOpen, setIsPrintOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [titulo, setTitulo] = useState('');
  const [tipoAnalise, setTipoAnalise] = useState('REVENDA');
  const [nomeSolA, setNomeSolA] = useState('');
  const [nomeSolB, setNomeSolB] = useState('');
  const [nomeSolC, setNomeSolC] = useState('');

  const isOwner = !analise || (analise.usuario_id === user?.id);
  const headerSaved = !!analise;

  const loadAnalise = useCallback(async (id: string) => {
    try {
      const { data } = await api.get(`/solution-analysis/${id}`);
      setAnalise(data);
      setTitulo(data.titulo);
      setTipoAnalise(data.tipo_analise);
      setNomeSolA(data.nome_solucao_a || '');
      setNomeSolB(data.nome_solucao_b || '');
      setNomeSolC(data.nome_solucao_c || '');
    } catch {
      setError('Análise não encontrada');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (analiseId) loadAnalise(analiseId);
  }, [analiseId, loadAnalise]);

  const handleSaveHeader = async () => {
    if (!titulo.trim()) { setError('Título é obrigatório'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        titulo: titulo.trim(),
        tipo_analise: tipoAnalise,
        nome_solucao_a: nomeSolA.trim() || null,
        nome_solucao_b: nomeSolB.trim() || null,
        nome_solucao_c: nomeSolC.trim() || null,
      };
      if (analise) {
        const { data } = await api.patch(`/solution-analysis/${analise.id}`, payload);
        setAnalise(data);
      } else {
        const { data } = await api.post('/solution-analysis', payload);
        setAnalise(data);
        navigate(`/comercial/comparativos/${data.id}`, { replace: true });
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!analise) return;
    try {
      await api.delete(`/solution-analysis/${analise.id}/items/${itemId}`);
      setConfirmDeleteId(null);
      await loadAnalise(analise.id);
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao remover item');
    }
  };

  const nomes: Record<string, string> = {
    A: analise?.nome_solucao_a || 'Solução A',
    B: analise?.nome_solucao_b || 'Solução B',
    C: analise?.nome_solucao_c || 'Solução C',
  };

  // Totals
  const totalA = (analise?.items ?? []).reduce((s, i) => s + (Number(i.vlr_total_a) || 0), 0);
  const totalB = (analise?.items ?? []).reduce((s, i) => s + (Number(i.vlr_total_b) || 0), 0);
  const totalC = (analise?.items ?? []).reduce((s, i) => s + (Number(i.vlr_total_c) || 0), 0);

  const validTotals = Object.entries({ A: totalA, B: totalB, C: totalC }).filter(([, v]) => v > 0);
  const canShowResult = validTotals.length >= 2;
  const minSol = canShowResult ? validTotals.reduce((a, b) => b[1] < a[1] ? b : a) : null;

  if (loading) {
    return <div className="p-8 text-center text-text-muted">Carregando análise...</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-full">
      {/* Nav */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/comercial/comparativos')}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-deep transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-brand-primary" />
          {isNew ? 'Nova Análise de Soluções' : analise?.titulo || 'Análise de Soluções'}
        </h1>
      </div>

      {/* Header form */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider border-b border-border-subtle pb-2">
          Cabeçalho da Análise
        </h2>

        {error && (
          <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 px-3 py-2 rounded-lg text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-text-muted mb-1 uppercase">
              Título <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              maxLength={150}
              disabled={!isOwner}
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Título da análise..."
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-50"
            />
            <span className="text-xs text-text-muted mt-0.5">{titulo.length}/150</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted mb-1 uppercase">
              Tipo de Análise <span className="text-rose-500">*</span>
            </label>
            <select
              disabled={!isOwner}
              value={tipoAnalise}
              onChange={(e) => setTipoAnalise(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-50"
            >
              <option value="REVENDA">Revenda</option>
              <option value="LOCACAO">Locação / Comodato</option>
            </select>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['A', 'B', 'C'] as const).map((sol) => {
              const val = sol === 'A' ? nomeSolA : sol === 'B' ? nomeSolB : nomeSolC;
              const setter = sol === 'A' ? setNomeSolA : sol === 'B' ? setNomeSolB : setNomeSolC;
              return (
                <div key={sol}>
                  <label className="block text-xs font-semibold text-text-muted mb-1 uppercase">
                    Solução {sol}
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner}
                    value={val}
                    onChange={(e) => setter(e.target.value)}
                    placeholder={`Solução ${sol}`}
                    className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-50"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {isOwner && (
          <div className="flex justify-end">
            <Button onClick={handleSaveHeader} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : headerSaved ? 'Atualizar Cabeçalho' : 'Salvar Cabeçalho'}
            </Button>
          </div>
        )}
      </div>

      {/* Items grid */}
      {headerSaved && (
        <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden">
          {/* Grid header actions */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Grid Comparativa
            </h2>
            <div className="flex items-center gap-2">
              {analise && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsPrintOpen(true)}
                  className="gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  Imprimir Análise
                </Button>
              )}
              {isOwner && (
                <Button
                  size="sm"
                  onClick={() => setIsModalOpen(true)}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  Adicionar Itens
                </Button>
              )}
            </div>
          </div>

          {analise!.items.length === 0 ? (
            <div className="py-16 text-center text-text-muted space-y-2">
              <GitCompare className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm">Nenhum item adicionado ainda.</p>
              {isOwner && (
                <Button size="sm" variant="outline" onClick={() => setIsModalOpen(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar primeiro item
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-bg-deep text-text-muted border-b border-border-subtle">
                  <tr>
                    {/* Solução A */}
                    <th className="px-3 py-2 text-left font-semibold tracking-wider border-r border-border-subtle" colSpan={4}>
                      {nomes.A}
                    </th>
                    {/* Solução B */}
                    <th className="px-3 py-2 text-left font-semibold tracking-wider border-r border-border-subtle" colSpan={4}>
                      {nomes.B}
                    </th>
                    {/* Solução C */}
                    <th className="px-3 py-2 text-left font-semibold tracking-wider border-r border-border-subtle" colSpan={4}>
                      {nomes.C}
                    </th>
                    {/* Resultado */}
                    <th className="px-3 py-2 text-center font-semibold tracking-wider" colSpan={3}>
                      Resultado
                    </th>
                    <th className="px-3 py-2"></th>
                  </tr>
                  <tr className="bg-bg-deep/60 text-text-muted/80 border-b border-border-subtle">
                    {(['A', 'B', 'C'] as const).map((sol) => (
                      <>
                        <th key={`${sol}-item`} className="px-3 py-1.5 text-left font-medium">Item</th>
                        <th key={`${sol}-qtd`} className="px-3 py-1.5 text-center font-medium">Qtd</th>
                        <th key={`${sol}-unit`} className="px-3 py-1.5 text-right font-medium">Vlr Unit</th>
                        <th key={`${sol}-total`} className={`px-3 py-1.5 text-right font-medium ${sol !== 'C' ? 'border-r border-border-subtle' : ''}`}>
                          Vlr Total
                        </th>
                      </>
                    ))}
                    <th className="px-3 py-1.5 text-center font-medium border-l border-border-subtle">Melhor</th>
                    <th className="px-3 py-1.5 text-right font-medium">Diferença R$</th>
                    <th className="px-3 py-1.5 text-right font-medium">Diferença %</th>
                    <th className="px-3 py-1.5"></th>
                  </tr>
                </thead>
                <tbody>
                  {analise!.items.map((item) => {
                    const isBestA = item.melhor_solucao === 'A';
                    const isBestB = item.melhor_solucao === 'B';
                    const isBestC = item.melhor_solucao === 'C';
                    const isTie = item.melhor_solucao === 'EMPATE';
                    return (
                      <tr key={item.id} className="border-b border-border-subtle hover:bg-bg-deep/30 transition-colors">
                        <SolucaoCell
                          nome={item.item_a_nome}
                          qtd={item.qtd_a}
                          vlrUnit={item.vlr_unit_a}
                          vlrTotal={item.vlr_total_a}
                          isBest={isBestA}
                          isTie={isTie && !!item.item_a_nome}
                        />
                        <SolucaoCell
                          nome={item.item_b_nome}
                          qtd={item.qtd_b}
                          vlrUnit={item.vlr_unit_b}
                          vlrTotal={item.vlr_total_b}
                          isBest={isBestB}
                          isTie={isTie && !!item.item_b_nome}
                        />
                        <SolucaoCell
                          nome={item.item_c_nome}
                          qtd={item.qtd_c}
                          vlrUnit={item.vlr_unit_c}
                          vlrTotal={item.vlr_total_c}
                          isBest={isBestC}
                          isTie={isTie && !!item.item_c_nome}
                        />
                        <ResultadoCell item={item} nomes={nomes} />
                        <td className="px-3 py-2 min-w-[80px]">
                          {isOwner && (
                            confirmDeleteId === item.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="px-1.5 py-0.5 rounded text-xs font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-colors"
                                >
                                  Sim
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-1.5 py-0.5 rounded text-xs font-semibold bg-bg-deep text-text-muted hover:text-text-primary border border-border-subtle transition-colors"
                                >
                                  Não
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="p-1 rounded hover:bg-rose-100 text-text-muted hover:text-rose-600 transition-colors"
                                title="Remover linha"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                {/* Totals row */}
                <tfoot className="bg-bg-deep border-t-2 border-border-subtle">
                  <tr>
                    <td className="px-3 py-2 font-semibold text-text-primary text-sm" colSpan={3}>Total</td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-text-primary border-r border-border-subtle">
                      {BRL(totalA)}
                    </td>
                    <td className="px-3 py-2" colSpan={3}></td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-text-primary border-r border-border-subtle">
                      {BRL(totalB)}
                    </td>
                    <td className="px-3 py-2" colSpan={3}></td>
                    <td className="px-3 py-2 text-right tabular-nums font-bold text-text-primary border-r border-border-subtle">
                      {BRL(totalC)}
                    </td>
                    <td colSpan={4}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Final Result Card */}
      {headerSaved && analise!.items.length > 0 && (
        <div className="bg-bg-surface border border-border-subtle rounded-xl p-5">
          {!canShowResult ? (
            <div className="flex items-center gap-2 text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Necessário ao menos 2 soluções com valores para análise comparativa
            </div>
          ) : (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
                Resultado Final
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {validTotals.map(([sol, total]) => {
                  const isBest = sol === minSol?.[0];
                  return (
                    <div
                      key={sol}
                      className={`rounded-lg border px-4 py-3 ${isBest ? 'border-emerald-300 bg-emerald-50' : 'border-border-subtle bg-bg-deep/30'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {isBest
                          ? <TrendingDown className="w-4 h-4 text-emerald-600" />
                          : <TrendingUp className="w-4 h-4 text-text-muted" />}
                        <span className={`text-xs font-semibold uppercase tracking-wider ${isBest ? 'text-emerald-700' : 'text-text-muted'}`}>
                          {nomes[sol]}
                          {isBest && ' — MELHOR'}
                        </span>
                      </div>
                      <div className={`text-xl font-bold tabular-nums ${isBest ? 'text-emerald-700' : 'text-text-primary'}`}>
                        {BRL(total)}
                      </div>
                      {/* Saving vs other solutions */}
                      {isBest && validTotals.filter(([s]) => s !== sol).map(([s, t]) => (
                        <div key={s} className="text-xs text-emerald-600 mt-0.5">
                          Economia vs {nomes[s]}: {BRL(t - total)} ({PCT(((t - total) / t) * 100)})
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add Items Modal */}
      {analise && (
        <AddItemsModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          analise={analise}
          onSuccess={() => loadAnalise(analise.id)}
        />
      )}

      {/* Print Report Modal */}
      <PrintReportModal
        isOpen={isPrintOpen}
        onClose={() => setIsPrintOpen(false)}
        analise={analise}
      />
    </div>
  );
}
