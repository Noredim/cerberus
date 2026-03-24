import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, PackageOpen, CheckCircle } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';

interface AddOperationalCostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: { product: any; quantidade: number; tipo_custo: string; valor_unitario: number }) => void;
  defaultType?: string;
}

export function AddOperationalCostModal({ isOpen, onClose, onConfirm, defaultType }: AddOperationalCostModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [quantidade, setQuantidade] = useState(1);
  const [tipoCusto, setTipoCusto] = useState('MANUTENCAO');
  const [valorUnitario, setValorUnitario] = useState(0);

  const COST_TYPES = [
    { value: 'Seguro apólice', label: 'Seguro apólice' },
    { value: 'Logística/veículos', label: 'Logística/veículos' },
    { value: 'Loc. software', label: 'Loc. software' },
    { value: 'MANUTENCAO', label: 'Manut. pred./corretiva' },
    { value: 'INSTALACAO', label: 'Instalação' }
  ];

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setResults([]);
      setSelectedProduct(null);
      if (defaultType) {
        setTipoCusto(defaultType);
      } else {
        setTipoCusto('MANUTENCAO');
      }
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, defaultType]);

  useEffect(() => {
    if (selectedProduct) {
      setQuantidade(1);
      setValorUnitario(selectedProduct.vlr_referencia_uso_consumo || selectedProduct.vlr_referencia_revenda || 0);
      // Mantém o tipoCusto atual (se foi pre-setado pelo defaultType) 
      // ao invés de forçar 'Manut. pred./corretiva' se defaultType existe.
      if (!defaultType) {
        setTipoCusto('MANUTENCAO');
      }
    }
  }, [selectedProduct, defaultType]);

  useEffect(() => {
    if (selectedProduct) return;
    const delayDebounceFn = setTimeout(() => {
      async function fetchProducts() {
        if (!searchTerm || searchTerm.trim().length < 2) {
          setResults([]);
          return;
        }
        setIsSearching(true);
        try {
          // Fetch only services
          const res = await api.get('/cadastro/produtos', { params: { q: searchTerm, limit: 50 } });
          const filtered = res.data.filter((p: any) => p.tipo === 'SERVICO' || p.tipo === 'LICENCA').slice(0, 20);
          setResults(filtered);
        } catch (err) {
          console.error('Erro ao buscar produtos', err);
        } finally {
          setIsSearching(false);
        }
      }
      fetchProducts();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, selectedProduct]);

  const handleConfirm = () => {
    if (!selectedProduct) return;
    onConfirm({
      product: selectedProduct,
      quantidade,
      tipo_custo: tipoCusto,
      valor_unitario: valorUnitario
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-bg-subtle">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-text-primary">
            <Search className="w-5 h-5 text-brand-primary" />
            Adicionar Custo Operacional (Serviço)
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-md transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selectedProduct ? (
          <>
            {/* Search Input */}
            <div className="p-4 border-b border-border-subtle bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
                <input
                  ref={inputRef}
                  type="text"
                  placeholder="Digite o nome ou código do serviço..."
                  className="w-full pl-10 pr-10 py-3 bg-bg-subtle border border-border-subtle rounded-lg focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none transition-all text-text-primary"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-primary w-5 h-5 animate-spin" />
                )}
                {searchTerm && !isSearching && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary bg-bg-deep rounded-full p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Results Area */}
            <div className="overflow-y-auto flex-1 bg-bg-deep/30 p-4">
              <div className="space-y-2">
                {!searchTerm && results.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted">
                    <PackageOpen className="w-12 h-12 mb-3 opacity-20" />
                    <p>Pesquise um serviço para adicionar como custo operacional.</p>
                  </div>
                )}

                {results.map((product) => (
                  <div 
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    className="flex items-center justify-between p-4 bg-white border border-border-subtle rounded-lg hover:border-brand-primary hover:shadow-sm cursor-pointer transition-all group"
                  >
                    <div className="flex flex-col overflow-hidden w-full pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-text-primary truncate">{product.nome}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                        {product.codigo_interno && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Cód:</span> {product.codigo_interno}
                          </span>
                        )}
                        <span className="flex items-center gap-1 border-border-subtle">
                          <span className="font-medium">Valor Ref:</span> R$ {Number(product.vlr_referencia_uso_consumo || product.vlr_referencia_revenda || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {searchTerm.length >= 2 && results.length === 0 && !isSearching && (
                  <div className="flex flex-col items-center justify-center py-10 text-center bg-white border border-dashed border-border-subtle rounded-lg">
                    <p className="text-text-primary font-medium mb-1">Nenhum serviço encontrado</p>
                    <p className="text-text-muted text-sm mb-4">Apenas produtos do tipo SERVIÇO e LICENÇA são listados.</p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="p-6 space-y-6">
            <div className="bg-brand-primary/5 border border-brand-primary/20 rounded-lg p-4 flex items-start gap-4">
              <CheckCircle className="w-6 h-6 text-brand-primary shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-text-primary">{selectedProduct.nome}</h4>
                <p className="text-sm text-text-muted mt-1">Cód: {selectedProduct.codigo_interno || selectedProduct.codigo}</p>
                <div className="mt-3">
                  <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>
                    Trocar Serviço
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Tipo de Custo</label>
                <select
                  value={tipoCusto}
                  onChange={(e) => setTipoCusto(e.target.value)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-text-primary"
                >
                  {COST_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Quantidade</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={quantidade}
                  onChange={(e) => setQuantidade(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-text-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1">Valor Unitário (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorUnitario}
                  onChange={(e) => setValorUnitario(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 text-text-primary"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-muted mb-1">Total</label>
                <div className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-sm font-semibold text-text-primary">
                  {(quantidade * valorUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-border-subtle">
              <Button variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button variant="primary" onClick={handleConfirm}>Confirmar Adição</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
