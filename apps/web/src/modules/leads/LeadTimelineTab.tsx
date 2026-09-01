import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { api } from '../../services/api';
import {
  MessageSquare, CheckCircle, XCircle, AlertTriangle,
  Clock, Calendar, UserCheck, ShieldAlert, Sparkles, Send
} from 'lucide-react';

interface LeadTimelineTabProps {
  leadId: string;
  timeline: any[];
  temCnpj: boolean;
  onAddSuccess: () => void;
}

const getEventIcon = (type: string) => {
  switch (type) {
    case 'CRIACAO':
      return <Sparkles className="w-4 h-4 text-brand-primary" />;
    case 'ATRIBUICAO':
      return <UserCheck className="w-4 h-4 text-blue-500" />;
    case 'ACEITE':
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case 'RECUSA':
      return <XCircle className="w-4 h-4 text-rose-500" />;
    case 'TIMEOUT':
      return <Clock className="w-4 h-4 text-amber-500" />;
    case 'TAREFA_CRIADA':
    case 'TAREFA_CONCLUIDA':
      return <Calendar className="w-4 h-4 text-indigo-500" />;
    case 'CONVERSAO':
      return <CheckCircle className="w-4 h-4 text-emerald-600" />;
    case 'PERDA':
      return <AlertTriangle className="w-4 h-4 text-rose-600" />;
    default:
      return <MessageSquare className="w-4 h-4 text-text-muted" />;
  }
};

export const LeadTimelineTab: React.FC<LeadTimelineTabProps> = ({
  leadId,
  timeline,
  temCnpj,
  onAddSuccess
}) => {
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAddAndamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);
      await api.post(`/leads/${leadId}/timeline`, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        tipo_evento: 'ANDAMENTO'
      });
      setTitulo('');
      setDescricao('');
      onAddSuccess();
    } catch (err: any) {
      console.error('Erro ao adicionar andamento:', err);
      const detail = err.response?.data?.detail || 'Erro ao registrar andamento.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* Formulário de Novo Andamento */}
      <div className="p-4 bg-bg-surface border border-border-subtle rounded-xl shadow-xs">
        <h3 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-brand-primary" />
          Registrar Novo Andamento / Interação
        </h3>

        {!temCnpj ? (
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-600 dark:text-amber-400 text-xs">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block text-sm mb-0.5">CNPJ / CPF Obrigatório</span>
              <p>
                Para registrar andamentos e histórico neste Lead, é obrigatório preencher o cadastro informando o <strong>CNPJ ou CPF do cliente</strong> no painel de dados cadastrais.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleAddAndamento} className="space-y-3">
            {errorMessage && (
              <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-xs">
                {errorMessage}
              </div>
            )}
            <div>
              <input
                type="text"
                required
                placeholder="Título do andamento (ex: Ligação realizada, Cliente solicitou proposta...)"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div>
              <textarea
                rows={2}
                placeholder="Detalhes adicionais da conversa, retorno do cliente ou próximos passos acordados..."
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary resize-none"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" type="submit" disabled={isSubmitting || !titulo.trim()}>
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {isSubmitting ? 'Salvando...' : 'Salvar Andamento'}
              </Button>
            </div>
          </form>
        )}
      </div>

      {/* Timeline Cronológica */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
          Linha do Tempo e Histórico ({timeline.length})
        </h3>

        {timeline.length === 0 ? (
          <div className="p-8 text-center text-text-muted text-sm border border-dashed border-border-subtle rounded-xl">
            Nenhum evento ou andamento registrado até o momento.
          </div>
        ) : (
          <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border-subtle">
            {timeline.map((item) => (
              <div key={item.id} className="relative group">
                <div className="absolute -left-6 top-1.5 w-5 h-5 rounded-full bg-bg-surface border border-border-subtle flex items-center justify-center shadow-xs">
                  {getEventIcon(item.tipo_evento)}
                </div>
                <div className="p-3.5 bg-bg-surface border border-border-subtle rounded-xl hover:border-brand-primary/40 transition-colors shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                    <span className="font-semibold text-sm text-text-primary">
                      {item.titulo}
                    </span>
                    <span className="text-[11px] text-text-muted">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  {item.descricao && (
                    <p className="text-xs text-text-secondary whitespace-pre-line mt-1">
                      {item.descricao}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border-subtle/50 text-[11px] text-text-muted">
                    <span>Registrado por: <strong>{item.user_name || 'Sistema'}</strong></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
