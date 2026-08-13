import React, { useState } from 'react';
import { X, AlertCircle, Loader2, Save } from 'lucide-react';
import type { OperationPurpose } from './types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    entry_purpose: OperationPurpose;
    real_destination: OperationPurpose;
    description?: string;
  }) => Promise<void>;
  initialData?: {
    name: string;
    entry_purpose: OperationPurpose;
    real_destination: OperationPurpose;
    description?: string;
  };
  isEditing?: boolean;
}

export const TaxRecoveryFormModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isEditing = false
}) => {
  const [name, setName] = useState(initialData?.name || '');
  const [entryPurpose, setEntryPurpose] = useState<OperationPurpose>(
    initialData?.entry_purpose || 'REVENDA'
  );
  const [realDestination, setRealDestination] = useState<OperationPurpose>(
    initialData?.real_destination || 'ATIVO_IMOBILIZADO'
  );
  const [description, setDescription] = useState(initialData?.description || '');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('O nome da recuperação é obrigatório.');
      return;
    }

    if (entryPurpose === realDestination) {
      setError('A finalidade de entrada e a destinação real devem ser diferentes.');
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit({
        name: name.trim(),
        entry_purpose: entryPurpose,
        real_destination: realDestination,
        description: description.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Erro ao salvar a recuperação de impostos.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="bg-surface border border-border-subtle rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-bg-deep/50">
          <h2 className="text-lg font-semibold text-text-primary">
            {isEditing ? 'Editar Recuperação' : 'Nova Recuperação de Impostos'}
          </h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors p-1 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/50 rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Nome da Recuperação <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Análise Compra Equipamento SP-2026"
              className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Finalidade de Entrada <span className="text-rose-500">*</span>
              </label>
              <select
                value={entryPurpose}
                onChange={(e) => setEntryPurpose(e.target.value as OperationPurpose)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="REVENDA">Revenda</option>
                <option value="USO_CONSUMO">Uso e Consumo</option>
                <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Destinação Real <span className="text-rose-500">*</span>
              </label>
              <select
                value={realDestination}
                onChange={(e) => setRealDestination(e.target.value as OperationPurpose)}
                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
              >
                <option value="REVENDA">Revenda</option>
                <option value="USO_CONSUMO">Uso e Consumo</option>
                <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Descrição / Observação
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Justificativa do reenquadramento tributário ou observações da auditoria..."
              className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-brand-primary/20 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-text-muted hover:text-text-primary transition-colors"
              disabled={submitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors shadow-sm text-xs disabled:opacity-50"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>Salvar e continuar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
