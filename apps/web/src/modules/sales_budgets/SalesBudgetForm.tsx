import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Loader2, Receipt, Plus, Trash2, Calculator, Info } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

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

  // Recalculate items when defaults change
  useEffect(() => {
    setItems(prev => prev.map(item => item.usa_parametros_padrao ? calcItem(item, defaults) : item));
  }, [defaults]);

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

      // Load items and re-fetch cost_composition for each product
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

  // Tooltip state for cost composition and tax breakdown
  const [hoveredCost, setHoveredCost] = useState<number | null>(null);
  const [hoveredTax, setHoveredTax] = useState<number | null>(null);

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

  const margemClass = totals.margem >= 15 ? 'text-emerald-600' : totals.margem >= 5 ? 'text-amber-600' : 'text-rose-600';
  const margemLabel = totals.margem >= 15 ? 'Saudável' : totals.margem >= 5 ? 'Atenção' : 'Crítico';

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
                      <td className="px-1.5 py-2 whitespace-nowrap text-right relative"
                        onMouseEnter={() => setHoveredCost(idx)}
                        onMouseLeave={() => setHoveredCost(null)}
                      >
                        <span className="cursor-help border-b border-dashed border-text-muted">{fmt(item.custo_unit_base)}</span>
                        {hoveredCost === idx && (() => {
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
                            <div className="absolute right-0 top-full mt-1 z-30 bg-surface border border-border-subtle rounded-lg shadow-xl p-3 w-72 text-xs">
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
                                  <span className="text-amber-600">IPI ({ipiPct.toFixed(0)}%):</span>
                                  <span className="text-amber-600">+ {fmt(ipiU)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-amber-600">Frete CIF:</span>
                                  <span className="text-amber-600">+ {fmt(freteU)}</span>
                                </div>
                                {hasSt && (
                                  <>
                                    <div className="border-t border-border-subtle my-1" />
                                    <div className="flex justify-between">
                                      <span className="text-amber-600">ICMS-ST {isBit ? '(BIT)' : '(Normal)'} unit.:</span>
                                      <span className="text-amber-600">+ {fmt(stNormal)}</span>
                                    </div>
                                    {!isBit && credPct > 0 && (
                                      <>
                                        <div className="flex justify-between">
                                          <span className="text-green-600">Créd. Outorgado ({credPct.toFixed(0)}%):</span>
                                          <span className="text-green-600">- {fmt(credVal)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-amber-600">ICMS-ST Final unit.:</span>
                                          <span className="text-amber-600">+ {fmt(stFinal)}</span>
                                        </div>
                                      </>
                                    )}
                                  </>
                                )}
                                <div className="flex justify-between border-t border-border-subtle mt-1.5 pt-1.5 font-bold text-text-primary">
                                  <span>Custo Unit. Final:</span>
                                  <span>{fmt(custoFinal)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
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
                      <td className="px-1.5 py-2 whitespace-nowrap text-right relative"
                        onMouseEnter={() => setHoveredTax(idx)}
                        onMouseLeave={() => setHoveredTax(null)}
                      >
                        <span className="cursor-help border-b border-dashed border-text-muted">{fmt(totalImpostos)}</span>
                        {hoveredTax === idx && (
                          <div className="absolute right-0 top-full mt-1 z-30 bg-surface border border-border-subtle rounded-lg shadow-xl p-3 w-72 text-xs">
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
                              <div className="border-t border-border-subtle mt-2 pt-2">
                                <div className="flex justify-between font-bold text-text-primary">
                                  <span>Total Impostos</span>
                                  <span>{fmt(totalImpostos)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
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



      {/* Product Search Modal */}
      {showProductSearch && (
        <ProductSearchModal
          products={products}
          onSelect={addProduct}
          onClose={() => setShowProductSearch(false)}
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
