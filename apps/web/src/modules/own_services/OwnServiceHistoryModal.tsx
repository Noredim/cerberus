import React, { useEffect, useState } from 'react';
import { History, Loader2, X, User, Calendar, Tag } from 'lucide-react';
import { api } from '../../services/api';

interface OwnServiceHistoryItem {
  id: string;
  own_service_id: string;
  user_id: string | null;
  user_name: string | null;
  user_email: string | null;
  acao: string;
  detalhes_alteracao: string;
  created_at: string;
}

interface OwnServiceHistoryModalProps {
  isOpen: boolean;
  serviceId: string | null;
  serviceName: string;
  onClose: () => void;
}

const formatDate = (isoString: string) => {
  const d = new Date(isoString);
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getBadgeStyle = (acao: string) => {
  switch (acao) {
    case 'CRIACAO':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'EDICAO':
      return 'bg-brand-primary/10 text-brand-primary border-brand-primary/20';
    case 'EXCLUSAO':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    default:
      return 'bg-gray-500/10 text-gray-600 border-gray-500/20';
  }
};

const getActionLabel = (acao: string) => {
  switch (acao) {
    case 'CRIACAO':
      return 'Criação';
    case 'EDICAO':
      return 'Edição';
    case 'EXCLUSAO':
      return 'Exclusão';
    default:
      return acao;
  }
};

export const OwnServiceHistoryModal: React.FC<OwnServiceHistoryModalProps> = ({
  isOpen,
  serviceId,
  serviceName,
  onClose,
}) => {
  const [logs, setLogs] = useState<OwnServiceHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && serviceId) {
      setLoading(true);
      api
        .get(`/own-services/${serviceId}/historico`)
        .then((res) => {
          setLogs(res.data);
        })
        .catch((err) => {
          console.error('Erro ao carregar histórico do serviço próprio:', err);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLogs([]);
    }
  }, [isOpen, serviceId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl border-none p-0 overflow-hidden bg-surface">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between bg-bg-deep">
          <div className="flex items-center gap-2.5">
            <History className="w-5 h-5 text-brand-primary" />
            <div>
              <h3 className="font-bold text-text-primary text-base">Histórico de Alterações</h3>
              <p className="text-xs text-text-muted">{serviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-surface transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-text-muted gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
              <span className="text-xs font-medium">Carregando histórico...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center text-text-muted">
              <History className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm font-medium">Nenhuma alteração registrada até o momento.</p>
            </div>
          ) : (
            <div className="relative border-l-2 border-border-subtle ml-3 pl-6 space-y-6">
              {logs.map((log) => {
                const changes = log.detalhes_alteracao.split(' | ');
                return (
                  <div key={log.id} className="relative group">
                    {/* Dot on timeline */}
                    <div className="absolute -left-[31px] top-1.5 w-3 h-3 rounded-full bg-surface border-2 border-brand-primary shadow-sm" />

                    <div className="bg-bg-deep/50 border border-border-subtle rounded-lg p-4 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle/50 pb-2">
                        <div className="flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-text-muted" />
                          <span className="text-xs font-bold text-text-primary">
                            {log.user_name || log.user_email || 'Usuário'}
                          </span>
                          {log.user_email && log.user_name && (
                            <span className="text-[11px] text-text-muted">({log.user_email})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase border ${getBadgeStyle(log.acao)}`}>
                            {getActionLabel(log.acao)}
                          </span>
                          <span className="flex items-center gap-1 text-[11px] text-text-muted font-mono">
                            <Calendar className="w-3 h-3 text-text-muted" />
                            {formatDate(log.created_at)}
                          </span>
                        </div>
                      </div>

                      <div className="text-xs text-text-secondary space-y-1">
                        {changes.map((change, idx) => (
                          <div key={idx} className="flex items-start gap-2">
                            <Tag className="w-3 h-3 text-brand-primary shrink-0 mt-0.5" />
                            <span className="leading-relaxed">{change}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border-subtle bg-bg-deep flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border-subtle bg-surface hover:bg-bg-deep text-text-primary text-xs font-semibold rounded-md transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
