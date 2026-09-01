import React, { useState, useEffect } from 'react';
import Modal from '../../components/modals/Modal';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import { Users, ArrowUp, ArrowDown, Check, X, RefreshCw } from 'lucide-react';

interface LeadQueueModalProps {
  salesTeamId: string;
  salesTeamName: string;
  isOpen: boolean;
  onClose: () => void;
}

export const LeadQueueModal: React.FC<LeadQueueModalProps> = ({
  salesTeamId,
  salesTeamName,
  isOpen,
  onClose
}) => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (isOpen && salesTeamId) {
      loadQueue();
    }
  }, [isOpen, salesTeamId]);

  const loadQueue = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/leads/queue/${salesTeamId}`);
      setMembers(data || []);
      setHasChanges(false);
    } catch (err) {
      console.error('Erro ao carregar fila de distribuição:', err);
    } finally {
      setLoading(false);
    }
  };

  const moveMember = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= members.length) return;

    const newMembers = [...members];
    const temp = newMembers[index];
    newMembers[index] = newMembers[targetIndex];
    newMembers[targetIndex] = temp;

    // update ordem_posicao locally
    newMembers.forEach((m, idx) => {
      m.ordem_posicao = idx + 1;
    });

    setMembers(newMembers);
    setHasChanges(true);
  };

  const handleToggleActive = async (memberId: string, currentActive: boolean) => {
    try {
      await api.put(`/leads/queue/members/${memberId}/toggle-active`, {
        ativo: !currentActive
      });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, ativo: !currentActive } : m));
    } catch (err) {
      console.error('Erro ao alternar status do membro:', err);
    }
  };

  const handleSaveOrder = async () => {
    try {
      setSaving(true);
      const memberIds = members.map(m => m.id);
      await api.put(`/leads/queue/${salesTeamId}/order`, {
        member_ids_in_order: memberIds
      });
      setHasChanges(false);
      loadQueue();
    } catch (err) {
      console.error('Erro ao salvar ordem da fila:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Fila de Distribuição Round Robin: ${salesTeamName}`}
      description="Gerencie a ordem e a disponibilidade dos consultores para recebimento automático de leads."
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="p-3 bg-bg-deep rounded-xl border border-border-subtle flex items-start gap-2.5 text-xs text-text-secondary">
          <Users className="w-4 h-4 text-brand-primary shrink-0 mt-0.5" />
          <p>
            O próximo lead orgânico da equipe será atribuído ao primeiro consultor <strong>ativo</strong> no topo da lista. Ao receber a vez, ele é movido para o final da fila.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-text-muted">Carregando fila da equipe...</div>
        ) : members.length === 0 ? (
          <div className="p-8 text-center text-text-muted">
            Nenhum consultor com cargo Vendedor vinculado a esta equipe de vendas.
          </div>
        ) : (
          <div className="divide-y divide-border-subtle border border-border-subtle rounded-xl overflow-hidden bg-bg-surface">
            {members.map((m, idx) => (
              <div
                key={m.id}
                className={`p-3.5 flex items-center justify-between gap-3 transition-colors ${
                  !m.ativo ? 'opacity-50 bg-bg-deep/40' : 'hover:bg-bg-deep/20'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-brand-primary/10 text-brand-primary text-xs font-bold flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <span className="font-semibold text-sm text-text-primary block">
                      {m.user_name}
                    </span>
                    <span className="text-xs text-text-muted">
                      {m.user_email} • {m.ativo ? 'Disponível na Fila' : 'Pausado (Férias/Licença)'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggleActive(m.id, m.ativo)}
                    className={m.ativo ? 'text-emerald-500 hover:text-emerald-600' : 'text-text-muted'}
                    title={m.ativo ? 'Desativar da Fila' : 'Ativar na Fila'}
                  >
                    {m.ativo ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={idx === 0}
                    onClick={() => moveMember(idx, 'up')}
                    title="Mover para cima"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={idx === members.length - 1}
                    onClick={() => moveMember(idx, 'down')}
                    title="Mover para baixo"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
          <Button variant="ghost" size="sm" onClick={loadQueue} disabled={loading}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Recarregar
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            {hasChanges && (
              <Button variant="primary" onClick={handleSaveOrder} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Nova Ordem'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
