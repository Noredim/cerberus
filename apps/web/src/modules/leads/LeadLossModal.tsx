import React, { useState } from 'react';
import Modal from '../../components/modals/Modal';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { AlertTriangle, AlertCircle } from 'lucide-react';

interface LeadLossModalProps {
  leadId: string;
  leadName: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const MOTIVOS_PERDA = [
  'Preço / Orçamento',
  'Concorrente',
  'Sem interesse / Momento inadequado',
  'Contato sem retorno / Desistência',
  'Fora do perfil / Escopo não atendido',
  'Outros'
];

export const LeadLossModal: React.FC<LeadLossModalProps> = ({
  leadId,
  leadName,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [motivo, setMotivo] = useState(MOTIVOS_PERDA[0]);
  const [detalhes, setDetalhes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motivo) {
      setErrorMessage('Selecione o motivo da perda.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await api.post(`/leads/${leadId}/loss`, {
        motivo_perda: motivo,
        detalhes_perda: detalhes.trim() || null
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Erro ao marcar lead como perdido:', err);
      const detail = err.response?.data?.detail || 'Ocorreu um erro ao marcar como perdido.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Perda do Lead"
      description="Informe o motivo pelo qual este contato não teve continuidade comercial."
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMessage && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-rose-600 dark:text-rose-400 text-xs">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-0.5">Encerrar Atendimento: {leadName}</span>
            <p className="text-text-secondary">
              O Lead sairá do fluxo ativo de atendimento, mas todo o histórico e andamentos permanecerão arquivados para consulta e auditoria.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Motivo da Perda <span className="text-rose-500">*</span>
          </label>
          <select
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
          >
            {MOTIVOS_PERDA.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">
            Detalhes / Justificativa Complementar
          </label>
          <textarea
            rows={3}
            placeholder="Descreva o que houve ou detalhes da recusa/desistência..."
            value={detalhes}
            onChange={(e) => setDetalhes(e.target.value)}
            className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary resize-none"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border-subtle">
          <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button variant="primary" type="submit" disabled={isSubmitting} className="bg-rose-600 hover:bg-rose-700 text-white">
            {isSubmitting ? 'Registrando...' : 'Confirmar Perda'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
