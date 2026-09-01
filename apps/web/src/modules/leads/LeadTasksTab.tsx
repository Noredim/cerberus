import React, { useState } from 'react';
import { Button } from '../../components/ui/Button';
import Modal from '../../components/modals/Modal';
import { api } from '../../services/api';
import {
  Calendar, Plus, ShieldAlert, Phone, Users,
  Mail, MessageSquare, MapPin, Check, CheckSquare, Square
} from 'lucide-react';

interface LeadTasksTabProps {
  leadId: string;
  leadEmail?: string;
  tasks: any[];
  temCnpj: boolean;
  onSuccess: () => void;
}

const TASK_TYPES = [
  { value: 'LIGACAO', label: 'Ligação Telefônica', icon: Phone },
  { value: 'WHATSAPP', label: 'Contato WhatsApp', icon: MessageSquare },
  { value: 'REUNIAO_ONLINE', label: 'Reunião Online', icon: Users },
  { value: 'REUNIAO_PRESENCIAL', label: 'Reunião Presencial', icon: MapPin },
  { value: 'EMAIL', label: 'Envio de E-mail', icon: Mail },
  { value: 'VISITA', label: 'Visita Comercial', icon: MapPin },
  { value: 'OUTRO', label: 'Outro Follow-up', icon: Calendar },
];

const TIMEZONES = [
  { value: 'America/Manaus', label: 'Manaus / RO / RR / AM (GMT-4)' },
  { value: 'America/Cuiaba', label: 'Cuiabá / MT / MS (GMT-4)' },
  { value: 'America/Sao_Paulo', label: 'Brasília / SP / RJ / Sul / NE (GMT-3)' },
  { value: 'America/Belem', label: 'Belém / PA / AP (GMT-3)' },
  { value: 'America/Fortaleza', label: 'Fortaleza / CE / MA / PI (GMT-3)' },
  { value: 'America/Recife', label: 'Recife / PE / PB / RN / AL (GMT-3)' },
  { value: 'America/Rio_Branco', label: 'Rio Branco / Acre (GMT-5)' },
  { value: 'America/Noronha', label: 'Fernando de Noronha (GMT-2)' },
];

const getBrowserTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Manaus';
  } catch {
    return 'America/Manaus';
  }
};

const getSuggestedFutureTime = () => {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  const minutes = now.getMinutes();
  const rounded = Math.ceil(minutes / 15) * 15;
  if (rounded >= 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  } else {
    now.setMinutes(rounded);
  }
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
};

export const LeadTasksTab: React.FC<LeadTasksTabProps> = ({
  leadId,
  leadEmail,
  tasks,
  temCnpj,
  onSuccess
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);

  // Form State for New Task
  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState('LIGACAO');
  const [dataAgendamento, setDataAgendamento] = useState('');
  const [horaInicio, setHoraInicio] = useState(getSuggestedFutureTime());
  const [fusoHorario, setFusoHorario] = useState(getBrowserTimezone());
  const [participantes, setParticipantes] = useState('');
  const [retroativo, setRetroativo] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State for Complete Task
  const [resultado, setResultado] = useState('');

  const handleOpenNewTask = () => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');

    setTitulo('');
    setDescricao('');
    setTipo('LIGACAO');
    setDataAgendamento(`${yyyy}-${mm}-${dd}`);
    setHoraInicio(getSuggestedFutureTime());
    setFusoHorario(getBrowserTimezone());
    setRetroativo(false);
    setParticipantes(leadEmail || '');
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim() || !dataAgendamento) return;

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const selectedDateTime = new Date(`${dataAgendamento}T${horaInicio || '00:00'}:00`);
      if (!retroativo && selectedDateTime.getTime() < Date.now() - 5 * 60 * 1000) {
        setErrorMessage("A data e horário devem ser futuros. Para registrar atividades passadas, marque a opção 'Lançamento Retroativo'.");
        setIsSubmitting(false);
        return;
      }

      await api.post(`/leads/${leadId}/tasks`, {
        titulo: titulo.trim(),
        descricao: descricao.trim() || null,
        tipo,
        data_agendamento: selectedDateTime.toISOString(),
        hora_inicio: horaInicio,
        fuso_horario: fusoHorario,
        participantes: participantes.trim() || null,
        retroativo
      });

      setIsModalOpen(false);
      onSuccess();
    } catch (err: any) {
      console.error('Erro ao criar tarefa:', err);
      const detail = err.response?.data?.detail || 'Erro ao agendar tarefa.';
      setErrorMessage(detail);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask) return;

    try {
      setIsSubmitting(true);
      await api.put(`/leads/tasks/${selectedTask.id}`, {
        concluida: true,
        resultado: resultado.trim() || null
      });
      setCompleteModalOpen(false);
      setSelectedTask(null);
      setResultado('');
      onSuccess();
    } catch (err: any) {
      console.error('Erro ao concluir tarefa:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-text-primary flex items-center gap-2">
            <Calendar className="w-4 h-4 text-brand-primary" />
            Tarefas e Agendamentos de Follow-up ({tasks.length})
          </h3>
          <p className="text-xs text-text-muted mt-0.5">
            Organize contatos, reuniões e próximos passos comerciais vinculados a este lead.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenNewTask}
          disabled={!temCnpj}
          title={!temCnpj ? 'Preencha o CNPJ para agendar tarefas' : 'Agendar Nova Tarefa'}
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Nova Tarefa
        </Button>
      </div>

      {!temCnpj && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-3 text-amber-600 dark:text-amber-400 text-xs">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm mb-0.5">CNPJ / CPF Obrigatório para Agendamentos</span>
            <p>
              Para criar e agendar tarefas neste Lead, complete o cadastro informando o <strong>CNPJ ou CPF do cliente</strong> no painel lateral.
            </p>
          </div>
        </div>
      )}

      {/* Lista de Tarefas */}
      {tasks.length === 0 ? (
        <div className="p-10 text-center text-text-muted text-sm border border-dashed border-border-subtle rounded-xl">
          Nenhuma tarefa ou follow-up agendado para este lead.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const isDone = task.concluida;
            const dateStr = new Date(task.data_agendamento).toLocaleDateString('pt-BR');

            return (
              <div
                key={task.id}
                className={`p-4 bg-bg-surface border rounded-xl transition-all shadow-xs ${
                  isDone
                    ? 'border-border-subtle opacity-60 bg-bg-deep/20'
                    : 'border-border-subtle hover:border-brand-primary/40'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isDone) {
                          setSelectedTask(task);
                          setResultado('');
                          setCompleteModalOpen(true);
                        }
                      }}
                      className={`mt-0.5 transition-colors ${
                        isDone
                          ? 'text-emerald-500 cursor-default'
                          : 'text-text-muted hover:text-emerald-500 cursor-pointer'
                      }`}
                      title={isDone ? 'Tarefa Concluída' : 'Marcar como Concluída'}
                    >
                      {isDone ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-semibold ${isDone ? 'line-through text-text-muted' : 'text-text-primary'}`}>
                          {task.titulo}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-brand-primary/10 text-brand-primary">
                          {task.tipo}
                        </span>
                      </div>

                      {task.descricao && (
                        <p className="text-xs text-text-secondary mt-1">
                          {task.descricao}
                        </p>
                      )}

                      {task.resultado && (
                        <div className="mt-2 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-600 dark:text-emerald-400">
                          <strong>Resultado:</strong> {task.resultado}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-text-muted">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {dateStr} {task.hora_inicio ? `às ${task.hora_inicio}` : ''}
                          {task.fuso_horario && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-bg-deep text-text-muted border border-border-subtle font-medium ml-1">
                              {task.fuso_horario.split('/')[1]?.replace(/_/g, ' ') || task.fuso_horario}
                            </span>
                          )}
                        </span>
                        <span>• Responsável: <strong>{task.user_name || 'Vendedor'}</strong></span>
                        {task.participantes && (
                          <span className="flex items-center gap-1 text-text-secondary" title={task.participantes}>
                            <Mail className="w-3 h-3 text-brand-primary" />
                            <strong>Convidados:</strong> {task.participantes}
                          </span>
                        )}
                        {task.retroativo && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold text-[10px]">
                            Lançamento Retroativo
                          </span>
                        )}
                        {!task.retroativo && task.google_sync_status === 'SYNCED' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/10 text-blue-500 font-semibold text-[10px]">
                            <svg className="w-3 h-3" viewBox="0 0 24 24">
                              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                            </svg>
                            Google Calendar Sincronizado
                          </span>
                        )}
                        {!task.retroativo && task.google_sync_status === 'FAILED' && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-rose-500/10 text-rose-500 font-semibold text-[10px]">
                            Erro ao sincronizar Google
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {!isDone && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTask(task);
                        setResultado('');
                        setCompleteModalOpen(true);
                      }}
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Concluir
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nova Tarefa */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={retroativo ? "Registrar Atividade Retroativa" : "Agendar Nova Tarefa Comercial"}
        description={retroativo ? "Registre uma atividade que já foi realizada no passado (sem criar evento no Google)." : "Defina uma data e atividade de acompanhamento futuro para este lead."}
        maxWidth="md"
      >
        <form onSubmit={handleCreateTask} className="space-y-3">
          {errorMessage && (
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-500 text-xs">
              {errorMessage}
            </div>
          )}

          {/* Opção de Lançamento Retroativo */}
          <div className="p-2.5 bg-bg-surface-hover/60 border border-border-subtle rounded-xl flex items-start gap-2.5">
            <input
              type="checkbox"
              id="retroativo-checkbox"
              checked={retroativo}
              onChange={(e) => setRetroativo(e.target.checked)}
              className="mt-0.5 w-4 h-4 text-brand-primary rounded border-border-subtle focus:ring-brand-primary cursor-pointer"
            />
            <label htmlFor="retroativo-checkbox" className="cursor-pointer select-none text-xs">
              <span className="font-semibold text-text-primary block">Lançamento Retroativo (Histórico Passado)</span>
              <span className="text-text-muted text-[11px] block mt-0.5">
                Marque caso esta atividade já tenha ocorrido no passado. <strong>Não criará evento nem enviará convites no Google Calendar.</strong>
              </span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Título da Tarefa <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ex: Ligar para confirmar recebimento da proposta"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Tipo de Atividade
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              >
                {TASK_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Data do Agendamento <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={dataAgendamento}
                onChange={(e) => setDataAgendamento(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Horário Previsto
              </label>
              <input
                type="time"
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1 flex items-center justify-between">
                <span>Fuso Horário</span>
                <span className="text-[10px] text-brand-primary font-normal">Detectado</span>
              </label>
              <select
                value={fusoHorario}
                onChange={(e) => setFusoHorario(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-xs focus:outline-none focus:border-brand-primary truncate"
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
                {!TIMEZONES.some(tz => tz.value === fusoHorario) && (
                  <option value={fusoHorario}>{fusoHorario}</option>
                )}
              </select>
            </div>
          </div>

          {!retroativo && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-text-primary flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-brand-primary" />
                  E-mails dos Participantes (Convite Google Calendar)
                </label>
                <span className="text-[10px] text-text-muted">Separados por vírgula</span>
              </div>
              <input
                type="text"
                placeholder="ex: contato@empresa.com, outro@empresa.com"
                value={participantes}
                onChange={(e) => setParticipantes(e.target.value)}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
              <p className="text-[11px] text-text-muted mt-1">
                O Google Calendar enviará automaticamente o convite por e-mail com link do Google Meet/Agenda para todos os participantes informados.
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Detalhes / Orientações
            </label>
            <textarea
              rows={2}
              placeholder="Assunto da reunião, tópicos a tratar..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : (retroativo ? 'Registrar Atividade' : 'Agendar Tarefa')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Concluir Tarefa */}
      <Modal
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        title="Concluir Tarefa"
        description={`Registrar a conclusão da atividade "${selectedTask?.titulo}".`}
        maxWidth="md"
      >
        <form onSubmit={handleCompleteTask} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Resultado / Resumo do Contato
            </label>
            <textarea
              rows={3}
              placeholder="Descreva o desfecho da conversa, se o cliente atendeu, dúvidas levantadas..."
              value={resultado}
              onChange={(e) => setResultado(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" type="button" onClick={() => setCompleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {isSubmitting ? 'Salvando...' : 'Confirmar Conclusão'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
