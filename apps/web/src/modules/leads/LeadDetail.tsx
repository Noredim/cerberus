import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { LeadConversionModal } from './LeadConversionModal';
import { LeadLossModal } from './LeadLossModal';
import { LeadTimelineTab } from './LeadTimelineTab';
import { LeadTasksTab } from './LeadTasksTab';
import Modal from '../../components/modals/Modal';
import {
  ArrowLeft, CheckCircle, XCircle, Sparkles, AlertTriangle, Clock,
  Building2, Phone, Mail, User, Tag, Users, Edit3,
  ExternalLink
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NOVO: { label: 'Novo Lead', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/30' },
  AGUARDANDO_ACEITE: { label: 'Aguardando Aceite', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30' },
  ASSUMIDO: { label: 'Assumido', color: 'text-indigo-500', bg: 'bg-indigo-500/10 border-indigo-500/30' },
  EM_ATENDIMENTO: { label: 'Em Atendimento', color: 'text-cyan-500', bg: 'bg-cyan-500/10 border-cyan-500/30' },
  QUALIFICADO: { label: 'Qualificado', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  CONVERTIDO: { label: 'Convertido em Oportunidade', color: 'text-emerald-600 font-bold', bg: 'bg-emerald-500/15 border-emerald-500/40' },
  PERDIDO: { label: 'Perdido', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/30' },
};

export const LeadDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [lead, setLead] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'tasks' | 'distribuicao'>('timeline');

  // Modais
  const [conversionModalOpen, setConversionModalOpen] = useState(false);
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Edit Modal
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    nome_contato: '',
    razao_social: '',
    cpf_cnpj: '',
    email: '',
    telefone: '',
    cargo_contato: '',
    origem: '',
    canal: '',
    observacoes: ''
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const fetchLead = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const { data } = await api.get(`/leads/${id}`);
      setLead(data);
    } catch (err) {
      console.error('Erro ao buscar detalhes do lead:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLead();
  }, [fetchLead]);

  const handleAccept = async () => {
    if (!lead) return;
    try {
      await api.post(`/leads/${lead.id}/accept`);
      fetchLead();
    } catch (err) {
      console.error('Erro ao aceitar lead:', err);
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    try {
      setIsRejecting(true);
      await api.post(`/leads/${lead.id}/reject`, { motivo_recusa: motivoRecusa.trim() || null });
      setRejectModalOpen(false);
      setMotivoRecusa('');
      fetchLead();
    } catch (err) {
      console.error('Erro ao recusar lead:', err);
    } finally {
      setIsRejecting(false);
    }
  };

  const handleOpenEdit = () => {
    if (!lead) return;
    setEditForm({
      nome_contato: lead.nome_contato || '',
      razao_social: lead.razao_social || '',
      cpf_cnpj: lead.cpf_cnpj || '',
      email: lead.email || '',
      telefone: lead.telefone || '',
      cargo_contato: lead.cargo_contato || '',
      origem: lead.origem || 'LIGACAO',
      canal: lead.canal || '',
      observacoes: lead.observacoes || ''
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    try {
      setIsSavingEdit(true);
      await api.put(`/leads/${lead.id}`, editForm);
      setEditModalOpen(false);
      fetchLead();
    } catch (err) {
      console.error('Erro ao salvar alterações:', err);
    } finally {
      setIsSavingEdit(false);
    }
  };

  const formatSeconds = (sec?: number | null) => {
    if (!sec || sec <= 0) return 'Expirado';
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${hours}h ${minutes}m restantes`;
  };

  if (loading) {
    return <div className="p-12 text-center text-text-muted">Carregando detalhes do lead...</div>;
  }

  if (!lead) {
    return (
      <div className="p-12 text-center text-text-muted">
        Lead não encontrado.
        <Button variant="outline" size="sm" onClick={() => navigate('/comercial/leads')} className="mt-4 block mx-auto">
          Voltar para Lista
        </Button>
      </div>
    );
  }

  const statusInfo = STATUS_CONFIG[lead.status] || { label: lead.status, color: 'text-text-muted', bg: 'bg-bg-deep border-border-subtle' };
  const isAwaitingAccept = lead.status === 'AGUARDANDO_ACEITE';
  const isAssignedToMe = lead.vendedor_atribuido_id === user?.id;
  const isConverted = lead.status === 'CONVERTIDO';
  const isLost = lead.status === 'PERDIDO';
  const isActive = !isConverted && !isLost;

  return (
    <div className="space-y-6">
      {/* Top Header Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/comercial/leads')}>
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-text-primary tracking-tight">
                {lead.nome_contato}
              </h1>
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusInfo.bg} ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
            <p className="text-xs text-text-muted mt-0.5">
              {lead.razao_social ? `${lead.razao_social} • ` : ''}Origem: <strong>{lead.origem}</strong> ({lead.canal || 'Geral'})
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {isAwaitingAccept && isAssignedToMe && (
            <>
              <Button variant="primary" onClick={handleAccept} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <CheckCircle className="w-4 h-4 mr-1.5" />
                Aceitar Lead
              </Button>
              <Button variant="outline" onClick={() => setRejectModalOpen(true)} className="text-rose-500 hover:text-rose-600">
                <XCircle className="w-4 h-4 mr-1.5" />
                Recusar Lead
              </Button>
            </>
          )}

          {isActive && (
            <>
              <Button variant="primary" onClick={() => setConversionModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                <Sparkles className="w-4 h-4 mr-1.5" />
                Converter em Oportunidade
              </Button>
              <Button variant="outline" onClick={() => setLossModalOpen(true)} className="text-rose-500 hover:text-rose-600">
                <AlertTriangle className="w-4 h-4 mr-1.5" />
                Marcar como Perdido
              </Button>
            </>
          )}

          <Button variant="outline" size="sm" onClick={handleOpenEdit}>
            <Edit3 className="w-3.5 h-3.5 mr-1" />
            Editar Cadastro
          </Button>
        </div>
      </div>

      {/* Banner de Status Especial */}
      {isAwaitingAccept && lead.tempo_restante_aceite_segundos !== null && (
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400 text-xs font-medium">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 shrink-0 animate-pulse" />
            <span>
              Este lead está aguardando aceite do consultor <strong>{lead.vendedor_atribuido_nome || 'Designado'}</strong>.
            </span>
          </div>
          <span className="font-bold px-2 py-0.5 rounded-md bg-amber-500/20">
            {formatSeconds(lead.tempo_restante_aceite_segundos)}
          </span>
        </div>
      )}

      {isConverted && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between gap-3 text-emerald-600 dark:text-emerald-400 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>
              Lead qualificado e convertido na Oportunidade <strong>Nº {lead.sales_budget_numero}</strong>.
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate('/orcamentos-vendas')}>
            <ExternalLink className="w-3.5 h-3.5 mr-1" />
            Ver Oportunidade
          </Button>
        </div>
      )}

      {isLost && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-start gap-2 text-rose-600 dark:text-rose-400 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-sm">Lead Marcado como Perdido: {lead.motivo_perda}</span>
            {lead.detalhes_perda && <p className="text-text-secondary mt-0.5">{lead.detalhes_perda}</p>}
          </div>
        </div>
      )}

      {/* Main Grid: Left Info Column + Right Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Info Cards */}
        <div className="space-y-4">
          {/* Card CNPJ Status */}
          <div className={`p-4 rounded-xl border ${lead.tem_cnpj ? 'bg-bg-surface border-border-subtle' : 'bg-amber-500/5 border-amber-500/30'}`}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Documento / CNPJ
              </span>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                lead.tem_cnpj ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
              }`}>
                {lead.tem_cnpj ? 'CNPJ Preenchido' : 'Pendente'}
              </span>
            </div>

            {lead.tem_cnpj ? (
              <div className="font-mono font-bold text-sm text-text-primary">
                {lead.cpf_cnpj}
              </div>
            ) : (
              <div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2">
                  Necessário preencher CNPJ/CPF para registrar andamentos ou tarefas.
                </p>
                <Button variant="outline" size="sm" onClick={handleOpenEdit} className="w-full text-xs">
                  Preencher CNPJ Agora
                </Button>
              </div>
            )}
          </div>

          {/* Card Contato e Dados */}
          <div className="p-4 bg-bg-surface border border-border-subtle rounded-xl shadow-xs space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Dados do Interessado
            </h3>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-text-secondary">
                <User className="w-3.5 h-3.5 text-text-muted" />
                <span>Contato: <strong>{lead.nome_contato}</strong> {lead.cargo_contato ? `(${lead.cargo_contato})` : ''}</span>
              </div>

              {lead.razao_social && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Building2 className="w-3.5 h-3.5 text-text-muted" />
                  <span>Empresa: <strong>{lead.razao_social}</strong></span>
                </div>
              )}

              {lead.telefone && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Phone className="w-3.5 h-3.5 text-text-muted" />
                  <span>Tel: <strong>{lead.telefone}</strong></span>
                </div>
              )}

              {lead.email && (
                <div className="flex items-center gap-2 text-text-secondary">
                  <Mail className="w-3.5 h-3.5 text-text-muted" />
                  <span>E-mail: <strong>{lead.email}</strong></span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-border-subtle space-y-2 text-xs">
              <div className="flex items-center gap-2 text-text-secondary">
                <Users className="w-3.5 h-3.5 text-text-muted" />
                <span>Equipe: <strong>{lead.sales_team_nome || 'Geral'}</strong></span>
              </div>

              <div className="flex items-center gap-2 text-text-secondary">
                <Tag className="w-3.5 h-3.5 text-text-muted" />
                <span>Distribuição: <strong>{lead.tipo_distribuicao}</strong></span>
              </div>

              <div className="flex items-center gap-2 text-text-secondary">
                <User className="w-3.5 h-3.5 text-text-muted" />
                <span>Responsável: <strong>{lead.vendedor_responsavel_nome || lead.vendedor_atribuido_nome || 'Aguardando'}</strong></span>
              </div>
            </div>

            {lead.observacoes && (
              <div className="pt-3 border-t border-border-subtle">
                <span className="text-[11px] font-semibold text-text-muted block mb-1">Observações Iniciais:</span>
                <p className="text-xs text-text-secondary whitespace-pre-line bg-bg-deep p-2 rounded-lg">
                  {lead.observacoes}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Tabs Navigation & Content */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
            <button
              onClick={() => setActiveTab('timeline')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'timeline'
                  ? 'bg-brand-primary text-white'
                  : 'text-text-secondary hover:bg-bg-deep'
              }`}
            >
              Linha do Tempo / Andamentos
            </button>
            <button
              onClick={() => setActiveTab('tasks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                activeTab === 'tasks'
                  ? 'bg-brand-primary text-white'
                  : 'text-text-secondary hover:bg-bg-deep'
              }`}
            >
              <span>Tarefas & Agenda</span>
              {lead.tasks?.length > 0 && (
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-white/20 font-bold">
                  {lead.tasks.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('distribuicao')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === 'distribuicao'
                  ? 'bg-brand-primary text-white'
                  : 'text-text-secondary hover:bg-bg-deep'
              }`}
            >
              Auditoria de Fila ({lead.distribution_history?.length || 0})
            </button>
          </div>

          {activeTab === 'timeline' && (
            <LeadTimelineTab
              leadId={lead.id}
              timeline={lead.timeline || []}
              temCnpj={lead.tem_cnpj}
              onAddSuccess={fetchLead}
            />
          )}

          {activeTab === 'tasks' && (
            <LeadTasksTab
              leadId={lead.id}
              leadEmail={lead.email}
              tasks={lead.tasks || []}
              temCnpj={lead.tem_cnpj}
              onSuccess={fetchLead}
            />
          )}

          {activeTab === 'distribuicao' && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Histórico de Tentativas e Atribuições
              </h3>
              {lead.distribution_history?.length === 0 ? (
                <div className="p-8 text-center text-text-muted text-sm border border-dashed border-border-subtle rounded-xl">
                  Nenhum registro de distribuição na fila.
                </div>
              ) : (
                <div className="overflow-x-auto border border-border-subtle rounded-xl bg-bg-surface">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-bg-deep text-text-muted border-b border-border-subtle">
                      <tr>
                        <th className="px-3 py-2">Tentativa</th>
                        <th className="px-3 py-2">Consultor</th>
                        <th className="px-3 py-2">Tipo</th>
                        <th className="px-3 py-2">Atribuído Em</th>
                        <th className="px-3 py-2">Resposta</th>
                        <th className="px-3 py-2">Resultado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {lead.distribution_history.map((h: any) => (
                        <tr key={h.id} className="hover:bg-bg-deep/20">
                          <td className="px-3 py-2.5 font-bold">#{h.tentativa_numero}</td>
                          <td className="px-3 py-2.5 font-semibold text-text-primary">{h.vendedor_name}</td>
                          <td className="px-3 py-2.5">{h.tipo_atribuicao}</td>
                          <td className="px-3 py-2.5 text-text-muted">
                            {new Date(h.data_atribuicao).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-3 py-2.5 text-text-muted">
                            {h.data_resposta ? new Date(h.data_resposta).toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-bg-deep border border-border-subtle">
                              {h.resultado}
                            </span>
                            {h.motivo_recusa && (
                              <span className="block text-[10px] text-text-muted mt-0.5">
                                Motivo: {h.motivo_recusa}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modais */}
      <LeadConversionModal
        lead={lead}
        isOpen={conversionModalOpen}
        onClose={() => setConversionModalOpen(false)}
        onSuccess={() => {
          fetchLead();
          navigate(`/orcamentos-vendas`);
        }}
      />

      <LeadLossModal
        leadId={lead.id}
        leadName={lead.nome_contato}
        isOpen={lossModalOpen}
        onClose={() => setLossModalOpen(false)}
        onSuccess={fetchLead}
      />

      {/* Modal de Recusa */}
      <Modal
        isOpen={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title="Recusar Lead"
        description="Ao recusar o lead, ele será encaminhado automaticamente para o próximo consultor elegível da fila."
        maxWidth="md"
      >
        <form onSubmit={handleReject} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Motivo da Recusa (Opcional)
            </label>
            <textarea
              rows={3}
              placeholder="Ex: Agenda cheia no momento, fora da minha região..."
              value={motivoRecusa}
              onChange={(e) => setMotivoRecusa(e.target.value)}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" type="button" onClick={() => setRejectModalOpen(false)} disabled={isRejecting}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isRejecting} className="bg-rose-600 hover:bg-rose-700 text-white">
              {isRejecting ? 'Recusando...' : 'Confirmar Recusa'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal de Edição de Cadastro */}
      <Modal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        title="Editar Cadastro do Lead"
        description="Atualize as informações cadastrais e de contato do cliente."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveEdit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">Nome do Contato</label>
              <input
                type="text"
                required
                value={editForm.nome_contato}
                onChange={(e) => setEditForm({ ...editForm, nome_contato: e.target.value })}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">Razão Social / Empresa</label>
              <input
                type="text"
                value={editForm.razao_social}
                onChange={(e) => setEditForm({ ...editForm, razao_social: e.target.value })}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">CNPJ ou CPF</label>
              <input
                type="text"
                placeholder="00.000.000/0000-00"
                value={editForm.cpf_cnpj}
                onChange={(e) => setEditForm({ ...editForm, cpf_cnpj: e.target.value })}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">Cargo do Contato</label>
              <input
                type="text"
                value={editForm.cargo_contato}
                onChange={(e) => setEditForm({ ...editForm, cargo_contato: e.target.value })}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">Telefone</label>
              <input
                type="text"
                value={editForm.telefone}
                onChange={(e) => setEditForm({ ...editForm, telefone: e.target.value })}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">E-mail</label>
              <input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">Observações</label>
            <textarea
              rows={2}
              value={editForm.observacoes}
              onChange={(e) => setEditForm({ ...editForm, observacoes: e.target.value })}
              className="w-full px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
            <Button variant="outline" type="button" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" disabled={isSavingEdit}>
              {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
