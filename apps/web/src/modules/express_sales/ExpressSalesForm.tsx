import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Zap, Plus, Trash2, Save, ArrowLeft, History, AlertTriangle, 
  CheckCircle2, Building2, CreditCard, Package,
  RefreshCw, Clock, ShoppingCart, Repeat, X, Eye,
  Printer, Layers, Loader2, Search, ShieldAlert, ShieldCheck,
  KeyRound, XCircle, Lock, Check
} from 'lucide-react';
import { api, resolveHtmlMediaUrls } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tooltip } from '../../components/ui/Tooltip';
import { OpportunityKitSearchModal } from '../../components/modals/OpportunityKitSearchModal';
import { OpportunityKitForm } from '../opportunity_kits/OpportunityKitForm';
import { QuickCustomerCreateModal } from '../../components/modals/QuickCustomerCreateModal';
import { ProposalGroupingModal, type ProposalKitInfo, type ProposalKitGroup } from '../sales_budgets/components/ProposalGroupingModal';
import Modal from '../../components/modals/Modal';

interface SalesTeamItem {
  id: string;
  nome: string;
  nomenclatura_orcamento?: string | null;
  numero_proposta?: number;
  ativo?: boolean;
  permite_venda_express?: boolean;
  members?: { user_id: string; cargo: string }[];
}

interface PaymentMethodItem {
  id: string;
  nome: string;
  is_active: boolean;
}

interface CustomerOption {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj?: string;
}

interface ExpressItemRow {
  opportunity_kit_id: string;
  nome_kit: string;
  tipo_contrato: string;
  tipo_precificacao: string;
  quantidade: number;
  custo_unitario: number;
  valor_unitario_base: number;
  desconto_percentual: number;
  acrescimo_percentual: number;
  valor_unitario_final: number;
  valor_total_final: number;
  fator_efetivo: number;
  comissao_percentual: number;
  valor_comissao_estimada: number;
  valor_comissao_bruta?: number;
  comissao_bruta_percentual?: number;
  valor_dsr?: number;
  valor_fgts?: number;
  valor_inss?: number;
  valor_demais?: number;
  comissao_liquida_percentual?: number;
  valor_comissao_liquida?: number;
  despesa_operacional_percentual?: number;
  valor_despesa_operacional?: number;
  valor_despesas_venda?: number;
  despesas_venda_percentual?: number;
  lucro_unitario_estimado: number;
  margem_estimada: number;
  commercial_policy_id?: string | null;
  nome_politica?: string | null;
  fator_limite_politica?: number | null;
  requer_aprovacao: boolean;
  motivo_aprovacao?: string | null;
  isCalculating?: boolean;
}

interface AuditDiffRecord {
  id: string;
  versao: number;
  status_anterior: string;
  status_novo: string;
  usuario_nome: string;
  descricao: string;
  diff_changes?: any;
  data_movimentacao: string;
}

interface NumericValueInputProps {
  value: number | undefined | null;
  onChange: (val: number) => void;
  decimals?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const NumericValueInput: React.FC<NumericValueInputProps> = ({
  value,
  onChange,
  decimals = 2,
  min,
  max,
  placeholder = '0.00',
  className = '',
  disabled = false
}) => {
  const [localStr, setLocalStr] = useState<string>(() => {
    const num = Number(value || 0);
    return isNaN(num) ? '' : num.toFixed(decimals);
  });
  const [isFocused, setIsFocused] = useState(false);
  const isDirtyRef = useRef(false);
  const lastEmittedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isFocused) {
      const num = Number(value);
      setLocalStr(isNaN(num) || value === undefined || value === null ? '' : num.toFixed(decimals));
    }
  }, [value, isFocused, decimals]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const raw = e.target.value;
    isDirtyRef.current = true;

    if (raw === '') {
      setLocalStr('');
      lastEmittedRef.current = 0;
      onChange(0);
      return;
    }

    const normalized = raw.replace(',', '.');
    if (/^\d*\.?\d*$/.test(normalized)) {
      setLocalStr(raw);
      const parsed = parseFloat(normalized);
      if (!isNaN(parsed)) {
        let finalVal = parsed;
        if (min !== undefined && finalVal < min) finalVal = min;
        if (max !== undefined && finalVal > max) finalVal = max;
        lastEmittedRef.current = finalVal;
        onChange(finalVal);
      }
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!isDirtyRef.current) {
      // Field was not touched during this focus session (e.g. user just pressed Tab)
      const num = Number(value);
      setLocalStr(isNaN(num) || value === undefined || value === null ? '' : num.toFixed(decimals));
      return;
    }

    isDirtyRef.current = false;
    const normalized = localStr.replace(',', '.');
    let parsed = parseFloat(normalized);
    if (isNaN(parsed) || localStr.trim() === '') {
      parsed = 0;
    }
    if (min !== undefined && parsed < min) parsed = min;
    if (max !== undefined && parsed > max) parsed = max;
    setLocalStr(parsed.toFixed(decimals));
    if (lastEmittedRef.current !== parsed) {
      lastEmittedRef.current = parsed;
      onChange(parsed);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    if (disabled) return;
    setIsFocused(true);
    isDirtyRef.current = false;
    lastEmittedRef.current = Number(value || 0);
    e.target.select();
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={localStr}
      placeholder={placeholder}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
    />
  );
};

export function ExpressSalesForm() {
  const navigate = useNavigate();
  const { id: budgetIdParam } = useParams<{ id: string }>();
  const { user, activeCompanyId } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  // Status & Approval State
  const [budgetStatus, setBudgetStatus] = useState<string>('EM_LANCAMENTO');
  const [isApproved, setIsApproved] = useState<boolean>(false);
  const [approverName, setApproverName] = useState<string>('');

  // Manager Authorization Modal State
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showConfirmApprovalModal, setShowConfirmApprovalModal] = useState(false);

  // Finalize Sale Modal State
  const [isFinalizeModalOpen, setIsFinalizeModalOpen] = useState(false);
  const [finalizeStatus, setFinalizeStatus] = useState<'GANHO' | 'PERDIDO'>('GANHO');
  const [motivoPerda, setMotivoPerda] = useState('');
  const [finalizing, setFinalizing] = useState(false);

  // Header State
  const [customerId, setCustomerId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customersList, setCustomersList] = useState<CustomerOption[]>([]);
  const [salesTeamId, setSalesTeamId] = useState<string>('');
  const [salesTeams, setSalesTeams] = useState<SalesTeamItem[]>([]);
  const [vendedorId, setVendedorId] = useState<string>('');
  const [allUsers, setAllUsers] = useState<{ id: string; name: string }[]>([]);
  const [formaPagamentoId, setFormaPagamentoId] = useState<string>('');
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [titulo, setTitulo] = useState('Venda Express / Varejo');
  const [observacoes, setObservacoes] = useState('');
  const [numeroOrcamento, setNumeroOrcamento] = useState<string>('');
  const [budgetVersion, setBudgetVersion] = useState<number>(1);

  // Items State & Tabs
  const [activeKitTab, setActiveKitTab] = useState<'VENDA' | 'RECORRENCIA'>('VENDA');
  const [items, setItems] = useState<ExpressItemRow[]>([]);

  // Modals & Drawers
  const [kitModalConfig, setKitModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    allowedTypes: string[];
  }>({
    isOpen: false,
    title: 'Selecionar Kit de Venda',
    allowedTypes: ['VENDA_EQUIPAMENTOS', 'VENDA']
  });
  const [kitToEdit, setKitToEdit] = useState<{ id: string; nome: string } | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<AuditDiffRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showCreateKitModal, setShowCreateKitModal] = useState(false);
  const [createKitTipoContrato, setCreateKitTipoContrato] = useState<string>('VENDA_EQUIPAMENTOS');
  const [isGroupingModalOpen, setIsGroupingModalOpen] = useState(false);
  const [proposalCustomGroupings, setProposalCustomGroupings] = useState<ProposalKitGroup[]>([]);
  const [generatingProposal, setGeneratingProposal] = useState(false);
  const [noDocumentRuleModalOpen, setNoDocumentRuleModalOpen] = useState(false);

  const debounceTimers = useRef<{ [key: string]: any }>({});

  useEffect(() => {
    if (!activeCompanyId) return;
    loadAuxiliaryData();
    if (budgetIdParam) {
      loadBudgetForEdit(budgetIdParam);
    }
  }, [activeCompanyId, budgetIdParam]);

  const loadAuxiliaryData = async () => {
    try {
      const [teamsRes, payRes, usersRes] = await Promise.allSettled([
        api.get(`/companies/${activeCompanyId}/sales-teams`),
        api.get(`/cadastro/formas-pagamento`),
        api.get(`/users`)
      ]);

      if (teamsRes.status === 'fulfilled') {
        const allTeams: any[] = teamsRes.value.data || [];
        // Filter teams that are active and have flag permite_venda_express === true
        const expressTeams: SalesTeamItem[] = allTeams.filter((t: any) => t.ativo && t.permite_venda_express);
        setSalesTeams(expressTeams);
        
        // Find team where current user is a member
        const userTeam = expressTeams.find((t: any) => 
          t.members && t.members.some((m: any) => String(m.user_id) === String(user?.id))
        );

        const isAdmin = user?.roles?.some((r: any) => {
          const roleName = typeof r === 'string' ? r : r.role || r.name;
          return roleName === 'ADMIN' || roleName === 'DIRETORIA';
        }) || Boolean((user as any)?.is_superuser);

        if (userTeam) {
          setSalesTeamId(userTeam.id);
        } else if (isAdmin && expressTeams.length > 0) {
          setSalesTeamId(expressTeams[0].id);
        } else {
          if (!budgetIdParam) {
            setAccessDenied(true);
          }
        }
      }

      if (payRes.status === 'fulfilled') {
        const activePayMethods = (payRes.value.data || [])
          .filter((p: any) => p.ativo !== false && (p.tipo_uso === 'VENDA' || p.tipo_uso === 'AMBOS' || !p.tipo_uso))
          .map((p: any) => ({
            id: p.id,
            nome: p.descricao || p.nome || 'Forma de Pagamento',
            is_active: p.ativo !== undefined ? p.ativo : true
          }));
        setPaymentMethods(activePayMethods);
        if (activePayMethods.length > 0 && !formaPagamentoId) {
          setFormaPagamentoId(activePayMethods[0].id);
        }
      }

      if (usersRes.status === 'fulfilled') {
        const usersList = usersRes.value.data || [];
        setAllUsers(usersList);
        if (user && !vendedorId) {
          setVendedorId(user.id);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar dados auxiliares:', err);
    }
  };

  const searchCustomers = async (query: string) => {
    setCustomerSearch(query);
    if (!query || query.trim().length < 2) {
      setCustomersList([]);
      return;
    }
    try {
      const res = await api.get(`/cadastro/clientes`, { params: { q: query.trim(), limit: 10 } });
      const rawList = Array.isArray(res.data) ? res.data : (res.data?.items || []);
      setCustomersList(rawList.map((c: any) => ({
        id: c.id,
        razao_social: c.razao_social,
        nome_fantasia: c.nome_fantasia,
        cnpj: c.cnpj
      })));
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    }
  };

  const loadBudgetForEdit = async (bId: string) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/sales-budgets/${bId}`);
      const b = res.data;
      setCustomerId(b.customer_id || '');
      setCustomerSearch(b.customer?.razao_social || b.customer?.nome_fantasia || b.customer_nome || '');
      setSalesTeamId(b.sales_team_id || '');
      setVendedorId(b.vendedor_id || user?.id || '');
      setFormaPagamentoId(b.forma_pagamento_id || '');
      setTitulo(b.titulo || 'Venda Express');
      setObservacoes(b.observacoes || '');
      setNumeroOrcamento(b.numero_orcamento || '');
      setBudgetVersion(b.versao || 1);
      const isStatusApproved = b.status === 'APROVADO' || b.status === 'GANHO';
      setIsApproved(Boolean(isStatusApproved));
      if (isStatusApproved && b.approvals && b.approvals.length > 0) {
        setApproverName(b.approvals[b.approvals.length - 1]?.usuario_aprovador?.name || 'Gerência');
      } else {
        setApproverName('');
      }
      setProposalCustomGroupings(
        (b.proposal_custom_groupings || []).filter((g: any) => typeof g === 'object' && !g.is_express && g.nome_grupo)
      );

      // Load items
      const loadedItems: ExpressItemRow[] = [];
      const rawItems = [
        ...(b.items || []).map((i: any) => ({ ...i, isRental: false })),
        ...(b.rental_items || []).map((i: any) => ({ ...i, isRental: true }))
      ];

      for (const item of rawItems) {
        if (!item.opportunity_kit_id) continue;
        try {
          const pricingRes = await api.post(`/sales-budgets/express/calculate-pricing`, {
            opportunity_kit_id: item.opportunity_kit_id,
            sales_team_id: b.sales_team_id || null,
            quantidade: Number(item.quantidade) || 1,
            valor_final: Number(item.isRental ? item.valor_mensal : item.venda_unit) || undefined
          });
          const p = pricingRes.data;
          loadedItems.push({
            opportunity_kit_id: p.opportunity_kit_id,
            nome_kit: p.nome_kit || item.product_nome || item.descricao_servico || 'Kit',
            tipo_contrato: p.tipo_contrato,
            tipo_precificacao: p.tipo_precificacao,
            quantidade: Number(p.quantidade) || 1,
            custo_unitario: Number(p.custo_unitario) || 0,
            valor_unitario_base: Number(p.valor_unitario_base) || 0,
            desconto_percentual: Number(p.desconto_percentual) || 0,
            acrescimo_percentual: Number(p.acrescimo_percentual) || 0,
            valor_unitario_final: Number(p.valor_unitario_final) || 0,
            valor_total_final: Number(p.valor_total_final) || 0,
            fator_efetivo: Number(p.fator_efetivo) || 1,
            comissao_percentual: Number(p.comissao_percentual) || 0,
            valor_comissao_estimada: Number(p.valor_comissao_estimada) || 0,
            valor_comissao_bruta: Number(p.valor_comissao_bruta) || Number(p.valor_comissao_estimada) || 0,
            comissao_bruta_percentual: Number(p.comissao_bruta_percentual) || Number(p.comissao_percentual) || 0,
            valor_dsr: Number(p.valor_dsr) || 0,
            valor_fgts: Number(p.valor_fgts) || 0,
            valor_inss: Number(p.valor_inss) || 0,
            valor_demais: Number(p.valor_demais) || 0,
            comissao_liquida_percentual: Number(p.comissao_liquida_percentual) || 0,
            valor_comissao_liquida: Number(p.valor_comissao_liquida) || 0,
            despesa_operacional_percentual: Number(p.despesa_operacional_percentual) || 0,
            valor_despesa_operacional: Number(p.valor_despesa_operacional) || 0,
            valor_despesas_venda: Number(p.valor_despesas_venda) || 0,
            despesas_venda_percentual: Number(p.despesas_venda_percentual) || 0,
            lucro_unitario_estimado: Number(p.lucro_unitario_estimado) || 0,
            margem_estimada: Number(p.margem_estimada) || 0,
            commercial_policy_id: p.commercial_policy_id,
            nome_politica: p.nome_politica,
            fator_limite_politica: p.fator_limite_politica ? Number(p.fator_limite_politica) : null,
            requer_aprovacao: Boolean(p.requer_aprovacao),
            motivo_aprovacao: p.motivo_aprovacao
          });
        } catch {
          const vFinal = Number(item.isRental ? item.valor_mensal : item.venda_unit) || 0;
          const qtd = Number(item.quantidade) || 1;
          const vTot = vFinal * qtd;
          const vCom = Number(item.isRental ? item.comissao_mensal : item.comissao_unit) * qtd;
          const vDespOp = Number(item.isRental ? item.despesa_operacional_mensal : item.despesa_operacional_unit) * qtd;
          const pCom = Number(item.perc_comissao) || 0;
          const pDespOp = vTot > 0 ? (vDespOp / vTot) * 100 : 0;
          loadedItems.push({
            opportunity_kit_id: item.opportunity_kit_id,
            nome_kit: item.product_nome || item.descricao_servico || 'Kit',
            tipo_contrato: item.isRental ? (item.tipo_contrato_kit || 'LOCACAO') : 'VENDA_EQUIPAMENTOS',
            tipo_precificacao: 'DINAMICO_CUSTO',
            quantidade: qtd,
            custo_unitario: Number(item.isRental ? item.custo_aquisicao_unit : item.custo_unit_base) || 0,
            valor_unitario_base: vFinal,
            desconto_percentual: 0,
            acrescimo_percentual: 0,
            valor_unitario_final: vFinal,
            valor_total_final: vTot,
            fator_efetivo: Number(item.isRental ? item.fator_margem : item.markup) || 1.0,
            comissao_percentual: pCom,
            valor_comissao_estimada: vCom,
            valor_comissao_bruta: vCom,
            comissao_bruta_percentual: pCom,
            valor_dsr: Number(item.isRental ? item.dsr_mensal : item.dsr_unit) * qtd || 0,
            valor_fgts: Number(item.isRental ? item.fgts_mensal : item.fgts_unit) * qtd || 0,
            valor_inss: Number(item.isRental ? item.inss_mensal : item.inss_unit) * qtd || 0,
            valor_demais: Number(item.isRental ? item.demais_incidencias_mensal : item.demais_incidencias_unit) * qtd || 0,
            comissao_liquida_percentual: pCom,
            valor_comissao_liquida: vCom,
            despesa_operacional_percentual: pDespOp,
            valor_despesa_operacional: vDespOp,
            valor_despesas_venda: vCom + vDespOp,
            despesas_venda_percentual: pCom + pDespOp,
            lucro_unitario_estimado: Number(item.isRental ? item.lucro_mensal : item.lucro_unit) || 0,
            margem_estimada: Number(item.isRental ? item.margem : item.margem_unit) || 0,
            requer_aprovacao: false
          });
        }
      }
      setItems(loadedItems);
    } catch (err: any) {
      console.error('Erro ao carregar orçamento:', err);
      setError('Erro ao carregar os dados da oportunidade.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddKitFromModal = async (kit: any) => {
    if (!kit || !kit.id) return;
    try {
      const pricingRes = await api.post(`/sales-budgets/express/calculate-pricing`, {
        opportunity_kit_id: kit.id,
        sales_team_id: salesTeamId || null,
        quantidade: 1
      });
      const p = pricingRes.data;

      const newRow: ExpressItemRow = {
        opportunity_kit_id: p.opportunity_kit_id,
        nome_kit: p.nome_kit,
        tipo_contrato: p.tipo_contrato,
        tipo_precificacao: p.tipo_precificacao,
        quantidade: Number(p.quantidade) || 1,
        custo_unitario: Number(p.custo_unitario) || 0,
        valor_unitario_base: Number(p.valor_unitario_base) || 0,
        desconto_percentual: Number(p.desconto_percentual) || 0,
        acrescimo_percentual: Number(p.acrescimo_percentual) || 0,
        valor_unitario_final: Number(p.valor_unitario_final) || 0,
        valor_total_final: Number(p.valor_total_final) || 0,
        fator_efetivo: Number(p.fator_efetivo) || 1,
        comissao_percentual: Number(p.comissao_percentual) || 0,
        valor_comissao_estimada: Number(p.valor_comissao_estimada) || 0,
        valor_comissao_bruta: Number(p.valor_comissao_bruta) || Number(p.valor_comissao_estimada) || 0,
        comissao_bruta_percentual: Number(p.comissao_bruta_percentual) || Number(p.comissao_percentual) || 0,
        valor_dsr: Number(p.valor_dsr) || 0,
        valor_fgts: Number(p.valor_fgts) || 0,
        valor_inss: Number(p.valor_inss) || 0,
        valor_demais: Number(p.valor_demais) || 0,
        comissao_liquida_percentual: Number(p.comissao_liquida_percentual) || 0,
        valor_comissao_liquida: Number(p.valor_comissao_liquida) || 0,
        despesa_operacional_percentual: Number(p.despesa_operacional_percentual) || 0,
        valor_despesa_operacional: Number(p.valor_despesa_operacional) || 0,
        valor_despesas_venda: Number(p.valor_despesas_venda) || 0,
        despesas_venda_percentual: Number(p.despesas_venda_percentual) || 0,
        lucro_unitario_estimado: Number(p.lucro_unitario_estimado) || 0,
        margem_estimada: Number(p.margem_estimada) || 0,
        commercial_policy_id: p.commercial_policy_id,
        nome_politica: p.nome_politica,
        fator_limite_politica: p.fator_limite_politica ? Number(p.fator_limite_politica) : null,
        requer_aprovacao: Boolean(p.requer_aprovacao),
        motivo_aprovacao: p.motivo_aprovacao
      };

      if (Boolean(p.requer_aprovacao)) {
        setIsApproved(false);
        setApproverName('');
        setBudgetStatus('EM_LANCAMENTO');
      }

      setItems(prev => [...prev, newRow]);
    } catch (err: any) {
      console.error('Erro ao calcular precificação do kit:', err);
      setError(err.response?.data?.detail || 'Erro ao precificar kit selecionado.');
    }
  };

  const recalculateItemPricing = (
    index: number,
    changes: {
      valor_final?: number;
      desconto_percentual?: number;
      acrescimo_percentual?: number;
      quantidade?: number;
    }
  ) => {
    const row = items[index];
    if (!row) return;

    // Local immediate feedback
    const updatedRow = { ...row, ...changes, isCalculating: true };
    if (changes.valor_final !== undefined) {
      updatedRow.valor_unitario_final = changes.valor_final;
      updatedRow.valor_total_final = changes.valor_final * (updatedRow.quantidade || 1);
    } else if (changes.quantidade !== undefined) {
      updatedRow.quantidade = changes.quantidade;
      updatedRow.valor_total_final = (updatedRow.valor_unitario_final || 0) * changes.quantidade;
    }
    const newItems = [...items];
    newItems[index] = updatedRow;
    setItems(newItems);

    const timerKey = `item_${index}`;
    if (debounceTimers.current[timerKey]) {
      clearTimeout(debounceTimers.current[timerKey]);
    }

    debounceTimers.current[timerKey] = setTimeout(async () => {
      try {
        const payload = {
          opportunity_kit_id: row.opportunity_kit_id,
          sales_team_id: salesTeamId || null,
          valor_final: changes.valor_final !== undefined ? changes.valor_final : (changes.desconto_percentual === undefined && changes.acrescimo_percentual === undefined ? row.valor_unitario_final : undefined),
          desconto_percentual: changes.desconto_percentual,
          acrescimo_percentual: changes.acrescimo_percentual,
          quantidade: changes.quantidade !== undefined ? changes.quantidade : row.quantidade
        };

        const res = await api.post(`/sales-budgets/express/calculate-pricing`, payload);
        const p = res.data;

        setItems(curr => {
          const arr = [...curr];
          if (arr[index]) {
            arr[index] = {
              ...arr[index],
              quantidade: Number(p.quantidade) || 1,
              custo_unitario: Number(p.custo_unitario) || 0,
              valor_unitario_base: Number(p.valor_unitario_base) || 0,
              desconto_percentual: Number(p.desconto_percentual) || 0,
              acrescimo_percentual: Number(p.acrescimo_percentual) || 0,
              valor_unitario_final: Number(p.valor_unitario_final) || 0,
              valor_total_final: Number(p.valor_total_final) || 0,
              fator_efetivo: Number(p.fator_efetivo) || 1,
              comissao_percentual: Number(p.comissao_percentual) || 0,
              valor_comissao_estimada: Number(p.valor_comissao_estimada) || 0,
              valor_comissao_bruta: Number(p.valor_comissao_bruta) || Number(p.valor_comissao_estimada) || 0,
              comissao_bruta_percentual: Number(p.comissao_bruta_percentual) || Number(p.comissao_percentual) || 0,
              valor_dsr: Number(p.valor_dsr) || 0,
              valor_fgts: Number(p.valor_fgts) || 0,
              valor_inss: Number(p.valor_inss) || 0,
              valor_demais: Number(p.valor_demais) || 0,
              comissao_liquida_percentual: Number(p.comissao_liquida_percentual) || 0,
              valor_comissao_liquida: Number(p.valor_comissao_liquida) || 0,
              despesa_operacional_percentual: Number(p.despesa_operacional_percentual) || 0,
              valor_despesa_operacional: Number(p.valor_despesa_operacional) || 0,
              valor_despesas_venda: Number(p.valor_despesas_venda) || 0,
              despesas_venda_percentual: Number(p.despesas_venda_percentual) || 0,
              lucro_unitario_estimado: Number(p.lucro_unitario_estimado) || 0,
              margem_estimada: Number(p.margem_estimada) || 0,
              commercial_policy_id: p.commercial_policy_id,
              nome_politica: p.nome_politica,
              fator_limite_politica: p.fator_limite_politica ? Number(p.fator_limite_politica) : null,
              requer_aprovacao: Boolean(p.requer_aprovacao),
              motivo_aprovacao: p.motivo_aprovacao,
              isCalculating: false
            };
          }
          if (Boolean(p.requer_aprovacao)) {
            setIsApproved(false);
            setApproverName('');
            setBudgetStatus('EM_LANCAMENTO');
          }
          return arr;
        });
      } catch (err: any) {
        console.error('Erro no cálculo dinâmico:', err);
        setItems(curr => {
          const arr = [...curr];
          if (arr[index]) arr[index].isCalculating = false;
          return arr;
        });
      }
    }, 400);
  };

  const handleRemoveItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleSaveExpressSale = async () => {
    setError('');
    setSuccessMsg('');

    if (!customerId) {
      setError('Selecione um cliente para a venda express.');
      return;
    }
    if (items.length === 0) {
      setError('Adicione pelo menos 1 Kit à venda.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        budget_id: budgetIdParam || undefined,
        customer_id: customerId,
        sales_team_id: salesTeamId || null,
        vendedor_id: vendedorId || user?.id,
        forma_pagamento_id: formaPagamentoId || null,
        titulo: titulo || 'Venda Express',
        observacoes: observacoes || undefined,
        proposal_custom_groupings: proposalCustomGroupings,
        items: items.map(item => ({
          opportunity_kit_id: item.opportunity_kit_id,
          quantidade: item.quantidade,
          valor_final: item.valor_unitario_final,
          desconto_percentual: item.desconto_percentual,
          acrescimo_percentual: item.acrescimo_percentual,
          fator_efetivo: item.fator_efetivo,
          commercial_policy_id: item.commercial_policy_id || null
        }))
      };

      const res = await api.post(`/sales-budgets/express/save`, payload);
      const savedBudget = res.data;
      setSuccessMsg(`Venda Express gravada com sucesso! Proposta Nº ${savedBudget.numero_orcamento}`);
      setNumeroOrcamento(savedBudget.numero_orcamento);
      setBudgetVersion(savedBudget.versao || 1);

      if (savedBudget.proposal_custom_groupings) {
        setProposalCustomGroupings(
          (savedBudget.proposal_custom_groupings || []).filter((g: any) => typeof g === 'object' && !g.is_express && g.nome_grupo)
        );
      }

      if (!budgetIdParam && savedBudget.id) {
        setTimeout(() => {
          navigate(`/comercial/vendas-express/${savedBudget.id}`, { replace: true });
        }, 800);
      } else if (budgetIdParam) {
        await loadBudgetForEdit(budgetIdParam);
      }
    } catch (err: any) {
      console.error('Erro ao salvar venda express:', err);
      setError(err.response?.data?.detail || 'Erro ao salvar a venda express.');
    } finally {
      setSaving(false);
    }
  };

  const loadAuditHistory = async () => {
    const bId = budgetIdParam;
    if (!bId) return;
    setLoadingHistory(true);
    try {
      const res = await api.get(`/sales-budgets/${bId}/history-diffs`);
      setHistoryRecords(res.data || []);
      setIsHistoryDrawerOpen(true);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleReloadKitAfterEdit = async (kitId: string) => {
    try {
      const rowsToUpdate: number[] = [];
      items.forEach((item, idx) => {
        if (item.opportunity_kit_id === kitId) {
          rowsToUpdate.push(idx);
        }
      });

      for (const idx of rowsToUpdate) {
        const row = items[idx];
        const res = await api.post(`/sales-budgets/express/calculate-pricing`, {
          opportunity_kit_id: kitId,
          sales_team_id: salesTeamId || null,
          quantidade: row.quantidade,
          desconto_percentual: row.desconto_percentual,
          acrescimo_percentual: row.acrescimo_percentual
        });
        const p = res.data;
        setItems(curr => {
          const arr = [...curr];
          if (arr[idx]) {
            arr[idx] = {
              ...arr[idx],
              nome_kit: p.nome_kit || arr[idx].nome_kit,
              tipo_contrato: p.tipo_contrato || arr[idx].tipo_contrato,
              tipo_precificacao: p.tipo_precificacao || arr[idx].tipo_precificacao,
              quantidade: Number(p.quantidade) || 1,
              custo_unitario: Number(p.custo_unitario) || 0,
              valor_unitario_base: Number(p.valor_unitario_base) || 0,
              desconto_percentual: Number(p.desconto_percentual) || 0,
              acrescimo_percentual: Number(p.acrescimo_percentual) || 0,
              valor_unitario_final: Number(p.valor_unitario_final) || 0,
              valor_total_final: Number(p.valor_total_final) || 0,
              fator_efetivo: Number(p.fator_efetivo) || 1,
              comissao_percentual: Number(p.comissao_percentual) || 0,
              valor_comissao_estimada: Number(p.valor_comissao_estimada) || 0,
              valor_comissao_bruta: Number(p.valor_comissao_bruta) || Number(p.valor_comissao_estimada) || 0,
              comissao_bruta_percentual: Number(p.comissao_bruta_percentual) || Number(p.comissao_percentual) || 0,
              valor_dsr: Number(p.valor_dsr) || 0,
              valor_fgts: Number(p.valor_fgts) || 0,
              valor_inss: Number(p.valor_inss) || 0,
              valor_demais: Number(p.valor_demais) || 0,
              comissao_liquida_percentual: Number(p.comissao_liquida_percentual) || 0,
              valor_comissao_liquida: Number(p.valor_comissao_liquida) || 0,
              despesa_operacional_percentual: Number(p.despesa_operacional_percentual) || 0,
              valor_despesa_operacional: Number(p.valor_despesa_operacional) || 0,
              valor_despesas_venda: Number(p.valor_despesas_venda) || 0,
              despesas_venda_percentual: Number(p.despesas_venda_percentual) || 0,
              lucro_unitario_estimado: Number(p.lucro_unitario_estimado) || 0,
              margem_estimada: Number(p.margem_estimada) || 0,
              commercial_policy_id: p.commercial_policy_id,
              nome_politica: p.nome_politica,
              fator_limite_politica: p.fator_limite_politica ? Number(p.fator_limite_politica) : null,
              requer_aprovacao: Boolean(p.requer_aprovacao),
              motivo_aprovacao: p.motivo_aprovacao,
              isCalculating: false
            };
          }
          if (Boolean(p.requer_aprovacao)) {
            setIsApproved(false);
            setApproverName('');
            setBudgetStatus('EM_LANCAMENTO');
          }
          return arr;
        });
      }
    } catch (err) {
      console.error('Erro ao recarregar kit após edição de composição:', err);
    }
  };

  // Helper & Totals
  const isRecorrencia = (tipo?: string) => {
    const t = (tipo || '').toUpperCase();
    return t === 'LOCACAO' || t === 'COMODATO' || t.includes('LOCAC') || t.includes('COMOD');
  };

  const handleOpenKitModal = (tab: 'VENDA' | 'RECORRENCIA') => {
    setActiveKitTab(tab);
    if (tab === 'VENDA') {
      setKitModalConfig({
        isOpen: true,
        title: 'Selecionar Kit de Venda',
        allowedTypes: ['VENDA_EQUIPAMENTOS', 'VENDA']
      });
    } else {
      setKitModalConfig({
        isOpen: true,
        title: 'Selecionar Kit de Recorrência Mensal (Locação / Comodato)',
        allowedTypes: ['LOCACAO', 'COMODATO']
      });
    }
  };

  const handleOpenCreateKitModal = (tab: 'VENDA' | 'RECORRENCIA') => {
    setActiveKitTab(tab);
    setCreateKitTipoContrato(tab === 'VENDA' ? 'VENDA_EQUIPAMENTOS' : 'LOCACAO');
    setShowCreateKitModal(true);
  };

  const isFinalized = useMemo(() => {
    return budgetStatus === 'GANHO' || budgetStatus === 'PERDIDO';
  }, [budgetStatus]);

  const hasItemsRequiringApproval = useMemo(() => {
    return items.some(i => Boolean(i.requer_aprovacao));
  }, [items]);

  const isPendingApproval = useMemo(() => {
    return Boolean(hasItemsRequiringApproval && !isApproved && !isFinalized);
  }, [hasItemsRequiringApproval, isApproved, isFinalized]);

  const handleOpenAuthModal = () => {
    setAuthError('');
    setManagerEmail('');
    setManagerPassword('');
    setShowConfirmApprovalModal(false);
    setIsAuthModalOpen(true);
  };

  const handleValidateManagerCredentials = () => {
    setAuthError('');
    if (!managerEmail.trim() || !managerPassword.trim()) {
      setAuthError('Preencha o e-mail e senha do gerente/administrador.');
      return;
    }
    setShowConfirmApprovalModal(true);
  };

  const handleConfirmAuthorizeManager = async () => {
    if (!budgetIdParam) {
      setError('Salve a venda express antes de autorizar.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await api.post(`/sales-budgets/express/${budgetIdParam}/authorize-manager`, {
        email: managerEmail.trim(),
        password: managerPassword,
        motivo: 'Autorização de margem por gerência na Venda Express'
      });
      setIsApproved(true);
      setBudgetStatus('APROVADO');
      setApproverName(res.data.approver_name || 'Gerência');
      setShowConfirmApprovalModal(false);
      setIsAuthModalOpen(false);
      setSuccessMsg(res.data.message || 'Venda autorizada com sucesso pela Gerência!');
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadBudgetForEdit(budgetIdParam);
    } catch (err: any) {
      console.error('Erro ao autorizar venda:', err);
      setAuthError(err.response?.data?.detail || 'Erro ao validar credenciais da gerência.');
      setShowConfirmApprovalModal(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleFinalizeSale = async () => {
    if (!budgetIdParam) {
      setError('Salve as alterações da venda antes de finalizar.');
      return;
    }
    if (finalizeStatus === 'GANHO' && isPendingApproval) {
      setError('Esta venda necessita de autorização da Gerência antes de ser finalizada como Ganha.');
      return;
    }
    if (finalizeStatus === 'PERDIDO' && !motivoPerda.trim()) {
      setError('Informe o motivo da perda da venda.');
      return;
    }
    setFinalizing(true);
    try {
      const res = await api.post(`/sales-budgets/express/${budgetIdParam}/finalize`, {
        status: finalizeStatus,
        motivo_perda: finalizeStatus === 'PERDIDO' ? motivoPerda.trim() : undefined
      });
      setBudgetStatus(finalizeStatus);
      setIsFinalizeModalOpen(false);
      setSuccessMsg(res.data.message || `Venda Express finalizada como ${finalizeStatus}!`);
      setTimeout(() => setSuccessMsg(''), 4000);
      await loadBudgetForEdit(budgetIdParam);
    } catch (err: any) {
      console.error('Erro ao finalizar venda express:', err);
      setError(err.response?.data?.detail || 'Erro ao finalizar a venda express.');
    } finally {
      setFinalizing(false);
    }
  };

  const availableKitsForGrouping: ProposalKitInfo[] = useMemo(() => {
    return items.map((item, idx) => ({
      id: item.opportunity_kit_id || `item_${idx}`,
      nome: item.nome_kit || `Kit ${idx + 1}`,
      tipo: isRecorrencia(item.tipo_contrato) ? 'LOCACAO' : 'VENDA',
      valorMensal: isRecorrencia(item.tipo_contrato) ? item.valor_total_final : undefined,
      valorTotal: !isRecorrencia(item.tipo_contrato) ? item.valor_total_final : undefined,
    }));
  }, [items]);

  const handleSaveGroupings = async (updatedGroupings: ProposalKitGroup[]) => {
    setProposalCustomGroupings(updatedGroupings);
    setIsGroupingModalOpen(false);
    if (budgetIdParam) {
      try {
        await api.patch(`/sales-budgets/${budgetIdParam}/header`, {
          proposal_custom_groupings: updatedGroupings,
        });
        setSuccessMsg('Agrupamentos da proposta salvos com sucesso!');
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err: any) {
        console.error('Erro ao sincronizar agrupamentos:', err);
        setError('Erro ao salvar agrupamentos: ' + (err.response?.data?.detail || err.message));
      }
    }
  };

  const handleSaveAndGenerateGroupings = async (updatedGroupings: ProposalKitGroup[]) => {
    setProposalCustomGroupings(updatedGroupings);
    setIsGroupingModalOpen(false);
    if (!budgetIdParam) {
      alert('Salve as alterações da venda antes de emitir a proposta.');
      return;
    }
    if (isPendingApproval) {
      setError('Esta venda possui kits com fator abaixo do limite e necessita de autorização da Gerência por senha antes de emitir a proposta.');
      return;
    }
    try {
      setGeneratingProposal(true);
      await api.patch(`/sales-budgets/${budgetIdParam}/header`, {
        proposal_custom_groupings: updatedGroupings,
      });
      await handleGenerateCommercialProposal();
    } catch (err: any) {
      console.error('Erro ao salvar agrupamentos e gerar proposta:', err);
      alert('Erro ao salvar agrupamentos e gerar proposta: ' + (err.response?.data?.detail || err.message));
    } finally {
      setGeneratingProposal(false);
    }
  };

  const handleGenerateCommercialProposal = async () => {
    const bId = budgetIdParam;
    if (!bId || !activeCompanyId) {
      alert('Salve as alterações da venda antes de emitir a proposta.');
      return;
    }
    if (isPendingApproval) {
      setError('Esta venda possui kits com fator abaixo do limite e necessita de autorização da Gerência por senha antes de emitir a proposta.');
      return;
    }
    setGeneratingProposal(true);
    try {
      const resolveRes = await api.get(`/companies/${activeCompanyId}/document-rules/resolve`, {
        params: {
          tipo_documento: 'PROPOSTA_COMERCIAL',
          sales_team_id: salesTeamId || undefined,
          user_id: vendedorId || user?.id
        }
      });

      const data = resolveRes.data;
      if (!data || !data.document_template_id || data.resolved_by === 'NONE') {
        setNoDocumentRuleModalOpen(true);
        return;
      }

      const renderRes = await api.post(`/document-templates/${data.document_template_id}/render`, {
        oportunidade_id: bId
      });

      const rawHtml = renderRes.data?.html;
      if (!rawHtml) {
        alert('Não foi possível obter o conteúdo da proposta comercial.');
        return;
      }
      const renderedHtml = resolveHtmlMediaUrls(rawHtml);

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <base href="${window.location.origin}/" />
              <title>Proposta Comercial - ${numeroOrcamento || titulo || 'Venda Express'}</title>
              <style>
                @media print {
                  @page {
                    size: A4;
                    margin: 15mm 15mm 15mm 15mm;
                  }
                  html, body {
                    margin: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                  }
                  .no-print, .toolbar {
                    display: none !important;
                  }
                  .doc-viewport {
                    margin: 0 !important;
                    padding: 0 !important;
                    display: block !important;
                    background: transparent !important;
                  }
                  .a4-sheet {
                    box-shadow: none !important;
                    margin: 0 !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    min-height: auto !important;
                    border: none !important;
                    border-radius: 0 !important;
                    padding: 0 !important;
                    background: #ffffff !important;
                  }
                }
                body {
                  font-family: system-ui, -apple-system, sans-serif;
                  margin: 0;
                  padding: 0;
                  background: #cbd5e1;
                  color: #0f172a;
                }
                .toolbar {
                  position: fixed; top: 0; left: 0; right: 0; height: 54px;
                  background: #0f172a; color: white; display: flex; align-items: center;
                  justify-content: space-between; padding: 0 24px; z-index: 9999;
                  box-shadow: 0 4px 12px rgba(0,0,0,0.2); font-family: system-ui, sans-serif;
                }
                .toolbar span { font-weight: 600; font-size: 14px; }
                .toolbar button {
                  background: #4f46e5; color: white; border: none; padding: 8px 20px;
                  border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px;
                  transition: all 0.2s;
                }
                .toolbar button:hover { background: #4338ca; }
                .doc-viewport {
                  margin-top: 74px;
                  margin-bottom: 50px;
                  display: flex;
                  justify-content: center;
                  padding: 0 20px;
                }
                .a4-sheet {
                  width: 210mm;
                  min-height: 297mm;
                  height: auto;
                  background: #ffffff;
                  box-shadow: 0 10px 30px -5px rgba(0,0,0,0.2);
                  border-radius: 4px;
                  box-sizing: border-box;
                  position: relative;
                  display: block;
                  padding: 20mm 15mm;
                }
              </style>
            </head>
            <body>
              <div class="toolbar no-print">
                <span>Proposta Comercial (${numeroOrcamento || 'Venda Express'}) — Modelo: ${data.template_nome || 'Padrão'}</span>
                <button onclick="window.print()">Imprimir / Salvar PDF</button>
              </div>
              <div class="doc-viewport">
                <div class="a4-sheet">
                  ${renderedHtml}
                </div>
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
      }
    } catch (err: any) {
      console.error('Erro ao gerar proposta comercial:', err);
      const msg = err.response?.data?.detail || err.message || 'Erro ao comunicar com o servidor.';
      alert(`Falha ao gerar proposta comercial: ${msg}`);
    } finally {
      setGeneratingProposal(false);
    }
  };

  // Items mapped with original index
  const itemsWithIndex = items.map((item, originalIndex) => ({ ...item, originalIndex }));
  const vendaItems = itemsWithIndex.filter(i => !isRecorrencia(i.tipo_contrato));
  const recorrenciaItems = itemsWithIndex.filter(i => isRecorrencia(i.tipo_contrato));

  const currentTabItems = activeKitTab === 'VENDA' ? vendaItems : recorrenciaItems;

  const totalVenda = vendaItems.reduce((acc, curr) => acc + curr.valor_total_final, 0);
  const totalRecorrencia = recorrenciaItems.reduce((acc, curr) => acc + curr.valor_total_final, 0);
  const totalDespesasVenda = items.reduce((acc, curr) => acc + (curr.valor_despesas_venda ?? curr.valor_comissao_estimada), 0);
  const totalQtdVenda = vendaItems.reduce((acc, curr) => acc + curr.quantidade, 0);
  const totalQtdRecorrencia = recorrenciaItems.reduce((acc, curr) => acc + curr.quantidade, 0);
  const hasPendingApproval = items.some(i => i.requer_aprovacao);

  const selectedTeam = salesTeams.find(t => t.id === salesTeamId);

  const filteredVendedores: { id: string; name: string }[] = useMemo(() => {
    if (!salesTeamId || !salesTeams.length) return allUsers;
    const currentTeam = salesTeams.find(t => t.id === salesTeamId);
    if (!currentTeam || !currentTeam.members || currentTeam.members.length === 0) {
      return allUsers;
    }
    const memberIds = new Set(currentTeam.members.map((m: any) => String(m.user_id)));
    const list = allUsers.filter(u => memberIds.has(String(u.id)));
    return list.length > 0 ? list : allUsers;
  }, [salesTeamId, salesTeams, allUsers]);

  useEffect(() => {
    if (filteredVendedores.length > 0) {
      const isCurrentValid = filteredVendedores.some((v: { id: string; name: string }) => String(v.id) === String(vendedorId));
      if (!isCurrentValid) {
        const userInFiltered = filteredVendedores.find((v: { id: string; name: string }) => String(v.id) === String(user?.id));
        setVendedorId(userInFiltered ? userInFiltered.id : filteredVendedores[0].id);
      }
    }
  }, [filteredVendedores, vendedorId, user?.id]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-text-muted flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-brand-primary" />
        <p className="font-medium">Carregando Venda Express...</p>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 bg-bg-card border border-amber-500/20 rounded-2xl shadow-xl text-center space-y-4">
        <div className="w-14 h-14 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-text-primary">Acesso Restrito à Venda Express</h2>
        <p className="text-sm text-text-muted">
          Apenas colaboradores vinculados a uma <strong>Equipe de Vendas habilitada para Venda Express</strong> possuem permissão para acessar esta tela.
        </p>
        <p className="text-xs text-text-muted bg-bg-subtle/50 p-3 rounded-lg border border-border-subtle">
          Solicite ao administrador da empresa para vincular seu usuário a uma equipe com a opção <strong>"Habilitar para Venda Express"</strong> em <em>Cadastros &gt; Empresas &gt; Equipes de Venda</em>.
        </p>
        <div className="pt-2">
          <Button onClick={() => navigate('/comercial/vendas-express')} className="bg-brand-primary text-white font-bold px-6 py-2.5 rounded-xl">
            Voltar para Vendas Express
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 space-y-6 pb-20 animate-fadeIn">
      {/* Top Breadcrumb & Title Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/comercial/vendas-express')}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-subtle rounded-lg transition-colors"
            title="Voltar para Vendas Express"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                <Zap className="w-3.5 h-3.5" />
                Venda Express / Varejo
              </span>
              {numeroOrcamento && (
                <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-bg-surface border border-border-subtle text-text-primary">
                  {numeroOrcamento} (v{budgetVersion})
                </span>
              )}
              {/* Status Badge */}
              {budgetStatus === 'GANHO' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  VENDA GANHA
                </span>
              )}
              {budgetStatus === 'PERDIDO' && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">
                  <XCircle className="w-3.5 h-3.5" />
                  VENDA PERDIDA
                </span>
              )}
              {isApproved && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 border border-blue-500/20" title={`Aprovado por ${approverName || 'Gerência'}`}>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  APROVADO PELA GERÊNCIA {approverName ? `(${approverName})` : ''}
                </span>
              )}
              {isPendingApproval && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30 animate-pulse">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  REQUER AUTORIZAÇÃO DA GERÊNCIA
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-text-primary mt-1">
              {budgetIdParam ? `Editar Venda Express: ${numeroOrcamento || titulo}` : 'Novo Lançamento de Venda Express'}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Botão de Autorizar Venda (Gerência por Senha) */}
          {isPendingApproval && (
            <button
              type="button"
              onClick={handleOpenAuthModal}
              className="flex items-center gap-2 px-3.5 py-2 text-sm font-bold text-white bg-amber-600 hover:bg-amber-700 border border-amber-600 rounded-lg shadow-sm transition-all"
              title="Autorizar Venda por Senha da Gerência"
            >
              <KeyRound className="w-4 h-4" />
              <span>Autorizar Venda</span>
            </button>
          )}

          {budgetIdParam && (
            <>
              {/* Junção dos Kits */}
              <button
                type="button"
                onClick={() => setIsGroupingModalOpen(true)}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-text-primary bg-bg-card hover:bg-bg-subtle border border-border-subtle rounded-lg shadow-sm transition-all"
                title="Agrupar e juntar kits para a proposta comercial"
              >
                <Layers className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Junção dos Kits</span>
                {proposalCustomGroupings.length > 0 && (
                  <span className="bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold px-2 py-0.5 rounded-full">
                    {proposalCustomGroupings.length}
                  </span>
                )}
              </button>

              {/* Imprimir Proposta */}
              <button
                type="button"
                onClick={handleGenerateCommercialProposal}
                disabled={generatingProposal || isPendingApproval}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-medium border rounded-lg shadow-sm transition-all ${
                  isPendingApproval
                    ? 'opacity-60 cursor-not-allowed bg-bg-surface text-text-muted border-border-subtle'
                    : 'text-text-primary bg-bg-card hover:bg-bg-subtle border-border-subtle'
                }`}
                title={
                  isPendingApproval
                    ? 'Proposta bloqueada: Requer autorização da gerência por senha.'
                    : 'Imprimir Proposta Comercial'
                }
              >
                {generatingProposal ? (
                  <Loader2 className="w-4 h-4 animate-spin text-brand-primary" />
                ) : isPendingApproval ? (
                  <Lock className="w-4 h-4 text-amber-500" />
                ) : (
                  <Printer className="w-4 h-4 text-brand-primary" />
                )}
                <span>Imprimir Proposta</span>
              </button>

              {/* Histórico & Auditoria */}
              <button
                type="button"
                onClick={loadAuditHistory}
                disabled={loadingHistory}
                className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-text-primary bg-bg-card hover:bg-bg-subtle border border-border-subtle rounded-lg shadow-sm transition-all"
              >
                <History className="w-4 h-4 text-brand-primary" />
                <span>Histórico & Auditoria</span>
              </button>

              {/* Finalizar Venda Express */}
              <button
                type="button"
                onClick={() => {
                  setFinalizeStatus('GANHO');
                  setMotivoPerda('');
                  setIsFinalizeModalOpen(true);
                }}
                disabled={isPendingApproval || budgetStatus === 'GANHO' || budgetStatus === 'PERDIDO'}
                className={`flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-lg shadow-sm transition-all ${
                  isPendingApproval || budgetStatus === 'GANHO' || budgetStatus === 'PERDIDO'
                    ? 'opacity-50 cursor-not-allowed bg-bg-surface text-text-muted border border-border-subtle'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                }`}
                title={
                  isPendingApproval
                    ? 'Venda requer autorização da gerência antes de ser finalizada'
                    : budgetStatus === 'GANHO' || budgetStatus === 'PERDIDO'
                    ? `Venda já finalizada (${budgetStatus})`
                    : 'Finalizar Venda Express (Ganha ou Perdida)'
                }
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finalizar Venda Express</span>
              </button>
            </>
          )}

          {!isFinalized && (
            <Button
              onClick={handleSaveExpressSale}
              disabled={saving}
              className="flex items-center gap-2 bg-brand-primary hover:bg-brand-primary/90 text-white shadow-md font-semibold px-5 py-2.5 rounded-lg"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {budgetIdParam ? 'Salvar alterações de venda' : 'Salvar Venda Express'}
            </Button>
          )}
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger rounded-xl text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 rounded-xl text-sm font-medium flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Banner de Venda Finalizada (Somente Leitura) */}
      {isFinalized && (
        <div className={`p-4 border-2 rounded-2xl flex items-center gap-3.5 ${
          budgetStatus === 'GANHO'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
        }`}>
          <div className={`p-2.5 text-white rounded-xl shadow-md shrink-0 ${
            budgetStatus === 'GANHO' ? 'bg-emerald-600' : 'bg-rose-600'
          }`}>
            {budgetStatus === 'GANHO' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-base">
              Venda Express Finalizada ({budgetStatus === 'GANHO' ? 'Venda Ganha' : 'Venda Perdida'}) — Modo Somente Leitura
            </h3>
            <p className="text-sm opacity-90 mt-0.5">
              Esta venda foi finalizada como <strong>{budgetStatus === 'GANHO' ? 'GANHO' : 'PERDIDO'}</strong>. Os kits, preços e configurações estão bloqueados contra alterações, permanecendo disponíveis para emissão de proposta comercial e histórico de auditoria.
            </p>
          </div>
        </div>
      )}

      {/* Banner de Bloqueio por Fator abaixo do Limite */}
      {isPendingApproval && (
        <div className="p-4 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-amber-500 text-white rounded-xl shadow-md shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-amber-800 dark:text-amber-300 text-base flex items-center gap-2">
                Autorização da Gerência Necessária
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                Um ou mais kits selecionados possuem fator abaixo da margem mínima permitida para o vendedor.
                A emissão de propostas comerciais e a finalização da venda estão bloqueadas até a aprovação por senha de um Gerente ou Administrador.
              </p>
            </div>
          </div>
          <Button
            onClick={handleOpenAuthModal}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl shadow-md flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <KeyRound className="w-4 h-4" />
            Autorizar Venda (Gerente/Admin)
          </Button>
        </div>
      )}

      {/* 1. Header Card: Cliente, Equipe, Vendedor */}
      <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-base font-bold text-text-primary flex items-center gap-2 border-b border-border-subtle pb-3">
          <Building2 className="w-4 h-4 text-brand-primary" />
          Identificação da Venda & Equipe
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Customer Selection */}
          <div className="space-y-1.5 relative">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold text-text-primary">Cliente *</label>
              {!isFinalized && (
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(true)}
                  className="text-xs font-semibold text-brand-primary hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Cliente
                </button>
              )}
            </div>
            <Input
              type="text"
              placeholder={isFinalized ? '' : 'Digite razão social ou CNPJ...'}
              value={customerSearch}
              disabled={isFinalized}
              onChange={(e) => searchCustomers(e.target.value)}
              className="w-full text-sm"
            />
            {customersList.length > 0 && !isFinalized && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-bg-surface border border-border-subtle rounded-xl shadow-xl z-50 max-h-56 overflow-y-auto">
                {customersList.map(c => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setCustomerId(c.id);
                      setCustomerSearch(c.razao_social || c.nome_fantasia || '');
                      setCustomersList([]);
                    }}
                    className="p-3 hover:bg-bg-subtle cursor-pointer border-b border-border-subtle last:border-0 text-sm"
                  >
                    <p className="font-semibold text-text-primary">{c.razao_social}</p>
                    <p className="text-xs text-text-muted">{c.cnpj || c.nome_fantasia}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Sales Team Fixed / Locked */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-text-primary flex items-center justify-between">
              <span>Equipe de Vendas</span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 flex items-center gap-1">
                <Zap className="w-3 h-3 text-amber-500" /> Venda Express
              </span>
            </label>
            <div className="w-full px-3.5 py-2.5 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm font-semibold flex items-center justify-between h-10 shadow-inner">
              <span className="truncate">{selectedTeam ? selectedTeam.nome : 'Equipe Venda Express'}</span>
              {selectedTeam?.nomenclatura_orcamento && (
                <span className="text-xs font-mono text-text-muted shrink-0">
                  {selectedTeam.nomenclatura_orcamento}
                </span>
              )}
            </div>
          </div>

          {/* Vendedor */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-text-primary">Consultor / Vendedor</label>
            <select
              value={vendedorId}
              disabled={isFinalized}
              onChange={(e) => setVendedorId(e.target.value)}
              className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {filteredVendedores.map(v => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Items & Kits Grid with Distinct Tabs */}
      <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-6">
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-border-subtle pb-4">
          <div>
            <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
              <Package className="w-4 h-4 text-brand-primary" />
              Lançamento de Kits & Precificação
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              Alterne entre as abas para lançar <strong>Kits de Venda</strong> e <strong>Recorrência Mensal (Locação/Comodato)</strong> com cálculo automático.
            </p>
          </div>

          {!isFinalized && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                onClick={() => handleOpenKitModal(activeKitTab)}
                variant="outline"
                className="flex items-center gap-2 text-sm border-border-subtle text-text-primary hover:bg-bg-subtle font-semibold"
              >
                <Search className="w-4 h-4 text-brand-primary" />
                Selecionar Kit Pronto
              </Button>
              <Button
                type="button"
                onClick={() => handleOpenCreateKitModal(activeKitTab)}
                variant="primary"
                className="flex items-center gap-2 text-sm bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                {activeKitTab === 'VENDA' ? 'Criar Kit de Venda' : 'Criar Kit de Recorrência'}
              </Button>
            </div>
          )}
        </div>

        {/* Tab Buttons Navigation */}
        <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
          <button
            type="button"
            onClick={() => setActiveKitTab('VENDA')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeKitTab === 'VENDA'
                ? 'bg-brand-primary/10 text-brand-primary border border-brand-primary/20 shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-subtle/50'
            }`}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Kits de Venda</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeKitTab === 'VENDA' 
                ? 'bg-brand-primary text-white' 
                : 'bg-bg-deep text-text-muted border border-border-subtle'
            }`}>
              {vendaItems.length}
            </span>
            {totalVenda > 0 && (
              <span className="text-xs font-mono font-semibold ml-1">
                ({formatCurrency(totalVenda)})
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveKitTab('RECORRENCIA')}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeKitTab === 'RECORRENCIA'
                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shadow-sm'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-subtle/50'
            }`}
          >
            <Repeat className="w-4 h-4" />
            <span>Recorrência Mensal</span>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              activeKitTab === 'RECORRENCIA' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-bg-deep text-text-muted border border-border-subtle'
            }`}>
              {recorrenciaItems.length}
            </span>
            {totalRecorrencia > 0 && (
              <span className="text-xs font-mono font-semibold ml-1">
                ({formatCurrency(totalRecorrencia)}/mês)
              </span>
            )}
          </button>
        </div>

        {/* Tab Content */}
        {currentTabItems.length === 0 ? (
          <div className="border border-dashed border-border-subtle rounded-xl p-10 text-center text-text-muted space-y-3">
            {activeKitTab === 'VENDA' ? (
              <>
                <ShoppingCart className="w-12 h-12 mx-auto text-text-muted/40" />
                <p className="font-semibold text-text-primary">Nenhum kit de venda adicionado.</p>
                <p className="text-sm">Selecione um kit pronto do catálogo ou crie um kit exclusivo para esta venda.</p>
                {!isFinalized && (
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={() => handleOpenKitModal('VENDA')}
                      variant="outline"
                      className="text-xs border-border-subtle text-text-primary font-semibold"
                    >
                      <Search className="w-3.5 h-3.5 mr-1.5 text-brand-primary" />
                      Selecionar Kit Pronto
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleOpenCreateKitModal('VENDA')}
                      variant="primary"
                      className="text-xs bg-brand-primary text-white font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Criar Kit de Venda
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <>
                <Repeat className="w-12 h-12 mx-auto text-text-muted/40" />
                <p className="font-semibold text-text-primary">Nenhum kit de recorrência mensal adicionado.</p>
                <p className="text-sm">Selecione um kit pronto de locação/comodato ou crie um kit exclusivo para esta venda.</p>
                {!isFinalized && (
                  <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                    <Button
                      type="button"
                      onClick={() => handleOpenKitModal('RECORRENCIA')}
                      variant="outline"
                      className="text-xs border-border-subtle text-text-primary font-semibold"
                    >
                      <Search className="w-3.5 h-3.5 mr-1.5 text-brand-primary" />
                      Selecionar Kit Pronto
                    </Button>
                    <Button
                      type="button"
                      onClick={() => handleOpenCreateKitModal('RECORRENCIA')}
                      variant="primary"
                      className="text-xs bg-brand-primary text-white font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Criar Kit de Recorrência
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {currentTabItems.map((item) => {
              const origIdx = item.originalIndex;
              const isRec = isRecorrencia(item.tipo_contrato);

              return (
                <div 
                  key={`${item.opportunity_kit_id}_${origIdx}`}
                  className={`p-5 rounded-xl border transition-all ${
                    item.requer_aprovacao 
                      ? 'border-amber-500/40 bg-amber-500/5' 
                      : 'border-border-subtle bg-bg-surface hover:border-brand-primary/40'
                  }`}
                >
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                    {/* 1. Kit Title & Base List Price */}
                    <div className="lg:col-span-4 space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-text-primary truncate" title={item.nome_kit}>
                          {item.nome_kit}
                        </h4>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-text-muted">
                        <span>{isRec ? 'Mensalidade Tabela' : 'Preço Tabela'}: <strong className="text-text-primary font-semibold">{formatCurrency(item.valor_unitario_base)}</strong></span>
                      </div>
                    </div>

                    {/* 2. Pricing Inputs: Qtd, Valor Final, Desconto %, Acrescimo % */}
                    <div className="lg:col-span-5 grid grid-cols-4 gap-2.5 items-end">
                      <div>
                        <label className="block text-[11px] font-bold text-text-muted uppercase mb-1 text-center truncate">Qtd</label>
                        <NumericValueInput
                          value={item.quantidade}
                          decimals={0}
                          min={1}
                          disabled={isFinalized}
                          placeholder="1"
                          onChange={(val) => recalculateItemPricing(origIdx, { quantidade: Math.max(1, Math.round(val)) })}
                          className="w-full text-center font-bold text-sm"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-text-muted uppercase mb-1 text-center truncate">
                          {isRec ? 'Valor Mensal' : 'Valor Final'}
                        </label>
                        <NumericValueInput
                          value={item.valor_unitario_final}
                          decimals={2}
                          min={0}
                          disabled={isFinalized}
                          placeholder="0.00"
                          onChange={(val) => recalculateItemPricing(origIdx, { valor_final: val })}
                          className="w-full text-center font-bold text-sm text-text-primary"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-emerald-600 uppercase mb-1 text-center truncate">
                          Desconto (%)
                        </label>
                        <NumericValueInput
                          value={item.desconto_percentual}
                          decimals={1}
                          min={0}
                          max={100}
                          disabled={isFinalized}
                          placeholder="0.0"
                          onChange={(val) => recalculateItemPricing(origIdx, { desconto_percentual: val, acrescimo_percentual: 0 })}
                          className="w-full text-center font-bold text-sm text-emerald-600 border-emerald-500/30"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-blue-600 uppercase mb-1 text-center truncate">
                          Acréscimo (%)
                        </label>
                        <NumericValueInput
                          value={item.acrescimo_percentual}
                          decimals={1}
                          min={0}
                          disabled={isFinalized}
                          placeholder="0.0"
                          onChange={(val) => recalculateItemPricing(origIdx, { acrescimo_percentual: val, desconto_percentual: 0 })}
                          className="w-full text-center font-bold text-sm text-blue-600 border-blue-500/30"
                        />
                      </div>
                    </div>

                    {/* 3. Financial Results, Despesas & Actions */}
                    <div className="lg:col-span-3 flex items-center justify-between lg:justify-end gap-3 min-w-0 pt-3 lg:pt-0 border-t lg:border-0 border-border-subtle">
                      <div className="space-y-1 text-right min-w-0">
                        <div className="flex items-center gap-1.5 justify-end flex-wrap">
                          {item.nome_politica && (
                            <span className="text-[10px] text-text-muted italic truncate max-w-[120px]" title={`Política: ${item.nome_politica}`}>
                              {item.nome_politica}
                            </span>
                          )}

                          <span className="text-xs font-mono bg-brand-primary/10 text-brand-primary px-2 py-0.5 rounded font-bold whitespace-nowrap">
                            Fator: {Number(item.fator_efetivo || 1).toFixed(4)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 justify-end">
                          {(() => {
                            const vComBruta = Number(item.valor_comissao_bruta ?? item.valor_comissao_estimada ?? 0);
                            const pComBruta = Number(item.comissao_bruta_percentual ?? item.comissao_percentual ?? 0);
                            const vDsr = Number(item.valor_dsr ?? 0);
                            const vFgts = Number(item.valor_fgts ?? 0);
                            const vInss = Number(item.valor_inss ?? 0);
                            const vDemais = Number(item.valor_demais ?? 0);
                            const vComLiq = Number(item.valor_comissao_liquida ?? (vComBruta - vDsr - vFgts - vInss - vDemais));
                            const vDespOp = Number(item.valor_despesa_operacional ?? 0);
                            const pDespOp = Number(item.despesa_operacional_percentual ?? 0);
                            const vDespVenda = Number(item.valor_despesas_venda ?? (vComLiq + vDespOp));
                            const pDespVenda = Number(item.despesas_venda_percentual ?? (item.valor_total_final ? (vDespVenda / item.valor_total_final) * 100 : 0));

                            return (
                              <Tooltip
                                variant="light"
                                content={
                                  <div className="p-2 space-y-1 text-xs font-mono min-w-[270px] text-text-secondary">
                                    {/* Top: Comissão Bruta */}
                                    <div className="flex justify-between items-center text-text-muted">
                                      <span>Comissão Bruta <span className="text-[11px] font-normal">({pComBruta.toFixed(2)}%)</span></span>
                                      <span className="font-semibold text-text-primary">{formatCurrency(vComBruta)}</span>
                                    </div>

                                    {/* Middle: Inner Box with Deductions and Net Commission */}
                                    <div className="bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/20 rounded-lg p-2.5 my-1.5 space-y-1 text-[11px]">
                                      <div className="flex justify-between items-center text-text-muted">
                                        <span>(-) DSR:</span>
                                        <span className="text-text-muted font-medium font-mono">{formatCurrency(vDsr)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-text-muted">
                                        <span>(-) FGTS:</span>
                                        <span className="text-text-muted font-medium font-mono">{formatCurrency(vFgts)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-text-muted">
                                        <span>(-) INSS:</span>
                                        <span className="text-text-muted font-medium font-mono">{formatCurrency(vInss)}</span>
                                      </div>
                                      <div className="flex justify-between items-center text-text-muted">
                                        <span>(-) Outros:</span>
                                        <span className="text-text-muted font-medium font-mono">{formatCurrency(vDemais)}</span>
                                      </div>
                                      <div className="border-t border-amber-500/30 pt-1.5 mt-1 flex justify-between items-center font-bold text-emerald-600 dark:text-emerald-400">
                                        <span>Comissão Líquida:</span>
                                        <span className="font-mono">{formatCurrency(vComLiq)}</span>
                                      </div>
                                    </div>

                                    {/* Bottom: Despesa Operacional */}
                                    <div className="flex justify-between items-center text-text-muted pt-0.5">
                                      <span>Desp. Operacional <span className="text-[11px] font-normal">({pDespOp.toFixed(2)}%)</span></span>
                                      <span className="font-semibold text-text-primary">{formatCurrency(vDespOp)}</span>
                                    </div>
                                  </div>
                                }
                              >
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-0.5 rounded cursor-help border border-indigo-500/20 transition-colors whitespace-nowrap">
                                  Desp. de Venda: {formatCurrency(vDespVenda)} ({pDespVenda.toFixed(2)}%)
                                </span>
                              </Tooltip>
                            );
                          })()}
                        </div>

                        <div className="text-xs text-text-muted flex items-center gap-2 justify-end">
                          <span>Total: <strong className="text-text-primary text-sm font-bold">{formatCurrency(item.valor_total_final)}{isRec ? '/mês' : ''}</strong></span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setKitToEdit({ id: item.opportunity_kit_id, nome: item.nome_kit })}
                          className="p-2 text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-colors cursor-pointer"
                          title={isFinalized ? "Visualizar composição do kit" : "Visualizar / Editar composição do kit"}
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {!isFinalized && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(origIdx)}
                            className="p-2 text-brand-danger hover:bg-brand-danger/10 rounded-lg transition-colors cursor-pointer"
                            title="Remover kit"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Approval Warning or Approved Notice */}
                  {item.requer_aprovacao && (
                    isApproved ? (
                      <div className="mt-3 pt-3 border-t border-emerald-500/20 flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        <span>Fator com margem especial — Aprovado pela Gerência {approverName ? `(${approverName})` : ''}</span>
                      </div>
                    ) : !isFinalized ? (
                      <div className="mt-3 pt-3 border-t border-amber-500/20 flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                        <span>{item.motivo_aprovacao || 'Fator abaixo do limite mínimo. Esta venda exigirá aprovação da gerência comercial.'}</span>
                      </div>
                    ) : null
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Payment Method & Summary Footer */}
      <div className="bg-bg-card border border-border-subtle rounded-2xl p-6 shadow-sm space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Payment Method & Notes */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-brand-primary" />
                Forma de Pagamento
              </label>
              <select
                value={formaPagamentoId}
                disabled={isFinalized}
                onChange={(e) => setFormaPagamentoId(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-bg-surface text-text-primary text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">Selecione a forma de pagamento...</option>
                {paymentMethods.map(p => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1.5">
                Observações do Pedido / Proposta
              </label>
              <textarea
                rows={3}
                value={observacoes}
                disabled={isFinalized}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Condições especiais, entrega, observações de faturamento..."
                className="w-full px-3.5 py-2.5 border border-border rounded-lg bg-bg-surface text-text-primary text-sm focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none resize-none disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Financial Summary Card */}
          <div className="p-6 rounded-2xl bg-bg-surface border border-border-subtle space-y-4">
            <h3 className="text-sm font-bold text-text-muted uppercase tracking-wider">
              Resumo Financeiro da Venda
            </h3>

            <div className="space-y-2.5 text-sm border-b border-border-subtle pb-4">
              <div className="flex justify-between text-text-muted">
                <span>Subtotal Venda (Kits):</span>
                <span className="font-semibold text-text-primary">{formatCurrency(totalVenda)}</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Subtotal Recorrência Mensal:</span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-400">{formatCurrency(totalRecorrencia)}/mês</span>
              </div>
              <div className="flex justify-between text-text-muted">
                <span>Quantidade Total de Kits:</span>
                <span className="font-semibold text-text-primary">{totalQtdVenda} Venda | {totalQtdRecorrencia} Recorrência</span>
              </div>
              <div className="flex justify-between items-center text-text-muted">
                <span>Desp. de Venda Total:</span>
                <Tooltip
                  variant="light"
                  content={
                    <div className="p-2 space-y-1.5 text-xs font-mono min-w-[280px]">
                      <p className="font-bold text-[11px] uppercase tracking-wider text-text-muted border-b border-border-subtle pb-1 mb-1">
                        Despesas de Venda por Kit
                      </p>
                      {items.map((it, i) => {
                        const vComBruta = Number(it.valor_comissao_bruta ?? it.valor_comissao_estimada ?? 0);
                        const vDsr = Number(it.valor_dsr ?? 0);
                        const vFgts = Number(it.valor_fgts ?? 0);
                        const vInss = Number(it.valor_inss ?? 0);
                        const vDemais = Number(it.valor_demais ?? 0);
                        const vComLiq = Number(it.valor_comissao_liquida ?? (vComBruta - vDsr - vFgts - vInss - vDemais));
                        const vDespOp = Number(it.valor_despesa_operacional ?? 0);
                        const vDesp = Number(it.valor_despesas_venda ?? (vComLiq + vDespOp));
                        return (
                          <div key={i} className="flex justify-between items-center text-text-secondary gap-3 py-0.5">
                            <span className="truncate max-w-[200px] text-text-muted">{it.nome_kit || `Kit ${i + 1}`}</span>
                            <span className="font-bold text-text-primary shrink-0">{formatCurrency(vDesp)}</span>
                          </div>
                        );
                      })}
                      <div className="border-t border-border-subtle pt-1 mt-1 flex justify-between items-center font-bold text-indigo-600 dark:text-indigo-400">
                        <span>Total Geral:</span>
                        <span>{formatCurrency(totalDespesasVenda)}</span>
                      </div>
                    </div>
                  }
                >
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 cursor-help border-b border-dashed border-indigo-400">
                    {formatCurrency(totalDespesasVenda)}
                  </span>
                </Tooltip>
              </div>
              <div className="flex justify-between items-center font-semibold text-xs pt-1">
                <span className="text-text-secondary">Alçada Comercial:</span>
                {isApproved ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Aprovado pela Gerência {approverName ? `(${approverName})` : ''}
                  </span>
                ) : hasPendingApproval ? (
                  <span className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Requer Aprovação
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Dentro da Alçada
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-1">
              <div className="space-y-1">
                {totalVenda > 0 && (
                  <div>
                    <p className="text-[11px] text-text-muted uppercase font-bold">Total Venda</p>
                    <p className="text-xl font-extrabold text-brand-primary">{formatCurrency(totalVenda)}</p>
                  </div>
                )}
                {totalRecorrencia > 0 && (
                  <div>
                    <p className="text-[11px] text-text-muted uppercase font-bold">Recorrência Mensal</p>
                    <p className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400">{formatCurrency(totalRecorrencia)}<span className="text-xs text-text-muted font-normal">/mês</span></p>
                  </div>
                )}
                {totalVenda === 0 && totalRecorrencia === 0 && (
                  <div>
                    <p className="text-xs text-text-muted uppercase font-bold">Valor Total da Proposta</p>
                    <p className="text-2xl font-extrabold text-brand-primary">R$ 0,00</p>
                  </div>
                )}
              </div>

              <Button
                onClick={handleSaveExpressSale}
                disabled={saving || items.length === 0}
                className="bg-brand-primary hover:bg-brand-primary/90 text-white font-bold px-6 py-3 rounded-xl shadow-lg hover:shadow-brand-primary/20 transition-all text-sm"
              >
                {saving ? 'Gravando...' : 'Finalizar Venda Express'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <OpportunityKitSearchModal
        isOpen={kitModalConfig.isOpen}
        onClose={() => setKitModalConfig(prev => ({ ...prev, isOpen: false }))}
        onSelect={handleAddKitFromModal}
        onCreateNew={() => handleOpenCreateKitModal(activeKitTab)}
        title={kitModalConfig.title}
        allowedTypes={kitModalConfig.allowedTypes}
        salesTeamId={salesTeamId}
      />

      {/* Create New Kit Modal */}
      {showCreateKitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-deep rounded-2xl shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-bg-surface flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-text-primary flex items-center gap-2">
                <Plus className="w-5 h-5 text-brand-primary" />
                Criar Kit Específico para a Venda Express
              </h3>
              <button 
                onClick={() => setShowCreateKitModal(false)} 
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-text-muted hover:text-text-primary"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-bg-deep">
              <OpportunityKitForm
                isModal={true}
                initialSalesBudgetId={budgetIdParam}
                initialSalesTeamId={salesTeamId}
                initialSalesTeamNome={selectedTeam?.nome}
                initialTipoContrato={createKitTipoContrato}
                onClose={() => setShowCreateKitModal(false)}
                onSuccess={(savedKit) => {
                  setShowCreateKitModal(false);
                  if (savedKit) {
                    handleAddKitFromModal(savedKit);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modal de Junção / Agrupamento Customizado de Kits para a Proposta */}
      <ProposalGroupingModal
        isOpen={isGroupingModalOpen}
        onClose={() => setIsGroupingModalOpen(false)}
        availableKits={availableKitsForGrouping}
        initialGroupings={proposalCustomGroupings}
        onSave={handleSaveGroupings}
        onSaveAndGenerate={handleSaveAndGenerateGroupings}
      />

      {/* Modal aviso de falta de modelo de documento vinculado */}
      {noDocumentRuleModalOpen && (
        <Modal
          isOpen={noDocumentRuleModalOpen}
          onClose={() => setNoDocumentRuleModalOpen(false)}
          title="Modelo de Documento Ausente"
        >
          <div className="p-6 space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-text-primary text-base">
              Não há modelo de documento vinculado para esta equipe de venda.
            </h4>
            <p className="text-xs text-text-muted">
              Acesse o cadastro da empresa na aba <strong>Documentos</strong> para vincular o modelo de Proposta Comercial a esta equipe de vendas.
            </p>
            <div className="pt-2 flex justify-center">
              <Button
                onClick={() => setNoDocumentRuleModalOpen(false)}
                className="font-bold text-xs"
              >
                Entendido
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Edit Kit Composition Modal (Full Screen Wide identical to Opportunity) */}
      {kitToEdit && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-deep rounded-2xl shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-bg-surface flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-text-primary flex items-center gap-2">
                Editar Kit na Oportunidade
              </h3>
              <button 
                onClick={() => {
                  handleReloadKitAfterEdit(kitToEdit.id);
                  setKitToEdit(null);
                }} 
                className="p-1.5 hover:bg-black/5 dark:hover:bg-white/5 rounded-lg transition-colors text-text-muted hover:text-text-primary"
                title="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-bg-deep">
              <OpportunityKitForm
                isModal={true}
                modalEditKitId={kitToEdit.id}
                initialSalesTeamId={salesTeamId}
                initialSalesTeamNome={selectedTeam?.nome}
                onClose={() => {
                  handleReloadKitAfterEdit(kitToEdit.id);
                  setKitToEdit(null);
                }}
                onSuccess={() => {
                  handleReloadKitAfterEdit(kitToEdit.id);
                  setKitToEdit(null);
                }}
              />
            </div>
          </div>
        </div>
      )}

      <QuickCustomerCreateModal
        isOpen={isCustomerModalOpen}
        onClose={() => setIsCustomerModalOpen(false)}
        onSuccess={(c: any) => {
          setCustomerId(c.id);
          setCustomerSearch(c.razao_social || c.nome_fantasia || '');
          setIsCustomerModalOpen(false);
        }}
      />

      {/* Audit Diff Timeline Drawer / Modal */}
      <Modal
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        title="Histórico de Auditoria & Alterações (Diffs)"
        maxWidth="3xl"
      >
        <div className="space-y-6 max-h-[75vh] overflow-y-auto p-1">
          {historyRecords.length === 0 ? (
            <p className="text-center text-text-muted py-8">Nenhum registro de histórico encontrado.</p>
          ) : (
            historyRecords.map((rec) => (
              <div key={rec.id} className="p-4 rounded-xl border border-border-subtle bg-bg-surface space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-sm text-text-primary flex items-center gap-2">
                    <Clock className="w-4 h-4 text-brand-primary" />
                    Versão {rec.versao} — {rec.usuario_nome}
                  </span>
                  <span className="text-xs text-text-muted font-mono">
                    {new Date(rec.data_movimentacao).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-xs text-text-muted">{rec.descricao}</p>

                {rec.diff_changes?.mudancas_kits && rec.diff_changes.mudancas_kits.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border-subtle">
                    <p className="text-[11px] font-bold text-text-muted uppercase">Alterações nos Kits:</p>
                    <div className="space-y-1.5">
                      {rec.diff_changes.mudancas_kits.map((kdiff: any, kidx: number) => (
                        <div key={kidx} className="p-2 rounded bg-bg-deep/50 border border-border-subtle text-xs space-y-1">
                          <p className="font-semibold text-text-primary">{kdiff.nome_kit}</p>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-text-muted">
                            <div>
                              <span>Valor: </span>
                              <strong>{kdiff.valor_unitario?.de ? formatCurrency(kdiff.valor_unitario.de) : 'Novo'}</strong>
                              <span> ➔ </span>
                              <strong className="text-text-primary">{formatCurrency(kdiff.valor_unitario?.para)}</strong>
                            </div>
                            <div>
                              <span>Fator: </span>
                              <strong>{kdiff.fator?.de ? Number(kdiff.fator.de).toFixed(4) : '-'}</strong>
                              <span> ➔ </span>
                              <strong className="text-text-primary">{Number(kdiff.fator?.para || 1).toFixed(4)}</strong>
                            </div>
                            <div>
                              <span>Comissão: </span>
                              <strong>{kdiff.comissao_percentual?.de ? `${kdiff.comissao_percentual.de}%` : '-'}</strong>
                              <span> ➔ </span>
                              <strong className="text-emerald-600">{kdiff.comissao_percentual?.para}%</strong>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Modal 1: Formulário de Credenciais do Gerente / Admin */}
      <Modal
        isOpen={isAuthModalOpen}
        onClose={() => {
          if (!authLoading) {
            setIsAuthModalOpen(false);
            setManagerPassword('');
          }
        }}
        title="Autorização de Venda Express (Gerência)"
        maxWidth="md"
      >
        <div className="space-y-4 p-1">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2.5">
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
            <div>
              <p className="font-bold text-amber-800 dark:text-amber-300">Margem abaixo do limite do vendedor</p>
              <p className="mt-0.5">
                Para liberar a emissão da proposta e a finalização desta venda, insira o usuário/e-mail e a senha de um Gerente ou Administrador da empresa.
              </p>
            </div>
          </div>

          {authError && (
            <div className="p-3 bg-brand-danger/10 border border-brand-danger/20 text-brand-danger rounded-xl text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                E-mail / Usuário do Gerente/Admin *
              </label>
              <Input
                type="email"
                placeholder="gerente@empresa.com.br"
                value={managerEmail}
                onChange={(e) => setManagerEmail(e.target.value)}
                disabled={authLoading}
                className="w-full text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Senha de Acesso do Gerente/Admin *
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={managerPassword}
                onChange={(e) => setManagerPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleValidateManagerCredentials();
                }}
                disabled={authLoading}
                className="w-full text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              variant="outline"
              onClick={() => {
                setIsAuthModalOpen(false);
                setManagerPassword('');
              }}
              disabled={authLoading}
              className="text-text-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleValidateManagerCredentials}
              disabled={authLoading || !managerEmail.trim() || !managerPassword.trim()}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <KeyRound className="w-4 h-4 mr-2" />}
              Continuar Autorização
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 2: Confirmação da Aprovação pelo Gerente */}
      <Modal
        isOpen={showConfirmApprovalModal}
        onClose={() => {
          if (!authLoading) {
            setShowConfirmApprovalModal(false);
          }
        }}
        title="Confirmar Aprovação da Venda"
        maxWidth="md"
      >
        <div className="space-y-4 p-2 text-center">
          <div className="w-14 h-14 bg-amber-500/15 text-amber-600 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <ShieldCheck className="w-8 h-8" />
          </div>

          <div className="space-y-1.5">
            <h3 className="text-lg font-bold text-text-primary">
              Deseja realmente aprovar a venda?
            </h3>
            <p className="text-sm text-text-muted max-w-sm mx-auto">
              Ao confirmar com suas credenciais de gerência, os fatores com desconto especial serão autorizados, liberando a geração de propostas e a finalização da venda.
            </p>
          </div>

          <div className="p-3 bg-bg-surface border border-border-subtle rounded-xl text-left text-xs space-y-1">
            <p className="text-text-muted">Aprovador identificado: <strong className="text-text-primary">{managerEmail}</strong></p>
            <p className="text-text-muted">Operação: <span className="font-semibold text-amber-600">Aprovação de Margem em Venda Express</span></p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirmApprovalModal(false);
                setManagerPassword('');
              }}
              disabled={authLoading}
              className="w-full font-semibold"
            >
              CANCELAR
            </Button>
            <Button
              onClick={handleConfirmAuthorizeManager}
              disabled={authLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md flex items-center justify-center gap-2"
            >
              {authLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              SIM, APROVAR VENDA
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal 3: Finalizar Venda Express (Ganha / Perdida) */}
      <Modal
        isOpen={isFinalizeModalOpen}
        onClose={() => {
          if (!finalizing) setIsFinalizeModalOpen(false);
        }}
        title="Finalizar Venda Express"
        maxWidth="lg"
      >
        <div className="space-y-5 p-1">
          <p className="text-sm text-text-muted">
            Informe o resultado comercial desta Venda Express para concluir o processo no sistema.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Card GANHO */}
            <div
              onClick={() => setFinalizeStatus('GANHO')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-start gap-2.5 ${
                finalizeStatus === 'GANHO'
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                  : 'border-border-subtle bg-bg-surface hover:border-border-hover'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <input
                  type="radio"
                  name="finalize_status"
                  checked={finalizeStatus === 'GANHO'}
                  onChange={() => setFinalizeStatus('GANHO')}
                  className="accent-emerald-600 w-4 h-4"
                />
              </div>
              <div>
                <h4 className="font-bold text-sm text-text-primary">Venda Ganha</h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Proposta aceita pelo cliente. A venda será marcada como <strong>GANHO</strong> e preparada para faturamento/integração.
                </p>
              </div>
            </div>

            {/* Card PERDIDO */}
            <div
              onClick={() => setFinalizeStatus('PERDIDO')}
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex flex-col items-start gap-2.5 ${
                finalizeStatus === 'PERDIDO'
                  ? 'border-rose-500 bg-rose-500/10 shadow-sm'
                  : 'border-border-subtle bg-bg-surface hover:border-border-hover'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="w-9 h-9 rounded-lg bg-rose-500/20 text-rose-600 flex items-center justify-center">
                  <XCircle className="w-5 h-5" />
                </div>
                <input
                  type="radio"
                  name="finalize_status"
                  checked={finalizeStatus === 'PERDIDO'}
                  onChange={() => setFinalizeStatus('PERDIDO')}
                  className="accent-rose-600 w-4 h-4"
                />
              </div>
              <div>
                <h4 className="font-bold text-sm text-text-primary">Venda Perdida</h4>
                <p className="text-xs text-text-muted mt-0.5">
                  Cliente desistiu ou declinou. A venda será arquivada como <strong>PERDIDO</strong> com o motivo registrado.
                </p>
              </div>
            </div>
          </div>

          {finalizeStatus === 'PERDIDO' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="block text-xs font-semibold text-text-primary">
                Motivo da Perda da Venda *
              </label>
              <textarea
                value={motivoPerda}
                onChange={(e) => setMotivoPerda(e.target.value)}
                placeholder="Descreva detalhadamente o motivo da perda (ex: preço do concorrente, adiamento do projeto, etc)..."
                rows={3}
                className="w-full text-sm p-3 rounded-xl border border-border-subtle bg-bg-surface text-text-primary focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none transition-colors resize-none"
                disabled={finalizing}
              />
            </div>
          )}

          <div className="flex justify-end gap-2.5 pt-3 border-t border-border-subtle">
            <Button
              variant="outline"
              onClick={() => setIsFinalizeModalOpen(false)}
              disabled={finalizing}
              className="text-text-muted"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleFinalizeSale}
              disabled={finalizing || (finalizeStatus === 'PERDIDO' && !motivoPerda.trim())}
              className={`font-bold px-5 ${
                finalizeStatus === 'GANHO'
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-rose-600 hover:bg-rose-700 text-white'
              }`}
            >
              {finalizing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : finalizeStatus === 'GANHO' ? (
                <CheckCircle2 className="w-4 h-4 mr-2" />
              ) : (
                <XCircle className="w-4 h-4 mr-2" />
              )}
              Confirmar {finalizeStatus === 'GANHO' ? 'Venda Ganha' : 'Venda Perdida'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default ExpressSalesForm;
