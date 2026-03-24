import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2, PackageOpen, Plus } from 'lucide-react';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';

interface OpportunityKitSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (kit: any) => void;
  title?: string;
  salesBudgetId?: string;
  tipoContrato?: string;
}

export function OpportunityKitSearchModal({ isOpen, onClose, onSelect, title = 'Buscar Kit de Oportunidade', salesBudgetId, tipoContrato }: OpportunityKitSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { activeCompanyId } = useAuth();

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setResults([]);
      setTimeout(() => inputRef.current?.focus(), 100);
      fetchAllKits();
    }
  }, [isOpen]);

  const fetchAllKits = async () => {
    if (!activeCompanyId) return;
    setIsSearching(true);
    try {
      const res = await api.get(`/opportunity-kits/company/${activeCompanyId}`, {
        params: { sales_budget_id: salesBudgetId, tipo_contrato: tipoContrato }
      });
      setResults(res.data);
    } catch (err) {
      console.error('Erro ao buscar kits', err);
    } finally {
      setIsSearching(false);
    }
  };

  const filteredResults = results.filter(kit => 
    kit.nome_kit.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (kit.descricao_kit && kit.descricao_kit.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
              placeholder="Digite o nome ou descrição do kit..."
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
            {!isSearching && filteredResults.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted">
                <PackageOpen className="w-12 h-12 mb-3 opacity-20" />
                <p>Nenhum kit encontrado.</p>
                <p className="text-sm mt-1 opacity-70">Verifique a ortografia ou cadastre um novo kit.</p>
                <Button 
                  onClick={() => window.open('/cadastros/kits/novo', '_blank')}
                  variant="primary" 
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Cadastrar Kit
                </Button>
              </div>
            )}

            {filteredResults.map((kit) => (
              <div 
                key={kit.id}
                onClick={() => {
                  onSelect(kit);
                  onClose();
                }}
                className="flex items-center justify-between p-4 bg-white border border-border-subtle rounded-lg hover:border-brand-primary hover:shadow-sm cursor-pointer transition-all group"
              >
                <div className="flex flex-col overflow-hidden w-full pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-text-primary truncate">{kit.nome_kit}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                    <span className="flex items-center gap-1">
                      <span className="font-medium">Tipo:</span> {kit.tipo_contrato}
                    </span>
                    <span className="flex items-center gap-1 border-l pl-4 border-border-subtle">
                      <span className="font-medium">Mensalidades:</span> {kit.summary?.prazo_mensalidades || 0}
                    </span>
                    <span className="flex items-center gap-1 border-l pl-4 border-border-subtle">
                      <span className="font-medium">Valor Estimado:</span> {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(kit.summary?.valor_mensal_kit || 0)}
                    </span>
                  </div>
                </div>
                
                <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="outline" size="sm" className="pointer-events-none">
                    Selecionar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
