import React, { useState, useRef, useEffect } from 'react';
import { Search, Loader2, X } from 'lucide-react';
import { api } from '../../../services/api';

interface CnaeOption {
    codigo: string;
    descricao: string;
}

interface Props {
    value: string; // codigo
    onChange: (codigo: string, descricao: string) => void;
    onClear?: () => void;
    placeholder?: string;
    disabled?: boolean;
    required?: boolean;
    label?: string;
    displayValue?: string;
}

export const CnaeAutocomplete: React.FC<Props> = ({
    value,
    onChange,
    onClear,
    placeholder = 'Digite código ou descrição...',
    disabled = false,
    required = false,
    label,
    displayValue,
}) => {
    const [query, setQuery] = useState(displayValue || value || '');
    const [results, setResults] = useState<CnaeOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const [selected, setSelected] = useState<CnaeOption | null>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    // If an initial value is provided we display it as selected
    useEffect(() => {
        if (value && !selected) {
            setQuery(displayValue || value);
        }
    }, [value, displayValue]);

    // Click outside → close
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const search = async (q: string) => {
        if (q.length < 2) { setResults([]); setOpen(false); return; }
        setLoading(true);
        try {
            const res = await api.get('/domains/cnaes', { params: { q, limit: 10 } });
            setResults(res.data.items || []);
            setOpen(true);
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.value;
        setQuery(v);
        setSelected(null);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(v), 350);
    };

    const handleSelect = (item: CnaeOption) => {
        setSelected(item);
        setQuery(`${item.codigo} — ${item.descricao}`);
        setOpen(false);
        onChange(item.codigo, item.descricao);
    };

    const handleClear = () => {
        setSelected(null);
        setQuery('');
        setResults([]);
        setOpen(false);
        onClear?.();
        onChange('', '');
    };

    return (
        <div className="space-y-1.5" ref={wrapperRef}>
            {label && (
                <label className="text-xs font-bold text-text-muted uppercase tracking-wider">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}
            <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </div>
                <input
                    type="text"
                    value={query}
                    onChange={handleChange}
                    onFocus={() => results.length > 0 && setOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required && !selected}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 pl-9 pr-8 outline-none focus:border-brand-primary transition-colors text-sm disabled:opacity-60"
                />
                {selected && (
                    <button
                        type="button"
                        onClick={handleClear}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-red-500 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
                {open && results.length > 0 && (
                    <ul className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto bg-surface border border-border-subtle rounded-md shadow-lg">
                        {results.map((item) => (
                            <li
                                key={item.codigo}
                                onMouseDown={() => handleSelect(item)}
                                className="px-4 py-2.5 cursor-pointer hover:bg-brand-primary/10 transition-colors text-sm"
                            >
                                <span className="font-mono font-bold text-brand-primary mr-2">{item.codigo}</span>
                                <span className="text-text-primary">{item.descricao}</span>
                            </li>
                        ))}
                    </ul>
                )}
                {open && !loading && results.length === 0 && query.length >= 2 && (
                    <div className="absolute z-50 mt-1 w-full bg-surface border border-border-subtle rounded-md shadow-lg px-4 py-3 text-sm text-text-muted">
                        Nenhum CNAE encontrado para "<strong>{query}</strong>"
                    </div>
                )}
            </div>
        </div>
    );
};
