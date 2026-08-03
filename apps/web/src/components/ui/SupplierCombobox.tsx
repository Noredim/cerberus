import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Building2, Check, ChevronDown, Plus, Search, X } from 'lucide-react';

export interface SupplierOption {
  id: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  [key: string]: any;
}

interface SupplierComboboxProps {
  suppliers: SupplierOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  onOpenQuickModal?: () => void;
  placeholder?: string;
}

const formatCnpj = (cnpjRaw?: string | null): string => {
  if (!cnpjRaw) return '';
  const digits = cnpjRaw.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  return cnpjRaw;
};

const normalizeText = (text?: string | null): string => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

export const SupplierCombobox: React.FC<SupplierComboboxProps> = ({
  suppliers,
  value,
  onChange,
  disabled = false,
  onOpenQuickModal,
  placeholder = 'Buscar fornecedor por Nome ou CNPJ...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Selected supplier object
  const selectedSupplier = useMemo(
    () => suppliers.find((s) => s.id === value),
    [suppliers, value]
  );

  // Filtered suppliers list
  const filteredSuppliers = useMemo(() => {
    const queryNorm = normalizeText(searchQuery.trim());
    const queryDigits = searchQuery.replace(/\D/g, '');

    if (!queryNorm && !queryDigits) return suppliers;

    return suppliers.filter((s) => {
      const razaoNorm = normalizeText(s.razao_social);
      const fantasiaNorm = normalizeText(s.nome_fantasia);
      const cnpjDigits = (s.cnpj || '').replace(/\D/g, '');

      const matchName = razaoNorm.includes(queryNorm) || fantasiaNorm.includes(queryNorm);
      const matchCnpj = queryDigits ? cnpjDigits.includes(queryDigits) : false;

      return matchName || matchCnpj;
    });
  }, [suppliers, searchQuery]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Outside click listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (supplierId: string) => {
    onChange(supplierId);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchQuery('');
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm bg-bg-deep transition-all cursor-pointer select-none ${
          disabled ? 'opacity-60 cursor-not-allowed border-border-subtle' : 'border-border-subtle hover:border-brand-primary/50'
        } ${isOpen ? 'ring-2 ring-brand-primary/30 border-brand-primary' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <Building2 className="w-4 h-4 text-text-muted shrink-0" />
          {selectedSupplier ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-semibold text-text-primary truncate">
                {selectedSupplier.razao_social || selectedSupplier.nome_fantasia}
              </span>
              {selectedSupplier.cnpj && (
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-surface border border-border-subtle text-text-muted shrink-0">
                  {formatCnpj(selectedSupplier.cnpj)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-text-muted truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedSupplier && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Limpar seleção"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-border-subtle rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-2 border-b border-border-subtle bg-bg-deep/50 flex items-center gap-2">
            <Search className="w-4 h-4 text-text-muted shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Digite o Nome ou CNPJ..."
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 rounded text-text-muted hover:text-text-primary"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Supplier List */}
          <div className="max-h-60 overflow-y-auto divide-y divide-border-subtle/40 p-1">
            {filteredSuppliers.length === 0 ? (
              <div className="p-4 text-center text-text-muted space-y-2">
                <p className="text-xs">Nenhum fornecedor encontrado.</p>
                {onOpenQuickModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenQuickModal();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-primary bg-brand-primary/10 rounded-md hover:bg-brand-primary/20 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Cadastrar Novo Fornecedor
                  </button>
                )}
              </div>
            ) : (
              filteredSuppliers.map((s) => {
                const isSelected = s.id === value;
                const displayName = s.razao_social || s.nome_fantasia || 'Fornecedor';
                const hasBothNames = s.razao_social && s.nome_fantasia && s.razao_social !== s.nome_fantasia;

                return (
                  <div
                    key={s.id}
                    onClick={() => handleSelect(s.id)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-brand-primary/10 text-brand-primary font-medium'
                        : 'hover:bg-bg-deep text-text-primary'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-semibold text-text-primary truncate">{displayName}</span>
                      {hasBothNames && (
                        <span className="text-xs text-text-muted truncate">{s.nome_fantasia}</span>
                      )}
                      {s.cnpj && (
                        <span className="text-[11px] font-mono text-text-muted mt-0.5">
                          CNPJ: {formatCnpj(s.cnpj)}
                        </span>
                      )}
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-brand-primary shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
