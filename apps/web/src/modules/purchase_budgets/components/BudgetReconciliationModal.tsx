import { useState, useEffect } from 'react';
import { AlertCircle, Link2, Loader2, Search, X, Plus, RefreshCw } from 'lucide-react';
import { api } from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { ProductSearchModal } from '../../../components/modals/ProductSearchModal';
import { QuickProductCreateModal } from '../../../components/modals/QuickProductCreateModal';
interface BudgetReconciliationModalProps {
  isOpen: boolean;
  onClose: () => void;
  supplierId: string;
  notFoundItems: any[];
  onResolved: (resolvedItem: any) => void;
  onIgnored: () => void;
}

export function BudgetReconciliationModal({
  isOpen,
  onClose,
  supplierId,
  notFoundItems,
  onResolved,
  onIgnored
}: BudgetReconciliationModalProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
      setSelectedProductId(null);
      setSelectedProduct(null);
    }
  }, [isOpen]);



  if (!isOpen || notFoundItems.length === 0) return null;

  const currentItem = notFoundItems[currentIndex];

  const handleNext = () => {
    setSelectedProductId(null);
    setSelectedProduct(null);
    
    if (currentIndex < notFoundItems.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handleIgnore = () => {
    onIgnored();
    handleNext();
  };

  const handleLink = async () => {
    if (!selectedProductId || !supplierId) return;

    setIsLinking(true);
    try {
      await api.post(`/purchase-budgets/import/link-product/${supplierId}`, {
        product_id: selectedProductId,
        codigo_fornecedor: currentItem.codigo_fornecedor
      });

      // 2. Avisar o Form que o item foi resolvido, passando o product_id e nome
      onResolved({
        ...currentItem,
        product: {
          id: selectedProductId,
          nome: selectedProduct?.nome || 'Produto Vinculado',
          ncm_codigo: selectedProduct?.ncm_codigo || ''
        }
      });

      handleNext();
    } catch (err) {
      console.error('Erro ao vincular produto:', err);
      alert('Ocorreu um erro ao vincular o produto. Tente novamente.');
    } finally {
      setIsLinking(false);
    }
  };

  const handleProductCreated = async (newProduct: any) => {
    try {
      setSelectedProductId(newProduct.id);
      setSelectedProduct(newProduct);
      
      setIsLinking(true);
      await api.post(`/purchase-budgets/import/link-product/${supplierId}`, {
        product_id: newProduct.id,
        codigo_fornecedor: currentItem.codigo_fornecedor
      });

      onResolved({
        ...currentItem,
        product: {
          id: newProduct.id,
          nome: newProduct.nome,
          ncm_codigo: newProduct.ncm_codigo || ''
        }
      });

      handleNext();
    } catch (err) {
      console.error('Erro ao vincular produto recém criado:', err);
      alert('O produto foi criado, mas houve um erro ao vinculá-lo. Tente buscar na lupa.');
    } finally {
      setIsLinking(false);
      setIsQuickCreateOpen(false);
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-brand-warning text-yellow-900">
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            Conciliação de Produtos ({currentIndex + 1} de {notFoundItems.length})
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-black/10 rounded-md transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-bg-deep/30">
          
          {/* Coluna 1: Dados do Fornecedor/Arquivo */}
          <div className="bg-white p-4 rounded-xl border border-border-subtle shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-text-muted text-sm font-medium mb-4 uppercase tracking-wider">
                <Search className="w-4 h-4" />
                <span>Dados do Arquivo</span>
              </div>
              <div className="space-y-3">
                <div className="bg-bg-deep p-3 rounded-md">
                  <p className="text-xs text-text-muted mb-1">Cód. Fornecedor na Planilha</p>
                  <p className="font-semibold text-lg text-text-primary break-all">{currentItem.codigo_fornecedor}</p>
                </div>
                {currentItem.descricao && (
                  <div className="bg-bg-deep p-3 rounded-md mt-2">
                    <p className="text-xs text-text-muted mb-1">Descrição</p>
                    <p className="font-medium text-text-primary">{currentItem.descricao}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-bg-deep p-3 rounded-md">
                    <p className="text-xs text-text-muted mb-1">NCM</p>
                    <p className="font-medium text-text-primary">{currentItem.ncm || 'N/A'}</p>
                  </div>
                  <div className="bg-bg-deep p-3 rounded-md">
                    <p className="text-xs text-text-muted mb-1">Valor Unitário</p>
                    <p className="font-medium text-brand-primary">{formatCurrency(currentItem.valor_unitario)}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <p className="text-xs text-text-muted mt-4 bg-blue-50 text-blue-800 p-2 rounded border border-blue-100">
              Estes dados vêm da importação do Excel. Como este código de fornecedor é desconhecido, você deve mapeá-lo ou ignorar a linha.
            </p>
          </div>

          {/* Coluna 2: Busca e Vínculo */}
          <div className="flex flex-col h-[380px] bg-white p-4 rounded-xl border border-border-subtle shadow-sm">
            <h4 className="text-sm font-semibold text-text-primary mb-4 flex items-center justify-between">
              <span>Mapear para Produto Interno</span>
            </h4>

            <div className="flex-1 space-y-4">
              <div>
                <label className="text-xs font-medium text-text-muted mb-1.5 block">
                  Produto Correspondente
                </label>
                <div 
                  className="relative group cursor-pointer"
                  onClick={() => setIsSearchModalOpen(true)}
                >
                  <input
                    type="text"
                    readOnly
                    className="w-full text-sm border border-border-subtle rounded-lg px-3 py-2.5 outline-none cursor-pointer group-hover:border-brand-primary transition-colors pr-10"
                    placeholder="Clique para buscar um produto..."
                    value={selectedProduct ? selectedProduct.nome : ''}
                  />
                  <Search className="w-5 h-5 text-brand-primary absolute right-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {selectedProduct && (
                <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-lg p-3 animate-in fade-in zoom-in duration-200">
                   <p className="text-xs font-semibold text-brand-primary mb-2 uppercase tracking-wide">Produto Selecionado</p>
                   <p className="text-sm font-medium text-text-primary mb-1">{selectedProduct.nome}</p>
                   <div className="flex gap-4 text-xs text-text-muted">
                      <span><strong className="font-medium">Cód:</strong> {selectedProduct.codigo_interno || '-'}</span>
                      <span><strong className="font-medium">NCM:</strong> {selectedProduct.ncm_codigo || '-'}</span>
                   </div>
                </div>
              )}
            </div>

            <div className="mt-auto pt-4 border-t border-border-subtle space-y-3">
              <p className="text-xs text-text-muted mb-2 text-center">
                O produto não existe no sistema?
              </p>
              <Button 
                variant="primary" 
                className="w-full justify-center bg-brand-primary text-white hover:bg-brand-primary/90"
                onClick={() => setIsQuickCreateOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                Cadastrar Rapidamente Aqui
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-center"
                onClick={() => window.open('/cadastro/produtos/novo', '_blank')}
              >
                Cadastro Completo (Nova Guia)
              </Button>
              <Button 
                variant="ghost" 
                className="w-full justify-center text-brand-primary hover:bg-brand-primary/5"
                onClick={() => setIsSearchModalOpen(true)}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Já cadastrei, quero buscar agora
              </Button>
            </div>
          </div>
        </div>

        <ProductSearchModal 
          isOpen={isSearchModalOpen}
          onClose={() => setIsSearchModalOpen(false)}
          onSelect={(p) => {
            setSelectedProductId(p.id);
            setSelectedProduct(p);
          }}
          title={`Vincular Cód. Fornecedor: ${currentItem.codigo_fornecedor}`}
        />

        <QuickProductCreateModal
          isOpen={isQuickCreateOpen}
          onClose={() => setIsQuickCreateOpen(false)}
          onSuccess={handleProductCreated}
          initialData={{
            nome: currentItem.descricao,
            descricao: currentItem.descricao,
            ncm: currentItem.ncm,
            supplier_id: supplierId,
            codigo_fornecedor: currentItem.codigo_fornecedor
          }}
        />

        {/* Footer actions */}
        <div className="p-4 border-t border-border-subtle bg-surface flex justify-between items-center">
          <Button variant="outline" onClick={handleIgnore} className="text-text-muted hover:text-text-primary">
            Ignorar ({notFoundItems.length - currentIndex - 1} restantes)
          </Button>
          
          <Button 
            variant="primary" 
            disabled={!selectedProductId || isLinking}
            onClick={handleLink}
            className="w-40"
          >
            {isLinking ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Link2 className="w-4 h-4 mr-2" />}
            Vincular Produto
          </Button>
        </div>
      </div>
    </div>
  );
}

