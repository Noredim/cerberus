import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Loader2, Receipt, Plus, Trash2, Calculator, Info, Package, Eye, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Tooltip } from '../../components/ui/Tooltip';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { AddRentalItemModal } from './AddRentalItemModal';
import { OpportunityKitSearchModal } from '../../components/modals/OpportunityKitSearchModal';

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
}

function calcRentalItem(item: RentalBudgetItem, rd: any): RentalBudgetItem {
  const base = Number(item.custo_aquisicao_unit || 0);
  const ipi = Number(item.ipi_unit || 0);
  const frete = Number(item.frete_unit || 0);
  const st = Number(item.icms_st_unit || 0);
  const difal = Number(item.difal_unit || 0);
  
  // Instalação (Exclusiva: valor item > perc item > perc global)
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
  const totalJuros = +(baseFinanceiraLocacao * taxa * prazo).toFixed(4);
  
  let parcela = 0;
  if (prazo > 0) {
      parcela = +((baseFinanceiraLocacao + totalJuros) / prazo).toFixed(4);
  }

  let custoManut = 0;
  if (item.opportunity_kit_id && item.custo_op_mensal_kit != null) {
      const baseOpMensal = Number(item.custo_op_mensal_kit || 0) * Number(item.quantidade || 1);
      const taxaManut = item.usa_taxa_manut_padrao ? Number(rd.taxa_manutencao_anual || 0) : Number(item.taxa_manutencao_anual_item || 0);
      custoManut = +(baseFinanceiraLocacao * taxaManut / 100 / 12).toFixed(4) + baseOpMensal;
  } else {
      const taxaManut = item.usa_taxa_manut_padrao ? Number(rd.taxa_manutencao_anual || 5) : Number(item.taxa_manutencao_anual_item || 5);
      custoManut = +(baseFinanceiraLocacao * taxaManut / 100 / 12).toFixed(4);
  }
  
  const custoMensal = custoManut; // Depreciação contábil removida deste fluxo de caixa
  const valorMensal = parcela + custoManut;

  let pImp = 0;
  if (item.opportunity_kit_id && item.kit_pis != null) {
      pImp = Number(item.kit_pis || 0) + Number(item.kit_cofins || 0) + Number(item.kit_csll || 0) + Number(item.kit_irpj || 0);
      if (rd.tipo_receita_rental === 'COMODATO') {
          pImp += Number(item.kit_iss || 0);
      }
  } else {
      pImp = Number(rd.perc_pis_rental || 0) + Number(rd.perc_cofins_rental || 0) + Number(rd.perc_csll_rental || 0) + Number(rd.perc_irpj_rental || 0);
      if (rd.tipo_receita_rental === 'COMODATO') {
          pImp += Number(rd.perc_iss_rental || 0);
      }
  }
  
  const impostos = +(valorMensal * pImp / 100).toFixed(4);
  const recLiq = valorMensal - impostos;
  const pCom = Number(rd.perc_comissao_rental || 0);
  const comissao = +(recLiq * pCom / 100).toFixed(4);
  
  let lucro = 0;
  if (item.opportunity_kit_id && item.is_kit_instalacao) {
      lucro = +(recLiq - custoAquisicao - custoMensal).toFixed(4);
  } else {
      lucro = +(recLiq - custoMensal - comissao).toFixed(4);
  }
  
  const margem = valorMensal > 0 ? +(lucro / valorMensal * 100).toFixed(2) : 0;
  
  return { 
      ...item, 
      instalacao_unit: instalacao, 
      custo_total_aquisicao: custoTotal, 
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
      margem 
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
  const [activeTab, setActiveTab] = useState<'venda' | 'locacao'>('venda');

  // Rental defaults
  const [tipoReceitaRental, setTipoReceitaRental] = useState('LOCACAO_PURA');
  const [prazoContratoMeses, setPrazoContratoMeses] = useState(36);
  const [prazoInstalacaoMeses, setPrazoInstalacaoMeses] = useState(1);
  const [taxaJurosMensal, setTaxaJurosMensal] = useState(0);
  const [taxaManutencaoAnual, setTaxaManutencaoAnual] = useState(5);
  const [fatorMargemPadrao, setFatorMargemPadrao] = useState(1);
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
    perc_instalacao_padrao: percInstalacaoPadrao,
    perc_comissao_rental: percComissaoRental,
    perc_pis_rental: percPisRental,
    perc_cofins_rental: percCofinsRental,
    perc_csll_rental: percCsllRental,
    perc_irpj_rental: percIrpjRental,
    perc_iss_rental: percIssRental,
  }), [tipoReceitaRental, prazoContratoMeses, prazoInstalacaoMeses, taxaJurosMensal, taxaManutencaoAnual, fatorMargemPadrao, percInstalacaoPadrao, percComissaoRental, percPisRental, percCofinsRental, percCsllRental, percIrpjRental, percIssRental]);

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
          }
          return item;
        })
      );
      setRentalItems(enrichedRental);
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
    const t = { investimento: 0, faturamentoMensal: 0, impostosMensal: 0, receitaLiqMensal: 0, custoMensal: 0, lucroMensal: 0 };
    rentalItems.forEach(i => {
      const q = i.quantidade;
      t.investimento += i.custo_total_aquisicao * q;
      t.faturamentoMensal += i.valor_mensal * q;
      t.impostosMensal += i.impostos_mensal * q;
      t.receitaLiqMensal += i.receita_liquida_mensal * q;
      t.custoMensal += i.custo_total_mensal * q;
      t.lucroMensal += i.lucro_mensal * q;
    });
    return { ...t, margem: t.faturamentoMensal > 0 ? (t.lucroMensal / t.faturamentoMensal * 100) : 0 };
  }, [rentalItems]);

  const margemClass = totals.margem >= 15 ? 'text-emerald-600' : totals.margem >= 5 ? 'text-amber-600' : 'text-rose-600';
  const margemLabel = totals.margem >= 15 ? 'Saudável' : totals.margem >= 5 ? 'Atenção' : 'Crítico';
  const rentalMargemClass = rentalTotals.margem >= 15 ? 'text-emerald-600' : rentalTotals.margem >= 5 ? 'text-amber-600' : 'text-rose-600';

  const handleSave = async () => {
    if (!titulo || !customerId) return alert('Preencha título e cliente.');
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
        rental_items: rentalItems.map(i => ({
          product_id: i.product_id || null,
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
      } else {
        const res = await api.post('/sales-budgets', payload);
        navigate(`/orcamentos-vendas/${res.data.id}`, { replace: true });
      }
    } catch (err: any) {
      console.error('Save error:', err.response?.data || err);
      const detail = err.response?.data?.detail;
      const msg = Array.isArray(detail) ? detail.map((d: any) => d.msg).join(', ') : (typeof detail === 'string' ? detail : err.message);
      alert('Erro ao salvar: ' + msg);
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
            <Button type="button" onClick={handleSave} disabled={saving}>
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
        <button onClick={() => setActiveTab('venda')} className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'venda' ? 'text-brand-primary border-b-2 border-brand-primary' : 'text-text-muted hover:text-text-primary'}`}>Venda</button>
        <button onClick={() => setActiveTab('locacao')} className={`px-6 py-3 text-sm font-semibold transition-colors ${activeTab === 'locacao' ? 'text-teal-600 border-b-2 border-teal-500' : 'text-text-muted hover:text-text-primary'}`}>Locação / Comodato</button>
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
          <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-text-primary text-lg">Consolidação — Locação</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-bg-deep rounded-lg p-3"><span className="text-xs text-text-muted">Investimento Total</span><p className="text-lg font-bold text-text-primary">{fmt(rentalTotals.investimento)}</p></div>
              <div className="bg-bg-deep rounded-lg p-3"><span className="text-xs text-text-muted">Faturamento Mensal</span><p className="text-lg font-bold text-text-primary">{fmt(rentalTotals.faturamentoMensal)}</p></div>
              <div className="bg-bg-deep rounded-lg p-3"><span className="text-xs text-text-muted">Impostos Mensais</span><p className="text-lg font-bold text-text-primary">{fmt(rentalTotals.impostosMensal)}</p></div>
              <div className="bg-bg-deep rounded-lg p-3"><span className="text-xs text-text-muted">Receita Líq. Mensal</span><p className="text-lg font-bold text-text-primary">{fmt(rentalTotals.receitaLiqMensal)}</p></div>
              <div className="bg-bg-deep rounded-lg p-3"><span className="text-xs text-text-muted">Custo Mensal</span><p className="text-lg font-bold text-text-primary">{fmt(rentalTotals.custoMensal)}</p></div>
              <div className="bg-bg-deep rounded-lg p-3"><span className="text-xs text-text-muted">Lucro Mensal</span><p className={`text-lg font-bold ${rentalMargemClass}`}>{fmt(rentalTotals.lucroMensal)}</p></div>
              <div className="bg-bg-deep rounded-lg p-3"><span className="text-xs text-text-muted">Margem Líquida</span><p className={`text-lg font-bold ${rentalMargemClass}`}>{fmtPct(rentalTotals.margem)}</p></div>
            </div>
          </div>
        )}

        {/* Rental Parameters */}
        <div className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-text-primary text-lg flex items-center gap-2"><Calculator className="w-5 h-5 text-teal-500" />Parâmetros de Locação</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { label: 'Prazo Contrato (meses)', val: prazoContratoMeses, set: setPrazoContratoMeses, step: '1' },
              { label: 'Prazo Instalação (meses)', val: prazoInstalacaoMeses, set: setPrazoInstalacaoMeses, step: '1' },
              { label: 'Taxa Juros Mensal %', val: taxaJurosMensal, set: setTaxaJurosMensal, step: '0.0001' },
              { label: 'Manutenção Anual %', val: taxaManutencaoAnual, set: setTaxaManutencaoAnual },
              { label: 'Fator Margem Padrão', val: fatorMargemPadrao, set: setFatorMargemPadrao, step: '0.01' },
              { label: '% Instalação Padrão', val: percInstalacaoPadrao, set: setPercInstalacaoPadrao },
              { label: 'Comissão %', val: percComissaoRental, set: setPercComissaoRental },
              { label: 'PIS %', val: percPisRental, set: setPercPisRental },
              { label: 'COFINS %', val: percCofinsRental, set: setPercCofinsRental },
              { label: 'CSLL %', val: percCsllRental, set: setPercCsllRental },
              { label: 'IRPJ %', val: percIrpjRental, set: setPercIrpjRental },
              { label: 'ISS %', val: percIssRental, set: setPercIssRental },
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
                    <th className="px-1.5 py-2 text-center font-semibold text-text-muted uppercase tracking-wider w-14">Prazo</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Manut./mês</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Custo/mês</th>
                    <th className="px-1.5 py-2 text-center font-semibold text-text-muted uppercase tracking-wider w-14">F.Margem</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Parcela</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Vlr Mensal</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Impostos</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Lucro/mês</th>
                    <th className="px-1.5 py-2 text-right font-semibold text-text-muted uppercase tracking-wider">Margem</th>
                    <th className="px-1.5 py-2 text-center font-semibold text-text-muted uppercase tracking-wider w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {rentalItems.map((ri, idx) => {
                    const mc = ri.margem >= 15 ? 'text-emerald-600' : ri.margem >= 5 ? 'text-amber-600' : 'text-rose-600';
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
                          <Tooltip content={
                            ri.opportunity_kit_id ? (
                              <div className="space-y-1 w-52">
                                <div className="font-semibold text-amber-300 mb-2">Composição de Custos</div>
                                <div className="flex justify-between"><span>Produtos (Total):</span><span className="text-text-primary">{fmt(ri.kit_custo_produtos || 0)}</span></div>
                                <div className="flex justify-between"><span>Serviços (Total):</span><span className="text-text-primary">{fmt(ri.kit_custo_servicos || 0)}</span></div>
                                <div className="border-t border-white/20 pt-1 mt-1 flex justify-between font-bold"><span>Total Custo Aquis.:</span><span>{fmt(ri.custo_total_aquisicao)}</span></div>
                              </div>
                            ) : (
                              <div className="space-y-1 w-52">
                                <div className="font-semibold text-amber-300 mb-2">Composição do Custo</div>
                                <div className="flex justify-between"><span>Base:</span><span>{fmt(ri.custo_aquisicao_unit)}</span></div>
                                {ri.ipi_unit > 0 && <div className="flex justify-between"><span>IPI:</span><span className="text-amber-300">+ {fmt(ri.ipi_unit)}</span></div>}
                                {ri.frete_unit > 0 && <div className="flex justify-between"><span>Frete:</span><span className="text-amber-300">+ {fmt(ri.frete_unit)}</span></div>}
                                {ri.icms_st_unit > 0 && <div className="flex justify-between"><span>ICMS-ST:</span><span className="text-amber-300">+ {fmt(ri.icms_st_unit)}</span></div>}
                                {ri.difal_unit > 0 && <div className="flex justify-between"><span>DIFAL:</span><span className="text-amber-300">+ {fmt(ri.difal_unit)}</span></div>}
                                {ri.instalacao_unit > 0 && <div className="flex justify-between"><span>Instalação:</span><span className="text-amber-300">+ {fmt(ri.instalacao_unit)}</span></div>}
                                <div className="border-t border-white/20 pt-1 mt-1 flex justify-between font-bold"><span>Total:</span><span>{fmt(ri.custo_total_aquisicao)}</span></div>
                              </div>
                            )
                          }>
                            <span className="border-b border-dashed border-text-muted">{fmt(ri.custo_total_aquisicao)}</span>
                          </Tooltip>
                        </td>
                        <td className="px-1.5 py-2 text-center">
                          <input type="number" min="1" value={ri.prazo_contrato} onChange={e => updateRentalItem(idx, 'prazo_contrato', +e.target.value)} disabled={isReadonly}
                            className="w-12 px-1 py-0.5 border border-border-subtle rounded bg-bg-deep text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:opacity-60" />
                        </td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">{fmt(ri.custo_manut_mensal)}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right font-medium">{fmt(ri.custo_total_mensal)}</td>
                        <td className="px-1.5 py-2 text-center">
                          <input type="number" step="0.01" min="1" value={ri.fator_margem} onChange={e => updateRentalItem(idx, 'fator_margem', +e.target.value)} disabled={isReadonly}
                            className="w-14 px-1 py-0.5 border border-border-subtle rounded bg-bg-deep text-[11px] text-center focus:outline-none focus:ring-1 focus:ring-teal-500/40 disabled:opacity-60" />
                        </td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">{fmt(ri.parcela_locacao)}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right font-bold text-teal-600">{fmt(ri.valor_mensal)}</td>
                        <td className="px-1.5 py-2 whitespace-nowrap text-right text-text-muted">{fmt(ri.impostos_mensal)}</td>
                        <td className={`px-1.5 py-2 whitespace-nowrap text-right font-semibold ${mc}`}>{fmt(ri.lucro_mensal)}</td>
                        <td className={`px-1.5 py-2 whitespace-nowrap text-right font-bold ${mc}`}>{fmtPct(ri.margem)}</td>
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
      {/* Kit Items View Modal */}
      {viewingKitId && (
        <OpportunityKitItemsModal
          kitId={viewingKitId}
          onClose={() => setViewingKitId(null)}
        />
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

function OpportunityKitItemsModal({ kitId, onClose }: { kitId: string; onClose: () => void }) {
  const [kit, setKit] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/opportunity-kits/${kitId}`)
      .then(res => setKit(res.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, [kitId]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden ring-1 ring-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-deep">
          <div>
            <h3 className="font-semibold text-text-primary text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-primary" />
              Itens do Kit
            </h3>
            {kit && <p className="text-xs text-text-muted mt-0.5">{kit.nome_kit}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-5 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : !kit || !kit.items || kit.items.length === 0 ? (
            <p className="text-center py-8 text-text-muted text-sm">Este kit não possui itens ou não foi encontrado.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4 bg-bg-deep p-4 rounded-xl border border-border-subtle">
                <div>
                  <div className="text-xs text-text-muted">Modalidade</div>
                  <div className="font-medium text-text-primary">{kit.tipo_contrato === 'COM_EQUIPAMENTO' ? 'Com Eq.' : 'Instalação'}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Custo Kit</div>
                  <div className="font-medium text-text-primary">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kit.summary?.custo_aquisicao_total || 0)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Prazo (Meses)</div>
                  <div className="font-medium text-text-primary">{kit.prazo_contrato_meses}</div>
                </div>
                <div>
                  <div className="text-xs text-text-muted">Fator Margem</div>
                  <div className="font-medium text-text-primary">{kit.fator_margem_locacao}</div>
                </div>
              </div>

              <div className="border border-border-subtle rounded-lg overflow-hidden">
                <table className="w-full text-left border-collapse text-[11px]">
                  <thead className="bg-[#f8f9fa] dark:bg-bg-deep font-bold text-text-muted uppercase tracking-wider border-b border-border-subtle">
                    <tr>
                      <th className="px-3 py-2">Descrição do Item</th>
                      <th className="px-3 py-2 text-center w-20">Qtd. Un.</th>
                      <th className="px-3 py-2 text-right w-28">Custo Unitário</th>
                      <th className="px-3 py-2 text-right w-28">Custo Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle bg-surface">
                    {kit.items.map((item: any, idx: number) => {
                      // Total per kit item (unit_cost * quantity_in_kit)
                      const itemTotal = (item.product?.vlr_referencia_uso_consumo || 0) * (item.quantidade_no_kit || 1);
                      return (
                        <tr key={idx} className="hover:bg-bg-deep/50 transition-colors">
                          <td className="px-3 py-2">
                            <div className="font-medium text-text-primary">{item.descricao_item || item.product?.nome}</div>
                            {item.product?.codigo && (
                              <div className="text-[10px] text-brand-primary font-mono mt-0.5">{item.product.codigo}</div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center font-medium text-text-muted">
                            {item.quantidade_no_kit}
                          </td>
                          <td className="px-3 py-2 text-right text-text-muted">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.product?.vlr_referencia_uso_consumo || 0)}
                          </td>
                          <td className="px-3 py-2 text-right font-medium text-text-primary">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(itemTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
