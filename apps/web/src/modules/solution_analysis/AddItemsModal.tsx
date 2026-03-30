import { useState, useCallback, useEffect } from 'react';
import { api } from '../../services/api';
import { X, Search, AlertTriangle, Check } from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface Product {
  id: string;
  nome: string;
  codigo?: string;
  tipo?: string;
}

interface SlotState {
  product: Product | null;
  quantidade: string;
  search: string;
  results: Product[];
  searching: boolean;
  open: boolean;
}

const emptySlot = (): SlotState => ({
  product: null,
  quantidade: '',
  search: '',
  results: [],
  searching: false,
  open: false,
});

interface Props {
  isOpen: boolean;
  onClose: () => void;
  analise: { id: string; tipo_analise: string };
  onSuccess: () => void;
}

export function AddItemsModal({ isOpen, onClose, analise, onSuccess }: Props) {
  const [slotA, setSlotA] = useState<SlotState>(emptySlot());
  const [slotB, setSlotB] = useState<SlotState>(emptySlot());
  const [slotC, setSlotC] = useState<SlotState>(emptySlot());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const slots: [SlotState, React.Dispatch<React.SetStateAction<SlotState>>][] = [
    [slotA, setSlotA],
    [slotB, setSlotB],
    [slotC, setSlotC],
  ];

  const slotLabels = ['A', 'B', 'C'];

  useEffect(() => {
    if (!isOpen) {
      setSlotA(emptySlot());
      setSlotB(emptySlot());
      setSlotC(emptySlot());
      setError('');
    }
  }, [isOpen]);

  const doSearch = useCallback(
    async (
      query: string,
      setter: React.Dispatch<React.SetStateAction<SlotState>>
    ) => {
      if (!query || query.length < 2) {
        setter((p) => ({ ...p, results: [], open: false }));
        return;
      }
      setter((p) => ({ ...p, searching: true }));
      try {
        const { data } = await api.get('/cadastro/produtos', { params: { q: query, limit: 12 } });
        setter((p) => ({ ...p, results: data.items || data, open: true, searching: false }));
      } catch {
        setter((p) => ({ ...p, results: [], searching: false }));
      }
    },
    []
  );

  const handleSelect = (
    product: Product,
    setter: React.Dispatch<React.SetStateAction<SlotState>>
  ) => {
    setter((p) => ({ ...p, product, search: product.nome, open: false, results: [] }));
  };

  const handleSave = async () => {
    setError('');
    const [a, b, c] = [slotA, slotB, slotC];
    const hasAny = a.product || b.product || c.product;
    if (!hasAny) { setError('Preencha ao menos uma solução'); return; }

    // Validate: if product selected, quantity required (and vice versa)
    for (const [slot, label] of [[a, 'A'], [b, 'B'], [c, 'C']] as const) {
      if (slot.product && (!slot.quantidade || Number(slot.quantidade) <= 0)) {
        setError(`Solução ${label}: informe uma quantidade válida > 0`);
        return;
      }
      if (!slot.product && slot.quantidade) {
        setError(`Solução ${label}: selecione um item ou limpe a quantidade`);
        return;
      }
    }

    const toSlotPayload = (slot: SlotState) =>
      slot.product
        ? { item_id: slot.product.id, quantidade: parseFloat(slot.quantidade) }
        : null;

    setSaving(true);
    try {
      await api.post(`/solution-analysis/${analise.id}/items`, {
        solucao_a: toSlotPayload(slotA),
        solucao_b: toSlotPayload(slotB),
        solucao_c: toSlotPayload(slotC),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao adicionar itens');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-bg-surface border border-border-subtle rounded-2xl shadow-2xl w-full max-w-2xl">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
          <h2 className="text-base font-bold text-text-primary">Adicionar Linha de Itens</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-deep transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tip */}
        <div className="px-6 py-3 bg-bg-deep/60 border-b border-border-subtle text-xs text-text-muted">
          {analise.tipo_analise === 'REVENDA'
            ? 'Preços usados: VLR Referência Revenda'
            : 'Preços usados: VLR Uso/Consumo (produtos), VLR Revenda (licenças)'}
          &nbsp;— Preencha ao menos uma solução por linha.
        </div>

        {/* Slots */}
        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {slots.map(([slot, setSlot], idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-brand-primary uppercase bg-brand-primary/10 px-2 py-0.5 rounded">
                  Solução {slotLabels[idx]}
                </span>
                {slot.product && (
                  <span className="text-xs text-emerald-600 flex items-center gap-1">
                    <Check className="w-3 h-3" /> selecionado
                  </span>
                )}
              </div>

              <div className="flex gap-2">
                {/* Product search */}
                <div className="flex-1 relative">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                    <input
                      type="text"
                      placeholder="Buscar produto ou licença..."
                      value={slot.search}
                      onChange={(e) => {
                        setSlot((p) => ({ ...p, search: e.target.value, product: e.target.value === '' ? null : p.product }));
                        doSearch(e.target.value, setSlot);
                      }}
                      onFocus={() => slot.results.length > 0 && setSlot((p) => ({ ...p, open: true }))}
                      className="w-full pl-8 pr-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
                    />
                    {slot.searching && (
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-brand-primary/40 border-t-brand-primary rounded-full animate-spin" />
                    )}
                  </div>

                  {/* Dropdown results */}
                  {slot.open && slot.results.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-bg-surface border border-border-subtle rounded-lg shadow-lg max-h-44 overflow-auto">
                      {slot.results.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => handleSelect(p, setSlot)}
                          className="w-full text-left px-3 py-2 hover:bg-bg-deep transition-colors text-sm border-b border-border-subtle last:border-0"
                        >
                          <span className="font-medium text-text-primary truncate block">{p.nome}</span>
                          {p.codigo && (
                            <span className="text-xs text-text-muted">#{p.codigo} {p.tipo && `· ${p.tipo}`}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quantity */}
                <div className="w-24">
                  <input
                    type="number"
                    min="0.0001"
                    step="1"
                    disabled={!slot.product}
                    placeholder="Qtd"
                    value={slot.quantidade}
                    onChange={(e) => setSlot((p) => ({ ...p, quantidade: e.target.value }))}
                    className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-deep text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30 disabled:opacity-40"
                  />
                </div>

                {/* Clear */}
                {slot.product && (
                  <button
                    onClick={() => setSlot(emptySlot())}
                    className="p-2 text-text-muted hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Limpar"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border-subtle">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? 'Adicionando...' : 'Confirmar Linha'}
          </Button>
        </div>
      </div>
    </div>
  );
}
