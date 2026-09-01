import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { LeadFormModal } from './LeadFormModal';
import { LeadQueueModal } from './LeadQueueModal';
import {
  Plus, Search, Users, Clock, Sparkles,
  ArrowUpDown, X, CheckCircle, Phone,
  Building2, Eye, RefreshCw
} from 'lucide-react';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NOVO: { label: 'Novo Lead', color: 'text-blue-500', bg: 'bg-blue-500/10 border-blue-500/30' },
  AGUARDANDO_ACEITE: { label: 'Aguardando Aceite', color: 'text-amber-500', bg: 'bg-amber-500/10 border-amber-500/30' },
  ASSUMIDO: { label: 'Assumido', color: 'text-indigo-500', bg: 'bg-indigo-500/10 border-indigo-500/30' },
  EM_ATENDIMENTO: { label: 'Em Atendimento', color: 'text-cyan-500', bg: 'bg-cyan-500/10 border-cyan-500/30' },
  QUALIFICADO: { label: 'Qualificado', color: 'text-emerald-500', bg: 'bg-emerald-500/10 border-emerald-500/30' },
  CONVERTIDO: { label: 'Convertido', color: 'text-emerald-600 font-bold', bg: 'bg-emerald-500/15 border-emerald-500/40' },
  PERDIDO: { label: 'Perdido', color: 'text-rose-500', bg: 'bg-rose-500/10 border-rose-500/30' },
};

const ORIGENS = [
  { value: '', label: 'Todas as Origens' },
  { value: 'LIGACAO', label: 'Ligação' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'VISITA', label: 'Visita' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'REDES_SOCIAIS', label: 'Redes Sociais' },
  { value: 'POS_VISITA', label: 'Pós-visita' },
  { value: 'INDICACAO', label: 'Indicação' },
  { value: 'SITE', label: 'Site' },
  { value: 'OUTROS', label: 'Outros' },
];

export const LeadList: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeCompanyId } = useAuth();

  const [leads, setLeads] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any | null>(null);
  const [salesTeams, setSalesTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters State
  const [activeTab, setActiveTab] = useState<'meus' | 'aguardando' | 'equipe' | 'todos'>('meus');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [origemFilter, setOrigemFilter] = useState('');
  const [teamFilter, setTeamFilter] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<string>('updated_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isQueueModalOpen, setIsQueueModalOpen] = useState(false);
  const [selectedQueueTeam, setSelectedQueueTeam] = useState<{ id: string; name: string } | null>(null);

  // Check if current user is Admin, Pricing Engineer or Sales Team Manager (Gerente)
  const isManager = useMemo(() => {
    if (user?.roles?.includes('ADMIN') || user?.roles?.includes('ENGENHARIA_PRECO')) return true;
    return salesTeams.some(team =>
      team.members?.some((m: any) => m.user_id === user?.id && m.cargo === 'GERENTE')
    );
  }, [user, salesTeams]);

  const fetchMetrics = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      const { data } = await api.get('/leads/metrics');
      setMetrics(data);
    } catch (err) {
      console.error('Erro ao buscar métricas:', err);
    }
  }, [activeCompanyId]);

  const fetchSalesTeams = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      const { data } = await api.get(`/companies/${activeCompanyId}/sales-teams`);
      setSalesTeams(data || []);
    } catch (err) {
      console.error('Erro ao buscar equipes:', err);
    }
  }, [activeCompanyId]);

  const fetchLeads = useCallback(async () => {
    if (!activeCompanyId) return;
    try {
      setLoading(true);
      const params: any = {
        tab: activeTab,
        q: search.trim() || undefined,
        status: statusFilter || undefined,
        origem: origemFilter || undefined,
        sales_team_id: teamFilter || undefined,
      };

      const { data } = await api.get('/leads', { params });
      setLeads(data || []);
    } catch (err) {
      console.error('Erro ao buscar leads:', err);
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, activeTab, search, statusFilter, origemFilter, teamFilter]);

  useEffect(() => {
    if (activeCompanyId) {
      fetchMetrics();
      fetchSalesTeams();
      fetchLeads();
    }
  }, [activeCompanyId, activeTab, statusFilter, origemFilter, teamFilter, fetchLeads, fetchMetrics, fetchSalesTeams]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchLeads();
    }, 300);
    return () => clearTimeout(timer);
  }, [search, fetchLeads]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder(field === 'updated_at' ? 'desc' : 'asc');
    }
  };

  const sortedLeads = useMemo(() => {
    return [...leads].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'updated_at' || sortField === 'created_at' || sortField === 'data_atribuicao') {
        const timeA = valA ? new Date(valA).getTime() : 0;
        const timeB = valB ? new Date(valB).getTime() : 0;
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
      }

      if (typeof valA === 'string') {
        return sortOrder === 'asc' ? valA.localeCompare(valB || '') : (valB || '').localeCompare(valA);
      }

      return 0;
    });
  }, [leads, sortField, sortOrder]);

  const handleOpenQueueModal = (team: any) => {
    setSelectedQueueTeam({ id: team.id, name: team.nome });
    setIsQueueModalOpen(true);
  };

  const handleAcceptQuick = async (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.post(`/leads/${leadId}/accept`);
      fetchLeads();
      fetchMetrics();
    } catch (err) {
      console.error('Erro ao aceitar lead:', err);
    }
  };

  const formatSeconds = (sec?: number | null) => {
    if (!sec || sec <= 0) return 'Expirado';
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">
            Gestão de Leads Comerciais
          </h1>
          <p className="text-text-muted text-sm mt-1">
            Captação, distribuição por fila Round Robin, atendimento e qualificação pré-oportunidade.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {salesTeams.length > 0 && (
            <Button
              variant="outline"
              onClick={() => handleOpenQueueModal(salesTeams[0])}
              className="text-xs"
            >
              <Users className="w-3.5 h-3.5 mr-1.5" />
              Fila da Equipe
            </Button>
          )}

          <Button variant="primary" onClick={() => setIsFormModalOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Novo Lead
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 bg-bg-surface border border-border-subtle rounded-xl shadow-xs">
          <span className="text-xs text-text-muted font-medium">Total de Leads</span>
          <div className="text-xl font-bold text-text-primary mt-1">
            {metrics?.total_leads || 0}
          </div>
        </div>

        <div className="p-3.5 bg-bg-surface border border-border-subtle rounded-xl shadow-xs">
          <span className="text-xs text-amber-500 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Aguardando Aceite
          </span>
          <div className="text-xl font-bold text-amber-500 mt-1">
            {metrics?.aguardando_aceite || 0}
          </div>
        </div>

        <div className="p-3.5 bg-bg-surface border border-border-subtle rounded-xl shadow-xs">
          <span className="text-xs text-cyan-500 font-medium">Em Atendimento</span>
          <div className="text-xl font-bold text-cyan-500 mt-1">
            {metrics?.assumidos_em_atendimento || 0}
          </div>
        </div>

        <div className="p-3.5 bg-bg-surface border border-border-subtle rounded-xl shadow-xs">
          <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Convertidos
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-xl font-bold text-emerald-500">
              {metrics?.convertidos || 0}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
              ({metrics?.taxa_conversao_pct || 0}%)
            </span>
          </div>
        </div>

        <div className="p-3.5 bg-bg-surface border border-border-subtle rounded-xl shadow-xs">
          <span className="text-xs text-rose-500 font-medium">Perdidos</span>
          <div className="text-xl font-bold text-rose-500 mt-1">
            {metrics?.perdidos || 0}
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border-subtle pb-2">
        <button
          onClick={() => setActiveTab('meus')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'meus' ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-bg-deep'
          }`}
        >
          Meus Leads
        </button>

        <button
          onClick={() => setActiveTab('aguardando')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeTab === 'aguardando' ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-bg-deep'
          }`}
        >
          <span>{isManager ? 'Aguardando Aceite' : 'Aguardando Meu Aceite'}</span>
          {((isManager ? metrics?.aguardando_aceite : metrics?.meus_aguardando_aceite) || 0) > 0 && (
            <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500 text-white font-bold animate-pulse">
              {isManager ? metrics?.aguardando_aceite : metrics?.meus_aguardando_aceite}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('equipe')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'equipe' ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-bg-deep'
          }`}
        >
          Leads da Equipe
        </button>

        <button
          onClick={() => setActiveTab('todos')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            activeTab === 'todos' ? 'bg-brand-primary text-white' : 'text-text-secondary hover:bg-bg-deep'
          }`}
        >
          Todos os Leads
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar por contato, empresa, CNPJ ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 border border-border-subtle rounded-xl bg-bg-surface text-text-primary text-sm focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all shadow-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={teamFilter}
            onChange={(e) => setTeamFilter(e.target.value)}
            className="px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-xs focus:outline-none focus:border-brand-primary"
          >
            <option value="">Todas as Equipes</option>
            {salesTeams.map(t => (
              <option key={t.id} value={t.id}>{t.nome}</option>
            ))}
          </select>

          <select
            value={origemFilter}
            onChange={(e) => setOrigemFilter(e.target.value)}
            className="px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-xs focus:outline-none focus:border-brand-primary"
          >
            {ORIGENS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-border-subtle rounded-lg bg-bg-surface text-text-primary text-xs focus:outline-none focus:border-brand-primary"
          >
            <option value="">Todos os Status</option>
            <option value="NOVO">Novo Lead</option>
            <option value="AGUARDANDO_ACEITE">Aguardando Aceite</option>
            <option value="ASSUMIDO">Assumido</option>
            <option value="EM_ATENDIMENTO">Em Atendimento</option>
            <option value="QUALIFICADO">Qualificado</option>
            <option value="CONVERTIDO">Convertido</option>
            <option value="PERDIDO">Perdido</option>
          </select>

          <Button variant="ghost" size="sm" onClick={fetchLeads} title="Atualizar Lista">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-text-muted">Carregando leads comerciais...</div>
        ) : sortedLeads.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <Users className="w-12 h-12 text-text-muted opacity-40 mb-3" />
            <h3 className="text-base font-semibold text-text-primary mb-1">Nenhum lead encontrado</h3>
            <p className="text-xs text-text-muted max-w-sm mb-4">
              Não existem leads correspondentes aos filtros selecionados.
            </p>
            <Button variant="primary" size="sm" onClick={() => setIsFormModalOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Cadastrar Primeiro Lead
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-bg-deep/50 text-text-muted font-medium border-b border-border-subtle">
                <tr>
                  <th
                    className="px-4 py-3.5 cursor-pointer select-none group hover:text-text-primary"
                    onClick={() => handleSort('nome_contato')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Contato / Empresa</span>
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5">Origem / Canal</th>
                  <th className="px-4 py-3.5">Equipe</th>
                  <th className="px-4 py-3.5">Responsável</th>
                  <th
                    className="px-4 py-3.5 cursor-pointer select-none group hover:text-text-primary"
                    onClick={() => handleSort('status')}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>Status</span>
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-center">CNPJ</th>
                  <th
                    className="px-4 py-3.5 text-center cursor-pointer select-none group hover:text-text-primary"
                    onClick={() => handleSort('updated_at')}
                  >
                    <div className="flex items-center justify-center gap-1.5">
                      <span>Últ. Alteração</span>
                      <ArrowUpDown className="w-3 h-3 opacity-40" />
                    </div>
                  </th>
                  <th className="px-4 py-3.5 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {sortedLeads.map((lead) => {
                  const statusInfo = STATUS_CONFIG[lead.status] || { label: lead.status, color: 'text-text-muted', bg: 'bg-bg-deep border-border-subtle' };
                  const isAwaitingAccept = lead.status === 'AGUARDANDO_ACEITE';
                  const isAssignedToMe = lead.vendedor_atribuido_id === user?.id;

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => navigate(`/comercial/leads/${lead.id}`)}
                      className="hover:bg-bg-deep/30 transition-colors cursor-pointer"
                    >
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-sm text-text-primary block">
                          {lead.nome_contato}
                        </span>
                        {lead.razao_social && (
                          <span className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {lead.razao_social}
                          </span>
                        )}
                        {lead.telefone && (
                          <span className="text-[11px] text-text-muted flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {lead.telefone}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-text-secondary">
                        <span className="font-medium block">{lead.origem}</span>
                        {lead.canal && <span className="text-[11px] text-text-muted">{lead.canal}</span>}
                      </td>

                      <td className="px-4 py-3.5 text-text-secondary">
                        {lead.sales_team_nome || '—'}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className="font-medium text-text-primary block">
                          {lead.vendedor_responsavel_nome || lead.vendedor_atribuido_nome || 'Não atribuído'}
                        </span>
                        {isAwaitingAccept && (
                          <span className="text-[10px] text-amber-500 font-semibold flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {formatSeconds(lead.tempo_restante_aceite_segundos)}
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3.5">
                        <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full border ${statusInfo.bg} ${statusInfo.color}`}>
                          {statusInfo.label}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          lead.tem_cnpj ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {lead.tem_cnpj ? 'OK' : 'Pendente'}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-center tabular-nums text-text-muted font-mono text-[11px]">
                        {new Date(lead.updated_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {isAwaitingAccept && isAssignedToMe && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={(e) => handleAcceptQuick(lead.id, e)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-1 px-2.5"
                              title="Aceitar Lead Agora"
                            >
                              <CheckCircle className="w-3.5 h-3.5 mr-1" />
                              Aceitar
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/comercial/leads/${lead.id}`)}
                            title="Ver Detalhes do Lead"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modais */}
      <LeadFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSuccess={() => {
          fetchLeads();
          fetchMetrics();
        }}
      />

      {selectedQueueTeam && (
        <LeadQueueModal
          salesTeamId={selectedQueueTeam.id}
          salesTeamName={selectedQueueTeam.name}
          isOpen={isQueueModalOpen}
          onClose={() => {
            setIsQueueModalOpen(false);
            setSelectedQueueTeam(null);
          }}
        />
      )}
    </div>
  );
};
