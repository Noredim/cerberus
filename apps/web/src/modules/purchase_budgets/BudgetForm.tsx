import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { Save, ArrowLeft, Upload, Loader2, Download, Plus, FileText, UserSquare2, Truck as TruckIcon, BadgeDollarSign, Building2 } from 'lucide-react';
import { BudgetItemsGrid } from './components/BudgetItemsGrid';
import type { BudgetItem } from './components/BudgetItemsGrid';
import { BudgetImportModal } from './components/BudgetImportModal';
import { BudgetReconciliationModal } from './components/BudgetReconciliationModal';
import { QuickSupplierCreateModal } from '../../components/modals/QuickSupplierCreateModal';
import { api } from '../../services/api';

export function BudgetForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cabecalho state
  const [numeroOrcamento, setNumeroOrcamento] = useState('');
  const [dataOrcamento, setDataOrcamento] = useState(new Date().toISOString().slice(0, 10));
  const [vendedorNome, setVendedorNome] = useState('');
  const [vendedorTelefone, setVendedorTelefone] = useState('');
  const [vendedorEmail, setVendedorEmail] = useState('');
  const [tipoOrcamento, setTipoOrcamento] = useState<'ATIVO_IMOBILIZADO_USO_CONSUMO' | 'REVENDA'>('REVENDA');
  const [supplierId, setSupplierId] = useState('');
  const [freteTipo, setFreteTipo] = useState<'CIF' | 'FOB'>('FOB');
  const [fretePercent, setFretePercent] = useState<number>(0);
  const [ipiCalculado, setIpiCalculado] = useState<boolean>(true);
  const [criarCenarioDifal, setCriarCenarioDifal] = useState<boolean>(false);

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isReconciliationModalOpen, setIsReconciliationModalOpen] = useState(false);
  const [isQuickSupplierModalOpen, setIsQuickSupplierModalOpen] = useState(false);
  const [unresolvedItems, setUnresolvedItems] = useState<any[]>([]);

  // Items
  const [items, setItems] = useState<BudgetItem[]>([]);

  // Carregar dados auxiliares
  const [suppliers, setSuppliers] = useState<any[]>([]);

  useEffect(() => {
    async function loadAuxData() {
      try {
        const [supRes] = await Promise.all([
          api.get('/cadastro/fornecedores', { params: { limit: 100 } })
        ]);
        setSuppliers(supRes.data);
      } catch (err) {
        console.error('Error loading aux data', err);
      }
    }
    loadAuxData();
  }, []);

  useEffect(() => {
    if (isEditing && id) {
      loadBudget();
    }
  }, [id, isEditing]);

  const loadBudget = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/purchase-budgets/${id}`);
      const b = response.data;
      
      setNumeroOrcamento(b.numero_orcamento || '');
      setDataOrcamento(b.data_orcamento ? new Date(b.data_orcamento).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
      setVendedorNome(b.vendedor_nome || '');
      setVendedorTelefone(b.vendedor_telefone || '');
      setVendedorEmail(b.vendedor_email || '');
      setTipoOrcamento(b.tipo_orcamento || 'REVENDA');
      setSupplierId(b.supplier_id || '');
      setFreteTipo(b.frete_tipo || 'FOB');
      setFretePercent(b.frete_percent || 0);
      setIpiCalculado(Boolean(b.ipi_calculado));

      if (b.items && b.items.length > 0) {
        setItems(b.items.map((item: any) => ({
          ...item,
          product_id: item.product_id,
          valor_unitario: Number(item.valor_unitario),
          frete_percent: Number(item.frete_percent),
          ipi_percent: Number(item.ipi_percent),
          icms_percent: Number(item.icms_percent),
          frete_valor: Number(item.frete_valor),
          ipi_valor: Number(item.ipi_valor),
          total_item: Number(item.total_item),
        })));
      }
    } catch (error) {
      console.error(error);
      alert('Erro ao carregar orçamento.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        numero_orcamento: numeroOrcamento,
        data_orcamento: dataOrcamento,
        vendedor_nome: vendedorNome,
        vendedor_telefone: vendedorTelefone,
        vendedor_email: vendedorEmail,
        tipo_orcamento: tipoOrcamento,
        supplier_id: supplierId || null,
        payment_condition_id: null,
        frete_tipo: freteTipo,
        frete_percent: fretePercent,
        ipi_calculado: ipiCalculado,
        criar_cenario_difal: criarCenarioDifal,
        items
      };

      if (isEditing) {
         // PUT wait
      } else {
        await api.post('/purchase-budgets', payload);
      }
      navigate('/orcamentos-compras');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar orcamento');
    } finally {
      setSaving(false);
    }
  };

  const handleImportSuccess = (foundItems: any[], notFoundItems: any[]) => {
    // Mesclar itens encontrados na grid
    const safeFoundItems = foundItems || [];
    const safeNotFoundItems = notFoundItems || [];

    const mapped = safeFoundItems.map(item => ({
       product_id: item.product.id,
       product_nome: item.product.nome,
       codigo_fornecedor: item.codigo_fornecedor || '',
       ncm: item.ncm || item.product.ncm || '',
       valor_unitario: item.valor_unitario || 0,
       frete_percent: item.frete_percent || 0,
       ipi_percent: item.ipi_percent || 0,
       icms_percent: item.icms_percent || 0
    }));

    setItems(prev => [...prev, ...mapped]);

    if (safeNotFoundItems.length > 0) {
      setUnresolvedItems(safeNotFoundItems);
      setIsReconciliationModalOpen(true);
    }
  };

  const handleReconciliationResolved = (resolvedItem: any) => {
    const mapped = {
       product_id: resolvedItem.product.id,
       product_nome: resolvedItem.product.nome,
       codigo_fornecedor: resolvedItem.codigo_fornecedor || '',
       ncm: resolvedItem.product.ncm_codigo || '',
       valor_unitario: resolvedItem.valor_unitario || 0,
       frete_percent: resolvedItem.frete_percent || 0,
       ipi_percent: resolvedItem.ipi_percent || 0,
       icms_percent: resolvedItem.icms_percent || 0
    };
    setItems(prev => [...prev, mapped]);
  };
  
  const handleQuickSupplierSuccess = (supplier: any) => {
    setSuppliers(prev => [...prev, supplier]);
    setSupplierId(supplier.id);
  };

  return (
    <div className="space-y-6 w-full">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <div className="flex items-center gap-2 mb-1">
             <div className="w-8 h-8 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
               <FileText className="w-4 h-4" />
             </div>
             <h1 className="text-2xl font-display font-semibold text-text-primary tracking-tight">
                 {isEditing ? 'Editar Orçamento' : 'Novo Orçamento'}
             </h1>
           </div>
           <p className="text-text-muted text-sm ml-10">Lançamento de detalhes, impostos e negociações comerciais.</p>
        </div>
        <div className="flex gap-3 items-center ml-10 md:ml-0">
            <Button variant="outline" onClick={() => navigate('/orcamentos-compras')} className="bg-white">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleSave} variant="primary" disabled={saving || loading}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Orçamento
            </Button>
        </div>
      </header>
      
      <div className="space-y-6">
        {/* Bloco 1: Dados Gerais e Fornecedor */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <div className="bg-bg-subtle px-6 py-4 border-b border-border-subtle flex items-center gap-2">
            <BadgeDollarSign className="w-5 h-5 text-brand-primary" />
            <h2 className="text-base font-semibold text-text-primary">Dados do Orçamento</h2>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Nº do Orçamento</label>
              <input 
                type="text" 
                className="input-primary w-full" 
                placeholder="Ex: ORC-2023-001"
                value={numeroOrcamento} 
                onChange={e => setNumeroOrcamento(e.target.value)} 
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Data do Orçamento</label>
              <input 
                type="date" 
                className="input-primary w-full" 
                value={dataOrcamento} 
                onChange={e => setDataOrcamento(e.target.value)} 
              />
            </div>

            <div className="lg:col-span-2">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-text-primary">Fornecedor</label>
                <button 
                  type="button"
                  onClick={() => setIsQuickSupplierModalOpen(true)}
                  className="text-xs text-brand-primary hover:text-brand-primary-hover font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Novo
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Building2 className="h-4 w-4 text-text-muted" />
                </div>
                <select className="input-primary w-full pl-10" value={supplierId} onChange={e => setSupplierId(e.target.value)}>
                  <option value="">Selecione um fornecedor...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.razao_social || s.nome_fantasia}</option>)}
                </select>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-text-primary mb-1.5">Tipo de Orçamento</label>
              <select className="input-primary w-full" value={tipoOrcamento} onChange={e => setTipoOrcamento(e.target.value as any)}>
                <option value="REVENDA">Revenda (Mercadoria para Comercialização)</option>
                <option value="ATIVO_IMOBILIZADO_USO_CONSUMO">Ativo Imobilizado / Uso e Consumo</option>
              </select>
            </div>
          </div>
        </div>

        {/* Bloco 2: Contato Comercial */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <div className="bg-bg-subtle px-6 py-4 border-b border-border-subtle flex items-center gap-2">
            <UserSquare2 className="w-5 h-5 text-brand-primary" />
            <h2 className="text-base font-semibold text-text-primary">Contato Comercial (Vendedor)</h2>
          </div>
          <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Nome do Vendedor</label>
              <input type="text" className="input-primary w-full" placeholder="Ex: João Silva" value={vendedorNome} onChange={e => setVendedorNome(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">Telefone</label>
              <input type="text" className="input-primary w-full" placeholder="(00) 00000-0000" value={vendedorTelefone} onChange={e => setVendedorTelefone(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1.5">E-mail</label>
              <input type="email" className="input-primary w-full" placeholder="joao@fornecedor.com.br" value={vendedorEmail} onChange={e => setVendedorEmail(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Bloco 3: Regras Financeiras e Frete */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <div className="bg-bg-subtle px-6 py-4 border-b border-border-subtle flex items-center gap-2">
            <TruckIcon className="w-5 h-5 text-brand-primary" />
            <h2 className="text-base font-semibold text-text-primary">Impostos e Logística</h2>
          </div>
          
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-1.5">Tipo de frete</label>
                <select className="input-primary w-full" value={freteTipo} onChange={e => setFreteTipo(e.target.value as any)}>
                  <option value="FOB">FOB (Comprador paga)</option>
                  <option value="CIF">CIF (Fornecedor paga)</option>
                </select>
                <p className="text-xs text-text-muted mt-1">
                  {freteTipo === 'FOB' ? 'O frete será somado ao custo.' : 'O frete já está incluso no preço do produto.'}
                </p>
              </div>
              
              {freteTipo === 'FOB' && (
                <div className="animate-in fade-in slide-in-from-top-1">
                  <label className="block text-sm font-medium text-text-primary mb-1.5">Frete Fixo (%) Rateio Geral</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      step="0.01" 
                      className="input-primary w-full pr-8" 
                      placeholder="0.00"
                      value={fretePercent} 
                      onChange={e => setFretePercent(parseFloat(e.target.value) || 0)} 
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-text-muted">
                      %
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-border-subtle">
               <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer hover:text-brand-primary transition-colors">
                  <div className="relative flex items-center">
                    <input type="checkbox" className="peer sr-only" checked={ipiCalculado} onChange={e => setIpiCalculado(e.target.checked)} />
                    <div className="w-5 h-5 border-2 border-text-muted rounded flex items-center justify-center peer-checked:bg-brand-primary peer-checked:border-brand-primary transition-colors">
                      <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 12 10" fill="none"><path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </div>
                  </div>
                  IPI Incluso na Base? (Somar IPI no total)
               </label>
               
               {tipoOrcamento === 'REVENDA' && (
                 <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer hover:text-brand-primary transition-colors animate-in fade-in">
                    <div className="relative flex items-center">
                      <input type="checkbox" className="peer sr-only" checked={criarCenarioDifal} onChange={e => setCriarCenarioDifal(e.target.checked)} />
                      <div className="w-5 h-5 border-2 border-text-muted rounded flex items-center justify-center peer-checked:bg-brand-primary peer-checked:border-brand-primary transition-colors">
                        <svg className="w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" viewBox="0 0 12 10" fill="none"><path d="M1 5l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </div>
                    </div>
                    Criar Cenário DIFAL
                 </label>
               )}
            </div>
          </div>
        </div>

        {/* Bloco 4: Itens e Grid */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          <div className="bg-bg-subtle px-6 py-4 border-b border-border-subtle flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-base font-semibold text-text-primary">Itens do Orçamento</h2>
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
              <Button variant="outline" className="bg-white hover:bg-slate-50 text-sm whitespace-nowrap" onClick={() => setIsImportModalOpen(true)}>
                <Upload className="w-4 h-4 mr-2 text-brand-primary" />
                Importar Planilha
              </Button>
            </div>
          </div>
          
          <BudgetItemsGrid 
            items={items}
            onChange={setItems}
            freteTipoCabecalho={freteTipo}
            fretePercentCabecalho={fretePercent}
            ipiCalculado={ipiCalculado}
          />
        </div>
      </div>

      <BudgetImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        supplierId={supplierId}
        onImportSuccess={handleImportSuccess}
      />

      <BudgetReconciliationModal
        isOpen={isReconciliationModalOpen}
        onClose={() => setIsReconciliationModalOpen(false)}
        supplierId={supplierId}
        notFoundItems={unresolvedItems}
        onResolved={handleReconciliationResolved}
        onIgnored={() => {}}
      />

      <QuickSupplierCreateModal
        isOpen={isQuickSupplierModalOpen}
        onClose={() => setIsQuickSupplierModalOpen(false)}
        onSuccess={handleQuickSupplierSuccess}
      />
    </div>
  );
}
