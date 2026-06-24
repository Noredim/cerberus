import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, Calculator, Plus, Trash2, Info, ChevronUp, ChevronDown, Printer, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tooltip } from '../../components/ui/Tooltip';
import { api } from '../../services/api';
import { ProductSearchModal } from '../../components/modals/ProductSearchModal';
import { AddOperationalCostModal } from '../../components/modals/AddOperationalCostModal';
import Modal from '../../components/modals/Modal';

const Decimal4Input = ({ value, onChange, onBlur, disabled, placeholder = "0.0000", className = "w-full", correctedValue }: any) => {
  const [localStr, setLocalStr] = useState(Number(value || 0).toFixed(4));
  const [isFocused, setIsFocused] = useState(false);

  // Sync from parent (e.g. when form state changes externally)
  useEffect(() => {
    if (!isFocused) {
      setLocalStr(Number(value || 0).toFixed(4));
    }
  }, [value, isFocused]);

  // When correctedValue is pushed in by the parent after policy check, update display
  useEffect(() => {
    if (correctedValue !== undefined && correctedValue !== null) {
      setLocalStr(Number(correctedValue).toFixed(4));
    }
  }, [correctedValue]);

  const handleBlur = () => {
    setIsFocused(false);
    let val = localStr.replace(',', '.');
    let parsed = parseFloat(val);
    if (isNaN(parsed)) parsed = 0;
    // Don't call onChange yet — let the parent's onBlur decide the final value
    if (onBlur) onBlur(parsed);
    else {
      setLocalStr(parsed.toFixed(4));
      onChange(parsed);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(',', '.');
    if (/^[0-9.]*$/.test(val)) {
      const parts = val.split('.');
      if (parts[1] && parts[1].length > 4) return;
      setLocalStr(val);
    }
  };

  return (
    <Input
      type="text"
      value={localStr}
      onChange={handleChange}
      onFocus={() => {
        setIsFocused(true);
        let val = value !== undefined && value !== null && value !== '' ? String(value) : '';
        setLocalStr(val);
      }}
      onBlur={handleBlur}
      disabled={disabled}
      placeholder={placeholder}
      className={className}
    />
  );
};

const CostCompositionTooltip = ({ summary, qty, isST }: { summary: any; qty: number; isST: boolean }) => {
  const fmtC = (val: number | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const ipiPercent = summary?.ipi_percent || 0;

  if (isST) {
    return (
      <div className="w-72 p-1 text-xs text-text-secondary leading-relaxed">
        <div className="flex items-center gap-2 text-text-primary font-bold text-sm mb-3 border-b border-border-subtle/50 pb-2">
          <span className="text-brand-primary">ⓘ</span>
          <span>Formação de custo REVENDA</span>
        </div>
        
        <div className="mb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-1.5">Por unidade</div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Base (Unit.):</span>
              <span className="text-text-primary">{fmtC(summary?.base_fornecedor)}</span>
            </div>
            <div className="flex justify-between">
              <span>IPI ({ipiPercent}%):</span>
              <span className="text-amber-600">+ {fmtC(summary?.ipi_unit)}</span>
            </div>
            <div className="flex justify-between">
              <span>Frete CIF:</span>
              <span className="text-amber-600">+ {fmtC(summary?.frete_cif_unit)}</span>
            </div>
            
            <div className="border-t border-border-subtle/50 my-1"></div>
            
            {summary?.is_bit ? (
              <div className="flex justify-between text-amber-600">
                <span>ICMS-ST (BIT) unit.:</span>
                <span>+ {fmtC(summary?.icms_st_normal)}</span>
              </div>
            ) : (
              <>
                <div className="flex justify-between text-amber-600">
                  <span>ICMS-ST unit.:</span>
                  <span>+ {fmtC(summary?.icms_st_normal)}</span>
                </div>
                {(summary?.cred_outorgado_valor || 0) > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Cred. Outorgado ({(summary?.cred_outorgado_percent || 0).toFixed(0)}%):</span>
                    <span>- {fmtC(summary?.cred_outorgado_valor)}</span>
                  </div>
                )}
              </>
            )}
            
            <div className="flex justify-between font-bold text-amber-600">
              <span>ICMS-ST Final unit.:</span>
              <span>+ {fmtC(summary?.icms_st_unitario)}</span>
            </div>
            
            <div className="border-t border-border-subtle/50 my-1.5"></div>
            
            <div className="flex justify-between font-bold text-text-primary text-sm">
              <span>Custo Unit. Final:</span>
              <span className="text-brand-primary">{fmtC(summary?.custo_unit_final || summary?.custo_base_unitario_item)}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-1.5">Totais (× {qty} Un.)</div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between font-bold text-text-primary">
              <span>Total Cotação:</span>
              <span>{fmtC((summary?.base_fornecedor || 0) * qty)}</span>
            </div>
            <div className="flex justify-between text-amber-600">
              <span>Total Impostos:</span>
              <span>+ {fmtC((summary?.icms_st_unitario || 0) * qty)}</span>
            </div>
            <div className="flex justify-between text-[11px] text-text-muted pl-2">
              <span>↳ ICMS-ST total:</span>
              <span>+ {fmtC((summary?.icms_st_unitario || 0) * qty)}</span>
            </div>
            
            <div className="mt-3 p-2 bg-brand-primary/5 rounded-lg border border-brand-primary/20 flex justify-between items-center font-bold text-sm text-brand-primary">
              <span>Total Geral:</span>
              <span>{fmtC((summary?.custo_unit_final || summary?.custo_base_unitario_item || 0) * qty)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div className="w-72 p-1 text-xs text-text-secondary leading-relaxed">
        <div className="flex items-center gap-2 text-text-primary font-bold text-sm mb-3 border-b border-border-subtle/50 pb-2">
          <span className="text-brand-primary">📋</span>
          <span>Formação de custo COMODATO/LOCAÇÃO</span>
        </div>
        
        <div className="mb-4">
          <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-1.5">Por unidade</div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between">
              <span>Base (Unit.):</span>
              <span className="text-text-primary">{fmtC(summary?.base_fornecedor)}</span>
            </div>
            <div className="flex justify-between">
              <span>IPI ({ipiPercent}%):</span>
              <span className="text-amber-600">+ {fmtC(summary?.ipi_unit)}</span>
            </div>
            <div className="flex justify-between">
              <span>Frete CIF:</span>
              <span className="text-amber-600">+ {fmtC(summary?.frete_cif_unit)}</span>
            </div>
            
            <div className="border-t border-border-subtle/50 my-1"></div>
            
            <div className="flex justify-between font-bold text-amber-600">
              <span>DIFAL Unit:</span>
              <span>+ {fmtC(summary?.difal_unitario)}</span>
            </div>
            
            <div className="border-t border-border-subtle/50 my-1.5"></div>
            
            <div className="flex justify-between font-bold text-text-primary text-sm">
              <span>Custo Unit. Final:</span>
              <span className="text-brand-primary">{fmtC(summary?.custo_unit_final || summary?.custo_base_unitario_item)}</span>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] uppercase font-bold tracking-wider text-text-muted mb-1.5">Totais (× {qty} Un.)</div>
          <div className="space-y-1 font-mono">
            <div className="flex justify-between font-bold text-text-primary">
              <span>Total da Cotação:</span>
              <span>{fmtC((summary?.base_fornecedor || 0) * qty)}</span>
            </div>
            <div className="flex justify-between text-amber-600">
              <span>Frete CIF:</span>
              <span>+ {fmtC((summary?.frete_cif_unit || 0) * qty)}</span>
            </div>
            <div className="text-amber-600 font-bold mt-1">Total Impostos:</div>
            <div className="flex justify-between text-[11px] text-amber-600 pl-2">
              <span>– DIFAL:</span>
              <span>+ {fmtC((summary?.difal_unitario || 0) * qty)}</span>
            </div>
            
            <div className="mt-3 p-2 bg-brand-primary/5 rounded-lg border border-brand-primary/20 flex justify-between items-center font-bold text-sm text-brand-primary">
              <span>Total Geral:</span>
              <span>{fmtC((summary?.custo_unit_final || summary?.custo_base_unitario_item || 0) * qty)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }
};

interface KitFormValues {
  nome_kit: string;
  descricao_kit: string;
  quantidade_kits: number;
  tipo_contrato: string;
  considerar_st_ou_difal: string;
  prazo_contrato_meses: number;
  prazo_instalacao_meses: number;
  fator_margem_locacao: number;
  fator_margem_instalacao: number;
  fator_margem_manutencao: number;
  fator_margem_servicos_produtos: number;
  taxa_juros_mensal: number;
  taxa_manutencao_anual: number;
  instalacao_inclusa: boolean;
  percentual_instalacao: number | '';
  havera_manutencao: boolean;
  qtd_meses_manutencao: number | '';
  manutencao_inclusa: boolean;
  fator_manutencao: number | '';
  aliq_pis: number;
  aliq_cofins: number;
  aliq_csll: number;
  aliq_irpj: number;
  aliq_iss: number;
  aliq_icms: number;
  perc_frete_venda: number;
  perc_despesas_adm: number;
  perc_comissao: number;
  custo_manut_mensal_kit: number;
  custo_suporte_mensal_kit: number;
  custo_seguro_mensal_kit: number;
  custo_logistica_mensal_kit: number;
  custo_software_mensal_kit: number;
  custo_itens_acessorios_mensal_kit: number;
  sales_budget_id?: string;
  items: Array<{
    tipo_item?: string;
    product_id: string | null;
    own_service_id?: string;
    descricao_item: string;
    quantidade_no_kit: number;
    product?: any;
    own_service?: any;
  }>;
  costs: Array<{
    tipo_item?: string;
    own_service_id?: string;
    product_id?: string;
    forma_execucao?: string;
    tipo_custo: string;
    quantidade: number;
    valor_unitario: number;
    descricao_item?: string;
  }>;
  monthly_costs: Array<{
    servico: string;
    tipo_custo: string;
    quantidade: number;
    valor_unitario: number;
  }>;
  faturamento_servico_separado: boolean;
  forma_execucao?: string;
  custo_monitoramento_unitario: number;
  fator_monitoramento: number;
  licitacao_id?: string;
  licitacao_item_id?: string;
  margem_minima_desejada?: number | '';
}

export interface OpportunityKitFormProps {
  isModal?: boolean;
  onClose?: () => void;
  initialSalesBudgetId?: string | null;
  initialTipoContrato?: string;
  onSuccess?: (savedKit?: any) => void;
  modalEditKitId?: string | null;
}

export const OpportunityKitForm = ({ isModal = false, onClose, initialSalesBudgetId, initialTipoContrato = 'LOCACAO', onSuccess, modalEditKitId }: OpportunityKitFormProps = {}) => {
  const { kitId: routeKitId } = useParams();
  const kitId = isModal ? modalEditKitId : routeKitId;
  const { activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceBudgetId = initialSalesBudgetId || searchParams.get('source_budget_id');
  const licitacaoIdParam = searchParams.get('licitacao_id');
  const licitacaoItemIdParam = searchParams.get('licitacao_item_id');

  const [financials, setFinancials] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isCalcExpanded, setIsCalcExpanded] = useState(true);
  const [isPolicyExpanded, setIsPolicyExpanded] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [showItemServiceSearch, setShowItemServiceSearch] = useState(false);
  const [costSearchType, setCostSearchType] = useState<'op' | 'inst' | null>(null);
  const [isKitLoaded, setIsKitLoaded] = useState(!kitId);
  const [userPolicies, setUserPolicies] = useState<any[]>([]);
  const [policiesLoaded, setPoliciesLoaded] = useState(false);
  const [activePolicy, setActivePolicy] = useState<any>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  // Rich context for the policy violation modal
  const [policyAlert, setPolicyAlert] = useState<{
    fieldLabel: string;
    enteredValue: number;
    correctedValue: number;
    policyName: string;
  } | null>(null);

  const [licitacaoItemDetails, setLicitacaoItemDetails] = useState<any>(null);
  const [opportunityCustomerName, setOpportunityCustomerName] = useState<string | null>(null);
  const [isInterstate, setIsInterstate] = useState<boolean>(false);

  const [form, setForm] = useState<KitFormValues>({
    sales_budget_id: sourceBudgetId || undefined,
    licitacao_id: licitacaoIdParam || undefined,
    licitacao_item_id: licitacaoItemIdParam || undefined,
    nome_kit: '',
    descricao_kit: '',
    quantidade_kits: 1,
    tipo_contrato: initialTipoContrato,
    considerar_st_ou_difal: 'DIFAL',
    prazo_contrato_meses: 36,
    prazo_instalacao_meses: 0,
    fator_margem_locacao: 1.0,
    fator_margem_instalacao: 1.0,
    fator_margem_manutencao: 1.0,
    fator_margem_servicos_produtos: 1.0,
    taxa_juros_mensal: 0,
    taxa_manutencao_anual: 0,
    instalacao_inclusa: false,
    percentual_instalacao: '',
    havera_manutencao: false,
    qtd_meses_manutencao: '',
    manutencao_inclusa: false,
    faturamento_servico_separado: false,
    fator_manutencao: '',
    aliq_pis: 0,
    aliq_cofins: 0,
    aliq_csll: 0,
    aliq_irpj: 0,
    aliq_iss: 0,
    aliq_icms: 0,
    perc_frete_venda: 0,
    perc_despesas_adm: 0,
    perc_comissao: 0,
    custo_manut_mensal_kit: 0,
    custo_suporte_mensal_kit: 0,
    custo_seguro_mensal_kit: 0,
    custo_logistica_mensal_kit: 0,
    custo_software_mensal_kit: 0,
    custo_itens_acessorios_mensal_kit: 0,
    forma_execucao: 'H. NORMAL',
    items: [],
    costs: [],
    monthly_costs: [],
    custo_monitoramento_unitario: 0,
    fator_monitoramento: 1.0,
    margem_minima_desejada: '',
  });

  useEffect(() => {
    const fetchItemDetails = async () => {
      const licId = form.licitacao_id;
      const itemId = form.licitacao_item_id;
      if (licId && itemId) {
        try {
          const res = await api.get(`/licitacoes/${licId}`);
          const lic = res.data;
          const item = lic.lotes?.flatMap((l: any) => l.items || []).find((i: any) => i.id === itemId);
          if (item) {
            setLicitacaoItemDetails(item);
          }
        } catch (err) {
          console.error("Erro ao carregar detalhes do item da licitação:", err);
        }
      }
    };
    fetchItemDetails();
  }, [form.licitacao_id, form.licitacao_item_id]);

  const budgetIdToQuery = sourceBudgetId || form.sales_budget_id;
  useEffect(() => {
    if (budgetIdToQuery) {
      api.get(`/sales-budgets/${budgetIdToQuery}`).then(res => {
        if (res.data) {
          setOpportunityCustomerName(res.data.customer_nome || 'Cliente');
          const companyState = res.data.company_state_sigla;
          const customerState = res.data.customer_state_sigla;
          if (companyState && customerState && companyState !== customerState) {
            setIsInterstate(true);
          }
        }
      }).catch(err => console.error("Error loading budget customer", err));
    }
  }, [budgetIdToQuery]);

  useEffect(() => {
    if (isInterstate && form.tipo_contrato === 'VENDA_EQUIPAMENTOS') {
      setForm(prev => {
        if (prev.aliq_icms !== 12) {
          return { ...prev, aliq_icms: 12 };
        }
        return prev;
      });
    }
  }, [isInterstate, form.tipo_contrato]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Tracks the previously applied tipo_contrato so we can detect user-initiated changes
  const prevTipoContratoRef = useRef<string>(form.tipo_contrato);

  useEffect(() => {
    if (kitId) {
      loadKit();
    }
  }, [kitId]);

  const loadKit = async () => {
    try {
      const res = await api.get(`/opportunity-kits/${kitId}`);
      const data = res.data;
      if (!data.items) data.items = [];
      if (!data.costs) data.costs = [];
      if (!data.monthly_costs) data.monthly_costs = [];

      // Safely parse the incoming maintenance factor
      const loadFm = data.fator_manutencao;
      // The user wants it to be 1 ONLY if it's explicitly null, undefined, empty string, or zero.
      // If the user typed 2.5333 or similar, we must preserve it exactly.
      if (
        loadFm === null ||
        loadFm === undefined ||
        loadFm === '' ||
        (typeof loadFm === 'number' && loadFm === 0) ||
        (typeof loadFm === 'string' && parseFloat(loadFm) === 0)
      ) {
        data.fator_manutencao = 1;
      } else {
        data.fator_manutencao = typeof loadFm === 'string' ? parseFloat(loadFm) : Number(loadFm);
      }
      data.costs = data.costs.map((c: any) => ({
        ...c,
        descricao_item: c.product?.nome || c.descricao_item || 'Serviço'
      }));
      data.faturamento_servico_separado = data.faturamento_servico_separado || false;
      
      // Sanitize null values to empty strings to prevent React 'value prop on input should not be null' warnings
      data.nome_kit = data.nome_kit ?? '';
      data.descricao_kit = data.descricao_kit ?? '';
      data.percentual_instalacao = data.percentual_instalacao ?? '';
      data.qtd_meses_manutencao = data.qtd_meses_manutencao ?? '';
      data.margem_minima_desejada = data.margem_minima_desejada ?? '';
      data.perc_frete_venda = data.perc_frete_venda ?? 0;
      data.perc_despesas_adm = data.perc_despesas_adm ?? 0;
      data.perc_comissao = data.perc_comissao ?? 0;
      data.taxa_juros_mensal = data.taxa_juros_mensal ?? 0;
      data.taxa_manutencao_anual = data.taxa_manutencao_anual ?? 0;
      data.custo_monitoramento_unitario = data.custo_monitoramento_unitario ?? 0;
      data.considerar_st_ou_difal = data.considerar_st_ou_difal || 'DIFAL';
      data.forma_execucao = data.forma_execucao || 'H. NORMAL';

      setForm(data);
      // Ensure we record the loaded contract type so it doesn't trigger the change detection later
      prevTipoContratoRef.current = data.tipo_contrato;
      setIsKitLoaded(true);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (!activeCompanyId) return;

    // Map tipo_contrato → per-type parameter suffix in company sales parameters
    const modalSuffix: Record<string, string> = {
      LOCACAO: 'locacao',
      COMODATO: 'comodato',
      VENDA_EQUIPAMENTOS: 'venda',
      INSTALACAO: 'venda', // Apenas instalação usa bloco Venda
    };
    const suffix = modalSuffix[form.tipo_contrato] || 'locacao';

    // Detect whether the user changed the type (vs. initial mount)
    // Only detect changes if the kit is FULLY LOADED. 
    // This prevents the 'initial default LOCACAO -> actual DB values (e.g. COMODATO)' change from overwriting factors.
    const tipoChanged = isKitLoaded && prevTipoContratoRef.current !== form.tipo_contrato;
    prevTipoContratoRef.current = form.tipo_contrato;

    // For existing kits on initial load, don't overwrite already-saved taxes.
    // But DO overwrite when the user explicitly switches tipo_contrato.
    const shouldOverwriteTaxes = (!kitId && isKitLoaded) || tipoChanged;

    if (!shouldOverwriteTaxes) return; // Guard: only prefill for new kits or on tipo_contrato change

    api.get(`/companies/${activeCompanyId}/sales-parameters`).then(res => {
      const p = res.data;
      if (!p) return;

      // Prefer per-type field; fall back to the generic field if the per-type is 0/null
      const pick = (base: string) =>
        Number(p[`${base}_${suffix}`] ?? p[base] ?? 0);

      setForm(prev => ({
        ...prev,
        ...(shouldOverwriteTaxes ? {
          aliq_pis: pick('pis'),
          aliq_cofins: pick('cofins'),
          aliq_csll: pick('csll'),
          aliq_irpj: pick('irpj'),
          aliq_iss: pick('iss'),
          aliq_icms: pick('icms_interno'),
        } : {}),
        // MKP: apply per-type defaults for ALL contract types on tipo_contrato change
        // pick('mkp_padrao') resolves to: p['mkp_padrao_locacao'] for LOCACAO,
        //   p['mkp_padrao_comodato'] for COMODATO, p['mkp_padrao_venda'] for VENDA, etc.
        ...(shouldOverwriteTaxes ? {
          fator_margem_locacao: pick('mkp_padrao') || 1,
          fator_margem_manutencao: pick('mkp_padrao') || 1,
          ...(form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? {
            fator_margem_servicos_produtos: pick('mkp_padrao') || 1,
            fator_margem_instalacao: pick('mkp_padrao') || 1,
            perc_despesas_adm: pick('despesa_administrativa'),
          } : {}),
        } : {}),
      }));
    }).catch(err => console.error('Failed to load sales parameters', err));
  }, [kitId, form.tipo_contrato, activeCompanyId, isKitLoaded]);

  // ÔöÇÔöÇ Policy loading — ALWAYS runs, independent of shouldOverwriteTaxes guard ÔöÇÔöÇ
  // BUG FIX: previously this lived inside the prefill effect above. The
  // `if (!shouldOverwriteTaxes) return` guard was killing the whole effect for
  // existing kits, so setPoliciesLoaded(true) was never called and the
  // "Carregando políticas..." spinner looped forever.
  useEffect(() => {
    if (!activeCompanyId) return;

    const shouldOverwriteTaxes = !kitId && isKitLoaded;

    const loadPolicies = async () => {
      setPoliciesLoaded(false);
      try {
        // Use the user-scoped endpoint so limits reflect the logged-in user's
        // role (cargo), not every tier configured for the company.
        // The admin endpoint /{id}/commercial-policies returns ALL tiers and
        // was causing minAllowed to be the company-wide minimum (e.g. 1.0)
        // instead of what the user's role actually permits (e.g. 1.71).
        const res = await api.get(`/companies/commercial-policies/me`);
        const policies = (res.data || []).filter((p: any) => p.ativo);
        const sorted = [...policies].sort((a: any, b: any) => Number(a.fator_limite) - Number(b.fator_limite));
        setUserPolicies(sorted);

        if (sorted.length > 0) {
          const minAllowed = Number(sorted[0].fator_limite);
          const defaultPolicy: any = sorted.find((p: any) => p.is_default) ?? sorted[0];

          setForm(prev => {
            const updates: any = {};

            if (shouldOverwriteTaxes && defaultPolicy && form.tipo_contrato === 'VENDA_EQUIPAMENTOS') {
              const defaultFator = Number(defaultPolicy.fator_limite);
              updates.fator_margem_locacao = defaultFator;
              updates.fator_margem_instalacao = defaultFator;
              updates.fator_margem_manutencao = defaultFator;
              updates.fator_margem_servicos_produtos = defaultFator;
              updates.taxa_manutencao_anual = defaultPolicy.manutencao_ano_percentual ?? 0;
              updates.perc_comissao = defaultPolicy.comissao_percentual ?? 0;
            } else {
              if (Number(prev.fator_margem_locacao) < minAllowed) updates.fator_margem_locacao = minAllowed;
              if (Number(prev.fator_margem_instalacao) < minAllowed) updates.fator_margem_instalacao = minAllowed;
              if (Number(prev.fator_margem_manutencao) < minAllowed) updates.fator_margem_manutencao = minAllowed;
              if (Number(prev.fator_margem_servicos_produtos) < minAllowed) updates.fator_margem_servicos_produtos = minAllowed;
              if (prev.fator_manutencao && Number(prev.fator_manutencao) < minAllowed) updates.fator_manutencao = minAllowed;
            }

            const currentFator = Number(updates.fator_margem_locacao ?? prev.fator_margem_locacao);
            const applicable = sorted
              .filter((p: any) => Number(p.fator_limite) <= currentFator + 0.00001)
              .sort((a: any, b: any) => Number(b.fator_limite) - Number(a.fator_limite))[0];

            if (applicable) {
              setTimeout(() => setActivePolicy(applicable), 0);
              if (!shouldOverwriteTaxes && updates.perc_comissao === undefined) {
                updates.perc_comissao = applicable.comissao_percentual;
              }
            }

            return { ...prev, ...updates };
          });
        }
      } catch (err) {
        console.error('Failed to load company policies', err);
      } finally {
        setPoliciesLoaded(true);
      }
    };

    loadPolicies();
  }, [kitId, form.tipo_contrato, activeCompanyId]);


  // ÔöÇÔöÇ Reactive tier update ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
  // Effect 1: Detect which tier the current factor falls into.
  // Runs on every fator_margem_locacao change (committed value, after blur).
  useEffect(() => {
    if (!userPolicies || userPolicies.length === 0) return;

    const fator = Number(form.fator_margem_locacao);
    if (!fator || fator <= 0) return;

    const applicable = userPolicies
      .filter((p: any) => Number(p.fator_limite) <= fator + 0.00001)
      .sort((a: any, b: any) => Number(b.fator_limite) - Number(a.fator_limite))[0] ?? null;

    setActivePolicy(applicable);
  }, [form.fator_margem_locacao, userPolicies]);

  // Effect 2: Sync commission when the active tier changes (tier ID changed).
  // Separated from Effect 1 to avoid nested state setter anti-pattern.
  useEffect(() => {
    if (!activePolicy) return;
    setForm(prev => {
      const incoming = Number(activePolicy.comissao_percentual);
      if (Number(prev.perc_comissao) === incoming) return prev; // no-op if already correct
      return { ...prev, perc_comissao: incoming };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePolicy?.id]); // Only fires when the TIER changes, not on every form render

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      recalculate(form);
    }, 600);
    return () => clearTimeout(timerRef.current);
  }, [form]);

  const sanitizePayload = (data: KitFormValues) => {
    const sanitizedCosts = data.costs.map(c => {
      const isKitExecType = ['VENDA_EQUIPAMENTOS', 'LOCACAO', 'COMODATO', 'INSTALACAO'].includes(data.tipo_contrato);
      const summary = financials?.cost_summaries?.find((cs: any) =>
        (cs.product_id === c.product_id || (cs.own_service_id && cs.own_service_id === c.own_service_id)) &&
        cs.tipo_custo === c.tipo_custo
      );
      return {
        ...c,
        valor_unitario: (isKitExecType && c.own_service_id && summary?.custo_base_unitario_item !== undefined)
          ? summary.custo_base_unitario_item
          : c.valor_unitario,
        forma_execucao: (isKitExecType && c.own_service_id)
          ? data.forma_execucao
          : c.forma_execucao
      };
    });

    return {
      ...data,
      nome_kit: data.nome_kit || "PREVIEW_KIT",
      percentual_instalacao: data.percentual_instalacao === '' ? null : data.percentual_instalacao,
      fator_manutencao: data.fator_manutencao === '' ? null : data.fator_manutencao,
      qtd_meses_manutencao: data.qtd_meses_manutencao === '' ? null : data.qtd_meses_manutencao,
      margem_minima_desejada: data.margem_minima_desejada === '' || data.margem_minima_desejada === undefined ? null : data.margem_minima_desejada,
      faturamento_servico_separado: data.faturamento_servico_separado || false,
      costs: sanitizedCosts,
      monthly_costs: data.monthly_costs,
    };
  };

  const recalculate = async (data: KitFormValues) => {
    // Only block recalculate for LOCACAO/COMODATO where prazo is essential for tx_locacao
    const needsPrazo = ['LOCACAO', 'COMODATO'].includes(data.tipo_contrato);
    if (needsPrazo && data.prazo_contrato_meses <= 0) return;
    setIsCalculating(true);
    try {
      const payload = sanitizePayload(data);
      const resp = await api.post(`/opportunity-kits/preview`, payload);
      setFinancials(resp.data);
    } catch (err: any) {
      console.error("Erro no recálculo de preview", err);
      if (err.response?.status === 422) console.error(err.response.data);
    } finally {
      setIsCalculating(false);
    }
  };

  const handleInputChange = (field: keyof KitFormValues, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const FACTOR_LABELS: Record<string, string> = {
    fator_margem_locacao: 'Fator Margem (Produtos / Base)',
    fator_margem_servicos_produtos: 'Fator Margem Serviços (Produtos)',
    fator_margem_instalacao: 'Fator Margem Instalação',
    fator_margem_manutencao: 'Fator Margem Manutenção',
    fator_manutencao: 'Fator Manutenção',
  };

  const handleFactorBlur = (fieldName: keyof KitFormValues, value: number) => {
    // ALWAYS commit the typed value first — never leave input in limbo.
    // This is the single source of truth: the user's intent is respected,
    // then validated against loaded policies.
    setForm(prev => ({ ...prev, [fieldName]: value }));

    // If policies aren't loaded yet, skip validation (they'll clamp on load)
    if (!policiesLoaded || !userPolicies || userPolicies.length === 0) return;

    const minAllowed = Math.min(...userPolicies.map(p => Number(p.fator_limite)));
    const violatingPolicy = userPolicies.find(p => Number(p.fator_limite) === minAllowed);

    let finalValue = value;
    if (value < minAllowed - 0.00001) {
      // Trigger rich policy violation modal
      setPolicyAlert({
        fieldLabel: FACTOR_LABELS[fieldName as string] ?? String(fieldName),
        enteredValue: value,
        correctedValue: minAllowed,
        policyName: violatingPolicy?.nome_politica ?? 'Política Comercial',
      });
      finalValue = minAllowed;
    }

    // Commit corrected value
    setForm(prev => ({ ...prev, [fieldName]: finalValue }));

    // Determine which policy tier applies
    const applicablePolicy = userPolicies
      .filter(p => Number(p.fator_limite) <= finalValue + 0.00001)
      .sort((a, b) => Number(b.fator_limite) - Number(a.fator_limite))[0];

    if (applicablePolicy) {
      setActivePolicy(applicablePolicy);
      setForm(prev => ({
        ...prev,
        [fieldName]: finalValue,
        perc_comissao: applicablePolicy.comissao_percentual
      }));
    } else {
      setActivePolicy(null);
    }
  };



  const handleAddProducts = (products: any[]) => {
    setForm(prev => {
      const newItems = [...prev.items];
      products.forEach(product => {
        const existingIdx = newItems.findIndex(i => i.product_id === product.id);
        if (existingIdx !== -1) {
          newItems[existingIdx].quantidade_no_kit += 1;
        } else {
          newItems.push({
            product_id: product.id,
            descricao_item: product.nome,
            quantidade_no_kit: 1,
            product: { codigo: product.codigo }
          });
        }
      });
      return { ...prev, items: newItems };
    });
    setShowProductSearch(false);
  };

  const updateItemQty = (index: number, qty: number) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems[index].quantidade_no_kit = qty;
      return { ...prev, items: newItems };
    });
  };

  const removeItem = (index: number) => {
    setForm(prev => {
      const newItems = [...prev.items];
      newItems.splice(index, 1);
      return { ...prev, items: newItems };
    });
  };

  const handleAddCost = (data: {
    tipo_item: string;
    product?: any;
    own_service?: any;
    forma_execucao?: string;
    quantidade: number;
    tipo_custo: string;
    valor_unitario: number;
    descricao_item?: string;
  }) => {
    setForm(prev => ({
      ...prev,
      costs: [
        ...prev.costs,
        {
          tipo_item: data.tipo_item,
          product_id: data.product?.id,
          own_service_id: data.own_service?.id,
          forma_execucao: data.forma_execucao,
          tipo_custo: data.tipo_custo,
          quantidade: data.quantidade,
          valor_unitario: data.valor_unitario,
          descricao_item: data.descricao_item,
        }
      ]
    }));
  };

  const handleAddItemService = (data: {
    tipo_item: string;
    product?: any;
    own_service?: any;
    forma_execucao?: string;
    quantidade: number;
    tipo_custo: string;
    valor_unitario: number;
    descricao_item?: string;
  }) => {
    setForm(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: data.product?.id || null,
          own_service_id: data.own_service?.id || null,
          tipo_item: data.tipo_item,
          descricao_item: data.descricao_item || data.product?.nome || data.own_service?.nome_servico || 'Serviço Próprio',
          quantidade_no_kit: data.quantidade,
          product: data.product || null,
          own_service: data.own_service || null
        }
      ]
    }));
  };

  const updateCostQuantity = (costToUpdate: any, qty: number) => {
    setForm(prev => {
      const idx = prev.costs.findIndex(c =>
        c.product_id === costToUpdate.product_id &&
        c.own_service_id === costToUpdate.own_service_id &&
        c.tipo_custo === costToUpdate.tipo_custo
      );
      if (idx > -1) {
        const newCosts = [...prev.costs];
        newCosts[idx].quantidade = qty;
        return { ...prev, costs: newCosts };
      }
      return prev;
    });
  };

  const removeCostByProps = (cToRemove: any) => {
    setForm(prev => {
      const idx = prev.costs.findIndex(c =>
        c.product_id === cToRemove.product_id &&
        c.own_service_id === cToRemove.own_service_id &&
        c.tipo_custo === cToRemove.tipo_custo
      );
      if (idx > -1) {
        const newCosts = [...prev.costs];
        newCosts.splice(idx, 1);
        return { ...prev, costs: newCosts };
      }
      return prev;
    });
  };

  const onSubmit = async () => {
    // Front-end safety validation
    if (userPolicies.length > 0) {
      const minAllowed = Math.min(...userPolicies.map(p => Number(p.fator_limite)));
      const factorFields: (keyof KitFormValues)[] = [
        'fator_margem_locacao',
        'fator_margem_instalacao',
        'fator_margem_manutencao',
        'fator_margem_servicos_produtos',
        'fator_margem_manutencao'
      ];

      const invalidField = factorFields.find(f => {
        const val = form[f];
        return val !== null && val !== undefined && Number(val) > 0 && Number(val) < (minAllowed - 0.0001);
      });

      if (invalidField) {
        setAlertMessage(`O campo [${invalidField}] está com o fator abaixo do limite permitido (${minAllowed.toFixed(4)}). Por favor, ajuste antes de prosseguir.`);
        return;
      }
    }

    if (form.licitacao_id && form.margem_minima_desejada !== '' && form.margem_minima_desejada !== undefined) {
      const targetMargin = Number(form.margem_minima_desejada);
      const currentMargin = financials?.summary?.margem_kit ?? 0;
      if (targetMargin > currentMargin) {
        setAlertMessage("A margem mínima desejada não pode ser maior que a margem atual do Kit.");
        return;
      }
    }

    try {
      const payload = sanitizePayload(form);
      let savedKit = null;

      // Requirement: Editing a global kit from an opportunity should NOT change the original kit.
      // If kitId exists (we are editing) but form.sales_budget_id is empty (it's a global template)
      // AND we have a sourceBudgetId/initialSalesBudgetId, we should CLONE it (POST) instead of PUT.
      const isGlobalTemplate = !!kitId && !form.sales_budget_id;
      const shouldClone = isGlobalTemplate && !!sourceBudgetId;

      if (kitId && !shouldClone) {
        const resp = await api.put(`/opportunity-kits/${kitId}`, payload);
        savedKit = resp.data;
      } else {
        // Force the current budget ID into the payload if we are cloning or creating within a budget
        const finalPayload = {
          ...payload,
          sales_budget_id: sourceBudgetId || form.sales_budget_id
        };
        const resp = await api.post(`/opportunity-kits/company/${activeCompanyId}`, finalPayload);
        savedKit = resp.data;
      }
      if (isModal && onSuccess) {
        onSuccess(savedKit);
        return;
      }
      if (form.licitacao_id) {
        navigate(`/comercial/licitacoes/${form.licitacao_id}?tab=lotes`);
      } else if (sourceBudgetId || form.sales_budget_id) {
        navigate(`/cadastros/orcamentos/${sourceBudgetId || form.sales_budget_id}?tab=locacao`);
      } else {
        navigate('/cadastros/kits');
      }
    } catch (error: any) {
      console.error("Error saving kit", error);
      if (error.response?.data?.detail) {
        setAlertMessage(error.response.data.detail);
      } else {
        setAlertMessage("Erro ao salvar kit. Verifique se o prazo de carência não é maior que o de contrato.");
      }
    }
  };

  const handlePrintPdf = () => {
    let iframe = document.getElementById('print-iframe') as HTMLIFrameElement;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.id = 'print-iframe';
      iframe.style.position = 'absolute';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);
    }
    iframe.src = `/relatorios/kit-analitico?kitId=${kitId}&print=true`;
  };

  const fmtC = (val: number | undefined) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const showBlock3 = form.tipo_contrato !== 'INSTALACAO' && (form.tipo_contrato !== 'VENDA_EQUIPAMENTOS' || !!form.havera_manutencao);
  const showBlock31 = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' && !form.instalacao_inclusa;
  const opCosts = form.costs.filter(c => c.tipo_custo !== 'INSTALACAO');
  const instCosts = form.costs.filter(c => c.tipo_custo === 'INSTALACAO');

  const renderTargetSolverHUD = () => {
    if (!financials?.summary?.fator_minimo_calculado) return null;

    const fatAtual = Number(form.fator_margem_locacao) || 0;
    const fatMin = Number(financials.summary.fator_minimo_calculado) || 0;
    const vlrAtual = Number(financials.summary.valor_mensal_kit || financials.summary.faturamento_total_venda || 0);
    const vlrMin = Number(financials.summary.valor_venda_minimo) || 0;
    const lucroAtual = Number(financials.summary.lucro_mensal_kit || financials.summary.lucro_equipamentos || 0);
    const lucroMin = Number(financials.summary.lucro_minimo) || 0;
    const margemAtual = Number(financials.summary.margem_kit || financials.summary.margem_equipamentos || 0);
    const margemMin = Number(financials.summary.margem_minima_resultante) || 0;

    return (
      <div className="mt-4 p-4 bg-brand-primary/5 border border-brand-primary/25 rounded-2xl shadow-sm animate-fade-in w-full col-span-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-brand-primary mb-3 flex items-center gap-1.5">
          <Calculator className="w-3.5 h-3.5" />
          Simulação de Margem Alvo
        </h4>
        <div className="space-y-2.5 text-xs">
          <div className="grid grid-cols-3 font-semibold text-text-muted border-b border-border-subtle pb-1">
            <span>Métrica</span>
            <span className="text-right">Atual</span>
            <span className="text-right text-brand-primary">Mínimo (Alvo)</span>
          </div>
          
          <div className="grid grid-cols-3">
            <span className="text-text-secondary">Fator Margem</span>
            <span className="text-right font-mono tabular-nums">{fatAtual.toFixed(4)}</span>
            <span className="text-right font-bold text-brand-primary font-mono tabular-nums">{fatMin.toFixed(4)}</span>
          </div>

          <div className="grid grid-cols-3">
            <span className="text-text-secondary">Preço Venda</span>
            <span className="text-right font-mono tabular-nums">{fmtC(vlrAtual)}</span>
            <span className="text-right font-bold text-brand-primary font-mono tabular-nums">{fmtC(vlrMin)}</span>
          </div>

          <div className="grid grid-cols-3">
            <span className="text-text-secondary">Lucro</span>
            <span className="text-right font-mono tabular-nums">{fmtC(lucroAtual)}</span>
            <span className="text-right font-bold text-brand-primary font-mono tabular-nums">{fmtC(lucroMin)}</span>
          </div>

          <div className="grid grid-cols-3">
            <span className="text-text-secondary">Margem</span>
            <span className="text-right font-mono tabular-nums">{margemAtual.toFixed(1)}%</span>
            <span className="text-right font-bold text-brand-primary font-mono tabular-nums">{margemMin.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-6 mx-auto ${isModal ? 'max-w-full pb-8' : 'max-w-[1600px] pb-24'}`}>
      {/* HEADER */}
      {!isModal && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" type="button" onClick={() => {
            if (form.licitacao_id) navigate(`/comercial/licitacoes/${form.licitacao_id}?tab=lotes`);
            else if (sourceBudgetId || form.sales_budget_id) navigate(`/cadastros/orcamentos/${sourceBudgetId || form.sales_budget_id}?tab=locacao`);
            else navigate('/cadastros/kits');
          }}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-text-primary tracking-tight">
              {kitId ? 'Editar Kit de Oportunidade' : 'Novo Kit de Oportunidade'}
            </h1>
            {(sourceBudgetId || form.sales_budget_id) && (
              <div className="flex flex-col items-start gap-1">
                <span className="bg-primary-50 text-primary-600 border border-primary-200 px-3 py-1 rounded-full text-sm font-semibold">
                  Exclusivo do Orçamento
                </span>
                {opportunityCustomerName && (
                  <span className="text-xs text-text-muted flex items-center gap-1 font-medium mt-1">
                    <Building2 className="w-3.5 h-3.5 text-brand-primary" />
                    Cliente: <strong className="text-text-secondary">{opportunityCustomerName}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="text-text-muted mt-2 text-lg">
            Configure os parâmetros de locação, agrupe produtos e calcule tarifas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isModal && onClose && (
            <Button variant="ghost" size="lg" onClick={onClose}>
              Cancelar
            </Button>
          )}
          {kitId && (
            <Button 
              variant="outline" 
              size="lg" 
              type="button" 
              onClick={handlePrintPdf}
            >
              <Printer className="w-5 h-5 mr-2" />
              Imprimir Kit Analítico
            </Button>
          )}
          <Button variant="primary" size="lg" onClick={onSubmit}>
            <Save className="w-5 h-5 mr-2" />
            Salvar Kit de Oportunidade
          </Button>
        </div>
      </div>
             {/* SPLIT LAYOUT: LEFT SIDEBAR FOR CALCULO SIMULTANEO, RIGHT FOR FORM SECTIONS */}
      <div className="flex flex-col lg:flex-row items-start gap-6 mt-6 w-full">

        {/* LEFT SIDEBAR (Cálculo Simultâneo) */}
        <aside
          className={`w-full shrink-0 transition-all duration-300 lg:sticky lg:top-6 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto z-40
            ${isCalcExpanded ? 'lg:w-[420px]' : 'lg:w-16'}`}
        >
          {(() => {
            // While the policy-violation modal is open, suppress the HUD entirely —
            // it would show financials computed from an invalid (below-minimum) factor.
            if (policyAlert) return null;

            const isVenda = ['VENDA_EQUIPAMENTOS', 'INSTALACAO'].includes(form.tipo_contrato);

            if (isVenda) {
              // ── Bloco 4: item_summaries (produtos + serviços)
              const itemSums = financials?.item_summaries || [];
              const custoB4 = itemSums.reduce((a: number, s: any) => a + (s.custo_total_item_no_kit || 0), 0);
              const vendaB4 = itemSums.reduce((a: number, s: any) => a + (s.venda_total_item || 0), 0);
              const lucroB4 = itemSums.reduce((a: number, s: any) => a + (s.lucro_total_item || 0), 0);

              // ── Bloco 5: cost_summaries INSTALACAO
              const instSums = (financials?.cost_summaries || []).filter((cs: any) => cs.tipo_custo === 'INSTALACAO');
              const custoB5 = instSums.reduce((a: number, s: any) => a + (s.custo_total_item_no_kit || 0), 0);
              const vendaB5 = instSums.reduce((a: number, s: any) => a + (s.venda_total_item || 0), 0);
              let lucroB5 = instSums.reduce((a: number, s: any) => a + (s.lucro_total_item || 0), 0);
              if (form.instalacao_inclusa) {
                const percInst = Number(form.percentual_instalacao) || 0;
                const custoAqTotal = Number(financials?.summary?.custo_aquisicao_kit || 0);
                lucroB5 = custoAqTotal * (percInst / 100);
              }

              // ── Bloco 6: cost_summaries MANUTENCAO
              const opSums = (financials?.cost_summaries || []).filter((cs: any) => cs.tipo_custo !== 'INSTALACAO');
              const custoB6 = form.havera_manutencao ? opSums.reduce((a: number, s: any) => a + (s.custo_total_item_no_kit || 0), 0) : 0;
              const vendaMensalB6 = form.havera_manutencao ? opSums.reduce((a: number, s: any) => a + (s.venda_total_item || 0), 0) : 0;
              const lucroMensalB6 = form.havera_manutencao ? opSums.reduce((a: number, s: any) => a + (s.lucro_total_item || 0), 0) : 0;
              const qtdMeses = Number(form.qtd_meses_manutencao) || 0;

              // ── Totalizadores (SOT no Backend)
              const custoB6Total = custoB6 * qtdMeses;
              const custoAquisicao = Number(financials?.summary?.custo_aquisicao_total || 0) + custoB6Total;
              const totalVenda = Number(financials?.summary?.venda_equipamentos_total || 0);
              const totalManutencao = Number(financials?.summary?.venda_manutencao_total || 0);
              const faturamentoTotal = totalVenda + totalManutencao;
              const lucroVenda = Number(financials?.summary?.lucro_equipamentos || 0);
              const margemVenda = Number(financials?.summary?.margem_equipamentos || 0);

              const lucroManutMensal = totalManutencao > 0 ? Number(financials?.summary?.lucro_manutencao || 0) / qtdMeses : 0;
              const lucroManutencao12m = form.havera_manutencao ? (lucroManutMensal * 12) : 0;
              const margemManut12m = Number(financials?.summary?.margem_manutencao || 0);

              // ── Impostos B4 + B5 discriminados
              const taxFields = ['pis', 'cofins', 'csll', 'irpj', 'icms', 'iss'] as const;
              const taxLabelB45: Record<string, { label: string; mensal: number; total: number }> = {};
              [...itemSums, ...instSums].forEach((s: any) => {
                taxFields.forEach(t => {
                  const unit = s[`${t}_unit`] || 0;
                  const qty = s.quantidade_no_kit || s.quantidade || 1;
                  if (!taxLabelB45[t]) taxLabelB45[t] = { label: t.toUpperCase(), mensal: 0, total: 0 };
                  taxLabelB45[t].total += unit * qty;
                });
              });
              let impostosB45 = Object.values(taxLabelB45).reduce((a, b) => a + b.total, 0);
              const icmsStCompraDeduction = isInterstate ? (financials?.summary?.total_st_kit || 0) : 0;
              if (isInterstate) {
                impostosB45 -= icmsStCompraDeduction;
              }

              // ── Impostos B6 discriminados (mensal e total)
              const taxLabelB6: Record<string, { label: string; mensal: number; total: number }> = {};
              if (form.havera_manutencao) {
                opSums.forEach((s: any) => {
                  taxFields.forEach(t => {
                    const unit = s[`${t}_unit`] || 0;
                    const qty = s.quantidade || 1;
                    if (!taxLabelB6[t]) taxLabelB6[t] = { label: t.toUpperCase(), mensal: 0, total: 0 };
                    taxLabelB6[t].mensal += unit * qty;
                    taxLabelB6[t].total += unit * qty * qtdMeses;
                  });
                });
              }
              const impostosMensalB6 = Object.values(taxLabelB6).reduce((a, b) => a + b.mensal, 0);

              // ── Desp. de venda B4+B5
              const despVendaB4 = itemSums.reduce((a: number, s: any) => a + (s.frete_venda_item || 0) + (s.desp_adm_item || 0) + (s.comissao_item || 0), 0);
              const despVendaB5 = instSums.reduce((a: number, s: any) => a + (s.frete_venda_item || 0) + (s.desp_adm_item || 0) + (s.comissao_item || 0), 0);
              const despVenda = despVendaB4 + despVendaB5;

              if (!isCalcExpanded) {
                return (
                  <>
                    {/* Desktop collapsed */}
                    <button
                      type="button"
                      onClick={() => setIsCalcExpanded(true)}
                      className="hidden lg:flex flex-col items-center justify-center gap-4 bg-bg-surface border border-border-subtle hover:bg-bg-subtle/50 transition-all shadow-sm rounded-2xl py-6 px-3 w-12 cursor-pointer group"
                      title="Expandir Cálculo Simultâneo"
                    >
                      <Calculator className="w-5 h-5 text-brand-primary group-hover:scale-110 transition-transform" />
                      <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap">
                        Cálculo Simultâneo
                      </div>
                      <ChevronRight className="w-4 h-4 text-text-muted mt-2" />
                    </button>
                    {/* Mobile collapsed */}
                    <button
                      type="button"
                      onClick={() => setIsCalcExpanded(true)}
                      className="w-full lg:hidden flex items-center justify-between bg-bg-surface border border-border-subtle hover:bg-bg-subtle/50 transition-all shadow-sm rounded-2xl p-4 cursor-pointer"
                    >
                      <span className="text-xs font-bold text-text-primary tracking-tight flex items-center gap-2">
                        <Calculator className="w-4 h-4 text-brand-primary" />
                        Cálculo Simultâneo — Venda
                      </span>
                      <ChevronDown className="w-4 h-4 text-text-muted" />
                    </button>
                  </>
                );
              }

              return (
                <div className="bg-bg-surface/95 backdrop-blur-xl border border-border-subtle shadow-md rounded-2xl p-4 xl:p-5 transition-all">
                  {/* Header row */}
                  <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-3">
                    <h3 className="text-sm font-bold text-text-primary tracking-tight flex items-center">
                      <Calculator className="w-4 h-4 mr-2 text-brand-primary" /> Cálculo Simultâneo — Venda
                    </h3>
                    <div className="flex items-center gap-3">
                      {isCalculating ? (
                        <span className="flex items-center text-[10px] font-semibold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-full animate-pulse">
                          <Calculator className="w-3 h-3 mr-1 animate-pulse" /> Calculando
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-brand-success bg-brand-success/10 border border-brand-success/20 px-2 py-1 rounded-full">Atualizado</span>
                      )}
                      <button 
                        type="button" 
                        onClick={() => setIsCalcExpanded(false)}
                        className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        title="Recolher painel"
                      >
                        <ChevronLeft className="w-4 h-4 hidden lg:block" />
                        <ChevronUp className="w-4 h-4 lg:hidden" />
                      </button>
                    </div>
                  </div>

                  {/* Collapsible Rules (Política Comercial) */}
                  <div className="mb-4 border border-border-subtle rounded-lg overflow-hidden">
                    <button 
                      type="button"
                      onClick={() => setIsPolicyExpanded(!isPolicyExpanded)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-bg-subtle text-xs font-bold text-text-secondary border-b border-border-subtle cursor-pointer hover:bg-bg-deep/50 transition-colors"
                    >
                      <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Regras de Negócio</span>
                      <div className="flex items-center gap-2">
                        {activePolicy && !isPolicyExpanded && (
                          <span className="text-[9px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">
                            {activePolicy.nome_politica} ({activePolicy.comissao_percentual}%)
                          </span>
                        )}
                        {isPolicyExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                      </div>
                    </button>

                    {isPolicyExpanded && (
                      <div className="p-3 bg-bg-surface">
                        {/* Tier list — three states: loading, empty, populated */}
                        {!policiesLoaded ? (
                          <div className="flex items-center gap-2 px-3 py-2">
                            <div className="w-3 h-3 rounded-full border-2 border-brand-primary border-t-transparent animate-spin shrink-0" />
                            <span className="text-[10px] text-text-muted">Carregando políticas...</span>
                          </div>
                        ) : userPolicies.length === 0 ? (
                          <div className="px-3 py-2">
                            <span className="text-[10px] text-text-muted italic">Nenhuma política comercial configurada para esta empresa.</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2 divide-y divide-border-subtle/55">
                            {userPolicies.map((p: any) => {
                              const isActive = activePolicy?.id === p.id;
                              const nextTier = userPolicies.find((np: any) => Number(np.fator_limite) > Number(p.fator_limite));
                              const rangeLabel = nextTier
                                ? `${Number(p.fator_limite).toFixed(2)} ≤ x < ${Number(nextTier.fator_limite).toFixed(2)}`
                                : `≥ ${Number(p.fator_limite).toFixed(2)}`;
                              return (
                                <div
                                  key={p.id}
                                  className={`px-3 py-1.5 rounded-lg transition-colors ${isActive
                                      ? 'bg-brand-primary/8 border-l-4 border-l-brand-primary'
                                      : 'bg-bg-surface opacity-60'
                                    }`}
                                >
                                  <p className={`text-[10px] font-bold uppercase tracking-wide truncate mb-0.5 ${isActive ? 'text-brand-primary' : 'text-text-muted'}`}>
                                    {p.nome_politica}
                                  </p>
                                  <p className={`text-xs font-bold tabular-nums ${isActive ? 'text-text-primary' : 'text-text-muted'}`}>
                                    {Number(p.comissao_percentual).toFixed(2)}% comissão
                                  </p>
                                  <p className="text-[9px] text-text-muted mt-0.5 truncate">{rangeLabel}</p>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Row 1 — Custos e vendas por bloco */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {/* Custo de Aquisição */}
                    <Tooltip variant="light" content={
                      <div className="w-72 space-y-2 text-text-secondary p-1">
                        <div className="font-bold text-text-primary border-b border-border-subtle/70 pb-1 mb-1 text-xs">Detalhamento dos Custos de Compra</div>
                        <div className="flex justify-between text-xs">
                          <span>Custo base:</span><span className="font-semibold text-text-primary">{fmtC(financials?.summary?.total_base_cost_total)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Valor IPI:</span><span className="font-semibold text-rose-600">{fmtC(financials?.summary?.total_ipi_total)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Valor ICMS ST:</span><span className="font-semibold text-rose-600">{fmtC(financials?.summary?.total_st_total)}</span>
                        </div>
                        {Number(financials?.summary?.total_difal_total || 0) > 0 && (
                          <div className="flex justify-between text-xs">
                            <span>Valor DIFAL:</span><span className="font-semibold text-rose-600">{fmtC(financials?.summary?.total_difal_total)}</span>
                          </div>
                        )}
                        <div className="border-t border-border-subtle/70 pt-1 flex justify-between font-bold text-xs text-text-primary">
                          <span>Custo Total do Kit:</span><span>{fmtC(financials?.summary?.custo_aquisicao_total)}</span>
                        </div>
                      </div>
                    }>
                      <div className="bg-bg-subtle border border-border-subtle rounded-xl p-3 flex flex-col justify-center cursor-help">
                        <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1">Custo de Aquisição</span>
                        <div className="text-base font-bold text-text-primary">{fmtC(custoAquisicao)}</div>
                        <div className="text-[9px] text-text-muted mt-1 space-y-0.5">
                          <div className="flex justify-between" title="Bloco 4 – Itens"><span>B4 (Itens):</span><span>{fmtC(custoB4)}</span></div>
                          <div className="flex justify-between" title="Bloco 5 – Instalação"><span>B5 (Inst.):</span><span>{fmtC(custoB5)}</span></div>
                          <div className="flex justify-between" title={`Bloco 6 – ${fmtC(custoB6)}/mês × ${qtdMeses}m`}><span>B6 (Manut.):</span><span>{fmtC(custoB6Total)}</span></div>
                        </div>
                      </div>
                    </Tooltip>

                    {/* Total da Venda (B4 + B5) */}
                    <div className="bg-bg-subtle border border-border-subtle rounded-xl p-3 flex flex-col justify-center">
                      <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1">Total da Venda</span>
                      <div className="text-base font-bold text-brand-primary">{fmtC(totalVenda)}</div>
                      <div className="text-[9px] text-text-muted mt-1 space-y-0.5">
                        <div className="flex justify-between" title="Itens (B4)"><span>Itens:</span><span>{fmtC(vendaB4)}</span></div>
                        {vendaB5 > 0 && <div className="flex justify-between" title="Instalação (B5)"><span>Inst.:</span><span>{fmtC(vendaB5)}</span></div>}
                      </div>
                      {impostosB45 > 0 && (
                        <Tooltip variant="light" content={
                          <div className="w-72 space-y-2 text-text-secondary p-1">
                            <div className="font-bold text-text-primary border-b border-border-subtle/70 pb-1 mb-1 text-xs">Impostos — Venda (B4 + B5)</div>
                            {Object.values(taxLabelB45).filter(t => t.total > 0).map(t => {
                              const label = t.label === 'ICMS' && isInterstate ? 'icms 12% Venda' : t.label;
                              return (
                                <div key={t.label} className="flex justify-between text-xs">
                                  <span>{label}</span><span className="text-rose-600 font-medium">{fmtC(t.total)}</span>
                                </div>
                              );
                            })}
                            {isInterstate && icmsStCompraDeduction > 0 && (
                              <div className="flex justify-between text-xs text-emerald-600">
                                <span>icms st (compra)</span><span className="font-medium">- ({fmtC(icmsStCompraDeduction)})</span>
                              </div>
                            )}
                            <div className="border-t border-border-subtle/70 pt-1 flex justify-between font-bold text-xs">
                              <span>Total Impostos</span><span className="text-rose-700">{fmtC(impostosB45)}</span>
                            </div>
                          </div>
                        }>
                          <span className="text-[9px] text-rose-600 font-semibold cursor-help border-b border-dashed border-rose-600/40 mt-1 inline-block">
                            Imp: {fmtC(impostosB45)}
                          </span>
                        </Tooltip>
                      )}
                    </div>

                    {/* Total de Manutenção (B6 × meses) */}
                    <div className={`border rounded-xl p-3 flex flex-col justify-center ${form.havera_manutencao ? 'bg-bg-subtle border-border-subtle' : 'bg-bg-deep/50 border-border-subtle/50 opacity-50'}`}>
                      <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1">Total de Manutenção</span>
                      <div className="text-base font-bold text-brand-warning">{fmtC(totalManutencao)}</div>
                      <div className="text-[9px] text-text-muted mt-1">
                        {fmtC(vendaMensalB6)}/m × {qtdMeses || '—'} meses
                      </div>
                      {impostosMensalB6 > 0 && (
                        <Tooltip variant="light" content={
                          <div className="w-80 space-y-2 text-text-secondary p-1">
                            <div className="font-bold text-text-primary border-b border-border-subtle/70 pb-1 mb-1 text-xs">Impostos — Manutenção (B6)</div>
                            <div className="grid grid-cols-3 text-[10px] font-bold text-text-muted mb-1">
                              <span>Imposto</span><span className="text-right">Mensal</span><span className="text-right">Total ({qtdMeses}m)</span>
                            </div>
                            {Object.values(taxLabelB6).filter(t => t.mensal > 0).map(t => (
                              <div key={t.label} className="grid grid-cols-3 text-xs">
                                <span>{t.label}</span>
                                <span className="text-right text-rose-600 font-medium">{fmtC(t.mensal)}</span>
                                <span className="text-right text-rose-700 font-semibold">{fmtC(t.total)}</span>
                              </div>
                            ))}
                            <div className="border-t border-border-subtle/70 pt-1 grid grid-cols-3 font-bold text-xs">
                              <span>Total</span>
                              <span className="text-right text-rose-600">{fmtC(impostosMensalB6)}</span>
                              <span className="text-right text-rose-700">{fmtC(impostosMensalB6 * qtdMeses)}</span>
                            </div>
                          </div>
                        }>
                          <span className="text-[9px] text-rose-400 font-semibold cursor-help border-b border-dashed border-rose-400/40 mt-1 inline-block">
                            Imp/mês: {fmtC(impostosMensalB6)}
                          </span>
                        </Tooltip>
                      )}
                      {!form.havera_manutencao && (
                        <span className="text-[9px] text-brand-warning mt-1 font-semibold">
                          Inativo
                        </span>
                      )}
                    </div>

                    {/* Faturamento Total */}
                    <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-3 flex flex-col justify-center relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-brand-primary/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
                      <span className="block text-[9px] text-text-primary font-bold uppercase tracking-wider mb-1 relative z-10">Faturamento Total</span>
                      <div className="text-lg font-black text-brand-primary tracking-tight relative z-10">{fmtC(faturamentoTotal)}</div>
                      <div className="text-[9px] font-medium text-text-muted mt-1 relative z-10 flex flex-col">
                        <span>Venda {form.havera_manutencao && `+ Manut. (${qtdMeses || '—'}m)`}</span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2 — Fechamento: Lucro da Venda + Lucro Manutenção 12m */}
                  <div className="grid grid-cols-1 gap-3 pt-3 border-t border-border-subtle">
                    {/* Lucro da Venda */}
                    <div className={`rounded-xl p-3 border flex justify-between items-start gap-4 ${lucroVenda >= 0 ? 'bg-brand-success/5 border-brand-success/20' : 'bg-brand-danger/5 border-brand-danger/20'}`}>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Lucro Venda</span>
                        <div className={`text-base font-black truncate ${lucroVenda >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>{fmtC(lucroVenda)}</div>
                        <div className="text-[9px] text-text-muted mt-0.5 truncate">
                          Itens {fmtC(lucroB4)} + Inst {fmtC(lucroB5)}
                        </div>
                        <div className="text-[9px] text-text-muted/70 mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono">
                          <span className="truncate">Fat: {fmtC(totalVenda)}</span>
                          <span className="truncate">Aq: {fmtC(custoB4 + custoB5)}</span>
                          <Tooltip variant="light" content={
                            <div className="w-56 space-y-1.5 text-text-secondary p-1">
                              <div className="font-bold text-text-primary border-b border-border-subtle/70 pb-1 mb-1 text-xs">Impostos de Venda (B4+B5)</div>
                              {taxFields.map(t => {
                                const val = taxLabelB45[t]?.total || 0;
                                const label = t === 'icms' && isInterstate ? 'icms 12% Venda' : t.toUpperCase();
                                if (val === 0) return null;
                                return (
                                  <div key={t} className="flex justify-between text-[11px] font-mono">
                                    <span>{label}:</span>
                                    <span className="text-rose-600 font-medium">{fmtC(val)}</span>
                                  </div>
                                );
                              })}
                              {isInterstate && icmsStCompraDeduction > 0 && (
                                <div className="flex justify-between text-[11px] font-mono text-emerald-600">
                                  <span>icms st (compra):</span>
                                  <span>- ({fmtC(icmsStCompraDeduction)})</span>
                                </div>
                              )}
                              <div className="border-t border-border-subtle/70 pt-1 flex justify-between font-bold text-[11px] font-mono">
                                <span>Total:</span>
                                <span className="text-rose-700">{fmtC(impostosB45)}</span>
                              </div>
                            </div>
                          }>
                            <span className="truncate cursor-help border-b border-dashed border-text-muted/40">
                              Imp: {fmtC(impostosB45)}
                            </span>
                          </Tooltip>
                          <span className="truncate">Desp: {fmtC(despVenda)}</span>
                        </div>
                      </div>
                      <div className={`shrink-0 text-right px-2.5 py-1 rounded-lg ${margemVenda >= 15 ? 'bg-brand-success/10 text-brand-success' : margemVenda >= 5 ? 'bg-amber-500/10 text-amber-500' : 'bg-brand-danger/10 text-brand-danger'}`}>
                        <span className="block text-[8px] font-bold uppercase tracking-wider mb-0.5">Margem</span>
                        <span className="text-sm font-black">{margemVenda.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Lucro Manutenção 12m */}
                    <div className={`rounded-xl p-3 border flex justify-between items-start gap-4 ${lucroManutencao12m >= 0 ? 'bg-brand-success/5 border-brand-success/20' : 'bg-brand-danger/5 border-brand-danger/20'}`}>
                      <div className="min-w-0 flex-1">
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Lucro Manut. (12m)</span>
                        <div className={`text-base font-black truncate ${lucroManutencao12m >= 0 ? 'text-brand-success' : 'text-brand-danger'}`}>{fmtC(lucroManutencao12m)}</div>
                        <div className="text-[9px] text-text-muted mt-0.5 font-mono truncate">
                          {fmtC(lucroMensalB6)}/mês em 12m
                        </div>
                      </div>
                      <div className={`shrink-0 text-right px-2.5 py-1 rounded-lg ${margemManut12m >= 15 ? 'bg-brand-success/10 text-brand-success' : margemManut12m >= 5 ? 'bg-amber-500/10 text-amber-500' : 'bg-brand-danger/10 text-brand-danger'}`}>
                        <span className="block text-[8px] font-bold uppercase tracking-wider mb-0.5">Margem</span>
                        <span className="text-sm font-black">{margemManut12m.toFixed(1)}%</span>
                      </div>
                    </div>

                    {/* Fator Geral Média */}
                    <div className="rounded-xl p-3 flex items-center justify-between border bg-bg-subtle border-border-subtle font-medium">
                      <div>
                        <span className="block text-[9px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Fator Geral (Média)</span>
                        <div className="text-base font-black text-text-primary">
                          {(((Number(form.fator_margem_locacao) || 0) + (Number(form.fator_manutencao) || 0)) / 2).toFixed(4)}
                        </div>
                      </div>
                    </div>

                    {/* Target Margin Solver Summary */}
                    {renderTargetSolverHUD()}
                  </div>
                </div>
              );
            }

            // ── Bloco de Cards — Locação / Comodato ──
            if (form.tipo_contrato === 'INSTALACAO') return null;

            const custoAq = financials?.summary?.custo_aquisicao_kit || 0;
            const custo_produtos = financials?.summary?.custo_aquisicao_produtos || 0;
            const custo_servicos = financials?.summary?.custo_aquisicao_servicos || 0;

            const percInst = Number(form.percentual_instalacao) || 0;
            const instalacaoEmbutida = (form.instalacao_inclusa && percInst > 0)
              ? custoAq * (percInst / 100)
              : 0;
            const instalacaoLabel = (form.instalacao_inclusa && percInst > 0)
              ? `Embutido (${percInst}% aq.)`
              : 'Sem inst. embutida';

            const fatorMargem = Number(form.fator_margem_locacao) || 1;
            const txLocDecimal = financials?.summary?.tx_locacao || 0;
            const txLocPerc = txLocDecimal * 100;
            const locacaoMensal = ((custoAq + instalacaoEmbutida) * fatorMargem) * txLocDecimal;

            const taxaManutAnual = Number(form.taxa_manutencao_anual) || 0;
            const txManutPerc = taxaManutAnual / 12;
            const manutencaoCalculada = ((custoAq + instalacaoEmbutida) * fatorMargem) * (txManutPerc / 100);
            const custoOpMensal = financials?.summary?.custo_operacional_mensal_kit || 0;
            const fatorManut = Number(form.fator_manutencao) || 1;
            const manutencaoMensal = form.manutencao_inclusa ? manutencaoCalculada : (custoOpMensal * fatorManut);
            const manutencaoLegenda = form.manutencao_inclusa
              ? `TX: ${txManutPerc.toFixed(4)}%`
              : (fatorManut !== 1
                ? `FM: ${fatorManut.toFixed(2)} x Custo`
                : (custoOpMensal > 0 ? 'Custos Operacionais' : 'Sem custos op.'));

            const vendaUnitMonitoramento = financials?.summary?.venda_unit_monitoramento || 0;
            const receitaTotalMonitoramento = financials?.summary?.receita_total_monitoramento || 0;
            const custoTotalMonitoramento = financials?.summary?.custo_total_monitoramento || 0;
            const lucroTotalMonitoramento = financials?.summary?.lucro_total_monitoramento || 0;

            const faturamentoMensal = locacaoMensal + manutencaoMensal + vendaUnitMonitoramento;
            const mesesFaturados = financials?.summary?.prazo_mensalidades || 0;

            const valorComissaoLocacao = financials?.summary?.valor_comissao_locacao || 0;
            // const impostoInstalacao = financials?.summary?.imposto_instalacao || 0;
            // const totalInvestimento = custoAq + valorComissaoLocacao + impostoInstalacao;
            // const impostosMensais = financials?.summary?.valor_impostos || 0;
            // const totalReceitaContrato = (faturamentoMensal * mesesFaturados) + (form.instalacao_inclusa ? instalacaoEmbutida : 0);
            const roiMeses = financials?.summary?.roi_meses || 0;
            const roiEquipamentoMeses = financials?.summary?.roi_equipamento_meses || 0;

            const tipoLabel = form.tipo_contrato === 'LOCACAO' ? 'Locação' : 'Comodato';

            if (!isCalcExpanded) {
              return (
                <>
                  {/* Desktop collapsed */}
                  <button
                    type="button"
                    onClick={() => setIsCalcExpanded(true)}
                    className="hidden lg:flex flex-col items-center justify-center gap-4 bg-bg-surface border border-border-subtle hover:bg-bg-subtle/50 transition-all shadow-sm rounded-2xl py-6 px-3 w-12 cursor-pointer group animate-fade-in"
                    title="Expandir Cálculo Simultâneo"
                  >
                    <Calculator className="w-5 h-5 text-brand-primary group-hover:scale-110 transition-transform" />
                    <div className="[writing-mode:vertical-lr] rotate-180 text-[10px] font-bold uppercase tracking-widest text-text-muted whitespace-nowrap">
                      Cálculo Simultâneo
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-muted mt-2" />
                  </button>
                  {/* Mobile collapsed */}
                  <button
                    type="button"
                    onClick={() => setIsCalcExpanded(true)}
                    className="w-full lg:hidden flex items-center justify-between bg-bg-surface border border-border-subtle hover:bg-bg-subtle/50 transition-all shadow-sm rounded-2xl p-4 cursor-pointer"
                  >
                    <span className="text-xs font-bold text-text-primary tracking-tight flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-brand-primary" />
                      Cálculo Simultâneo — {tipoLabel}
                    </span>
                    <ChevronDown className="w-4 h-4 text-text-muted" />
                  </button>
                </>
              );
            }

            return (
              <div className="bg-bg-surface/95 backdrop-blur-xl border border-border-subtle shadow-md rounded-2xl p-4 xl:p-5 transition-all">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border-subtle pb-3 mb-3">
                  <h3 className="text-sm font-bold text-text-primary tracking-tight flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-brand-primary" />
                    Cálculo Simultâneo — {tipoLabel}
                  </h3>
                  <div className="flex items-center gap-3">
                    {isCalculating ? (
                      <span className="flex items-center text-[10px] font-semibold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-full animate-pulse gap-1">
                        <Calculator className="w-3 h-3 animate-pulse" /> Calculando
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium text-brand-success bg-brand-success/10 border border-brand-success/20 px-2 py-1 rounded-full">Atualizado</span>
                    )}
                    <button 
                      type="button" 
                      onClick={() => setIsCalcExpanded(false)}
                      className="text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                      title="Recolher painel"
                    >
                      <ChevronLeft className="w-4 h-4 hidden lg:block" />
                      <ChevronUp className="w-4 h-4 lg:hidden" />
                    </button>
                  </div>
                </div>

                {/* Collapsible Rules (Política Comercial) */}
                <div className="mb-4 border border-border-subtle rounded-lg overflow-hidden">
                  <button 
                    type="button"
                    onClick={() => setIsPolicyExpanded(!isPolicyExpanded)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-bg-subtle text-xs font-bold text-text-secondary border-b border-border-subtle cursor-pointer hover:bg-bg-deep/50 transition-colors"
                  >
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Regras de Negócio</span>
                    <div className="flex items-center gap-2">
                      {activePolicy && !isPolicyExpanded && (
                        <span className="text-[9px] font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded-full">
                          {activePolicy.nome_politica} ({activePolicy.comissao_percentual}%)
                        </span>
                      )}
                      {isPolicyExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </div>
                  </button>

                  {isPolicyExpanded && (
                    <div className="p-3 bg-bg-surface">
                      {activePolicy ? (
                        <div className="flex items-center gap-3 px-3 py-2 bg-brand-primary/5 border border-brand-primary/20 rounded-lg">
                          <div className="w-6 h-6 rounded-full bg-brand-primary flex items-center justify-center shrink-0">
                            <span className="text-white text-[10px] font-black">P</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-0.5">Política Comercial Ativa</p>
                            <p className="text-xs font-bold text-brand-primary truncate">{activePolicy.nome_politica}</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[9px] text-text-muted uppercase tracking-wide">Fator Mín.</p>
                            <p className="text-xs font-bold text-text-primary">{Number(activePolicy.fator_limite).toFixed(4)}</p>
                          </div>
                          <div className="shrink-0 text-right border-l border-brand-primary/20 pl-3">
                            <p className="text-[9px] text-text-muted uppercase tracking-wide">Comissão</p>
                            <p className="text-xs font-bold text-brand-primary">{activePolicy.comissao_percentual}%</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 bg-bg-subtle border border-border-subtle rounded-lg">
                          <span className="text-[10px] text-text-muted italic">Nenhuma política comercial ativa para o seu cargo.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cards Grid (Compact 2-columns) */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Card 1: Custo de Aquisição */}
                  <div className="bg-bg-subtle border border-border-subtle rounded-xl p-3 flex flex-col justify-center">
                    <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1">Custo de Aquisição</span>
                    <div className="text-base font-bold text-text-primary tabular-nums">{fmtC(custoAq)}</div>
                    <div className="text-[9px] text-text-muted mt-1.5 space-y-0.5 font-mono">
                      <div className="flex justify-between gap-1"><span>Prods:</span><span>{fmtC(custo_produtos)}</span></div>
                      <div className="flex justify-between gap-1"><span>Servs:</span><span>{fmtC(custo_servicos)}</span></div>
                    </div>
                  </div>

                  {/* Card 1.5: Comissão */}
                  <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-3 flex flex-col justify-center">
                    <span className="block text-[9px] text-brand-primary font-bold uppercase tracking-wider mb-1">Comissão (%)</span>
                    <div className="text-base font-bold text-brand-primary tabular-nums">{fmtC(valorComissaoLocacao)}</div>
                    <div className="text-[9px] text-brand-primary/80 mt-1.5 font-medium leading-tight">
                      {Number(form.perc_comissao || 0).toFixed(2)}% s/ base
                    </div>
                  </div>

                  {/* Card 2: Instalação */}
                  <div className={`border rounded-xl p-3 flex flex-col justify-center ${instalacaoEmbutida > 0 ? 'bg-amber-500/5 border-amber-500/20' : 'bg-bg-subtle border-border-subtle opacity-60'}`}>
                    <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1">Instalação</span>
                    <div className={`text-base font-bold tabular-nums ${instalacaoEmbutida > 0 ? 'text-amber-500' : 'text-text-muted'}`}>
                      {fmtC(instalacaoEmbutida)}
                    </div>
                    <div className={`text-[9px] mt-1.5 font-medium ${instalacaoEmbutida > 0 ? 'text-amber-500/80' : 'text-text-muted'}`}>
                      {instalacaoLabel}
                    </div>
                  </div>

                  {/* Card 3: Locação Mensal */}
                  <div className={`border rounded-xl p-3 flex flex-col justify-center relative overflow-hidden ${locacaoMensal > 0 ? 'bg-brand-primary/5 border-brand-primary/20' : 'bg-bg-subtle border-border-subtle'}`}>
                    {locacaoMensal > 0 && (
                      <div className="absolute top-0 right-0 w-14 h-14 bg-brand-primary/10 rounded-full blur-xl -mr-3 -mt-3 pointer-events-none" />
                    )}
                    <span className={`block text-[9px] font-bold uppercase tracking-wider mb-1 relative z-10 ${locacaoMensal > 0 ? 'text-brand-primary' : 'text-text-muted'}`}>
                      Locação Mensal
                    </span>
                    <div className={`text-base font-bold tabular-nums relative z-10 ${locacaoMensal > 0 ? 'text-brand-primary' : 'text-text-muted'}`}>
                      {fmtC(locacaoMensal)}
                    </div>
                    <div className="text-[9px] text-text-muted mt-1.5 relative z-10 space-y-0.5">
                      <div>FM: {fatorMargem.toFixed(2)} | Tx: {txLocPerc.toFixed(2)}%</div>
                      <div className="text-text-muted/70">{mesesFaturados}x meses</div>
                    </div>
                  </div>

                  {/* Card 4: Manutenção (Mês) */}
                  <div className={`border rounded-xl p-3 flex flex-col justify-center ${manutencaoMensal > 0 ? 'bg-orange-500/5 border-orange-500/20' : 'bg-bg-subtle border-border-subtle opacity-60'}`}>
                    <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1">Manutenção (Mês)</span>
                    <div className={`text-base font-bold tabular-nums ${manutencaoMensal > 0 ? 'text-orange-500' : 'text-text-muted'}`}>
                      {fmtC(manutencaoMensal)}
                    </div>
                    <div className={`text-[9px] mt-1.5 font-medium ${manutencaoMensal > 0 ? 'text-orange-500/70' : 'text-text-muted'}`}>
                      {manutencaoLegenda}
                    </div>
                    {form.manutencao_inclusa && (
                      <div className="text-[9px] mt-0.5 text-text-muted/60 italic">Bloco 6 ignorado</div>
                    )}
                  </div>

                  {/* Card Monitoramento */}
                  {vendaUnitMonitoramento > 0 && (
                    <div className="border rounded-xl p-3 flex flex-col justify-center bg-cyan-500/5 border-cyan-500/20">
                      <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1">Monitoramento</span>
                      <div className="text-base font-bold tabular-nums text-cyan-500">
                        {fmtC(vendaUnitMonitoramento)}
                      </div>
                      <div className="text-[9px] text-text-muted mt-1.5 space-y-0.5 font-mono">
                        <div className="flex justify-between gap-1"><span>Rec:</span><span>{fmtC(receitaTotalMonitoramento)}</span></div>
                        <div className="flex justify-between gap-1"><span>Cust:</span><span>{fmtC(custoTotalMonitoramento)}</span></div>
                        <div className="flex justify-between gap-1"><span>Luc:</span><span className="text-brand-success">{fmtC(lucroTotalMonitoramento)}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Card 5: Faturamento Mensal */}
                  <div className={`border rounded-xl p-3 flex flex-col justify-center relative overflow-hidden ${faturamentoMensal > 0 ? 'bg-brand-success/5 border-brand-success/20' : 'bg-bg-subtle border-border-subtle'}`}>
                    {faturamentoMensal > 0 && (
                      <div className="absolute top-0 right-0 w-14 h-14 bg-brand-success/10 rounded-full blur-xl -mr-3 -mt-3 pointer-events-none" />
                    )}
                    <span className={`block text-[9px] font-bold uppercase tracking-wider mb-1 relative z-10 ${faturamentoMensal > 0 ? 'text-brand-success' : 'text-text-muted'}`}>
                      Faturamento Mensal
                    </span>
                    <div className={`text-base font-black tabular-nums tracking-tight relative z-10 ${faturamentoMensal > 0 ? 'text-brand-success' : 'text-text-muted'}`}>
                      {fmtC(faturamentoMensal)}
                    </div>
                    <div className="text-[9px] text-text-muted mt-1.5 relative z-10 space-y-0.5">
                      <div className="flex justify-between gap-1"><span>Loc:</span><span>{fmtC(locacaoMensal)}</span></div>
                      <div className="flex justify-between gap-1"><span>Manut:</span><span>{fmtC(manutencaoMensal)}</span></div>
                      {vendaUnitMonitoramento > 0 && (
                        <div className="flex justify-between gap-1"><span>Monit:</span><span>{fmtC(vendaUnitMonitoramento)}</span></div>
                      )}
                    </div>
                  </div>

                  {/* Card 6: ROI Previsto */}
                  <div className={`border rounded-xl p-3 flex flex-col justify-center overflow-hidden relative ${roiMeses > 0 ? 'bg-cyan-500/5 border-cyan-500/20 shadow-sm' : 'bg-bg-subtle border-border-subtle'}`}>
                    {roiMeses > 0 && (
                      <div className="absolute top-0 right-0 w-20 h-20 bg-cyan-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
                    )}
                    <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1 relative z-10">ROI Previsto</span>
                    <div className={`text-base font-black tabular-nums tracking-tighter relative z-10 ${roiMeses > 0 ? 'text-cyan-500' : 'text-text-muted'}`}>
                      {roiMeses > 0 ? `${roiMeses.toFixed(1)} meses` : '—'}
                    </div>
                  </div>

                  {/* Card 6.5: ROI DE EQUIPAMENTO */}
                  {(form.tipo_contrato === 'LOCACAO' || form.tipo_contrato === 'COMODATO') && (
                    <div className={`border rounded-xl p-3 flex flex-col justify-center overflow-hidden relative ${roiEquipamentoMeses > 0 ? 'bg-indigo-500/5 border-indigo-500/20 shadow-sm' : 'bg-bg-subtle border-border-subtle'}`}>
                      {roiEquipamentoMeses > 0 && (
                        <div className="absolute top-0 right-0 w-20 h-20 bg-indigo-500/10 rounded-full blur-2xl -mr-6 -mt-6 pointer-events-none" />
                      )}
                      <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1 relative z-10">ROI Equipamento</span>
                      <div className={`text-base font-black tabular-nums tracking-tighter relative z-10 ${roiEquipamentoMeses > 0 ? 'text-indigo-500' : 'text-text-muted'}`}>
                        {roiEquipamentoMeses > 0 ? `${roiEquipamentoMeses.toFixed(1)} meses` : '—'}
                      </div>
                    </div>
                  )}

                  {/* Card 7: FATOR GERAL */}
                  <div className="border rounded-xl p-3 flex flex-col justify-center bg-bg-subtle border-border-subtle shadow-sm relative overflow-hidden">
                    <span className="block text-[9px] text-text-muted font-bold uppercase tracking-wider mb-1">Fator Geral</span>
                    <div className="text-base font-black text-text-primary tabular-nums">
                      {(((Number(form.fator_margem_locacao) || 0) + (Number(form.fator_manutencao) || 0)) / 2).toFixed(4)}
                    </div>
                  </div>

                  {/* Target Margin Solver Summary */}
                  {renderTargetSolverHUD()}
                </div>
              </div>
            );
          })()}
        </aside>

        {/* RIGHT FORM SECTIONS */}
        <div className="flex-grow flex-1 w-full min-w-0 space-y-8">
          <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-border-subtle">
              1. Informações Gerais
            </h2>

            {licitacaoItemDetails && (
              <div className="mb-6 p-4 bg-brand-primary/5 border border-brand-primary/20 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <span className="text-[10px] text-brand-primary uppercase font-bold tracking-wider block mb-1">Item de Edital Vinculado</span>
                  <h4 className="text-sm font-bold text-text-primary">
                    Item {licitacaoItemDetails.codigo} — {licitacaoItemDetails.nome}
                  </h4>
                  {licitacaoItemDetails.descricao && (
                    <p className="text-text-muted text-xs mt-1">{licitacaoItemDetails.descricao}</p>
                  )}
                </div>
                <div className="flex gap-4 shrink-0 text-right">
                  <div>
                    <span className="text-[9px] text-text-muted uppercase block font-bold">Fornecimento</span>
                    <span className="text-xs font-semibold text-text-primary block mt-0.5">{licitacaoItemDetails.tipo_fornecimento || 'Unitário'}</span>
                  </div>
                  {licitacaoItemDetails.tipo_fornecimento === 'Mensal' && (
                    <div>
                      <span className="text-[9px] text-text-muted uppercase block font-bold">Meses</span>
                      <span className="text-xs font-semibold text-text-primary block mt-0.5">{licitacaoItemDetails.total_meses}m</span>
                    </div>
                  )}
                  <div>
                    <span className="text-[9px] text-text-muted uppercase block font-bold">Qtd. Base</span>
                    <span className="text-xs font-semibold text-text-primary block mt-0.5">{Number(licitacaoItemDetails.quantidade)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] text-brand-primary uppercase block font-bold">Qtd. Total</span>
                    <span className="text-xs font-bold text-brand-primary block mt-0.5">{Number(licitacaoItemDetails.quantidade_total ?? licitacaoItemDetails.quantidade)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Nome do Kit</label>
                <Input
                  value={form.nome_kit}
                  onChange={(e) => handleInputChange('nome_kit', e.target.value)}
                  placeholder="Ex: Kit CFTV Enterprise 36x"
                  className="w-full text-lg font-medium"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-1">Descrição (Opcional)</label>
                <textarea
                  value={form.descricao_kit}
                  onChange={(e) => handleInputChange('descricao_kit', e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50 min-h-[100px]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tipo de Modalidade</label>
                <select
                  value={form.tipo_contrato}
                  onChange={(e) => handleInputChange('tipo_contrato', e.target.value)}
                  className="w-full rounded-lg border border-border-strong bg-bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                >
                  <option value="LOCACAO">Locação</option>
                  <option value="COMODATO">Comodato</option>
                  <option value="VENDA_EQUIPAMENTOS">Venda de Equipamentos</option>
                  <option value="INSTALACAO">Apenas Instalação</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Qtd. de Kits Iguais</label>
                <Input type="number" value={form.quantidade_kits} onChange={(e) => handleInputChange('quantidade_kits', parseFloat(e.target.value) || 1)} className="w-full" />
              </div>
              {['VENDA_EQUIPAMENTOS', 'LOCACAO', 'COMODATO', 'INSTALACAO'].includes(form.tipo_contrato) && (
                <div>
                  <label className="block text-sm font-medium mb-1">Forma de Execução Principal <span className="text-[10px] text-brand-primary bg-brand-primary/10 px-1 rounded ml-1">Para Serviços Próprios</span></label>
                  <select
                    value={form.forma_execucao || 'H. NORMAL'}
                    onChange={(e) => handleInputChange('forma_execucao', e.target.value)}
                    className="w-full rounded-lg border border-border-strong bg-bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/50"
                  >
                    <option value="H. NORMAL">H. NORMAL</option>
                    <option value="H. EXTRA">H. EXTRA</option>
                    <option value="H.E. Ad. Noturno">H.E. Ad. Noturno</option>
                    <option value="H.E. Dom./Fer.">H.E. Dom./Fer.</option>
                    <option value="H.E. Dom./Fer. Not.">H.E. Dom./Fer. Not.</option>
                  </select>
                </div>
              )}
            </div>
          </section>

          <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-border-subtle">
              2. Prazos e Parâmetros Financeiros
            </h2>
            {/* GRUPO 1: Parâmetros Base */}
            <div className={`grid grid-cols-1 ${form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? 'md:grid-cols-4' : 'md:grid-cols-4'} gap-6 mb-8`}>
              {form.tipo_contrato !== 'VENDA_EQUIPAMENTOS' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Prazo Contrato (Meses)</label>
                    <Input type="number" value={form.prazo_contrato_meses} onChange={(e) => handleInputChange('prazo_contrato_meses', parseFloat(e.target.value) || 0)} className="w-full text-lg font-medium" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Carência/Instalação (Meses)</label>
                    <Input type="number" value={form.prazo_instalacao_meses} onChange={(e) => handleInputChange('prazo_instalacao_meses', parseFloat(e.target.value) || 0)} className="w-full" />
                    <p className="text-xs text-text-muted mt-1">Meses sem locação.</p>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium mb-1">
                  {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? 'Fator Margem (Produtos)' : 'Fator Margem'}
                </label>
                <Decimal4Input
                  value={form.fator_margem_locacao}
                  onChange={(val: number) => handleInputChange('fator_margem_locacao', val)}
                  onBlur={(val: number) => handleFactorBlur('fator_margem_locacao', val)}
                />
              </div>

              {(form.tipo_contrato === 'LOCACAO' || form.tipo_contrato === 'COMODATO') && !form.manutencao_inclusa && (
                <div>
                  <label className="block text-sm font-medium mb-1">Fator Manutenção</label>
                  <Decimal4Input
                    value={form.fator_manutencao}
                    onChange={(val: number) => handleInputChange('fator_manutencao', val)}
                    onBlur={(val: number) => handleFactorBlur('fator_manutencao', val)}
                    placeholder="Ex: 1.7000"
                  />
                </div>
              )}

              {(form.tipo_contrato === 'LOCACAO' || form.tipo_contrato === 'COMODATO') && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fator Monitoramento</label>
                    <Decimal4Input
                      value={form.fator_monitoramento}
                      onChange={(val: number) => handleInputChange('fator_monitoramento', val)}
                      onBlur={(val: number) => handleFactorBlur('fator_monitoramento', val)}
                      placeholder="Ex: 1.0000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" title="Em % sobre a venda (Custo × Fator).">Comissão (%)</label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      value={form.perc_comissao} 
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        if (activePolicy && val > Number(activePolicy.comissao_percentual || 0)) {
                          setAlertMessage(`O percentual de comissão excede o limite da política comercial ativa (${activePolicy.comissao_percentual}%).`);
                          handleInputChange('perc_comissao', Number(activePolicy.comissao_percentual || 0));
                        } else {
                          handleInputChange('perc_comissao', val);
                        }
                      }} 
                      className="w-full" 
                    />
                  </div>
                </>
              )}

              {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1 truncate" title="Fator Margem p/ Serviços e Licenças inseridos no Bloco 4.">Fator Margem Serviços (Produtos)</label>
                    <Decimal4Input
                      value={form.fator_margem_servicos_produtos}
                      onChange={(val: number) => handleInputChange('fator_margem_servicos_produtos', val)}
                      onBlur={(val: number) => handleFactorBlur('fator_margem_servicos_produtos', val)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fator Margem Instalação</label>
                    <Decimal4Input
                      value={form.fator_margem_instalacao}
                      onChange={(val: number) => handleInputChange('fator_margem_instalacao', val)}
                      onBlur={(val: number) => handleFactorBlur('fator_margem_instalacao', val)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fator Margem Manutenção</label>
                    <Decimal4Input
                      value={form.fator_margem_manutencao}
                      onChange={(val: number) => handleInputChange('fator_margem_manutencao', val)}
                      onBlur={(val: number) => handleFactorBlur('fator_margem_manutencao', val)}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" title="Em % sobre a venda.">Frete Venda (%)</label>
                    <Input type="number" step="0.01" value={form.perc_frete_venda} onChange={(e) => handleInputChange('perc_frete_venda', parseFloat(e.target.value) || 0)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" title="Em % sobre a venda.">Despesas Adm. (%)</label>
                    <Input type="number" step="0.01" value={form.perc_despesas_adm} onChange={(e) => handleInputChange('perc_despesas_adm', parseFloat(e.target.value) || 0)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1" title="Em % sobre a venda.">Comissão (%)</label>
                    <Input type="number" step="0.01" value={form.perc_comissao} onChange={(e) => handleInputChange('perc_comissao', parseFloat(e.target.value) || 0)} className="w-full" />
                  </div>
                </>
              )}

              {form.tipo_contrato !== 'VENDA_EQUIPAMENTOS' && (
                <div>
                  <label className="block text-sm font-medium mb-1">Taxa Juros a.m (%)</label>
                  <Input type="number" step="0.01" value={form.taxa_juros_mensal} onChange={(e) => handleInputChange('taxa_juros_mensal', parseFloat(e.target.value) || 0)} className="w-full" />
                </div>
              )}

              {form.licitacao_id && (
                <div>
                  <label className="block text-sm font-medium mb-1">Margem Mínima Desejada (%)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.margem_minima_desejada ?? ''}
                    onChange={(e) => {
                      const valStr = e.target.value;
                      const val = valStr === '' ? '' : parseFloat(valStr);
                      handleInputChange('margem_minima_desejada', val);
                    }}
                    onBlur={() => {
                      if (form.margem_minima_desejada !== '' && form.margem_minima_desejada !== undefined && form.margem_minima_desejada !== null) {
                        const targetMargin = Number(form.margem_minima_desejada);
                        const currentMargin = financials?.summary?.margem_kit ?? 0;
                        if (targetMargin > currentMargin) {
                          setAlertMessage("A margem mínima desejada não pode ser maior que a margem atual do Kit.");
                          handleInputChange('margem_minima_desejada', '');
                        }
                      }
                    }}
                    placeholder="Ex: 30.00"
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* GRUPO 2: Inclusões (Checkboxes Options) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-6 border-t border-border-subtle">
              <div className="bg-bg-subtle p-5 rounded-xl border border-border-subtle flex flex-col justify-start">
                <div className="flex items-center space-x-3 mb-4">
                  <input
                    type="checkbox"
                    id="chk-instalacao"
                    checked={form.instalacao_inclusa}
                    onChange={(e) => handleInputChange('instalacao_inclusa', e.target.checked)}
                    className="w-5 h-5 rounded border-border-strong text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="chk-instalacao" className="text-sm font-bold text-text-primary cursor-pointer">Embutir Custo de Instalação</label>
                </div>
                {form.instalacao_inclusa && (
                  <div className="pl-8 pt-4 border-t border-border-subtle/50">
                    <label className="block text-sm font-medium mb-1">% de Instalação</label>
                    <Input type="number" step="0.01" value={form.percentual_instalacao} onChange={(e) => handleInputChange('percentual_instalacao', e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-full" placeholder="Ex: 15.00" />
                    <p className="text-[10px] text-text-muted mt-1">Calculado sobre o custo de aquisição final do kit.</p>
                  </div>
                )}
              </div>

              <div className="bg-bg-subtle p-5 rounded-xl border border-border-subtle flex flex-col justify-start">
                {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                  <>
                    <div className="flex items-center space-x-3 mb-4">
                      <input
                        type="checkbox"
                        id="chk-havera-manutencao"
                        checked={form.havera_manutencao}
                        onChange={(e) => handleInputChange('havera_manutencao', e.target.checked)}
                        className="w-5 h-5 rounded border-border-strong text-brand-primary focus:ring-brand-primary"
                      />
                      <label htmlFor="chk-havera-manutencao" className="text-sm font-bold text-text-primary cursor-pointer">Haverá Manutenção Mensal</label>
                    </div>
                    {form.havera_manutencao && (
                      <div className="pl-8 pt-4 border-t border-border-subtle/50">
                        <label className="block text-sm font-medium mb-1">Qtd. Meses de Manutenção</label>
                        <Input type="number" step="1" maxLength={3} value={form.qtd_meses_manutencao} onChange={(e) => handleInputChange('qtd_meses_manutencao', e.target.value === '' ? '' : parseInt(e.target.value))} className="w-full" placeholder="Ex: 12" />
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center space-x-3 mb-4">
                      <input
                        type="checkbox"
                        id="chk-manutencao"
                        checked={form.manutencao_inclusa}
                        onChange={(e) => handleInputChange('manutencao_inclusa', e.target.checked)}
                        className="w-5 h-5 rounded border-border-strong text-brand-primary focus:ring-brand-primary"
                      />
                      <label htmlFor="chk-manutencao" className="text-sm font-bold text-text-primary cursor-pointer">Manutenção Inclusa na Mensalidade</label>
                    </div>
                    {form.manutencao_inclusa && (
                      <div className="pl-8 pt-4 border-t border-border-subtle/50 grid grid-cols-1 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Taxa Manutenção a.a (%)</label>
                          <Input type="number" step="0.01" value={form.taxa_manutencao_anual} onChange={(e) => handleInputChange('taxa_manutencao_anual', parseFloat(e.target.value) || 0)} className="w-full" placeholder="Ex: 20.00" />
                          <p className="text-[10px] text-text-muted mt-1">% s/ custo total anual.</p>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

          <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-border-subtle flex justify-between items-center">
              <span>3. Impostos sobre Faturamento (%)</span>
              {['LOCACAO', 'COMODATO'].includes(form.tipo_contrato) && (
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="chk-faturamento-separado"
                    checked={form.faturamento_servico_separado}
                    onChange={(e) => handleInputChange('faturamento_servico_separado', e.target.checked)}
                    className="w-4 h-4 rounded border-border-strong text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="chk-faturamento-separado" className="text-sm font-semibold text-text-primary cursor-pointer">
                    Faturamento Serviço Separado
                  </label>
                </div>
              )}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-6">
              {['aliq_pis', 'aliq_cofins', 'aliq_csll', 'aliq_irpj', 'aliq_iss', 'aliq_icms'].map(f => (
                <div key={f}>
                  <label className="block text-xs font-medium text-text-secondary mb-1 uppercase">{f.split('_')[1]}</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={(form as any)[f]}
                    onChange={(e) => handleInputChange(f as keyof KitFormValues, parseFloat(e.target.value) || 0)}
                    readOnly={form.tipo_contrato === 'VENDA_EQUIPAMENTOS'}
                    disabled={form.tipo_contrato === 'VENDA_EQUIPAMENTOS'}
                    className={`w-full ${form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? 'bg-bg-deep/50 text-text-muted cursor-not-allowed' : ''}`}
                    title={form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? 'Imposto carregado automaticamente dos Parâmetros de Venda' : ''}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 pb-4 border-b border-border-subtle gap-4">
              <div className="flex items-center gap-4">
                <h2 className="text-xl font-semibold">4. Itens do kit (produtos + serviços)</h2>
                {form.tipo_contrato !== 'VENDA_EQUIPAMENTOS' && (
                  <div className="flex items-center gap-1 bg-bg-deep/60 p-0.5 rounded-lg border border-border-subtle shrink-0">
                    <button
                      type="button"
                      onClick={() => handleInputChange('considerar_st_ou_difal', 'DIFAL')}
                      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                        form.considerar_st_ou_difal === 'DIFAL'
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      DIFAL
                    </button>
                    <button
                      type="button"
                      onClick={() => handleInputChange('considerar_st_ou_difal', 'ST')}
                      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${
                        form.considerar_st_ou_difal === 'ST'
                          ? 'bg-brand-primary text-white shadow-sm'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      ST
                    </button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                {form.items.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setShowProductSearch(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Produto
                  </Button>
                )}
                {['VENDA_EQUIPAMENTOS', 'LOCACAO', 'COMODATO', 'INSTALACAO'].includes(form.tipo_contrato) && form.items.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => {
                    if (!form.forma_execucao) {
                      handleInputChange('forma_execucao', 'H. NORMAL');
                    }
                    setShowItemServiceSearch(true);
                  }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Serviço
                  </Button>
                )}
              </div>
            </div>

            {form.items.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-bg-deep/50 hover:bg-bg-deep/80 transition-colors">
                <div className="flex items-center gap-3">
                  <Button variant="outline" type="button" onClick={() => setShowProductSearch(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Buscar Lupa de Produtos
                  </Button>
                  {['VENDA_EQUIPAMENTOS', 'LOCACAO', 'COMODATO', 'INSTALACAO'].includes(form.tipo_contrato) && (
                    <Button variant="outline" type="button" onClick={() => {
                      if (!form.forma_execucao) {
                        handleInputChange('forma_execucao', 'H. NORMAL');
                      }
                      setShowItemServiceSearch(true);
                    }}>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Serviço Próprio
                    </Button>
                  )}
                </div>
                <p className="text-sm text-text-muted mt-3">Pesquise para compor a lista do kit</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border-subtle">
                <table className="w-full text-sm text-left">
                  <thead className="bg-bg-deep/50 text-text-muted font-medium border-b border-border-subtle">
                    <tr>
                      <th className="px-4 py-3">Produto</th>
                      {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                        <>
                          <th className="px-1.5 py-3 w-20 text-center">Quantidade</th>
                          <th className="px-1.5 py-3 text-right">Custo Un.</th>
                          <th className="px-1.5 py-3 text-right">Custo Total</th>
                          <th className="px-1.5 py-3 text-right">Fator</th>
                          <th className="px-1.5 py-3 text-right">Venda Un.</th>
                          <th className="px-1.5 py-3 text-right">Frete</th>
                          <th className="px-1.5 py-3 text-right">Impostos</th>
                          <th className="px-1.5 py-3 text-right">Desp. Adm</th>
                          <th className="px-1.5 py-3 text-right">Comissão</th>
                          <th className="px-1.5 py-3 text-right">Lucro Un.</th>
                          <th className="px-1.5 py-3 text-right">Margem</th>
                          <th className="px-1.5 py-3 text-right">Venda Total</th>
                          <th className="px-1.5 py-3 text-right">Lucro Total</th>
                        </>
                      ) : (
                        <>
                          <th className="px-1.5 py-3 w-20">Quantidade</th>
                          <th className="px-1.5 py-3 text-right">Custo Base</th>
                          {form.considerar_st_ou_difal === 'ST' ? (
                            <>
                              <th className="px-1.5 py-3 text-right">ST (Un.)</th>
                              <th className="px-1.5 py-3 text-right">Total sem ST</th>
                            </>
                          ) : (
                            <>
                              <th className="px-1.5 py-3 text-right">DIFAL (Un.)</th>
                              <th className="px-1.5 py-3 text-right">Total sem DIFAL</th>
                            </>
                          )}
                          <th className="px-1.5 py-3 text-right">Custo Total</th>
                        </>
                      )}
                      <th className="px-1.5 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle bg-bg-surface">
                    {form.items.map((item, idx) => {
                      // Find cost generated by backend /preview matching product_id or own_service_id
                      const summary = financials?.item_summaries?.find((s: any) =>
                        (item.product_id && s.product_id === item.product_id) ||
                        (item.own_service_id && s.own_service_id === item.own_service_id)
                      );

                      const qty = item.quantidade_no_kit || 1;
                      const icmsAbatido = summary?.icms_abatido_total != null 
                        ? summary.icms_abatido_total 
                        : ((summary?.icms_abatido || 0) * qty);
                      const icmsStDeduction = isInterstate ? (summary?.icms_st_total || 0) : 0;
                      const netTaxItem = (summary?.imposto_venda_item || 0) - icmsAbatido - icmsStDeduction;

                      return (
                        <tr key={idx} className="hover:bg-bg-deep/20 transition-colors group">
                          <td className="px-1.5 py-3 font-medium text-text-primary max-w-[200px] truncate" title={item.descricao_item}>
                            <div className="flex flex-col truncate">
                              <div className="flex items-center gap-2">
                                <span className="truncate">{item.descricao_item}</span>
                                {item.tipo_item === 'SERVICO_PROPRIO' && (
                                  <span className="flex-none px-2 py-0.5 text-[10px] bg-brand-primary/10 text-brand-primary rounded font-semibold border border-brand-primary/20 uppercase whitespace-nowrap">
                                    Serviço Próprio
                                  </span>
                                )}
                              </div>
                              {(item as any).product?.codigo && (
                                <span className="text-[10px] text-text-muted mt-0.5 font-mono uppercase truncate">
                                  SKU: {(item as any).product.codigo}
                                </span>
                              )}
                            </div>
                            {summary?.custo_base_unitario_item === 0 && (
                              <div className="text-xs text-brand-warning">Custo de ref. inexistente</div>
                            )}
                          </td>
                          {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                            <>
                              <td className="px-1.5 py-3">
                                <Input
                                  type="number"
                                  value={item.quantidade_no_kit}
                                  onChange={(e) => updateItemQty(idx, parseFloat(e.target.value) || 1)}
                                  className="w-full h-8 px-1 text-sm text-center"
                                />
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                <Tooltip variant="light" content={
                                  <div className="w-64">
                                    <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                                      <Info className="w-3.5 h-3.5 text-brand-primary" />
                                      Detalhamento de Custo
                                    </div>
                                    <div className="space-y-1.5 font-mono text-text-muted">
                                      <div className="flex justify-between"><span>Base:</span><span>{fmtC(summary?.base_fornecedor || 0)}</span></div>
                                      {(summary?.icms_abatido || 0) > 0 && <div className="flex justify-between text-rose-600 font-semibold"><span>ICMS Abatido:</span><span>- {fmtC(summary?.icms_abatido)}</span></div>}
                                      {(summary?.ipi_unit || 0) > 0 && <div className="flex justify-between"><span>IPI:</span><span>+ {fmtC(summary?.ipi_unit)}</span></div>}
                                      {(summary?.frete_cif_unit || 0) > 0 && <div className="flex justify-between"><span>Frete CIF:</span><span>+ {fmtC(summary?.frete_cif_unit)}</span></div>}
                                      {(summary?.icms_st_unitario || 0) > 0 && <div className="flex justify-between"><span>ICMS-ST:</span><span>+ {fmtC(summary?.icms_st_unitario)}</span></div>}
                                      <div className="border-t border-gray-300 mt-1.5 pt-1.5 flex justify-between font-bold text-text-primary">
                                        <span>Custo Unit. Final:</span><span>{fmtC(summary?.custo_base_unitario_item || 0)}</span>
                                      </div>
                                    </div>
                                  </div>
                                }>
                                  <span className="cursor-help border-b border-dashed border-text-muted">{fmtC(summary?.custo_base_unitario_item)}</span>
                                </Tooltip>
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-primary font-medium">
                                {fmtC((summary?.custo_base_unitario_item || 0) * item.quantidade_no_kit)}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                {summary?.fator_item ? Number(summary.fator_item).toFixed(2) : '-'}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums font-medium text-text-primary">
                                {fmtC(summary?.venda_unitario_item)}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                {fmtC(summary?.frete_venda_item)}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                <Tooltip variant="light" content={
                                  <div className="w-72 text-left">
                                    <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                                      <Info className="w-3.5 h-3.5 text-brand-primary" />
                                      Detalhamento de Impostos
                                    </div>
                                    <div className="space-y-1.5 font-mono text-text-muted text-sm">
                                      <div className="flex justify-between"><span>PIS ({(summary?.perc_pis || 0).toFixed(2)}%)</span><span>{fmtC(summary?.pis_unit || 0)}</span></div>
                                      <div className="flex justify-between"><span>COFINS ({(summary?.perc_cofins || 0).toFixed(2)}%)</span><span>{fmtC(summary?.cofins_unit || 0)}</span></div>
                                      <div className="flex justify-between"><span>CSLL ({(summary?.perc_csll || 0).toFixed(2)}%)</span><span>{fmtC(summary?.csll_unit || 0)}</span></div>
                                      <div className="flex justify-between"><span>IRPJ ({(summary?.perc_irpj || 0).toFixed(2)}%)</span><span>{fmtC(summary?.irpj_unit || 0)}</span></div>
                                      {['SERVICO', 'LICENCA'].includes(summary?.tipo_item) ? (
                                        <div className="flex justify-between"><span>ISS ({(summary?.perc_iss || 0).toFixed(2)}%)</span><span>{fmtC(summary?.iss_unit || 0)}</span></div>
                                      ) : (
                                        <div className="flex justify-between">
                                          <span>{isInterstate ? 'icms 12% Venda' : `ICMS (${(summary?.perc_icms || 0).toFixed(2)}%)${summary?.tem_st ? ' — ST isento' : ''}`}</span>
                                          <span>{fmtC(summary?.icms_unit || 0)}</span>
                                        </div>
                                      )}
                                      {icmsAbatido > 0 && (
                                        <div className="flex justify-between text-emerald-600 font-semibold">
                                          <span>Créd. ICMS (Compra)</span>
                                          <span>- {fmtC(icmsAbatido)}</span>
                                        </div>
                                      )}
                                      {isInterstate && (summary?.icms_st_total || 0) > 0 && (
                                        <div className="flex justify-between text-emerald-600 font-semibold">
                                          <span>icms st (compra)</span>
                                          <span className="font-semibold text-emerald-600">- ({fmtC(summary?.icms_st_total)})</span>
                                        </div>
                                      )}
                                      <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between font-bold text-text-primary">
                                        <span>Total Impostos (Líquido)</span><span>{fmtC(netTaxItem)}</span>
                                      </div>
                                    </div>
                                  </div>
                                }>
                                  <span className="cursor-help border-b border-dashed border-text-muted">{fmtC(netTaxItem)}</span>
                                </Tooltip>
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                {fmtC(summary?.desp_adm_item)}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                {fmtC(summary?.comissao_item)}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums font-medium text-text-primary">
                                {fmtC(summary?.lucro_unitario_item)}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums font-bold text-brand-success">
                                {summary?.margem_item ? Number(summary.margem_item).toFixed(2) + '%' : '0.00%'}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums font-bold text-brand-primary">
                                {fmtC(summary?.venda_total_item)}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums font-bold text-brand-success">
                                {fmtC(summary?.lucro_total_item)}
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-1.5 py-3">
                                <Input
                                  type="number"
                                  value={item.quantidade_no_kit}
                                  onChange={(e) => updateItemQty(idx, parseFloat(e.target.value) || 1)}
                                  className="w-full h-8 text-sm"
                                />
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                {(() => {
                                  const custoBase = (summary?.base_fornecedor || 0) + (summary?.ipi_unit || 0) + (summary?.frete_cif_unit || 0);
                                  return (
                                    <Tooltip variant="light" content={
                                      <div className="w-64">
                                        <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                                          <Info className="w-3.5 h-3.5 text-brand-primary" />
                                          Composição Custo Base
                                        </div>
                                        <div className="space-y-1.5 font-mono text-text-muted">
                                          <div className="flex justify-between"><span>Base (Unit.):</span><span>{fmtC(summary?.base_fornecedor || 0)}</span></div>
                                          <div className="flex justify-between"><span>IPI:</span><span>+ {fmtC(summary?.ipi_unit || 0)}</span></div>
                                          <div className="flex justify-between"><span>Frete CIF:</span><span>+ {fmtC(summary?.frete_cif_unit || 0)}</span></div>
                                          <div className="border-t border-gray-300 mt-1.5 pt-1.5 flex justify-between font-bold text-text-primary">
                                            <span>Custo Base:</span><span>{fmtC(custoBase)}</span>
                                          </div>
                                        </div>
                                      </div>
                                    }>
                                      <span className="cursor-help border-b border-dashed border-text-muted">{fmtC(custoBase)}</span>
                                    </Tooltip>
                                  );
                                })()}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                {form.considerar_st_ou_difal === 'ST' ? (
                                  <Tooltip variant="light" content={<CostCompositionTooltip summary={summary} qty={item.quantidade_no_kit} isST={true} />}>
                                    <span className="cursor-help border-b border-dashed border-text-muted">{fmtC(summary?.icms_st_unitario || 0)}</span>
                                  </Tooltip>
                                ) : (
                                  <Tooltip variant="light" content={<CostCompositionTooltip summary={summary} qty={item.quantidade_no_kit} isST={false} />}>
                                    <span className="cursor-help border-b border-dashed border-text-muted">{fmtC(summary?.difal_unitario || 0)}</span>
                                  </Tooltip>
                                )}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                {form.considerar_st_ou_difal === 'ST' ? (
                                  fmtC(((summary?.base_fornecedor || 0) + (summary?.ipi_unit || 0) + (summary?.frete_cif_unit || 0)) * item.quantidade_no_kit)
                                ) : (
                                  fmtC(((summary?.base_fornecedor || 0) + (summary?.ipi_unit || 0) + (summary?.frete_cif_unit || 0)) * item.quantidade_no_kit)
                                )}
                              </td>
                              <td className="px-1.5 py-3 text-right tabular-nums text-text-primary font-medium">
                                {fmtC(summary?.custo_total_item_no_kit)}
                              </td>
                            </>
                          )}
                          <td className="px-1.5 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeItem(idx)}
                              className="text-text-muted hover:text-brand-danger opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot className="bg-bg-deep/30 border-t-2 border-border-subtle font-semibold text-text-primary">
                    <tr>
                      <td colSpan={2} className="px-4 py-3 text-right text-text-muted">Totalizadores:</td>
                      {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                        <>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.custo_total_item_no_kit || 0), 0) || 0)}</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.frete_venda_item || 0), 0) || 0)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => {
                            const originalItem = form.items.find(i => (b.product_id && i.product_id === b.product_id) || (b.own_service_id && i.own_service_id === b.own_service_id)) || form.items[0]; // fallback if not found
                            const qty = originalItem?.quantidade_no_kit || 1;
                            const icmsAbatido = b.icms_abatido_total != null ? b.icms_abatido_total : ((b.icms_abatido || 0) * qty);
                            const stDeduction = isInterstate ? (b.icms_st_total || 0) : 0;
                            return a + ((b.imposto_venda_item || 0) - icmsAbatido - stDeduction);
                          }, 0) || 0)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.desp_adm_item || 0), 0) || 0)}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.comissao_item || 0), 0) || 0)}</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right tabular-nums text-text-primary font-bold">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.venda_total_item || 0), 0) || 0)}</td>
                          <td className="px-4 py-3 text-right tabular-nums text-brand-success font-bold">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.lucro_total_item || 0), 0) || 0)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3"></td>
                          {form.considerar_st_ou_difal === 'ST' ? (
                            <>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.summary?.total_st_kit || 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC((financials?.summary?.custo_aquisicao_kit || 0) - (financials?.summary?.total_st_kit || 0))}</td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.summary?.total_difal_kit || 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC((financials?.summary?.custo_aquisicao_kit || 0) - (financials?.summary?.total_difal_kit || 0))}</td>
                            </>
                          )}
                          <td className="px-4 py-3 text-right tabular-nums font-bold">{fmtC(financials?.summary?.custo_aquisicao_kit || 0)}</td>
                        </>
                      )}
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            <ProductSearchModal
              isOpen={showProductSearch}
              onClose={() => setShowProductSearch(false)}
              multiSelect={true}
              onSelectMany={handleAddProducts}
              salesBudgetId={form.sales_budget_id}
            />
          </section>

          {showBlock31 && (
            <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle">
                <h2 className="text-xl font-semibold">5. Custos de Instalação (Serviços independentes)</h2>
                <Button variant="outline" size="sm" onClick={() => setCostSearchType('inst')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Serviço
                </Button>
              </div>

              {instCosts.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-bg-deep/50 hover:bg-bg-deep/80 transition-colors">
                  <p className="text-sm text-text-muted">Nenhum custo de instalação independente adicionado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border-subtle">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-bg-deep/50 text-text-muted font-medium border-b border-border-subtle">
                      <tr>
                        <th className="px-4 py-3">Serviço</th>
                        <th className="px-4 py-3">Tipo de Custo</th>
                        {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                          <>
                            <th className="px-4 py-3 text-right">Custo Un.</th>
                            <th className="px-4 py-3 w-32">Quantidade</th>
                            <th className="px-4 py-3 text-right">MKP</th>
                            <th className="px-4 py-3 text-right">Venda Un.</th>
                            <th className="px-4 py-3 text-right">Frete</th>
                            <th className="px-4 py-3 text-right">Impostos</th>
                            <th className="px-4 py-3 text-right">Desp. Adm</th>
                            <th className="px-4 py-3 text-right">Comissão</th>
                            <th className="px-4 py-3 text-right">Lucro Un.</th>
                            <th className="px-4 py-3 text-right">Margem</th>
                            <th className="px-4 py-3 text-right">Venda Total</th>
                            <th className="px-4 py-3 text-right">Lucro Total</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3 text-right">Vlr. Unitário</th>
                            <th className="px-4 py-3 text-right">Qtd</th>
                            <th className="px-4 py-3 text-right">Total</th>
                          </>
                        )}
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-bg-surface">
                      {instCosts.map((c, idx) => {
                        const summary = financials?.cost_summaries?.find((cs: any) =>
                          (cs.product_id === c.product_id || (cs.own_service_id && cs.own_service_id === c.own_service_id)) &&
                          cs.tipo_custo === c.tipo_custo
                        );
                        const vendaUnit = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? c.valor_unitario * (form.fator_margem_instalacao || 1) : c.valor_unitario;
                        const totalItem = vendaUnit * c.quantidade;
                        return (
                          <tr key={`inst-${idx}`} className="hover:bg-bg-deep/20 transition-colors group">
                            <td className="px-4 py-3 font-medium text-text-primary">
                              <div className="flex flex-col gap-0.5">
                                <span>{c.descricao_item || 'Serviço'}</span>
                                {c.own_service_id && (['VENDA_EQUIPAMENTOS', 'LOCACAO', 'COMODATO', 'INSTALACAO'].includes(form.tipo_contrato) ? form.forma_execucao : c.forma_execucao) && (
                                  <span className="w-fit whitespace-nowrap px-1.5 py-0.5 text-[10px] bg-teal-100 text-teal-700 rounded font-semibold border border-teal-200 uppercase">
                                    {['VENDA_EQUIPAMENTOS', 'LOCACAO', 'COMODATO', 'INSTALACAO'].includes(form.tipo_contrato) ? form.forma_execucao : c.forma_execucao}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{c.tipo_custo === 'INSTALACAO' ? 'Instalação' : c.tipo_custo}</td>
                            {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                              <>
                                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                                  <Tooltip variant="light" content={
                                    <div className="w-64 text-left">
                                      <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5 text-brand-primary" />
                                        Detalhamento de Custo
                                      </div>
                                      <div className="space-y-1.5 font-mono text-text-muted">
                                        <div className="flex justify-between"><span>Base:</span><span>{fmtC(summary?.base_fornecedor || c.valor_unitario)}</span></div>
                                        {(summary?.icms_abatido || 0) > 0 && <div className="flex justify-between text-rose-600 font-semibold"><span>ICMS Abatido:</span><span>- {fmtC(summary?.icms_abatido)}</span></div>}
                                        {(summary?.ipi_unit || 0) > 0 && <div className="flex justify-between"><span>IPI:</span><span>+ {fmtC(summary?.ipi_unit)}</span></div>}
                                        {(summary?.frete_cif_unit || 0) > 0 && <div className="flex justify-between"><span>Frete CIF:</span><span>+ {fmtC(summary?.frete_cif_unit)}</span></div>}
                                        {(summary?.icms_st_unitario || 0) > 0 && <div className="flex justify-between"><span>ICMS-ST:</span><span>+ {fmtC(summary?.icms_st_unitario)}</span></div>}
                                        <div className="border-t border-gray-300 mt-1.5 pt-1.5 flex justify-between font-bold text-text-primary">
                                          <span>Custo Unit. Final:</span><span>{fmtC(summary?.custo_base_unitario_item || c.valor_unitario)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  }>
                                    <span className="cursor-help border-b border-dashed border-text-muted">{fmtC(summary?.custo_base_unitario_item || c.valor_unitario)}</span>
                                  </Tooltip>
                                </td>
                                <td className="px-2 py-3 text-right tabular-nums">
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="w-16 text-right h-8 ml-auto"
                                    value={c.quantidade || 1}
                                    onChange={(e) => updateCostQuantity(c, Number(e.target.value))}
                                  />
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{summary?.fator_item ? Number(summary.fator_item).toFixed(2) : '-'}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.venda_unitario_item || vendaUnit)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.frete_venda_item || 0)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.imposto_venda_item || 0)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.desp_adm_item || 0)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.comissao_item || 0)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.lucro_unitario_item || 0)}</td>
                                <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{summary?.margem_item ? Number(summary.margem_item).toFixed(2) + '%' : '0.00%'}</td>
                                <td className="px-4 py-3 text-right tabular-nums font-medium text-text-primary">{fmtC(summary?.venda_total_item || totalItem)}</td>
                                <td className="px-4 py-3 text-right tabular-nums font-medium text-brand-success">{fmtC(summary?.lucro_total_item || 0)}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3 text-right tabular-nums">{fmtC(summary?.custo_base_unitario_item !== undefined ? summary.custo_base_unitario_item : c.valor_unitario)}</td>
                                <td className="px-2 py-3 text-right tabular-nums">
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="w-16 text-right h-8 ml-auto"
                                    value={c.quantidade || 1}
                                    onChange={(e) => updateCostQuantity(c, Number(e.target.value))}
                                  />
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-medium text-brand-secondary">{fmtC(totalItem)}</td>
                              </>
                            )}
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="sm" onClick={() => removeCostByProps(c)} className="text-text-muted hover:text-brand-danger opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-bg-deep/30 border-t-2 border-border-subtle font-semibold text-text-primary">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-right text-text-muted">Total Instalação:</td>
                        {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (() => {
                          const insts = financials?.cost_summaries?.filter((cs: any) => cs.tipo_custo === 'INSTALACAO') || [];
                          return (
                            <>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC(insts.reduce((a: any, b: any) => a + (b.frete_venda_item || 0), 0) || 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC(insts.reduce((a: any, b: any) => a + (b.imposto_venda_item || 0), 0) || 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC(insts.reduce((a: any, b: any) => a + (b.desp_adm_item || 0), 0) || 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC(insts.reduce((a: any, b: any) => a + (b.comissao_item || 0), 0) || 0)}</td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3 text-right tabular-nums text-brand-secondary">
                                {fmtC(insts.reduce((a: any, b: any) => a + (b.venda_total_item || 0), 0) || 0)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-brand-success">
                                {fmtC(insts.reduce((a: any, b: any) => a + (b.lucro_total_item || 0), 0) || 0)}
                              </td>
                            </>
                          );
                        })() : (
                          <>
                            <td colSpan={2} className="px-4 py-3 text-right"></td>
                            <td className="px-4 py-3 text-right tabular-nums text-brand-secondary">
                              {fmtC(instCosts.reduce((acc, c) => {
                                const summary = financials?.cost_summaries?.find((cs: any) =>
                                  (cs.product_id === c.product_id || (cs.own_service_id && cs.own_service_id === c.own_service_id)) &&
                                  cs.tipo_custo === c.tipo_custo
                                );
                                const custoUnit = summary?.custo_base_unitario_item !== undefined ? summary.custo_base_unitario_item : c.valor_unitario;
                                return acc + (custoUnit * c.quantidade);
                              }, 0))}
                            </td>
                          </>
                        )}
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          )}

          {showBlock3 && (!(form.tipo_contrato === 'LOCACAO' || form.tipo_contrato === 'COMODATO') || !form.manutencao_inclusa) && (
            <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle">
                <h2 className="text-xl font-semibold">6. Custos Operacionais Mensais (R$)</h2>
                <Button variant="outline" size="sm" onClick={() => setCostSearchType('op')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Custo (Serviço)
                </Button>
              </div>

              {opCosts.length === 0 ? (
                <div className="py-8 flex flex-col items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-bg-deep/50 hover:bg-bg-deep/80 transition-colors">
                  <p className="text-sm text-text-muted">Nenhum custo operacional adicionado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border-subtle">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-bg-deep/50 text-text-muted font-medium border-b border-border-subtle">
                      <tr>
                        <th className="px-4 py-3">Serviço</th>
                        <th className="px-4 py-3">Tipo de Custo</th>
                        {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                          <>
                            <th className="px-4 py-3 text-right">Custo Un.</th>
                            <th className="px-4 py-3 w-32">Quantidade</th>
                            <th className="px-4 py-3 text-right">MKP</th>
                            <th className="px-4 py-3 text-right">Venda Un.</th>
                            <th className="px-4 py-3 text-right">V. Mensal</th>
                            <th className="px-4 py-3 text-right">Impostos</th>
                            <th className="px-4 py-3 text-right">Desp. Adm</th>
                            <th className="px-4 py-3 text-right">Comissão</th>
                            <th className="px-4 py-3 text-right">Lucro Un.</th>
                            <th className="px-4 py-3 text-right">Margem</th>
                            <th className="px-4 py-3 text-right">Venda Total</th>
                            <th className="px-4 py-3 text-right">Lucro Total</th>
                          </>
                        ) : (
                          <>
                            <th className="px-4 py-3 text-right">Vlr. Unitário</th>
                            <th className="px-4 py-3 text-right">Qtd</th>
                            <th className="px-4 py-3 text-right">Total</th>
                          </>
                        )}
                        <th className="px-4 py-3 w-16"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle bg-bg-surface">
                      {opCosts.map((c, idx) => {
                        const summary = financials?.cost_summaries?.find((cs: any) =>
                          (cs.product_id === c.product_id || (cs.own_service_id && cs.own_service_id === c.own_service_id)) &&
                          cs.tipo_custo === c.tipo_custo
                        );
                        const custoUnit = summary?.custo_base_unitario_item !== undefined ? summary.custo_base_unitario_item : c.valor_unitario;
                        const vendaUnit = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? custoUnit * (form.fator_margem_manutencao || 1) : custoUnit;
                        const totalItem = vendaUnit * c.quantidade;
                        return (
                          <tr key={`op-${idx}`} className="hover:bg-bg-deep/20 transition-colors group">
                            <td className="px-4 py-3 font-medium text-text-primary">
                              <div className="flex flex-col gap-0.5">
                                <span>{c.descricao_item || 'Serviço'}</span>
                                {c.own_service_id && (['VENDA_EQUIPAMENTOS', 'LOCACAO', 'COMODATO', 'INSTALACAO'].includes(form.tipo_contrato) ? form.forma_execucao : c.forma_execucao) && (
                                  <span className="w-fit whitespace-nowrap px-1.5 py-0.5 text-[10px] bg-teal-100 text-teal-700 rounded font-semibold border border-teal-200 uppercase">
                                    {['VENDA_EQUIPAMENTOS', 'LOCACAO', 'COMODATO', 'INSTALACAO'].includes(form.tipo_contrato) ? form.forma_execucao : c.forma_execucao}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-text-secondary">{c.tipo_custo}</td>
                            {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                              <>
                                <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                  <Tooltip variant="light" content={
                                    <div className="w-64 text-left">
                                      <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5 text-brand-primary" />
                                        Detalhamento de Custo
                                      </div>
                                      <div className="space-y-1.5 font-mono text-text-muted">
                                        <div className="flex justify-between"><span>Base:</span><span>{fmtC(summary?.base_fornecedor || c.valor_unitario)}</span></div>
                                        {(summary?.icms_abatido || 0) > 0 && <div className="flex justify-between text-rose-600 font-semibold"><span>ICMS Abatido:</span><span>- {fmtC(summary?.icms_abatido)}</span></div>}
                                        {(summary?.ipi_unit || 0) > 0 && <div className="flex justify-between"><span>IPI:</span><span>+ {fmtC(summary?.ipi_unit)}</span></div>}
                                        {(summary?.frete_cif_unit || 0) > 0 && <div className="flex justify-between"><span>Frete CIF:</span><span>+ {fmtC(summary?.frete_cif_unit)}</span></div>}
                                        {(summary?.icms_st_unitario || 0) > 0 && <div className="flex justify-between"><span>ICMS-ST:</span><span>+ {fmtC(summary?.icms_st_unitario)}</span></div>}
                                        <div className="border-t border-gray-300 mt-1.5 pt-1.5 flex justify-between font-bold text-text-primary">
                                          <span>Custo Unit. Final:</span><span>{fmtC(summary?.custo_base_unitario_item || c.valor_unitario)}</span>
                                        </div>
                                      </div>
                                    </div>
                                  }>
                                    <span className="cursor-help border-b border-dashed border-text-muted">{fmtC(summary?.custo_base_unitario_item || c.valor_unitario)}</span>
                                  </Tooltip>
                                </td>
                                <td className="px-1.5 py-3 text-center tabular-nums">
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="w-16 text-right h-8 mx-auto"
                                    value={c.quantidade || 1}
                                    onChange={(e) => updateCostQuantity(c, Number(e.target.value))}
                                  />
                                </td>
                                <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">{summary?.fator_item ? Number(summary.fator_item).toFixed(2) : '-'}</td>
                                <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.venda_unitario_item || vendaUnit)}</td>
                                <td className="px-1.5 py-3 text-right tabular-nums text-brand-primary font-medium">{fmtC((summary?.venda_unitario_item || vendaUnit) * c.quantidade)}</td>
                                <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                  <Tooltip variant="light" content={
                                    <div className="w-72 text-left">
                                      <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                                        <Info className="w-3.5 h-3.5 text-brand-primary" />
                                        Detalhamento de Impostos
                                      </div>
                                      <div className="space-y-1.5 font-mono text-text-muted text-sm">
                                        <div className="flex justify-between"><span>PIS ({(summary?.perc_pis || 0).toFixed(2)}%)</span><span>{fmtC(summary?.pis_unit || 0)}</span></div>
                                        <div className="flex justify-between"><span>COFINS ({(summary?.perc_cofins || 0).toFixed(2)}%)</span><span>{fmtC(summary?.cofins_unit || 0)}</span></div>
                                        <div className="flex justify-between"><span>CSLL ({(summary?.perc_csll || 0).toFixed(2)}%)</span><span>{fmtC(summary?.csll_unit || 0)}</span></div>
                                        <div className="flex justify-between"><span>IRPJ ({(summary?.perc_irpj || 0).toFixed(2)}%)</span><span>{fmtC(summary?.irpj_unit || 0)}</span></div>
                                        {['SERVICO', 'LICENCA'].includes(summary?.tipo_item) ? (
                                          <div className="flex justify-between"><span>ISS ({(summary?.perc_iss || 0).toFixed(2)}%)</span><span>{fmtC(summary?.iss_unit || 0)}</span></div>
                                        ) : (
                                          <div className="flex justify-between">
                                            <span>ICMS ({(summary?.perc_icms || 0).toFixed(2)}%){summary?.tem_st ? ' — ST isento' : ''}</span>
                                            <span>{fmtC(summary?.icms_unit || 0)}</span>
                                          </div>
                                        )}
                                        {(summary?.icms_abatido || 0) > 0 && (
                                          <div className="flex justify-between text-emerald-600 font-semibold">
                                            <span>Créd. ICMS (Compra)</span>
                                            <span>- {fmtC((summary?.icms_abatido || 0) * c.quantidade)}</span>
                                          </div>
                                        )}
                                        <div className="border-t border-gray-300 mt-2 pt-2 flex justify-between font-bold text-text-primary">
                                          <span>Total Impostos (Líquido)</span><span>{fmtC((summary?.imposto_venda_item || 0) - ((summary?.icms_abatido || 0) * c.quantidade))}</span>
                                        </div>
                                      </div>
                                    </div>
                                  }>
                                    <span className="cursor-help border-b border-dashed border-text-muted">{fmtC((summary?.imposto_venda_item || 0) - ((summary?.icms_abatido || 0) * c.quantidade))}</span>
                                  </Tooltip>
                                </td>
                                <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.desp_adm_item || 0)}</td>
                                <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.comissao_item || 0)}</td>
                                <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.lucro_unitario_item || 0)}</td>
                                <td className="px-1.5 py-3 text-right tabular-nums font-bold text-brand-success">{summary?.margem_item ? Number(summary.margem_item).toFixed(2) + '%' : '0.00%'}</td>
                                <td className="px-1.5 py-3 text-right tabular-nums font-bold text-brand-primary">{fmtC(summary?.venda_total_item || totalItem)}</td>
                                <td className="px-1.5 py-3 text-right tabular-nums font-bold text-brand-success">{fmtC(summary?.lucro_total_item || 0)}</td>
                              </>
                            ) : (
                              <>
                                <td className="px-4 py-3 text-right tabular-nums">{fmtC(custoUnit)}</td>
                                <td className="px-2 py-3 text-right tabular-nums">
                                  <Input
                                    type="number"
                                    min="1"
                                    step="1"
                                    className="w-16 text-right h-8 ml-auto"
                                    value={c.quantidade || 1}
                                    onChange={(e) => updateCostQuantity(c, Number(e.target.value))}
                                  />
                                </td>
                                <td className="px-4 py-3 text-right tabular-nums font-medium text-brand-warning">{fmtC(totalItem)}</td>
                              </>
                            )}
                            <td className="px-4 py-3 text-right">
                              <Button variant="ghost" size="sm" onClick={() => removeCostByProps(c)} className="text-text-muted hover:text-brand-danger opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-bg-deep/30 border-t-2 border-border-subtle font-semibold text-text-primary">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-right text-text-muted">Total Operacional:</td>
                        {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (() => {
                          const manuts = financials?.cost_summaries?.filter((cs: any) => cs.tipo_custo === 'MANUTENCAO') || [];
                          return (
                            <>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3 text-right tabular-nums text-brand-primary font-bold">{fmtC(opCosts.reduce((acc, cost) => {
                                const cs = financials?.cost_summaries?.find((x: any) => x.product_id === cost.product_id && x.tipo_custo === cost.tipo_custo);
                                const vUnit = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? cost.valor_unitario * (form.fator_margem_manutencao || 1) : cost.valor_unitario;
                                return acc + ((cs?.venda_unitario_item || vUnit) * cost.quantidade);
                              }, 0))}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC(manuts.reduce((a: any, b: any) => a + (b.imposto_venda_item || 0), 0) || 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC(manuts.reduce((a: any, b: any) => a + (b.desp_adm_item || 0), 0) || 0)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtC(manuts.reduce((a: any, b: any) => a + (b.comissao_item || 0), 0) || 0)}</td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3"></td>
                              <td className="px-4 py-3 text-right tabular-nums text-brand-warning">
                                {fmtC(manuts.reduce((a: any, b: any) => a + (b.venda_total_item || 0), 0) || 0)}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums text-brand-success">
                                {fmtC(manuts.reduce((a: any, b: any) => a + (b.lucro_total_item || 0), 0) || 0)}
                              </td>
                            </>
                          );
                        })() : (
                          <>
                            <td colSpan={2} className="px-4 py-3 text-right"></td>
                            <td className="px-4 py-3 text-right tabular-nums text-brand-warning">
                              {fmtC(opCosts.reduce((acc, c) => {
                                const summary = financials?.cost_summaries?.find((cs: any) =>
                                  (cs.product_id === c.product_id || (cs.own_service_id && cs.own_service_id === c.own_service_id)) &&
                                  cs.tipo_custo === c.tipo_custo
                                );
                                const custoUnit = summary?.custo_base_unitario_item !== undefined ? summary.custo_base_unitario_item : c.valor_unitario;
                                return acc + (custoUnit * c.quantidade);
                              }, 0))}
                            </td>
                          </>
                        )}
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Bloco 7 – Custos Mensais do Contrato */}
          {(form.tipo_contrato === 'LOCACAO' || form.tipo_contrato === 'COMODATO') && (
            <section className="bg-bg-surface border border-border-subtle shadow-sm rounded-xl p-4 sm:p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold tracking-tight text-text-primary">
                  Bloco 7 – Custos Mensais do Contrato
                </h2>
                <Button variant="outline" size="sm" type="button" onClick={() => {
                  setForm(prev => ({
                    ...prev,
                    monthly_costs: [
                      ...(prev.monthly_costs || []),
                      { servico: '', tipo_custo: 'Operacional', quantidade: 1, valor_unitario: 0 }
                    ]
                  }));
                }}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nova Linha
                </Button>
              </div>

              {(!form.monthly_costs || form.monthly_costs.length === 0) ? (
                <div className="text-center py-6 text-text-muted border-2 border-dashed border-border-subtle rounded-lg">
                  <p className="text-sm">Nenhum custo mensal recorrente adicionado.</p>
                </div>
              ) : (
                <div className="overflow-x-auto border border-border-subtle rounded-lg">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-bg-subtle border-b border-border-subtle text-text-muted">
                      <tr>
                        <th className="px-4 py-3 font-medium">Serviço (Descrição)</th>
                        <th className="px-4 py-3 font-medium">Tipo de Custo</th>
                        <th className="px-2 py-3 font-medium text-right w-24">Qtd.</th>
                        <th className="px-4 py-3 font-medium text-right w-32">Vlr Unitário</th>
                        <th className="px-4 py-3 font-medium text-right w-32">Custo Total</th>
                        <th className="px-4 py-3 font-medium w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {form.monthly_costs.map((mcost, idx) => (
                        <tr key={idx} className="hover:bg-bg-subtle/50 transition-colors group">
                          <td className="px-4 py-2">
                            <Input
                              value={mcost.servico}
                              onChange={e => {
                                const val = e.target.value;
                                setForm(prev => {
                                  const newCosts = [...prev.monthly_costs];
                                  newCosts[idx].servico = val;
                                  return { ...prev, monthly_costs: newCosts };
                                });
                              }}
                              className="w-full h-8"
                              placeholder="Descreva o custo"
                            />
                          </td>
                          <td className="px-4 py-2">
                            <select
                              className="w-full h-8 bg-bg-surface border border-border-base rounded px-2 text-sm focus:ring-1 focus:ring-brand-primary/30 text-text-primary"
                              value={mcost.tipo_custo}
                              onChange={e => {
                                const val = e.target.value;
                                setForm(prev => {
                                  const newCosts = [...prev.monthly_costs];
                                  newCosts[idx].tipo_custo = val;
                                  return { ...prev, monthly_costs: newCosts };
                                });
                              }}
                            >
                              <option value="Operacional">Operacional</option>
                              <option value="Suporte">Suporte</option>
                              <option value="Infraestrutura">Infraestrutura</option>
                              <option value="Terceiros">Terceiros</option>
                              <option value="Outros">Outros</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              className="w-16 text-right h-8 ml-auto"
                              value={mcost.quantidade}
                              onChange={e => {
                                const val = parseFloat(e.target.value) || 1;
                                setForm(prev => {
                                  const newCosts = [...prev.monthly_costs];
                                  newCosts[idx].quantidade = val;
                                  return { ...prev, monthly_costs: newCosts };
                                });
                              }}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <Decimal4Input
                              value={mcost.valor_unitario}
                              onChange={(val: number) => {
                                setForm(prev => {
                                  const newCosts = [...prev.monthly_costs];
                                  newCosts[idx].valor_unitario = val;
                                  return { ...prev, monthly_costs: newCosts };
                                });
                              }}
                              className="w-full text-right h-8 ml-auto"
                            />
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-brand-warning tabular-nums">
                            {fmtC((mcost.quantidade || 0) * (mcost.valor_unitario || 0))}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setForm(prev => {
                                  const newCosts = [...prev.monthly_costs];
                                  newCosts.splice(idx, 1);
                                  return { ...prev, monthly_costs: newCosts };
                                });
                              }}
                              className="text-text-muted hover:text-brand-danger opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-bg-deep/30 border-t-2 border-border-subtle font-semibold text-text-primary">
                      <tr>
                        <td colSpan={4} className="px-4 py-3 text-right text-text-muted">Total:</td>
                        <td className="px-4 py-3 text-right tabular-nums text-brand-warning">
                          {fmtC(form.monthly_costs.reduce((sum, c) => sum + ((c.quantidade || 0) * (c.valor_unitario || 0)), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Bloco 8: Monitoramento */}
          {(form.tipo_contrato === 'LOCACAO' || form.tipo_contrato === 'COMODATO') && (
            <section className="bg-bg-primary rounded-2xl p-6 border border-border-subtle shadow-sm shadow-black/5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center shrink-0">
                  <span className="text-cyan-500 font-bold text-sm">8</span>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-text-primary">Monitoramento</h2>
                  <p className="text-sm text-text-secondary">Custo recorrente de monitoramento para o kit de Locação/Comodato.</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-1" title="Custo mensal unitário do monitoramento">Custo Monitoramento Unitário</label>
                  <Input 
                    type="number" 
                    step="0.01" 
                    value={form.custo_monitoramento_unitario} 
                    onChange={(e) => handleInputChange('custo_monitoramento_unitario', parseFloat(e.target.value) || 0)} 
                    className="w-full" 
                    placeholder="0,00"
                  />
                  <p className="text-[10px] text-text-muted mt-1">
                    Custo por unidade do kit. O preço de venda será este valor multiplicado pelo Fator Monitoramento (Bloco 2).
                  </p>
                </div>
              </div>
            </section>
          )}

          <AddOperationalCostModal
            isOpen={costSearchType !== null}
            onClose={() => setCostSearchType(null)}
            onConfirm={handleAddCost}
            defaultType={costSearchType === 'inst' ? 'INSTALACAO' : 'MANUTENCAO'}
            isKitBasedExecucao={['VENDA_EQUIPAMENTOS', 'LOCACAO', 'COMODATO', 'INSTALACAO'].includes(form.tipo_contrato)}
            disabledOwnServices={costSearchType === 'inst' && ['LOCACAO', 'COMODATO'].includes(form.tipo_contrato)}
            kitFormaExecucao={form.forma_execucao || 'H. NORMAL'}
            salesBudgetId={form.sales_budget_id}
          />

          <AddOperationalCostModal
            isOpen={showItemServiceSearch}
            onClose={() => setShowItemServiceSearch(false)}
            onConfirm={(data) => {
              handleAddItemService(data);
              setShowItemServiceSearch(false);
            }}
            defaultType="SERVICO_PROPRIO"
            isKitBasedExecucao={true}
            isKitItemFlow={true}
            kitFormaExecucao={form.forma_execucao || 'H. NORMAL'}
            salesBudgetId={form.sales_budget_id}
          />
        </div>

        {/* Generic alert modal (non-policy) */}
        <Modal isOpen={!!alertMessage} onClose={() => setAlertMessage(null)} title="Aviso">
          <div className="py-2 text-text-secondary">
            <p className="text-sm leading-relaxed">{alertMessage}</p>
          </div>
          <div className="flex justify-end pt-4 mt-4 border-t border-border-subtle">
            <Button onClick={() => setAlertMessage(null)} className="btn-primary">
              Entendido
            </Button>
          </div>
        </Modal>

        {/* Rich Policy Violation Modal */}
        <Modal
          isOpen={!!policyAlert}
          onClose={() => setPolicyAlert(null)}
          title="Violação de Política Comercial"
        >
          {policyAlert && (
            <div className="space-y-4">
              {/* Icon + intro */}
              <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-red-600 font-bold text-sm">!</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-800">Fator abaixo do limite permitido</p>
                  <p className="text-xs text-red-700 mt-0.5">
                    O valor informado viola a Política Comercial vigente e foi automaticamente corrigido.
                  </p>
                </div>
              </div>

              {/* Detail table */}
              <div className="bg-bg-subtle border border-border-subtle rounded-lg overflow-hidden text-sm">
                <div className="grid grid-cols-2 divide-x divide-border-subtle">
                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Campo</p>
                    <p className="font-semibold text-text-primary">{policyAlert.fieldLabel}</p>
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Política Violada</p>
                    <p className="font-semibold text-text-primary">{policyAlert.policyName}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 divide-x divide-border-subtle border-t border-border-subtle">
                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Valor Informado</p>
                    <p className="font-bold text-red-600 text-base">{policyAlert.enteredValue.toFixed(4)}</p>
                  </div>
                  <div className="p-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1">Corrigido Para</p>
                    <p className="font-bold text-brand-success text-base">{policyAlert.correctedValue.toFixed(4)}</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-text-muted">
                O campo foi automaticamente ajustado para o valor mínimo da política. Para utilizar um fator menor, solicite autorização ao seu gestor.
              </p>

              <div className="flex justify-end pt-2 border-t border-border-subtle">
                <Button onClick={() => setPolicyAlert(null)} className="btn-primary">
                  Entendido
                </Button>
              </div>
            </div>
          )}
        </Modal>

      </div>
    </div>
  );
};
