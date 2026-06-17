import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Trash2, Calendar, FileText, Briefcase, TrendingUp, DollarSign, Award, AlertCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/modals/Modal';
import { QuickCustomerCreateModal } from '../../components/modals/QuickCustomerCreateModal';

interface LicitacaoSummary {
  id: string;
  numero_edital: string;
  descricao: string;
  data_publicacao: string;
  data_licitacao: string;
  status: string;
  modalidade: string;
  tipo_licitacao: string;
  customer_id: string;
  customer_nome?: string;
  valor_total_estimado: number;
  valor_total_venda: number;
  margem_ponderada_global: number;
  precisa_aprovacao_diretoria: boolean;
  aprovado_diretoria: boolean;
}

const statusColors: Record<string, string> = {
  Criada: 'bg-slate-50/70 text-slate-600 border border-slate-200/80 dark:bg-slate-950/40 dark:text-slate-400 dark:border-slate-800/80',
  'Em Análise/Precificação': 'bg-blue-50/70 text-blue-600 border border-blue-200/60 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30',
  'Aprovada para Envio': 'bg-amber-50/70 text-amber-600 border border-amber-200/60 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30',
  Ganha: 'bg-emerald-50/70 text-emerald-600 border border-emerald-200/60 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/30',
  Perdida: 'bg-rose-50/70 text-rose-600 border border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30',
  Suspensa: 'bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30',
  Cancelada: 'bg-rose-50/70 text-rose-600 border border-rose-200/60 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30',
};

const modalidadeOptions = ['Pregão', 'Concorrência', 'Concurso', 'Leilão'];
const tipoLicitacaoOptions = [
  'Menor preço',
  'Melhor técnica',
  'Técnica e preço',
  'Maior retorno econômico',
  'Maior desconto'
];

export function LicitacaoList() {
  const navigate = useNavigate();
  const { activeCompanyId } = useAuth();
  const [licitacoes, setLicitacoes] = useState<LicitacaoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const itemsPerPage = 25;

  // KPIs
  const [kpiEstimado, setKpiEstimado] = useState(0);
  const [kpiFaturado, setKpiFaturado] = useState(0);
  const [kpiMargem, setKpiMargem] = useState(0);

  // Modal Novo Edital
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);

  // Form State
  const [numeroEdital, setNumeroEdital] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [modalidade, setModalidade] = useState('Pregão');
  const [tipoLicitacao, setTipoLicitacao] = useState('Menor preço');
  const [dataPublicacao, setDataPublicacao] = useState('');
  const [dataLicitacao, setDataLicitacao] = useState('');
  const [dataLimiteQuestionamento, setDataLimiteQuestionamento] = useState('');
  const [descricao, setDescricao] = useState('');
  const [createError, setCreateError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Exclusão
  const [licitacaoToDelete, setLicitacaoToDelete] = useState<LicitacaoSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(handler);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  useEffect(() => {
    if (activeCompanyId) {
      loadLicitacoes();
    }
  }, [page, debouncedSearch, statusFilter, activeCompanyId]);

  useEffect(() => {
    if (isCreateModalOpen) {
      loadCustomers();
      // Reset form fields
      setNumeroEdital('');
      setCustomerId('');
      setModalidade('Pregão');
      setTipoLicitacao('Menor preço');
      setDataPublicacao('');
      setDataLicitacao('');
      setDataLimiteQuestionamento('');
      setDescricao('');
      setCreateError('');
    }
  }, [isCreateModalOpen]);

  const loadCustomers = async () => {
    try {
      const { data } = await api.get('/cadastro/clientes', { params: { limit: 500 } });
      setCustomers(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      console.error('Falha ao carregar clientes:', err);
    }
  };

  const loadLicitacoes = async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * itemsPerPage;
      const params = new URLSearchParams({
        skip: skip.toString(),
        limit: itemsPerPage.toString(),
      });
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get(`/licitacoes?${params.toString()}`);
      const items: LicitacaoSummary[] = res.data.items || [];
      
      // Client-side local filter for search query to be highly responsive
      let filteredItems = items;
      if (debouncedSearch) {
        const query = debouncedSearch.toLowerCase();
        filteredItems = items.filter(
          l =>
            l.numero_edital.toLowerCase().includes(query) ||
            (l.customer_nome && l.customer_nome.toLowerCase().includes(query)) ||
            (l.descricao && l.descricao.toLowerCase().includes(query))
        );
      }

      setLicitacoes(filteredItems);

      // Calculate aggregate KPIs from the fetched dataset
      let sumEstimado = 0;
      let sumFaturado = 0;
      let sumVendaTotal = 0;
      let weightedMargemSum = 0;

      items.forEach(l => {
        const est = Number(l.valor_total_estimado || 0);
        const vda = Number(l.valor_total_venda || 0);
        const mrg = Number(l.margem_ponderada_global || 0);

        sumEstimado += est;
        if (l.status === 'Ganha') {
          sumFaturado += vda;
        }
        if (vda > 0) {
          sumVendaTotal += vda;
          weightedMargemSum += vda * mrg;
        }
      });

      setKpiEstimado(sumEstimado);
      setKpiFaturado(sumFaturado);
      setKpiMargem(sumVendaTotal > 0 ? weightedMargemSum / sumVendaTotal : 0);

    } catch (err) {
      console.error('Erro ao carregar licitações:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCustomerSuccess = (newCustomer: any) => {
    setCustomers(prev => [...prev, newCustomer]);
    setCustomerId(newCustomer.id);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numeroEdital || !customerId || !modalidade || !tipoLicitacao) {
      setCreateError('Por favor, preencha todos os campos obrigatórios (*).');
      return;
    }

    setSubmitting(true);
    setCreateError('');

    try {
      const payload = {
        company_id: activeCompanyId,
        customer_id: customerId,
        numero_edital: numeroEdital,
        descricao: descricao || null,
        data_publicacao: dataPublicacao ? new Date(dataPublicacao).toISOString() : null,
        data_licitacao: dataLicitacao ? new Date(dataLicitacao).toISOString() : null,
        data_limite_questionamento: dataLimiteQuestionamento ? new Date(dataLimiteQuestionamento).toISOString() : null,
        status: 'Criada',
        modalidade,
        tipo_licitacao: tipoLicitacao,
        lotes: []
      };

      const res = await api.post('/licitacoes', payload);
      setIsCreateModalOpen(false);
      navigate(`/comercial/licitacoes/${res.data.id}`);
    } catch (err: any) {
      console.error(err);
      setCreateError(err.response?.data?.detail || err.message || 'Erro ao criar edital');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteClick = (licitacao: LicitacaoSummary, e: React.MouseEvent) => {
    e.stopPropagation();
    setLicitacaoToDelete(licitacao);
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!licitacaoToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/licitacoes/${licitacaoToDelete.id}`);
      await loadLicitacoes();
      setLicitacaoToDelete(null);
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.response?.data?.detail || err.message || 'Falha ao excluir edital');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-brand-primary" />
            Editais de Licitação
          </h1>
          <p className="text-text-muted text-sm mt-1">Gerencie editais públicos, lotes de itens e preços de lances</p>
        </div>
        <Button onClick={() => setIsCreateModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Novo Edital
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm flex items-center gap-4 transition-all duration-300">
          <div className="p-3.5 bg-blue-500/10 rounded-lg text-blue-500">
            <DollarSign className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Total Estimado (Editais)</span>
            <span className="text-xl font-bold text-text-primary mt-1 block tabular-nums">
              {kpiEstimado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className="p-5 bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm flex items-center gap-4 transition-all duration-300">
          <div className="p-3.5 bg-emerald-500/10 rounded-lg text-emerald-500">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Faturado (Licitações Ganhas)</span>
            <span className="text-xl font-bold text-text-primary mt-1 block tabular-nums">
              {kpiFaturado.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </span>
          </div>
        </div>

        <div className="p-5 bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm flex items-center gap-4 transition-all duration-300">
          <div className="p-3.5 bg-brand-primary/10 rounded-lg text-brand-primary">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xs text-text-muted font-semibold uppercase tracking-wider block">Margem Geral Ponderada</span>
            <span className="text-xl font-bold text-text-primary mt-1 block tabular-nums">
              {kpiMargem.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="Buscar por número, cliente ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-border-subtle rounded-md bg-bg-deep text-text-primary text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all duration-150"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-border-subtle rounded-md bg-bg-deep text-text-primary text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all duration-150"
        >
          <option value="">Todos os status</option>
          <option value="Criada">Criada</option>
          <option value="Em Análise/Precificação">Em Análise/Precificação</option>
          <option value="Aprovada para Envio">Aprovada para Envio</option>
          <option value="Ganha">Ganha</option>
          <option value="Perdida">Perdida</option>
          <option value="Suspensa">Suspensa</option>
          <option value="Cancelada">Cancelada</option>
        </select>
      </div>

      {/* Main Table */}
      {loading ? (
        <div className="text-center py-12 text-text-muted">Carregando editais...</div>
      ) : licitacoes.length === 0 ? (
        <div className="text-center py-16 space-y-3">
          <FileText className="w-12 h-12 text-text-muted mx-auto opacity-40" />
          <p className="text-text-muted">
            {licitacoes.length === 0 ? 'Nenhum edital cadastrado ainda.' : 'Nenhum edital encontrado para o filtro.'}
          </p>
          {licitacoes.length === 0 && (
            <Button onClick={() => setIsCreateModalOpen(true)} variant="outline" className="mt-2">
              <Plus className="w-4 h-4 mr-1" /> Cadastrar primeiro edital
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border-subtle/80 bg-bg-surface shadow-sm transition-all duration-300">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-bg-deep/45 text-text-muted border-b border-border-subtle/80">
                <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Número Edital</th>
                <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Órgão/Cliente</th>
                <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Modalidade / Tipo</th>
                <th className="text-right py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Valor Estimado</th>
                <th className="text-right py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Valor Lance</th>
                <th className="text-right py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Margem Global</th>
                <th className="text-left py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Status</th>
                <th className="text-center py-3.5 px-5 text-xs font-bold uppercase tracking-wider whitespace-nowrap">Ações</th>
              </tr>
            </thead>
            <tbody>
              {licitacoes.map((l) => (
                <tr
                  key={l.id}
                  onClick={() => navigate(`/comercial/licitacoes/${l.id}`)}
                  className="group border-b border-border-subtle/50 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 cursor-pointer transition-all duration-200"
                >
                  <td className="py-4 px-5 align-middle">
                    <span className="text-sm font-semibold text-text-primary group-hover:text-brand-primary transition-colors">
                      {l.numero_edital}
                    </span>
                  </td>
                  <td className="py-4 px-5 align-middle max-w-[200px] truncate" title={l.customer_nome || '—'}>
                    <span className="text-sm text-text-muted">{l.customer_nome || '—'}</span>
                  </td>
                  <td className="py-4 px-5 align-middle">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-text-primary">{l.modalidade}</span>
                      <span className="text-[10px] text-text-muted">{l.tipo_licitacao}</span>
                    </div>
                  </td>
                  <td className="py-4 px-5 text-right align-middle font-medium text-text-muted tabular-nums">
                    {Number(l.valor_total_estimado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-4 px-5 text-right align-middle font-bold text-text-primary tabular-nums">
                    {Number(l.valor_total_venda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="py-4 px-5 text-right align-middle">
                    <span className="inline-flex px-2 py-0.5 rounded border border-border-subtle bg-bg-deep font-semibold text-brand-primary text-xs tabular-nums shadow-sm">
                      {Number(l.margem_ponderada_global || 0).toFixed(2)}%
                    </span>
                  </td>
                  <td className="py-4 px-5 align-middle">
                    <span className={`inline-flex px-2.5 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${statusColors[l.status] || ''}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="py-4 px-5 text-center align-middle">
                    <div className="flex items-center justify-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity duration-200">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/comercial/licitacoes/${l.id}`); }}
                        className="p-1.5 rounded hover:bg-brand-primary/10 text-text-muted hover:text-brand-primary transition-all duration-150"
                        title="Ver / Editar"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteClick(l, e)}
                        className="p-1.5 rounded hover:bg-rose-50 text-text-muted hover:text-rose-600 transition-all duration-150"
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

      {/* Creation Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => !submitting && setIsCreateModalOpen(false)}
        title="Novo Edital de Licitação"
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          {createError && (
            <div className="p-3 bg-brand-danger/10 border border-brand-danger/25 rounded-lg text-xs text-brand-danger flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{createError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Número do Edital *</label>
              <input
                type="text"
                required
                value={numeroEdital}
                onChange={e => setNumeroEdital(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary text-sm text-text-primary"
                placeholder="Ex: Pregão Eletrônico nº 10/2026"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center gap-2">
                <label className="text-sm font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Órgão / Cliente *</label>
                <button
                  type="button"
                  onClick={() => setShowQuickCustomer(true)}
                  className="text-brand-primary hover:underline text-xs flex items-center gap-0.5 whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3 h-3" /> Cadastrar Novo
                </button>
              </div>
              <select
                required
                value={customerId}
                onChange={e => setCustomerId(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary text-sm text-text-primary"
              >
                <option value="">Selecione o órgão público...</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Modalidade *</label>
              <select
                value={modalidade}
                onChange={e => setModalidade(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary text-sm text-text-primary"
              >
                {modalidadeOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-bold text-text-muted uppercase tracking-wider whitespace-nowrap">Tipo de Licitação *</label>
              <select
                value={tipoLicitacao}
                onChange={e => setTipoLicitacao(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary text-sm text-text-primary"
              >
                {tipoLicitacaoOptions.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" />
                Data de Publicação
              </label>
              <input
                type="date"
                value={dataPublicacao}
                onChange={e => setDataPublicacao(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary text-sm text-text-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" />
                Limite Questionamento/Impugnação
              </label>
              <input
                type="date"
                value={dataLimiteQuestionamento}
                onChange={e => setDataLimiteQuestionamento(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary text-sm text-text-primary"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-text-muted shrink-0" />
                Abertura / Certame
              </label>
              <input
                type="date"
                value={dataLicitacao}
                onChange={e => setDataLicitacao(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary text-sm text-text-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Objeto / Descrição</label>
            <textarea
              rows={3}
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder="Descreva resumidamente o objeto da licitação..."
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 outline-none focus:border-brand-primary text-sm text-text-primary resize-none"
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => setIsCreateModalOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={submitting}
            >
              {submitting ? 'Criando...' : 'Criar Edital'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!licitacaoToDelete}
        onClose={() => !isDeleting && setLicitacaoToDelete(null)}
        title="Excluir Edital"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-semibold text-sm">Tem certeza que deseja excluir este edital?</p>
              <p className="text-sm mt-1">
                A remoção deste edital removerá permanentemente todos os lotes, itens e kits de oportunidade associados (deleção em cascata). Esta ação não poderá ser desfeita.
              </p>
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
              onClick={() => setLicitacaoToDelete(null)}
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
              {isDeleting ? 'Excluindo...' : 'Sim, Excluir Edital'}
            </Button>
          </div>
        </div>
      </Modal>

      <QuickCustomerCreateModal
        isOpen={showQuickCustomer}
        onClose={() => setShowQuickCustomer(false)}
        onSuccess={handleCreateCustomerSuccess}
      />
    </div>
  );
}
