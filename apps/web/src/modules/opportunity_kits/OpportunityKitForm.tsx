import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, Calculator, HelpCircle, Plus, Trash2, Info } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Tooltip } from '../../components/ui/Tooltip';
import { api } from '../../services/api';
import { ProductSearchModal } from '../../components/modals/ProductSearchModal';
import { AddOperationalCostModal } from '../../components/modals/AddOperationalCostModal';

interface KitFormValues {
  nome_kit: string;
  descricao_kit: string;
  quantidade_kits: number;
  tipo_contrato: string;
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
    product_id: string;
    descricao_item: string;
    quantidade_no_kit: number;
  }>;
  costs: Array<{
    product_id: string;
    tipo_custo: string;
    quantidade: number;
    valor_unitario: number;
    descricao_item?: string;
  }>;
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

  const [financials, setFinancials] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);
  const [costSearchType, setCostSearchType] = useState<'op' | 'inst' | null>(null);

  const [form, setForm] = useState<KitFormValues>({
    sales_budget_id: sourceBudgetId || undefined,
    nome_kit: '',
    descricao_kit: '',
    quantidade_kits: 1,
    tipo_contrato: initialTipoContrato,
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
    items: [],
    costs: [],
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
      data.costs = data.costs.map((c: any) => ({
        ...c,
        descricao_item: c.product?.nome || c.descricao_item || 'Serviço'
      }));
      setForm(data);
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeCompanyId) {
      const shouldFetchTaxes = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' || !kitId;
      if (shouldFetchTaxes) {
        // Auto-fetch corporate taxes for new kits or when it's VENDA_EQUIPAMENTOS to prefill block
        api.get(`/companies/${activeCompanyId}/sales-parameters`).then(res => {
          const parametros_venda = res.data;
        if (parametros_venda) {
          setForm(prev => ({
            ...prev,
            aliq_pis: parametros_venda.pis || 0,
            aliq_cofins: parametros_venda.cofins || 0,
            aliq_csll: parametros_venda.csll || 0,
            aliq_irpj: parametros_venda.irpj || 0,
            aliq_iss: parametros_venda.iss || 0,
            aliq_icms: parametros_venda.icms_interno || 0,
            ...(form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? {
              fator_margem_locacao: parametros_venda.mkp_padrao || 1,
              fator_margem_servicos_produtos: parametros_venda.mkp_padrao || 1,
              fator_margem_instalacao: parametros_venda.mkp_padrao || 1,
              fator_margem_manutencao: parametros_venda.mkp_padrao || 1,
              perc_despesas_adm: parametros_venda.despesa_administrativa || 0,
            } : {})
          }));
        }
      });
      }
    }
  }, [kitId, form.tipo_contrato, activeCompanyId]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      recalculate(form);
    }, 600);
    return () => clearTimeout(timerRef.current);
  }, [form]);

  const sanitizePayload = (data: KitFormValues) => {
    return {
      ...data,
      nome_kit: data.nome_kit || "PREVIEW_KIT",
      percentual_instalacao: data.percentual_instalacao === '' ? null : data.percentual_instalacao,
      fator_manutencao: data.fator_manutencao === '' ? null : data.fator_manutencao,
      qtd_meses_manutencao: data.qtd_meses_manutencao === '' ? null : data.qtd_meses_manutencao,
    };
  };

  const recalculate = async (data: KitFormValues) => {
    if (data.prazo_contrato_meses <= 0) return;
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

  const handleAddProduct = (product: any) => {
    setForm(prev => {
      // Check if product already exists to simply increment QTY
      const existingIdx = prev.items.findIndex(i => i.product_id === product.id);
      if (existingIdx !== -1) {
        const newItems = [...prev.items];
        newItems[existingIdx].quantidade_no_kit += 1;
        return { ...prev, items: newItems };
      }
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            product_id: product.id,
            descricao_item: product.nome,
            quantidade_no_kit: 1,
            product: { codigo: product.codigo }
          }
        ]
      };
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

  const handleAddCost = (data: { product: any; quantidade: number; tipo_custo: string; valor_unitario: number }) => {
    setForm(prev => ({
      ...prev,
      costs: [
        ...prev.costs,
        {
          product_id: data.product.id,
          tipo_custo: data.tipo_custo,
          quantidade: data.quantidade,
          valor_unitario: data.valor_unitario,
          descricao_item: data.product.nome,
        }
      ]
    }));
  };

  const updateCostQuantity = (costToUpdate: any, qty: number) => {
    setForm(prev => {
      const idx = prev.costs.findIndex(c => c.product_id === costToUpdate.product_id && c.tipo_custo === costToUpdate.tipo_custo);
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
      const idx = prev.costs.findIndex(c => c.product_id === cToRemove.product_id && c.tipo_custo === cToRemove.tipo_custo);
      if (idx > -1) {
        const newCosts = [...prev.costs];
        newCosts.splice(idx, 1);
        return { ...prev, costs: newCosts };
      }
      return prev;
    });
  };

  const onSubmit = async () => {
    try {
      const payload = sanitizePayload(form);
      let savedKit = null;
      if (kitId) {
        const resp = await api.put(`/opportunity-kits/${kitId}`, payload);
        savedKit = resp.data;
      } else {
        const resp = await api.post(`/opportunity-kits/company/${activeCompanyId}`, payload);
        savedKit = resp.data;
      }
      if (isModal && onSuccess) {
        onSuccess(savedKit);
        return;
      }
      if (sourceBudgetId || form.sales_budget_id) {
        navigate(`/cadastros/orcamentos/${sourceBudgetId || form.sales_budget_id}?tab=locacao`);
      } else {
        navigate('/cadastros/kits');
      }
    } catch (error) {
      console.error("Error saving kit", error);
      alert("Erro ao salvar kit. Verifique se o prazo de carência não é maior que o de contrato.");
    }
  };

  const fmtC = (val: number | undefined) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  const showBlock3 = form.tipo_contrato !== 'INSTALACAO' && (form.tipo_contrato !== 'VENDA_EQUIPAMENTOS' || !!form.havera_manutencao);
  const showBlock31 = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' && !form.instalacao_inclusa;
  const opCosts = form.costs.filter(c => c.tipo_custo !== 'INSTALACAO');
  const instCosts = form.costs.filter(c => c.tipo_custo === 'INSTALACAO');

  return (
    <div className={`space-y-6 mx-auto ${isModal ? 'max-w-full pb-8' : 'max-w-[1600px] pb-24'}`}>
      {/* HEADER */}
      {!isModal && (
        <div className="flex items-center gap-4">
          <Button variant="ghost" type="button" onClick={() => {
            if (sourceBudgetId || form.sales_budget_id) navigate(`/cadastros/orcamentos/${sourceBudgetId || form.sales_budget_id}?tab=locacao`);
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
               <span className="bg-primary-50 text-primary-600 border border-primary-200 px-3 py-1 rounded-full text-sm font-semibold">
                 Exclusivo do Orçamento
               </span>
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
          <Button variant="primary" size="lg" onClick={onSubmit}>
            <Save className="w-5 h-5 mr-2" />
            Salvar Kit de Oportunidade
          </Button>
        </div>
      </div>

      {/* STICKY TOP HUD */}
      {(() => {
        const mesesFaturados = financials?.summary?.prazo_mensalidades || 0;
        const faturamentoMensal = (financials?.summary?.valor_mensal_locacao_base || 0) + (financials?.summary?.vlt_manut || 0);
        const impostosMensais = financials?.summary?.valor_impostos || 0;
        const custoAq = financials?.summary?.custo_aquisicao_kit || 0;
        const custoOperacionalMensal = financials?.summary?.custo_operacional_mensal_kit || 0;
        
        const totalFaturamentoContrato = faturamentoMensal * mesesFaturados;
        const custoTotalContrato = custoAq + (custoOperacionalMensal * mesesFaturados);
        const receitaLiquida = faturamentoMensal - impostosMensais;
        const roiMeses = receitaLiquida > 0 ? (custoTotalContrato / receitaLiquida) : 0;

        return (
          <div className="sticky top-0 z-[60] -mt-2 mb-6 bg-bg-surface/95 backdrop-blur-xl border border-border-subtle shadow-md rounded-2xl p-4 xl:p-6 transition-all">
            <div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-3">
              <h3 className="text-sm font-bold text-text-primary tracking-tight flex items-center">
                <Calculator className="w-4 h-4 mr-2 text-brand-primary" /> Cálculo Simultâneo
              </h3>
              {isCalculating ? (
                <span className="flex items-center text-[10px] font-semibold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-full animate-pulse">
                  <Calculator className="w-3 h-3 mr-1 animate-pulse" /> Calculando
                </span>
              ) : (
                <span className="text-[10px] font-medium text-brand-success bg-brand-success/10 border border-brand-success/20 px-2 py-1 rounded-full">Atualizado</span>
              )}
            </div>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              <div className="bg-bg-subtle border border-border-subtle rounded-xl p-4 flex flex-col justify-center">
                <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">Custo de Aquisição</span>
                <div className="text-xl font-bold text-text-primary">{fmtC(custoAq)}</div>
                <div className="text-[10px] text-text-muted mt-1 truncate" title={`Prod: ${fmtC(financials?.summary?.custo_aquisicao_produtos)} | Serv: ${fmtC(financials?.summary?.custo_aquisicao_servicos)}`}>
                  Prod: {fmtC(financials?.summary?.custo_aquisicao_produtos)} | Serv: {fmtC(financials?.summary?.custo_aquisicao_servicos)}
                </div>
              </div>

              <div className="bg-bg-subtle border border-border-subtle rounded-xl p-4 flex flex-col justify-center">
                <span className="block text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">Op & Manutenção (Mês)</span>
                <div className="text-xl font-bold text-brand-warning">{fmtC(custoOperacionalMensal + (financials?.summary?.vlt_manut || 0))}</div>
                <div className="text-[10px] text-text-muted mt-1 truncate" title={`Op: ${fmtC(custoOperacionalMensal)} | Manut: ${fmtC(financials?.summary?.vlt_manut)}`}>
                  Op: {fmtC(custoOperacionalMensal)} | Manut: {fmtC(financials?.summary?.vlt_manut)}
                </div>
              </div>

              <div className="bg-bg-subtle border border-border-subtle rounded-xl p-4 flex flex-col justify-center">
                <span className="block text-[10px] text-brand-danger font-bold uppercase tracking-wider mb-1">Impostos Retidos (Mês)</span>
                <div className="text-xl font-bold text-brand-danger">{fmtC(impostosMensais)}</div>
                <div className="text-[10px] text-brand-danger/70 mt-1 truncate">
                  Alíquota: {(financials?.summary?.aliq_total_impostos || 0).toFixed(2)}%
                </div>
              </div>

              <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-xl p-4 shadow-sm flex flex-col justify-center relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
                <span className="block text-[10px] text-text-primary font-bold uppercase tracking-wider mb-1 relative z-10">Faturamento Mensal</span>
                <div className="text-2xl font-black text-brand-primary tracking-tight relative z-10">{fmtC(faturamentoMensal)}</div>
                <div className="text-[10px] font-medium text-text-muted mt-1 truncate relative z-10" title={`Taxa de Locação: ${(Number(financials?.summary?.tx_locacao || 0) * 100).toFixed(4)}%`}>
                  {mesesFaturados}x | Tx Loc: {(Number(financials?.summary?.tx_locacao || 0) * 100).toFixed(4)}%
                </div>
              </div>
              
              <div className="bg-bg-subtle border border-border-subtle rounded-xl p-4 lg:col-span-4 xl:col-span-1 flex flex-col justify-center space-y-1.5">
                <div className="flex justify-between items-center whitespace-nowrap">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">ROI Previsto:</span>
                  <span className="text-sm font-bold text-brand-secondary">{roiMeses.toFixed(1)}m</span>
                </div>
                <div className="flex justify-between items-center whitespace-nowrap pt-1.5 border-t border-border-subtle">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Custo Total:</span>
                  <span className="text-xs font-bold text-text-primary">{fmtC(custoTotalContrato)}</span>
                </div>
                <div className="flex justify-between items-center whitespace-nowrap">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Rec. Total:</span>
                  <span className="text-xs font-bold text-text-primary">{fmtC(totalFaturamentoContrato)}</span>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* FULL WIDTH LAYOUT */}
      <div className="w-full">
        
        {/* FORM SECTIONS */}
        <div className="w-full space-y-8">
          
          <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
            <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-border-subtle">
              1. Informações Gerais
            </h2>
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
                <Input type="number" step="0.01" value={form.fator_margem_locacao} onChange={(e) => handleInputChange('fator_margem_locacao', parseFloat(e.target.value) || 0)} className="w-full" />
              </div>
              
              {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1 truncate" title="Fator Margem p/ Serviços e Licenças inseridos no Bloco 4.">Fator Margem Serviços (Produtos)</label>
                    <Input type="number" step="0.01" value={form.fator_margem_servicos_produtos} onChange={(e) => handleInputChange('fator_margem_servicos_produtos', parseFloat(e.target.value) || 0)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fator Margem Instalação</label>
                    <Input type="number" step="0.01" value={form.fator_margem_instalacao} onChange={(e) => handleInputChange('fator_margem_instalacao', parseFloat(e.target.value) || 0)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Fator Margem Manutenção</label>
                    <Input type="number" step="0.01" value={form.fator_margem_manutencao} onChange={(e) => handleInputChange('fator_margem_manutencao', parseFloat(e.target.value) || 0)} className="w-full" />
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
                      <div className="pl-8 pt-4 border-t border-border-subtle/50 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium mb-1">Taxa Manutenção a.a (%)</label>
                          <Input type="number" step="0.01" value={form.taxa_manutencao_anual} onChange={(e) => handleInputChange('taxa_manutencao_anual', parseFloat(e.target.value) || 0)} className="w-full" placeholder="Ex: 20.00" />
                          <p className="text-[10px] text-text-muted mt-1">% s/ custo total anual.</p>
                        </div>
                        {!form.instalacao_inclusa && (
                          <div>
                            <label className="block text-sm font-medium mb-1">Fator Manutenção</label>
                            <Input type="number" step="0.01" value={form.fator_manutencao} onChange={(e) => handleInputChange('fator_manutencao', e.target.value === '' ? '' : parseFloat(e.target.value))} className="w-full" placeholder="Ex: 1.70" />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </section>

           <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
             <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-border-subtle">
              3. Impostos sobre Faturamento (%)
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
             <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle">
                <h2 className="text-xl font-semibold">4. Itens do kit (produtos + serviços)</h2>
                {form.items.length > 0 && (
                  <Button variant="outline" size="sm" onClick={() => setShowProductSearch(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Produto
                  </Button>
                )}
             </div>

            {form.items.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center border-2 border-dashed border-border-subtle rounded-xl bg-bg-deep/50 hover:bg-bg-deep/80 transition-colors">
                <Button variant="outline" type="button" onClick={() => setShowProductSearch(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Buscar Lupa de Produtos
                </Button>
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
                           <th className="px-1.5 py-3 text-right">DIFAL (Un.)</th>
                           <th className="px-1.5 py-3 text-right">Custo Un. Base</th>
                           <th className="px-1.5 py-3 text-right">Custo Total</th>
                         </>
                       )}
                       <th className="px-1.5 py-3 w-10"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border-subtle bg-bg-surface">
                     {form.items.map((item, idx) => {
                       // Find cost generated by backend /preview matching product_id
                       const summary = financials?.item_summaries?.find((s: any) => s.product_id === item.product_id);
                       
                       return (
                         <tr key={idx} className="hover:bg-bg-deep/20 transition-colors group">
                           <td className="px-1.5 py-3 font-medium text-text-primary max-w-[200px] truncate" title={item.descricao_item}>
                             <div className="flex flex-col truncate">
                               <span className="truncate">{item.descricao_item}</span>
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
                                 <Tooltip content={
                                   <div className="w-64">
                                     <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                                       <Info className="w-3.5 h-3.5 text-brand-primary" />
                                       Detalhamento de Custo
                                     </div>
                                     <div className="space-y-1.5 font-mono text-text-muted">
                                       <div className="flex justify-between"><span>Base:</span><span>{fmtC(summary?.base_fornecedor || 0)}</span></div>
                                       {(summary?.ipi_unit || 0) > 0 && <div className="flex justify-between"><span>IPI:</span><span>+ {fmtC(summary?.ipi_unit)}</span></div>}
                                       {(summary?.frete_cif_unit || 0) > 0 && <div className="flex justify-between"><span>Frete CIF:</span><span>+ {fmtC(summary?.frete_cif_unit)}</span></div>}
                                       {(summary?.icms_st_unitario || 0) > 0 && <div className="flex justify-between"><span>ICMS-ST:</span><span>+ {fmtC(summary?.icms_st_unitario)}</span></div>}
                                       <div className="border-t border-white/20 mt-1.5 pt-1.5 flex justify-between font-bold text-text-primary">
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
                                 <Tooltip content={
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
                                       <div className="border-t border-white/20 mt-2 pt-2 flex justify-between font-bold text-text-primary">
                                         <span>Total Impostos</span><span>{fmtC(summary?.imposto_venda_item || 0)}</span>
                                       </div>
                                     </div>
                                   </div>
                                 }>
                                   <span className="cursor-help border-b border-dashed border-text-muted">{fmtC(summary?.imposto_venda_item)}</span>
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
                                 {fmtC(summary?.difal_unitario || 0)}
                               </td>
                               <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                 {fmtC(summary?.custo_base_unitario_item)}
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
                           <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.icms_st_total || 0), 0) || 0)}</td>
                           <td className="px-4 py-3"></td>
                           <td className="px-4 py-3"></td>
                           <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.frete_venda_item || 0), 0) || 0)}</td>
                           <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.imposto_venda_item || 0), 0) || 0)}</td>
                           <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.desp_adm_item || 0), 0) || 0)}</td>
                           <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.comissao_item || 0), 0) || 0)}</td>
                           <td className="px-4 py-3"></td>
                           <td className="px-4 py-3"></td>
                           <td className="px-4 py-3 text-right tabular-nums text-text-primary font-bold">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.venda_total_item || 0), 0) || 0)}</td>
                           <td className="px-4 py-3 text-right tabular-nums text-brand-success font-bold">{fmtC(financials?.item_summaries?.reduce((a: any, b: any) => a + (b.lucro_total_item || 0), 0) || 0)}</td>
                         </>
                       ) : (
                         <>
                           <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.summary?.total_difal_kit || 0)}</td>
                           <td className="px-4 py-3"></td>
                           <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.summary?.custo_aquisicao_kit || 0)}</td>
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
               onSelect={handleAddProduct} 
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
                         const summary = financials?.cost_summaries?.find((cs: any) => cs.product_id === c.product_id && cs.tipo_custo === c.tipo_custo);
                         const vendaUnit = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? c.valor_unitario * (form.fator_margem_instalacao || 1) : c.valor_unitario;
                         const totalItem = vendaUnit * c.quantidade;
                         return (
                           <tr key={`inst-${idx}`} className="hover:bg-bg-deep/20 transition-colors group">
                             <td className="px-4 py-3 font-medium text-text-primary">{c.descricao_item || 'Serviço'}</td>
                             <td className="px-4 py-3 text-text-secondary">{c.tipo_custo === 'INSTALACAO' ? 'Instalação' : c.tipo_custo}</td>
                             {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                               <>
                                 <td className="px-4 py-3 text-right tabular-nums text-text-secondary">{fmtC(summary?.custo_base_unitario_item || c.valor_unitario)}</td>
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
                                 <td className="px-4 py-3 text-right tabular-nums">{fmtC(c.valor_unitario)}</td>
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
                               {fmtC(instCosts.reduce((acc, c) => acc + (c.valor_unitario * c.quantidade), 0))}
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

           {showBlock3 && (
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
                         const summary = financials?.cost_summaries?.find((cs: any) => cs.product_id === c.product_id && cs.tipo_custo === c.tipo_custo);
                         const vendaUnit = form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? c.valor_unitario * (form.fator_margem_manutencao || 1) : c.valor_unitario;
                         const totalItem = vendaUnit * c.quantidade;
                         return (
                           <tr key={`op-${idx}`} className="hover:bg-bg-deep/20 transition-colors group">
                             <td className="px-4 py-3 font-medium text-text-primary">{c.descricao_item || 'Serviço'}</td>
                             <td className="px-4 py-3 text-text-secondary">{c.tipo_custo}</td>
                             {form.tipo_contrato === 'VENDA_EQUIPAMENTOS' ? (
                               <>
                                 <td className="px-1.5 py-3 text-right tabular-nums text-text-secondary">
                                   <Tooltip content={
                                     <div className="w-64 text-left">
                                       <div className="font-bold text-text-primary text-sm mb-2 flex items-center gap-1.5">
                                         <Info className="w-3.5 h-3.5 text-brand-primary" />
                                         Detalhamento de Custo
                                       </div>
                                       <div className="space-y-1.5 font-mono text-text-muted">
                                         <div className="flex justify-between"><span>Base:</span><span>{fmtC(summary?.base_fornecedor || c.valor_unitario)}</span></div>
                                       {(summary?.ipi_unit || 0) > 0 && <div className="flex justify-between"><span>IPI:</span><span>+ {fmtC(summary?.ipi_unit)}</span></div>}
                                       {(summary?.frete_cif_unit || 0) > 0 && <div className="flex justify-between"><span>Frete CIF:</span><span>+ {fmtC(summary?.frete_cif_unit)}</span></div>}
                                       {(summary?.icms_st_unitario || 0) > 0 && <div className="flex justify-between"><span>ICMS-ST:</span><span>+ {fmtC(summary?.icms_st_unitario)}</span></div>}                                         <div className="border-t border-white/20 mt-1.5 pt-1.5 flex justify-between font-bold text-text-primary">
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
                                   <Tooltip content={
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
                                         <div className="border-t border-white/20 mt-2 pt-2 flex justify-between font-bold text-text-primary">
                                           <span>Total Impostos</span><span>{fmtC(summary?.imposto_venda_item || 0)}</span>
                                         </div>
                                       </div>
                                     </div>
                                   }>
                                     <span className="cursor-help border-b border-dashed border-text-muted">{fmtC(summary?.imposto_venda_item || 0)}</span>
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
                                 <td className="px-4 py-3 text-right tabular-nums">{fmtC(c.valor_unitario)}</td>
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
                               {fmtC(opCosts.reduce((acc, c) => acc + (c.valor_unitario * c.quantidade), 0))}
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

           

           <AddOperationalCostModal 
              isOpen={costSearchType !== null} 
              onClose={() => setCostSearchType(null)} 
              onConfirm={handleAddCost} 
              defaultType={costSearchType === 'inst' ? 'INSTALACAO' : 'MANUTENCAO'}
           />
        </div>

        </div>
      </div>
  );
};
