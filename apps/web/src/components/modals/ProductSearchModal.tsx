import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, PackageOpen, Plus } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { QuickProductCreateModal } from './QuickProductCreateModal';
import type { Product } from '../../modules/products/types';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (product: Product) => void;
  title?: string;
  salesBudgetId?: string;
  multiSelect?: boolean;
  onSelectMany?: (products: Product[]) => void;
}

export function ProductSearchModal({ isOpen, onClose, onSelect, title = 'Buscar Produto', salesBudgetId, multiSelect = false, onSelectMany }: ProductSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const [markup, setMarkup] = useState<number>(1.0);

  useEffect(() => {
    if (salesBudgetId && isOpen) {
      api.get(`/sales-budgets/${salesBudgetId}`)
        .then(res => {
          setMarkup(Number(res.data.venda_markup_produtos) || 1.0);
        })
        .catch(err => {
          console.error("Erro ao buscar markup do orçamento", err);
        });
    } else {
      setMarkup(1.0);
    }
  }, [salesBudgetId, isOpen]);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setResults([]);
      setSelectedProducts([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const delayDebounceFn = setTimeout(() => {
      async function fetchProducts() {
        if (!salesBudgetId && (!searchTerm || searchTerm.trim().length < 2)) {
          setResults([]);
          return;
        }
        setIsSearching(true);
        try {
          const params: { limit: number; q?: string; sales_budget_id?: string } = { limit: 100 };
          if (searchTerm && searchTerm.trim().length >= 2) {
            params.q = searchTerm;
          }
          if (salesBudgetId) {
            params.sales_budget_id = salesBudgetId;
          }
          const res = await api.get('/cadastro/produtos', { params });
          setResults(res.data);
        } catch (err) {
          console.error('Erro ao buscar produtos', err);
        } finally {
          setIsSearching(false);
        }
      }
      fetchProducts();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, salesBudgetId, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-bg-subtle">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-text-primary">
            <Search className="w-5 h-5 text-brand-primary" />
            {title}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-black/5 rounded-md transition-colors text-text-muted hover:text-text-primary">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Input */}
        <div className="p-4 border-b border-border-subtle bg-white">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Digite o nome, código interno ou NCM do produto..."
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
                <p>Use a barra de pesquisa acima para encontrar um produto.</p>
                <p className="text-sm mt-1 opacity-70">Você pode pesquisar por código externo, nome ou NCM.</p>
              </div>
            )}

            {results.map((product) => {
              const isSelected = multiSelect && selectedProducts.some(p => p.id === product.id);
              return (
                <div 
                  key={product.id}
                  onClick={() => {
                    if (multiSelect) {
                      if (isSelected) {
                        setSelectedProducts(prev => prev.filter(p => p.id !== product.id));
                      } else {
                        setSelectedProducts(prev => [...prev, product]);
                      }
                    } else {
                      onSelect?.(product);
                      onClose();
                    }
                  }}
                  className={`flex items-center justify-between p-4 bg-white border rounded-lg cursor-pointer transition-all group ${
                    isSelected 
                      ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/20' 
                      : 'border-border-subtle hover:border-brand-primary hover:shadow-sm'
                  }`}
                >
                  <div className="flex items-center w-full pr-4">
                    {multiSelect && (
                      <div className="mr-3 shrink-0">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          readOnly
                          className="w-4 h-4 rounded border-border-strong text-brand-primary focus:ring-brand-primary"
                        />
                      </div>
                    )}
                    <div className="flex-1 flex flex-col min-w-0 pr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-text-primary break-words whitespace-normal">{product.nome}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                        {product.codigo && (
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Cód:</span> {product.codigo}
                          </span>
                        )}
                        {product.ncm_codigo && (
                          <span className="flex items-center gap-1 border-l pl-4 border-border-subtle">
                            <span className="font-medium">NCM:</span> {product.ncm_codigo}
                          </span>
                        )}
                        {product.categoria && (
                          <span className="flex items-center gap-1 border-l pl-4 border-border-subtle">
                            <span className="font-medium">Categoria:</span> {product.categoria}
                          </span>
                        )}
                      </div>
                    </div>

                    {(() => {
                      const cost = product.vlr_referencia_revenda || product.vlr_referencia_uso_consumo || 0;
                      const sale = cost * markup;
                      return (
                        <div className="flex items-center gap-6 shrink-0 text-sm">
                          <div className="text-right">
                            <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold">P. Revenda</div>
                            <div className="font-medium text-text-primary tabular-nums">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cost)}
                            </div>
                          </div>
                          <div className="text-right border-l pl-6 border-border-subtle">
                            <div className="text-[10px] text-text-muted uppercase tracking-wider font-bold">P. Venda</div>
                            <div className="font-bold text-brand-primary tabular-nums">
                              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale)}
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {!multiSelect && (
                    <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="outline" size="sm" className="pointer-events-none">
                        Selecionar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}

            {results.length > 0 && (
              <div className="mt-4 pt-2 border-t border-border-subtle flex justify-center">
                <button 
                  type="button"
                  onClick={() => setIsQuickCreateOpen(true)}
                  className="text-xs font-semibold text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 py-2 px-4 rounded-lg hover:bg-brand-primary/5 transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Não encontrou o que procurava? Cadastrar Novo Produto
                </button>
              </div>
            )}

            {searchTerm.length >= 2 && results.length === 0 && !isSearching && (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-white border border-dashed border-border-subtle rounded-lg">
                <p className="text-text-primary font-medium mb-1">Nenhum produto encontrado</p>
                <p className="text-text-muted text-sm mb-4">Verifique a ortografia ou cadastre um novo produto.</p>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => setIsQuickCreateOpen(true)}
                    variant="primary" 
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Cadastrar Rápido
                  </Button>
                  <Button 
                    onClick={() => window.open('/cadastro/produtos/novo', '_blank')}
                    variant="outline" 
                  >
                    Cadastro Completo (Nova Guia)
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {multiSelect && (
          <div className="flex justify-between items-center p-4 border-t border-border-subtle bg-bg-subtle flex-none">
            <span className="text-sm font-semibold text-text-secondary">
              {selectedProducts.length} {selectedProducts.length === 1 ? 'produto selecionado' : 'produtos selecionados'}
            </span>
            <div className="flex items-center gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={selectedProducts.length === 0}
                onClick={() => {
                  onSelectMany?.(selectedProducts);
                  onClose();
                }}
              >
                Adicionar Selecionados ({selectedProducts.length})
              </Button>
            </div>
          </div>
        )}

        <QuickProductCreateModal
          isOpen={isQuickCreateOpen}
          onClose={() => setIsQuickCreateOpen(false)}
          onSuccess={(newProduct) => {
            setIsQuickCreateOpen(false);
            if (multiSelect) {
              setSelectedProducts(prev => {
                if (prev.some(p => p.id === newProduct.id)) return prev;
                return [...prev, newProduct];
              });
            } else {
              onSelect?.(newProduct);
              onClose();
            }
          }}
          initialData={{
            nome: searchTerm
          }}
        />
      </div>
    </div>
  );
}
