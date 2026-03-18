import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, Save, Calculator, HelpCircle, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { api } from '../../services/api';
import { ProductSearchModal } from '../../components/modals/ProductSearchModal';

interface KitFormValues {
  nome_kit: string;
  descricao_kit: string;
  quantidade_kits: number;
  tipo_contrato: string;
  prazo_contrato_meses: number;
  prazo_instalacao_meses: number;
  fator_margem_locacao: number;
  taxa_juros_mensal: number;
  taxa_manutencao_anual: number;
  aliq_pis: number;
  aliq_cofins: number;
  aliq_csll: number;
  aliq_irpj: number;
  aliq_iss: number;
  custo_manut_mensal_kit: number;
  custo_suporte_mensal_kit: number;
  custo_seguro_mensal_kit: number;
  custo_logistica_mensal_kit: number;
  custo_software_mensal_kit: number;
  custo_itens_acessorios_mensal_kit: number;
  items: Array<{
    product_id: string;
    descricao_item: string;
    quantidade_no_kit: number;
  }>;
}

export const OpportunityKitForm = () => {
  const { kitId } = useParams();
  const { activeCompanyId } = useAuth();
  const navigate = useNavigate();
  const [financials, setFinancials] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [form, setForm] = useState<KitFormValues>({
    nome_kit: '',
    descricao_kit: '',
    quantidade_kits: 1,
    tipo_contrato: 'LOCACAO',
    prazo_contrato_meses: 36,
    prazo_instalacao_meses: 0,
    fator_margem_locacao: 1.0,
    taxa_juros_mensal: 0,
    taxa_manutencao_anual: 0,
    aliq_pis: 0,
    aliq_cofins: 0,
    aliq_csll: 0,
    aliq_irpj: 0,
    aliq_iss: 0,
    custo_manut_mensal_kit: 0,
    custo_suporte_mensal_kit: 0,
    custo_seguro_mensal_kit: 0,
    custo_logistica_mensal_kit: 0,
    custo_software_mensal_kit: 0,
    custo_itens_acessorios_mensal_kit: 0,
    items: [],
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
      setForm(data);
    } catch(err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      recalculate(form);
    }, 600);
    return () => clearTimeout(timerRef.current);
  }, [form]);

  const recalculate = async (data: KitFormValues) => {
    if (!data.nome_kit || data.prazo_contrato_meses <= 0) return;
    setIsCalculating(true);
    try {
      const resp = await api.post(`/opportunity-kits/preview`, data);
      setFinancials(resp.data);
    } catch (err) {
      console.error("Erro no recálculo de preview", err);
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

  const onSubmit = async () => {
    try {
      if (kitId) {
        await api.put(`/opportunity-kits/${kitId}`, form);
      } else {
        await api.post(`/opportunity-kits/company/${activeCompanyId}`, form);
      }
      navigate('/cadastros/kits');
    } catch (error) {
      console.error("Error saving kit", error);
      alert("Erro ao salvar kit. Verifique se o prazo de carência não é maior que o de contrato.");
    }
  };

  const fmtC = (val: number | undefined) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-24">
      {/* HEADER */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" type="button" onClick={() => navigate('/cadastros/kits')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar para Lista
        </Button>
      </div>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
           <h1 className="text-3xl font-bold text-text-primary tracking-tight">
            {kitId ? 'Editar Kit de Oportunidade' : 'Novo Kit de Oportunidade'}
          </h1>
          <p className="text-text-muted mt-2 text-lg">
            Configure os parâmetros de locação, agrupe produtos e calcule tarifas.
          </p>
        </div>
        <Button variant="primary" size="lg" onClick={onSubmit}>
          <Save className="w-5 h-5 mr-2" />
          Salvar Kit de Oportunidade
        </Button>
      </div>

      {/* SIDESPLIT LAYOUT */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        
        {/* LEFT SIDE: FORM SECTIONS */}
        <div className="xl:col-span-8 space-y-8">
          
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-1">Prazo Contrato (Meses)</label>
                <Input type="number" value={form.prazo_contrato_meses} onChange={(e) => handleInputChange('prazo_contrato_meses', parseFloat(e.target.value) || 0)} className="w-full text-lg font-medium" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Carência/Instalação (Meses)</label>
                <Input type="number" value={form.prazo_instalacao_meses} onChange={(e) => handleInputChange('prazo_instalacao_meses', parseFloat(e.target.value) || 0)} className="w-full" />
                <p className="text-xs text-text-muted mt-1">Meses sem locação.</p>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Fator Margem</label>
                <Input type="number" step="0.01" value={form.fator_margem_locacao} onChange={(e) => handleInputChange('fator_margem_locacao', parseFloat(e.target.value) || 0)} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Taxa Juros a.m (%)</label>
                <Input type="number" step="0.01" value={form.taxa_juros_mensal} onChange={(e) => handleInputChange('taxa_juros_mensal', parseFloat(e.target.value) || 0)} className="w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Taxa Manutanção a.a (%)</label>
                <Input type="number" step="0.01" value={form.taxa_manutencao_anual} onChange={(e) => handleInputChange('taxa_manutencao_anual', parseFloat(e.target.value) || 0)} className="w-full" />
                <p className="text-xs text-text-muted mt-1">% s/ custo aq. anual.</p>
              </div>
            </div>
          </section>

           {form.tipo_contrato !== 'INSTALACAO' && (
             <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
               <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-border-subtle">
                3. Custos Operacionais Mensais (R$)
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {[
                  {k: 'custo_manut_mensal_kit', l: 'Manutenção Mensal'},
                  {k: 'custo_suporte_mensal_kit', l: 'Suporte SLA'},
                  {k: 'custo_seguro_mensal_kit', l: 'Seguro Apólice'},
                  {k: 'custo_logistica_mensal_kit', l: 'Logística/Veículo'},
                  {k: 'custo_software_mensal_kit', l: 'Loc. Software'},
                  {k: 'custo_itens_acessorios_mensal_kit', l: 'Outros Consumíveis'},
                ].map(f => (
                  <div key={f.k}>
                    <label className="block text-xs font-medium text-text-secondary mb-1">{f.l}</label>
                    <Input type="number" step="0.01" value={(form as any)[f.k]} onChange={(e) => handleInputChange(f.k as any, parseFloat(e.target.value) || 0)} className="w-full bg-bg-deep/50" />
                  </div>
                ))}
              </div>
            </section>
           )}

           <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
             <h2 className="text-xl font-semibold mb-6 pb-4 border-b border-border-subtle">
              4. Impostos sobre Faturamento (%)
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
              {['aliq_pis', 'aliq_cofins', 'aliq_csll', 'aliq_irpj', 'aliq_iss'].map(f => (
                <div key={f}>
                  <label className="block text-xs font-medium text-text-secondary mb-1 uppercase">{f.split('_')[1]}</label>
                  <Input type="number" step="0.01" value={(form as any)[f]} onChange={(e) => handleInputChange(f as any, parseFloat(e.target.value) || 0)} className="w-full" />
                </div>
              ))}
            </div>
          </section>

          <section className="bg-bg-surface border border-border-subtle rounded-2xl p-8 shadow-sm">
             <div className="flex items-center justify-between mb-6 pb-4 border-b border-border-subtle">
                <h2 className="text-xl font-semibold">5. Itens do kit (produtos + serviços)</h2>
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
                       <th className="px-4 py-3 w-32">Quantidade</th>
                       <th className="px-4 py-3 text-right">DIFAL (Un.)</th>
                       <th className="px-4 py-3 text-right">Custo Un. Base</th>
                       <th className="px-4 py-3 text-right">Custo Total</th>
                       <th className="px-4 py-3 w-16"></th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border-subtle bg-bg-surface">
                     {form.items.map((item, idx) => {
                       // Find cost generated by backend /preview matching product_id
                       const summary = financials?.item_summaries?.find((s: any) => s.product_id === item.product_id);
                       
                       return (
                         <tr key={idx} className="hover:bg-bg-deep/20 transition-colors group">
                           <td className="px-4 py-3 font-medium text-text-primary">
                             <div className="flex flex-col">
                               <span>{item.descricao_item}</span>
                               {(item as any).product?.codigo && (
                                 <span className="text-[10px] text-text-muted mt-0.5 font-mono uppercase">
                                   SKU: {(item as any).product.codigo}
                                 </span>
                               )}
                             </div>
                             {summary?.custo_base_unitario_item === 0 && (
                               <div className="text-xs text-brand-warning">Custo de ref. inexistente</div>
                             )}
                           </td>
                           <td className="px-4 py-3">
                             <Input 
                               type="number" 
                               value={item.quantidade_no_kit} 
                               onChange={(e) => updateItemQty(idx, parseFloat(e.target.value) || 1)} 
                               className="w-full h-8 text-sm"
                             />
                           </td>
                           <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                             {fmtC(summary?.difal_unitario || 0)}
                           </td>
                           <td className="px-4 py-3 text-right tabular-nums text-text-secondary">
                             {fmtC(summary?.custo_base_unitario_item)}
                           </td>
                           <td className="px-4 py-3 text-right tabular-nums text-text-primary font-medium">
                             {fmtC(summary?.custo_total_item_no_kit)}
                           </td>
                           <td className="px-4 py-3">
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
                       <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.summary?.total_difal_kit || 0)}</td>
                       <td className="px-4 py-3"></td>
                       <td className="px-4 py-3 text-right tabular-nums">{fmtC(financials?.summary?.custo_aquisicao_kit || 0)}</td>
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
        </div>

        {/* RIGHT SIDE: STICKY SUMMARY */}
        <div className="xl:col-span-4 sticky top-24">
          <div className="bg-brand-primary/[0.02] border border-brand-primary/10 rounded-2xl p-6 shadow-sm overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
            
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-xl font-bold text-text-primary tracking-tight">Cálculo Simultâneo</h3>
              {isCalculating ? (
                <span className="flex items-center text-xs font-semibold text-brand-primary bg-brand-primary/10 px-2 py-1 rounded-full animate-pulse">
                  <Calculator className="w-3 h-3 mr-1" /> Calculando
                </span>
              ) : (
                <span className="text-xs font-medium text-brand-success bg-brand-success/10 px-2 py-1 rounded-full border border-brand-success/20">Atualizado</span>
              )}
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                 <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">Custos de Formação</h4>
                 <div className="flex justify-between items-center text-sm">
                   <span 
                     className="text-text-muted font-semibold flex items-center cursor-help"
                     title={`DIFAL Embutido: ${fmtC(financials?.summary?.total_difal_kit || 0)}`}
                   >
                     Custo de Aquisição (Total) <HelpCircle className="w-3 h-3 ml-1 text-brand-primary/50" />
                   </span>
                   <span className="font-bold text-text-primary">{fmtC(financials?.summary?.custo_aquisicao_kit)}</span>
                 </div>
                 {Number(financials?.summary?.custo_aquisicao_produtos) > 0 && (
                   <div className="flex justify-between items-center text-xs pl-3 mt-1 border-l-2 border-brand-primary/20 ml-1">
                     <span className="text-text-muted">↳ Produtos</span>
                     <span className="font-medium text-text-secondary">{fmtC(financials?.summary?.custo_aquisicao_produtos)}</span>
                   </div>
                 )}
                 {Number(financials?.summary?.custo_aquisicao_servicos) > 0 && (
                   <div className="flex justify-between items-center text-xs pl-3 mt-1 border-l-2 border-brand-primary/20 ml-1">
                     <span className="text-text-muted">↳ Serviços</span>
                     <span className="font-medium text-text-secondary">{fmtC(financials?.summary?.custo_aquisicao_servicos)}</span>
                   </div>
                 )}
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-text-muted">Op. e Manutenção <span className="text-[10px] bg-bg-deep px-1 rounded">(Mês)</span></span>
                   <span className="font-medium text-brand-warning">{fmtC((financials?.summary?.custo_operacional_mensal_kit || 0) + (financials?.summary?.manutencao_mensal || 0))}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-text-muted flex items-center" title="Apenas Locação/Comodato">Depreciação de Ativos <HelpCircle className="w-3 h-3 ml-1" /></span>
                   <span className="font-medium text-brand-danger">{fmtC(financials?.summary?.depreciacao_mensal_kit)}</span>
                 </div>
              </div>

               <div className="space-y-3 pt-2">
                 <h4 className="text-xs font-bold uppercase tracking-wider text-text-secondary border-b border-border-subtle pb-2">Rateio Impositivo</h4>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-text-muted whitespace-nowrap">Parcela Financeira Venda</span>
                   <span className="font-medium text-text-primary">{fmtC(financials?.summary?.valor_parcela_locacao)}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm">
                   <span className="text-text-muted">Tributação Retida ({financials?.summary?.aliq_total_impostos || 0}%)</span>
                   <span className="font-medium text-brand-danger">{fmtC(financials?.summary?.valor_impostos)}</span>
                 </div>
                 <div className="flex justify-between items-center text-sm pt-2 mt-2 border-t border-border-subtle border-dashed">
                   <span className="text-text-muted hidden md:inline">Valor Operacional Livre</span>
                   <span className="font-medium text-brand-success">{fmtC(financials?.summary?.receita_liquida_mensal_kit)}</span>
                 </div>
              </div>

              <div className="pt-6 border-t border-brand-primary/10">
                <div className="bg-gradient-to-br from-brand-primary to-brand-primary-dark text-white p-5 rounded-2xl shadow-lg shadow-brand-primary/20 space-y-1 mb-4 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8 pointer-events-none" />
                  <span className="block text-brand-primary-light text-sm font-medium">Faturamento Mensal Estimado</span>
                  <div className="text-3xl font-extrabold tracking-tight">
                    {fmtC(financials?.summary?.valor_mensal_kit)}
                  </div>
                  <div className="text-sm font-medium text-brand-primary-light pt-3 mt-3 border-t border-white/20 flex justify-between">
                    <span>Prazo Tarifa:</span>
                    <span>{financials?.summary?.prazo_mensalidades || 0} meses tarifados</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-bg-surface border border-border-subtle p-4 rounded-xl">
                    <span className="block text-xs font-medium text-text-muted mb-1">Lucro Líquido Real</span>
                    <div className="text-xl font-bold text-brand-success tabular-nums">
                      {fmtC(financials?.summary?.lucro_mensal_kit)}
                    </div>
                  </div>
                  <div className="bg-bg-surface border border-border-subtle p-4 rounded-xl">
                    <span className="block text-xs font-medium text-text-muted mb-1">Margem Operacional</span>
                    <div className="text-xl font-bold text-brand-secondary tabular-nums">
                      {financials?.summary?.margem_kit?.toFixed(2) || '0.00'}%
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
