import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, PackageOpen, Plus } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';

interface ProductSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (product: any) => void;
  title?: string;
}

export function ProductSearchModal({ isOpen, onClose, onSelect, title = 'Buscar Produto' }: ProductSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      async function fetchProducts() {
        if (!searchTerm || searchTerm.trim().length < 2) {
          setResults([]);
          return;
        }
        setIsSearching(true);
        try {
          const res = await api.get('/cadastro/produtos', { params: { q: searchTerm, limit: 20 } });
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
  }, [searchTerm]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
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

            {results.map((product) => (
              <div 
                key={product.id}
                onClick={() => {
                  onSelect(product);
                  onClose();
                }}
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
                    {product.ncm_codigo && (
                      <span className="flex items-center gap-1 border-l pl-4 border-border-subtle">
                        <span className="font-medium">NCM:</span> {product.ncm_codigo}
                      </span>
                    )}
                    {product.familia?.nome && (
                      <span className="flex items-center gap-1 border-l pl-4 border-border-subtle">
                        <span className="font-medium">Família:</span> {product.familia.nome}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" className="pointer-events-none">
                    Selecionar
                  </Button>
                </div>
              </div>
            ))}

            {searchTerm.length >= 2 && results.length === 0 && !isSearching && (
              <div className="flex flex-col items-center justify-center py-10 text-center bg-white border border-dashed border-border-subtle rounded-lg">
                <p className="text-text-primary font-medium mb-1">Nenhum produto encontrado</p>
                <p className="text-text-muted text-sm mb-4">Verifique a ortografia ou cadastre um novo produto.</p>
                <Button 
                  onClick={() => window.open('/cadastro/produtos/novo', '_blank')}
                  variant="primary" 
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Produto
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
