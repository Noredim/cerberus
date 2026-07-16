import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  ArrowLeft, Save, Plus, Edit2, Trash2, FileText, Briefcase, 
  FileSpreadsheet, Package, ChevronRight, ChevronDown, 
  Loader2, AlertCircle, ShieldAlert, Award, RefreshCw, Layers, History, Users, Search, TrendingUp,
  CheckSquare, ListTodo, MessageSquare, UserCheck, Activity, Clock, Trash, Play,
  LayoutDashboard
} from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/modals/Modal';
import { useCompanies } from '../companies/hooks/useCompanies';
import { Tooltip } from '../../components/ui/Tooltip';
import { LicitacaoDashboard } from './components/LicitacaoDashboard';
import { PurchaseBudgetSearchModal } from '../../components/modals/PurchaseBudgetSearchModal';

interface KitItem {
  id: string;
  nome_kit: string;
  tipo_contrato: string;
  quantidade_kits: number;
  perc_comissao: number;
  summary?: {
    valor_mensal_kit: number;
    custo_total_mensal_kit: number;
    lucro_mensal_kit: number;
    vlr_instal_calc: number;
    imposto_instalacao: number;
    margem_kit: number;
    venda_total?: number;
    custo_total?: number;
    lucro_estimado?: number;
    margem_geral?: number;
    venda_unitario?: number;
    custo_unitario?: number;
    custo_aquisicao_kit?: number;
    custo_aquisicao_total?: number;
    total_ipi_kit?: number;
    total_st_kit?: number;
    total_difal_kit?: number;
    valor_impostos?: number;
    vlt_frete_venda?: number;
    vlt_despesas_adm?: number;
    vlt_comissao?: number;
    valor_venda_instalacao?: number;
  };
}

interface LicitacaoItemData {
  id: string;
  lote_id: string;
  codigo: string;
  nome: string;
  descricao?: string;
  quantidade: number;
  tipo_fornecimento: string;
  total_meses?: number | null;
  quantidade_total: number;
  kits: KitItem[];
  custo_unitario?: number | null;
  custo_total?: number;
  venda_unitario?: number | null;
  venda_total?: number;
  lucro_estimado?: number;
  margem_geral?: number;
}

interface LicitacaoLoteData {
  id: string;
  licitacao_id: string;
  numero: string;
  nome: string;
  descricao?: string;
  items: LicitacaoItemData[];
  custo_total?: number;
  venda_total?: number;
  lucro_estimado?: number;
  margem_geral?: number;
}

interface LicitacaoDetail {
  id: string;
  numero_edital: string;
  descricao?: string;
  data_publicacao?: string;
  data_licitacao?: string;
  data_limite_questionamento?: string;
  status: string;
  modalidade: string;
  tipo_licitacao: string;
  customer_id: string;
  customer_nome?: string;
  po_id?: string | null;
  po_nome?: string | null;
  valor_total_estimado: number;
  valor_total_venda: number;
  margem_ponderada_global: number;
  precisa_aprovacao_diretoria: boolean;
  aprovado_diretoria: boolean;
  lotes: LicitacaoLoteData[];
  analistas: any[];
  created_at?: string;
  custo_total?: number;
  lucro_estimado?: number;
  totais_status?: string;
  totais_atualizados_em?: string;
}

interface PurchaseBudgetSummary {
  id: string;
  numero_orcamento: string;
  data_orcamento: string;
  vendedor_nome?: string;
  supplier_id?: string;
  supplier_nome?: string;
  licitacao_id?: string | null;
}

const modalidadeOptions = ['Pregão', 'Concorrência', 'Concurso', 'Leilão'];
const tipoLicitacaoOptions = [
  'Menor preço',
  'Melhor técnica',
  'Técnica e preço',
  'Maior retorno econômico',
  'Maior desconto'
];
const statusOptions = [
  'Criada',
  'Em Análise/Precificação',
  'Aprovada para Envio',
  'Ganha',
  'Perdida',
  'Suspensa',
  'Cancelada'
];

export function LicitacaoForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeCompanyId, user } = useAuth();
  const { lookupCNPJ } = useCompanies();

  const [loading, setLoading] = useState(true);
  const [savingHeader, setSavingHeader] = useState(false);
  const [detail, setDetail] = useState<LicitacaoDetail | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  
  // Tabs State
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'dashboard';
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Lists
  const [customers, setCustomers] = useState<any[]>([]);
  const [purchaseBudgets, setPurchaseBudgets] = useState<PurchaseBudgetSummary[]>([]);
  const [availableBudgets, setAvailableBudgets] = useState<PurchaseBudgetSummary[]>([]);
  const [selectedBudgetToLink, setSelectedBudgetToLink] = useState('');
  const [isPurchaseSearchModalOpen, setIsPurchaseSearchModalOpen] = useState(false);
  const [isApprover, setIsApprover] = useState(false);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const [statesList, setStatesList] = useState<any[]>([]);

  // Header form states
  const [numeroEdital, setNumeroEdital] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [modalidade, setModalidade] = useState('Pregão');
  const [tipoLicitacao, setTipoLicitacao] = useState('Menor preço');
  const [dataPublicacao, setDataPublicacao] = useState('');
  const [dataLicitacao, setDataLicitacao] = useState('');
  const [dataLimiteQuestionamento, setDataLimiteQuestionamento] = useState('');
  const [status, setStatus] = useState('Criada');
  const [descricao, setDescricao] = useState('');
  const [poId, setPoId] = useState('');

  // Checklist and Technical Applications States
  const [checklistGroups, setChecklistGroups] = useState<any[]>([]);
  const [loadingChecklist, setLoadingChecklist] = useState(false);
  const [techAplicacaoModal, setTechAplicacaoModal] = useState<{ open: boolean; itemId: string; name: string } | null>(null);
  const [selectedTechAnalystId, setSelectedTechAnalystId] = useState('');
  const [techObservation, setTechObservation] = useState('');

  // Tasks States
  const [tasksList, setTasksList] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskModal, setTaskModal] = useState<{ open: boolean; editId?: string; title: string; desc: string; respId: string; limitDate: string; checklistItemId?: string; checklistAplicacaoId?: string } | null>(null);
  const [andamentoModal, setAndamentoModal] = useState<{ open: boolean; task: any; newDesc: string } | null>(null);
  const [statusFilter, setStatusFilter] = useState('Todos');

  // Team Tab States
  const [selectedAnalystId, setSelectedAnalystId] = useState('');
  const [analystPrazo, setAnalystPrazo] = useState(4);
  const [addingAnalyst, setAddingAnalyst] = useState(false);

  // Quick Client Creation States
  const [quickClientModal, setQuickClientModal] = useState(false);
  const [quickCnpj, setQuickCnpj] = useState('');
  const [quickCnpjLoading, setQuickCnpjLoading] = useState(false);
  const [quickClientData, setQuickClientData] = useState<any>(null);
  const [quickEsfera, setQuickEsfera] = useState('MUNICIPAL');
  const [quickClientError, setQuickClientError] = useState<string | null>(null);

  // Selected item on the tree
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [expandedLotes, setExpandedLotes] = useState<Record<string, boolean>>({});

  // DRE state
  const [dreData, setDreData] = useState<any>(null);
  const [loadingDre, setLoadingDre] = useState(false);

  // CRUD Modals
  const [loteModal, setLoteModal] = useState<{ open: boolean; editId?: string; numero: string; nome: string; descricao: string } | null>(null);
  const [itemModal, setItemModal] = useState<{ open: boolean; editId?: string; loteId: string; codigo: string; nome: string; descricao: string; quantidade: number; tipo_fornecimento: string; total_meses: number | null } | null>(null);
  const [kitCreateModal, setKitCreateModal] = useState<{ open: boolean; itemId: string; nome_kit: string; tipo_contrato: string; prazo_contrato_meses: number; prazo_instalacao_meses: number } | null>(null);

  // Deletions Warnings
  const [deleteWarning, setDeleteWarning] = useState<{ type: 'lote' | 'item' | 'kit'; targetId: string; parentId?: string; title: string; message: string } | null>(null);
  const [isPerformingDelete, setIsPerformingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Edit lock indicator
  const isLocked = ['Ganha', 'Perdida', 'Cancelada'].includes(detail?.status || '');

  const isPOOrManager = String(detail?.po_id) === String(user?.id) || 
    user?.roles?.some(r => ['ADMIN', 'DIRETORIA', 'GERENTE'].includes(r));

  // Task cancel permission check
  const canCancelTask = isPOOrManager;

  useEffect(() => {
    if (id) {
      loadAll();
    }
  }, [id]);

  const ensureCustomersLoaded = async () => {
    if (customers.length > 0) return;
    try {
      const res = await api.get('/cadastro/clientes', { params: { limit: 500 } });
      setCustomers(Array.isArray(res.data) ? res.data : res.data.items || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const ensureUsersLoaded = async () => {
    if (usersList.length > 0) return;
    try {
      const res = await api.get('/users', { params: { limit: 500 } });
      setUsersList(res.data || []);
    } catch (err) {
      console.error('Failed to load users:', err);
    }
  };

  const ensureStatesLoaded = async () => {
    if (statesList.length > 0) return;
    try {
      const res = await api.get('/catalog/states');
      setStatesList(res.data || []);
    } catch (err) {
      console.error('Failed to load states:', err);
    }
  };

  const loadDataForTab = (tabName: string) => {
    if (tabName === 'dados_gerais') {
      ensureCustomersLoaded();
    } else if (tabName === 'equipe') {
      ensureUsersLoaded();
    } else if (tabName === 'checklist') {
      loadChecklist();
      ensureUsersLoaded();
    } else if (tabName === 'tarefas') {
      loadTasks();
      ensureUsersLoaded();
    } else if (tabName === 'orcamentos') {
      loadPurchaseBudgets();
    } else if (tabName === 'timeline') {
      loadHistory();
    } else if (tabName === 'dre') {
      loadDre();
    }
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [detRes, appRes] = await Promise.all([
        api.get(`/licitacoes/${id}`),
        api.get('/sales-budgets/check-approver')
      ]);

      const d: LicitacaoDetail = detRes.data;
      setDetail(d);
      setIsApprover(appRes.data.is_approver || false);

      // Set header states
      setNumeroEdital(d.numero_edital);
      setCustomerId(d.customer_id);
      setModalidade(d.modalidade);
      setTipoLicitacao(d.tipo_licitacao);
      setDataPublicacao(d.data_publicacao ? new Date(d.data_publicacao).toISOString().slice(0, 10) : '');
      setDataLicitacao(d.data_licitacao ? new Date(d.data_licitacao).toISOString().slice(0, 10) : '');
      setDataLimiteQuestionamento(d.data_limite_questionamento ? new Date(d.data_limite_questionamento).toISOString().slice(0, 10) : '');
      setStatus(d.status);
      setDescricao(d.descricao || '');
      setPoId(d.po_id || '');

      // Expand all lotes by default
      const expansions: Record<string, boolean> = {};
      d.lotes.forEach(l => {
        expansions[l.id] = true;
      });
      setExpandedLotes(expansions);

      // Load additional data depending on the initial tab
      loadDataForTab(initialTab);

    } catch (err) {
      console.error(err);
      alert('Erro ao carregar detalhes do edital.');
    } finally {
      setLoading(false);
    }
  };

  const loadPurchaseBudgets = async () => {
    try {
      const res = await api.get('/purchase-budgets', { params: { limit: 500 } });
      const allBudgets = Array.isArray(res.data) ? res.data : (res.data.items || []);
      const linked = allBudgets.filter((b: any) => b.licitacao_id === id);
      // Show all budgets that are not already linked to the current licitacao
      const available = allBudgets.filter((b: any) => b.licitacao_id !== id);
      setPurchaseBudgets(linked);
      setAvailableBudgets(available);
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await api.get(`/licitacoes/${id}/history`);
      setHistoryList(res.data);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

  const loadDre = async () => {
    setLoadingDre(true);
    try {
      const res = await api.get(`/licitacoes/${id}/drv`);
      setDreData(res.data);
    } catch (err) {
      console.error('Failed to load DRV data:', err);
    } finally {
      setLoadingDre(false);
    }
  };

  const loadChecklist = async () => {
    setLoadingChecklist(true);
    try {
      const res = await api.get(`/licitacoes/${id}/checklist`);
      setChecklistGroups(res.data);
    } catch (err) {
      console.error('Failed to load checklist:', err);
    } finally {
      setLoadingChecklist(false);
    }
  };

  const loadTasks = async () => {
    setLoadingTasks(true);
    try {
      const res = await api.get(`/licitacoes/${id}/tarefas`);
      setTasksList(res.data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoadingTasks(false);
    }
  };

  const getTeamMembers = () => {
    const members: { id: string; name: string }[] = [];
    if (detail?.po_id) {
      members.push({ id: detail.po_id, name: detail.po_nome || 'P.O.' });
    }
    detail?.analistas?.forEach(a => {
      if (a.usuario_id !== detail.po_id) {
        members.push({ id: a.usuario_id, name: a.usuario_name || a.usuario_nome || 'Analista' });
      }
    });
    return members;
  };

  const handleCreateChecklistItem = async (grupoId: string, nome: string, descricao: string) => {
    if (!nome) return;
    try {
      setLoadingChecklist(true);
      await api.post(`/licitacoes/${id}/checklist/grupos/${grupoId}/items`, {
        nome,
        descricao: descricao || null
      });
      await loadChecklist();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao criar item de checklist.');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleDeleteChecklistItem = async (itemId: string) => {
    if (!window.confirm('Deseja realmente excluir este item do checklist?')) return;
    try {
      setLoadingChecklist(true);
      await api.delete(`/licitacoes/${id}/checklist/items/${itemId}`);
      await loadChecklist();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao excluir item de checklist.');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleChecklistItemUpdate = async (itemId: string, newStatus?: string, newUsuarioId?: string) => {
    try {
      setLoadingChecklist(true);
      await api.put(`/licitacoes/${id}/checklist/items/${itemId}`, {
        status: newStatus !== undefined ? newStatus : undefined,
        usuario_id: newUsuarioId !== undefined ? newUsuarioId : undefined
      });
      await loadChecklist();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao atualizar item do checklist.');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleCreateTechAplicacao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techAplicacaoModal || !selectedTechAnalystId) return;
    try {
      setLoadingChecklist(true);
      await api.post(`/licitacoes/${id}/checklist/items/${techAplicacaoModal.itemId}/aplicacoes`, {
        usuario_id: selectedTechAnalystId,
        observacao: techObservation || null
      });
      setTechAplicacaoModal(null);
      setSelectedTechAnalystId('');
      setTechObservation('');
      await loadChecklist();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao criar aplicação técnica.');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleUpdateTechAplicacao = async (aplicacaoId: string, newStatus: string) => {
    try {
      setLoadingChecklist(true);
      await api.put(`/licitacoes/${id}/checklist/aplicacoes/${aplicacaoId}`, {
        status: newStatus
      });
      await loadChecklist();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao atualizar aplicação técnica.');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleDeleteTechAplicacao = async (aplicacaoId: string) => {
    if (!window.confirm('Deseja realmente remover esta aplicação técnica?')) return;
    try {
      setLoadingChecklist(true);
      await api.delete(`/licitacoes/${id}/checklist/aplicacoes/${aplicacaoId}`);
      await loadChecklist();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao excluir aplicação técnica.');
    } finally {
      setLoadingChecklist(false);
    }
  };

  const handleTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskModal) return;
    const { editId, title, desc, respId, limitDate, checklistItemId, checklistAplicacaoId } = taskModal;
    if (!title || !respId || !limitDate) return;
    
    try {
      setLoadingTasks(true);
      if (editId) {
        await api.put(`/licitacoes/${id}/tarefas/${editId}`, {
          titulo: title,
          descricao: desc || null,
          responsavel_id: respId,
          data_limite: new Date(limitDate).toISOString()
        });
      } else {
        await api.post(`/licitacoes/${id}/tarefas`, {
          titulo: title,
          descricao: desc || null,
          responsavel_id: respId,
          data_limite: new Date(limitDate).toISOString(),
          checklist_item_id: checklistItemId || null,
          checklist_aplicacao_id: checklistAplicacaoId || null
        });
      }
      setTaskModal(null);
      await loadTasks();
      loadHistory();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao salvar tarefa.');
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleTaskStatusChange = async (tarefaId: string, newStatus: string) => {
    try {
      setLoadingTasks(true);
      await api.put(`/licitacoes/${id}/tarefas/${tarefaId}`, {
        status: newStatus
      });
      await loadTasks();
      loadHistory();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao alterar status da tarefa.');
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleAndamentoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!andamentoModal || !andamentoModal.newDesc) return;
    try {
      setLoadingTasks(true);
      await api.post(`/licitacoes/${id}/tarefas/${andamentoModal.task.id}/andamentos`, {
        descricao: andamentoModal.newDesc
      });
      setAndamentoModal(null);
      await loadTasks();
      loadHistory();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao adicionar andamento.');
    } finally {
      setLoadingTasks(false);
    }
  };

  const handleRecalculate = async () => {
    try {
      setLoading(true);
      const res = await api.post(`/licitacoes/${id}/recalculate`);
      setDetail(res.data);
      alert('Margens e totais recalculados com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao recalcular margens');
    } finally {
      setLoading(false);
    }
  };

  const handleHeaderSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLocked) return;

    setSavingHeader(true);
    try {
      const payload = {
        numero_edital: numeroEdital,
        customer_id: customerId,
        modalidade,
        tipo_licitacao: tipoLicitacao,
        data_publicacao: dataPublicacao ? new Date(dataPublicacao).toISOString() : null,
        data_licitacao: dataLicitacao ? new Date(dataLicitacao).toISOString() : null,
        data_limite_questionamento: dataLimiteQuestionamento ? new Date(dataLimiteQuestionamento).toISOString() : null,
        status,
        descricao: descricao || null,
        po_id: poId || null
      };

      const res = await api.put(`/licitacoes/${id}`, payload);
      setDetail(res.data);
      setStatus(res.data.status);
      setPoId(res.data.po_id || '');
      loadHistory();
      alert('Edital atualizado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || err.message || 'Falha ao salvar cabeçalho');
    } finally {
      setSavingHeader(false);
    }
  };

  const handleDownloadPropostaPdf = async () => {
    try {
      setDownloadingPdf(true);
      const response = await api.get(`/licitacoes/${id}/reports/envio-proposta`, {
        responseType: 'blob'
      });
      
      const file = new Blob([response.data], { type: 'application/pdf' });
      const fileURL = URL.createObjectURL(file);
      const link = document.createElement('a');
      link.href = fileURL;
      
      const numEditalClean = (detail?.numero_edital || id || 'report').replace(/[\/\\?%*:|"<>]/g, '_');
      link.setAttribute('download', `envio-proposta-edital-${numEditalClean}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(fileURL);
    } catch (err: any) {
      console.error('Failed to download PDF report:', err);
      alert('Falha ao gerar o relatório em PDF. Por favor, tente novamente ou verifique se as dependências do servidor estão configuradas.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleApproveDirector = async () => {
    try {
      setLoading(true);
      const res = await api.put(`/licitacoes/${id}`, {
        aprovado_diretoria: true,
        status: 'Aprovada para Envio'
      });
      setDetail(res.data);
      setStatus(res.data.status);
      loadHistory();
      alert('Edital aprovado com sucesso pela Diretoria.');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || err.message || 'Falha ao aprovar edital.');
    } finally {
      setLoading(false);
    }
  };

  // Helper date calculation
  const calculateDataLimiteLocal = (startDateStr: string, businessDays: number) => {
    if (!startDateStr) return '';
    let date = new Date(startDateStr);
    let added = 0;
    while (added < businessDays) {
      date.setDate(date.getDate() + 1);
      const day = date.getDay(); // 0 is Sunday, 6 is Saturday
      if (day !== 0 && day !== 6) {
        added++;
      }
    }
    return date.toLocaleDateString('pt-BR');
  };

  // --- Purchase Budget Vínculos ---
  const handleLinkBudget = async (budgetId?: string) => {
    const targetId = budgetId || selectedBudgetToLink;
    if (!targetId) return;
    try {
      setLoading(true);
      await api.post(`/licitacoes/${id}/purchase-budgets/${targetId}`);
      setSelectedBudgetToLink('');
      await loadAll();
      alert('Orçamento de compra vinculado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao vincular orçamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleUnlinkBudget = async (budgetId: string) => {
    if (!window.confirm('Deseja realmente desvincular este orçamento de compra da licitação?')) return;
    try {
      setLoading(true);
      await api.delete(`/licitacoes/${id}/purchase-budgets/${budgetId}`);
      await loadAll();
      alert('Orçamento desvinculado com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao desvincular orçamento.');
    } finally {
      setLoading(false);
    }
  };

  // --- Quick Client Creation ---
  const handleQuickCnpjLookup = async () => {
    const cleanCnpj = quickCnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) {
      setQuickClientError('CNPJ inválido. Digite 14 dígitos.');
      return;
    }
    setQuickCnpjLoading(true);
    setQuickClientError(null);
    try {
      const response = await lookupCNPJ(cleanCnpj);
      if (!response.success) {
        setQuickClientError('CNPJ não localizado no banco de dados local da Receita Federal.');
        return;
      }
      setQuickClientData(response.normalizedData);
    } catch (err: any) {
      console.error(err);
      setQuickClientError(err.response?.data?.message || err.message || 'Erro ao consultar CNPJ.');
    } finally {
      setQuickCnpjLoading(false);
    }
  };

  const handleQuickClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickClientData) return;
    try {
      setQuickCnpjLoading(true);
      setQuickClientError(null);
      
      const stateSigla = quickClientData.endereco?.uf;
      let stateId = null;
      if (stateSigla && statesList.length > 0) {
        const foundState = statesList.find((s: any) => s.sigla === stateSigla);
        if (foundState) {
          stateId = foundState.id;
        }
      }
      
      const payload = {
        cnpj: quickClientData.cnpj || quickCnpj.replace(/\D/g, ''),
        razao_social: quickClientData.razaoSocial,
        nome_fantasia: quickClientData.nomeFantasia || quickClientData.razaoSocial,
        tipo: 'PUBLICO',
        esfera: quickEsfera,
        cep: quickClientData.endereco?.cep || '',
        logradouro: quickClientData.endereco?.logradouro || '',
        numero: quickClientData.endereco?.numero || '',
        complemento: quickClientData.endereco?.complemento || '',
        bairro: quickClientData.endereco?.bairro || '',
        state_id: stateId,
        municipality_id: null
      };

      const newCustomer = await api.post('/cadastro/clientes', payload);
      setCustomers(prev => [...prev, newCustomer.data]);
      setCustomerId(newCustomer.data.id);
      
      setQuickClientModal(false);
      setQuickCnpj('');
      setQuickClientData(null);
      alert('Órgão Público cadastrado e selecionado com sucesso!');
    } catch (err: any) {
      console.error(err);
      setQuickClientError(err.response?.data?.detail || err.message || 'Erro ao cadastrar cliente.');
    } finally {
      setQuickCnpjLoading(false);
    }
  };

  const toggleLoteExpansion = (loteId: string) => {
    setExpandedLotes(prev => ({ ...prev, [loteId]: !prev[loteId] }));
  };

  // --- Lote Actions ---
  const handleOpenLoteModal = (loteId?: string) => {
    if (isLocked) return;
    if (loteId && detail) {
      const lote = detail.lotes.find(l => l.id === loteId);
      if (lote) {
        setLoteModal({ open: true, editId: loteId, numero: lote.numero, nome: lote.nome, descricao: lote.descricao || '' });
      }
    } else {
      setLoteModal({ open: true, numero: '', nome: '', descricao: '' });
    }
  };

  const handleLoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loteModal) return;
    const { editId, numero, nome, descricao } = loteModal;
    if (!numero || !nome) return;

    try {
      if (editId) {
        await api.put(`/licitacoes/${id}/lotes/${editId}`, { numero, nome, descricao });
      } else {
        await api.post(`/licitacoes/${id}/lotes`, { numero, nome, descricao });
      }
      setLoteModal(null);
      loadAll();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao salvar lote');
    }
  };

  const handleTriggerDeleteLote = (loteId: string, name: string) => {
    if (isLocked) return;
    setDeleteWarning({
      type: 'lote',
      targetId: loteId,
      title: 'Excluir Lote',
      message: `Tem certeza que deseja excluir o lote "${name}"? Essa operação removerá de forma permanente todos os itens, kits e custos associados a este lote.`
    });
  };

  // --- Item Actions ---
  const handleOpenItemModal = (loteId: string, itemId?: string) => {
    if (isLocked) return;
    if (itemId && detail) {
      const lote = detail.lotes.find(l => l.id === loteId);
      const item = lote?.items.find(i => i.id === itemId);
      if (item) {
        setItemModal({ 
          open: true, 
          editId: itemId, 
          loteId, 
          codigo: item.codigo, 
          nome: item.nome, 
          descricao: item.descricao || '', 
          quantidade: item.quantidade,
          tipo_fornecimento: item.tipo_fornecimento || 'Unitário',
          total_meses: item.total_meses ?? 1
        });
      }
    } else {
      setItemModal({ 
        open: true, 
        loteId, 
        codigo: '', 
        nome: '', 
        descricao: '', 
        quantidade: 1,
        tipo_fornecimento: 'Unitário',
        total_meses: 1
      });
    }
  };

  const handleItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemModal) return;
    const { editId, loteId, codigo, nome, descricao, quantidade, tipo_fornecimento, total_meses } = itemModal;
    if (!codigo || !nome || quantidade <= 0) return;

    if (tipo_fornecimento === 'Mensal' && (!total_meses || total_meses <= 0)) {
      alert('Total de meses deve ser maior que zero.');
      return;
    }

    try {
      const payload = {
        codigo,
        nome,
        descricao,
        quantidade,
        tipo_fornecimento,
        total_meses: tipo_fornecimento === 'Mensal' ? total_meses : null
      };

      if (editId) {
        await api.put(`/licitacoes/${id}/items/${editId}`, payload);
      } else {
        await api.post(`/licitacoes/${id}/lotes/${loteId}/items`, payload);
      }
      setItemModal(null);
      loadAll();
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao salvar item');
    }
  };

  const handleTriggerDeleteItem = (itemId: string, name: string) => {
    if (isLocked) return;
    setDeleteWarning({
      type: 'item',
      targetId: itemId,
      title: 'Excluir Item de Licitação',
      message: `Tem certeza que deseja excluir o item "${name}"? Essa operação removerá permanentemente o item e todos os kits criados especificamente para ele.`
    });
  };

  // --- Kit Actions ---
  const handleOpenKitCreate = (itemId: string) => {
    if (isLocked) return;
    const item = detail?.lotes.flatMap(l => l.items).find(i => i.id === itemId);
    setKitCreateModal({
      open: true,
      itemId,
      nome_kit: `Kit - ${item?.nome || ''}`,
      tipo_contrato: 'VENDA_EQUIPAMENTOS',
      prazo_contrato_meses: 36,
      prazo_instalacao_meses: 0
    });
  };

  const handleKitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitCreateModal) return;
    const { itemId, nome_kit, tipo_contrato, prazo_contrato_meses, prazo_instalacao_meses } = kitCreateModal;
    if (!nome_kit) return;

    try {
      const payload = {
        licitacao_id: id,
        licitacao_item_id: itemId,
        nome_kit,
        tipo_contrato,
        prazo_contrato_meses,
        prazo_instalacao_meses,
        considerar_st_ou_difal: 'DIFAL',
        fator_margem_locacao: 1.0,
        fator_margem_instalacao: 1.0,
        fator_margem_manutencao: 1.0,
        fator_margem_servicos_produtos: 1.0,
        aliq_pis: 0, aliq_cofins: 0, aliq_csll: 0, aliq_irpj: 0, aliq_iss: 0, aliq_icms: 0,
        items: [],
        costs: [],
        monthly_costs: []
      };

      const res = await api.post(`/opportunity-kits/company/${activeCompanyId}`, payload);
      setKitCreateModal(null);
      // Navigate directly to customized opportunity kit form page
      navigate(`/cadastros/kits/${res.data.id}?licitacao_id=${id}`);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || 'Erro ao criar kit de oportunidade');
    }
  };

  const handleTriggerDeleteKit = (kitId: string, name: string, itemId: string) => {
    if (isLocked) return;
    setDeleteWarning({
      type: 'kit',
      targetId: kitId,
      parentId: itemId,
      title: 'Excluir Kit',
      message: `Tem certeza que deseja excluir o kit "${name}"? Os dados de precificação e formação de custos deste kit serão permanentemente apagados.`
    });
  };

  // --- Deletion Orchestrator ---
  const handlePerformDelete = async () => {
    if (!deleteWarning) return;
    const { type, targetId } = deleteWarning;
    setIsPerformingDelete(true);
    setDeleteError(null);

    try {
      if (type === 'lote') {
        await api.delete(`/licitacoes/${id}/lotes/${targetId}`);
      } else if (type === 'item') {
        await api.delete(`/licitacoes/${id}/items/${targetId}`);
        if (selectedItemId === targetId) {
          setSelectedItemId(null);
        }
      } else if (type === 'kit') {
        await api.delete(`/opportunity-kits/${targetId}`);
      }

      setDeleteWarning(null);
      loadAll();
    } catch (err: any) {
      console.error(err);
      setDeleteError(err.response?.data?.detail || err.message || 'Falha ao excluir item');
    } finally {
      setIsPerformingDelete(false);
    }
  };

  const selectedItem = detail?.lotes.flatMap(l => l.items).find(i => i.id === selectedItemId);

  // Consolidation of costs and purchase/sales taxes for selectedItem detail card
  const totalAquisicaoBase = selectedItem ? selectedItem.kits.reduce((sum, k) => sum + Number(k.summary?.custo_aquisicao_total || 0), 0) : 0;
  const totalIpi = selectedItem ? selectedItem.kits.reduce((sum, k) => sum + Number(k.summary?.total_ipi_kit || 0) * Number(k.quantidade_kits || 1), 0) : 0;
  const totalSt = selectedItem ? selectedItem.kits.reduce((sum, k) => sum + Number(k.summary?.total_st_kit || 0) * Number(k.quantidade_kits || 1), 0) : 0;
  const totalDifal = selectedItem ? selectedItem.kits.reduce((sum, k) => sum + Number(k.summary?.total_difal_kit || 0) * Number(k.quantidade_kits || 1), 0) : 0;
  const totalAquisicaoTributada = totalAquisicaoBase + totalIpi + totalSt + totalDifal;

  const totalVendaImpostos = selectedItem ? selectedItem.kits.reduce((sum, k) => sum + Number(k.summary?.valor_impostos || 0) * Number(k.quantidade_kits || 1), 0) : 0;
  const totalVendaDespesas = selectedItem ? selectedItem.kits.reduce((sum, k) => {
    const sumExp = Number(k.summary?.vlt_frete_venda || 0) + Number(k.summary?.vlt_despesas_adm || 0) + Number(k.summary?.vlt_comissao || 0);
    return sum + sumExp * Number(k.quantidade_kits || 1);
  }, 0) : 0;
  const totalCustosVenda = totalVendaImpostos + totalVendaDespesas;

  // Global/Licitacao level consolidations for top-level consolidated header
  const globalKits = detail?.lotes.flatMap(l => l.items).flatMap(i => i.kits) || [];
  
  const globalAquisicaoBase = globalKits.reduce((sum, k) => sum + Number(k.summary?.custo_aquisicao_total || 0), 0);
  const globalIpi = globalKits.reduce((sum, k) => sum + Number(k.summary?.total_ipi_kit || 0) * Number(k.quantidade_kits || 1), 0);
  const globalSt = globalKits.reduce((sum, k) => sum + Number(k.summary?.total_st_kit || 0) * Number(k.quantidade_kits || 1), 0);
  const globalDifal = globalKits.reduce((sum, k) => sum + Number(k.summary?.total_difal_kit || 0) * Number(k.quantidade_kits || 1), 0);
  const globalAquisicaoTributada = globalAquisicaoBase + globalIpi + globalSt + globalDifal;

  const globalVendaImpostos = globalKits.reduce((sum, k) => sum + Number(k.summary?.valor_impostos || 0) * Number(k.quantidade_kits || 1), 0);
  const globalVendaDespesas = globalKits.reduce((sum, k) => {
    const sumExp = Number(k.summary?.vlt_frete_venda || 0) + Number(k.summary?.vlt_despesas_adm || 0) + Number(k.summary?.vlt_comissao || 0);
    return sum + sumExp * Number(k.quantidade_kits || 1);
  }, 0);
  const globalCustosVenda = globalVendaImpostos + globalVendaDespesas;

  const canSeeCostAndProfit = isPOOrManager;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-text-muted space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        <span>Carregando detalhes do edital...</span>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 text-center text-text-muted">
        Licitação não encontrada ou erro no carregamento.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header Info */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate('/comercial/licitacoes')} className="bg-white">
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              Edital: {detail.numero_edital}
            </h1>
            <p className="text-text-muted text-sm">{detail.customer_nome || 'Órgão Público não associado'}</p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" className="bg-white" onClick={handleRecalculate}>
            <RefreshCw className="w-4 h-4 mr-2" /> Recalcular Margem
          </Button>
          {!isLocked && (
            <Button onClick={() => handleHeaderSave()} disabled={savingHeader}>
              {savingHeader ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Cabeçalho
            </Button>
          )}
        </div>
      </header>

      {/* Approval Alert Panel */}
      {detail.precisa_aprovacao_diretoria && !detail.aprovado_diretoria && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/35 rounded-xl text-amber-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-text-primary">Aprovação de Alçada Requerida</p>
              <p className="text-xs text-text-muted mt-0.5">
                A margem ponderada global desta licitação ({Number(detail.margem_ponderada_global || 0).toFixed(2)}%) está abaixo da margem mínima estabelecida pela política comercial do cargo do proponente.
              </p>
            </div>
          </div>
          {isApprover && (
            <Button onClick={handleApproveDirector} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-none shrink-0">
              <Award className="w-4 h-4 mr-1.5" />
              Aprovar Edital (Diretoria)
            </Button>
          )}
        </div>
      )}

      {/* Recalculate Alert Panel */}
      {detail.totais_status === 'PENDENTE_RECALCULO' && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/35 rounded-xl text-amber-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-text-primary">Os totais financeiros estão desatualizados</p>
              <p className="text-xs text-text-muted mt-0.5">
                Houve alterações recentes no edital, lotes, itens ou kits. Por favor, clique em "Recalcular Margem" para atualizar os valores de custo, venda, lucro e margem ponderada.
              </p>
            </div>
          </div>
          <Button onClick={handleRecalculate} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white border-none shrink-0">
            <RefreshCw className="w-4 h-4 mr-1.5 animate-pulse" />
            Recalcular Agora
          </Button>
        </div>
      )}

      {/* Tabs Navigation */}
      <nav className="flex gap-1 border-b border-border-subtle p-1 bg-surface rounded-t-lg">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'dados_gerais', label: 'Dados Gerais', icon: FileText },
          { id: 'equipe', label: 'Equipe', icon: Users },
          { id: 'checklist', label: 'Checklist', icon: CheckSquare },
          { id: 'tarefas', label: 'Tarefas', icon: ListTodo },
          { id: 'lotes', label: 'Lotes / Itens / Kits', icon: Layers },
          { id: 'orcamentos', label: 'Orçamentos de Compra', icon: FileSpreadsheet },
          { id: 'dre', label: 'DRV', icon: TrendingUp },
          { id: 'relatorios', label: 'Relatórios', icon: FileText },
          { id: 'timeline', label: 'Linha do Tempo', icon: History }
        ].filter(tab => tab.id !== 'checklist' || isPOOrManager).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id);
              loadDataForTab(tab.id);
            }}
            className={`flex items-center gap-2 px-6 py-3 rounded-md text-sm font-bold transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-brand-primary/5 text-brand-primary border-b-2 border-brand-primary rounded-b-none'
                : 'text-text-muted hover:bg-bg-deep'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Contents */}
      <div className="bg-surface rounded-b-lg border border-t-0 border-border-subtle p-6 shadow-sm">
        {activeTab === 'dashboard' && (
          <LicitacaoDashboard licitacaoId={id!} />
        )}
        {activeTab === 'dados_gerais' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Número do Edital *</label>
                <input
                  type="text"
                  required
                  disabled={isLocked}
                  value={numeroEdital}
                  onChange={e => setNumeroEdital(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Órgão Público *</label>
                <div className="flex gap-2 h-11">
                  <select
                    required
                    disabled={isLocked}
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    onClick={() => ensureCustomersLoaded()}
                    onFocus={() => ensureCustomersLoaded()}
                    className="flex-1 bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary"
                  >
                    <option value="">Selecione o órgão...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
                    ))}
                  </select>
                  {!isLocked && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        ensureStatesLoaded();
                        setQuickClientModal(true);
                      }}
                      className="px-3"
                      title="Cadastrar novo Órgão por CNPJ"
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Status</label>
                <select
                  disabled={isLocked}
                  value={status}
                  onChange={e => setStatus(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                >
                  {statusOptions.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Modalidade *</label>
                <select
                  disabled={isLocked}
                  value={modalidade}
                  onChange={e => setModalidade(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                >
                  {modalidadeOptions.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo de Licitação *</label>
                <select
                  disabled={isLocked}
                  value={tipoLicitacao}
                  onChange={e => setTipoLicitacao(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                >
                  {tipoLicitacaoOptions.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Data de Publicação</label>
                <input
                  type="date"
                  disabled={isLocked}
                  value={dataPublicacao}
                  onChange={e => setDataPublicacao(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Data Limite Questionamento / Impugnação</label>
                <input
                  type="date"
                  disabled={isLocked}
                  value={dataLimiteQuestionamento}
                  onChange={e => setDataLimiteQuestionamento(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Certame / Abertura</label>
                <input
                  type="date"
                  disabled={isLocked}
                  value={dataLicitacao}
                  onChange={e => setDataLicitacao(e.target.value)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-4 border-t border-border-subtle">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Descrição / Observações</label>
              <textarea
                rows={4}
                disabled={isLocked}
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-3 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary resize-none"
                placeholder="Observações complementares sobre o edital..."
              />
            </div>
          </div>
        )}

        {activeTab === 'equipe' && (
          <div className="space-y-6">
            {/* PO Section */}
            <div className="bg-bg-deep/15 border border-border-subtle/50 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5 border-b border-border-subtle/40 pb-2">
                <Briefcase className="w-4 h-4 text-brand-primary" />
                Responsável (P.O. - Product Owner)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">P.O. Responsável</label>
                  <select
                    disabled={isLocked || !isPOOrManager}
                    value={poId || ''}
                    onChange={e => setPoId(e.target.value)}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none focus:border-brand-primary h-11"
                  >
                    <option value="">Selecione o P.O....</option>
                    {usersList.filter(u => u.is_active).map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-text-muted mt-1">
                    Obs: Após definido, apenas usuários com perfil GERENTE ou DIRETORIA podem alterar o P.O. ao salvar o cabeçalho.
                  </p>
                </div>
              </div>
            </div>

            {/* Analysts Section */}
            <div className="bg-bg-deep/15 border border-border-subtle/50 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5 border-b border-border-subtle/40 pb-2">
                <Users className="w-4 h-4 text-brand-primary" />
                Analistas e Prazos
              </h3>

              {!isLocked && isPOOrManager && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-surface border border-border-subtle/85 rounded-lg p-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Selecionar Analista</label>
                    <select
                      value={selectedAnalystId}
                      onChange={e => setSelectedAnalystId(e.target.value)}
                      className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
                    >
                      <option value="">Selecione...</option>
                      {usersList
                        .filter(u => u.is_active && !detail.analistas?.some(a => a.usuario_id === u.id))
                        .map(u => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))
                      }
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Prazo (Dias Úteis)</label>
                    <input
                      type="number"
                      min={1}
                      value={analystPrazo}
                      onChange={e => setAnalystPrazo(Math.max(1, Number(e.target.value)))}
                      className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Previsão Entrega</label>
                    <div className="w-full bg-bg-deep/50 border border-border-subtle/50 rounded-md py-2.5 px-3 text-sm text-text-muted font-bold font-mono h-11 flex items-center">
                      {calculateDataLimiteLocal(detail.created_at || new Date().toISOString(), analystPrazo) || '—'}
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={!selectedAnalystId || addingAnalyst}
                    onClick={async () => {
                      try {
                        setAddingAnalyst(true);
                        await api.post(`/licitacoes/${id}/analistas`, {
                          usuario_id: selectedAnalystId,
                          prazo_dias_uteis: analystPrazo
                        });
                        setSelectedAnalystId('');
                        await loadAll();
                        alert('Analista adicionado com sucesso!');
                      } catch (err: any) {
                        console.error(err);
                        alert(err.response?.data?.detail || 'Erro ao adicionar analista.');
                      } finally {
                        setAddingAnalyst(false);
                      }
                    }}
                    className="h-11 flex items-center justify-center gap-1.5"
                  >
                    {addingAnalyst ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    Adicionar Analista
                  </Button>
                </div>
              )}

              {(!detail.analistas || detail.analistas.length === 0) ? (
                <p className="text-xs text-text-muted text-center py-6">Nenhum analista vinculado a esta licitação.</p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border-subtle/60 bg-bg-surface">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-deep/30 border-b border-border-subtle/50 text-text-muted font-bold">
                        <th className="py-2.5 px-4">Analista</th>
                        <th className="py-2.5 px-4">Data Zero (Início)</th>
                        <th className="py-2.5 px-4 text-center">Prazo</th>
                        <th className="py-2.5 px-4">Previsão Entrega</th>
                        {!isLocked && isPOOrManager && <th className="py-2.5 px-4 text-center">Ações</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {detail.analistas.map(a => (
                        <tr key={a.id} className="border-b border-border-subtle/40 hover:bg-slate-50/20">
                          <td className="py-3 px-4 font-semibold text-text-primary">{a.usuario_name || a.usuario_nome || 'Desconhecido'}</td>
                          <td className="py-3 px-4 text-text-muted font-mono">{new Date(a.data_zero).toLocaleDateString('pt-BR')}</td>
                          <td className="py-3 px-4 text-center text-text-muted font-bold">{a.prazo_dias_uteis} dias úteis</td>
                          <td className="py-3 px-4 font-mono font-bold text-brand-primary">{new Date(a.data_limite).toLocaleDateString('pt-BR')}</td>
                          {!isLocked && isPOOrManager && (
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={async () => {
                                  const name = a.usuario_name || a.usuario_nome || 'Analista';
                                  if (!window.confirm(`Deseja realmente remover o analista ${name}?`)) return;
                                  try {
                                    await api.delete(`/licitacoes/${id}/analistas/${a.id}`);
                                    await loadAll();
                                    alert('Analista removido com sucesso!');
                                  } catch (err: any) {
                                    console.error(err);
                                    alert(err.response?.data?.detail || 'Erro ao remover analista.');
                                  }
                                }}
                                className="p-1 hover:bg-rose-50 text-rose-600 rounded"
                                title="Remover Analista"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'lotes' && (
          <div className="space-y-6">
            {/* Nível 1: Licitação Consolidated Totals */}
            <div className={`grid gap-4 p-4 rounded-xl border border-border-subtle/80 bg-bg-deep/10 shadow-sm ${canSeeCostAndProfit ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2'}`}>
              <div className="space-y-1">
                <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Venda Global</span>
                <span className="text-lg font-extrabold text-brand-primary tabular-nums block">
                  {Number(detail.valor_total_venda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              {canSeeCostAndProfit && (
                <>
                  {/* Custo de Aquisição (NEW) */}
                  <div className="space-y-1 border-l border-border-subtle/30 pl-4">
                    <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Custo de Aquisição</span>
                    <Tooltip
                      variant="light"
                      content={
                        <div className="space-y-1.5 text-xs text-left p-1 text-slate-800">
                          <div className="font-bold border-b border-slate-200 pb-1 mb-1">Custo de Aquisição Global</div>
                          <div className="flex justify-between gap-6">
                            <span className="text-slate-500">Custo Base (Compra):</span>
                            <span className="font-mono font-semibold">
                              {globalAquisicaoBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-slate-500">IPI de Compra:</span>
                            <span className="font-mono font-semibold">
                              {globalIpi.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-slate-500">ICMS ST de Compra:</span>
                            <span className="font-mono font-semibold">
                              {globalSt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-slate-500">DIFAL de Compra:</span>
                            <span className="font-mono font-semibold">
                              {globalDifal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="flex justify-between gap-6 border-t border-dashed border-slate-200 pt-1 mt-1 font-bold">
                            <span>Total Aquisição:</span>
                            <span className="font-mono">
                              {globalAquisicaoTributada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        </div>
                      }
                    >
                      <span className="text-lg font-extrabold text-text-primary tabular-nums block hover:text-brand-primary cursor-help decoration-dotted underline underline-offset-2 decoration-border-subtle">
                        {globalAquisicaoTributada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </Tooltip>
                  </div>

                  {/* Custos de Venda (NEW) */}
                  <div className="space-y-1 border-l border-border-subtle/30 pl-4">
                    <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Custos de Venda</span>
                    <Tooltip
                      variant="light"
                      content={
                        <div className="space-y-1.5 text-xs text-left p-1 text-slate-800">
                          <div className="font-bold border-b border-slate-200 pb-1 mb-1">Custos de Venda Global</div>
                          <div className="flex justify-between gap-6">
                            <span className="text-slate-500">Impostos sobre Venda:</span>
                            <span className="font-mono font-semibold">
                              {globalVendaImpostos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="flex justify-between gap-6">
                            <span className="text-slate-500">Despesas / Comissões / Frete:</span>
                            <span className="font-mono font-semibold">
                              {globalVendaDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          <div className="flex justify-between gap-6 border-t border-dashed border-slate-200 pt-1 mt-1 font-bold">
                            <span>Total Venda:</span>
                            <span className="font-mono">
                              {globalCustosVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                        </div>
                      }
                    >
                      <span className="text-lg font-extrabold text-text-primary tabular-nums block hover:text-brand-primary cursor-help decoration-dotted underline underline-offset-2 decoration-border-subtle">
                        {globalCustosVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </Tooltip>
                  </div>

                  {/* Custo Global */}
                  <div className="space-y-1 border-l border-border-subtle/30 pl-4">
                    <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Custo Global</span>
                    <span className="text-lg font-extrabold text-text-primary tabular-nums block">
                      {Number(detail.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>

                  {/* Lucro Estimado */}
                  <div className="space-y-1 border-l border-border-subtle/30 pl-4">
                    <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Lucro Estimado</span>
                    <span className="text-lg font-extrabold text-text-primary tabular-nums block">
                      {Number(detail.lucro_estimado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                </>
              )}
              <div className={`space-y-1 ${canSeeCostAndProfit ? 'border-l border-border-subtle/30 pl-4' : ''}`}>
                <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Margem Global</span>
                <span className="text-lg font-extrabold text-emerald-600 tabular-nums block">
                  {Number(detail.margem_ponderada_global || 0).toFixed(2)}%
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: Tree Navigation Card */}
              <div className="lg:col-span-1 space-y-4">
                <div className="bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-border-subtle/40 pb-2">
                    <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                      <Layers className="w-4 h-4 text-brand-primary" />
                      Estrutura de Lotes
                    </h2>
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() => handleOpenLoteModal()}
                        className="text-xs text-brand-primary hover:underline flex items-center gap-0.5 font-bold cursor-pointer"
                      >
                        <Plus className="w-3 h-3" /> Lote
                      </button>
                    )}
                  </div>

                  {detail.lotes.length === 0 ? (
                    <p className="text-xs text-text-muted text-center py-6">Nenhum lote criado neste edital.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.lotes.map(l => {
                        const isExpanded = expandedLotes[l.id];
                        return (
                          <div key={l.id} className="border border-border-subtle/50 rounded-lg p-2 bg-bg-deep/15">
                            {/* Lote Header */}
                            <div className="flex items-center justify-between group">
                              <button
                                type="button"
                                onClick={() => toggleLoteExpansion(l.id)}
                                className="flex items-center gap-1.5 font-semibold text-xs text-text-primary hover:text-brand-primary text-left cursor-pointer"
                              >
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0" />}
                                <span>Lote {l.numero}: {l.nome}</span>
                              </button>
                              
                              {!isLocked && (
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button type="button" onClick={() => handleOpenItemModal(l.id)} className="p-1 text-text-muted hover:text-brand-primary" title="Adicionar Item">
                                    <Plus className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={() => handleOpenLoteModal(l.id)} className="p-1 text-text-muted hover:text-brand-primary" title="Editar Lote">
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                  <button type="button" onClick={() => handleTriggerDeleteLote(l.id, l.nome)} className="p-1 text-text-muted hover:text-rose-600" title="Excluir Lote">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Nível 2: Lote inline totals */}
                            <div className="mt-1 pl-5 text-[10px] text-text-muted flex flex-wrap gap-x-2">
                              <span>Venda: <strong className="text-text-primary">{Number(l.venda_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</strong></span>
                              {canSeeCostAndProfit && (
                                <span>Custo: <strong className="text-text-primary">{Number(l.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}</strong></span>
                              )}
                              <span>Margem: <strong className="text-emerald-600">{Number(l.margem_geral || 0).toFixed(1)}%</strong></span>
                            </div>

                            {/* Items */}
                            {isExpanded && (
                              <div className="mt-2 pl-4 space-y-1 border-l border-border-subtle/40 ml-1.5">
                                {l.items.length === 0 ? (
                                  <p className="text-[10px] text-text-muted py-1.5">Sem itens neste lote.</p>
                                ) : (
                                  l.items.map(item => {
                                    const isSelected = selectedItemId === item.id;
                                    return (
                                      <div
                                        key={item.id}
                                        onClick={() => {
                                          setSelectedItemId(item.id);
                                        }}
                                        className={`flex flex-col p-1.5 rounded-md cursor-pointer group text-xs transition-colors ${isSelected ? 'bg-brand-primary/10 text-brand-primary' : 'text-text-muted hover:text-text-primary hover:bg-bg-deep/40'}`}
                                      >
                                        <div className="flex items-center justify-between w-full">
                                          <span className={`truncate pr-2 ${isSelected ? 'font-bold text-brand-primary' : 'text-text-primary'}`}>
                                            Item {item.codigo} — {item.nome}
                                          </span>
                                          {!isLocked && (
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleOpenItemModal(l.id, item.id); }}
                                                className="p-0.5 text-text-muted hover:text-brand-primary"
                                                title="Editar Item"
                                              >
                                                <Edit2 className="w-3 h-3" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); handleTriggerDeleteItem(item.id, item.nome); }}
                                                className="p-0.5 text-text-muted hover:text-rose-600"
                                                title="Excluir Item"
                                              >
                                                <Trash2 className="w-3 h-3" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                        {/* Item inline totals */}
                                        <div className="mt-0.5 pl-1 text-[10px] text-text-muted flex flex-wrap gap-x-2">
                                          <span>V: <strong className={isSelected ? 'text-brand-primary' : 'text-text-primary'}>{Number(item.venda_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                                          {canSeeCostAndProfit && (
                                            <span>C: <strong className={isSelected ? 'text-brand-primary' : 'text-text-primary'}>{Number(item.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                                          )}
                                          <span>M: <strong className="text-emerald-600">{Number(item.margem_geral || 0).toFixed(1)}%</strong></span>
                                        </div>
                                      </div>
                                    )
                                  })
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Selected Item Detail & Opportunity Kits */}
              <div className="lg:col-span-2 space-y-4">
                {selectedItem ? (
                  <div className="bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm p-6 space-y-6">
                    {/* Item Details */}
                    <div className="flex items-start justify-between border-b border-border-subtle/40 pb-4">
                      <div className="space-y-1">
                        <h3 className="text-lg font-bold text-text-primary">
                          Item {selectedItem.codigo}: {selectedItem.nome}
                        </h3>
                        <p className="text-text-muted text-sm">{selectedItem.descricao || 'Sem descrição cadastrada'}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted pt-1">
                          <span>Fornecimento: <strong className="text-text-primary">{selectedItem.tipo_fornecimento || 'Unitário'}</strong></span>
                          {selectedItem.tipo_fornecimento === 'Mensal' && (
                            <span>Duração: <strong className="text-text-primary">{selectedItem.total_meses} meses</strong></span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-4">
                        <div className="text-right border-r border-border-subtle/40 pr-4">
                          <span className="text-[10px] text-text-muted block uppercase font-bold">Qtd. Unitária</span>
                          <span className="text-lg font-bold text-text-primary mt-0.5 block">{Number(selectedItem.quantidade)}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-text-muted block uppercase font-bold text-brand-primary">Qtd. Total</span>
                          <span className="text-lg font-bold text-brand-primary mt-0.5 block">{Number(selectedItem.quantidade_total ?? selectedItem.quantidade)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Nível 3: Item Consolidated Totalizer */}
                    {selectedItem.kits.length > 0 && (
                      <div className="space-y-4">
                        <div className={`grid gap-4 p-4 rounded-xl border border-border-subtle/80 bg-slate-50/10 shadow-sm ${canSeeCostAndProfit ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6' : 'grid-cols-2'}`}>
                          <div className="space-y-1">
                            <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Total de Venda</span>
                            <span className="text-base font-extrabold text-brand-primary tabular-nums block">
                              {Number(selectedItem.venda_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                            </span>
                          </div>
                          {canSeeCostAndProfit && (
                            <>
                              {/* Custo de Aquisição (NEW) */}
                              <div className="space-y-1 border-l border-border-subtle/30 pl-4">
                                <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Custo de Aquisição</span>
                                <Tooltip
                                  variant="light"
                                  content={
                                    <div className="space-y-1.5 text-xs text-left p-1 text-slate-800">
                                      <div className="font-bold border-b border-slate-200 pb-1 mb-1">Custo de Aquisição</div>
                                      <div className="flex justify-between gap-6">
                                        <span className="text-slate-500">Custo Base (Compra):</span>
                                        <span className="font-mono font-semibold">
                                          {totalAquisicaoBase.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-6">
                                        <span className="text-slate-500">IPI de Compra:</span>
                                        <span className="font-mono font-semibold">
                                          {totalIpi.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-6">
                                        <span className="text-slate-500">ICMS ST de Compra:</span>
                                        <span className="font-mono font-semibold">
                                          {totalSt.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-6">
                                        <span className="text-slate-500">DIFAL de Compra:</span>
                                        <span className="font-mono font-semibold">
                                          {totalDifal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-6 border-t border-dashed border-slate-200 pt-1 mt-1 font-bold">
                                        <span>Total Aquisição:</span>
                                        <span className="font-mono">
                                          {totalAquisicaoTributada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                      </div>
                                    </div>
                                  }
                                >
                                  <span className="text-base font-extrabold text-text-primary tabular-nums block hover:text-brand-primary cursor-help decoration-dotted underline underline-offset-2 decoration-border-subtle">
                                    {totalAquisicaoTributada.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                </Tooltip>
                              </div>

                              {/* Custos de Venda (NEW) */}
                              <div className="space-y-1 border-l border-border-subtle/30 pl-4">
                                <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Custos de Venda</span>
                                <Tooltip
                                  variant="light"
                                  content={
                                    <div className="space-y-1.5 text-xs text-left p-1 text-slate-800">
                                      <div className="font-bold border-b border-slate-200 pb-1 mb-1">Custos de Venda</div>
                                      <div className="flex justify-between gap-6">
                                        <span className="text-slate-500">Impostos sobre Venda:</span>
                                        <span className="font-mono font-semibold">
                                          {totalVendaImpostos.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-6">
                                        <span className="text-slate-500">Despesas / Comissões / Frete:</span>
                                        <span className="font-mono font-semibold">
                                          {totalVendaDespesas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                      </div>
                                      <div className="flex justify-between gap-6 border-t border-dashed border-slate-200 pt-1 mt-1 font-bold">
                                        <span>Total Venda:</span>
                                        <span className="font-mono">
                                          {totalCustosVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </span>
                                      </div>
                                    </div>
                                  }
                                >
                                  <span className="text-base font-extrabold text-text-primary tabular-nums block hover:text-brand-primary cursor-help decoration-dotted underline underline-offset-2 decoration-border-subtle">
                                    {totalCustosVenda.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                  </span>
                                </Tooltip>
                              </div>

                              {/* Total de Custo */}
                              <div className="space-y-1 border-l border-border-subtle/30 pl-4">
                                <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Total de Custo</span>
                                <span className="text-base font-extrabold text-text-primary tabular-nums block">
                                  {Number(selectedItem.custo_total || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>

                              {/* Lucro Estimado */}
                              <div className="space-y-1 border-l border-border-subtle/30 pl-4">
                                <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Lucro Estimado</span>
                                <span className="text-base font-extrabold text-text-primary tabular-nums block">
                                  {Number(selectedItem.lucro_estimado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                </span>
                              </div>
                            </>
                          )}
                          <div className={`space-y-1 ${canSeeCostAndProfit ? 'border-l border-border-subtle/30 pl-4' : ''}`}>
                            <span className="text-[10px] text-text-muted block uppercase font-bold tracking-wide">Margem Geral</span>
                            <span className="text-base font-extrabold text-emerald-600 tabular-nums block">
                              {Number(selectedItem.margem_geral || 0).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Kits Section */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5">
                          <Package className="w-4 h-4 text-brand-primary" />
                          Kits de Oportunidade Associados
                        </h4>
                        {!isLocked && (
                          <Button type="button" onClick={() => handleOpenKitCreate(selectedItem.id)} size="sm">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Novo Kit
                          </Button>
                        )}
                      </div>

                      {selectedItem.kits.length === 0 ? (
                        <div className="text-center py-12 border border-dashed border-border-subtle/80 rounded-xl text-text-muted text-xs space-y-2">
                          <p>Nenhum kit de oportunidade cadastrado para este item.</p>
                          <p className="text-[10px]">Toda precificação de item de licitação deve ser feita através de um Kit customizado.</p>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-border-subtle/60 bg-bg-surface">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead>
                              <tr className="bg-bg-deep/30 border-b border-border-subtle/50 text-text-muted font-bold">
                                <th className="py-2.5 px-4">Nome do Kit</th>
                                <th className="py-2.5 px-4">Operação / Contrato</th>
                                <th className="py-2.5 px-4 text-right">Quantidade</th>
                                {canSeeCostAndProfit && (
                                  <>
                                    <th className="py-2.5 px-4 text-right">Custo Unit.</th>
                                    <th className="py-2.5 px-4 text-right">Custo Total</th>
                                  </>
                                )}
                                {selectedItem.tipo_fornecimento === 'Unitário' ? (
                                  <>
                                    <th className="py-2.5 px-4 text-right">Venda Unit.</th>
                                    <th className="py-2.5 px-4 text-right">Venda Total</th>
                                  </>
                                ) : (
                                  <>
                                    <th className="py-2.5 px-4 text-right">Mensal</th>
                                    <th className="py-2.5 px-4 text-right">Setup / Instalação</th>
                                    <th className="py-2.5 px-4 text-right">Venda Total</th>
                                  </>
                                )}
                                {canSeeCostAndProfit && (
                                  <th className="py-2.5 px-4 text-right">Lucro Est.</th>
                                )}
                                <th className="py-2.5 px-4 text-right">Margem</th>
                                <th className="py-2.5 px-4 text-center">Ações</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedItem.kits.map(k => {
                                const isUnitario = selectedItem.tipo_fornecimento === 'Unitário';
                                const qty = Number(k.quantidade_kits || 1);
                                const cUnit = Number(k.summary?.custo_aquisicao_kit || 0);
                                const cTotal = Number(k.summary?.custo_aquisicao_total || 0);
                                const vUnit = Number(k.summary?.venda_unitario || 0);
                                const vTotal = Number(k.summary?.venda_total || 0);
                                const lEst = Number(k.summary?.lucro_estimado || 0);
                                const marg = Number(k.summary?.margem_geral || 0);

                                return (
                                  <tr key={k.id} className="border-b border-border-subtle/40 hover:bg-slate-50/20">
                                    <td className="py-3 px-4 font-semibold text-text-primary">{k.nome_kit}</td>
                                    <td className="py-3 px-4 font-mono uppercase text-text-muted tracking-wider">{k.tipo_contrato}</td>
                                    <td className="py-3 px-4 text-right font-mono text-text-muted tabular-nums">{qty}</td>
                                    
                                    {canSeeCostAndProfit && (
                                      <>
                                        <td className="py-3 px-4 text-right font-mono text-text-muted tabular-nums">
                                          {cUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-text-muted tabular-nums">
                                          {cTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                      </>
                                    )}
                                    
                                    {isUnitario ? (
                                      <>
                                        <td className="py-3 px-4 text-right font-mono text-text-muted tabular-nums">
                                          {vUnit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-brand-primary tabular-nums font-semibold">
                                          {vTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                      </>
                                    ) : (
                                      <>
                                        <td className="py-3 px-4 text-right font-mono text-text-muted tabular-nums">
                                          {Number(k.summary?.valor_mensal_kit || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-text-muted tabular-nums">
                                          {Number(k.summary?.valor_venda_instalacao ?? k.summary?.vlr_instal_calc ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                        <td className="py-3 px-4 text-right font-mono text-brand-primary tabular-nums font-semibold">
                                          {vTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                      </>
                                    )}
                                    
                                    {canSeeCostAndProfit && (
                                      <td className="py-3 px-4 text-right font-mono text-text-muted tabular-nums">
                                        {lEst.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                      </td>
                                    )}
                                    
                                    <td className="py-3 px-4 text-right font-bold text-emerald-600 tabular-nums">
                                      {marg.toFixed(2)}%
                                    </td>
                                    <td className="py-3 px-4 text-center">
                                      <div className="flex justify-center items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => navigate(`/cadastros/kits/${k.id}?licitacao_id=${id}`)}
                                          className="p-1 hover:bg-brand-primary/10 text-brand-primary rounded cursor-pointer"
                                          title="Editar Simulação do Kit"
                                        >
                                          <Edit2 className="w-3.5 h-3.5" />
                                        </button>
                                        {!isLocked && (
                                          <button
                                            type="button"
                                            onClick={() => handleTriggerDeleteKit(k.id, k.nome_kit, selectedItem.id)}
                                            className="p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer"
                                            title="Excluir Kit"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
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
                    </div>
                  </div>
                ) : (
                  <div className="bg-bg-surface border border-border-subtle/80 rounded-xl shadow-sm p-12 text-center text-text-muted text-sm">
                    <Layers className="w-12 h-12 text-text-muted mx-auto opacity-30 mb-3" />
                    Selecione um item na árvore de lotes à esquerda para visualizar e gerenciar seus kits de oportunidade.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'orcamentos' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle/40 pb-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-brand-primary" />
                  Orçamentos de Fornecedores Associados
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Vincule os orçamentos de compras de fornecedores. A precificação dos kits desta licitação resolverá custos baseando-se apenas nesses orçamentos vinculados.
                </p>
              </div>
              {!isLocked && (
                <Button type="button" onClick={() => navigate(`/orcamentos-compras/novo?licitacao_id=${id}`)} size="sm">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Criar Novo Orçamento
                </Button>
              )}
            </div>

            {!isLocked && (
              <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-bg-deep/15 border border-border-subtle/50 rounded-xl p-4 w-full">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Vincular Orçamento Existente</label>
                  <p className="text-xs text-text-muted">Selecione e importe uma proposta de fornecedor cadastrada no sistema.</p>
                </div>
                <Button
                  type="button"
                  onClick={() => setIsPurchaseSearchModalOpen(true)}
                  className="shrink-0 h-11 bg-orange-500 hover:bg-orange-600 text-white border-0 font-sans font-semibold px-6 flex items-center gap-1.5"
                >
                  <Search className="w-4 h-4" /> Buscar e Vincular Orçamento
                </Button>
              </div>
            )}

            {purchaseBudgets.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border-subtle/80 rounded-xl text-text-muted text-xs">
                Nenhum orçamento de compra de fornecedor vinculado a esta licitação.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-border-subtle/60 bg-bg-surface">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="bg-bg-deep/30 border-b border-border-subtle/50 text-text-muted font-bold">
                      <th className="py-2.5 px-4">Número Orçamento</th>
                      <th className="py-2.5 px-4">Fornecedor</th>
                      <th className="py-2.5 px-4">Data do Orçamento</th>
                      <th className="py-2.5 px-4">Vendedor</th>
                      <th className="py-2.5 px-4 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchaseBudgets.map(pb => (
                      <tr key={pb.id} className="border-b border-border-subtle/40 hover:bg-slate-50/20">
                        <td className="py-3 px-4 font-semibold text-text-primary">{pb.numero_orcamento}</td>
                        <td className="py-3 px-4 text-text-muted">{pb.supplier_nome || '—'}</td>
                        <td className="py-3 px-4 text-text-muted font-mono">
                          {pb.data_orcamento ? new Date(pb.data_orcamento).toLocaleDateString('pt-BR') : '—'}
                        </td>
                        <td className="py-3 px-4 text-text-muted">{pb.vendedor_nome || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex justify-center items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => navigate(`/orcamentos-compras/${pb.id}?licitacao_id=${id}`)}
                              className="p-1 hover:bg-brand-primary/10 text-brand-primary rounded cursor-pointer"
                              title="Editar Orçamento"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {!isLocked && (
                              <button
                                type="button"
                                onClick={() => handleUnlinkBudget(pb.id)}
                                className="p-1 hover:bg-rose-50 text-rose-600 rounded cursor-pointer"
                                title="Desvincular Orçamento"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'checklist' && isPOOrManager && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle/40 pb-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-brand-primary" />
                  Checklist de Licitação
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Conclua os requisitos de habilitação, valide a especificação técnica e garanta o fechamento correto do edital.
                </p>
              </div>
            </div>

            {loadingChecklist ? (
              <div className="flex justify-center items-center py-12 text-text-muted">
                <Loader2 className="w-6 h-6 animate-spin mr-2 text-brand-primary" />
                <span>Carregando checklist...</span>
              </div>
            ) : checklistGroups.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-12">Nenhum grupo de checklist configurado.</p>
            ) : (
              <div className="space-y-6">
                {checklistGroups.map(grupo => (
                  <div key={grupo.id} className="bg-bg-deep/10 border border-border-subtle/60 rounded-xl p-5 space-y-4">
                    <h3 className="text-sm font-bold text-text-primary uppercase tracking-wide flex items-center gap-1.5 border-b border-border-subtle/40 pb-2">
                      <Layers className="w-4 h-4 text-brand-primary" />
                      {grupo.nome}
                    </h3>
                    
                    <div className="space-y-4">
                      {grupo.items?.map((item: any) => (
                        <div key={item.id} className="border-b border-border-subtle/30 pb-4 last:border-b-0 last:pb-0 space-y-2">
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-sm text-text-primary">{item.nome}</p>
                              {item.descricao && <p className="text-xs text-text-muted mt-0.5">{item.descricao}</p>}
                              {item.data_conclusao && (
                                <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1 font-semibold">
                                  <Clock className="w-3 h-3" /> Concluído em {new Date(item.data_conclusao).toLocaleString('pt-BR')}
                                </p>
                              )}
                            </div>
                            
                            {grupo.nome !== "Análise Técnica" ? (
                              <div className="flex flex-wrap items-center gap-2 shrink-0">
                                <select
                                  disabled={isLocked}
                                  value={item.usuario_id || ''}
                                  onChange={(e) => handleChecklistItemUpdate(item.id, undefined, e.target.value || '')}
                                  className="bg-bg-deep border border-border-subtle rounded-md py-1.5 px-3 text-xs text-text-primary focus:outline-none h-9"
                                >
                                  <option value="">Sem responsável...</option>
                                  {getTeamMembers().map(m => (
                                    <option key={m.id} value={m.id}>{m.name}</option>
                                  ))}
                                </select>
                                
                                <select
                                  disabled={isLocked}
                                  value={item.status}
                                  onChange={(e) => handleChecklistItemUpdate(item.id, e.target.value, undefined)}
                                  className={`border rounded-md py-1.5 px-3 text-xs font-semibold focus:outline-none h-9 ${
                                    item.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                                    item.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                    item.status === 'Pausado' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                    item.status === 'Não Aplicável' ? 'bg-slate-100 text-slate-600 border-slate-300' :
                                    'bg-bg-deep text-text-primary border-border-subtle'
                                  }`}
                                >
                                  <option value="Pendente">Pendente</option>
                                  <option value="Em Andamento">Em Andamento</option>
                                  <option value="Pausado">Pausado</option>
                                  <option value="Concluído">Concluído</option>
                                  <option value="Não Aplicável">Não Aplicável</option>
                                </select>

                                {!isLocked && (
                                  <button
                                    type="button"
                                    onClick={() => setTaskModal({
                                      open: true,
                                      title: `Checklist: ${item.nome}`,
                                      desc: item.descricao || '',
                                      respId: item.usuario_id || '',
                                      limitDate: '',
                                      checklistItemId: item.id
                                    })}
                                    className="p-2 hover:bg-brand-primary/10 text-brand-primary rounded border border-border-subtle hover:border-brand-primary/30 transition-colors h-9 w-9 flex items-center justify-center cursor-pointer"
                                    title="Criar Tarefa Vinculada"
                                  >
                                    <ListTodo className="w-4 h-4" />
                                  </button>
                                )}

                                {!isLocked && (String(detail.po_id) === String(user?.id) || user?.roles?.some(r => ['ADMIN', 'DIRETORIA', 'GERENTE'].includes(r))) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChecklistItem(item.id)}
                                    className="p-2 hover:bg-rose-50 text-rose-600 rounded border border-border-subtle hover:border-rose-200 transition-colors h-9 w-9 flex items-center justify-center cursor-pointer"
                                    title="Excluir Item do Checklist"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 shrink-0">
                                {!isLocked && (
                                  <Button
                                    type="button"
                                    onClick={() => setTechAplicacaoModal({ open: true, itemId: item.id, name: item.nome })}
                                    size="sm"
                                    variant="outline"
                                    className="h-9 py-1 px-3 text-xs"
                                  >
                                    <Plus className="w-3.5 h-3.5 mr-1" /> Vincular Analista
                                  </Button>
                                )}
                                {!isLocked && (String(detail.po_id) === String(user?.id) || user?.roles?.some(r => ['ADMIN', 'DIRETORIA', 'GERENTE'].includes(r))) && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteChecklistItem(item.id)}
                                    className="p-2 hover:bg-rose-50 text-rose-600 rounded border border-border-subtle hover:border-rose-200 transition-colors h-9 w-9 flex items-center justify-center cursor-pointer"
                                    title="Excluir Item do Checklist"
                                  >
                                    <Trash className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          {grupo.nome === "Análise Técnica" && (
                            <div className="pl-4 border-l-2 border-brand-primary/25 space-y-2 mt-2">
                              {(!item.aplicacoes || item.aplicacoes.length === 0) ? (
                                <p className="text-xs text-text-muted italic py-1">Nenhum analista vinculado para validação técnica.</p>
                              ) : (
                                <div className="space-y-2">
                                  {item.aplicacoes.map((ap: any) => (
                                    <div key={ap.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-bg-deep/20 rounded-lg border border-border-subtle/40 text-xs">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-text-primary flex items-center gap-1">
                                          <UserCheck className="w-3.5 h-3.5 text-brand-primary" /> {ap.usuario_nome}
                                        </span>
                                        {ap.observacao && (
                                          <span className="text-text-muted italic">({ap.observacao})</span>
                                        )}
                                        {ap.data_conclusao && (
                                          <span className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
                                            <Clock className="w-2.5 h-2.5" /> {new Date(ap.data_conclusao).toLocaleDateString('pt-BR')}
                                          </span>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <select
                                          disabled={isLocked}
                                          value={ap.status}
                                          onChange={(e) => handleUpdateTechAplicacao(ap.id, e.target.value)}
                                          className={`border rounded px-2.5 py-1 text-xs font-semibold focus:outline-none h-8 cursor-pointer ${
                                            ap.status === 'Concluído' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' :
                                            ap.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700 border-blue-300' :
                                            ap.status === 'Pausado' ? 'bg-amber-50 text-amber-700 border-amber-300' :
                                            ap.status === 'Não Aplicável' ? 'bg-slate-100 text-slate-600 border-slate-300' :
                                            'bg-bg-deep text-text-primary border-border-subtle'
                                          }`}
                                        >
                                          <option value="Pendente">Pendente</option>
                                          <option value="Em Andamento">Em Andamento</option>
                                          <option value="Pausado">Pausado</option>
                                          <option value="Concluído">Concluído</option>
                                          <option value="Não Aplicável">Não Aplicável</option>
                                        </select>

                                        {!isLocked && (
                                          <button
                                            type="button"
                                            onClick={() => setTaskModal({
                                              open: true,
                                              title: `Análise Técnica: ${item.nome} (${ap.usuario_nome})`,
                                              desc: ap.observacao || '',
                                              respId: ap.usuario_id,
                                              limitDate: '',
                                              checklistItemId: item.id,
                                              checklistAplicacaoId: ap.id
                                            })}
                                            className="p-1.5 hover:bg-brand-primary/10 text-brand-primary rounded border border-border-subtle hover:border-brand-primary/30 h-8 w-8 flex items-center justify-center cursor-pointer"
                                            title="Criar Tarefa Vinculada"
                                          >
                                            <ListTodo className="w-3.5 h-3.5" />
                                          </button>
                                        )}

                                        {!isLocked && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteTechAplicacao(ap.id)}
                                            className="p-1.5 hover:bg-rose-50 text-rose-600 rounded border border-border-subtle hover:border-rose-200 h-8 w-8 flex items-center justify-center cursor-pointer"
                                            title="Remover Vínculo"
                                          >
                                            <Trash className="w-3.5 h-3.5" />
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add checklist item form */}
                    {!isLocked && (String(detail.po_id) === String(user?.id) || user?.roles?.some(r => ['ADMIN', 'DIRETORIA', 'GERENTE'].includes(r))) && (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const nomeInput = form.elements.namedItem('nome') as HTMLInputElement;
                          const descInput = form.elements.namedItem('desc') as HTMLInputElement;
                          handleCreateChecklistItem(grupo.id, nomeInput.value, descInput.value);
                          form.reset();
                        }}
                        className="flex flex-col md:flex-row gap-2 mt-4 pt-3 border-t border-border-subtle/40"
                      >
                        <input
                          type="text"
                          name="nome"
                          required
                          placeholder="Adicionar novo item ao checklist..."
                          className="flex-1 bg-bg-deep border border-border-subtle rounded-md py-1.5 px-3 text-xs text-text-primary focus:outline-none focus:border-brand-primary h-9"
                        />
                        <input
                          type="text"
                          name="desc"
                          placeholder="Descrição opcional..."
                          className="flex-1 bg-bg-deep border border-border-subtle rounded-md py-1.5 px-3 text-xs text-text-primary focus:outline-none focus:border-brand-primary h-9"
                        />
                        <Button type="submit" size="sm" className="h-9 py-1 px-3 text-xs">
                          <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                        </Button>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tarefas' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle/40 pb-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <ListTodo className="w-4 h-4 text-brand-primary" />
                  Tarefas Operacionais
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Gerencie e acompanhe as tarefas de precificação, habilitação técnica e fechamento do edital.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-bg-deep border border-border-subtle rounded-md py-1.5 px-3 text-xs text-text-primary focus:outline-none h-9 cursor-pointer"
                >
                  <option value="Todos">Status: Todos</option>
                  <option value="Pendente">Status: Pendente</option>
                  <option value="Em Andamento">Status: Em Andamento</option>
                  <option value="Pausada">Status: Pausada</option>
                  <option value="Concluída">Status: Concluída</option>
                  <option value="Cancelada">Status: Cancelada</option>
                </select>
                {!isLocked && (
                  <Button
                    type="button"
                    onClick={() => setTaskModal({
                      open: true,
                      title: '',
                      desc: '',
                      respId: '',
                      limitDate: ''
                    })}
                    size="sm"
                    className="h-9"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Nova Tarefa
                  </Button>
                )}
              </div>
            </div>

            {loadingTasks ? (
              <div className="flex justify-center items-center py-12 text-text-muted">
                <Loader2 className="w-6 h-6 animate-spin mr-2 text-brand-primary" />
                <span>Carregando tarefas...</span>
              </div>
            ) : tasksList.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-12">Nenhuma tarefa criada neste edital.</p>
            ) : (
              <div className="space-y-4">
                {(statusFilter === 'Todos' ? tasksList : tasksList.filter(t => t.status === statusFilter)).length === 0 ? (
                  <p className="text-xs text-text-muted text-center py-12">Nenhuma tarefa corresponde ao filtro selecionado.</p>
                ) : (
                  (statusFilter === 'Todos' ? tasksList : tasksList.filter(t => t.status === statusFilter)).map((task: any) => {
                    const isOverdue = task.status !== 'Concluída' && task.status !== 'Cancelada' && new Date(task.data_limite) < new Date();
                    return (
                      <div key={task.id} className="bg-bg-deep/10 border border-border-subtle/60 rounded-xl p-4 space-y-3 hover:shadow-sm transition-all duration-200">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h4 className="font-bold text-sm text-text-primary">{task.titulo}</h4>
                            {task.descricao && <p className="text-xs text-text-muted mt-1 leading-relaxed">{task.descricao}</p>}
                            {(task.checklist_item_id || task.checklist_aplicacao_id) && (
                              <span className="inline-flex items-center gap-1 mt-2 text-[10px] bg-brand-primary/5 text-brand-primary py-0.5 px-2 rounded-full font-bold">
                                <CheckSquare className="w-2.5 h-2.5" /> Vinculado ao Checklist
                              </span>
                            )}
                          </div>
                          
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            task.status === 'Pendente' ? 'bg-slate-100 text-slate-700' :
                            task.status === 'Em Andamento' ? 'bg-blue-50 text-blue-700' :
                            task.status === 'Pausada' ? 'bg-amber-50 text-amber-700 border border-amber-300' :
                            task.status === 'Concluída' ? 'bg-emerald-50 text-emerald-700' :
                            'bg-rose-50 text-rose-700'
                          }`}>
                            {task.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-3 border-t border-border-subtle/40 text-text-muted">
                          <div>
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-text-muted">Responsável</span>
                            <span className="font-bold text-text-primary">{task.responsavel_nome || '—'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-text-muted">Prazo Final</span>
                            <span className={`font-mono font-bold ${isOverdue ? 'text-rose-600 font-extrabold flex items-center gap-1 animate-pulse' : 'text-text-primary'}`}>
                              {isOverdue && <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                              {new Date(task.data_limite).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-text-muted">Criador</span>
                            <span>{task.criador_nome || '—'}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-semibold uppercase tracking-wide text-text-muted">Atualização</span>
                            <span className="font-mono">{new Date(task.updated_at).toLocaleDateString('pt-BR')}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-3 border-t border-border-subtle/20 gap-2 flex-wrap text-xs">
                          <button
                            type="button"
                            onClick={() => setAndamentoModal({ open: true, task, newDesc: '' })}
                            className="flex items-center gap-1 text-brand-primary hover:underline font-bold cursor-pointer"
                          >
                            <MessageSquare className="w-3.5 h-3.5" /> Andamentos ({task.andamentos?.length || 0})
                          </button>

                          <div className="flex items-center gap-2">
                            {!isLocked && (
                              <>
                                {task.status === 'Pendente' && (
                                  <Button size="sm" variant="outline" onClick={() => handleTaskStatusChange(task.id, 'Em Andamento')} className="h-8 text-xs py-1 px-2.5">
                                    <Activity className="w-3.5 h-3.5 mr-1 text-blue-500" /> Em Andamento
                                  </Button>
                                )}

                                {task.status === 'Em Andamento' && (
                                  <Button size="sm" variant="outline" onClick={() => handleTaskStatusChange(task.id, 'Pausada')} className="h-8 text-xs py-1 px-2.5 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300">
                                    <Clock className="w-3.5 h-3.5 mr-1 text-amber-500" /> Pausar
                                  </Button>
                                )}

                                {task.status === 'Pausada' && (
                                  <Button size="sm" variant="outline" onClick={() => handleTaskStatusChange(task.id, 'Em Andamento')} className="h-8 text-xs py-1 px-2.5 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300">
                                    <Play className="w-3.5 h-3.5 mr-1 text-blue-500" /> Retomar
                                  </Button>
                                )}
                                
                                {['Pendente', 'Em Andamento', 'Pausada'].includes(task.status) && (
                                  <Button size="sm" variant="outline" onClick={() => handleTaskStatusChange(task.id, 'Concluída')} className="h-8 text-xs py-1 px-2.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300">
                                    <CheckSquare className="w-3.5 h-3.5 mr-1 text-emerald-500" /> Concluir
                                  </Button>
                                )}

                                {task.status === 'Concluída' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleTaskStatusChange(task.id, 'Pendente')}
                                    className="h-8 text-xs py-1 px-2.5 hover:bg-slate-100 hover:text-text-primary"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5 mr-1" /> Reabrir
                                  </Button>
                                )}

                                {['Pendente', 'Em Andamento', 'Pausada'].includes(task.status) && canCancelTask && (
                                  <Button size="sm" variant="outline" onClick={() => handleTaskStatusChange(task.id, 'Cancelada')} className="h-8 text-xs py-1 px-2.5 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-300">
                                    <Trash className="w-3.5 h-3.5 mr-1 text-rose-500" /> Cancelar
                                  </Button>
                                )}

                                {task.status !== 'Concluída' && (
                                  <button
                                    type="button"
                                    onClick={() => setTaskModal({
                                      open: true,
                                      editId: task.id,
                                      title: task.titulo,
                                      desc: task.descricao || '',
                                      respId: task.responsavel_id,
                                      limitDate: new Date(task.data_limite).toISOString().slice(0, 10),
                                      checklistItemId: task.checklist_item_id || undefined,
                                      checklistAplicacaoId: task.checklist_aplicacao_id || undefined
                                    })}
                                    className="p-1.5 hover:bg-brand-primary/10 text-brand-primary rounded border border-border-subtle hover:border-brand-primary/30 h-8 w-8 flex items-center justify-center cursor-pointer"
                                    title="Editar Tarefa"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-6">
            <h3 className="text-base font-semibold text-text-primary flex items-center gap-2 border-b border-border-subtle/40 pb-3">
              <History className="w-4 h-4 text-brand-primary" />
              Histórico / Linha do Tempo da Licitação
            </h3>
            {historyList.length === 0 ? (
              <p className="text-xs text-text-muted text-center py-6">Nenhum evento registrado nesta licitação.</p>
            ) : (
              <div className="relative pl-6 border-l border-border-subtle space-y-6">
                {historyList.map((h) => (
                  <div key={h.id} className="relative">
                    {/* Bullet point indicator */}
                    <span className="absolute -left-[30.5px] top-1.5 w-2.5 h-2.5 rounded-full bg-brand-primary border-2 border-bg-surface shadow-[0_0_0_4px_rgba(76,107,244,0.15)]" />
                    <div className="text-xs text-text-muted">
                      {new Date(h.data_movimentacao).toLocaleString('pt-BR')} — <span className="font-bold text-text-primary">{h.usuario_nome || 'Sistema'}</span>
                    </div>
                    <p className="text-sm text-text-primary mt-1 font-medium bg-bg-deep/10 p-3 rounded-lg border border-border-subtle/40">
                      {h.descricao}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'dre' && (
          <div className="space-y-6 animate-in fade-in">
            {/* Header / Cabeçalho */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle/40 pb-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-primary" />
                  Demonstrativo de Resultado da Venda (DRV)
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Análise consolidada de entradas, saídas, impostos e rentabilidade final da operação comercial.
                </p>
              </div>
              <Button
                type="button"
                onClick={loadDre}
                disabled={loadingDre}
                className="bg-bg-deep border border-border-subtle text-text-primary hover:bg-border-subtle/20 shrink-0"
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loadingDre ? 'animate-spin' : ''}`} />
                Atualizar DRV
              </Button>
            </div>

            {loadingDre ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 className="w-8 h-8 text-brand-primary animate-spin" />
                <p className="text-sm text-text-muted font-medium">Processando e consolidando indicadores financeiro-tributários...</p>
              </div>
            ) : !dreData ? (
              <div className="text-center py-20 text-text-muted bg-bg-deep/10 border border-border-subtle/30 rounded-xl">
                Nenhum dado de DRV carregado. Clique em "Atualizar DRV" para calcular.
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header Info Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 bg-bg-deep/10 border border-border-subtle/50 p-4 rounded-xl">
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Cliente</span>
                    <span className="text-sm font-semibold text-text-primary block mt-0.5">{dreData.header.cliente_nome}</span>
                    <span className="text-xs text-text-muted block mt-0.5">{dreData.header.cidade} - {dreData.header.estado}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Vendedor / Comercial</span>
                    <span className="text-sm font-semibold text-text-primary block mt-0.5">{dreData.header.vendedor_nome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Responsável (Project Owner)</span>
                    <span className="text-sm font-semibold text-text-primary block mt-0.5">{dreData.header.responsavel_nome}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-text-muted block">Edital / Oportunidade</span>
                    <span className="text-sm font-semibold text-text-primary block mt-0.5">{dreData.header.numero_oportunidade}</span>
                    <span className="text-[10px] text-text-muted block mt-0.5">
                      Fechamento: {dreData.header.data_fechamento ? new Date(dreData.header.data_fechamento).toLocaleDateString('pt-BR') : 'Pendente'}
                    </span>
                  </div>
                </div>

                {/* DRE Structure */}
                <div className="border border-border-subtle/60 rounded-xl overflow-hidden shadow-sm bg-surface">
                  <table className="w-full text-sm text-left border-collapse">
                    <thead>
                      <tr className="bg-bg-deep/20 border-b border-border-subtle/60">
                        <th className="py-3 px-4 font-bold text-xs uppercase text-text-muted tracking-wider">Descrição do Item</th>
                        <th className="py-3 px-4 text-right font-bold text-xs uppercase text-text-muted tracking-wider w-32">%</th>
                        <th className="py-3 px-4 text-right font-bold text-xs uppercase text-text-muted tracking-wider w-48">Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle/40">
                      {/* ENTRADAS */}
                      <tr className="bg-emerald-500/5 font-semibold text-emerald-800 dark:text-emerald-400">
                        <td className="py-3 px-4">ENTRADAS</td>
                        <td className="py-3 px-4 text-right"></td>
                        <td className="py-3 px-4 text-right">(+) {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.entradas.total_entradas)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-6 flex items-center gap-2">
                          <span className="text-xs text-emerald-600 font-bold">(+)</span>
                          Valor Total Produtos
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">-</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.entradas.total_produtos)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-6 flex items-center gap-2">
                          <span className="text-xs text-emerald-600 font-bold">(+)</span>
                          Valor Total Serviços
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">-</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.entradas.total_servicos)}</td>
                      </tr>
                      {dreData.entradas.restituicao_icms_st > 0 && (
                        <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors bg-emerald-500/5">
                          <td className="py-2.5 px-6 flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
                            <span className="text-xs text-emerald-600 font-bold">(+)</span>
                            Restituição ICMS ST
                          </td>
                          <td className="py-2.5 px-4 text-right text-text-muted font-mono">-</td>
                          <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400 font-mono">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.entradas.restituicao_icms_st)}
                          </td>
                        </tr>
                      )}

                      {/* SAÍDAS */}
                      <tr className="bg-rose-500/5 font-semibold text-rose-800 dark:text-rose-400">
                        <td className="py-3 px-4">SAÍDAS</td>
                        <td className="py-3 px-4 text-right"></td>
                        <td className="py-3 px-4 text-right">(-) {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.total_saidas)}</td>
                      </tr>
                      
                      {/* Fornecedores */}
                      {dreData.saidas.fornecedores.map((f: any, idx: number) => (
                        <tr key={idx} className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                          <td className="py-2.5 px-6 flex items-center gap-2">
                            <span className="text-xs text-rose-600 font-bold">(-)</span>
                            Pagamento Fornecedor: {f.nome}
                          </td>
                          <td className="py-2.5 px-4 text-right text-text-muted font-mono">-</td>
                          <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(f.valor)}</td>
                        </tr>
                      ))}

                      {/* Impostos de Compra */}
                      <tr className="text-text-muted bg-bg-deep/10 text-xs font-bold uppercase tracking-wider">
                        <td className="py-1.5 px-6" colSpan={3}>Impostos de Compra (FPC)</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          IPI Compra
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_compra.ipi.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_compra.ipi.valor)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          ICMS ST Compra
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_compra.icms_st.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_compra.icms_st.valor)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          DIFAL Compra
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_compra.difal.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_compra.difal.valor)}</td>
                      </tr>

                      {/* Impostos de Venda */}
                      <tr className="text-text-muted bg-bg-deep/10 text-xs font-bold uppercase tracking-wider">
                        <td className="py-1.5 px-6" colSpan={3}>Impostos de Venda (FPV)</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          PIS
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_venda.pis.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_venda.pis.valor)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          COFINS
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_venda.cofins.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_venda.cofins.valor)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          ICMS
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_venda.icms.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_venda.icms.valor)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          IPI
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_venda.ipi.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_venda.ipi.valor)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          ISS
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_venda.iss.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_venda.iss.valor)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          IRPJ
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_venda.irpj.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_venda.irpj.valor)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          CSLL
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.impostos_venda.csll.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.impostos_venda.csll.valor)}</td>
                      </tr>

                      {/* Despesas de Venda */}
                      <tr className="text-text-muted bg-bg-deep/10 text-xs font-bold uppercase tracking-wider">
                        <td className="py-1.5 px-6" colSpan={3}>Despesas de Venda (FPV)</td>
                      </tr>
                      {dreData.saidas.despesas_venda.frete && dreData.saidas.despesas_venda.frete.valor > 0 && (
                        <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                          <td className="py-2.5 px-8 flex items-center gap-2">
                            <span className="text-xs text-rose-600 font-bold">(-)</span>
                            Frete
                          </td>
                          <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.despesas_venda.frete.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                          <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.despesas_venda.frete.valor)}</td>
                        </tr>
                      )}
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          Comissão
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.despesas_venda.comissao.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.despesas_venda.comissao.valor)}</td>
                      </tr>
                      <tr className="text-text-primary hover:bg-bg-deep/5 transition-colors">
                        <td className="py-2.5 px-8 flex items-center gap-2">
                          <span className="text-xs text-rose-600 font-bold">(-)</span>
                          Despesas Administrativas
                        </td>
                        <td className="py-2.5 px-4 text-right text-text-muted font-mono">{dreData.saidas.despesas_venda.despesas_administrativas.percent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %</td>
                        <td className="py-2.5 px-4 text-right text-text-primary font-mono">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.saidas.despesas_venda.despesas_administrativas.valor)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Totais consolidado - Lucro / Margem */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                  <div className="bg-bg-deep/10 border border-border-subtle p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Lucro Operacional (EBITDA)</span>
                      <p className={`text-2xl font-extrabold mt-1 font-mono ${dreData.lucro_ebitda >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(dreData.lucro_ebitda)}
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dreData.lucro_ebitda >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="bg-bg-deep/10 border border-border-subtle p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-text-muted uppercase tracking-wider">Margem Líquida</span>
                      <p className={`text-2xl font-extrabold mt-1 font-mono ${dreData.margem_liquida >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {dreData.margem_liquida.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %
                      </p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${dreData.margem_liquida >= 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'}`}>
                      <Activity className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'relatorios' && (
          <div className="space-y-6 animate-in fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border-subtle/40 pb-3">
              <div>
                <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-primary" />
                  Central de Relatórios da Licitação
                </h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Selecione um dos relatórios disponíveis abaixo para gerar e exportar em formato PDF.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-bg-deep/15 border border-border-subtle/50 rounded-xl p-5 space-y-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-text-primary uppercase tracking-wide">Relatório de Envio de Proposta</h4>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Compila e formata toda a precificação comercial organizada por Lote, Item e Kit.
                    Inclui preços de venda atuais, preços mínimos, descontos máximos concedidos e margens consolidadas por nível.
                  </p>
                  <p className="text-[10px] text-amber-600 font-semibold mt-1">
                    Nota: Colunas de custo e lucro serão automaticamente ocultadas se você não tiver as permissões necessárias.
                  </p>
                </div>
                <div className="pt-2 border-t border-border-subtle/30 flex items-center justify-between">
                  <span className="text-xs font-bold text-text-muted">Formato: PDF (A4 Retrato)</span>
                  <Button
                    type="button"
                    disabled={downloadingPdf}
                    onClick={handleDownloadPropostaPdf}
                    className="flex items-center gap-1.5 font-bold"
                  >
                    {downloadingPdf ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Gerando PDF...
                      </>
                    ) : (
                      <>
                        <FileText className="w-4 h-4" />
                        Exportar PDF
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* LOT MODAL */}
      <Modal
        isOpen={!!loteModal?.open}
        onClose={() => setLoteModal(null)}
        title={loteModal?.editId ? 'Editar Lote' : 'Novo Lote'}
        maxWidth="md"
      >
        <form onSubmit={handleLoteSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-1 space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Número Lote *</label>
              <input
                type="text"
                required
                value={loteModal?.numero || ''}
                onChange={e => setLoteModal(prev => prev ? { ...prev, numero: e.target.value } : null)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
                placeholder="Ex: 1"
              />
            </div>
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Nome do Lote *</label>
              <input
                type="text"
                required
                value={loteModal?.nome || ''}
                onChange={e => setLoteModal(prev => prev ? { ...prev, nome: e.target.value } : null)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
                placeholder="Ex: Equipamentos de Redes"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">Descrição</label>
            <textarea
              rows={3}
              value={loteModal?.descricao || ''}
                      onChange={e => setLoteModal(prev => prev ? { ...prev, descricao: e.target.value } : null)}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none resize-none"
              placeholder="Descrição ou observações do lote..."
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
            <Button type="button" variant="outline" onClick={() => setLoteModal(null)}>Cancelar</Button>
            <Button type="submit">Salvar Lote</Button>
          </div>
        </form>
      </Modal>

      {/* ITEM MODAL */}
      <Modal
        isOpen={!!itemModal?.open}
        onClose={() => setItemModal(null)}
        title={itemModal?.editId ? "Editar Item da Licitação" : "Novo Item da Licitação"}
        maxWidth="md"
      >
        {(() => {
          const isItemLocked = !!(itemModal?.editId && detail?.lotes.flatMap(l => l.items).find(i => i.id === itemModal.editId)?.kits?.length);
          return (
            <form onSubmit={handleItemSubmit} className="space-y-5">
              {itemModal?.editId && isItemLocked && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-600 flex items-start gap-2.5 shadow-sm">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Este item está vinculado a um Kit de Oportunidade. Seus campos quantitativos (Quantidade, Tipo de Fornecimento e Meses) estão bloqueados para manter a integridade dos cálculos.</span>
                </div>
              )}

              {/* Informações Gerais */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-1 space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Código Item *</label>
                  <input
                    type="text"
                    required
                    value={itemModal?.codigo || ''}
                    onChange={e => setItemModal(prev => prev ? { ...prev, codigo: e.target.value } : null)}
                    className="input-primary w-full"
                    placeholder="Ex: 1.1"
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome do Item *</label>
                  <input
                    type="text"
                    required
                    value={itemModal?.nome || ''}
                    onChange={e => setItemModal(prev => prev ? { ...prev, nome: e.target.value } : null)}
                    className="input-primary w-full"
                    placeholder="Ex: Switch L3 24 portas"
                  />
                </div>
              </div>

              {/* Descrição */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Descrição</label>
                <input
                  type="text"
                  value={itemModal?.descricao || ''}
                  onChange={e => setItemModal(prev => prev ? { ...prev, descricao: e.target.value } : null)}
                  className="input-primary w-full"
                  placeholder="Especificações, marca, modelo ou detalhes adicionais..."
                />
              </div>

              {/* Card de Configuração de Fornecimento e Quantidade (Região Comum) */}
              <div className="bg-bg-deep/40 p-4 rounded-xl border border-border-subtle/80 space-y-4 shadow-sm transition-all duration-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-text-primary uppercase tracking-wider">Configuração de Quantidades</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                    itemModal?.tipo_fornecimento === 'Mensal'
                      ? 'bg-brand-info/15 text-brand-info border-brand-info/20'
                      : 'bg-text-muted/15 text-text-muted border-text-muted/20'
                  }`}>
                    {itemModal?.tipo_fornecimento === 'Mensal' ? 'Recorrente' : 'Faturamento Único'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Tipo de Fornecimento */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase">Tipo de Fornecimento *</label>
                    <select
                      value={itemModal?.tipo_fornecimento || 'Unitário'}
                      onChange={e => setItemModal(prev => prev ? { ...prev, tipo_fornecimento: e.target.value } : null)}
                      disabled={isItemLocked}
                      className="input-primary w-full pl-2 cursor-pointer"
                    >
                      <option value="Unitário">Unitário</option>
                      <option value="Mensal">Mensal</option>
                    </select>
                  </div>

                  {/* Quantidade */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-text-muted uppercase">Quantidade Base *</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={itemModal?.quantidade || ''}
                      onChange={e => setItemModal(prev => prev ? { ...prev, quantidade: Number(e.target.value) } : null)}
                      disabled={isItemLocked}
                      className="input-primary w-full"
                      placeholder="Ex: 5"
                    />
                  </div>

                  {/* Total de Meses */}
                  {itemModal?.tipo_fornecimento === 'Mensal' ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-text-muted uppercase">Total de Meses *</label>
                      <input
                        type="number"
                        step="1"
                        required
                        value={itemModal?.total_meses || ''}
                        onChange={e => setItemModal(prev => prev ? { ...prev, total_meses: Number(e.target.value) } : null)}
                        disabled={isItemLocked}
                        className="input-primary w-full"
                        placeholder="Ex: 12"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1.5 flex flex-col justify-between">
                      <label className="text-xs font-bold text-text-muted uppercase">Total de Meses</label>
                      <div className="flex items-center min-h-[38px] w-full rounded-lg border border-border-subtle bg-bg-deep/40 px-3 text-xs text-text-muted cursor-not-allowed select-none">
                        Parcela Única (N/A)
                      </div>
                    </div>
                  )}
                </div>

                {/* Quantidade Total Display */}
                <div className="pt-3 border-t border-border-subtle/50 flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-text-primary">Quantidade Total do Item</span>
                    <span className="text-[11px] text-text-muted">Multiplicação da quantidade pelo total de meses</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-brand-primary/10 text-brand-primary font-extrabold text-base px-4 py-1.5 rounded-lg border border-brand-primary/25 shadow-sm">
                    <span>{Number((itemModal?.quantidade || 0) * (itemModal?.tipo_fornecimento === 'Mensal' ? (itemModal?.total_meses || 0) : 1))}</span>
                    <span className="text-xs font-medium text-brand-primary/75">
                      {itemModal?.tipo_fornecimento === 'Mensal' ? 'un. totais' : 'un. únicas'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
                <Button type="button" variant="outline" onClick={() => setItemModal(null)}>Cancelar</Button>
                <Button type="submit">Salvar Item</Button>
              </div>
            </form>
          );
        })()}
      </Modal>

      {/* KIT CREATE MODAL */}
      <Modal
        isOpen={!!kitCreateModal?.open}
        onClose={() => setKitCreateModal(null)}
        title="Novo Kit de Oportunidade para Item"
        maxWidth="md"
      >
        <form onSubmit={handleKitSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">Nome do Kit *</label>
            <input
              type="text"
              required
              value={kitCreateModal?.nome_kit || ''}
              onChange={e => setKitCreateModal(prev => prev ? { ...prev, nome_kit: e.target.value } : null)}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Operação Comercial *</label>
              <select
                value={kitCreateModal?.tipo_contrato || ''}
                onChange={e => setKitCreateModal(prev => prev ? { ...prev, tipo_contrato: e.target.value } : null)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
              >
                <option value="VENDA_EQUIPAMENTOS">Venda (Equipamentos)</option>
                <option value="LOCACAO">Locação</option>
                <option value="COMODATO">Comodato</option>
                <option value="INSTALACAO">Instalação</option>
              </select>
            </div>

            {['LOCACAO', 'COMODATO'].includes(kitCreateModal?.tipo_contrato || '') && (
              <>
                <div className="space-y-1.5 animate-in fade-in">
                  <label className="text-xs font-bold text-text-muted uppercase">Prazo Contrato (Meses) *</label>
                  <input
                    type="number"
                    required
                    value={kitCreateModal?.prazo_contrato_meses || 36}
                    onChange={e => setKitCreateModal(prev => prev ? { ...prev, prazo_contrato_meses: Number(e.target.value) } : null)}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
                  />
                </div>
                <div className="space-y-1.5 animate-in fade-in col-span-2">
                  <label className="text-xs font-bold text-text-muted uppercase">Carência / Prazo Instalação (Meses)</label>
                  <input
                    type="number"
                    value={kitCreateModal?.prazo_instalacao_meses || 0}
                    onChange={e => setKitCreateModal(prev => prev ? { ...prev, prazo_instalacao_meses: Number(e.target.value) } : null)}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
                  />
                </div>
              </>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
            <Button type="button" variant="outline" onClick={() => setKitCreateModal(null)}>Cancelar</Button>
            <Button type="submit">Criar Kit e Ir para o Simulador</Button>
          </div>
        </form>
      </Modal>

      {/* CASCADE DELETE WARNING MODAL */}
      <Modal
        isOpen={!!deleteWarning}
        onClose={() => !isPerformingDelete && setDeleteWarning(null)}
        title={deleteWarning?.title || 'Excluir Item'}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="flex items-start gap-4 p-4 bg-rose-50 border border-rose-200 rounded-lg text-rose-800">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
            <div>
              <p className="font-semibold text-sm">Atenção: Ação Irreversível</p>
              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                {deleteWarning?.message}
              </p>
            </div>
          </div>

          {deleteError && (
            <div className="text-xs text-rose-600 bg-rose-50 p-3 rounded font-medium border border-rose-100">
              {deleteError}
            </div>
          )}

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-border-subtle">
            <Button
              variant="outline"
              onClick={() => setDeleteWarning(null)}
              disabled={isPerformingDelete}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="bg-rose-600 hover:bg-rose-700 text-white border-none"
              onClick={handlePerformDelete}
              disabled={isPerformingDelete}
            >
              {isPerformingDelete ? 'Excluindo...' : 'Sim, Excluir'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* QUICK CLIENT CNPJ MODAL */}
      <Modal
        isOpen={quickClientModal}
        onClose={() => {
          setQuickClientModal(false);
          setQuickCnpj('');
          setQuickClientData(null);
          setQuickClientError(null);
        }}
        title="Cadastrar Órgão Público por CNPJ"
        maxWidth="md"
      >
        <form onSubmit={handleQuickClientSubmit} className="space-y-4">
          {quickClientError && (
            <div className="p-3 bg-rose-50 text-rose-600 rounded text-xs border border-rose-100 font-medium">
              {quickClientError}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CNPJ *</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                maxLength={18}
                value={quickCnpj}
                onChange={e => setQuickCnpj(e.target.value)}
                placeholder="Ex: 00.000.000/0000-00"
                className="flex-1 bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
              />
              <Button
                type="button"
                onClick={handleQuickCnpjLookup}
                disabled={quickCnpjLoading || (quickCnpj.replace(/\D/g, '')).length < 14}
                className="h-11"
              >
                {quickCnpjLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Consultar CNPJ
              </Button>
            </div>
          </div>

          {quickClientData && (
            <div className="space-y-4 animate-in fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Razão Social *</label>
                <input
                  type="text"
                  required
                  value={quickClientData.razaoSocial || ''}
                  onChange={e => setQuickClientData({ ...quickClientData, razaoSocial: e.target.value })}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome Fantasia</label>
                  <input
                    type="text"
                    value={quickClientData.nomeFantasia || ''}
                    onChange={e => setQuickClientData({ ...quickClientData, nomeFantasia: e.target.value })}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Esfera Municipal/Estadual *</label>
                  <select
                    value={quickEsfera}
                    onChange={e => setQuickEsfera(e.target.value)}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
                  >
                    <option value="MUNICIPAL">Municipal</option>
                    <option value="ESTADUAL">Estadual</option>
                    <option value="FEDERAL">Federal</option>
                    <option value="AUTARQUIA">Autarquia</option>
                  </select>
                </div>
              </div>

              <div className="p-3 bg-bg-deep/40 rounded-lg text-xs space-y-1 border border-border-subtle/50 text-text-muted">
                <p><span className="font-bold text-text-primary">CEP:</span> {quickClientData.endereco?.cep || '—'}</p>
                <p><span className="font-bold text-text-primary">Logradouro:</span> {quickClientData.endereco?.logradouro || '—'}, {quickClientData.endereco?.numero || 'S/N'}</p>
                <p><span className="font-bold text-text-primary">Bairro:</span> {quickClientData.endereco?.bairro || '—'}</p>
                <p><span className="font-bold text-text-primary">Cidade/UF:</span> {quickClientData.endereco?.municipio || '—'} - {quickClientData.endereco?.uf || '—'}</p>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setQuickClientModal(false);
                setQuickCnpj('');
                setQuickClientData(null);
                setQuickClientError(null);
              }}
              disabled={quickCnpjLoading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!quickClientData || quickCnpjLoading}
            >
              {quickCnpjLoading ? 'Salvando...' : 'Salvar e Selecionar'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* TECH APLICACAO MODAL */}
      <Modal
        isOpen={!!techAplicacaoModal?.open}
        onClose={() => {
          setTechAplicacaoModal(null);
          setSelectedTechAnalystId('');
          setTechObservation('');
        }}
        title={`Vincular Analista Técnico: ${techAplicacaoModal?.name}`}
        maxWidth="md"
      >
        <form onSubmit={handleCreateTechAplicacao} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">Selecionar Analista da Equipe *</label>
            <select
              required
              value={selectedTechAnalystId}
              onChange={e => setSelectedTechAnalystId(e.target.value)}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
            >
              <option value="">Selecione...</option>
              {getTeamMembers().map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">Observações / Instruções</label>
            <textarea
              rows={3}
              value={techObservation}
              onChange={e => setTechObservation(e.target.value)}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none resize-none"
              placeholder="Especificações ou detalhes sobre a análise a ser feita..."
            />
          </div>
          <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTechAplicacaoModal(null);
                setSelectedTechAnalystId('');
                setTechObservation('');
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!selectedTechAnalystId}>Vincular Analista</Button>
          </div>
        </form>
      </Modal>

      {/* TASK CREATE / EDIT MODAL */}
      <Modal
        isOpen={!!taskModal?.open}
        onClose={() => setTaskModal(null)}
        title={taskModal?.editId ? 'Editar Tarefa' : 'Nova Tarefa'}
        maxWidth="md"
      >
        <form onSubmit={handleTaskSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">Título da Tarefa *</label>
            <input
              type="text"
              required
              value={taskModal?.title || ''}
              onChange={e => setTaskModal(prev => prev ? { ...prev, title: e.target.value } : null)}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
              placeholder="Ex: Revisar planilha tributária"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase">Descrição</label>
            <textarea
              rows={3}
              value={taskModal?.desc || ''}
              onChange={e => setTaskModal(prev => prev ? { ...prev, desc: e.target.value } : null)}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none resize-none"
              placeholder="Descreva detalhadamente o que deve ser feito..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Responsável *</label>
              <select
                required
                value={taskModal?.respId || ''}
                onChange={e => setTaskModal(prev => prev ? { ...prev, respId: e.target.value } : null)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
              >
                <option value="">Selecione o responsável...</option>
                {getTeamMembers().map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase">Data Limite *</label>
              <input
                type="date"
                required
                max={
                  detail?.analistas?.find(a => a.usuario_id === taskModal?.respId)?.data_limite
                    ? new Date(detail.analistas.find(a => a.usuario_id === taskModal?.respId).data_limite).toISOString().slice(0, 10)
                    : undefined
                }
                value={taskModal?.limitDate || ''}
                onChange={e => setTaskModal(prev => prev ? { ...prev, limitDate: e.target.value } : null)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none h-11"
              />
              {detail?.analistas?.find(a => a.usuario_id === taskModal?.respId) && (
                <p className="text-[10px] text-amber-600 font-semibold mt-1">
                  Limite do analista: {new Date(detail.analistas.find(a => a.usuario_id === taskModal?.respId).data_limite).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
            <Button type="button" variant="outline" onClick={() => setTaskModal(null)}>Cancelar</Button>
            <Button type="submit">Salvar Tarefa</Button>
          </div>
        </form>
      </Modal>

      {/* TAREFA ANDAMENTO / HISTORICO MODAL */}
      <Modal
        isOpen={!!andamentoModal?.open}
        onClose={() => setAndamentoModal(null)}
        title={`Andamentos / Comentários: ${andamentoModal?.task?.titulo}`}
        maxWidth="lg"
      >
        <div className="space-y-6">
          {!isLocked && (
            <form onSubmit={handleAndamentoSubmit} className="space-y-3 bg-bg-deep/15 border border-border-subtle/40 rounded-xl p-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-muted uppercase">Novo Comentário / Atualização</label>
                <textarea
                  rows={2}
                  required
                  value={andamentoModal?.newDesc || ''}
                  onChange={e => setAndamentoModal(prev => prev ? { ...prev, newDesc: e.target.value } : null)}
                  className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-sm text-text-primary focus:outline-none resize-none"
                  placeholder="Escreva um comentário ou atualização sobre a tarefa..."
                />
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  <MessageSquare className="w-3.5 h-3.5 mr-1" /> Adicionar Comentário
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {(!andamentoModal?.task?.andamentos || andamentoModal.task.andamentos.length === 0) ? (
              <p className="text-xs text-text-muted text-center py-6">Nenhum andamento registrado nesta tarefa.</p>
            ) : (
              andamentoModal.task.andamentos.map((and: any) => (
                <div key={and.id} className="p-3 bg-bg-deep/5 border border-border-subtle/30 rounded-lg space-y-1.5 text-xs">
                  <div className="flex justify-between items-center text-text-muted">
                    <span className="font-semibold text-text-primary flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-brand-primary" /> {and.usuario_nome}
                    </span>
                    <span className="font-mono">{new Date(and.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <p className="text-text-primary font-medium">{and.descricao}</p>
                  
                  {and.status_anterior !== and.status_novo && (
                    <p className="text-[10px] text-text-muted">
                      Transição: <span className="font-semibold">{and.status_anterior}</span> &rarr; <span className="font-semibold">{and.status_novo}</span>
                    </p>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="pt-4 flex justify-end border-t border-border-subtle">
            <Button type="button" variant="outline" onClick={() => setAndamentoModal(null)}>Fechar</Button>
          </div>
        </div>
      </Modal>

      {isPurchaseSearchModalOpen && (
        <PurchaseBudgetSearchModal
          isOpen={isPurchaseSearchModalOpen}
          availableBudgets={availableBudgets}
          onClose={() => setIsPurchaseSearchModalOpen(false)}
          onSelect={(b) => handleLinkBudget(b.id)}
          title="Vincular Orçamento de Compra Existente"
        />
      )}
    </div>
  );
}
