import { useState, useEffect, useRef } from 'react';
import { Search, X, FileText } from 'lucide-react';
import { Button } from '../ui/Button';

interface PurchaseBudgetSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (budget: any) => void;
  availableBudgets: any[];
  title?: string;
}

export function PurchaseBudgetSearchModal({
  isOpen,
  onClose,
  onSelect,
  availableBudgets,
  title = 'Vincular Orçamento de Compra'
}: PurchaseBudgetSearchModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [hoveredBudgetId, setHoveredBudgetId] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredResults = availableBudgets.filter(b => {
    const term = searchTerm.toLowerCase();
    const numero = (b.numero_orcamento || '').toLowerCase();
    const fornecedor = (b.supplier_nome_fantasia || b.supplier_nome || '').toLowerCase();
    const vendedor = (b.vendedor_nome || '').toLowerCase();
    return numero.includes(term) || fornecedor.includes(term) || vendedor.includes(term);
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[85vh] border border-border-subtle">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-border-subtle bg-bg-subtle">
          <h3 className="font-semibold text-lg flex items-center gap-2 text-text-primary">
            <FileText className="w-5 h-5 text-orange-500" />
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
              placeholder="Pesquisar por número do orçamento, fornecedor ou vendedor..."
              className="w-full pl-10 pr-10 py-3 bg-bg-subtle border border-border-subtle rounded-lg focus:border-orange-500 focus:ring-1 focus:ring-orange-500/20 outline-none transition-all text-text-primary"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary bg-bg-deep rounded-full p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Table Area */}
        <div className="overflow-y-auto flex-1 bg-bg-deep/10 p-4">
          {filteredResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-text-muted">
              <FileText className="w-12 h-12 mb-3 opacity-20 text-orange-500" />
              <p className="font-medium text-text-primary">Nenhum orçamento de compra disponível.</p>
              <p className="text-sm mt-1 opacity-70">Todos os orçamentos compatíveis já foram vinculados ou nenhum foi cadastrado.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-border-subtle bg-white shadow-sm">
              <table className="w-full text-sm text-left border-collapse">
                <thead>
                  <tr className="bg-bg-subtle text-text-secondary border-b border-border-subtle font-semibold">
                    <th className="px-4 py-3">Orçamento</th>
                    <th className="px-4 py-3">Fornecedor</th>
                    <th className="px-4 py-3">Data de Cadastro</th>
                    <th className="px-4 py-3 text-right">Valor Total da Proposta</th>
                    <th className="px-4 py-3 text-center w-24">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {filteredResults.map((budget) => (
                    <tr 
                      key={budget.id} 
                      className="hover:bg-bg-subtle/40 transition-colors group cursor-pointer"
                      onClick={() => {
                        onSelect(budget);
                        onClose();
                      }}
                      onMouseEnter={() => {
                        setHoveredBudgetId(budget.id);
                      }}
                      onMouseMove={(e) => {
                        const tooltipWidth = 420;
                        const tooltipHeight = 220;
                        let x = e.clientX + 15;
                        let y = e.clientY + 15;

                        if (x + tooltipWidth > window.innerWidth) {
                          x = e.clientX - tooltipWidth - 15;
                        }
                        if (y + tooltipHeight > window.innerHeight) {
                          y = e.clientY - tooltipHeight - 15;
                        }

                        setTooltipPosition({ x, y });
                      }}
                      onMouseLeave={() => {
                        setHoveredBudgetId(null);
                      }}
                    >
                      <td className="px-4 py-3.5 font-medium text-text-primary">
                        Nº {budget.numero_orcamento || 'Sem Número'}
                      </td>
                      <td className="px-4 py-3.5 text-text-secondary">
                        {budget.supplier_nome_fantasia || budget.supplier_nome || budget.vendedor_nome || 'Sem Fornecedor'}
                      </td>
                      <td className="px-4 py-3.5 text-text-muted">
                        {formatDate(budget.data_orcamento)}
                      </td>
                      <td className="px-4 py-3.5 text-right font-medium tabular-nums text-text-primary">
                        {formatCurrency(Number(budget.valor_total) || 0)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <Button 
                          variant="primary" 
                          size="sm" 
                          className="bg-orange-500 hover:bg-orange-600 text-white font-sans text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(budget);
                            onClose();
                          }}
                        >
                          Vincular
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Floating Equipments Tooltip */}
      {hoveredBudgetId && (() => {
        const budget = availableBudgets.find(b => b.id === hoveredBudgetId);
        if (!budget) return null;
        const items = budget.items || [];
        return (
          <div 
            className="fixed z-[200] w-[420px] bg-slate-900/95 backdrop-blur-sm text-white rounded-lg p-3 shadow-xl border border-slate-700 pointer-events-none text-xs flex flex-col gap-2 font-sans transition-all duration-75"
            style={{ left: `${tooltipPosition.x}px`, top: `${tooltipPosition.y}px` }}
          >
            <div className="font-semibold text-orange-400 border-b border-slate-700 pb-1 flex justify-between items-center">
              <span>Itens do Orçamento (Nº {budget.numero_orcamento || 'Sem Número'})</span>
              <span className="text-[10px] text-slate-400 font-normal">{items.length} item(ns)</span>
            </div>
            
            {items.length === 0 ? (
              <p className="text-slate-400 text-center py-2">Nenhum equipamento cadastrado.</p>
            ) : (
              <div className="max-h-[180px] overflow-y-auto pr-1">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800 text-[10px] uppercase font-semibold">
                      <th className="pr-2 pb-1.5 w-[80px]">Cód.</th>
                      <th className="pr-2 pb-1.5">Produto</th>
                      <th className="pr-2 pb-1.5 text-right w-[40px]">Qtd.</th>
                      <th className="pb-1.5 text-right w-[80px]">Unitário</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {items.map((item: any) => (
                      <tr key={item.id} className="text-slate-200 hover:bg-slate-800/30">
                        <td className="pr-2 py-1.5 font-mono text-[10px] text-slate-400 truncate max-w-[80px]" title={item.product_codigo}>
                          {item.product_codigo || '--'}
                        </td>
                        <td className="pr-2 py-1.5 truncate max-w-[180px]" title={item.product_nome}>
                          {item.product_nome || 'Sem Nome'}
                        </td>
                        <td className="pr-2 py-1.5 text-right tabular-nums font-medium">
                          {Number(item.quantidade)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-emerald-400">
                          {formatCurrency(Number(item.valor_unitario) || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
