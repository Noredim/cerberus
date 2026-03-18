import { useState, useEffect } from 'react';
import Modal from '../../components/modals/Modal';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Search, Loader2 } from 'lucide-react';
import { api } from '../../services/api';
import { ProductSearchModal } from '../../components/modals/ProductSearchModal';

interface AddRentalItemModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (item: any) => void;
  defaultInstalacaoPct: number;
}

export function AddRentalItemModal({ open, onOpenChange, onConfirm, defaultInstalacaoPct }: AddRentalItemModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<any | null>(null);
  const [quantidade, setQuantidade] = useState(1);
  const [percInstalacao, setPercInstalacao] = useState<number | ''>(defaultInstalacaoPct);
  const [valorInstalacao, setValorInstalacao] = useState<number | ''>('');
  
  const [costComp, setCostComp] = useState<any | null>(null);
  const [loadingCost, setLoadingCost] = useState(false);

  // Search products
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setProducts([]);
      setSelectedProduct(null);
      setQuantidade(1);
      setPercInstalacao(defaultInstalacaoPct);
      setValorInstalacao('');
      setCostComp(null);
      setShowProductSearch(false);
      return;
    }
  }, [open, defaultInstalacaoPct]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 2 && !selectedProduct) {
        setLoading(true);
        try {
          const res = await api.get('/cadastro/produtos', {
            params: { skip: 0, limit: 10, q: searchTerm, check_active: true }
          });
          setProducts(res.data.items || res.data || []);
        } catch (error) {
          console.error(error);
        } finally {
          setLoading(false);
        }
      } else if (!searchTerm && !selectedProduct) {
        setProducts([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedProduct]);

  // Load cost composition
  useEffect(() => {
    async function loadCost() {
      if (!selectedProduct) {
        setCostComp(null);
        return;
      }
      setLoadingCost(true);
      try {
        const res = await api.get(`/sales-budgets/product-cost-composition/${selectedProduct.id}?tipo=USO_CONSUMO`);
        setCostComp(res.data);
      } catch (error) {
        console.error('Error fetching cost composition', error);
      } finally {
        setLoadingCost(false);
      }
    }
    loadCost();
  }, [selectedProduct]);

  const handleProductSelect = (p: any) => {
    setSelectedProduct(p);
    setSearchTerm(`${p.codigo || p.codigo_interno} - ${p.nome}`);
    setProducts([]);
    setShowProductSearch(false);
  };

  const handleClearProduct = () => {
    setSelectedProduct(null);
    setSearchTerm('');
    setCostComp(null);
  };

  // Mutually exclusive logic
  const handlePercChange = (val: string) => {
    if (val === '') {
      setPercInstalacao('');
    } else {
      setPercInstalacao(Number(val));
      setValorInstalacao('');
    }
  };

  const handleValorChange = (val: string) => {
    if (val === '') {
      setValorInstalacao('');
    } else {
      setValorInstalacao(Number(val)); // fixed Number({val}) bug found
      setPercInstalacao('');
    }
  };

  const handleConfirm = () => {
    if (!selectedProduct || !costComp) return;

    // We build the object that will be fed to AddRentalProduct function
    const newItem = {
      product: { ...selectedProduct, codigo: selectedProduct.codigo || selectedProduct.codigo_interno },
      quantidade,
      perc_instalacao_item: percInstalacao === '' ? null : Number(percInstalacao),
      valor_instalacao_item: valorInstalacao === '' ? null : Number(valorInstalacao),
      cost_composition: costComp
    };

    onConfirm(newItem);
    onOpenChange(false);
  };

  return (
    <>
    <Modal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title="Adicionar Item de Locação/Comodato"
      maxWidth="xl"
    >
      <div className="grid gap-6 py-4">
        <div className="grid gap-2 relative">
          <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Produto (Ativo)</label>
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <button 
                type="button" 
                onClick={() => setShowProductSearch(true)}
                className="absolute left-2.5 top-2.5 z-10 p-0 text-gray-500 hover:text-brand-primary cursor-pointer transition-colors"
                title="Abrir busca avançada de produtos"
              >
                <Search className="h-4 w-4" />
              </button>
              <Input
                autoFocus
                placeholder="Buscar equipamento (min. 2 letras)"
                className="pl-8"
                value={searchTerm}
                onChange={(e) => {
                    setSearchTerm(e.target.value);
                    if (selectedProduct) handleClearProduct();
                }}
                disabled={selectedProduct !== null}
              />
              {loading && <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-gray-500" />}
            </div>
            {selectedProduct && (
              <Button variant="outline" size="sm" onClick={handleClearProduct}>
                Limpar
              </Button>
            )}
          </div>

          {/* Dropdown Results */}
          {!selectedProduct && products.length > 0 && (
            <div className="absolute top-[4.5rem] left-0 right-0 z-50 bg-white border border-border-subtle shadow-md rounded-md max-h-[300px] overflow-hidden">
              <div className="h-full max-h-[300px] overflow-y-auto custom-scrollbar">
                {products.map(p => (
                  <div
                    key={p.id}
                    className="p-3 hover:bg-gray-100 cursor-pointer border-b last:border-0"
                    onClick={() => handleProductSelect(p)}
                  >
                    <div className="font-medium text-sm text-gray-900">{p.codigo || p.codigo_interno} - {p.nome}</div>
                    <div className="text-xs text-gray-500">
                      Uso/Consumo: R$ {Number(p.vlr_referencia_uso_consumo || p.vlr_uso_consumo || 0).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Quantidade</label>
            <Input
              type="number"
              min="1"
              step="1"
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              disabled={!selectedProduct}
            />
          </div>

          <div className="grid gap-2">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Valor Unitário Base (Bloqueado)</label>
            <div className="relative">
              <Input
                readOnly
                disabled
                value={
                  loadingCost ? "Calculando..." 
                  : costComp ? `R$ ${((costComp.base_uso_consumo || costComp.base_unitario) || 0).toFixed(2)} (DIFAL: R$ ${(costComp.difal_uso_consumo || costComp.difal_unitario || 0).toFixed(2)})` 
                  : "Selecione o produto"
                }
                className="bg-gray-100 text-gray-600 font-medium cursor-not-allowed"
              />
            </div>
          </div>
        </div>

        <div className="border border-border-subtle rounded-md p-4 bg-bg-surface">
          <h4 className="text-sm font-semibold mb-4 text-text-primary">Instalação (Exclusivos)</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">% de Instalação</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 10"
                value={percInstalacao}
                onChange={(e) => handlePercChange(e.target.value)}
                disabled={!selectedProduct || valorInstalacao !== ''}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">R$ Instalação (Fixo)</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="Ex: 500.00"
                value={valorInstalacao}
                onChange={(e) => handleValorChange(e.target.value)}
                disabled={!selectedProduct || percInstalacao !== ''}
              />
            </div>
          </div>
          <p className="text-xs text-text-muted mt-2">
            Preencha o percentual <strong>OU</strong> o valor fixo. O preenchimento de um desabilita o outro.
          </p>
        </div>
      </div>

      <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle mt-4">
        <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
        <Button 
          onClick={handleConfirm} 
          disabled={!selectedProduct || loadingCost || !costComp || quantidade < 1}
        >
          Adicionar à Grid
        </Button>
      </div>
    </Modal>

    {showProductSearch && (
      <ProductSearchModal
        isOpen={showProductSearch}
        title="Buscar Equipamento"
        onClose={() => setShowProductSearch(false)}
        onSelect={handleProductSelect}
      />
    )}
    </>
  );
}
