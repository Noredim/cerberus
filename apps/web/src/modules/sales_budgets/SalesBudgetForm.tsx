import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Save, ArrowLeft, Loader2, Receipt, Plus, Trash2, Calculator, Info, Package, Eye, X, HelpCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { AddRentalItemModal } from './AddRentalItemModal';
import { OpportunityKitSearchModal } from '../../components/modals/OpportunityKitSearchModal';
import { OpportunityKitForm } from '../opportunity_kits/OpportunityKitForm';

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

interface SalesBudgetItem {
  id?: string;
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
          kitFaturamento = Number(item.kit_valor_mensal || 0) - Number(item.kit_valor_impostos || 0);
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



function calcItem(item: SalesBudgetItem, defaults: any): SalesBudgetItem {
  const isService = item.tipo_item !== 'MERCADORIA';
  const useDef = item.usa_parametros_padrao;

  const pFreteVenda = useDef ? defaults.perc_frete_venda : item.perc_frete_venda;
  const pPis = useDef ? defaults.perc_pis : item.perc_pis;
  const pCofins = useDef ? defaults.perc_cofins : item.perc_cofins;
  const pCsll = useDef ? defaults.perc_csll : item.perc_csll;
  const pIrpj = useDef ? defaults.perc_irpj : item.perc_irpj;
  const pIss = useDef ? defaults.perc_iss : item.perc_iss;
  const pDesp = useDef ? defaults.perc_despesa_adm : item.perc_despesa_adm;
  const pCom = useDef ? defaults.perc_comissao : item.perc_comissao;
  const pIcms = useDef ? defaults.perc_icms_interno : item.perc_icms;
  const mk = item.markup || (useDef ? defaults.markup_padrao : 1);

  const custo = item.custo_unit_base;
  const venda = +(custo * mk).toFixed(4);
  const frete = isService ? 0 : +(venda * pFreteVenda / 100).toFixed(4);

  let pis_u = 0, cofins_u = 0, csll_u = 0, irpj_u = 0, icms_u = 0, iss_u = 0;
  if (isService) {
    iss_u = +(venda * pIss / 100).toFixed(4);
  } else {
    pis_u = +(venda * pPis / 100).toFixed(4);
    cofins_u = +(venda * pCofins / 100).toFixed(4);
    csll_u = +(venda * pCsll / 100).toFixed(4);
    irpj_u = +(venda * pIrpj / 100).toFixed(4);
    icms_u = item.tem_st ? 0 : +(venda * pIcms / 100).toFixed(4);
  }

  const impostos = pis_u + cofins_u + csll_u + irpj_u + icms_u + iss_u;
  const desp = +(venda * pDesp / 100).toFixed(4);
  const com = +(venda * pCom / 100).toFixed(4);
  const lucro = +(venda - custo - frete - impostos - desp - com).toFixed(4);
  const margem = venda > 0 ? +(lucro / venda * 100).toFixed(2) : 0;
  const total = +(venda * item.quantidade).toFixed(2);

  return {
    ...item,
    markup: mk,
    venda_unit: venda,
    perc_frete_venda: pFreteVenda, frete_venda_unit: frete,
    perc_pis: pPis, pis_unit: pis_u,
    perc_cofins: pCofins, cofins_unit: cofins_u,
    perc_csll: pCsll, csll_unit: csll_u,
    perc_irpj: pIrpj, irpj_unit: irpj_u,
    perc_icms: pIcms, icms_unit: icms_u,
    perc_iss: pIss, iss_unit: iss_u,
    perc_despesa_adm: pDesp, despesa_adm_unit: desp,
    perc_comissao: pCom, comissao_unit: com,
    lucro_unit: lucro, margem_unit: margem,
    total_venda: total,
  };
}

const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtPct = (v: number) => `${v.toFixed(2)}%`;

export function SalesBudgetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { activeCompanyId } = useAuth();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  // Items
  const [items, setItems] = useState<SalesBudgetItem[]>([]);

  // Tab
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'locacao' ? 'locacao' : 'venda';

  // Rental defaults
  const [tipoReceitaRental, setTipoReceitaRental] = useState('LOCACAO_PURA');
  const [prazoContratoMeses, setPrazoContratoMeses] = useState(36);
  const [prazoInstalacaoMeses, setPrazoInstalacaoMeses] = useState(1);
  const [taxaJurosMensal, setTaxaJurosMensal] = useState(0);
  const [taxaManutencaoAnual, setTaxaManutencaoAnual] = useState(5);
  const [fatorMargemPadrao, setFatorMargemPadrao] = useState(1);
  const [fatorManutencaoPadrao, setFatorManutencaoPadrao] = useState(1);
  const [percInstalacaoPadrao, setPercInstalacaoPadrao] = useState(0);
  const [percComissaoRental, setPercComissaoRental] = useState(0);
  const [percPisRental, setPercPisRental] = useState(0);
  const [percCofinsRental, setPercCofinsRental] = useState(0);
  const [percCsllRental, setPercCsllRental] = useState(0);
  const [percIrpjRental, setPercIrpjRental] = useState(0);
  const [percIssRental, setPercIssRental] = useState(0);
  const [rentalItems, setRentalItems] = useState<RentalBudgetItem[]>([]);
  const [showAddRentalItemModal, setShowAddRentalItemModal] = useState(false);
  const [showKitSearchModal, setShowKitSearchModal] = useState(false);
  const [showCreateKitModal, setShowCreateKitModal] = useState(false);
  const [showOverwriteModal, setShowOverwriteModal] = useState(false);
  const [viewingKitId, setViewingKitId] = useState<string | null>(null);

  // Lookups
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [showProductSearch, setShowProductSearch] = useState(false);

  const isReadonly = status !== 'RASCUNHO';

  const defaults = useMemo(() => ({
    markup_padrao: markupPadrao,
    perc_despesa_adm: percDespesaAdm,
    perc_comissao: percComissao,
    perc_frete_venda: percFreteVenda,
    perc_pis: percPis,
    perc_cofins: percCofins,
    perc_csll: percCsll,
    perc_irpj: percIrpj,
    perc_iss: percIss,
    perc_icms_interno: percIcmsInterno,
    perc_icms_externo: percIcmsExterno,
  }), [markupPadrao, percDespesaAdm, percComissao, percFreteVenda, percPis, percCofins, percCsll, percIrpj, percIss, percIcmsInterno, percIcmsExterno]);

  const rentalDefaults = useMemo(() => ({
    tipo_receita_rental: tipoReceitaRental,
    prazo_contrato_meses: prazoContratoMeses,
    prazo_instalacao_meses: prazoInstalacaoMeses,
    taxa_juros_mensal: taxaJurosMensal,
    taxa_manutencao_anual: taxaManutencaoAnual,
    fator_margem_padrao: fatorMargemPadrao,
    fator_manutencao_padrao: fatorManutencaoPadrao,
    perc_instalacao_padrao: percInstalacaoPadrao,
    perc_comissao_rental: percComissaoRental,
    perc_pis_rental: percPisRental,
    perc_cofins_rental: percCofinsRental,
    perc_csll_rental: percCsllRental,
    perc_irpj_rental: percIrpjRental,
    perc_iss_rental: percIssRental,
  }), [tipoReceitaRental, prazoContratoMeses, prazoInstalacaoMeses, taxaJurosMensal, taxaManutencaoAnual, fatorMargemPadrao, fatorManutencaoPadrao, percInstalacaoPadrao, percComissaoRental, percPisRental, percCofinsRental, percCsllRental, percIrpjRental, percIssRental]);

  // Recalculate items when defaults change
  useEffect(() => {
    setItems(prev => prev.map(item => item.usa_parametros_padrao ? calcItem(item, defaults) : item));
  }, [defaults]);

  useEffect(() => {
    setRentalItems(prev => prev.map(item => calcRentalItem(item, rentalDefaults)));
  }, [rentalDefaults]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [custRes, prodRes] = await Promise.all([
          api.get('/cadastro/clientes', { params: { limit: 200 } }),
          api.get('/cadastro/produtos', { params: { limit: 500 } }),
        ]);
        setCustomers(Array.isArray(custRes.data) ? custRes.data : custRes.data.items || []);
        setProducts(Array.isArray(prodRes.data) ? prodRes.data : prodRes.data.items || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, []);

  // Load company sales parameters as defaults for new budgets
  useEffect(() => {
    if (isEditing || !activeCompanyId) return;
    const loadSalesParams = async () => {
      try {
        const { data } = await api.get(`/companies/${activeCompanyId}/sales-parameters`);
        setMarkupPadrao(Number(data.mkp_padrao) || 1.35);
        setPercDespesaAdm(Number(data.despesa_administrativa) || 0);
        setPercComissao(Number(data.comissionamento) || 0);
        setPercPis(Number(data.pis) || 0);
        setPercCofins(Number(data.cofins) || 0);
        setPercCsll(Number(data.csll) || 0);
        setPercIrpj(Number(data.irpj) || 0);
        setPercIss(Number(data.iss) || 0);
        setPercIcmsInterno(Number(data.icms_interno) || 0);
        setPercIcmsExterno(Number(data.icms_externo) || 0);
      } catch (err) {
        console.error('Failed to load company sales parameters:', err);
      }
    };
    loadSalesParams();
  }, [activeCompanyId, isEditing]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/sales-budgets/${id}`).then(async (res) => {
      const d = res.data;
      setTitulo(d.titulo);
      setCustomerId(d.customer_id);
      setObservacoes(d.observacoes || '');
      setDataOrcamento(d.data_orcamento?.slice(0, 10) || '');
      setStatus(d.status);
      setNumeroOrcamento(d.numero_orcamento || '');
      setResponsavelIds(d.responsavel_ids || []);
      setMarkupPadrao(d.markup_padrao);
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
      setFatorMargemPadrao(Number(d.fator_margem_padrao) || 1);
      setFatorManutencaoPadrao(Number(d.fator_manutencao_padrao) || 1);
      setPercInstalacaoPadrao(Number(d.perc_instalacao_padrao) || 0);
      setPercComissaoRental(Number(d.perc_comissao_rental) || 0);
      setPercPisRental(Number(d.perc_pis_rental) || 0);
      setPercCofinsRental(Number(d.perc_cofins_rental) || 0);
      setPercCsllRental(Number(d.perc_csll_rental) || 0);
      setPercIrpjRental(Number(d.perc_irpj_rental) || 0);
      setPercIssRental(Number(d.perc_iss_rental) || 0);

      // Load sale items and re-fetch cost_composition
      const loadedItems: SalesBudgetItem[] = d.items || [];
      const enriched = await Promise.all(
        loadedItems.map(async (item: SalesBudgetItem) => {
          if (item.product_id) {
            try {
              const { data: cc } = await api.get(`/sales-budgets/product-cost-composition/${item.product_id}`);
              return { ...item, cost_composition: cc };
            } catch { /* fallback: no composition */ }
          }
          return item;
        })
      );
      setItems(enriched);

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
                kit_valor_mensal: Number(kit.summary?.valor_mensal_kit || 0),
                kit_valor_impostos: Number(kit.summary?.valor_impostos || 0),
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
        fator_margem_padrao: d.fator_margem_padrao,
        fator_manutencao_padrao: d.fator_manutencao_padrao,
        perc_instalacao_padrao: d.perc_instalacao_padrao,
        perc_comissao_rental: d.perc_comissao_rental,
        perc_pis_rental: d.perc_pis_rental,
        perc_cofins_rental: d.perc_cofins_rental,
        perc_csll_rental: d.perc_csll_rental,
        perc_irpj_rental: d.perc_irpj_rental,
        perc_iss_rental: d.perc_iss_rental,
        tipo_receita_rental: d.tipo_receita_rental,
      };

      setRentalItems(enrichedRental.map(ri => calcRentalItem(ri, rDefaults)));
    }).catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [id]);

  const addProduct = async (product: any) => {
    // Parallel: check ST + fetch cost composition
    let hasSt = false;
    let costComp: CostComposition | undefined;

    const promises: Promise<void>[] = [];

    if (product.ncm_codigo && activeCompanyId) {
      promises.push(
        api.get(`/sales-budgets/check-st`, {
          params: { ncm_codigo: product.ncm_codigo, company_id: activeCompanyId }
        }).then(({ data }) => { hasSt = data.has_st === true; })
          .catch(err => console.error('ST check failed:', err))
      );
    }

    if (product.id) {
      promises.push(
        api.get(`/sales-budgets/product-cost-composition/${product.id}`)
          .then(({ data }) => { costComp = data; })
          .catch(err => console.error('Cost composition fetch failed:', err))
      );
    }

    await Promise.all(promises);

    const newItem: SalesBudgetItem = {
      product_id: product.id,
      product_nome: product.nome,
      product_codigo: product.codigo,
      ncm_codigo: product.ncm_codigo || '',
      tipo_item: 'MERCADORIA',
      descricao_servico: '',
      usa_parametros_padrao: true,
      custo_unit_base: product.vlr_referencia_revenda || 0,
      markup: markupPadrao,
      venda_unit: 0, quantidade: 1,
      perc_frete_venda: 0, frete_venda_unit: 0,
      perc_pis: 0, pis_unit: 0, perc_cofins: 0, cofins_unit: 0,
      perc_csll: 0, csll_unit: 0, perc_irpj: 0, irpj_unit: 0,
      perc_icms: 0, icms_unit: 0, tem_st: hasSt,
      perc_iss: 0, iss_unit: 0,
      perc_despesa_adm: 0, despesa_adm_unit: 0,
      perc_comissao: 0, comissao_unit: 0,
      lucro_unit: 0, margem_unit: 0, total_venda: 0,
      cost_composition: costComp,
    };
    setItems(prev => [...prev, calcItem(newItem, defaults)]);
    setShowProductSearch(false);
  };

  // @ts-expect-error — kept for future service items implementation
  const addService = (tipo: 'SERVICO_INSTALACAO' | 'SERVICO_MANUTENCAO') => {
    const newItem: SalesBudgetItem = {
      product_id: null,
      product_nome: '',
      product_codigo: '',
      ncm_codigo: '',
      tipo_item: tipo,
      descricao_servico: '',
      usa_parametros_padrao: true,
      custo_unit_base: 0,
      markup: markupPadrao,
      venda_unit: 0, quantidade: 1,
      perc_frete_venda: 0, frete_venda_unit: 0,
      perc_pis: 0, pis_unit: 0, perc_cofins: 0, cofins_unit: 0,
      perc_csll: 0, csll_unit: 0, perc_irpj: 0, irpj_unit: 0,
      perc_icms: 0, icms_unit: 0, tem_st: false,
      perc_iss: 0, iss_unit: 0,
      perc_despesa_adm: 0, despesa_adm_unit: 0,
      perc_comissao: 0, comissao_unit: 0,
      lucro_unit: 0, margem_unit: 0, total_venda: 0,
    };
    setItems(prev => [...prev, calcItem(newItem, defaults)]);
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };
      updated[idx] = calcItem(item, defaults);
      return updated;
    });
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ── Rental item functions ──
  const handleAddRentalItem = (modalOutput: any) => {
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
      fator_margem: fatorMargemPadrao || 1,
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
        fator_margem: Number(kit.fator_margem_locacao || fatorMargemPadrao || 1),
        kit_vlt_manut: Number(kit.summary?.vlt_manut || 0),
        kit_valor_mensal: Number(kit.summary?.valor_mensal_kit || 0),
        kit_valor_impostos: Number(kit.summary?.valor_impostos || 0),
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

  const updateRentalItem = (idx: number, field: string, value: any) => {
    setRentalItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [field]: value };
      updated[idx] = calcRentalItem(item, rentalDefaults);
      return updated;
    });
  };

  const removeRentalItem = (idx: number) => {
    setRentalItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleBlurRentalItem = async (idx: number, field: string, value: any) => {
    const item = rentalItems[idx];
    if (!item.opportunity_kit_id) return;
    
    try {
      const payload: any = {};
      if (field === 'prazo_contrato') payload.prazo_contrato_meses = value;
      else if (field === 'fator_margem') payload.fator_margem_locacao = value;
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
           kit_valor_mensal: Number(updatedKit.summary?.valor_mensal_kit || 0),
           kit_valor_impostos: Number(updatedKit.summary?.valor_impostos || 0),
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
    return { ...t, margem: t.venda > 0 ? (t.lucro / t.venda * 100) : 0 };
  }, [items]);

  // Rental totals
  const rentalTotals = useMemo(() => {
    const t = { 
      investimento: 0, faturamentoMensal: 0, impostosMensal: 0, receitaLiqMensal: 0, custoMensal: 0, lucroMensal: 0,
      fornecedoresTotal: 0, impostosCompraTotal: 0, freteTotal: 0, faturamentoTotal: 0, impostosTotal: 0,
      custoOpMensalTotal: 0, custoOpTotal: 0,
      impostosDetalhados: { pis: 0, cofins: 0, csll: 0, irpj: 0, iss: 0 }
    };
    rentalItems.forEach(i => {
      const q = i.quantidade;
      
      t.investimento += i.custo_total_aquisicao * q;
      const fatur = (i.faturamento_mensal || i.valor_mensal) * q;
      t.faturamentoMensal += fatur;
      const impostos = i.impostos_mensal * q;
      t.impostosMensal += impostos;
      t.receitaLiqMensal += (i.receita_liquida_mensal || i.kit_receita_liquida || 0) * q;
      t.custoMensal += i.custo_total_mensal * q;
      t.lucroMensal += i.lucro_mensal * q;

      const difal_ipi_st = ((i.difal_unit || 0) + (i.ipi_unit || 0) + (i.icms_st_unit || 0)) * q;
      const frete = (i.frete_unit || 0) * q;
      
      t.impostosCompraTotal += difal_ipi_st;
      t.freteTotal += frete;
      t.fornecedoresTotal += (i.custo_total_aquisicao * q) - difal_ipi_st - frete;
      
      t.custoOpMensalTotal += (i.custo_op_mensal_kit || 0) * q;

      // Breakdown monthly taxes
      if (i.opportunity_kit_id) {
         const pImp = (i.kit_pis || 0) + (i.kit_cofins || 0) + (i.kit_csll || 0) + (i.kit_irpj || 0) + (i.kit_iss || 0);
         if (pImp > 0) {
            t.impostosDetalhados.pis += impostos * ((i.kit_pis || 0) / pImp);
            t.impostosDetalhados.cofins += impostos * ((i.kit_cofins || 0) / pImp);
            t.impostosDetalhados.csll += impostos * ((i.kit_csll || 0) / pImp);
            t.impostosDetalhados.irpj += impostos * ((i.kit_irpj || 0) / pImp);
            t.impostosDetalhados.iss += (i.kit_iss || 0) > 0 ? (impostos * ((i.kit_iss || 0) / pImp)) : 0;
         }
      } else {
         let pImp = Number(rentalDefaults.perc_pis_rental || 0) + Number(rentalDefaults.perc_cofins_rental || 0) + Number(rentalDefaults.perc_csll_rental || 0) + Number(rentalDefaults.perc_irpj_rental || 0);
         const isCom = rentalDefaults.tipo_receita_rental === 'COMODATO' || i.tipo_contrato_kit === 'COMODATO';
         if (isCom) pImp += Number(rentalDefaults.perc_iss_rental || 0);
         if (pImp > 0) {
            t.impostosDetalhados.pis += impostos * ((Number(rentalDefaults.perc_pis_rental) || 0) / pImp);
            t.impostosDetalhados.cofins += impostos * ((Number(rentalDefaults.perc_cofins_rental) || 0) / pImp);
            t.impostosDetalhados.csll += impostos * ((Number(rentalDefaults.perc_csll_rental) || 0) / pImp);
            t.impostosDetalhados.irpj += impostos * ((Number(rentalDefaults.perc_irpj_rental) || 0) / pImp);
            if (isCom) t.impostosDetalhados.iss += impostos * ((Number(rentalDefaults.perc_iss_rental) || 0) / pImp);
         }
      }
    });

    // Calculate global totals using the global contract term card
    t.faturamentoTotal = t.faturamentoMensal * (prazoContratoMeses || 1);
    t.impostosTotal = t.impostosMensal * (prazoContratoMeses || 1);
    t.custoOpTotal = t.custoOpMensalTotal * (prazoContratoMeses || 1);

    const receitaMensal = t.faturamentoMensal - t.impostosMensal;
    const roiMeses = receitaMensal > 0 ? ((t.investimento + t.custoOpTotal) / receitaMensal) : 0;

    return { ...t, margem: t.faturamentoMensal > 0 ? (t.lucroMensal / t.faturamentoMensal * 100) : 0, roiMeses };
  }, [rentalItems, rentalDefaults, prazoContratoMeses]);

  const margemClass = totals.margem >= 15 ? 'text-emerald-600' : totals.margem >= 5 ? 'text-amber-600' : 'text-rose-600';
  const margemLabel = totals.margem >= 15 ? 'Saudável' : totals.margem >= 5 ? 'Atenção' : 'Crítico';

  const handleGlobalKitOverwrite = async () => {
    if (!id) {
      alert("Salve o orçamento primeiro antes de sobrescrever kits globais.");
      setShowOverwriteModal(false);
      return;
    }
    const kitIds = Array.from(new Set(rentalItems.filter(ri => ri.opportunity_kit_id).map(ri => ri.opportunity_kit_id)));
    if (kitIds.length === 0) {
      alert("Não há kits lançados neste orçamento para atualizar.");
      setShowOverwriteModal(false);
      return;
    }

    try {
      setSaving(true);
      
      const kitUpdates = await Promise.all(kitIds.map(async kitId => {
        const res = await api.put(`/opportunity-kits/${kitId}`, {
          prazo_contrato_meses: prazoContratoMeses,
          fator_margem_locacao: fatorMargemPadrao,
          fator_manutencao: fatorManutencaoPadrao
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
           fator_margem: fatorMargemPadrao,
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
           kit_valor_mensal: Number(updatedKit.summary?.valor_mensal_kit || 0),
           kit_valor_impostos: Number(updatedKit.summary?.valor_impostos || 0),
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

  const handleSave = async (preventNavigate = false, overriddenRentalItems?: typeof rentalItems) => {
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
        // Rental defaults
        tipo_receita_rental: tipoReceitaRental,
        prazo_contrato_meses: +prazoContratoMeses,
        prazo_instalacao_meses: +prazoInstalacaoMeses,
        taxa_juros_mensal: +taxaJurosMensal,
        taxa_manutencao_anual: +taxaManutencaoAnual,
        fator_margem_padrao: +fatorMargemPadrao,
        fator_manutencao_padrao: +fatorManutencaoPadrao,
        perc_instalacao_padrao: +percInstalacaoPadrao,
        perc_comissao_rental: +percComissaoRental,
        perc_pis_rental: +percPisRental,
        perc_cofins_rental: +percCofinsRental,
        perc_csll_rental: +percCsllRental,
        perc_irpj_rental: +percIrpjRental,
        perc_iss_rental: +percIssRental,
        responsavel_ids: responsavelIds,
        items: items.map(i => ({
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

      if (isEditing) {
        await api.put(`/sales-budgets/${id}`, payload);
        if (!preventNavigate) alert('Salvo com sucesso!');
      } else {
        const res = await api.post('/sales-budgets', payload);
        if (!preventNavigate) navigate(`/orcamentos-vendas/${res.data.id}?tab=${activeTab}`, { replace: true });
      }
      return true;
    } catch (err: any) {
      console.error('Save error:', err.response?.data || err);
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : (typeof detail === 'string' ? detail : err.message);
      alert('Erro ao salvar: ' + msg);
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
          <button onClick={() => navigate('/orcamentos-vendas')} className="p-2 rounded-lg hover:bg-bg-deep text-text-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-text-primary flex items-center gap-2">
              <Receipt className="w-5 h-5 text-brand-primary" />
              {isEditing ? `Orçamento ${numeroOrcamento}` : 'Novo Orçamento de Venda'}
            </h1>
            {isEditing && (
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status === 'RASCUNHO' ? 'bg-amber-100 text-amber-800' : status === 'APROVADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                  {status === 'RASCUNHO' ? 'Rascunho' : status === 'APROVADO' ? 'Aprovado' : 'Arquivado'}
                </span>
              </div>
            )}
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
      <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-text-primary text-lg">Cabeçalho</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Título *</label>
            <input value={titulo} onChange={e => setTitulo(e.target.value)} disabled={isReadonly}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60" />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-muted mb-1">Cliente *</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)} disabled={isReadonly}
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
        <div>
          <label className="block text-sm font-medium text-text-muted mb-1">Observações</label>
          <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} disabled={isReadonly} rows={2}
            className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60" />
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex border-b border-border-subtle">
        <button onClick={() => setSearchParams({ tab: 'venda' }, { replace: true })} className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'venda' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-text-muted hover:text-text-primary'}`}>Venda</button>
        <button onClick={() => setSearchParams({ tab: 'locacao' }, { replace: true })} className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'locacao' ? 'text-teal-600 border-b-2 border-teal-500' : 'text-text-muted hover:text-text-primary'}`}>Locação / Comodato</button>
      </div>

      {/* ═══ VENDA TAB ═══ */}
      {activeTab === 'venda' && (<>
      {/* Consolidação — right after header */}
      {items.length > 0 && (
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-text-primary text-lg">Consolidação</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Custo Total — with composition tooltip */}
            <div className="bg-bg-deep rounded-lg p-3 relative group cursor-help">
              <span className="text-xs text-text-muted border-b border-dashed border-text-muted">Custo Total</span>
              <p className="text-lg font-bold text-text-primary">{fmt(totals.custo)}</p>
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
            <div className="bg-bg-deep rounded-lg p-3">
              <span className="text-xs text-text-muted">Venda Total</span>
              <p className="text-lg font-bold text-text-primary">{fmt(totals.venda)}</p>
            </div>
            {/* Impostos de Venda — with per-tax tooltip */}
            <div className="bg-bg-deep rounded-lg p-3 relative group cursor-help">
              <span className="text-xs text-text-muted border-b border-dashed border-text-muted">Impostos de Venda</span>
              <p className="text-lg font-bold text-text-primary">{fmt(totals.impostos)}</p>
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
              <span className="text-xs text-text-muted">Frete Venda</span>
              <p className="text-lg font-bold text-text-primary">{fmt(totals.frete)}</p>
            </div>
            <div className="bg-bg-deep rounded-lg p-3">
              <span className="text-xs text-text-muted">Desp. Adm.</span>
              <p className="text-lg font-bold text-text-primary">{fmt(totals.despAdm)}</p>
            </div>
            <div className="bg-bg-deep rounded-lg p-3">
              <span className="text-xs text-text-muted">Comissão</span>
              <p className="text-lg font-bold text-text-primary">{fmt(totals.comissao)}</p>
            </div>
            <div className="bg-bg-deep rounded-lg p-3">
              <span className="text-xs text-text-muted">Lucro</span>
              <p className={`text-lg font-bold ${margemClass}`}>{fmt(totals.lucro)}</p>
            </div>
            <div className="bg-bg-deep rounded-lg p-3">
              <span className="text-xs text-text-muted">Margem Líquida</span>
              <p className={`text-lg font-bold ${margemClass}`}>
                {fmtPct(totals.margem)}<span className="text-xs ml-1 font-normal">({margemLabel})</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Pricing Defaults */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
        <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2">
          <Calculator className="w-5 h-5 text-brand-primary" />
          Parâmetros Padrão
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: 'Markup', val: markupPadrao, set: setMarkupPadrao, step: '0.01' },
            { label: 'Desp. Adm. %', val: percDespesaAdm, set: setPercDespesaAdm },
            { label: 'Comissão %', val: percComissao, set: setPercComissao },
            { label: 'Frete Venda %', val: percFreteVenda, set: setPercFreteVenda },
            { label: 'PIS %', val: percPis, set: setPercPis },
            { label: 'COFINS %', val: percCofins, set: setPercCofins },
            { label: 'CSLL %', val: percCsll, set: setPercCsll },
            { label: 'IRPJ %', val: percIrpj, set: setPercIrpj },
            { label: 'ISS %', val: percIss, set: setPercIss },
            { label: 'ICMS Int. %', val: percIcmsInterno, set: setPercIcmsInterno },
            { label: 'ICMS Ext. %', val: percIcmsExterno, set: setPercIcmsExterno },
          ].map(p => (
            <div key={p.label}>
              <label className="block text-xs font-medium text-text-muted mb-1">{p.label}</label>
              <input type="number" step={p.step || '0.01'} value={p.val} onChange={e => p.set(+e.target.value)} disabled={isReadonly}
                className="w-full px-2 py-1.5 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm text-right focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-60" />
            </div>
          ))}
        </div>
      </div>

      {/* Items - Flat Data Table */}
      <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-text-primary text-lg">Itens de Mercadoria</h2>
          {!isReadonly && (
            <Button variant="outline" size="sm" onClick={() => setShowProductSearch(true)}>
              <Plus className="w-4 h-4 mr-1" /> Adicionar Item
            </Button>
          )}
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">Nenhum item adicionado.</div>
        ) : (
          <div>
            <table className="w-full text-left border-collapse">
              <thead className="bg-[#f8f9fa] dark:bg-bg-deep text-[9px] font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle">
                <tr>
                  <th className="px-1.5 py-2 whitespace-nowrap">Produto</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-center w-12">QTD</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Custo Unit</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Custo Total</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-center w-14">MKP</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Venda Unit</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Frete Vda</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Impostos</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Desp. Adm</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Comissão</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Lucro Unit</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Margem</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Venda Total</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-right">Lucro Total</th>
                  <th className="px-1.5 py-2 whitespace-nowrap text-center w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle bg-surface text-[11px]">
                {items.map((item, idx) => {
                  const totalImpostos = item.pis_unit + item.cofins_unit + item.csll_unit + item.irpj_unit + item.icms_unit + item.iss_unit;
                  const custoTotal = item.custo_unit_base * item.quantidade;
                  const lucroTotal = item.lucro_unit * item.quantidade;
                  const vendaTotal = item.venda_unit * item.quantidade;
                  const margemColor = item.margem_unit >= 15 ? 'text-emerald-600' : item.margem_unit >= 5 ? 'text-amber-600' : 'text-rose-600';

                  return (
                    <tr key={idx} className="group hover:bg-bg-deep/50 transition-colors">
                      {/* Produto */}
                      <td className="px-1.5 py-2 whitespace-nowrap max-w-[200px]">
                        <div className="flex flex-col truncate">
                          <span className="font-semibold text-text-primary text-[11px] truncate">{item.product_nome || item.descricao_servico || '—'}</span>
                          {item.product_codigo && <span className="text-[10px] font-mono text-text-muted">{item.product_codigo}</span>}
                        </div>
                      </td>

                      {/* QTD — editable */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-center">
                        <input
                          type="number" step="1" min="1" value={item.quantidade}
                          onChange={e => updateItem(idx, 'quantidade', +e.target.value)}
                          disabled={isReadonly}
                          className="w-12 px-1 py-0.5 border border-border-subtle rounded bg-bg-deep text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-brand-primary/40 disabled:opacity-60"
                        />
                      </td>

                      {/* Custo Unit — with composition tooltip */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-right">
                        <Tooltip content={
                          (() => {
                            const cc = item.cost_composition;
                            const baseU = cc?.base_unitario ?? item.custo_unit_base;
                            const ipiPct = cc?.ipi_percent ?? 0;
                            const ipiU = cc?.ipi_unitario ?? 0;
                            const freteU = cc?.frete_cif_unitario ?? 0;
                            const hasSt = cc?.has_st ?? false;
                            const stNormal = cc?.icms_st_normal ?? 0;
                            const credPct = cc?.cred_outorgado_percent ?? 0;
                            const credVal = cc?.cred_outorgado_valor ?? 0;
                            const stFinal = cc?.icms_st_final ?? 0;
                            const isBit = cc?.is_bit ?? false;
                            const custoFinal = cc?.custo_unit_final ?? item.custo_unit_base;

                            return (
                              <div className="w-72">
                                <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                                  <Info className="w-3.5 h-3.5 text-brand-primary" />
                                  Composição do Custo
                                </div>
                                <div className="space-y-1 font-mono text-text-muted">
                                  <div className="flex justify-between">
                                    <span>Base (Unit.):</span>
                                    <span className="font-semibold text-text-primary">{fmt(baseU)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-amber-300">IPI ({ipiPct.toFixed(0)}%):</span>
                                    <span className="text-amber-300">+ {fmt(ipiU)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span className="text-amber-300">Frete CIF:</span>
                                    <span className="text-amber-300">+ {fmt(freteU)}</span>
                                  </div>
                                  {hasSt && (
                                    <>
                                      <div className="border-t border-border-subtle my-1" />
                                      <div className="flex justify-between">
                                        <span className="text-amber-300">ICMS-ST {isBit ? '(BIT)' : '(Normal)'} unit.:</span>
                                        <span className="text-amber-300">+ {fmt(stNormal)}</span>
                                      </div>
                                      {!isBit && credPct > 0 && (
                                        <>
                                          <div className="flex justify-between">
                                            <span className="text-green-400">Créd. Outorgado ({credPct.toFixed(0)}%):</span>
                                            <span className="text-green-400">- {fmt(credVal)}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-amber-300">ICMS-ST Final unit.:</span>
                                            <span className="text-amber-300">+ {fmt(stFinal)}</span>
                                          </div>
                                        </>
                                      )}
                                    </>
                                  )}
                                  <div className="flex justify-between border-t border-white/20 mt-1.5 pt-1.5 font-bold text-text-primary">
                                    <span>Custo Unit. Final:</span>
                                    <span>{fmt(custoFinal)}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()
                        }>
                          <span className="cursor-help border-b border-dashed border-text-muted">{fmt(item.custo_unit_base)}</span>
                        </Tooltip>
                      </td>

                      {/* Custo Total */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-right font-medium text-text-primary">
                        {fmt(custoTotal)}
                      </td>

                      {/* MKP — editable */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-center">
                        <input
                          type="number" step="0.01" value={item.markup}
                          onChange={e => updateItem(idx, 'markup', +e.target.value)}
                          disabled={isReadonly}
                          className="w-14 px-1 py-0.5 border border-border-subtle rounded bg-bg-deep text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-brand-primary/40 disabled:opacity-60"
                        />
                      </td>

                      {/* Venda Unit */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-right font-medium text-text-primary">
                        {fmt(item.venda_unit)}
                      </td>

                      {/* Frete Venda */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">
                        {fmt(item.frete_venda_unit)}
                      </td>

                      {/* Impostos — with breakdown tooltip */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-right">
                        <Tooltip content={
                          <div className="w-72">
                            <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                              <Info className="w-3.5 h-3.5 text-brand-primary" />
                              Detalhamento de Impostos
                            </div>
                            <div className="space-y-1.5 font-mono text-text-muted">
                              {item.tipo_item === 'MERCADORIA' ? (
                                <>
                                  <div className="flex justify-between"><span>PIS ({fmtPct(item.perc_pis)})</span><span>{fmt(item.pis_unit)}</span></div>
                                  <div className="flex justify-between"><span>COFINS ({fmtPct(item.perc_cofins)})</span><span>{fmt(item.cofins_unit)}</span></div>
                                  <div className="flex justify-between"><span>CSLL ({fmtPct(item.perc_csll)})</span><span>{fmt(item.csll_unit)}</span></div>
                                  <div className="flex justify-between"><span>IRPJ ({fmtPct(item.perc_irpj)})</span><span>{fmt(item.irpj_unit)}</span></div>
                                  <div className="flex justify-between">
                                    <span>ICMS ({fmtPct(item.perc_icms)}){item.tem_st ? ' — ST isento' : ''}</span>
                                    <span>{fmt(item.icms_unit)}</span>
                                  </div>
                                </>
                              ) : (
                                <div className="flex justify-between"><span>ISS ({fmtPct(item.perc_iss)})</span><span>{fmt(item.iss_unit)}</span></div>
                              )}
                              <div className="border-t border-white/20 mt-2 pt-2">
                                <div className="flex justify-between font-bold text-text-primary">
                                  <span>Total Impostos</span>
                                  <span>{fmt(totalImpostos)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        }>
                          <span className="cursor-help border-b border-dashed border-text-muted">{fmt(totalImpostos)}</span>
                        </Tooltip>
                      </td>

                      {/* Desp. Adm — valor */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">
                        {fmt(item.despesa_adm_unit)}
                      </td>

                      {/* Comissão — valor */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">
                        {fmt(item.comissao_unit)}
                      </td>

                      {/* Lucro Unit */}
                      <td className={`px-1.5 py-2 whitespace-nowrap text-right font-semibold ${margemColor}`}>
                        {fmt(item.lucro_unit)}
                      </td>

                      {/* Margem */}
                      <td className={`px-1.5 py-2 whitespace-nowrap text-right font-bold ${margemColor}`}>
                        {fmtPct(item.margem_unit)}
                      </td>

                      {/* Venda Total */}
                      <td className="px-1.5 py-2 whitespace-nowrap text-right font-bold text-brand-primary">
                        {fmt(vendaTotal)}
                      </td>

                      {/* Lucro Total */}
                      <td className={`px-1.5 py-2 whitespace-nowrap text-right font-bold ${margemColor}`}>
                        {fmt(lucroTotal)}
                      </td>

                      {/* Ações */}
                      <td className="px-1 py-2 whitespace-nowrap text-center">
                        {!isReadonly && (
                          <button
                            onClick={() => removeItem(idx)}
                            className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                            title="Remover item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
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
        {/* Rental Consolidation */}
        {rentalItems.length > 0 && (
          <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2">Fechamento de proposta</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              
              {/* Row 1 */}
              <div className="bg-bg-deep rounded-xl p-4 border border-border-subtle">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 block">Valor Locação/Comodato Mensal</span>
                <p className="text-2xl font-black text-brand-primary">{fmt(rentalTotals.faturamentoMensal)}</p>
              </div>

              <div className="bg-bg-deep rounded-xl p-4 border border-border-subtle">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 block">Prazo de Contrato</span>
                <p className="text-2xl font-black text-text-primary">{prazoContratoMeses} <span className="text-sm font-medium text-text-muted">meses</span></p>
              </div>

              <div className="bg-bg-deep rounded-xl p-4 border border-border-subtle md:col-span-1 lg:col-span-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 block">Faturamento Total</span>
                <p className="text-2xl font-black text-teal-600">{fmt(rentalTotals.faturamentoTotal)}</p>
              </div>

              {/* Row 2 */}
              <Tooltip content={
                <div className="w-64 space-y-2 text-gray-200">
                   <div className="font-bold text-white border-b border-gray-600 pb-1">Composição do Custo</div>
                   <div className="flex justify-between text-sm"><span>Fornecedores:</span> <span className="font-medium text-white">{fmt(rentalTotals.fornecedoresTotal)}</span></div>
                   <div className="flex justify-between text-sm"><span>Impostos de compras:</span> <span className="font-medium text-amber-400">{fmt(rentalTotals.impostosCompraTotal)}</span></div>
                   <div className="flex justify-between text-sm"><span>Frete:</span> <span className="font-medium text-white">{fmt(rentalTotals.freteTotal)}</span></div>
                </div>
              }>
                <div className="bg-bg-deep rounded-xl p-4 border border-border-subtle hover:border-brand-primary/50 transition-colors cursor-help">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
                    Custo de Aquisição Total
                    <HelpCircle className="w-3.5 h-3.5 text-text-muted" />
                  </span>
                  <p className="text-2xl font-black text-text-primary">{fmt(rentalTotals.investimento)}</p>
                </div>
              </Tooltip>

              <Tooltip content={
                <div className="w-[340px] space-y-2 text-gray-200">
                   <div className="font-bold text-amber-400 border-b border-gray-600 pb-1 mb-2">Desmembramento de Impostos</div>
                   
                   <div className="grid grid-cols-12 text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                     <div className="col-span-3">Imposto</div>
                     <div className="col-span-2 text-right">% Aliq.</div>
                     <div className="col-span-3 text-right">Mensal</div>
                     <div className="col-span-4 text-right">Total</div>
                   </div>

                   {[
                     { label: 'PIS', val: rentalTotals.impostosDetalhados.pis },
                     { label: 'COFINS', val: rentalTotals.impostosDetalhados.cofins },
                     { label: 'CSLL', val: rentalTotals.impostosDetalhados.csll },
                     { label: 'IRPJ', val: rentalTotals.impostosDetalhados.irpj },
                     { label: 'ISS', val: rentalTotals.impostosDetalhados.iss }
                   ].map(imp => {
                     const pct = rentalTotals.faturamentoMensal > 0 ? (imp.val / rentalTotals.faturamentoMensal) * 100 : 0;
                     const tot = rentalTotals.impostosMensal > 0 ? (imp.val / rentalTotals.impostosMensal) * rentalTotals.impostosTotal : 0;
                     if (pct === 0 && tot === 0) return null;
                     return (
                       <div key={imp.label} className="grid grid-cols-12 text-sm items-center hover:bg-white/5 py-0.5 rounded transition-colors">
                         <span className="col-span-3 font-medium text-white">{imp.label}</span>
                         <span className="col-span-2 text-right text-xs text-amber-400">{fmtPct(pct)}</span>
                         <span className="col-span-3 text-right text-gray-300">{fmt(imp.val)}</span>
                         <span className="col-span-4 text-right text-white font-medium">{fmt(tot)}</span>
                       </div>
                     );
                   })}

                   <div className="grid grid-cols-12 text-sm items-center border-t border-gray-600 pt-1.5 mt-1 font-bold">
                     <span className="col-span-3 text-white">Total</span>
                     <span className="col-span-2 text-right text-amber-500 text-xs">
                       {fmtPct(rentalTotals.faturamentoMensal > 0 ? (rentalTotals.impostosMensal / rentalTotals.faturamentoMensal) * 100 : 0)}
                     </span>
                     <span className="col-span-3 text-right text-gray-300">{fmt(rentalTotals.impostosMensal)}</span>
                     <span className="col-span-4 text-right text-amber-400">{fmt(rentalTotals.impostosTotal)}</span>
                   </div>
                </div>
              }>
                <div className="bg-bg-deep rounded-xl p-4 border border-border-subtle hover:border-brand-primary/50 transition-colors cursor-help">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
                    Impostos Totais
                    <HelpCircle className="w-3.5 h-3.5 text-text-muted" />
                  </span>
                  <p className="text-2xl font-black text-amber-500">{fmt(rentalTotals.impostosTotal)}</p>
                </div>
              </Tooltip>

              <Tooltip content={
                <div className="w-56 space-y-2 text-gray-200">
                   <div className="font-bold text-white border-b border-gray-600 pb-1">Detalhamento Operacional</div>
                   <div className="flex justify-between text-sm"><span>Custo Op. Mensal:</span> <span className="font-medium text-white">{fmt(rentalTotals.custoOpMensalTotal)}</span></div>
                </div>
              }>
                <div className="bg-bg-deep rounded-xl p-4 border border-border-subtle hover:border-brand-primary/50 transition-colors cursor-help">
                  <span className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 flex items-center gap-1">
                    Custos Operacionais Totais
                    <HelpCircle className="w-3.5 h-3.5 text-text-muted" />
                  </span>
                  <p className="text-2xl font-black text-text-primary">{fmt(rentalTotals.custoOpTotal)}</p>
                </div>
              </Tooltip>

              <div className="bg-bg-deep rounded-xl p-4 border border-border-subtle">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1 block">ROI em Meses</span>
                <p className="text-2xl font-black text-brand-secondary">{rentalTotals.roiMeses.toFixed(1)} <span className="text-sm font-medium text-text-muted">meses</span></p>
              </div>

            </div>
          </div>
        )}

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
              { label: 'Fator Margem Padrão', val: fatorMargemPadrao, set: setFatorMargemPadrao, step: '0.01' },
              { label: 'Fator Margem Manut.', val: fatorManutencaoPadrao, set: setFatorManutencaoPadrao, step: '0.01' },
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
                <Tooltip content={!id ? "Salve o orçamento primeiro para criar um kit específico" : ""}>
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
                    <th className="px-1.5 py-2 text-center font-semibold text-text-muted uppercase tracking-wider w-14">F.Margem</th>
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
                          <div className="max-w-[220px] truncate font-medium text-text-primary flex items-center gap-2">
                            <span>{ri.product_nome}</span>
                            {ri.opportunity_kit_id && (
                              <button onClick={() => setViewingKitId(ri.opportunity_kit_id!)} className="p-0.5 text-brand-primary hover:bg-brand-primary/10 rounded transition-colors" title="Ver Itens do Kit">
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
                            className="w-12 px-1 py-0.5 border border-border-subtle rounded bg-bg-deep text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:opacity-60" />
                        </td>
                        <td className="px-1.5 py-2 text-center">
                          <input type="number" step="0.01" min="1" value={ri.fator_margem} 
                            onChange={e => updateRentalItem(idx, 'fator_margem', +e.target.value)} 
                            onBlur={e => handleBlurRentalItem(idx, 'fator_margem', +e.target.value)}
                            disabled={isReadonly}
                            className="w-14 px-1 py-0.5 border border-border-subtle rounded bg-bg-deep text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:opacity-60" />
                        </td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">{ri.is_kit_instalacao ? fmt(ri.parcela_locacao * ri.quantidade) : '-'}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right font-medium text-teal-600/80">{fmt(ri.faturamento_mensal || ri.valor_mensal)}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right font-bold text-teal-600">{fmt((ri.faturamento_mensal || ri.valor_mensal) * ri.quantidade)}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right font-bold text-teal-600">{fmt(((ri.faturamento_mensal || ri.valor_mensal) * ri.quantidade) * (ri.prazo_contrato || 0))}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">
                          <Tooltip content={
                            <div className="w-56 space-y-1">
                              <div className="font-semibold text-amber-300 mb-1">Detalhamento de Impostos</div>
                              {ri.opportunity_kit_id ? (() => {
                                const pImp = (ri.kit_pis || 0) + (ri.kit_cofins || 0) + (ri.kit_csll || 0) + (ri.kit_irpj || 0) + (ri.kit_iss || 0);
                                const vImp = ri.impostos_mensal * ri.quantidade;
                                return (
                                  <>
                                    {pImp > 0 ? (
                                      <>
                                        <div className="flex justify-between"><span>PIS ({fmtPct(ri.kit_pis || 0)}):</span> <span>{fmt(vImp * ((ri.kit_pis||0)/pImp))}</span></div>
                                        <div className="flex justify-between"><span>COFINS ({fmtPct(ri.kit_cofins || 0)}):</span> <span>{fmt(vImp * ((ri.kit_cofins||0)/pImp))}</span></div>
                                        <div className="flex justify-between"><span>CSLL ({fmtPct(ri.kit_csll || 0)}):</span> <span>{fmt(vImp * ((ri.kit_csll||0)/pImp))}</span></div>
                                        <div className="flex justify-between"><span>IRPJ ({fmtPct(ri.kit_irpj || 0)}):</span> <span>{fmt(vImp * ((ri.kit_irpj||0)/pImp))}</span></div>
                                        <div className="flex justify-between"><span>ISS ({fmtPct(ri.kit_iss || 0)}):</span> <span>{fmt(vImp * ((ri.kit_iss||0)/pImp))}</span></div>
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
                                        <div className="flex justify-between"><span>PIS ({fmtPct(rentalDefaults.perc_pis_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_pis_rental||0)/pImp))}</span></div>
                                        <div className="flex justify-between"><span>COFINS ({fmtPct(rentalDefaults.perc_cofins_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_cofins_rental||0)/pImp))}</span></div>
                                        <div className="flex justify-between"><span>CSLL ({fmtPct(rentalDefaults.perc_csll_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_csll_rental||0)/pImp))}</span></div>
                                        <div className="flex justify-between"><span>IRPJ ({fmtPct(rentalDefaults.perc_irpj_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_irpj_rental||0)/pImp))}</span></div>
                                        {isCom && (
                                           <div className="flex justify-between"><span>ISS ({fmtPct(rentalDefaults.perc_iss_rental || 0)}):</span> <span>{fmt(vImp * ((rentalDefaults.perc_iss_rental||0)/pImp))}</span></div>
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
              </table>
            </div>
          )}
        </div>
      </>)}

      {/* Create Kit Modal Overlay */}
      {showCreateKitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-bg-deep rounded-2xl shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
             <div className="p-4 border-b border-border-subtle bg-bg-surface flex justify-between items-center shrink-0">
               <h3 className="font-semibold text-lg text-text-primary flex items-center gap-2">Criar Kit Exclusivo</h3>
               <button onClick={() => setShowCreateKitModal(false)} className="p-1 hover:bg-black/5 rounded transition-colors text-text-muted hover:text-text-primary"><X className="w-5 h-5" /></button>
             </div>
             <div className="flex-1 overflow-y-auto p-6 bg-bg-deep">
                <OpportunityKitForm 
                   isModal={true} 
                   onClose={() => setShowCreateKitModal(false)} 
                   initialSalesBudgetId={id}
                   onSuccess={(savedKit) => {
                     setShowCreateKitModal(false);
                     if (savedKit) handleAddKit(savedKit);
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
              Esta ação irá <b>salvar o orçamento atual</b> e aplicar os valores de <br/><br/>
              • Prazo de contrato<br/>
              • Fator margem<br/>
              • Fator margem manut.<br/><br/>
              em <b>todos os kits lançados</b> neste orçamento, sobrepondo os valores atuais e recalculando tudo automaticamente. Deseja prosseguir?
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

      {/* Product Search Modal — Sale */}
      {showProductSearch && (
        <ProductSearchModal
          products={products}
          onSelect={addProduct}
          onClose={() => setShowProductSearch(false)}
        />
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
      {/* Kit Search Modal */}
      {showKitSearchModal && (
        <OpportunityKitSearchModal
          isOpen={showKitSearchModal}
          onClose={() => setShowKitSearchModal(false)}
          onSelect={handleAddKit}
          salesBudgetId={id}
        />
      )}
      {/* Kit Search Modal */}
      {showKitSearchModal && (
        <OpportunityKitSearchModal
          isOpen={showKitSearchModal}
          onClose={() => setShowKitSearchModal(false)}
          onSelect={handleAddKit}
        />
      )}
      {/* Kit Search Modal */}
      {showKitSearchModal && (
        <OpportunityKitSearchModal
          isOpen={showKitSearchModal}
          onClose={() => setShowKitSearchModal(false)}
          onSelect={handleAddKit}
        />
      )}
      {/* Kit Items Edit Modal */}
      {viewingKitId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
           <div className="bg-bg-deep rounded-2xl shadow-2xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden">
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
                       // Update the existing grid item with the newly saved kit values
                       setRentalItems(prev => prev.map(item => {
                         if (item.opportunity_kit_id === savedKit.id) {
                           return calcRentalItem({ ...item, 
                             product_nome: `Kit: ${savedKit.nome_kit || 'Personalizado'}`,
                             custo_op_mensal_kit: Number(savedKit.summary?.custo_operacional_mensal_kit || 0),
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
                             custo_aquisicao_unit: Number(savedKit.summary?.custo_aquisicao_total || 0),
                             ipi_unit: Number(savedKit.summary?.total_ipi_kit || 0),
                             frete_unit: Number(savedKit.summary?.total_frete_kit || 0),
                             icms_st_unit: Number(savedKit.summary?.total_st_kit || 0),
                             difal_unit: Number(savedKit.summary?.total_difal_kit || 0),
                             taxa_manutencao_anual_item: Number(savedKit.taxa_manutencao_anual || 0),
                             fator_margem: Number(savedKit.fator_margem_locacao || fatorMargemPadrao || 1),
                             prazo_contrato: Number(savedKit.prazo_contrato_meses || prazoContratoMeses),
                             kit_vlt_manut: Number(savedKit.summary?.vlt_manut || 0),
                             kit_valor_mensal: Number(savedKit.summary?.valor_mensal_kit || 0),
                             kit_valor_impostos: Number(savedKit.summary?.valor_impostos || 0),
                             kit_receita_liquida: Number(savedKit.summary?.receita_liquida_mensal_kit || 0),
                             kit_lucro_mensal: Number(savedKit.summary?.lucro_mensal_kit || 0),
                             kit_margem: Number(savedKit.summary?.margem_kit || 0)
                           }, rentalDefaults);
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
    </div>
  );
}

function ProductSearchModal({ products, onSelect, onClose }: { products: any[]; onSelect: (p: any) => void; onClose: () => void }) {
  const [search, setSearch] = useState('');
  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    return !q || p.nome?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q);
  }).slice(0, 20);

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-lg p-5 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-semibold text-text-primary text-lg">Buscar Produto</h3>
        <input
          autoFocus
          type="text"
          placeholder="Buscar por nome ou código..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
        />
        <div className="max-h-60 overflow-y-auto space-y-1">
          {filtered.length === 0 ? (
            <p className="text-text-muted text-center py-4 text-sm">Nenhum produto encontrado.</p>
          ) : (
            filtered.map(p => (
              <button
                key={p.id}
                onClick={() => onSelect(p)}
                className="w-full text-left px-3 py-2 rounded-lg hover:bg-bg-deep transition-colors flex items-center gap-3"
              >
                <span className="font-mono text-xs text-brand-primary">{p.codigo}</span>
                <span className="text-sm text-text-primary">{p.nome}</span>
                <span className="text-xs text-text-muted ml-auto">
                  {p.vlr_referencia_revenda ? `Custo: R$ ${Number(p.vlr_referencia_revenda).toFixed(2)}` : 'Sem custo'}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

