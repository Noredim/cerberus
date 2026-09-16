import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Building2, Check, ChevronDown, Loader2, Plus, Search, X } from 'lucide-react';
import { api } from '../../services/api';

export interface CustomerOption {
  id: string;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  city_nome?: string | null;
  state_sigla?: string | null;
  [key: string]: any;
}

interface CustomerComboboxProps {
  value: string;
  onChange: (value: string, customer?: CustomerOption | null) => void;
  disabled?: boolean;
  onOpenQuickModal?: () => void;
  placeholder?: string;
  initialCustomers?: CustomerOption[];
  selectedCustomerObject?: CustomerOption | null;
}

const formatCnpjOrCpf = (docRaw?: string | null): string => {
  if (!docRaw) return '';
  const digits = docRaw.replace(/\D/g, '');
  if (digits.length === 14) {
    return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  }
  if (digits.length === 11) {
    return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  }
  return docRaw;
};

const normalizeText = (text?: string | null): string => {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

export const CustomerCombobox: React.FC<CustomerComboboxProps> = ({
  value,
  onChange,
  disabled = false,
  onOpenQuickModal,
  placeholder = 'Buscar cliente por Nome ou CNPJ...',
  initialCustomers = [],
  selectedCustomerObject = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [customersList, setCustomersList] = useState<CustomerOption[]>(initialCustomers);
  const [loading, setLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(selectedCustomerObject);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync initial list when prop changes
  useEffect(() => {
    if (initialCustomers.length > 0) {
      setCustomersList((prev) => {
        // Merge without losing currently selected or newly searched items
        const existingIds = new Set(prev.map((c) => c.id));
        const newItems = initialCustomers.filter((c) => !existingIds.has(c.id));
        return [...prev, ...newItems];
      });
    }
  }, [initialCustomers]);

  // Sync selectedCustomerObject or fetch if value exists but object is missing
  useEffect(() => {
    if (selectedCustomerObject && selectedCustomerObject.id === value) {
      setSelectedCustomer(selectedCustomerObject);
      // Ensure it's in the list
      setCustomersList((prev) => {
        if (!prev.some((c) => c.id === selectedCustomerObject.id)) {
          return [selectedCustomerObject, ...prev];
        }
        return prev;
      });
      return;
    }

    if (!value) {
      setSelectedCustomer(null);
      return;
    }

    // Check if found in existing list
    const found = customersList.find((c) => c.id === value);
    if (found) {
      setSelectedCustomer(found);
    } else {
      // Fetch single customer by id
      let isMounted = true;
      api
        .get(`/cadastro/clientes/${value}`)
        .then((res) => {
          if (isMounted && res.data) {
            setSelectedCustomer(res.data);
            setCustomersList((prev) => [res.data, ...prev.filter((c) => c.id !== res.data.id)]);
          }
        })
        .catch((err) => {
          console.warn('Erro ao carregar dados do cliente selecionado:', err);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [value, selectedCustomerObject]);

  // Remote Search with Debounce
  const fetchCustomers = useCallback(async (query: string) => {
    setLoading(true);
    try {
      const res = await api.get('/cadastro/clientes', {
        params: {
          q: query.trim() || undefined,
          limit: 50,
        },
      });
      const data = Array.isArray(res.data) ? res.data : res.data?.items || [];
      setCustomersList((prev) => {
        // Keep selected customer in list if exists
        const currentSelected = selectedCustomer || prev.find((c) => c.id === value);
        if (currentSelected && !data.some((c: CustomerOption) => c.id === currentSelected.id)) {
          return [currentSelected, ...data];
        }
        return data;
      });
    } catch (err) {
      console.error('Erro ao buscar clientes:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer, value]);

  // Handle Search Input Change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchCustomers(query);
    }, 300);
  };

  // Filtered customers (client-side backup for instant responsiveness)
  const filteredCustomers = useMemo(() => {
    const queryNorm = normalizeText(searchQuery.trim());
    const queryDigits = searchQuery.replace(/\D/g, '');

    if (!queryNorm && !queryDigits) return customersList;

    return customersList.filter((c) => {
      const razaoNorm = normalizeText(c.razao_social);
      const fantasiaNorm = normalizeText(c.nome_fantasia);
      const cnpjDigits = (c.cnpj || '').replace(/\D/g, '');

      const matchName = razaoNorm.includes(queryNorm) || fantasiaNorm.includes(queryNorm);
      const matchCnpj = queryDigits ? cnpjDigits.includes(queryDigits) : false;

      return matchName || matchCnpj;
    });
  }, [customersList, searchQuery]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      if (customersList.length === 0) {
        fetchCustomers('');
      }
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

  const handleSelect = (customer: CustomerOption) => {
    setSelectedCustomer(customer);
    onChange(customer.id, customer);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCustomer(null);
    onChange('', null);
    setSearchQuery('');
  };

  const displayName = selectedCustomer?.nome_fantasia || selectedCustomer?.razao_social;

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Trigger Button */}
      <div
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={`w-full flex items-center justify-between px-3 py-2 border rounded-md text-sm bg-bg-deep transition-all cursor-pointer select-none h-11 ${
          disabled
            ? 'opacity-60 cursor-not-allowed border-border-subtle'
            : 'border-border-subtle hover:border-brand-primary/50'
        } ${isOpen ? 'ring-2 ring-brand-primary/30 border-brand-primary' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
          <Building2 className="w-4 h-4 text-text-muted shrink-0" />
          {selectedCustomer ? (
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="font-semibold text-text-primary truncate">
                {displayName}
              </span>
              {selectedCustomer.cnpj && (
                <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-surface border border-border-subtle text-text-muted shrink-0">
                  {formatCnpjOrCpf(selectedCustomer.cnpj)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-text-muted truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedCustomer && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              title="Limpar seleção"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-text-muted transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </div>
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-surface border border-border-subtle rounded-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Search Header */}
          <div className="p-2.5 border-b border-border-subtle bg-bg-deep/50 flex items-center gap-2">
            {loading ? (
              <Loader2 className="w-4 h-4 text-brand-primary animate-spin shrink-0 ml-1" />
            ) : (
              <Search className="w-4 h-4 text-text-muted shrink-0 ml-1" />
            )}
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Digite o Nome, Razão Social ou CNPJ..."
              className="w-full bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  fetchCustomers('');
                }}
                className="p-1 rounded text-text-muted hover:text-text-primary transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Customer List */}
          <div className="max-h-64 overflow-y-auto divide-y divide-border-subtle/40 p-1">
            {filteredCustomers.length === 0 && !loading ? (
              <div className="p-4 text-center text-text-muted space-y-2">
                <p className="text-xs">Nenhum cliente encontrado para a busca.</p>
                {onOpenQuickModal && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onOpenQuickModal();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-brand-primary bg-brand-primary/10 rounded-md hover:bg-brand-primary/20 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Cadastrar Novo Cliente
                  </button>
                )}
              </div>
            ) : (
              filteredCustomers.map((c) => {
                const isSelected = c.id === value;
                const primaryName = c.nome_fantasia || c.razao_social || 'Cliente sem nome';
                const hasSecondary =
                  c.razao_social &&
                  c.nome_fantasia &&
                  c.razao_social.trim().toLowerCase() !== c.nome_fantasia.trim().toLowerCase();
                const locationText =
                  c.city_nome && c.state_sigla ? `${c.city_nome} - ${c.state_sigla}` : c.city_nome || '';

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelect(c)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-md text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-brand-primary/10 text-brand-primary font-medium'
                        : 'hover:bg-bg-deep text-text-primary'
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-semibold text-text-primary truncate">{primaryName}</span>
                      {hasSecondary && (
                        <span className="text-xs text-text-muted truncate">{c.razao_social}</span>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {c.cnpj && (
                          <span className="text-[11px] font-mono font-medium text-text-muted">
                            CNPJ: {formatCnpjOrCpf(c.cnpj)}
                          </span>
                        )}
                        {locationText && (
                          <span className="text-[11px] text-text-muted">
                            • {locationText}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && <Check className="w-4 h-4 text-brand-primary shrink-0 ml-2" />}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer with Quick Create option if items exist */}
          {filteredCustomers.length > 0 && onOpenQuickModal && (
            <div className="p-2 border-t border-border-subtle bg-bg-deep/30 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenQuickModal();
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-brand-primary hover:bg-brand-primary/10 rounded transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Novo Cliente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
