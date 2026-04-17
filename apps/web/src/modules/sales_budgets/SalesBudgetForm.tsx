import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Save, ArrowLeft, Loader2, Receipt, Plus, Trash2, Calculator, Info, Package, Eye, X, HelpCircle, TrendingUp, ChevronDown, ChevronUp, Upload, Download, Search, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { AddRentalItemModal } from './AddRentalItemModal';
import { OpportunityKitSearchModal } from '../../components/modals/OpportunityKitSearchModal';
import { OpportunityKitForm } from '../opportunity_kits/OpportunityKitForm';
import { EvolutivoChartModal } from './EvolutivoChartModal';
import { BudgetItemsGrid } from '../purchase_budgets/components/BudgetItemsGrid';
import { Building2 } from 'lucide-react';
import { BudgetImportModal } from '../purchase_budgets/components/BudgetImportModal';
import { BudgetReconciliationModal } from '../purchase_budgets/components/BudgetReconciliationModal';
import { QuickSupplierCreateModal } from '../../components/modals/QuickSupplierCreateModal';
import { OpportunityCreateModal } from '../../components/modals/OpportunityCreateModal';
import { RentalROIAnalysis } from './components/RentalROIAnalysis';

interface CostComposition {
  base_unitario: number;
  ipi_percent: number;
  ipi_unitario: number;
  frete_cif_unitario: number;
  has_st: boolean;
  icms_st_normal: number;
  cred_outorgado_percent: number;
  cred_outorgado_valor: number;
  icms_st_final: number;
  is_bit: boolean;
  difal_unitario: number;
  tipo: string;
  custo_unit_final: number;
}

const CurrencyCellInput = ({ value, onChange, disabled, className }: any) => {
  const [localStr, setLocalStr] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalStr(Number(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    let parsed = parseFloat(localStr.replace(/\./g, '').replace(',', '.'));
    if (isNaN(parsed)) parsed = 0;
    onChange(parsed);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (/^[0-9.,-]*$/.test(val)) {
      setLocalStr(val);
    }
  };

  return (
    <input
      type="text"
      value={isFocused ? localStr : localStr}
      onChange={handleChange}
      onFocus={() => {
        setIsFocused(true);
        setLocalStr(value ? String(value).replace('.', ',') : '');
      }}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
    />
  );
};

const Decimal4Input = ({ value, onChange, disabled, placeholder = "0.0000", className = "w-full" }: any) => {
  const [localStr, setLocalStr] = useState(Number(value || 0).toFixed(4));
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (!isFocused) {
      setLocalStr(Number(value || 0).toFixed(4));
    }
  }, [value, isFocused]);

  const handleBlur = () => {
    setIsFocused(false);
    let val = localStr.replace(',', '.');
    let parsed = parseFloat(val);
    if (isNaN(parsed)) parsed = 0;
    setLocalStr(parsed.toFixed(4));
    onChange(parsed);
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
    <input
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

interface SalesBudgetItem {
  id?: string;
  opportunity_kit_id?: string | null;
  product_id: string | null;
  product_nome: string;
  product_codigo: string;
  ncm_codigo: string;
  tipo_item: 'MERCADORIA' | 'SERVICO_INSTALACAO' | 'SERVICO_MANUTENCAO';
  descricao_servico: string;
  usa_parametros_padrao: boolean;
  custo_unit_base: number;
  markup: number;
  venda_unit: number;
  quantidade: number;
  perc_frete_venda: number;
  frete_venda_unit: number;
  perc_pis: number; pis_unit: number;
  perc_cofins: number; cofins_unit: number;
  perc_csll: number; csll_unit: number;
  perc_irpj: number; irpj_unit: number;
  perc_icms: number; icms_unit: number;
  tem_st: boolean;
  perc_iss: number; iss_unit: number;
  perc_despesa_adm: number; despesa_adm_unit: number;
  perc_comissao: number; comissao_unit: number;
  lucro_unit: number;
  margem_unit: number;
  total_venda: number;
  cost_composition?: CostComposition;
}

interface VendaKitItem {
  id?: string;
  opportunity_kit_id: string;
  nome_kit: string;
  quantidade: number;

  fator_margem_locacao: number;
  fator_margem_servicos_produtos: number;
  fator_margem_instalacao: number;
  fator_margem_manutencao: number;

  custo_aquisicao_equip_unit: number;
  custo_manutencao_unit: number;

  venda_equip_unit: number;
  venda_manut_unit: number;

  faturamento_total: number;

  lucro_venda: number;
  margem_venda: number;

  lucro_manutencao: number;
  margem_manutencao: number;

  lucro_final: number;
  margem_geral: number;

  summary?: any;
  kit_raw?: any;
  havera_manutencao?: boolean;
  qtd_meses_manutencao?: number | null;
}

interface RentalBudgetItem {
  id?: string;
  opportunity_kit_id?: string | null;
  product_id: string | null;
  product_nome?: string;
  product_codigo?: string;
  custo_op_mensal_kit?: number;

  // Kit Integration Fields
  is_kit_instalacao?: boolean;
  tipo_contrato_kit?: string | null;
  kit_taxa_juros_mensal?: number | null;
  kit_custo_produtos?: number;
  kit_custo_servicos?: number;
  kit_pis?: number;
  kit_cofins?: number;
  kit_csll?: number;
  kit_irpj?: number;
  kit_iss?: number;

  quantidade: number;
  custo_aquisicao_unit: number;
  ipi_unit: number;
  frete_unit: number;
  icms_st_unit: number;
  difal_unit: number;
  instalacao_unit: number;
  custo_total_aquisicao: number;
  prazo_contrato: number;
  usa_taxa_manut_padrao: boolean;
  taxa_manutencao_anual_item: number | null;
  perc_instalacao_item?: number | null;
  valor_instalacao_item?: number | null;
  fator_margem: number;
  custo_manut_mensal: number;
  custo_total_mensal: number;
  valor_venda_equipamento: number;
  parcela_locacao: number;
  manutencao_locacao: number;
  valor_mensal: number;
  perc_impostos_total: number;
  impostos_mensal: number;
  receita_liquida_mensal: number;
  perc_comissao: number;
  comissao_mensal: number;
  lucro_mensal: number;
  margem: number;
  cost_composition?: CostComposition;
  kit_vlt_manut?: number;
  kit_valor_mensal?: number;
  kit_valor_impostos?: number;
  kit_receita_liquida?: number;
  kit_lucro_mensal?: number;
  kit_margem?: number;
  kit_faturamento_mensal?: number;
  roi_meses?: number;
  faturamento_mensal?: number;
}

function calcRentalItem(item: RentalBudgetItem, rd: any): RentalBudgetItem {
  const isKit = !!item.opportunity_kit_id;

  let isComodato = rd.tipo_receita_rental === 'COMODATO';
  if (isKit && item.tipo_contrato_kit) {
    isComodato = item.tipo_contrato_kit === 'COMODATO';
  }

  if (isKit) {
    let kitFaturamento = 0;
    if (item.tipo_contrato_kit === 'INSTALACAO') {
      kitFaturamento = Number(item.kit_valor_mensal || 0);
    } else {
      kitFaturamento = Number(item.kit_valor_mensal || 0);
    }

    const impostosKit = Number(item.kit_valor_impostos || 0);
    const recLiqKit = kitFaturamento - impostosKit;

    let prazoMensalidades = Number(item.prazo_contrato || rd.prazo_contrato_meses || 36) - Number(rd.prazo_instalacao_meses || 0);
    if (prazoMensalidades < 0) prazoMensalidades = 0;

    const cP = Number(item.custo_op_mensal_kit || 0);
    const custoAquisicaoUnit = Number(item.custo_aquisicao_unit || 0);
    const custoTotalContrato = custoAquisicaoUnit + (cP * prazoMensalidades);

    return {
      ...item,
      faturamento_mensal: kitFaturamento,
      valor_mensal: kitFaturamento,
      impostos_mensal: impostosKit,
      receita_liquida_mensal: recLiqKit,
      lucro_mensal: Number(item.kit_lucro_mensal || 0),
      margem: Number(item.kit_margem || 0),
      roi_meses: recLiqKit > 0 ? (custoTotalContrato / recLiqKit) : 0,
      custo_total_aquisicao: custoAquisicaoUnit,
      custo_manut_mensal: Number(item.kit_vlt_manut || 0) + cP,
      custo_total_mensal: Number(item.kit_vlt_manut || 0) + cP,
      fator_margem: Number(item.fator_margem || 1)
    };
  }

  // Fallback / legacy calculation for Non-Kits (Individual items)
  const base = Number(item.custo_aquisicao_unit || 0);
  const ipi = Number(item.ipi_unit || 0);
  const frete = Number(item.frete_unit || 0);
  const st = Number(item.icms_st_unit || 0);
  const difal = Number(item.difal_unit || 0);

  let instalacao = 0;
  if (item.valor_instalacao_item != null) {
    instalacao = Number(item.valor_instalacao_item);
  } else {
    const pInstal = item.perc_instalacao_item != null ? Number(item.perc_instalacao_item) : Number(rd.perc_instalacao_padrao || 0);
    instalacao = +((base + ipi + frete + st + difal) * pInstal / 100).toFixed(4);
  }

  const custoAquisicao = base + ipi + frete + st + difal;
  const custoTotal = custoAquisicao + instalacao;

  const fm = Number(item.fator_margem || 1);
  const baseFinanceiraLocacao = +(custoTotal * fm).toFixed(4);

  const taxa = Number(rd.taxa_juros_mensal || 0) / 100;
  const prazo = Number(item.prazo_contrato || rd.prazo_contrato_meses || 36);

  let prazoMensalidades = prazo - Number(rd.prazo_instalacao_meses || 0);
  if (prazoMensalidades < 0) prazoMensalidades = 0;

  let parcela = 0;
  if (prazoMensalidades > 0 && taxa > 0) {
    const tx = taxa / (1 - Math.pow(1 + taxa, -prazoMensalidades));
    parcela = +(baseFinanceiraLocacao * tx).toFixed(4);
  } else if (prazoMensalidades > 0 && taxa === 0) {
    parcela = +(baseFinanceiraLocacao / prazoMensalidades).toFixed(4);
  }

  const taxaManut = item.usa_taxa_manut_padrao ? Number(rd.taxa_manutencao_anual || 5) : Number(item.taxa_manutencao_anual_item || 5);
  const custoManut = +(custoTotal * (taxaManut / 100) / 12).toFixed(4);

  const depreciacao = (isComodato && prazo > 0) ? +(custoTotal / prazo).toFixed(4) : 0;
  const custoMensal = custoManut + depreciacao;
  const valorMensal = parcela + custoManut;

  let pImp = Number(rd.perc_pis_rental || 0) + Number(rd.perc_cofins_rental || 0) + Number(rd.perc_csll_rental || 0) + Number(rd.perc_irpj_rental || 0);
  if (isComodato) {
    pImp += Number(rd.perc_iss_rental || 0);
  }

  const impostos = +(valorMensal * pImp / 100).toFixed(4);
  const recLiq = valorMensal - impostos;
  const pCom = Number(rd.perc_comissao_rental || 0);
  const comissao = +(recLiq * pCom / 100).toFixed(4);

  let lucro = +(recLiq - custoMensal - comissao).toFixed(4);
  let margem = valorMensal > 0 ? +(lucro / valorMensal * 100).toFixed(2) : 0;

  if (isComodato) {
    lucro = 0;
    margem = 0;
  }

  const roi = recLiq > 0 ? (custoTotal / recLiq) : 0;

  return {
    ...item,
    instalacao_unit: instalacao,
    custo_total_aquisicao: custoTotal,
    prazo_contrato: prazo,
    custo_manut_mensal: custoManut,
    custo_total_mensal: custoMensal,
    fator_margem: fm,
    valor_venda_equipamento: baseFinanceiraLocacao,
    parcela_locacao: parcela,
    manutencao_locacao: custoManut,
    valor_mensal: valorMensal,
    perc_impostos_total: pImp,
    impostos_mensal: impostos,
    receita_liquida_mensal: recLiq,
    perc_comissao: pCom,
    comissao_mensal: comissao,
    lucro_mensal: lucro,
    margem,
    roi_meses: roi,
    faturamento_mensal: valorMensal
  };
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

export function SalesBudgetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Dialog states
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const isEditing = Boolean(id);

  const { activeCompanyId } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isHeaderModalOpen, setIsHeaderModalOpen] = useState(false);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest('a');
      const isInternalNav = target && target.href && !target.href.includes(window.location.pathname) && target.target !== '_blank';

      const isTabClick = target && target.role === 'tab'; // Don't block tab switching inside the same screen

      if (isInternalNav && !isTabClick) {
        e.preventDefault();
        e.stopPropagation();
        setShowDiscardDialog(true);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, { capture: true });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [hasUnsavedChanges]);

  // Header
  const [titulo, setTitulo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [dataOrcamento, setDataOrcamento] = useState(new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState('RASCUNHO');
  const [numeroOrcamento, setNumeroOrcamento] = useState('');
  const [responsavelIds, setResponsavelIds] = useState<string[]>([]);

  // Defaults
  const [markupPadrao, setMarkupPadrao] = useState(1.35);
  const [percDespesaAdm, setPercDespesaAdm] = useState(0);
  const [percComissao, setPercComissao] = useState(0);
  const [percFreteVenda, setPercFreteVenda] = useState(0);
  const [percPis, setPercPis] = useState(0);
  const [percCofins, setPercCofins] = useState(0);
  const [percCsll, setPercCsll] = useState(0);
  const [percIrpj, setPercIrpj] = useState(0);
  const [percIss, setPercIss] = useState(0);
  const [percIcmsInterno, setPercIcmsInterno] = useState(0);
  const [percIcmsExterno, setPercIcmsExterno] = useState(0);
  // Venda tab — 4 separate fator margem fields
  const [fatorMargemProdutos, setFatorMargemProdutos] = useState(1.35);
  const [fatorMargemServicos, setFatorMargemServicos] = useState(1.35);
  const [fatorMargemInstalacao, setFatorMargemInstalacao] = useState(1.35);
  const [fatorMargemManutencao, setFatorMargemManutencao] = useState(1.35);
  const [vendaHaveraManutencao, setVendaHaveraManutencao] = useState(false);
  const [vendaQtdMesesManutencao, setVendaQtdMesesManutencao] = useState(0);
  // Controls the tax-detail info modal in Parâmetros Padrão (Venda)
  const [showTaxModal, setShowTaxModal] = useState(false);
  // Company _venda taxes — always reflects current company config, used only by the modal (read-only)
  const [companyVendaTaxes, setCompanyVendaTaxes] = useState({ pis: 0, cofins: 0, csll: 0, irpj: 0, iss: 0, icms_interno: 0, icms_externo: 0 });
  // Company MKP for Venda — drives the 4 fatorMargem fields reactively (race-condition safe)

  // Items
  const [items, setItems] = useState<SalesBudgetItem[]>([]);

  // Venda Kits State
  const [vendaKits, setVendaKits] = useState<VendaKitItem[]>([]);
  const [showApplyKitsModal, setShowApplyKitsModal] = useState(false);

  // Purchase Budget State
  const [purchaseBudgetId, setPurchaseBudgetId] = useState<string | null>(null);
  const [purchaseSupplierId, setPurchaseSupplierId] = useState('');
  const [purchasePaymentConditionId, setPurchasePaymentConditionId] = useState<string>('');
  const [purchaseFreteTipo, setPurchaseFreteTipo] = useState<'CIF' | 'FOB'>('FOB');
  const [purchaseFretePercent, setPurchaseFretePercent] = useState(0);
  const [purchaseIpiCalculado, setPurchaseIpiCalculado] = useState(false);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [isPurchaseImportModalOpen, setIsPurchaseImportModalOpen] = useState(false);
  const [isPurchaseReconciliationModalOpen, setIsPurchaseReconciliationModalOpen] = useState(false);
  const [purchaseUnresolvedItems, setPurchaseUnresolvedItems] = useState<any[]>([]);
  const [isQuickSupplierModalOpen, setIsQuickSupplierModalOpen] = useState(false);

  // Tab
  const activeTab = searchParams.get('tab') || 'venda';

  // Rental defaults
  const [tipoReceitaRental, setTipoReceitaRental] = useState('LOCACAO_PURA');
  const [prazoContratoMeses, setPrazoContratoMeses] = useState(36);
  const [prazoInstalacaoMeses, setPrazoInstalacaoMeses] = useState(1);
  const [taxaJurosMensal, setTaxaJurosMensal] = useState(0);
  const [taxaManutencaoAnual, setTaxaManutencaoAnual] = useState(5);

  const [percInstalacaoPadrao, setPercInstalacaoPadrao] = useState(0);
  const [percComissaoRental, setPercComissaoRental] = useState(0);
  const [percPisRental, setPercPisRental] = useState(0);
  const [percCofinsRental, setPercCofinsRental] = useState(0);
  const [percCsllRental, setPercCsllRental] = useState(0);
  const [percIrpjRental, setPercIrpjRental] = useState(0);
  const [percIssRental, setPercIssRental] = useState(0);
  const [percComissaoDiretoria, setPercComissaoDiretoria] = useState(0);
  const [isComparativoExpanded, setIsComparativoExpanded] = useState(false);
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(true);
  const [rentalItems, setRentalItems] = useState<RentalBudgetItem[]>([]);
  const [showAddRentalItemModal, setShowAddRentalItemModal] = useState(false);
  const [showKitSearchModal, setShowKitSearchModal] = useState(false);
  const [showKitSearchVenda, setShowKitSearchVenda] = useState(false);
  const [showCreateKitModal, setShowCreateKitModal] = useState(false);
  const [novoKitTipoContrato, setNovoKitTipoContrato] = useState<string | undefined>(undefined);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [showEvolutivoChart, setShowEvolutivoChart] = useState(false);
  const [viewingKitId, setViewingKitId] = useState<string | null>(null);

  // Lookups
  const [customers, setCustomers] = useState<any[]>([]);
  const [, setProducts] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [vendedorId, setVendedorId] = useState('');

  const isReadonly = status !== 'RASCUNHO';

  // Unused defaults useMemo removed

  const rentalDefaults = useMemo(() => ({
    tipo_receita_rental: tipoReceitaRental,
    prazo_contrato_meses: prazoContratoMeses,
    prazo_instalacao_meses: prazoInstalacaoMeses,
    taxa_juros_mensal: taxaJurosMensal,
    taxa_manutencao_anual: taxaManutencaoAnual,
    fator_margem_padrao: 1,
    fator_manutencao_padrao: 1,
    perc_instalacao_padrao: percInstalacaoPadrao,
    perc_comissao_rental: percComissaoRental,
    perc_pis_rental: percPisRental,
    perc_cofins_rental: percCofinsRental,
    perc_csll_rental: percCsllRental,
    perc_irpj_rental: percIrpjRental,
    perc_iss_rental: percIssRental,
  }), [tipoReceitaRental, prazoContratoMeses, prazoInstalacaoMeses, taxaJurosMensal, taxaManutencaoAnual, percInstalacaoPadrao, percComissaoRental, percPisRental, percCofinsRental, percCsllRental, percIrpjRental, percIssRental]);

  useEffect(() => {
    setRentalItems(prev => prev.map(item => calcRentalItem(item, rentalDefaults)));
  }, [rentalDefaults]);


  useEffect(() => {
    const loadData = async () => {
      try {
        const [custRes, prodRes, supRes, profRes, usersRes] = await Promise.all([
          api.get('/cadastro/clientes', { params: { limit: 200 } }),
          api.get('/cadastro/produtos', { params: { limit: 500 } }),
          api.get('/cadastro/fornecedores', { params: { limit: 200 } }),
          api.get('/professionals', { params: { limit: 500 } }),
          api.get('/users', { params: { limit: 500 } }),
        ]);
        setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data.items || []);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data.items || []);
        setSuppliers(Array.isArray(supRes.data) ? supRes.data : supRes.data.items || []);
        setProfessionals(Array.isArray(profRes.data) ? profRes.data : profRes.data.items || []);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : usersRes.data.items || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, []);

  // Always load company _venda taxes for the modal display, regardless of isEditing
  useEffect(() => {
    if (!activeCompanyId) return;
    api.get(`/companies/${activeCompanyId}/sales-parameters`).then(({ data }) => {
      const pick = (key: string) => Number(data[`${key}_venda`] || data[key] || 0);

      // Mapping for Locação de Equipamentos as per requirement
      const mkpLocacao = Number(data.mkp_padrao_locacao || data.mkp_padrao || 1.35);
      const despAdmLocacao = Number(data.despesa_administrativa_locacao || data.despesa_administrativa || 0);
      const comissaoLocacao = Number(data.comissionamento_locacao || data.comissionamento || 0);

      setCompanyVendaTaxes({
        pis: pick('pis'),
        cofins: pick('cofins'),
        csll: pick('csll'),
        irpj: pick('irpj'),
        iss: pick('iss'),
        icms_interno: pick('icms_interno'),
        icms_externo: pick('icms_externo'),
      });

      // For NEW budgets only: also pre-fill the other editable budget-level defaults
      if (!isEditing) {
        setFatorMargemProdutos(mkpLocacao);
        setFatorMargemServicos(mkpLocacao);
        setFatorMargemInstalacao(mkpLocacao);
        setFatorMargemManutencao(mkpLocacao);
        setMarkupPadrao(mkpLocacao);
        setPercDespesaAdm(despAdmLocacao);
        setPercComissao(comissaoLocacao);
        setPercPis(pick('pis'));
        setPercCofins(pick('cofins'));
        setPercCsll(pick('csll'));
        setPercIrpj(pick('irpj'));
        setPercIss(pick('iss'));
        setPercIcmsInterno(pick('icms_interno'));
        setPercIcmsExterno(pick('icms_externo'));
      }
    }).catch(err => console.error('Failed to load company sales parameters:', err));
  }, [activeCompanyId, isEditing]);



  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/sales-budgets/${id}`).then(async (res) => {
      const d = res.data;
      setTitulo(d.titulo);
      setCustomerId(d.customer_id);
      setVendedorId(d.vendedor_id || '');
      setObservacoes(d.observacoes || '');
      setDataOrcamento(d.data_orcamento?.slice(0, 10) || '');
      setStatus(d.status);
      setNumeroOrcamento(d.numero_orcamento || '');
      setResponsavelIds(d.responsavel_ids || []);
      if (d.markup_padrao) setMarkupPadrao(d.markup_padrao);
      if (d.venda_markup_produtos) setFatorMargemProdutos(d.venda_markup_produtos);
      if (d.venda_markup_servicos) setFatorMargemServicos(d.venda_markup_servicos);
      if (d.venda_markup_instalacao) setFatorMargemInstalacao(d.venda_markup_instalacao);
      if (d.venda_markup_manutencao) setFatorMargemManutencao(d.venda_markup_manutencao);
      setVendaHaveraManutencao(!!d.venda_havera_manutencao);
      setVendaQtdMesesManutencao(d.venda_qtd_meses_manutencao || 0);
      setPercDespesaAdm(d.perc_despesa_adm);
      setPercComissao(d.perc_comissao);
      setPercFreteVenda(d.perc_frete_venda);
      setPercPis(d.perc_pis);
      setPercCofins(d.perc_cofins);
      setPercCsll(d.perc_csll);
      setPercIrpj(d.perc_irpj);
      setPercIss(d.perc_iss);
      setPercIcmsInterno(d.perc_icms_interno);
      setPercIcmsExterno(d.perc_icms_externo);

      // Rental defaults
      setTipoReceitaRental(d.tipo_receita_rental || 'LOCACAO_PURA');
      setPrazoContratoMeses(d.prazo_contrato_meses ?? 36);
      setPrazoInstalacaoMeses(d.prazo_instalacao_meses ?? 1);
      setTaxaJurosMensal(Number(d.taxa_juros_mensal) || 0);
      setTaxaManutencaoAnual(Number(d.taxa_manutencao_anual) || 5);

      setPercInstalacaoPadrao(Number(d.perc_instalacao_padrao) || 0);
      setPercComissaoRental(Number(d.perc_comissao_rental) || 0);
      setPercPisRental(Number(d.perc_pis_rental) || 0);
      setPercCofinsRental(Number(d.perc_cofins_rental) || 0);
      setPercCsllRental(Number(d.perc_csll_rental) || 0);
      setPercIrpjRental(Number(d.perc_irpj_rental) || 0);
      setPercIssRental(Number(d.perc_iss_rental) || 0);
      setPercComissaoDiretoria(Number(d.perc_comissao_diretoria) || 0);

      // Load sale items and separate kits from regular items
      const loadedItems: SalesBudgetItem[] = d.items || [];
      const vKits: VendaKitItem[] = [];
      const regularItems: SalesBudgetItem[] = [];

      for (const item of loadedItems) {
        if (item.opportunity_kit_id) {
          try {
            const { data: kit } = await api.get(`/opportunity-kits/${item.opportunity_kit_id}?include_financials=true`);
            const q = item.quantidade || kit.quantidade_kits || 1;
            vKits.push({
              opportunity_kit_id: item.opportunity_kit_id,
              nome_kit: kit.nome_kit || 'Kit Venda',
              quantidade: q,
              fator_margem_locacao: Number(kit.fator_margem_locacao || 1),
              fator_margem_servicos_produtos: Number(kit.fator_margem_servicos_produtos || 1),
              fator_margem_instalacao: Number(kit.fator_margem_instalacao || 1),
              fator_margem_manutencao: Number(kit.fator_margem_manutencao || 1),

              custo_aquisicao_equip_unit: Number(kit.summary?.custo_aquisicao_total || 0) + Number(kit.summary?.vlr_instal_calc || 0),
              custo_manutencao_unit: Number(kit.summary?.vlt_manut || 0),

              venda_equip_unit: Number(kit.summary?.venda_equipamentos_total ?? kit.summary?.valor_mensal_kit ?? 0),
              venda_manut_unit: Number(kit.summary?.venda_manutencao_total ?? 0),

              faturamento_total: Number(kit.summary?.faturamento_total_venda ?? (Number(kit.summary?.venda_equipamentos_total || 0) + Number(kit.summary?.venda_manutencao_total || 0))),

              lucro_venda: Number(kit.summary?.lucro_equipamentos || 0),
              margem_venda: Number(kit.summary?.margem_equipamentos || 0),

              lucro_manutencao: Number(kit.summary?.lucro_manutencao || 0),
              margem_manutencao: Number(kit.summary?.margem_manutencao || 0),

              lucro_final: Number(kit.summary?.lucro_mensal_kit || 0),
              margem_geral: Number(kit.summary?.margem_kit || 0),

              havera_manutencao: kit.havera_manutencao,
              qtd_meses_manutencao: kit.qtd_meses_manutencao,
              summary: kit.summary,
              kit_raw: kit
            });
          } catch (err) {
            console.error('Error loading kit in Venda:', err);
          }
        } else {
          try {
            if (item.product_id) {
              const { data: cc } = await api.get(`/sales-budgets/product-cost-composition/${item.product_id}`);
              regularItems.push({ ...item, cost_composition: cc });
            } else {
              regularItems.push(item);
            }
          } catch {
            regularItems.push(item);
          }
        }
      }

      setItems(regularItems);
      setVendaKits(vKits);

      // Load rental items and re-fetch cost_composition (USO_CONSUMO)
      const loadedRental: RentalBudgetItem[] = d.rental_items || [];
      const enrichedRental = await Promise.all(
        loadedRental.map(async (item: RentalBudgetItem) => {
          if (item.product_id) {
            try {
              const { data: cc } = await api.get(`/sales-budgets/product-cost-composition/${item.product_id}?tipo=USO_CONSUMO`);
              return {
                ...item,
                custo_aquisicao_unit: cc.base_unitario ?? item.custo_aquisicao_unit,
                ipi_unit: cc.ipi_unitario ?? item.ipi_unit,
                frete_unit: cc.frete_cif_unitario ?? item.frete_unit,
                icms_st_unit: 0,
                difal_unit: cc.difal_unitario ?? 0,
                cost_composition: cc,
              };
            } catch { /* fallback */ }
          } else if (item.opportunity_kit_id) {
            try {
              const { data: kit } = await api.get(`/opportunity-kits/${item.opportunity_kit_id}?include_financials=true`);
              return {
                ...item,
                custo_op_mensal_kit: Number(kit.summary?.custo_operacional_mensal_kit || 0),
                kit_custo_produtos: Number(kit.summary?.custo_aquisicao_produtos || 0),
                kit_custo_servicos: Number(kit.summary?.custo_aquisicao_servicos || 0),
                custo_aquisicao_unit: Number(kit.summary?.custo_aquisicao_total || 0),
                ipi_unit: Number(kit.summary?.total_ipi_kit || 0),
                frete_unit: Number(kit.summary?.total_frete_kit || 0),
                icms_st_unit: Number(kit.summary?.total_st_kit || 0),
                difal_unit: Number(kit.summary?.total_difal_kit || 0),
                taxa_manutencao_anual_item: Number(kit.taxa_manutencao_anual || 0),
                kit_vlt_manut: Number(kit.summary?.vlt_manut || 0),
                kit_valor_mensal: kit.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? Number(kit.summary?.venda_equipamentos_total || 0) : Number(kit.summary?.valor_mensal_antes_impostos ?? kit.summary?.valor_mensal_kit ?? 0),
                kit_valor_impostos: Number(kit.summary?.valor_impostos ?? 0),
                kit_receita_liquida: Number(kit.summary?.receita_liquida_mensal_kit || 0),
                kit_lucro_mensal: Number(kit.summary?.lucro_mensal_kit || 0),
                kit_margem: Number(kit.summary?.margem_kit || 0),
              };
            } catch { /* fallback */ }
          }
          return item;
        })
      );

      const rDefaults = {
        prazo_contrato_meses: d.prazo_contrato_meses,
        prazo_instalacao_meses: d.prazo_instalacao_meses,
        taxa_juros_mensal: d.taxa_juros_mensal,
        taxa_manutencao_anual: d.taxa_manutencao_anual,
        fator_margem_padrao: 1,
        fator_manutencao_padrao: 1,
        perc_instalacao_padrao: d.perc_instalacao_padrao,
        perc_comissao_rental: d.perc_comissao_rental,
        perc_pis_rental: d.perc_pis_rental,
        perc_cofins_rental: d.perc_cofins_rental,
        perc_csll_rental: d.perc_csll_rental,
        perc_irpj_rental: d.perc_irpj_rental,
        perc_iss_rental: d.perc_iss_rental,
        perc_comissao_diretoria: d.perc_comissao_diretoria,
        tipo_receita_rental: d.tipo_receita_rental,
      };

      setRentalItems(enrichedRental.map(ri => calcRentalItem(ri, rDefaults)));

      // Load Purchase Budget
      try {
        const { data: pbData } = await api.get(`/purchase-budgets`, { params: { sales_budget_id: id } });
        if (pbData && pbData.length > 0) {
          const pb = pbData[0];
          setPurchaseBudgetId(pb.id);
          setPurchaseSupplierId(pb.supplier_id);
          setPurchasePaymentConditionId(pb.payment_condition_id || '');
          setPurchaseFreteTipo(pb.frete_tipo);
          setPurchaseFretePercent(pb.frete_percent);
          setPurchaseIpiCalculado(pb.ipi_calculado);

          if (pb.items) {
            setPurchaseItems(pb.items.map((i: any) => ({
              product_id: i.product_id,
              product_nome: i.product?.nome || '',
              product_codigo: i.product?.codigo || '',
              codigo_fornecedor: i.codigo_fornecedor || '',
              ncm: i.ncm || '',
              quantidade: i.quantidade,
              valor_unitario: i.valor_unitario,
              frete_percent: i.frete_percent,
              ipi_percent: i.ipi_percent,
              icms_percent: i.icms_percent,
              frete_valor: i.frete_valor,
              ipi_valor: i.ipi_valor,
              total_item: i.total_item
            })));
          }
        }
      } catch (err) {
        console.error('Failed to load purchase budget associated with sales budget', err);
      }

    }).catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);


  // ── Rental item functions ──
  const handleAddRentalItem = (modalOutput: any) => {
    setHasUnsavedChanges(true);
    const { product, quantidade, perc_instalacao_item, valor_instalacao_item, cost_composition } = modalOutput;

    const base = cost_composition?.base_unitario ?? (product.vlr_referencia_uso_consumo || product.vlr_referencia_revenda || 0);
    const newItem: RentalBudgetItem = {
      product_id: product.id,
      product_nome: product.nome,
      product_codigo: product.codigo,
      quantidade: quantidade,
      perc_instalacao_item: perc_instalacao_item,
      valor_instalacao_item: valor_instalacao_item,
      custo_aquisicao_unit: base,
      ipi_unit: cost_composition?.ipi_unitario ?? 0,
      frete_unit: cost_composition?.frete_cif_unitario ?? 0,
      icms_st_unit: 0,
      difal_unit: cost_composition?.difal_unitario ?? 0,
      instalacao_unit: 0,
      custo_total_aquisicao: 0,
      prazo_contrato: prazoContratoMeses,
      usa_taxa_manut_padrao: true,
      taxa_manutencao_anual_item: null,
      fator_margem: 1,
      custo_manut_mensal: 0, custo_total_mensal: 0,
      valor_venda_equipamento: 0, parcela_locacao: 0, manutencao_locacao: 0, valor_mensal: 0,
      perc_impostos_total: 0, impostos_mensal: 0, receita_liquida_mensal: 0,
      perc_comissao: 0, comissao_mensal: 0, lucro_mensal: 0, margem: 0,
      cost_composition: cost_composition,
    };
    setRentalItems(prev => [...prev, calcRentalItem(newItem, rentalDefaults)]);
  };

  const handleAddKit = (kit: any) => {
    if (!kit) return;
    setHasUnsavedChanges(true);
    setRentalItems(prev => {
      const newItem: RentalBudgetItem = {
        opportunity_kit_id: kit.id,
        product_id: null,
        product_nome: `Kit: ${kit.nome_kit || 'Personalizado'}`,
        product_codigo: 'KIT-GLOBAL',
        custo_op_mensal_kit: Number(kit.summary?.custo_operacional_mensal_kit || 0),
        // Kit Integration Fields
        is_kit_instalacao: kit.tipo_contrato === 'INSTALACAO',
        tipo_contrato_kit: kit.tipo_contrato,
        kit_taxa_juros_mensal: kit.taxa_juros_mensal != null ? Number(kit.taxa_juros_mensal) : null,
        kit_custo_produtos: Number(kit.summary?.custo_aquisicao_produtos || 0),
        kit_custo_servicos: Number(kit.summary?.custo_aquisicao_servicos || 0),
        kit_pis: Number(kit.aliq_pis || 0),
        kit_cofins: Number(kit.aliq_cofins || 0),
        kit_csll: Number(kit.aliq_csll || 0),
        kit_irpj: Number(kit.aliq_irpj || 0),
        kit_iss: Number(kit.aliq_iss || 0),

        quantidade: Number(kit.quantidade_kits || 1),
        perc_instalacao_item: null,
        valor_instalacao_item: 0,
        custo_aquisicao_unit: Number(kit.summary?.custo_aquisicao_total || 0),
        ipi_unit: Number(kit.summary?.total_ipi_kit || 0),
        frete_unit: Number(kit.summary?.total_frete_kit || 0),
        icms_st_unit: Number(kit.summary?.total_st_kit || 0),
        difal_unit: Number(kit.summary?.total_difal_kit || 0),
        instalacao_unit: 0,
        custo_total_aquisicao: 0,
        prazo_contrato: Number(kit.prazo_contrato_meses || prazoContratoMeses),
        usa_taxa_manut_padrao: false,
        taxa_manutencao_anual_item: Number(kit.taxa_manutencao_anual || 0),
        fator_margem: Number(kit.fator_margem_locacao || 1),
        kit_vlt_manut: Number(kit.summary?.vlt_manut || 0),
        kit_valor_mensal: kit.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? Number(kit.summary?.venda_equipamentos_total || 0) : Number(kit.summary?.valor_mensal_antes_impostos ?? kit.summary?.valor_mensal_kit ?? 0),
        kit_valor_impostos: Number(kit.summary?.valor_impostos ?? 0),
        kit_receita_liquida: Number(kit.summary?.receita_liquida_mensal_kit || 0),
        kit_lucro_mensal: Number(kit.summary?.lucro_mensal_kit || 0),
        kit_margem: Number(kit.summary?.margem_kit || 0),
        custo_manut_mensal: 0,
        custo_total_mensal: 0,
        valor_venda_equipamento: 0, parcela_locacao: 0, manutencao_locacao: 0, valor_mensal: 0,
        perc_impostos_total: 0, impostos_mensal: 0, receita_liquida_mensal: 0,
        perc_comissao: 0, comissao_mensal: 0, lucro_mensal: 0, margem: 0,
      };
      return [...prev, calcRentalItem(newItem, rentalDefaults)];
    });
  };

  const handleAddKitVenda = (kit: any) => {
    if (!kit) return;
    setHasUnsavedChanges(true);
    const q = Number(kit.quantidade_kits || 1);
    const newKit: VendaKitItem = {
      opportunity_kit_id: kit.id,
      nome_kit: kit.nome_kit || 'Kit Venda',
      quantidade: q,
      fator_margem_locacao: Number(kit.fator_margem_locacao || 1),
      fator_margem_servicos_produtos: Number(kit.fator_margem_servicos_produtos || 1),
      fator_margem_instalacao: Number(kit.fator_margem_instalacao || 1),
      fator_margem_manutencao: Number(kit.fator_margem_manutencao || 1),

      custo_aquisicao_equip_unit: Number(kit.summary?.custo_aquisicao_total || 0) + Number(kit.summary?.vlr_instal_calc || 0),
      custo_manutencao_unit: Number(kit.summary?.vlt_manut || 0),

      venda_equip_unit: Number(kit.summary?.venda_equipamentos_total ?? kit.summary?.valor_mensal_kit ?? 0),
      venda_manut_unit: Number(kit.summary?.venda_manutencao_total ?? 0),

      faturamento_total: Number(kit.summary?.faturamento_total_venda ?? (Number(kit.summary?.venda_equipamentos_total || 0) + Number(kit.summary?.venda_manutencao_total || 0))),

      lucro_venda: Number(kit.summary?.lucro_equipamentos || 0),
      margem_venda: Number(kit.summary?.margem_equipamentos || 0),

      lucro_manutencao: Number(kit.summary?.lucro_manutencao || 0),
      margem_manutencao: Number(kit.summary?.margem_manutencao || 0),

      lucro_final: Number(kit.summary?.lucro_mensal_kit || 0),
      margem_geral: Number(kit.summary?.margem_kit || 0),

      summary: kit.summary,
      kit_raw: kit,
      havera_manutencao: !!kit.havera_manutencao,
      qtd_meses_manutencao: kit.qtd_meses_manutencao ?? null
    };
    setVendaKits(prev => [...prev, newKit]);
    setShowKitSearchVenda(false);
  };

  const updateRentalItem = (idx: number, field: string, value: any) => {
    setRentalItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };
      updated[idx] = calcRentalItem(item, rentalDefaults);
      return updated;
    });
  };

  const updateVendaKit = (idx: number, field: keyof VendaKitItem, value: any) => {
    setVendaKits(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };

      // Not storing pre-multiplied totals in state anymore to ensure React reactivity safely
      // Only the unit is stored, the grid component handles Qtd calculations.

      updated[idx] = item;
      return updated;
    });
  };

  const removeVendaKit = (idx: number) => {
    setHasUnsavedChanges(true);
    setVendaKits(prev => prev.filter((_, i) => i !== idx));
  };

  const handleApplyKitsParams = (e?: any) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (vendaKits.length === 0) return;
    setShowApplyKitsModal(true);
  };

  const proceedApplyKits = async (overriddenParams?: any) => {
    setSaving(true);
    setShowApplyKitsModal(false);
    console.log('Applying params to kits...', vendaKits.length);
    try {
      const updatedKits = [...vendaKits];
      for (let i = 0; i < updatedKits.length; i++) {
        const vk = updatedKits[i];
        const isGlobal = !vk.kit_raw?.sales_budget_id;

        const payload = overriddenParams || {
          fator_margem_locacao: fatorMargemProdutos,
          fator_margem_servicos_produtos: fatorMargemServicos,
          fator_margem_instalacao: fatorMargemInstalacao,
          fator_margem_manutencao: fatorMargemManutencao
          // RN02: Alterar apenas os campos de parâmetros financeiros equivalentes
        };

        let finalKitId = vk.opportunity_kit_id;

        let finalKitData = null;

        if (isGlobal) {
          console.log(`Cloning global kit ${vk.opportunity_kit_id} for budget ${id}`);
          const raw = vk.kit_raw || {};

          const itemsPayload = (raw.items || []).map((item: any) => ({
            product_id: item.product_id || item.produto?.id,
            own_service_id: item.own_service_id,
            tipo_item: item.tipo_item,
            descricao_item: item.descricao_item,
            quantidade_no_kit: Number(item.quantidade_no_kit || 1)
          }));

          const costsPayload = (raw.costs || []).map((c: any) => ({
            product_id: c.product_id || c.produto?.id,
            own_service_id: c.own_service_id,
            tipo_item: c.tipo_item,
            forma_execucao: c.forma_execucao,
            tipo_custo: c.tipo_custo,
            quantidade: Number(c.quantidade || 1),
            valor_unitario: Number(c.valor_unitario || 0)
          }));

          const clonePayload = {
            nome_kit: raw.nome_kit || vk.nome_kit || 'Kit Personalizado',
            descricao_kit: raw.descricao_kit || null,
            quantidade_kits: raw.quantidade_kits || 1,
            tipo_contrato: raw.tipo_contrato || 'VENDA_EQUIPAMENTOS',
            prazo_contrato_meses: raw.prazo_contrato_meses || 36,
            prazo_instalacao_meses: raw.prazo_instalacao_meses || 0,
            instalacao_inclusa: !!raw.instalacao_inclusa,
            percentual_instalacao: raw.percentual_instalacao,
            manutencao_inclusa: !!raw.manutencao_inclusa,
            fator_manutencao: raw.fator_manutencao,
            aliq_pis: raw.aliq_pis,
            aliq_cofins: raw.aliq_cofins,
            aliq_csll: raw.aliq_csll,
            aliq_irpj: raw.aliq_irpj,
            aliq_iss: raw.aliq_iss,
            aliq_icms: raw.aliq_icms,
            perc_frete_venda: raw.perc_frete_venda,
            perc_despesas_adm: raw.perc_despesas_adm,
            perc_comissao: raw.perc_comissao,
            havera_manutencao: raw.havera_manutencao,
            qtd_meses_manutencao: raw.qtd_meses_manutencao,
            sales_budget_id: id,
            ...payload,
            items: itemsPayload,
            costs: costsPayload
          };

          const { data } = await api.post(`/opportunity-kits/company/${activeCompanyId}`, clonePayload);
          finalKitId = data.id;
          finalKitData = data;
        } else {
          console.log(`Updating budget kit ${vk.opportunity_kit_id}`);
          await api.patch(`/opportunity-kits/${vk.opportunity_kit_id}`, payload);
          const { data } = await api.get(`/opportunity-kits/${vk.opportunity_kit_id}?include_financials=true`);
          finalKitId = data.id;
          finalKitData = data;
        }

        updatedKits[i] = {
          ...vk,
          opportunity_kit_id: finalKitId,
          fator_margem_locacao: Number(finalKitData.fator_margem_locacao || 1),
          fator_margem_servicos_produtos: Number(finalKitData.fator_margem_servicos_produtos || 1),
          fator_margem_instalacao: Number(finalKitData.fator_margem_instalacao || 1),
          fator_margem_manutencao: Number(finalKitData.fator_margem_manutencao || 1),

          custo_aquisicao_equip_unit: Number(finalKitData.summary?.custo_aquisicao_total || 0) + Number(finalKitData.summary?.vlr_instal_calc || 0),
          custo_manutencao_unit: Number(finalKitData.summary?.vlt_manut || 0),

          venda_equip_unit: Number(finalKitData.summary?.venda_equipamentos_total ?? finalKitData.summary?.valor_mensal_kit ?? 0),
          venda_manut_unit: Number(finalKitData.summary?.venda_manutencao_total ?? 0),

          faturamento_total: Number(finalKitData.summary?.faturamento_total_venda ?? (Number(finalKitData.summary?.venda_equipamentos_total || 0) + Number(finalKitData.summary?.venda_manutencao_total || 0))),

          lucro_venda: Number(finalKitData.summary?.lucro_equipamentos || 0),
          margem_venda: Number(finalKitData.summary?.margem_equipamentos || 0),

          lucro_manutencao: Number(finalKitData.summary?.lucro_manutencao || 0),
          margem_manutencao: Number(finalKitData.summary?.margem_manutencao || 0),

          lucro_final: Number(finalKitData.summary?.lucro_mensal_kit || 0),
          margem_geral: Number(finalKitData.summary?.margem_kit || 0),

          summary: finalKitData.summary,
          kit_raw: finalKitData,
          havera_manutencao: !!finalKitData.havera_manutencao,
          qtd_meses_manutencao: finalKitData.qtd_meses_manutencao ?? null
        };
      }

      const success = await handleSave(true, undefined, updatedKits);
      if (!success) return;

      alert('Parâmetros aplicados aos kits com sucesso!');
      window.location.reload();
    } catch (err) {
      console.error('Failed to apply kit params:', err);
      alert('Erro ao aplicar parâmetros aos kits.');
    } finally {
      setSaving(false);
    }
  };

  const handleRefreshParams = async () => {
    if (!activeCompanyId) return;
    if (!window.confirm("Deseja atualizar os parâmetros com base no cadastro da empresa? Os valores atuais serão substituídos.")) return;

    try {
      setSaving(true);
      const { data } = await api.get(`/companies/${activeCompanyId}/sales-parameters`);

      const mkpLocacao = Number(data.mkp_padrao_locacao || data.mkp_padrao || 1.35);
      const despAdmLocacao = Number(data.despesa_administrativa_locacao || data.despesa_administrativa || 0);
      const comissaoLocacao = Number(data.comissionamento_locacao || data.comissionamento || 0);
      const pick = (key: string) => Number(data[`${key}_venda`] || data[key] || 0);

      // Update basic fields
      setFatorMargemProdutos(mkpLocacao);
      setFatorMargemServicos(mkpLocacao);
      setFatorMargemInstalacao(mkpLocacao);
      setFatorMargemManutencao(mkpLocacao);
      setMarkupPadrao(mkpLocacao);
      setPercDespesaAdm(despAdmLocacao);
      setPercComissao(comissaoLocacao);

      const taxes = {
        aliq_pis: pick('pis'),
        aliq_cofins: pick('cofins'),
        aliq_csll: pick('csll'),
        aliq_irpj: pick('irpj'),
        aliq_iss: pick('iss'),
        aliq_icms: pick('icms_interno'),
        perc_frete_venda: pick('frete_venda_padrao'),
        perc_despesas_adm: despAdmLocacao,
        perc_comissao: comissaoLocacao,
      };

      setPercPis(taxes.aliq_pis);
      setPercCofins(taxes.aliq_cofins);
      setPercCsll(taxes.aliq_csll);
      setPercIrpj(taxes.aliq_irpj);
      setPercIss(taxes.aliq_iss);
      setPercIcmsInterno(taxes.aliq_icms);
      setPercFreteVenda(taxes.perc_frete_venda);

      setHasUnsavedChanges(true);

      // Cascade update to kits
      if (vendaKits.length > 0) {
        await proceedApplyKits({
          fator_margem_locacao: mkpLocacao,
          fator_margem_servicos_produtos: mkpLocacao,
          fator_margem_instalacao: mkpLocacao,
          fator_margem_manutencao: mkpLocacao,
          ...taxes,
          havera_manutencao: vendaHaveraManutencao,
          qtd_meses_manutencao: vendaQtdMesesManutencao,
          sales_budget_id: id
        });
      }

    } catch (err) {
      console.error('Failed to refresh parameters:', err);
      alert('Erro ao carregar parâmetros da empresa.');
    } finally {
      setSaving(false);
    }
  };

  const removeRentalItem = (idx: number) => {
    setHasUnsavedChanges(true);
    setRentalItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBlurRentalItem = async (idx: number, field: string, value: any) => {
    const item = rentalItems[idx];
    if (!item.opportunity_kit_id) return;

    try {
      const payload: any = {};
      if (field === 'prazo_contrato') payload.prazo_contrato_meses = value;
      else return; // only sync specific fields

      const res = await api.put(`/opportunity-kits/${item.opportunity_kit_id}`, payload);
      const updatedKit = res.data;

      setRentalItems(prev => {
        const updated = [...prev];
        updated[idx] = calcRentalItem({
          ...updated[idx],
          custo_op_mensal_kit: Number(updatedKit.summary?.custo_operacional_mensal_kit || 0),
          kit_custo_produtos: Number(updatedKit.summary?.custo_aquisicao_produtos || 0),
          kit_custo_servicos: Number(updatedKit.summary?.custo_aquisicao_servicos || 0),
          custo_aquisicao_unit: Number(updatedKit.summary?.custo_aquisicao_total || 0),
          ipi_unit: Number(updatedKit.summary?.total_ipi_kit || 0),
          frete_unit: Number(updatedKit.summary?.total_frete_kit || 0),
          icms_st_unit: Number(updatedKit.summary?.total_st_kit || 0),
          difal_unit: Number(updatedKit.summary?.total_difal_kit || 0),
          taxa_manutencao_anual_item: Number(updatedKit.taxa_manutencao_anual || 0),
          kit_vlt_manut: Number(updatedKit.summary?.vlt_manut || 0),
          kit_valor_mensal: updatedKit.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? Number(updatedKit.summary?.venda_equipamentos_total || 0) : Number(updatedKit.summary?.valor_mensal_antes_impostos ?? updatedKit.summary?.valor_mensal_kit ?? 0),
          kit_valor_impostos: Number(updatedKit.summary?.valor_impostos ?? 0),
          kit_receita_liquida: Number(updatedKit.summary?.receita_liquida_mensal_kit || 0),
          kit_lucro_mensal: Number(updatedKit.summary?.lucro_mensal_kit || 0),
          kit_margem: Number(updatedKit.summary?.margem_kit || 0),
          // these won't change but just to ensure syncing:
          kit_pis: Number(updatedKit.aliq_pis || 0),
          kit_cofins: Number(updatedKit.aliq_cofins || 0),
          kit_csll: Number(updatedKit.aliq_csll || 0),
          kit_irpj: Number(updatedKit.aliq_irpj || 0),
          kit_iss: Number(updatedKit.aliq_iss || 0)
        }, rentalDefaults);
        return updated;
      });
    } catch (err) {
      console.error("Erro ao sincronizar kit backend:", err);
    }
  };

  // Tooltip state for cost composition and tax breakdown
  // (removed, using Portal Tooltip instead)

  // Totals
  const totals = useMemo(() => {
    const t = {
      custo: 0, venda: 0, frete: 0, impostos: 0,
      despAdm: 0, comissao: 0, lucro: 0,
      // Cost composition breakdown
      base_fornecedor: 0, total_ipi: 0, total_frete_compra: 0, total_icms_st: 0,
      // Tax breakdown (sales)
      total_pis: 0, total_cofins: 0, total_csll: 0,
      total_irpj: 0, total_icms: 0, total_iss: 0,
    };
    items.forEach(i => {
      const q = i.quantidade;
      const cc = i.cost_composition;
      t.custo += i.custo_unit_base * q;
      t.venda += i.venda_unit * q;
      t.frete += i.frete_venda_unit * q;
      t.impostos += (i.pis_unit + i.cofins_unit + i.csll_unit + i.irpj_unit + i.icms_unit + i.iss_unit) * q;
      t.despAdm += i.despesa_adm_unit * q;
      t.comissao += i.comissao_unit * q;
      t.lucro += i.lucro_unit * q;
      // Cost breakdown from composition
      t.base_fornecedor += (cc?.base_unitario ?? i.custo_unit_base) * q;
      t.total_ipi += (cc?.ipi_unitario ?? 0) * q;
      t.total_frete_compra += (cc?.frete_cif_unitario ?? 0) * q;
      t.total_icms_st += (cc?.icms_st_final ?? 0) * q;
      // Tax breakdown
      t.total_pis += i.pis_unit * q;
      t.total_cofins += i.cofins_unit * q;
      t.total_csll += i.csll_unit * q;
      t.total_irpj += i.irpj_unit * q;
      t.total_icms += i.icms_unit * q;
      t.total_iss += i.iss_unit * q;
    });

    // Add Venda Kits to totals
    vendaKits.forEach(vk => {
      const q = vk.quantidade;
      const s = vk.summary;
      if (!s) {
        // Fallback to local properties if summary is missing (though it shouldn't be)
        t.custo += (vk.custo_aquisicao_equip_unit + vk.custo_manutencao_unit) * q;
        t.venda += vk.faturamento_total * q;
        t.lucro += vk.lucro_final * q;
        return;
      }

      t.custo += (s.custo_equip_total_calc + s.custo_manut_total_calc) * q;
      t.venda += (s.faturamento_total_venda ?? (s.venda_equipamentos_total + s.venda_manutencao_total)) * q;
      t.frete += (s.vlt_frete_venda || 0) * q;
      t.impostos += (s.vlt_pis + s.vlt_cofins + s.vlt_csll + s.vlt_irpj + s.vlt_icms + s.vlt_iss) * q;
      t.despAdm += (s.vlt_despesas_adm || 0) * q;
      t.comissao += (s.vlt_comissao || 0) * q;
      t.lucro += s.lucro_mensal_kit * q;

      t.total_pis += s.vlt_pis * q;
      t.total_cofins += s.vlt_cofins * q;
      t.total_csll += s.vlt_csll * q;
      t.total_irpj += s.vlt_irpj * q;
      t.total_icms += s.vlt_icms * q;
      t.total_iss += (s.vlt_iss || 0) * q;
    });

    return { ...t, margem: t.venda > 0 ? (t.lucro / t.venda * 100) : 0 };
  }, [items, vendaKits]);

  // Rental totals
  const rentalTotals = useMemo(() => {
    const t = {
      investimento: 0, investimentoInstalacao: 0, faturamentoMensal: 0, impostosMensal: 0, receitaLiqMensal: 0, custoMensal: 0, lucroMensal: 0,
      fornecedoresTotal: 0, impostosCompraTotal: 0, freteTotal: 0, faturamentoTotal: 0, impostosTotal: 0,
      custoOpMensalTotal: 0, custoOpTotal: 0, totalInstalacao: 0,
      impostosInstalacaoTotal: 0, custoOpInstalacaoTotal: 0,
      impostosDetalhados: { pis: 0, cofins: 0, csll: 0, irpj: 0, iss: 0 },
      impostosInstalacaoDetalhados: { pis: 0, cofins: 0, csll: 0, irpj: 0, iss: 0 }
    };
    rentalItems.forEach(i => {
      const q = i.quantidade;

      t.investimento += i.custo_total_aquisicao * q;
      const impostos = i.impostos_mensal * q;

      if (i.is_kit_instalacao) {
        t.totalInstalacao += (i.faturamento_mensal || i.valor_mensal || 0) * q;
        t.investimentoInstalacao += i.custo_total_aquisicao * q;
        t.impostosInstalacaoTotal += impostos;
        t.custoOpInstalacaoTotal += (i.custo_op_mensal_kit || 0) * q;
      } else {
        t.faturamentoMensal += (i.faturamento_mensal || i.valor_mensal) * q;
        t.impostosMensal += impostos;
        t.receitaLiqMensal += (i.receita_liquida_mensal || i.kit_receita_liquida || 0) * q;
        t.custoMensal += i.custo_total_mensal * q;
        t.lucroMensal += i.lucro_mensal * q;
        t.custoOpMensalTotal += (i.custo_op_mensal_kit || 0) * q;
      }

      const difal_ipi_st = ((i.difal_unit || 0) + (i.ipi_unit || 0) + (i.icms_st_unit || 0)) * q;
      const frete = (i.frete_unit || 0) * q;

      t.impostosCompraTotal += difal_ipi_st;
      t.freteTotal += frete;
      t.fornecedoresTotal += (i.custo_total_aquisicao * q) - difal_ipi_st - frete;

      // Breakdown monthly taxes
      const isInstalacao = i.is_kit_instalacao;
      const tTarget = isInstalacao ? t.impostosInstalacaoDetalhados : t.impostosDetalhados;

      if (i.opportunity_kit_id) {
        const isCom = i.tipo_contrato_kit === 'COMODATO' || i.tipo_contrato_kit === 'INSTALACAO';
        const pImp = (i.kit_pis || 0) + (i.kit_cofins || 0) + (i.kit_csll || 0) + (i.kit_irpj || 0) + (isCom ? (i.kit_iss || 0) : 0);
        if (pImp > 0) {
          tTarget.pis += impostos * ((i.kit_pis || 0) / pImp);
          tTarget.cofins += impostos * ((i.kit_cofins || 0) / pImp);
          tTarget.csll += impostos * ((i.kit_csll || 0) / pImp);
          tTarget.irpj += impostos * ((i.kit_irpj || 0) / pImp);
          if (isCom) tTarget.iss += impostos * ((i.kit_iss || 0) / pImp);
        }
      } else {
        let pImp = Number(rentalDefaults.perc_pis_rental || 0) + Number(rentalDefaults.perc_cofins_rental || 0) + Number(rentalDefaults.perc_csll_rental || 0) + Number(rentalDefaults.perc_irpj_rental || 0);
        const isCom = rentalDefaults.tipo_receita_rental === 'COMODATO' || i.tipo_contrato_kit === 'COMODATO';
        if (isCom) pImp += Number(rentalDefaults.perc_iss_rental || 0);
        if (pImp > 0) {
          tTarget.pis += impostos * ((Number(rentalDefaults.perc_pis_rental) || 0) / pImp);
          tTarget.cofins += impostos * ((Number(rentalDefaults.perc_cofins_rental) || 0) / pImp);
          tTarget.csll += impostos * ((Number(rentalDefaults.perc_csll_rental) || 0) / pImp);
          tTarget.irpj += impostos * ((Number(rentalDefaults.perc_irpj_rental) || 0) / pImp);
          if (isCom) tTarget.iss += impostos * ((Number(rentalDefaults.perc_iss_rental) || 0) / pImp);
        }
      }
    });

    // Calculate global totals using the global contract term card
    const prazoFaturamento = Math.max(0, (prazoContratoMeses || 1) - (prazoInstalacaoMeses || 0));
    t.faturamentoTotal = (t.faturamentoMensal * prazoFaturamento) + t.totalInstalacao;
    t.impostosTotal = (t.impostosMensal * prazoFaturamento) + t.impostosInstalacaoTotal;
    t.custoOpTotal = (t.custoOpMensalTotal * prazoFaturamento) + t.custoOpInstalacaoTotal;

    const divisor_roi = (t.faturamentoTotal - t.impostosTotal) / (prazoContratoMeses || 1);
    const roiMeses = divisor_roi > 0 ? ((t.investimento + t.custoOpTotal) / divisor_roi) : 0;

    return { ...t, margem: t.faturamentoMensal > 0 ? (t.lucroMensal / t.faturamentoMensal * 100) : 0, roiMeses };
  }, [rentalItems, rentalDefaults, prazoContratoMeses]);



  const handleGlobalKitOverwrite = async () => {
    if (!id) {
      alert("Salve a oportunidade primeiro antes de sobrescrever kits globais.");
      setShowOverwriteModal(false);
      return;
    }
    const kitIds = Array.from(new Set(rentalItems.filter(ri => ri.opportunity_kit_id).map(ri => ri.opportunity_kit_id)));
    if (kitIds.length === 0) {
      alert("Não há kits lançados nesta oportunidade para atualizar.");
      setShowOverwriteModal(false);
      return;
    }

    try {
      setSaving(true);

      const kitUpdates = await Promise.all(kitIds.map(async kitId => {
        const res = await api.put(`/opportunity-kits/${kitId}`, {
          prazo_contrato_meses: prazoContratoMeses,
          prazo_instalacao_meses: prazoInstalacaoMeses,
        });
        return { kitId, data: res.data };
      }));

      const kitMap = new Map(kitUpdates.map(k => [k.kitId, k.data]));

      const updatedRentalItems = rentalItems.map(ri => {
        if (!ri.opportunity_kit_id || !kitMap.has(ri.opportunity_kit_id)) return ri;
        const updatedKit = kitMap.get(ri.opportunity_kit_id);
        return calcRentalItem({
          ...ri,
          prazo_contrato: prazoContratoMeses,
          custo_op_mensal_kit: Number(updatedKit.summary?.custo_operacional_mensal_kit || 0),
          kit_custo_produtos: Number(updatedKit.summary?.custo_aquisicao_produtos || 0),
          kit_custo_servicos: Number(updatedKit.summary?.custo_aquisicao_servicos || 0),
          custo_aquisicao_unit: Number(updatedKit.summary?.custo_aquisicao_total || 0),
          ipi_unit: Number(updatedKit.summary?.total_ipi_kit || 0),
          frete_unit: Number(updatedKit.summary?.total_frete_kit || 0),
          icms_st_unit: Number(updatedKit.summary?.total_st_kit || 0),
          difal_unit: Number(updatedKit.summary?.total_difal_kit || 0),
          taxa_manutencao_anual_item: Number(updatedKit.taxa_manutencao_anual || 0),
          kit_pis: Number(updatedKit.aliq_pis || 0),
          kit_cofins: Number(updatedKit.aliq_cofins || 0),
          kit_csll: Number(updatedKit.aliq_csll || 0),
          kit_irpj: Number(updatedKit.aliq_irpj || 0),
          kit_iss: Number(updatedKit.aliq_iss || 0),
          kit_vlt_manut: Number(updatedKit.summary?.vlt_manut || 0),
          kit_valor_mensal: updatedKit.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? Number(updatedKit.summary?.venda_equipamentos_total || 0) : Number(updatedKit.summary?.valor_mensal_antes_impostos ?? updatedKit.summary?.valor_mensal_kit ?? 0),
          kit_valor_impostos: Number(updatedKit.summary?.valor_impostos ?? 0),
          kit_receita_liquida: Number(updatedKit.summary?.receita_liquida_mensal_kit || 0),
          kit_lucro_mensal: Number(updatedKit.summary?.lucro_mensal_kit || 0),
          kit_margem: Number(updatedKit.summary?.margem_kit || 0)
        }, rentalDefaults);
      });

      const success = await handleSave(true, updatedRentalItems);
      if (!success) return;

      window.location.reload();
    } catch (e) {
      console.error(e);
      alert("Erro ao sobrescrever kits na oportunidade.");
    } finally {
      setSaving(false);
      setShowOverwriteModal(false);
    }
  };

  const handleSave = async (preventNavigate = false, overriddenRentalItems?: typeof rentalItems, overriddenVendaKits?: typeof vendaKits) => {
    if (!titulo || !customerId) {
      alert('Preencha título e cliente.');
      return false;
    }
    setSaving(true);
    try {
      const payload = {
        customer_id: customerId,
        titulo,
        observacoes: observacoes || null,
        data_orcamento: new Date(dataOrcamento).toISOString(),
        markup_padrao: +markupPadrao,
        perc_despesa_adm: +percDespesaAdm,
        perc_comissao: +percComissao,
        perc_frete_venda: +percFreteVenda,
        perc_pis: +percPis,
        perc_cofins: +percCofins,
        perc_csll: +percCsll,
        perc_irpj: +percIrpj,
        perc_iss: +percIss,
        perc_icms_interno: +percIcmsInterno,
        perc_icms_externo: +percIcmsExterno,
        venda_markup_produtos: +fatorMargemProdutos,
        venda_markup_servicos: +fatorMargemServicos,
        venda_markup_instalacao: +fatorMargemInstalacao,
        venda_markup_manutencao: +fatorMargemManutencao,
        venda_havera_manutencao: vendaHaveraManutencao,
        venda_qtd_meses_manutencao: +vendaQtdMesesManutencao,
        // Rental defaults
        tipo_receita_rental: tipoReceitaRental,
        prazo_contrato_meses: +prazoContratoMeses,
        prazo_instalacao_meses: +prazoInstalacaoMeses,
        taxa_juros_mensal: +taxaJurosMensal,
        taxa_manutencao_anual: +taxaManutencaoAnual,
        fator_margem_padrao: 1,
        fator_manutencao_padrao: 1,
        perc_instalacao_padrao: +percInstalacaoPadrao,
        perc_comissao_rental: +percComissaoRental,
        perc_pis_rental: +percPisRental,
        perc_cofins_rental: +percCofinsRental,
        perc_csll_rental: +percCsllRental,
        perc_irpj_rental: +percIrpjRental,
        perc_iss_rental: +percIssRental,
        perc_comissao_diretoria: +percComissaoDiretoria,
        responsavel_ids: responsavelIds,
        items: [
          ...items.map(i => ({
            product_id: i.product_id || null,
            tipo_item: i.tipo_item,
            descricao_servico: i.descricao_servico || null,
            usa_parametros_padrao: i.usa_parametros_padrao,
            custo_unit_base: +i.custo_unit_base,
            markup: +i.markup,
            quantidade: +i.quantidade,
            perc_frete_venda: +i.perc_frete_venda,
            perc_pis: +i.perc_pis,
            perc_cofins: +i.perc_cofins,
            perc_csll: +i.perc_csll,
            perc_irpj: +i.perc_irpj,
            perc_icms: +i.perc_icms,
            perc_iss: +i.perc_iss,
            perc_despesa_adm: +i.perc_despesa_adm,
            perc_comissao: +i.perc_comissao,
            tem_st: i.tem_st,
          })),
          ...(overriddenVendaKits || vendaKits).map(vk => ({
            opportunity_kit_id: vk.opportunity_kit_id,
            product_id: null,
            tipo_item: 'MERCADORIA', // Default for kits in Venda
            descricao_servico: vk.nome_kit,
            usa_parametros_padrao: false,
            custo_unit_base: +(vk.custo_aquisicao_equip_unit + vk.custo_manutencao_unit),
            markup: 1, // Pricing is internal to kit
            quantidade: +vk.quantidade,
            // Perc values are derived from kit summary but these fields are optional/ignored for kits by the engine
            perc_frete_venda: 0,
            perc_pis: 0,
            perc_cofins: 0,
            perc_csll: 0,
            perc_irpj: 0,
            perc_icms: 0,
            perc_iss: 0,
            perc_despesa_adm: 0,
            perc_comissao: 0,
            tem_st: false,
          }))
        ],
        rental_items: (overriddenRentalItems || rentalItems).map(i => ({
          product_id: i.product_id || null,
          opportunity_kit_id: i.opportunity_kit_id || null,
          custo_op_mensal_kit: i.custo_op_mensal_kit != null ? +i.custo_op_mensal_kit : null,
          is_kit_instalacao: !!i.is_kit_instalacao,
          tipo_contrato_kit: i.tipo_contrato_kit || null,
          kit_taxa_juros_mensal: i.kit_taxa_juros_mensal != null ? +i.kit_taxa_juros_mensal : null,
          kit_custo_produtos: i.kit_custo_produtos != null ? +i.kit_custo_produtos : null,
          kit_custo_servicos: i.kit_custo_servicos != null ? +i.kit_custo_servicos : null,
          kit_pis: i.kit_pis != null ? +i.kit_pis : null,
          kit_cofins: i.kit_cofins != null ? +i.kit_cofins : null,
          kit_csll: i.kit_csll != null ? +i.kit_csll : null,
          kit_irpj: i.kit_irpj != null ? +i.kit_irpj : null,
          kit_iss: i.kit_iss != null ? +i.kit_iss : null,
          kit_vlt_manut: i.kit_vlt_manut != null ? +i.kit_vlt_manut : null,
          kit_valor_mensal: i.kit_valor_mensal != null ? +i.kit_valor_mensal : null,
          kit_valor_impostos: i.kit_valor_impostos != null ? +i.kit_valor_impostos : null,
          kit_receita_liquida: i.kit_receita_liquida != null ? +i.kit_receita_liquida : null,
          kit_lucro_mensal: i.kit_lucro_mensal != null ? +i.kit_lucro_mensal : null,
          kit_margem: i.kit_margem != null ? +i.kit_margem : null,
          quantidade: +i.quantidade,
          perc_instalacao_item: i.perc_instalacao_item != null ? +i.perc_instalacao_item : null,
          valor_instalacao_item: i.valor_instalacao_item != null ? +i.valor_instalacao_item : null,
          custo_aquisicao_unit: +i.custo_aquisicao_unit,
          ipi_unit: +i.ipi_unit,
          frete_unit: +i.frete_unit,
          icms_st_unit: +i.icms_st_unit,
          difal_unit: +i.difal_unit,
          prazo_contrato: +i.prazo_contrato,
          usa_taxa_manut_padrao: i.usa_taxa_manut_padrao,
          taxa_manutencao_anual_item: i.taxa_manutencao_anual_item ? +i.taxa_manutencao_anual_item : null,
          fator_margem: +i.fator_margem,
        })),
      };

      let currentSalesBudgetId = id;
      if (isEditing) {
        await api.put(`/sales-budgets/${id}`, payload);
        if (!preventNavigate) alert('Salvo com sucesso!');
      } else {
        const res = await api.post('/sales-budgets', payload);
        currentSalesBudgetId = res.data.id;
      }

      // Save Purchase Budget if filled
      if (purchaseSupplierId) {
        const pbPayload = {
          supplier_id: purchaseSupplierId,
          payment_condition_id: purchasePaymentConditionId || null,
          sales_budget_id: currentSalesBudgetId,
          numero_orcamento: numeroOrcamento,
          data_orcamento: new Date(dataOrcamento).toISOString(),
          tipo_orcamento: 'REVENDA',
          frete_tipo: purchaseFreteTipo,
          frete_percent: purchaseFretePercent,
          ipi_calculado: purchaseIpiCalculado,
          items: purchaseItems.map(i => ({
            product_id: i.product_id,
            codigo_fornecedor: i.codigo_fornecedor || '',
            ncm: i.ncm || '',
            quantidade: i.quantidade,
            valor_unitario: i.valor_unitario,
            frete_percent: i.frete_percent,
            ipi_percent: i.ipi_percent,
            icms_percent: i.icms_percent
          }))
        };
        try {
          if (purchaseBudgetId) {
            await api.put(`/purchase-budgets/${purchaseBudgetId}`, pbPayload);
          } else {
            const pbRes = await api.post('/purchase-budgets', pbPayload);
            setPurchaseBudgetId(pbRes.data.id);
          }
        } catch (err) {
          console.error('Failed to save purchase budget', err);
          alert('Erro ao salvar aba de orçamento de compra.');
        }
      }

      setHasUnsavedChanges(false);
      if (!isEditing && !preventNavigate) navigate(`/orcamentos-vendas/${currentSalesBudgetId}?tab=${activeTab}`, { replace: true });
      return true;
    } catch (err: any) {
      const errData = err.response?.data;
      console.error('Save error (full):', JSON.stringify(errData || err, null, 2));
      const detail = errData?.detail;
      let msg: string;
      if (Array.isArray(detail)) {
        msg = detail.map((d: any) => `[${(d.loc || []).slice(1).join('.')}] ${d.msg}`).join('\n');
      } else if (typeof detail === 'string') {
        msg = detail;
      } else {
        msg = err.message || 'Erro desconhecido';
      }
      alert('Erro ao salvar:\n' + msg);
      // Allow back button to work after failed save
      setHasUnsavedChanges(false);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.patch(`/sales-budgets/${id}/status`, { status: newStatus });
      setStatus(newStatus);
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-brand-primary" /></div>;

  return (
    <div className="p-6 space-y-6 w-full">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              if (hasUnsavedChanges) {
                setShowDiscardDialog(true);
              } else {
                navigate('/orcamentos-vendas');
              }
            }}
            className="p-2 rounded-lg hover:bg-bg-deep text-text-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand-primary" />
              {isEditing ? `Oportunidade ${numeroOrcamento}` : 'Nova Oportunidade'}
            </h1>
            {isEditing && (() => {
              const clienteName = customers.find(c => c.id === customerId);
              const clienteLabel = clienteName ? (clienteName.nome_fantasia || clienteName.razao_social) : null;
              return (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status === 'RASCUNHO' ? 'bg-amber-100 text-amber-800' : status === 'APROVADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                    {status === 'RASCUNHO' ? 'Rascunho' : status === 'APROVADO' ? 'Aprovado' : 'Arquivado'}
                  </span>
                  {clienteLabel && (
                    <span className="flex items-center gap-1 text-xs text-text-muted">
                      <Building2 className="w-3 h-3" />
                      {clienteLabel}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing && status === 'RASCUNHO' && (
            <Button onClick={() => handleStatusChange('APROVADO')} variant="outline" className="text-emerald-600 border-emerald-300 hover:bg-emerald-50">
              Aprovar
            </Button>
          )}
          {isEditing && status === 'APROVADO' && (
            <Button onClick={() => handleStatusChange('ARQUIVADO')} variant="outline" className="text-gray-600">
              Arquivar
            </Button>
          )}
          {!isReadonly && (
            <Button type="button" onClick={() => handleSave()} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
              Salvar
            </Button>
          )}
        </div>
      </div>

      {/* Header */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
        {/* Header toggle bar */}
        <div
          className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 p-5 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
          onClick={() => setIsHeaderCollapsed(prev => !prev)}
        >
          <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2">
            Cabeçalho
            {isHeaderCollapsed
              ? <ChevronDown className="w-4 h-4 text-text-muted" />
              : <ChevronUp className="w-4 h-4 text-text-muted" />}
          </h2>
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            {!isReadonly && id && (
              <Button variant="outline" size="sm" onClick={() => setIsHeaderModalOpen(true)}>
                Editar dados da proposta
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible body */}
        {!isHeaderCollapsed && (
          <div className="px-5 pb-5 space-y-4 border-t border-border-subtle">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-muted mb-1">Título *</label>
                <input value={titulo} onChange={() => { }} disabled={true}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-text-muted mb-1">Cliente *</label>
                <select value={customerId} onChange={() => { }} disabled={true}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60">
                  <option value="">Selecionar...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Data</label>
                <input type="date" value={dataOrcamento} onChange={e => setDataOrcamento(e.target.value)} disabled={isReadonly}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Vendedor</label>
                <select value={vendedorId} disabled className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none disabled:opacity-60">
                  <option value="">Nenhum associado</option>
                  {professionals.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Responsável</label>
                <input value={users.find(u => responsavelIds.includes(u.id))?.name || 'Nenhum associado'} disabled className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none disabled:opacity-60" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-muted mb-1">Observações</label>
              <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} disabled={isReadonly} rows={2}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60" />
            </div>
          </div>
        )}
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border-subtle bg-surface">
        <button onClick={() => setSearchParams({ tab: 'venda' }, { replace: true })} className={`px-6 py-3 text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'venda' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-text-muted hover:text-text-primary'}`}>
          <Receipt className="w-4 h-4" />
          Venda
        </button>
        <button onClick={() => setSearchParams({ tab: 'locacao' }, { replace: true })} className={`px-6 py-3 text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'locacao' ? 'text-teal-600 border-b-2 border-teal-500' : 'text-text-muted hover:text-text-primary'}`}>
          <TrendingUp className="w-4 h-4" />
          Locação / Comodato
        </button>
        <button onClick={() => setSearchParams({ tab: 'compra' }, { replace: true })} className={`px-6 py-3 text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'compra' ? 'text-orange-500 border-b-2 border-orange-500' : 'text-text-muted hover:text-text-primary'}`}>
          <Package className="w-4 h-4" />
          Orçamento de Compra
        </button>
      </div>

      {/* ═══ VENDA TAB ═══ */}
      {activeTab === 'venda' && (<>
        {/* Consolidação Diretoria — right after header */}
        {items.length > 0 && (() => {
          const venda_fat = totals.venda;
          const venda_custo_total = totals.custo + totals.impostos + totals.frete + totals.despAdm;
          const venda_rec_liq = venda_fat - venda_custo_total;
          const venda_comissao_diretoria = Math.max(0, venda_rec_liq * (percComissaoDiretoria / 100));
          const venda_saldo = venda_rec_liq - venda_comissao_diretoria;
          const venda_margem = venda_fat > 0 ? (venda_saldo / venda_fat) * 100 : 0;

          return (
            <div className="bg-surface border border-border-subtle rounded-xl p-6 relative overflow-hidden mb-6 mt-4">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none transition-opacity group-hover:opacity-[0.06]">
                <Calculator className="w-32 h-32" />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2">Consolidação Diretoria</h2>
                  <p className="text-[11px] text-text-muted mt-0.5 uppercase tracking-wide">Análise de viabilidade e comissionamento executivo</p>
                </div>
              </div>

              {/* Top Controls & Totals */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6 mb-6 border-b border-border-subtle">
                <div className="lg:col-span-4">
                  <label className="block text[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                    Comissão sobre receita líquida
                  </label>
                  <div className="relative max-w-[180px]">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={isReadonly}
                      value={percComissaoDiretoria}
                      onChange={e => {
                        setPercComissaoDiretoria(+e.target.value);
                        setHasUnsavedChanges(true);
                      }}
                      className="w-full pl-3 pr-8 py-2 border border-border-subtle rounded-lg bg-bg-deep text-sm font-bold focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/30 disabled:opacity-60 transition-colors"
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-muted text-sm font-bold">%</div>
                  </div>
                </div>

                <div className="lg:col-span-8 flex flex-wrap gap-6 items-end lg:justify-end">
                  <div>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Total de Faturamento</span>
                    <span className="text-xl font-bold text-teal-400">{fmt(venda_fat)}</span>
                  </div>
                  <div className="hidden sm:block h-8 w-px bg-border-subtle mx-2"></div>
                  <div>
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Total de Custo <span className="opacity-60 font-medium normal-case ml-1 pt-0.5 inline-block">(Aq + Imp + Frete + Desp Adm)</span></span>
                    <span className="text-xl font-bold text-rose-400">{fmt(venda_custo_total)}</span>
                  </div>
                </div>
              </div>

              {/* Data Strip format */}
              <div className="grid grid-cols-2 lg:grid-cols-4 border border-border-subtle rounded-lg lg:divide-x divide-y lg:divide-y-0 divide-border-subtle bg-bg-deep overflow-hidden">
                <Tooltip content={
                  <div className="w-80 space-y-3 text-gray-200">
                    <div>
                      <div className="font-bold text-white border-b border-gray-600 pb-1 mb-1">Receita Líquida Venda</div>
                      <div className="text-[10px] text-brand-primary font-mono mb-1 leading-relaxed bg-black/40 p-2 rounded">Faturamento - (Custo Aq. + Impostos + Frete + Desp. Adm.)</div>
                      <div className="text-sm font-bold text-amber-400 mt-1">{fmt(venda_rec_liq)}</div>
                    </div>
                  </div>
                }>
                  <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-colors cursor-help group">
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5 group-hover:text-gray-300 transition-colors">
                      Receita Líquida
                      <HelpCircle className="w-3 h-3 opacity-50" />
                    </span>
                    <p className="text-xl font-bold text-text-primary">{fmt(venda_rec_liq)}</p>
                  </div>
                </Tooltip>

                <Tooltip content={
                  <div className="w-80 space-y-3 text-gray-200">
                    <div>
                      <div className="font-bold text-white border-b border-gray-600 pb-1 mb-1">Comissão Venda</div>
                      <div className="text-[10px] text-brand-primary font-mono mb-1 leading-relaxed bg-black/40 p-2 rounded">MÁX(0, Receita Líquida × % Receita Líquida)</div>
                      <div className="text-sm font-bold text-amber-400 mt-1">{fmt(venda_comissao_diretoria)}</div>
                    </div>
                  </div>
                }>
                  <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-colors cursor-help group border-l lg:border-l-0 border-border-subtle">
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5 group-hover:text-gray-300 transition-colors">
                      Comissão Rec/Liq
                      <HelpCircle className="w-3 h-3 opacity-50" />
                    </span>
                    <p className="text-xl font-bold text-text-primary">{fmt(venda_comissao_diretoria)}</p>
                  </div>
                </Tooltip>

                <div className="p-4 sm:p-5 bg-white/[0.015] border-t lg:border-t-0 border-border-subtle">
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-2">Lucro / Saldo</span>
                  <p className="text-xl font-bold text-brand-primary">{fmt(venda_saldo)}</p>
                </div>

                <div className="p-4 sm:p-5 bg-white/[0.015] border-l border-t lg:border-l lg:border-t-0 border-border-subtle">
                  <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-2">Margem Diretoria</span>
                  <p className="text-xl font-bold text-teal-500">{fmtPct(venda_margem)}</p>
                </div>
              </div>

              {/* Detalhamento de Operação (Replaces previous Consolidação standard blocks) */}
              <div className="mt-8 pt-6 border-t border-border-subtle">
                <h3 className="font-semibold text-text-primary text-base mb-4 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-brand-primary" />
                  Detalhamento de Operação
                </h3>
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                  <div className="bg-bg-deep rounded-lg p-3 relative group cursor-help">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider border-b border-dashed border-text-muted cursor-help">Custo Aquisição</span>
                    <p className="text-sm font-bold text-text-primary mt-1">{fmt(totals.custo)}</p>
                    <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 z-50 bg-[#1e293b] text-white text-xs rounded-lg shadow-xl p-3 w-56">
                      <div className="font-semibold text-amber-300 mb-2">Composição do Custo</div>
                      <div className="space-y-1">
                        <div className="flex justify-between"><span>Fornecedor (Base):</span><span>{fmt(totals.base_fornecedor)}</span></div>
                        {totals.total_ipi > 0 && <div className="flex justify-between"><span>IPI:</span><span className="text-amber-300">+ {fmt(totals.total_ipi)}</span></div>}
                        {totals.total_frete_compra > 0 && <div className="flex justify-between"><span>Frete CIF:</span><span className="text-amber-300">+ {fmt(totals.total_frete_compra)}</span></div>}
                        {totals.total_icms_st > 0 && <div className="flex justify-between"><span>ICMS-ST:</span><span className="text-amber-300">+ {fmt(totals.total_icms_st)}</span></div>}
                        <div className="border-t border-white/20 pt-1 mt-1 flex justify-between font-bold"><span>Total:</span><span>{fmt(totals.custo)}</span></div>
                      </div>
                      <div className="absolute top-full left-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#1e293b]" />
                    </div>
                  </div>
                  <div className="bg-bg-deep rounded-lg p-3 relative group cursor-help">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider border-b border-dashed border-text-muted cursor-help">Impostos</span>
                    <p className="text-sm font-bold text-text-primary mt-1">{fmt(totals.impostos)}</p>
                    <div className="hidden group-hover:block absolute bottom-full left-0 mb-2 z-50 bg-[#1e293b] text-white text-xs rounded-lg shadow-xl p-3 w-56">
                      <div className="font-semibold text-sky-300 mb-2">Detalhamento dos Impostos</div>
                      <div className="space-y-1">
                        {totals.total_pis > 0 && <div className="flex justify-between"><span>PIS:</span><span>{fmt(totals.total_pis)}</span></div>}
                        {totals.total_cofins > 0 && <div className="flex justify-between"><span>COFINS:</span><span>{fmt(totals.total_cofins)}</span></div>}
                        {totals.total_csll > 0 && <div className="flex justify-between"><span>CSLL:</span><span>{fmt(totals.total_csll)}</span></div>}
                        {totals.total_irpj > 0 && <div className="flex justify-between"><span>IRPJ:</span><span>{fmt(totals.total_irpj)}</span></div>}
                        {totals.total_icms > 0 && <div className="flex justify-between"><span>ICMS:</span><span>{fmt(totals.total_icms)}</span></div>}
                        {totals.total_iss > 0 && <div className="flex justify-between"><span>ISS:</span><span>{fmt(totals.total_iss)}</span></div>}
                        <div className="border-t border-white/20 pt-1 mt-1 flex justify-between font-bold"><span>Total:</span><span>{fmt(totals.impostos)}</span></div>
                      </div>
                      <div className="absolute top-full left-4 w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#1e293b]" />
                    </div>
                  </div>
                  <div className="bg-bg-deep rounded-lg p-3">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Frete Venda</span>
                    <p className="text-sm font-bold text-text-primary mt-1">{fmt(totals.frete)}</p>
                  </div>
                  <div className="bg-bg-deep rounded-lg p-3">
                    <span className="text-[10px] text-text-muted uppercase tracking-wider">Desp. Adm.</span>
                    <p className="text-sm font-bold text-text-primary mt-1">{fmt(totals.despAdm)}</p>
                  </div>
                  <Tooltip content={
                    <div className="w-64 space-y-1 text-gray-200 p-1">
                      <div className="font-bold text-white border-b border-gray-600 pb-1 mb-2">Comissão Padrão</div>
                      <div className="text-xs">Comissão informada linha-a-linha na tabela de mercadorias. (Não é a comissão da diretoria)</div>
                    </div>
                  }>
                    <div className="bg-bg-deep rounded-lg p-3 group cursor-help">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider border-b border-dashed border-text-muted cursor-help">Comissão Padrão</span>
                      <p className="text-sm font-bold text-text-primary mt-1">{fmt(totals.comissao)}</p>
                    </div>
                  </Tooltip>
                  <Tooltip content={
                    <div className="w-64 space-y-1 text-gray-200 p-1">
                      <div className="font-bold text-white border-b border-gray-600 pb-1 mb-2">Lucro Padrão</div>
                      <div className="text-xs">Lucro tradicional considerando a comissão padrão e sem deduzir a comissão de diretoria.</div>
                    </div>
                  }>
                    <div className="bg-bg-deep rounded-lg p-3 group cursor-help">
                      <span className="text-[10px] text-text-muted uppercase tracking-wider border-b border-dashed border-text-muted cursor-help">Lucro Padrão</span>
                      <p className={`text-sm font-bold mt-1 ${totals.margem >= 15 ? 'text-emerald-600' : totals.margem >= 5 ? 'text-amber-600' : 'text-rose-600'}`}>{fmt(totals.lucro)}</p>
                    </div>
                  </Tooltip>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Pricing Defaults */}
        {false && (
          <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2">
                <Calculator className="w-5 h-5 text-brand-primary" />
                Parâmetros Padrão
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleRefreshParams}
                  disabled={isReadonly || saving}
                  className="text-[11px] border-brand-primary/30 hover:bg-brand-primary/5 text-brand-primary h-8"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${saving ? 'animate-spin' : ''}`} />
                  Atualizar Parâmetros
                </Button>
                {vendaKits.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleApplyKitsParams}
                    disabled={isReadonly || saving}
                    className="text-[11px] border-brand-primary/30 hover:bg-brand-primary/5 text-brand-primary h-8"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${saving ? 'animate-spin' : ''}`} />
                    Aplicar aos Kits
                  </Button>
                )}
                {/* Info button — opens read-only tax breakdown modal */}
                <button
                  type="button"
                  onClick={() => setShowTaxModal(true)}
                  className="flex items-center gap-1.5 text-xs font-semibold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 rounded-lg px-3 py-1.5 hover:bg-brand-primary/20 transition-all h-8"
                >
                  <Info className="w-4 h-4" /> Impostos Incidentes
                </button>
              </div>
            </div>

            {/* Row 1 — Fator Margem (4 fields) + Maintenance */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: 'Fator Margem (Produtos)', val: fatorMargemProdutos, set: setFatorMargemProdutos },
                { label: 'Fator Margem Serviços', val: fatorMargemServicos, set: setFatorMargemServicos },
                { label: 'Fator Margem Instalação', val: fatorMargemInstalacao, set: setFatorMargemInstalacao },
                { label: 'Fator Margem Manutenção', val: fatorMargemManutencao, set: setFatorMargemManutencao },
              ].map(p => (
                <div key={p.label}>
                  <label className="block text-xs font-medium text-text-muted mb-1">{p.label}</label>
                  <Decimal4Input value={p.val} onChange={(val: number) => { p.set(val); setMarkupPadrao(val); }} disabled={isReadonly}
                    className="w-full px-2 py-1.5 border border-brand-primary/30 rounded-lg bg-brand-primary/5 text-text-primary text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60" />
                </div>
              ))}
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="vendaHaveraManutencao"
                  checked={!!vendaHaveraManutencao}
                  onChange={e => { setVendaHaveraManutencao(e.target.checked); setHasUnsavedChanges(true); }}
                  disabled={isReadonly}
                  className="w-4 h-4 rounded border-brand-primary/30 text-brand-primary focus:ring-brand-primary/30"
                />
                <label htmlFor="vendaHaveraManutencao" className="text-xs font-medium text-text-muted cursor-pointer">Manutenção Mensal</label>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-muted mb-1">Qtd. Meses Manut.</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  disabled={isReadonly || !vendaHaveraManutencao}
                  value={vendaQtdMesesManutencao ?? 0}
                  onChange={e => { setVendaQtdMesesManutencao(+e.target.value); setHasUnsavedChanges(true); }}
                  className="w-full px-2 py-1.5 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60"
                />
              </div>
            </div>


            {/* Row 2 — Desp. Adm., Comissão, Frete */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {[
                { label: 'Desp. Adm. %', val: percDespesaAdm, set: setPercDespesaAdm },
                { label: 'Comissão %', val: percComissao, set: setPercComissao },
                { label: 'Frete Venda %', val: percFreteVenda, set: setPercFreteVenda },
              ].map(p => (
                <div key={p.label}>
                  <label className="block text-xs font-medium text-text-muted mb-1">{p.label}</label>
                  <input type="number" step="0.01" value={p.val} onChange={e => p.set(+e.target.value)} disabled={isReadonly}
                    className="w-full px-2 py-1.5 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tax Info Modal */}
        {showTaxModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowTaxModal(false)}>
            <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-2xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-text-primary text-base flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-rose-400" /> Impostos Incidentes — Venda de Equipamentos
                </h3>
                <button onClick={() => setShowTaxModal(false)} className="text-text-muted hover:text-text-primary transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <p className="text-xs text-text-muted mb-4">Tributação padrão do bloco <strong>Venda de Equipamentos e Serviços</strong> configurada nos Parâmetros da empresa. Estes valores são aplicados automaticamente e somente podem ser alterados no cadastro da empresa.</p>
              <div className="space-y-2">
                {[
                  { label: 'PIS', val: companyVendaTaxes.pis },
                  { label: 'COFINS', val: companyVendaTaxes.cofins },
                  { label: 'CSLL', val: companyVendaTaxes.csll },
                  { label: 'IRPJ', val: companyVendaTaxes.irpj },
                  { label: 'ISS', val: companyVendaTaxes.iss },
                  { label: 'ICMS Interno', val: companyVendaTaxes.icms_interno },
                  { label: 'ICMS Externo', val: companyVendaTaxes.icms_externo },
                ].map(t => (
                  <div key={t.label} className="flex justify-between items-center py-1.5 border-b border-border-subtle last:border-0">
                    <span className="text-sm font-medium text-text-muted">{t.label}</span>
                    <span className="text-sm font-bold text-rose-400">{t.val.toFixed(2)}%</span>
                  </div>
                ))}
                <div className="flex justify-between items-center pt-2">
                  <span className="text-sm font-bold text-text-primary">Total de Impostos</span>
                  <span className="text-base font-black text-rose-500">{(companyVendaTaxes.pis + companyVendaTaxes.cofins + companyVendaTaxes.csll + companyVendaTaxes.irpj + companyVendaTaxes.iss + companyVendaTaxes.icms_interno).toFixed(2)}%</span>
                </div>
              </div>
            </div>
          </div>
        )}


        {/* Bloco de Totalização Venda */}
        {vendaKits.length > 0 && (() => {
          const t = vendaKits.reduce((acc, kit) => {
            const q = kit.quantidade || 1;
            const s = kit.summary || {};

            // Custo Base
            acc.custoAquisicao += (kit.custo_aquisicao_equip_unit || 0) * q;
            acc.mat += (Number(s.custo_aquisicao_total) || 0) * q;
            acc.mao += (Number(s.vlr_instal_calc) || 0) * q;

            // Custo Quebrado
            acc.baseFornecedor += (Number(s.custo_aquisicao_produtos) || 0) * q;
            acc.vltSt += (Number(s.total_st_kit) || 0) * q;
            acc.vltIpi += (Number(s.total_ipi_kit) || 0) * q;
            acc.vltDifal += (Number(s.total_difal_kit) || 0) * q;
            acc.impostosCompra += (Number(s.total_st_kit || 0) + Number(s.total_ipi_kit || 0) + Number(s.total_difal_kit || 0)) * q;
            acc.freteCompra += (Number(s.total_frete_kit) || 0) * q;

            // Faturamento Bruto
            acc.totalVenda += (kit.venda_equip_unit || 0) * q;
            acc.totalManutencao += (kit.venda_manut_unit || 0) * q;
            acc.vltManutMensal += (Number(s.vlt_manut) || 0) * q;

            acc.lucroManutencao += (kit.lucro_manutencao || 0) * q;

            const manM = Number(kit.qtd_meses_manutencao) || 0;
            if (manM > acc.maxMesesManut) acc.maxMesesManut = manM;

            return acc;
          }, {
            custoAquisicao: 0, mat: 0, mao: 0, totalVenda: 0, totalManutencao: 0, vltManutMensal: 0,
            lucroManutencao: 0, maxMesesManut: 0,
            impostosCompra: 0, baseFornecedor: 0, freteCompra: 0,
            vltSt: 0, vltIpi: 0, vltDifal: 0
          });

          // Cálculos Consolidados sobre o Total Geral
          const sumTaxes = (companyVendaTaxes?.icms_interno || 0) + (companyVendaTaxes?.pis || 0) + (companyVendaTaxes?.cofins || 0) + (companyVendaTaxes?.csll || 0) + (companyVendaTaxes?.irpj || 0) + (companyVendaTaxes?.iss || 0);

          const impostosVendaConsolidado = (t.totalVenda * sumTaxes) / 100;
          const vltDespAdmConsolidado = (t.totalVenda * (percDespesaAdm || 0)) / 100;
          const vltComissaoConsolidado = (t.totalVenda * (percComissao || 0)) / 100;
          const vltFreteVendaConsolidado = (t.totalVenda * (percFreteVenda || 0)) / 100;

          const despesasVendaTotal = vltDespAdmConsolidado + vltComissaoConsolidado + vltFreteVendaConsolidado;

          const lucroVendaConsolidado = t.totalVenda - t.custoAquisicao - impostosVendaConsolidado - despesasVendaTotal;

          const faturamentoTotal = t.totalVenda + t.totalManutencao;
          const margemVenda = t.totalVenda > 0 ? (lucroVendaConsolidado / t.totalVenda) * 100 : 0;
          const margemManutencao = t.totalManutencao > 0 ? (t.lucroManutencao / t.totalManutencao) * 100 : 0;

          return (
            <div className="mb-6 bg-surface border border-border-subtle rounded-xl p-6 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-border-subtle/50">
                <Calculator className="w-5 h-5 text-brand-primary" />
                <h2 className="text-xl font-bold text-text-primary">Fechamento de Venda</h2>
              </div>

              <div className="space-y-4">
                {/* Linha Top */}
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                  <Tooltip content={
                    <div className="w-56 space-y-1 text-gray-200 p-1">
                      <div className="font-bold text-white border-b border-gray-600 pb-1 mb-2">Composição de Custo</div>
                      <div className="flex justify-between text-xs"><span>Base Prod.:</span><span className="font-semibold">{fmt(t.baseFornecedor)}</span></div>
                      <div className="flex justify-between text-xs"><span>Frete:</span><span className="font-semibold">{fmt(t.freteCompra)}</span></div>
                      <div className="flex justify-between text-xs text-rose-300"><span>IPI:</span><span className="font-semibold">{fmt(t.vltIpi)}</span></div>
                      <div className="flex justify-between text-xs text-rose-300"><span>ST:</span><span className="font-semibold">{fmt(t.vltSt)}</span></div>
                      <div className="flex justify-between text-xs text-rose-300"><span>Difal:</span><span className="font-semibold">{fmt(t.vltDifal)}</span></div>
                      <div className="flex justify-between text-xs pt-1 mt-1 border-t border-gray-600 font-bold"><span>Total Impostos:</span><span className="text-rose-400">{fmt(t.impostosCompra)}</span></div>
                      <div className="flex justify-between text-xs pt-1 border-t border-gray-600 mt-1 text-emerald-300"><span>Mão de Obra:</span><span className="font-semibold">{fmt(t.mao)}</span></div>
                    </div>
                  }>
                    <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col justify-between cursor-help h-full">
                      <div>
                        <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Custo de Aquisição</div>
                        <div className="text-2xl font-bold text-text-primary">{fmt(t.custoAquisicao)}</div>
                      </div>
                      <div className="flex justify-between items-center text-xs text-text-muted mt-5 pt-3 border-t border-border-subtle">
                        <span title="Materiais e Mercadorias">Mat: <span className="font-medium text-text-secondary">{fmt(t.mat)}</span></span>
                        <span title="Impostos Pagos na Compra">Imp: <span className="font-medium text-text-secondary">{fmt(t.impostosCompra)}</span></span>
                      </div>
                    </div>
                  </Tooltip>

                  <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col justify-between h-full">
                    <div>
                      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Total da Venda</div>
                      <div className="text-2xl font-bold text-brand-primary">{fmt(t.totalVenda)}</div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-text-muted mt-5 pt-3 border-t border-border-subtle">
                      <span>Impostos (NF):</span>
                      <span className="font-medium text-brand-primary">{fmt(impostosVendaConsolidado)}</span>
                    </div>
                  </div>

                  <div className="bg-surface border border-border-subtle rounded-xl p-5 shadow-sm flex flex-col justify-between h-full">
                    <div>
                      <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1">Total de Manutenção</div>
                      <div className="text-2xl font-bold text-amber-500">{fmt(t.totalManutencao)}</div>
                    </div>
                    <div className="text-xs text-text-muted mt-5 pt-3 border-t border-border-subtle flex justify-end">
                      {vendaHaveraManutencao ? (
                        <span className="font-medium">{fmt(t.vltManutMensal)} <span className="text-[11px] font-normal">/mês ({t.maxMesesManut}x)</span></span>
                      ) : (
                        <span className="text-amber-500/70">Inativo (Desmarcado)</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-5 shadow-sm flex flex-col justify-between h-full">
                    <div>
                      <div className="text-[11px] font-bold text-brand-primary uppercase tracking-wider mb-1">Faturamento Total</div>
                      <div className="text-2xl font-bold text-brand-primary">{fmt(faturamentoTotal)}</div>
                    </div>
                    <div className="flex justify-between items-center text-xs text-brand-primary/70 mt-5 pt-3 border-t border-brand-primary/10">
                      <span>Venda + Manutenção</span>
                    </div>
                  </div>
                </div>

                {/* Linha Bottom */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Tooltip content={
                    <div className="w-56 space-y-1 text-gray-200 p-1">
                      <div className="font-bold text-emerald-300 border-b border-emerald-800/50 pb-1 mb-2">Detalhamento Financeiro (Venda)</div>
                      <div className="flex justify-between text-xs text-rose-300"><span>Impostos (NF):</span><span className="font-semibold">{fmt(impostosVendaConsolidado)}</span></div>
                      <div className="flex justify-between text-xs mt-1 text-amber-300 border-t border-emerald-800/20 pt-1"><span>Comissão:</span><span className="font-semibold">{fmt(vltComissaoConsolidado)}</span></div>
                      <div className="flex justify-between text-xs text-amber-300"><span>Desp. Adm:</span><span className="font-semibold">{fmt(vltDespAdmConsolidado)}</span></div>
                      <div className="flex justify-between text-xs text-amber-300"><span>Frete (Entrega):</span><span className="font-semibold">{fmt(vltFreteVendaConsolidado)}</span></div>
                      <div className="flex justify-between text-xs border-t border-emerald-800/50 pt-1 mt-1 text-gray-400"><span>Custo Prod+Instal:</span><span className="font-semibold">{fmt(t.custoAquisicao)}</span></div>
                      <div className="flex justify-between text-sm pt-2 mt-1 border-t border-emerald-800/80 font-bold text-emerald-400"><span>Lucro Liquido:</span><span>{fmt(lucroVendaConsolidado)}</span></div>
                    </div>
                  }>
                    <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-5 flex flex-col justify-between shadow-sm cursor-help relative group h-full">
                      <div className="flex items-start justify-between w-full">
                        <div>
                          <div className="text-[11px] font-bold text-emerald-800/60 uppercase tracking-wider mb-1">Lucro da Venda (Fechamento)</div>
                          <div className="text-3xl font-black text-emerald-600 group-hover:text-emerald-700 transition-colors tracking-tight">{fmt(lucroVendaConsolidado)}</div>
                        </div>
                        <div className="px-4 py-2 flex flex-col items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 min-w-[80px]">
                          <span className="text-[9px] font-bold uppercase tracking-widest">Margem</span>
                          <span className="text-xl font-black leading-none mt-1">{t.totalVenda > 0 ? margemVenda.toFixed(1) : '0.0'}%</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-2 gap-y-3 text-xs text-emerald-800/70 pt-4 mt-4 border-t border-emerald-100/60 w-full">
                        <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-emerald-800/50">Faturamento</span> <span className="font-semibold text-emerald-800">{fmt(t.totalVenda)}</span></div>
                        <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-emerald-800/50">Custo Aqui.</span> <span className="font-semibold text-emerald-800">{fmt(t.custoAquisicao)}</span></div>
                        <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-emerald-800/50">Imp. Venda</span> <span className="font-semibold text-emerald-800">{fmt(impostosVendaConsolidado)}</span></div>
                        <div className="flex flex-col"><span className="text-[10px] uppercase font-bold text-emerald-800/50">O. Despesas</span> <span className="font-semibold text-emerald-800">{fmt(despesasVendaTotal)}</span></div>
                      </div>
                    </div>
                  </Tooltip>

                  <div className={`bg-surface border rounded-xl p-5 flex flex-col justify-between shadow-sm h-full ${t.lucroManutencao >= 0 && vendaHaveraManutencao ? 'border-emerald-100 bg-emerald-50/30' : 'border-border-subtle'}`}>
                    <div className="flex items-start justify-between w-full">
                      <div>
                        <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${t.lucroManutencao >= 0 && vendaHaveraManutencao ? 'text-emerald-800/60' : 'text-text-muted'}`}>Lucro Manutenção ({t.maxMesesManut || 12}x)</div>
                        <div className={`text-3xl font-black tracking-tight ${t.lucroManutencao >= 0 && vendaHaveraManutencao ? 'text-emerald-600' : 'text-text-primary'}`}>{fmt(t.lucroManutencao)}</div>
                      </div>
                      <div className={`px-4 py-2 flex flex-col items-center justify-center rounded-lg min-w-[80px] ${margemManutencao >= 15 ? 'bg-emerald-100 text-emerald-700' : margemManutencao >= 5 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        <span className="text-[9px] font-bold uppercase tracking-widest">Margem</span>
                        <span className="text-xl font-black leading-none mt-1">{t.totalManutencao > 0 ? margemManutencao.toFixed(1) : '0.0'}%</span>
                      </div>
                    </div>

                    <div className={`flex items-center text-xs pt-4 mt-4 border-t w-full ${t.lucroManutencao >= 0 && vendaHaveraManutencao ? 'border-emerald-100/50 text-emerald-800/70' : 'border-border-subtle text-text-muted'}`}>
                      {vendaHaveraManutencao ? (
                        <div className="flex gap-8">
                          <div className="flex flex-col"><span className="text-[10px] uppercase font-bold opacity-60 mb-0.5">Total Receitas</span> <span className="font-semibold">{fmt(t.totalManutencao)}</span></div>
                          <div className="flex flex-col"><span className="text-[10px] uppercase font-bold opacity-60 mb-0.5">Total Custos</span> <span className="font-semibold">{fmt(t.totalManutencao - t.lucroManutencao)}</span></div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center">Manutenção desativada para a venda.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Kits de Venda */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-brand-primary" />
                Kits de Oportunidade
              </h2>
              <p className="text-[11px] text-text-muted mt-0.5 uppercase tracking-wide">
                Kits globais de Venda de Equipamentos
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => {
                setNovoKitTipoContrato('VENDA_EQUIPAMENTOS');
                setShowCreateKitModal(true);
              }} disabled={isReadonly}>
                <Plus className="w-4 h-4 mr-1" /> Criar Novo Kit
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowKitSearchVenda(true)} disabled={isReadonly}>
                <Search className="w-4 h-4 mr-1" /> Adicionar Kit
              </Button>
            </div>
          </div>

          {vendaKits.length === 0 ? (
            <div className="text-center py-12 text-text-muted text-sm border-2 border-dashed border-border-subtle rounded-xl">Nenhum kit adicionado.</div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="w-full text-left border-collapse min-w-[1250px]">
                <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-[9px] font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle">
                  <tr>
                    <th className="px-1.5 py-3 whitespace-nowrap pl-4">Nome do Kit</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-center w-14">Qtd</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right" title="Custo de Aquisição (Equipamentos e Instalação)">Custo Aq. (Equip/Inst)</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right" title="Custo Total de Manutenção Projetada">Custo Manut.</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-center w-16">Fator</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right" title="Valor Total de Venda de Equipamentos">Venda Equip.</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right" title="Valor Total de Manutenção">Total Manutenção</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right font-bold text-brand-primary" title="Faturamento Total (Venda + Manutenção)">Fat. Total</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right">Lucro Venda</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right">Marg. Vda</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right">Lucro Manut.</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right">Marg. Manut.</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right">Lucro Final</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-right border-l border-border-subtle bg-bg-deep/30 pr-4">Marg. Geral</th>
                    <th className="px-1.5 py-3 whitespace-nowrap text-center w-10 pr-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle bg-surface text-[11px]">
                  {vendaKits.map((item, idx) => {
                    const avgFator = (item.fator_margem_locacao + item.fator_margem_servicos_produtos + item.fator_margem_instalacao + item.fator_margem_manutencao) / 4;
                    const q = item.quantidade;

                    const margemColor = item.margem_geral >= 15 ? 'text-emerald-600' : item.margem_geral >= 5 ? 'text-amber-600' : 'text-rose-600';
                    const margemVendaColor = item.margem_venda >= 15 ? 'text-emerald-600' : item.margem_venda >= 5 ? 'text-amber-600' : 'text-rose-600';
                    const margemManutColor = item.margem_manutencao >= 15 ? 'text-emerald-600' : item.margem_manutencao >= 5 ? 'text-amber-600' : 'text-rose-600';

                    return (
                      <tr key={idx} className="group hover:bg-bg-deep/50 transition-colors">
                        {/* Nome do Kit */}
                        <td className="px-1.5 py-3 whitespace-nowrap max-w-[200px] pl-4">
                          <div className="flex flex-col truncate">
                            <span className="font-semibold text-text-primary truncate">{item.nome_kit}</span>
                            <span className="text-[10px] font-mono text-text-muted">ID: {item.opportunity_kit_id.split('-')[0]}...</span>
                          </div>
                        </td>

                        {/* Qtd — editable */}
                        <td className="px-1.5 py-3 whitespace-nowrap text-center">
                          <input
                            type="number" step="1" min="1" value={item.quantidade}
                            onChange={e => updateVendaKit(idx, 'quantidade', +e.target.value)}
                            disabled={isReadonly}
                            className="w-12 px-1 py-1 border border-border-subtle rounded bg-bg-deep text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-brand-primary/40 disabled:opacity-60"
                          />
                        </td>

                        {/* Custo Aq. (Equip/Inst) */}
                        <td className="px-1.5 py-3 whitespace-nowrap text-right text-text-muted">
                          {fmt(item.custo_aquisicao_equip_unit * q)}
                        </td>

                        {/* Custo Manut. */}
                        <td className="px-1.5 py-3 whitespace-nowrap text-right text-text-muted">
                          {fmt(item.custo_manutencao_unit * q)}
                        </td>

                        {/* Fator — average with tooltip */}
                        <td className="px-1.5 py-3 whitespace-nowrap text-center">
                          <Tooltip content={
                            <div className="w-48 space-y-1">
                              <div className="font-bold border-b border-white/20 pb-1 mb-1">Composição de Margem</div>
                              <div className="flex justify-between"><span>Produtos:</span> <span className="font-mono">{item.fator_margem_locacao.toFixed(2)}</span></div>
                              <div className="flex justify-between"><span>Serviços:</span> <span className="font-mono">{item.fator_margem_servicos_produtos.toFixed(2)}</span></div>
                              <div className="flex justify-between"><span>Instalação:</span> <span className="font-mono">{item.fator_margem_instalacao.toFixed(2)}</span></div>
                              <div className="flex justify-between"><span>Manutenção:</span> <span className="font-mono">{item.fator_margem_manutencao.toFixed(2)}</span></div>
                            </div>
                          }>
                            <div className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-bold cursor-help inline-block">
                              {avgFator.toFixed(2)}
                            </div>
                          </Tooltip>
                        </td>

                        {/* Venda Equipamentos */}
                        <td className="px-1.5 py-3 whitespace-nowrap text-right font-semibold text-text-primary">
                          {fmt(item.venda_equip_unit * q)}
                        </td>

                        {/* Total Manutenção */}
                        <td className="px-1.5 py-3 whitespace-nowrap text-right font-semibold text-text-primary">
                          {fmt(item.venda_manut_unit * q)}
                        </td>

                        {/* Fat. Total */}
                        <td className="px-1.5 py-3 whitespace-nowrap text-right font-bold text-brand-primary">
                          {fmt(item.faturamento_total * q)}
                        </td>

                        {/* Lucro Venda */}
                        <td className={`px-1.5 py-3 whitespace-nowrap text-right font-bold ${margemVendaColor}`}>
                          {fmt(item.lucro_venda * q)}
                        </td>

                        {/* Margem Venda */}
                        <td className={`px-1.5 py-3 whitespace-nowrap text-right font-medium ${margemVendaColor}`}>
                          {fmtPct(item.margem_venda)}
                        </td>

                        {/* Lucro Manut. */}
                        <td className={`px-1.5 py-3 whitespace-nowrap text-right font-bold ${margemManutColor}`}>
                          {fmt(item.lucro_manutencao * q)}
                        </td>

                        {/* Margem Manut. */}
                        <td className={`px-1.5 py-3 whitespace-nowrap text-right font-medium ${margemManutColor}`}>
                          {fmtPct(item.margem_manutencao)}
                        </td>

                        {/* Lucro Final */}
                        <td className={`px-1.5 py-3 whitespace-nowrap text-right font-bold ${margemColor}`}>
                          {fmt(item.lucro_final * q)}
                        </td>

                        {/* Margem Geral */}
                        <td className={`px-1.5 py-3 whitespace-nowrap text-right font-bold pr-4 border-l border-border-subtle bg-bg-deep/30 ${margemColor}`}>
                          {fmtPct(item.margem_geral)}
                        </td>

                        {/* Ações */}
                        <td className="px-1 py-3 whitespace-nowrap text-center pr-4">
                          {!isReadonly && (
                            <div className="flex items-center gap-1 justify-center">
                              <button
                                onClick={() => setViewingKitId(item.opportunity_kit_id)}
                                className="p-1 text-brand-primary hover:bg-brand-primary/10 rounded transition-colors cursor-pointer"
                                title="Editar kit"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => removeVendaKit(idx)}
                                className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                                title="Remover kit"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}


        </div>
      </>)}

      {/* ═══ LOCAÇÃO / COMODATO TAB ═══ */}
      {activeTab === 'locacao' && (<>
        {rentalItems.length > 0 && (() => {
          const diretor_rec_liq = rentalTotals.faturamentoTotal - rentalTotals.investimento - rentalTotals.impostosTotal - rentalTotals.custoOpTotal;

          const prazo_fat = Math.max(1, (prazoContratoMeses || 1) - (prazoInstalacaoMeses || 0));
          const val_locacao_mensal_total = rentalTotals.faturamentoMensal * prazo_fat;
          const custo_aq_mensal = rentalTotals.investimento - rentalTotals.investimentoInstalacao;
          const imposto_mensal_total = rentalTotals.impostosMensal * prazo_fat;
          const custo_op_total = rentalTotals.custoOpTotal;

          const rec_liq_inst_calc = rentalTotals.totalInstalacao - rentalTotals.investimentoInstalacao - rentalTotals.impostosInstalacaoTotal;
          const rec_liq_mensal_calc = val_locacao_mensal_total - custo_aq_mensal - imposto_mensal_total - custo_op_total;

          const comissao_inst_calc = Math.max(0, rec_liq_inst_calc * (percComissaoDiretoria / 100));
          const comissao_mensal_calc = Math.max(0, (rec_liq_mensal_calc * (percComissaoDiretoria / 100)) / prazo_fat);

          const diretor_comissao = comissao_inst_calc + (comissao_mensal_calc * prazo_fat);

          // Evolutivo Chart Projector (Stacked Monthly) calculated FIRST to sync ROI
          const chartData = [];

          let saldoInvestimento = rentalTotals.investimento;
          let paybackMes: number | null = null;
          let paybackDecimal = 0;
          let lucroAcumuladoGeral = 0;

          const pCtr = prazoContratoMeses || 1;
          const pInst = prazoInstalacaoMeses || 0;
          const opMes = rentalTotals.custoOpMensalTotal || (rentalTotals.custoOpTotal / pCtr);

          for (let m = 1; m <= pCtr; m++) {
            let fatMes = 0;

            if (m <= pInst) {
              fatMes = rentalTotals.totalInstalacao / (pInst || 1);
            } else {
              fatMes = rentalTotals.faturamentoMensal;
            }

            const impMes = rentalTotals.impostosMensal;
            const comMes = comissao_mensal_calc;

            const gastosMes = impMes + opMes + comMes;
            const receitaLivre = fatMes - gastosMes;

            let quitarMes = 0;
            if (saldoInvestimento > 0 && receitaLivre > 0) {
              quitarMes = Math.min(receitaLivre, saldoInvestimento);
              saldoInvestimento -= quitarMes;
            }

            const lucroLivreMes = Math.max(0, receitaLivre - quitarMes);
            lucroAcumuladoGeral += lucroLivreMes;

            if (saldoInvestimento <= 0 && paybackMes === null) {
              paybackMes = m;
              const fraction = receitaLivre > 0 ? (quitarMes / receitaLivre) : 1;
              paybackDecimal = (m - 1) + fraction;
            }

            chartData.push({
              mesLabel: `M${m}`,
              GastosOperacionais: gastosMes,
              QuitarInvestimento: quitarMes,
              LucroLivre: lucroLivreMes,
              Faturamento: fatMes,
              SaldoAcumulado: saldoInvestimento > 0 ? -1 * saldoInvestimento : lucroAcumuladoGeral
            });
          }

          const diretor_saldo = diretor_rec_liq - diretor_comissao;
          const diretor_margem = rentalTotals.faturamentoTotal > 0 ? (diretor_saldo / rentalTotals.faturamentoTotal) * 100 : 0;

          // ROI Final = Custo Aquisição / (Mensal Locação - Custo Op. Mensal - Imposto Mensal)
          // Fórmula direta conforme definição: 8565.67 / (580.03 - 150.00 - 94.72) = 25.54 m
          const _roiDenominador = rentalTotals.faturamentoMensal - opMes - rentalTotals.impostosMensal;
          const base_roi = _roiDenominador > 0
            ? rentalTotals.investimento / _roiDenominador
            : ((prazoContratoMeses || 1) + 1);

          // O card do ROI final dentro do card de Consolidação Diretoria deve seguir a mesma lógica
          // do Fechamento de Proposta, apenas incluindo nos custos o valor da Comissão rec/liq.
          const _diretorRoiDenominador = rentalTotals.faturamentoMensal - opMes - rentalTotals.impostosMensal - comissao_mensal_calc;
          const diretor_roi = _diretorRoiDenominador > 0 
            ? rentalTotals.investimento / _diretorRoiDenominador 
            : ((prazoContratoMeses || 1) + 1);


          return (
            <>
              <div className="bg-surface border border-border-subtle rounded-xl p-6 relative overflow-hidden mt-4">
                <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none transition-opacity group-hover:opacity-[0.06]">
                  <Calculator className="w-32 h-32" />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2">Consolidação Diretoria</h2>
                    <p className="text-[11px] text-text-muted mt-0.5 uppercase tracking-wide">Análise de viabilidade e comissionamento executivo</p>
                  </div>
                  <button
                    onClick={() => setShowEvolutivoChart(true)}
                    type="button"
                    className="px-4 py-2 flex items-center justify-center gap-2 text-sm font-semibold text-text-primary bg-bg-deep border border-border-subtle hover:border-brand-primary/50 rounded-lg transition-all shadow-sm"
                  >
                    <TrendingUp className="w-4 h-4 text-teal-400" />
                    Ver Quadro Evolutivo
                  </button>
                </div>

                {/* Top Controls & Totals */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-6 mb-6 border-b border-border-subtle">
                  <div className="lg:col-span-4">
                    <label className="block text[10px] font-semibold uppercase tracking-wider text-text-muted mb-2">
                      Comissão sobre receita líquida
                    </label>
                    <div className="relative max-w-[180px]">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        disabled={isReadonly}
                        value={percComissaoDiretoria}
                        onChange={e => {
                          setPercComissaoDiretoria(+e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        className="w-full pl-3 pr-8 py-2 border border-border-subtle rounded-lg bg-bg-deep text-sm font-bold focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/30 disabled:opacity-60 transition-colors"
                      />
                      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-text-muted text-sm font-bold">%</div>
                    </div>
                  </div>

                  <div className="lg:col-span-8 flex flex-wrap gap-6 items-end lg:justify-end">
                    <div>
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Total de Faturamento</span>
                      <span className="text-xl font-bold text-teal-400">{fmt(rentalTotals.faturamentoTotal)}</span>
                    </div>
                    <div className="hidden sm:block h-8 w-px bg-border-subtle mx-2"></div>
                    <div>
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-1">Total de Custo <span className="opacity-60 font-medium normal-case ml-1 pt-0.5 inline-block">(Aq + Imp + Op)</span></span>
                      <span className="text-xl font-bold text-rose-400">{fmt(rentalTotals.investimento + rentalTotals.impostosTotal + rentalTotals.custoOpTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Data Strip format to replace floating bento boxes */}
                <div className="grid grid-cols-2 lg:grid-cols-5 border border-border-subtle rounded-lg lg:divide-x divide-y lg:divide-y-0 divide-border-subtle bg-bg-deep overflow-hidden">
                  <Tooltip content={
                    <div className="w-80 space-y-3 text-gray-200">
                      <div>
                        <div className="font-bold text-white border-b border-gray-600 pb-1 mb-1">Instalação</div>
                        <div className="text-[10px] text-brand-primary font-mono mb-1 leading-relaxed bg-black/40 p-2 rounded">Total Instalação - Custo Aq. Total de Instalação - Impostos de Instalação</div>
                        <div className="text-sm font-bold text-amber-400 mt-1">{fmt(rec_liq_inst_calc)}</div>
                      </div>
                      <div>
                        <div className="font-bold text-white border-b border-gray-600 pb-1 mb-1">Mensal</div>
                        <div className="text-[10px] text-brand-primary font-mono mb-1 leading-relaxed bg-black/40 p-2 rounded">(Valor Locação Mensal × (Prazo Contrato - Prazo Instalação)) - (Custo Aquisição Total - Custo Aq. Total Instalação) - (Imposto Mensal × (Prazo Contrato - Prazo Instalação)) - Custos Operacionais Totais</div>
                        <div className="text-sm font-bold text-amber-400 mt-1">{fmt(rec_liq_mensal_calc)}</div>
                      </div>
                    </div>
                  }>
                    <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-colors cursor-help group">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5 group-hover:text-gray-300 transition-colors">
                        Receita Líquida
                        <HelpCircle className="w-3 h-3 opacity-50" />
                      </span>
                      <p className="text-xl font-bold text-text-primary">{fmt(diretor_rec_liq)}</p>
                    </div>
                  </Tooltip>

                  <Tooltip content={
                    <div className="w-80 space-y-3 text-gray-200">
                      <div>
                        <div className="font-bold text-white border-b border-gray-600 pb-1 mb-1">Instalação</div>
                        <div className="text-[10px] text-brand-primary font-mono mb-1 leading-relaxed bg-black/40 p-2 rounded">MÁX(0, Receita Líquida de Instalação × % Receita Líquida)</div>
                        <div className="text-sm font-bold text-amber-400 mt-1">{fmt(comissao_inst_calc)}</div>
                      </div>
                      <div>
                        <div className="font-bold text-white border-b border-gray-600 pb-1 mb-1">Mensal</div>
                        <div className="text-[10px] text-brand-primary font-mono mb-1 leading-relaxed bg-black/40 p-2 rounded">MÁX(0, (Receita Líquida Mensal × % Receita Líquida) / (Prazo Contrato - Prazo Instalação))</div>
                        <div className="text-sm font-bold text-amber-400 mt-1">{fmt(comissao_mensal_calc)}</div>
                      </div>
                    </div>
                  }>
                    <div className="p-4 sm:p-5 hover:bg-white/[0.03] transition-colors cursor-help group border-l lg:border-l-0 border-border-subtle">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2 flex items-center gap-1.5 group-hover:text-gray-300 transition-colors">
                        Comissão Rec/Liq
                        <HelpCircle className="w-3 h-3 opacity-50" />
                      </span>
                      <p className="text-xl font-bold text-text-primary">{fmt(diretor_comissao)}</p>
                    </div>
                  </Tooltip>

                  <div className="p-4 sm:p-5 bg-white/[0.015]">
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-2">Saldo de Contrato</span>
                    <p className="text-xl font-bold text-brand-primary">{fmt(diretor_saldo)}</p>
                  </div>

                  <div className="p-4 sm:p-5 bg-white/[0.015] border-l lg:border-l-0 border-border-subtle">
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block mb-2">Margem</span>
                    <p className="text-xl font-bold text-teal-500">{fmtPct(diretor_margem)}</p>
                  </div>

                  <Tooltip content={
                    <div className="w-72 space-y-1 text-gray-200">
                      <div className="font-bold text-white border-b border-gray-600 pb-1 mb-2">Módulo de Retorno (Iterativo)</div>
                      <div className="text-[10px] text-brand-primary font-mono bg-black/40 p-2 rounded">Simulação iterativa mês a mês calculando quando o fluxo de "Faturamento - Impostos - Custos Operacionais - Comissões" amortiza o Investimento inicial.</div>
                    </div>
                  }>
                    <div className="p-4 sm:p-5 hover:bg-brand-primary/5 transition-colors cursor-help group bg-brand-primary/[0.03] col-span-2 lg:col-span-1 border-t lg:border-t-0 border-border-subtle">
                      <span className="text-[10px] font-semibold text-brand-primary/80 uppercase tracking-wider mb-2 flex items-center gap-1.5 group-hover:text-brand-primary transition-colors">
                        ROI Final
                        <HelpCircle className="w-3 h-3 opacity-60" />
                      </span>
                      <p className="text-xl font-black text-brand-secondary">{diretor_roi.toFixed(1)} <span className="text-xs font-semibold text-brand-primary/60 ml-0.5">meses</span></p>
                    </div>
                  </Tooltip>
                </div>

                {/* Decision Engine: Rentabilidade de Capital */}
                <div className="mt-8 pt-6 border-t border-border-subtle">
                  <div
                    className="flex items-center justify-between mb-2 cursor-pointer hover:opacity-80 transition-opacity"
                    onClick={() => setIsComparativoExpanded(!isComparativoExpanded)}
                  >
                    <h3 className="font-semibold text-text-primary text-base flex items-center gap-2">
                      Análise de Rentabilidade de Capital
                      {isComparativoExpanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
                    </h3>
                  </div>

                  {isComparativoExpanded && (
                    <div className="mt-0 animate-in fade-in slide-in-from-top-2 duration-300">
                      <RentalROIAnalysis
                        custoAquisicaoTotal={rentalTotals.investimento}
                        valorLocacaoMensal={rentalTotals.faturamentoMensal}
                        prazoContratoMeses={prazoContratoMeses}
                        roiFinalMeses={diretor_roi}
                        saldoContratoReal={diretor_saldo}
                      />
                    </div>
                  )}
                </div>
              </div >
              <EvolutivoChartModal
                isOpen={showEvolutivoChart}
                onClose={() => setShowEvolutivoChart(false)}
                chartData={chartData}
                prazoContrato={prazoContratoMeses || 1}
                paybackMes={paybackMes}
                roiFinal={diretor_roi}
                totals={{
                  investimento: rentalTotals.investimento,
                  faturamento: rentalTotals.faturamentoTotal,
                  impostos: rentalTotals.impostosTotal,
                  manutencao: rentalTotals.custoOpTotal,
                  comissao: diretor_comissao,
                  lucro: diretor_saldo,
                  margem: diretor_margem
                }}
              />

              {/* Rental Consolidation */}
              {/* Rental Consolidation */}
              <div className="mt-10 mb-6">
                <h2 className="font-black text-text-primary text-xs uppercase tracking-[0.15em] mb-3 flex items-center gap-3">
                  <span className="w-3 h-3 bg-brand-primary block rounded-sm"></span>
                  Fechamento de Proposta
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-12 border-y md:border border-border-subtle bg-bg-deep shadow-sm">

                  {/* Left Main Metrics (8 cols) */}
                  <div className="lg:col-span-8 grid grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border-subtle">

                    {/* Mensal */}
                    <Tooltip content={
                      <div className="w-64 space-y-2 text-gray-200">
                        <div className="font-bold text-white border-b border-gray-600 pb-1">Valores Mensais Unitários</div>
                        {rentalItems.filter(ri => !ri.is_kit_instalacao).map((ri, idx) => (
                          <div key={ri.id || idx} className="flex justify-between text-[11px] mb-0.5">
                            <span className="truncate pr-2">{ri.product_nome}</span>
                            <span className="font-medium text-brand-primary whitespace-nowrap">{fmt(ri.faturamento_mensal || ri.valor_mensal)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-bold border-t border-gray-600 pt-1 mt-1">
                          <span>Total Unitário:</span>
                          <span className="text-brand-primary">
                            {fmt(rentalItems.reduce((acc, ri) => acc + (ri.is_kit_instalacao ? 0 : (ri.faturamento_mensal || ri.valor_mensal)), 0))}
                          </span>
                        </div>
                      </div>
                    }>
                      <div className="p-4 md:p-6 hover:bg-surface/50 transition-colors cursor-help group flex flex-col justify-between h-full border-b md:border-b-0 border-border-subtle lg:col-span-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-4 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                          Mensal Locação
                          <HelpCircle className="w-3.5 h-3.5" />
                        </span>
                        <p className="text-2xl sm:text-3xl font-black text-brand-primary tracking-tight">{fmt(rentalTotals.faturamentoMensal)}</p>
                      </div>
                    </Tooltip>

                    {/* Faturamento Total */}
                    <div className="p-4 md:p-6 bg-surface/30 flex flex-col justify-between h-full border-b md:border-b-0 border-border-subtle lg:col-span-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-4 block opacity-80">Fat. Total</span>
                      <p className="text-2xl sm:text-3xl font-black text-teal-600 tracking-tight">{fmt(rentalTotals.faturamentoTotal)}</p>
                    </div>

                    {/* Total Instalação (Only if exists) OR Prazo */}
                    <div className="p-4 md:p-6 bg-bg-deep flex flex-col justify-between h-full lg:col-span-1">
                      {rentalTotals.totalInstalacao > 0 ? (
                        <>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-teal-500/80 mb-4 block opacity-80">Total Instalação</span>
                          <p className="text-2xl sm:text-3xl font-black text-teal-500 tracking-tight">{fmt(rentalTotals.totalInstalacao)}</p>
                        </>
                      ) : (
                        <>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-4 block opacity-80">Prazo</span>
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">{prazoContratoMeses}</p>
                            <span className="text-sm font-bold text-text-muted uppercase tracking-widest">meses</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Right Costs Breakdown Grid (4 cols) */}
                  <div className="lg:col-span-4 border-t lg:border-t-0 lg:border-l border-border-subtle grid grid-cols-2 divide-x divide-y divide-border-subtle bg-surface/20">

                    {/* Custo Aq */}
                    <Tooltip content={
                      <div className="w-64 space-y-2 text-gray-200">
                        <div className="font-bold text-white border-b border-gray-600 pb-1">Composição do Custo</div>
                        <div className="flex justify-between text-sm"><span>Fornecedores:</span> <span className="font-medium text-white">{fmt(rentalTotals.fornecedoresTotal)}</span></div>
                        <div className="flex justify-between text-sm"><span>Impostos Compra:</span> <span className="font-medium text-amber-400">{fmt(rentalTotals.impostosCompraTotal)}</span></div>
                        <div className="flex justify-between text-sm"><span>Frete:</span> <span className="font-medium text-white">{fmt(rentalTotals.freteTotal)}</span></div>
                      </div>
                    }>
                      <div className="p-4 hover:bg-surface transition-colors cursor-help group">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                          Custo Aquisição
                          <HelpCircle className="w-3" />
                        </span>
                        <p className="text-lg font-bold text-text-primary">{fmt(rentalTotals.investimento)}</p>
                      </div>
                    </Tooltip>

                    {/* Impostos */}
                    <Tooltip content={
                      <div className="w-max min-w-[340px] space-y-2 text-gray-200 pr-2">
                        <div className="font-bold text-amber-400 border-b border-gray-600 pb-1 mb-2">Desmembramento de Impostos</div>
                        <table className="w-full text-sm text-right border-collapse">
                          <thead>
                            <tr className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-600">
                              <th className="text-left pb-1 font-bold">Imposto</th>
                              <th className="pb-1 font-bold pl-3">Alíq.</th>
                              {rentalTotals.totalInstalacao > 0 && <th className="pb-1 font-bold pl-4">Inst.</th>}
                              <th className="pb-1 font-bold pl-4">Mensal</th>
                              <th className="pb-1 font-bold pl-4">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-700/50">
                            {[
                              { label: 'PIS', valMen: rentalTotals.impostosDetalhados.pis, valInst: rentalTotals.impostosInstalacaoDetalhados.pis },
                              { label: 'COFINS', valMen: rentalTotals.impostosDetalhados.cofins, valInst: rentalTotals.impostosInstalacaoDetalhados.cofins },
                              { label: 'CSLL', valMen: rentalTotals.impostosDetalhados.csll, valInst: rentalTotals.impostosInstalacaoDetalhados.csll },
                              { label: 'IRPJ', valMen: rentalTotals.impostosDetalhados.irpj, valInst: rentalTotals.impostosInstalacaoDetalhados.irpj },
                              { label: 'ISS', valMen: rentalTotals.impostosDetalhados.iss, valInst: rentalTotals.impostosInstalacaoDetalhados.iss }
                            ].map(imp => {
                              const rFat = rentalTotals.faturamentoMensal > 0 ? rentalTotals.faturamentoMensal : rentalTotals.totalInstalacao;
                              const rVal = rentalTotals.faturamentoMensal > 0 ? imp.valMen : imp.valInst;
                              const pct = rFat > 0 ? (rVal / rFat) * 100 : 0;
                              const totMensalPrazo = imp.valMen * prazoContratoMeses;
                              const tot = totMensalPrazo + imp.valInst;
                              if (pct === 0 && tot === 0) return null;
                              return (
                                <tr key={imp.label} className="hover:bg-white/5 transition-colors">
                                  <td className="text-left font-medium text-white py-1">{imp.label}</td>
                                  <td className="text-xs text-amber-400 pl-3">{fmtPct(pct)}</td>
                                  {rentalTotals.totalInstalacao > 0 && <td className="text-gray-300 pl-4">{fmt(imp.valInst)}</td>}
                                  <td className="text-gray-300 pl-4">{fmt(imp.valMen)}</td>
                                  <td className="text-white font-medium pl-4">{fmt(tot)}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-gray-600 font-bold">
                              <td className="text-left text-white pt-1.5">Total</td>
                              <td className="pt-1.5"></td>
                              {rentalTotals.totalInstalacao > 0 && <td className="text-gray-300 pt-1.5 pl-4">{fmt(rentalTotals.impostosInstalacaoTotal)}</td>}
                              <td className="text-gray-300 pt-1.5 pl-4">{fmt(rentalTotals.impostosMensal)}</td>
                              <td className="text-amber-400 pt-1.5 pl-4">{fmt(rentalTotals.impostosTotal)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    }>
                      <div className="p-4 hover:bg-surface transition-colors cursor-help group">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                          Impostos Totais
                          <HelpCircle className="w-3" />
                        </span>
                        <p className="text-lg font-bold text-amber-500">{fmt(rentalTotals.impostosTotal)}</p>
                      </div>
                    </Tooltip>

                    {/* Custo Operacional */}
                    <Tooltip content={
                      <div className="w-56 space-y-2 text-gray-200">
                        <div className="font-bold text-white border-b border-gray-600 pb-1">Detalhamento Operacional</div>
                        <div className="flex justify-between text-sm"><span>Custo Op. Mensal:</span> <span className="font-medium text-white">{fmt(rentalTotals.custoOpMensalTotal)}</span></div>
                      </div>
                    }>
                      <div className="col-span-2 p-4 hover:bg-surface transition-colors cursor-help group border-t-0">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-text-muted mb-2 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                          Custos Operacionais
                          <HelpCircle className="w-3" />
                        </span>
                        <p className="text-lg font-bold text-text-primary">{fmt(rentalTotals.custoOpTotal)}</p>
                      </div>
                    </Tooltip>

                    {/* ROI Final */}
                    <Tooltip content={
                      <div className="w-72 space-y-1 text-gray-200">
                        <div className="font-bold text-white border-b border-gray-600 pb-1 mb-2">Módulo de Retorno (Iterativo)</div>
                        <div className="text-[10px] text-brand-primary font-mono bg-black/40 p-2 rounded">Simulação iterativa mês a mês. Considera apenas Impostos + Custos Operacionais (sem comissões). Indica quando o faturamento cobre o investimento inicial.</div>
                      </div>
                    }>
                      <div className="p-4 hover:bg-brand-primary/5 transition-colors cursor-help group bg-brand-primary/[0.03] border-t border-border-subtle">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-brand-primary/80 mb-2 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                          ROI Final
                          <HelpCircle className="w-3" />
                        </span>
                        <p className="text-lg font-black text-brand-secondary">
                          {base_roi.toFixed(1)} <span className="text-[10px] font-semibold text-brand-primary/60 ml-0.5 uppercase tracking-widest">meses</span>
                        </p>
                      </div>
                    </Tooltip>

                    {/* MKP Geral */}
                    {(() => {
                      const mkpDivisor = rentalTotals.investimento + rentalTotals.impostosTotal + rentalTotals.custoOpTotal;
                      const mkpGeral = mkpDivisor > 0 ? rentalTotals.faturamentoTotal / mkpDivisor : 0;
                      return (
                        <Tooltip content={
                          <div className="w-72 space-y-2 text-gray-200">
                            <div className="font-bold text-white border-b border-gray-600 pb-1 mb-2">MKP Geral (Markup Global)</div>
                            <div className="text-[11px] space-y-1">
                              <div className="flex justify-between"><span>Faturamento Total:</span> <span className="font-medium text-teal-400">{fmt(rentalTotals.faturamentoTotal)}</span></div>
                              <div className="flex justify-between"><span>Custo Aquisição:</span> <span className="font-medium text-white">{fmt(rentalTotals.investimento)}</span></div>
                              <div className="flex justify-between"><span>Impostos Totais:</span> <span className="font-medium text-amber-400">{fmt(rentalTotals.impostosTotal)}</span></div>
                              <div className="flex justify-between"><span>Custos Operacionais:</span> <span className="font-medium text-white">{fmt(rentalTotals.custoOpTotal)}</span></div>
                              <div className="border-t border-gray-600 pt-1 mt-1 flex justify-between font-bold">
                                <span>Divisor:</span><span className="text-white">{fmt(mkpDivisor)}</span>
                              </div>
                            </div>
                            <div className="text-[10px] text-brand-primary font-mono bg-black/40 p-2 rounded mt-1">
                              MKP = Faturamento / (Custo Aq. + Impostos + Custo Op.)
                            </div>
                          </div>
                        }>
                          <div className="p-4 hover:bg-brand-primary/5 transition-colors cursor-help group bg-brand-primary/[0.03] border-t border-border-subtle">
                            <span className="text-[9px] font-bold uppercase tracking-wider text-brand-primary/80 mb-2 flex items-center justify-between opacity-80 group-hover:opacity-100 transition-opacity">
                              MKP Geral
                              <HelpCircle className="w-3" />
                            </span>
                            <p className={`text-lg font-black ${mkpGeral >= 1 ? 'text-emerald-600' : 'text-rose-500'}`}>
                              {mkpGeral.toFixed(4)}
                            </p>
                          </div>
                        </Tooltip>
                      );
                    })()}

                  </div>
                </div>
              </div>

            </>
          );
        })()}


        {/* Rental Parameters */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2"><Calculator className="w-5 h-5 text-teal-500" />Parâmetros de Locação/Comodato</h2>
            {!isReadonly && (
              <Button size="sm" variant="outline" className="border-brand-primary text-brand-primary hover:bg-brand-primary/10" onClick={() => setShowOverwriteModal(true)}>
                <Save className="w-4 h-4 mr-2" /> Salvar e recalcular oportunidade
              </Button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Prazo Contrato (meses)', val: prazoContratoMeses, set: setPrazoContratoMeses, step: '1' },
              { label: 'Prazo Instalação (meses)', val: prazoInstalacaoMeses, set: setPrazoInstalacaoMeses, step: '1' },
              { label: 'Comissão %', val: percComissaoRental, set: setPercComissaoRental },
            ].map(p => (
              <div key={p.label}>
                <label className="block text-xs font-medium text-text-muted mb-1">{p.label}</label>
                <input type="number" step={p.step || '0.01'} value={p.val} onChange={e => p.set(+e.target.value)} disabled={isReadonly}
                  className="w-full px-2 py-1.5 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500/30 disabled:opacity-60" />
              </div>
            ))}
          </div>
        </div>

        {/* Rental Items Grid */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-text-primary text-lg">Ativos de Locação</h2>
            <div className="flex items-center gap-2">
              {!isReadonly && (
                <Button variant="outline" size="sm" onClick={() => setShowKitSearchModal(true)}>
                  <Package className="w-4 h-4 mr-1" /> Adicionar Kit Global
                </Button>
              )}
              {!isReadonly && (
                <Tooltip content={!id ? "Salve a oportunidade primeiro para criar um kit específico" : ""}>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!id}
                      onClick={() => setShowCreateKitModal(true)}
                    >
                      <Plus className="w-4 h-4 mr-1" /> Criar Novo Kit na Oportunidade
                    </Button>
                  </div>
                </Tooltip>
              )}
              {!isReadonly && (
                <Button variant="outline" size="sm" onClick={() => setShowAddRentalItemModal(true)}>
                  <Plus className="w-4 h-4 mr-1" /> Adicionar Ativo
                </Button>
              )}
            </div>
          </div>
          {rentalItems.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-border-subtle">
                    <th className="px-1.5 py-2 text-left font-semibold text-text-muted uppercase tracking-wider">Produto</th>
                    <th className="px-1.5 py-2 text-center font-semibold text-text-muted uppercase tracking-wider w-14">Qtd</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Custo Aquis.</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Custo Aq. Total</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider" title="Custo Operacional Mensal do Kit (1 uni)">Custo Op. Mensal Unit.</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider" title="Custo Op. Mensal * Quantidade">Custo Op. Total</th>
                    <th className="px-1.5 py-2 text-center font-semibold text-text-muted uppercase tracking-wider w-14">Prazo</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Instalação</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Vlr Unit.</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Vlr Mensal</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider" title="Vlr Mensal x Prazo">Vlr Total</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Impostos</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">ROI</th>
                    <th className="px-1.5 py-2 text-center font-semibold text-text-muted uppercase tracking-wider w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {rentalItems.map((ri, idx) => {
                    return (
                      <tr key={ri.id || idx} className="hover:bg-bg-deep/50 transition-colors">
                        <td className="px-1.5 py-2">
                          <div className="max-w-[220px] font-medium text-text-primary flex items-center gap-2">
                            <span className="truncate" title={ri.product_nome || ''}>{ri.product_nome}</span>
                            {ri.opportunity_kit_id && (
                              <button onClick={() => setViewingKitId(ri.opportunity_kit_id!)} className="flex-shrink-0 p-0.5 text-brand-primary hover:bg-brand-primary/10 rounded transition-colors cursor-pointer" title="Ver Itens do Kit">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="text-[10px] text-brand-primary font-mono">{ri.product_codigo}</div>
                        </td>
                        <td className="px-1.5 py-2 text-center">
                          <input type="number" min="1" value={ri.quantidade} onChange={e => updateRentalItem(idx, 'quantidade', +e.target.value)} disabled={isReadonly}
                            className="w-12 px-1 py-0.5 border border-border-subtle rounded bg-bg-deep text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:opacity-60" />
                        </td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right">
                          <CurrencyCellInput
                            value={ri.custo_aquisicao_unit}
                            onChange={(val: number) => updateRentalItem(idx, 'custo_aquisicao_unit', val)}
                            disabled={isReadonly}
                            className="w-24 px-1 py-0.5 border border-border-subtle rounded bg-bg-deep text-[11px] text-right focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:opacity-60"
                          />
                        </td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted font-medium">
                          {fmt(ri.custo_aquisicao_unit * ri.quantidade)}
                        </td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">
                          {fmt(ri.custo_op_mensal_kit || 0)}
                        </td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted font-medium">
                          {fmt((ri.custo_op_mensal_kit || 0) * ri.quantidade)}
                        </td>
                        <td className="px-1.5 py-2 text-center">
                          <input type="number" min="1" value={ri.prazo_contrato}
                            onChange={e => updateRentalItem(idx, 'prazo_contrato', +e.target.value)}
                            onBlur={e => handleBlurRentalItem(idx, 'prazo_contrato', +e.target.value)}
                            disabled={isReadonly}
                            className="w-12 px-1 py-0.5 border border-border-subtle rounded bg-bg-deep text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-brand-primary/40 disabled:opacity-60 disabled:cursor-not-allowed hover:bg-white/5 transition-colors" />
                        </td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">{ri.is_kit_instalacao ? fmt(ri.faturamento_mensal || ri.valor_mensal) : '-'}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right font-medium text-teal-600/80">{ri.is_kit_instalacao ? fmt(0) : fmt(ri.faturamento_mensal || ri.valor_mensal)}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right font-bold text-teal-600">{ri.is_kit_instalacao ? fmt(0) : fmt((ri.faturamento_mensal || ri.valor_mensal) * ri.quantidade)}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right font-bold text-teal-600">{ri.is_kit_instalacao ? fmt((ri.faturamento_mensal || ri.valor_mensal) * ri.quantidade) : fmt(((ri.faturamento_mensal || ri.valor_mensal) * ri.quantidade) * Math.max(0, (ri.prazo_contrato || 0) - (rentalDefaults.prazo_instalacao_meses || 0)))}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">
                          <Tooltip content={
                            <div className="w-56 space-y-1">
                              <div className="font-semibold text-amber-300 mb-1">Detalhamento de Impostos</div>
                              {ri.opportunity_kit_id ? (() => {
                                const isCom = ri.tipo_contrato_kit === 'COMODATO' || ri.tipo_contrato_kit === 'INSTALACAO';
                                const pImp = (ri.kit_pis || 0) + (ri.kit_cofins || 0) + (ri.kit_csll || 0) + (ri.kit_irpj || 0) + (isCom ? (ri.kit_iss || 0) : 0);
                                const vImp = ri.impostos_mensal * ri.quantidade;
                                return (
                                  <>
                                    {pImp > 0 ? (
                                      <>
                                        <div className="flex justify-between"><span>PIS ({fmtPct(ri.kit_pis || 0)}):</span> <span>{fmt(vImp * ((ri.kit_pis || 0) / pImp))}</span></div>
                                        <div className="flex justify-between"><span>COFINS ({fmtPct(ri.kit_cofins || 0)}):</span> <span>{fmt(vImp * ((ri.kit_cofins || 0) / pImp))}</span></div>
                                        <div className="flex justify-between"><span>CSLL ({fmtPct(ri.kit_csll || 0)}):</span> <span>{fmt(vImp * ((ri.kit_csll || 0) / pImp))}</span></div>
                                        <div className="flex justify-between"><span>IRPJ ({fmtPct(ri.kit_irpj || 0)}):</span> <span>{fmt(vImp * ((ri.kit_irpj || 0) / pImp))}</span></div>
                                        {isCom && (
                                          <div className="flex justify-between"><span>ISS ({fmtPct(ri.kit_iss || 0)}):</span> <span>{fmt(vImp * ((ri.kit_iss || 0) / pImp))}</span></div>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-text-muted">Sem impostos.</span>
                                    )}
                                  </>
                                );
                              })() : (() => {
                                let pImp = Number(rentalDefaults.perc_pis_rental || 0) + Number(rentalDefaults.perc_cofins_rental || 0) + Number(rentalDefaults.perc_csll_rental || 0) + Number(rentalDefaults.perc_irpj_rental || 0);
                                const isCom = rentalDefaults.tipo_receita_rental === 'COMODATO' || ri.tipo_contrato_kit === 'COMODATO';
                                if (isCom) pImp += Number(rentalDefaults.perc_iss_rental || 0);
                                const vImp = ri.impostos_mensal * ri.quantidade;
                                return (
                                  <>
                                    {pImp > 0 ? (
                                      <>
                                        <div className="flex justify-between"><span>PIS ({fmtPct(rentalDefaults.perc_pis_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_pis_rental || 0) / pImp))}</span></div>
                                        <div className="flex justify-between"><span>COFINS ({fmtPct(rentalDefaults.perc_cofins_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_cofins_rental || 0) / pImp))}</span></div>
                                        <div className="flex justify-between"><span>CSLL ({fmtPct(rentalDefaults.perc_csll_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_csll_rental || 0) / pImp))}</span></div>
                                        <div className="flex justify-between"><span>IRPJ ({fmtPct(rentalDefaults.perc_irpj_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_irpj_rental || 0) / pImp))}</span></div>
                                        {isCom && (
                                          <div className="flex justify-between"><span>ISS ({fmtPct(rentalDefaults.perc_iss_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_iss_rental || 0) / pImp))}</span></div>
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-text-muted">Sem impostos.</span>
                                    )}
                                  </>
                                );
                              })()}
                              <div className="border-t border-white/20 pt-1 mt-1 flex justify-between font-bold">
                                <span>Total Impostos:</span><span>{fmt(ri.impostos_mensal * ri.quantidade)}</span>
                              </div>
                            </div>
                          }>
                            <span className="cursor-help border-b border-dashed text-brand-danger/90 border-brand-danger/50">{fmt(ri.impostos_mensal * ri.quantidade)}</span>
                          </Tooltip>
                        </td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right font-semibold text-brand-secondary">
                          {ri.roi_meses ? `${ri.roi_meses.toFixed(1)} m` : '-'}
                        </td>
                        <td className="px-1 py-2 text-center">
                          {!isReadonly && (
                            <button onClick={() => removeRentalItem(idx)} className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer" title="Remover">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-bg-subtle/50 font-bold border-t-2 border-border-subtle">
                  <tr>
                    <td colSpan={3} className="px-1.5 py-2 text-right">Total:</td>
                    <td className="px-1.5 py-2 text-right text-text-primary">{fmt(rentalItems.reduce((acc, ri) => acc + (ri.custo_aquisicao_unit * ri.quantidade), 0))}</td>
                    <td className="px-1.5 py-2 text-right text-text-primary">{fmt(rentalItems.reduce((acc, ri) => acc + (ri.custo_op_mensal_kit || 0), 0))}</td>
                    <td className="px-1.5 py-2 text-right text-text-primary">{fmt(rentalItems.reduce((acc, ri) => acc + ((ri.custo_op_mensal_kit || 0) * ri.quantidade), 0))}</td>
                    <td colSpan={2}></td>
                    <td className="px-1.5 py-2 text-right text-brand-primary">{fmt(rentalItems.reduce((acc, ri) => acc + (ri.is_kit_instalacao ? 0 : (ri.faturamento_mensal || ri.valor_mensal)), 0))}</td>
                    <td className="px-1.5 py-2 text-right text-brand-primary">{fmt(rentalItems.reduce((acc, ri) => acc + (ri.is_kit_instalacao ? 0 : ((ri.faturamento_mensal || ri.valor_mensal) * ri.quantidade)), 0))}</td>
                    <td className="px-1.5 py-2 text-right text-brand-primary">{fmt(rentalItems.reduce((acc, ri) => acc + (ri.is_kit_instalacao ? ((ri.faturamento_mensal || ri.valor_mensal) * ri.quantidade) : (((ri.faturamento_mensal || ri.valor_mensal) * ri.quantidade) * Math.max(0, (ri.prazo_contrato || 0) - (rentalDefaults.prazo_instalacao_meses || 0)))), 0))}</td>
                    <td className="px-1.5 py-2 text-right text-brand-danger/90">{fmt(rentalItems.reduce((acc, ri) => acc + (ri.impostos_mensal * ri.quantidade), 0))}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* ═══ COMPRA TAB ═══ */}
      {activeTab === 'compra' && (
        <div className="space-y-6">
          <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-orange-500" />
              Dados da Compra
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-text-primary flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-text-muted" />
                    Fornecedor
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsQuickSupplierModalOpen(true)}
                    className="text-xs text-brand-primary hover:text-brand-primary-hover font-medium flex items-center gap-1"
                    disabled={isReadonly}
                  >
                    <Plus className="w-3 h-3" /> Novo
                  </button>
                </div>
                <select
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60"
                  value={purchaseSupplierId}
                  onChange={e => { setPurchaseSupplierId(e.target.value); setHasUnsavedChanges(true); }}
                  disabled={isReadonly}
                >
                  <option value="">Selecione o Fornecedor...</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.nome_fantasia || s.razao_social}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">Tipo de Frete</label>
                <div className="flex bg-bg-deep rounded-lg p-1 border border-border-subtle">
                  <button type="button" onClick={() => { setPurchaseFreteTipo('FOB'); setHasUnsavedChanges(true); }} disabled={isReadonly}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${purchaseFreteTipo === 'FOB' ? 'bg-surface text-text-primary shadow-sm border border-border-subtle/50' : 'text-text-muted hover:text-text-primary'}`}>FOB</button>
                  <button type="button" onClick={() => { setPurchaseFreteTipo('CIF'); setHasUnsavedChanges(true); }} disabled={isReadonly}
                    className={`flex-1 text-xs font-semibold py-1.5 rounded-md transition-colors ${purchaseFreteTipo === 'CIF' ? 'bg-blue-500 text-white shadow-sm' : 'text-text-muted hover:text-text-primary'}`}>CIF</button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-muted mb-1.5">% Frete Fixo</label>
                <div className="relative">
                  <input type="number" step="0.01" min="0" value={purchaseFretePercent} onChange={e => { setPurchaseFretePercent(+e.target.value); setHasUnsavedChanges(true); }} disabled={isReadonly}
                    className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 pl-8 disabled:opacity-60" />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted font-bold text-sm">%</span>
                </div>
              </div>

              <div className="flex items-center pt-6">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-text-primary opacity-90 transition-opacity hover:opacity-100">
                  <input type="checkbox" checked={purchaseIpiCalculado} onChange={e => { setPurchaseIpiCalculado(e.target.checked); setHasUnsavedChanges(true); }} disabled={isReadonly}
                    className="w-4 h-4 rounded border-border-subtle text-brand-primary focus:ring-brand-primary/30 bg-bg-deep" />
                  Calcular IPI na Base do ICMS
                </label>
              </div>
            </div>
          </div>

          <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
            <div className="bg-bg-subtle px-6 py-4 border-b border-border-subtle flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">Itens da Oportunidade</h2>
                <p className="text-xs text-text-muted mt-0.5">Adicione os produtos manualmente ou importe via planilha.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" className="bg-white hover:bg-slate-50 text-sm whitespace-nowrap" onClick={() => {
                  const link = document.createElement('a');
                  link.href = '/modelo_orcamento.xlsx';
                  link.download = 'modelo_orcamento.xlsx';
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}>
                  <Download className="w-4 h-4 mr-2 text-brand-primary" />
                  Baixar Modelo Excel
                </Button>
                <Button variant="outline" className="bg-white hover:bg-slate-50 text-sm whitespace-nowrap" onClick={() => setIsPurchaseImportModalOpen(true)}>
                  <Upload className="w-4 h-4 mr-2 text-brand-primary" />
                  Importar Planilha
                </Button>
              </div>
            </div>

            <div className="p-6 pt-2">
              <BudgetItemsGrid
                items={purchaseItems}
                onChange={(newItems: any[]) => { setPurchaseItems(newItems); setHasUnsavedChanges(true); }}
                freteTipoCabecalho={purchaseFreteTipo}
                fretePercentCabecalho={purchaseFretePercent}
                ipiCalculado={purchaseIpiCalculado}
              />
            </div>
          </div>
        </div>
      )}

      {/* COMPRA IMPORT/RECONCILIATION MODALS */}
      <BudgetImportModal
        isOpen={isPurchaseImportModalOpen}
        onClose={() => setIsPurchaseImportModalOpen(false)}
        supplierId={purchaseSupplierId}
        onImportSuccess={(foundItems, notFoundItems) => {
          const safeFoundItems = foundItems || [];
          const safeNotFoundItems = notFoundItems || [];
          const mapped = safeFoundItems.map(item => ({
            product_id: item.product.id,
            product_nome: item.product.nome,
            product_codigo: item.product.codigo || '',
            codigo_fornecedor: item.codigo_fornecedor || '',
            ncm: item.ncm || item.product.ncm || '',
            quantidade: item.quantidade || 1,
            valor_unitario: item.valor_unitario || 0,
            frete_percent: item.frete_percent || 0,
            ipi_percent: item.ipi_percent || 0,
            icms_percent: item.icms_percent || 0
          }));
          setPurchaseItems(prev => {
            setHasUnsavedChanges(true);
            return [...prev, ...mapped];
          });
          if (safeNotFoundItems.length > 0) {
            setPurchaseUnresolvedItems(safeNotFoundItems);
            setIsPurchaseReconciliationModalOpen(true);
          }
        }}
      />

      <BudgetReconciliationModal
        isOpen={isPurchaseReconciliationModalOpen}
        onClose={() => setIsPurchaseReconciliationModalOpen(false)}
        supplierId={purchaseSupplierId}
        notFoundItems={purchaseUnresolvedItems}
        onResolved={(resolvedItem) => {
          const mapped = {
            product_id: resolvedItem.product.id,
            product_nome: resolvedItem.product.nome,
            product_codigo: resolvedItem.product.codigo || '',
            codigo_fornecedor: resolvedItem.codigo_fornecedor || '',
            ncm: resolvedItem.product.ncm_codigo || '',
            quantidade: resolvedItem.quantidade || 1,
            valor_unitario: resolvedItem.valor_unitario || 0,
            frete_percent: resolvedItem.frete_percent || 0,
            ipi_percent: resolvedItem.ipi_percent || 0,
            icms_percent: resolvedItem.icms_percent || 0
          };
          setPurchaseItems(prev => {
            setHasUnsavedChanges(true);
            return [...prev, mapped];
          });
        }}
        onIgnored={() => { }}
      />

      <QuickSupplierCreateModal
        isOpen={isQuickSupplierModalOpen}
        onClose={() => setIsQuickSupplierModalOpen(false)}
        onSuccess={(supplier) => {
          setSuppliers(prev => [...prev, supplier]);
          setPurchaseSupplierId(supplier.id);
          setHasUnsavedChanges(true);
        }}
      />

      {/* Create Kit Modal Overlay */}
      {showCreateKitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-deep rounded-2xl shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-bg-surface flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-text-primary flex items-center gap-2">Criar Kit Exclusivo</h3>
              <button onClick={() => setShowCreateKitModal(false)} className="p-1 hover:bg-black/5 rounded transition-colors text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-bg-deep">
              <OpportunityKitForm
                isModal={true}
                onClose={() => setShowCreateKitModal(false)}
                initialSalesBudgetId={id}
                initialTipoContrato={novoKitTipoContrato}
                onSuccess={(savedKit) => {
                  setShowCreateKitModal(false);
                  if (savedKit) {
                    if (activeTab === 'venda') handleAddKitVenda(savedKit);
                    else handleAddKit(savedKit);
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Overwrite Confirmation Modal */}
      {showOverwriteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-deep rounded-2xl shadow-2xl p-6 w-full max-w-md border border-border-subtle">
            <h3 className="text-xl font-bold mb-4 text-text-primary">Confirmar Substituição</h3>
            <p className="text-text-muted mb-6">
              Esta ação irá <b>salvar a oportunidade atual</b> e aplicar os valores de <br /><br />
              • Prazo de contrato<br />
              • Prazo de instalação (Carência)<br /><br />
              em <b>todos os kits lançados</b> nesta oportunidade, sobrepondo os valores atuais e recalculando tudo automaticamente. Deseja prosseguir?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowOverwriteModal(false)} disabled={saving}>Cancelar</Button>
              <Button onClick={handleGlobalKitOverwrite} disabled={saving} className="bg-brand-primary text-white">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Product Search Modal — Rental */}
      {showAddRentalItemModal && (
        <AddRentalItemModal
          open={showAddRentalItemModal}
          onOpenChange={setShowAddRentalItemModal}
          defaultInstalacaoPct={rentalDefaults.perc_instalacao_padrao || 0}
          onConfirm={handleAddRentalItem}
        />
      )}
      {/* Kit Search Modal - Rental */}
      {showKitSearchModal && (
        <OpportunityKitSearchModal
          isOpen={showKitSearchModal}
          onClose={() => setShowKitSearchModal(false)}
          onSelect={handleAddKit}
        />
      )}

      {/* Kit Search Modal - Sale */}
      {showKitSearchVenda && (
        <OpportunityKitSearchModal
          isOpen={showKitSearchVenda}
          tipoContrato="VENDA_EQUIPAMENTOS"
          onClose={() => setShowKitSearchVenda(false)}
          onSelect={handleAddKitVenda}
        />
      )}
      {/* Kit Items Edit Modal */}
      {viewingKitId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-bg-deep rounded-2xl shadow-2xl w-full h-full max-w-[98vw] max-h-[98vh] flex flex-col overflow-hidden">
            <div className="p-4 border-b border-border-subtle bg-bg-surface flex justify-between items-center shrink-0">
              <h3 className="font-semibold text-lg text-text-primary flex items-center gap-2">Editar Kit na Oportunidade</h3>
              <button onClick={() => setViewingKitId(null)} className="p-1 hover:bg-black/5 rounded transition-colors text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-bg-deep">
              <OpportunityKitForm
                isModal={true}
                modalEditKitId={viewingKitId}
                onClose={() => setViewingKitId(null)}
                initialSalesBudgetId={id}
                onSuccess={(savedKit) => {
                  setViewingKitId(null);
                  if (savedKit) {
                    // Update Rental Items
                    setRentalItems(prev => prev.map(item => {
                      if (item.opportunity_kit_id === savedKit.id || item.opportunity_kit_id === viewingKitId) {
                        const billingValue = savedKit.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? Number(savedKit.summary?.venda_equipamentos_total || 0) : Number(savedKit.summary?.valor_mensal_antes_impostos ?? savedKit.summary?.valor_mensal_kit ?? item.kit_valor_mensal ?? 0);
                        const aliqTotal = Number(savedKit.summary?.aliq_total_impostos || 0) / 100;
                        const impostosKit = billingValue * aliqTotal;
                        const recLiqKit = billingValue - impostosKit;
                        const prazoMensalidades = Math.max(0,
                          Number(savedKit.prazo_contrato_meses || item.prazo_contrato || 0) -
                          Number(rentalDefaults.prazo_instalacao_meses || 0)
                        );
                        const custoAqUnit = Number(savedKit.summary?.custo_aquisicao_total || 0);
                        const custoOpMes = Number(savedKit.summary?.custo_operacional_mensal_kit || 0);
                        const custoTotalContrato = custoAqUnit + (custoOpMes * prazoMensalidades);

                        return {
                          ...item,
                          opportunity_kit_id: savedKit.id,
                          product_nome: `Kit: ${savedKit.nome_kit || 'Personalizado'}`,
                          custo_op_mensal_kit: custoOpMes,
                          is_kit_instalacao: savedKit.tipo_contrato === 'INSTALACAO',
                          tipo_contrato_kit: savedKit.tipo_contrato,
                          kit_taxa_juros_mensal: savedKit.taxa_juros_mensal != null ? Number(savedKit.taxa_juros_mensal) : null,
                          kit_custo_produtos: Number(savedKit.summary?.custo_aquisicao_produtos || 0),
                          kit_custo_servicos: Number(savedKit.summary?.custo_aquisicao_servicos || 0),
                          kit_pis: Number(savedKit.aliq_pis || 0),
                          kit_cofins: Number(savedKit.aliq_cofins || 0),
                          kit_csll: Number(savedKit.aliq_csll || 0),
                          kit_irpj: Number(savedKit.aliq_irpj || 0),
                          kit_iss: Number(savedKit.aliq_iss || 0),
                          custo_aquisicao_unit: custoAqUnit,
                          ipi_unit: Number(savedKit.summary?.total_ipi_kit || 0),
                          frete_unit: Number(savedKit.summary?.total_frete_kit || 0),
                          icms_st_unit: Number(savedKit.summary?.total_st_kit || 0),
                          difal_unit: Number(savedKit.summary?.total_difal_kit || 0),
                          taxa_manutencao_anual_item: Number(savedKit.taxa_manutencao_anual || 0),
                          fator_margem: Number(savedKit.fator_margem_locacao || item.fator_margem || 1),
                          prazo_contrato: Number(savedKit.prazo_contrato_meses || item.prazo_contrato),
                          kit_vlt_manut: Number(savedKit.summary?.vlt_manut || 0),
                          kit_valor_mensal: billingValue,
                          kit_valor_impostos: impostosKit,
                          kit_receita_liquida: Number(savedKit.summary?.receita_liquida_mensal_kit || 0),
                          kit_lucro_mensal: Number(savedKit.summary?.lucro_mensal_kit || 0),
                          kit_margem: Number(savedKit.summary?.margem_kit || 0),
                          // Computed display fields
                          faturamento_mensal: billingValue,
                          valor_mensal: billingValue,
                          impostos_mensal: impostosKit,
                          receita_liquida_mensal: recLiqKit,
                          lucro_mensal: Number(savedKit.summary?.lucro_mensal_kit || 0),
                          margem: Number(savedKit.summary?.margem_kit || 0),
                          roi_meses: recLiqKit > 0 ? (custoTotalContrato / recLiqKit) : 0,
                          custo_total_aquisicao: custoAqUnit,
                          custo_manut_mensal: Number(savedKit.summary?.vlt_manut || 0) + custoOpMes,
                          custo_total_mensal: Number(savedKit.summary?.vlt_manut || 0) + custoOpMes,
                        };
                      }
                      return item;
                    }));

                    // Update Venda Kits
                    setVendaKits(prev => prev.map(item => {
                      if (item.opportunity_kit_id === savedKit.id || item.opportunity_kit_id === viewingKitId) {
                        return {
                          ...item,
                          opportunity_kit_id: savedKit.id,
                          nome_kit: savedKit.nome_kit || 'Kit Venda',
                          fator_margem_locacao: Number(savedKit.fator_margem_locacao || 1),
                          fator_margem_servicos_produtos: Number(savedKit.fator_margem_servicos_produtos || 1),
                          fator_margem_instalacao: Number(savedKit.fator_margem_instalacao || 1),
                          fator_margem_manutencao: Number(savedKit.fator_margem_manutencao || 1),

                          custo_aquisicao_equip_unit: Number(savedKit.summary?.custo_aquisicao_total || 0) + Number(savedKit.summary?.vlr_instal_calc || 0),
                          custo_manutencao_unit: Number(savedKit.summary?.vlt_manut || 0),

                          venda_equip_unit: Number(savedKit.summary?.venda_equipamentos_total ?? savedKit.summary?.valor_mensal_kit ?? 0),
                          venda_manut_unit: Number(savedKit.summary?.venda_manutencao_total ?? 0),

                          faturamento_total: Number(savedKit.summary?.faturamento_total_venda ?? (Number(savedKit.summary?.venda_equipamentos_total || 0) + Number(savedKit.summary?.venda_manutencao_total || 0))),

                          lucro_venda: Number(savedKit.summary?.lucro_equipamentos || 0),
                          margem_venda: Number(savedKit.summary?.margem_equipamentos || 0),

                          lucro_manutencao: Number(savedKit.summary?.lucro_manutencao || 0),
                          margem_manutencao: Number(savedKit.summary?.margem_manutencao || 0),

                          lucro_final: Number(savedKit.summary?.lucro_mensal_kit || 0),
                          margem_geral: Number(savedKit.summary?.margem_kit || 0),

                          havera_manutencao: !!savedKit.havera_manutencao,
                          qtd_meses_manutencao: savedKit.qtd_meses_manutencao ?? null,
                          summary: savedKit.summary,
                          kit_raw: savedKit
                        };
                      }
                      return item;
                    }));
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}

      {showApplyKitsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-surface w-full max-w-md rounded-2xl shadow-xl overflow-hidden border border-border-subtle animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border-subtle">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-brand-primary" />
                Aplicar aos Kits
              </h2>
            </div>
            <div className="p-6 text-text-muted text-sm space-y-4">
              <p>Deseja aplicar os fatores de margem e impostos atuais a todos os kits lançados para esta venda?</p>
              <p>Isso atualizará os valores de venda dos kits. <strong>Kits globais serão clonados para esta oportunidade</strong> para preservar os originais.</p>
            </div>
            <div className="p-6 bg-bg-deep border-t border-border-subtle flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowApplyKitsModal(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => proceedApplyKits()}>
                Sim, aplicar agora
              </Button>
            </div>
          </div>
        </div>
      )}

      {id && (
        <OpportunityCreateModal
          isOpen={isHeaderModalOpen}
          onClose={() => setIsHeaderModalOpen(false)}
          onSuccess={(_modId: string, newTitle?: string, newCust?: string) => {
            if (newTitle) setTitulo(newTitle);
            if (newCust) setCustomerId(newCust);
            setIsHeaderModalOpen(false);
          }}
          initialData={{ id, titulo, customerId }}
        />
      )}

      {/* Custom Inline Discard Dialog */}
      {showDiscardDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface border border-border-subtle rounded-xl shadow-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-amber-500 mb-4">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <HelpCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">Sair sem salvar?</h3>
            </div>
            <p className="text-text-muted mb-6">
              Existem alterações que não foram salvas nesta oportunidade. Se você sair agora, todas as modificações recentes serão perdidas.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button onClick={() => setShowDiscardDialog(false)} variant="outline" className="text-text-secondary border-border-subtle">
                Continuar editando
              </Button>
              <Button onClick={() => navigate('/orcamentos-vendas')} className="bg-red-500 hover:bg-red-600 text-white border-0">
                Descartar e Sair
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ProductSearchModal removed as it is unused
