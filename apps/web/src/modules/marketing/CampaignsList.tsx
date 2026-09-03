import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import type { MarketingCampaign } from './types';
import { CampaignMetricsModal } from './CampaignMetricsModal';
import {
  Megaphone, Plus, Search, Filter, BarChart3,
  Edit, Eye, Users, CheckCircle2, TrendingUp, Globe, Loader2, Trash2
} from 'lucide-react';

export const CampaignsList: React.FC = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('TODAS');
  const [selectedMetricsCampaignId, setSelectedMetricsCampaignId] = useState<string | null>(null);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (statusFilter !== 'TODAS') params.status = statusFilter;
      if (search) params.search = search;

      const res = await api.get('/marketing/campaigns', { params });
      setCampaigns(res.data || []);
    } catch (err) {
      console.error('Erro ao buscar campanhas:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchCampaigns();
  };

  const handleDelete = async (id: string, nome: string) => {
    if (!window.confirm(`Deseja realmente excluir a campanha "${nome}" e suas landing pages associadas?`)) {
      return;
    }
    try {
      await api.delete(`/marketing/campaigns/${id}`);
      setCampaigns(campaigns.filter(c => c.id !== id));
    } catch (err) {
      alert('Erro ao excluir campanha');
    }
  };

  // Totais agregados
  const totalLeads = campaigns.reduce((sum, c) => sum + (c.leads_count || 0), 0);
  const totalViews = campaigns.reduce((sum, c) => sum + (c.views_count || 0), 0);
  const avgConversion = totalViews > 0 ? ((totalLeads / totalViews) * 100).toFixed(1) : '0.0';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ATIVA':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Ativa</span>;
      case 'PAUSADA':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pausada</span>;
      case 'ENCERRADA':
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">Encerrada</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-500/10 text-gray-400 border border-gray-500/20">Rascunho</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-brand-primary/10 text-brand-primary">
              <Megaphone className="w-5 h-5" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-primary">
              Gestão de Marketing & Tráfego
            </span>
          </div>
          <h1 className="text-2xl font-bold text-text-primary">Campanhas & Landing Pages</h1>
          <p className="text-sm text-text-muted">
            Gerencie campanhas de anúncios, páginas de captura e distribuição automática de leads para a equipe comercial
          </p>
        </div>

        <button
          onClick={() => navigate('/marketing/campanhas/nova')}
          className="px-4 py-2.5 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white font-semibold text-sm flex items-center gap-2 shadow-lg shadow-brand-primary/20 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Nova Campanha
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Total de Leads Gerados</span>
            <div className="text-2xl font-black text-text-primary mt-1">{totalLeads.toLocaleString('pt-BR')}</div>
            <span className="text-xs text-emerald-500 font-medium mt-0.5 block">Distribuídos na Fila Comercial</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Visualizações em LPs</span>
            <div className="text-2xl font-black text-text-primary mt-1">{totalViews.toLocaleString('pt-BR')}</div>
            <span className="text-xs text-text-muted mt-0.5 block">Total de acessos únicos</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            <Eye className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-bg-surface border border-border-subtle shadow-sm flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Taxa de Conversão Média</span>
            <div className="text-2xl font-black text-text-primary mt-1">{avgConversion}%</div>
            <span className="text-xs text-text-muted mt-0.5 block">Leads / Visualizações</span>
          </div>
          <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="p-4 rounded-2xl bg-bg-surface border border-border-subtle flex flex-col sm:flex-row items-center justify-between gap-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome da campanha..."
            className="w-full pl-9 pr-4 py-2 bg-bg-deep border border-border-subtle rounded-xl text-text-primary text-sm focus:outline-none focus:border-brand-primary"
          />
        </form>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto">
          <Filter className="w-4 h-4 text-text-muted flex-shrink-0" />
          {['TODAS', 'ATIVA', 'PAUSADA', 'RASCUNHO', 'ENCERRADA'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === st
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'bg-bg-deep text-text-secondary hover:text-text-primary border border-border-subtle'
              }`}
            >
              {st === 'TODAS' ? 'Todas' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Campanhas */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 bg-bg-surface border border-dashed border-border-subtle rounded-2xl">
          <div className="w-12 h-12 rounded-2xl bg-brand-primary/10 text-brand-primary flex items-center justify-center mx-auto mb-3">
            <Megaphone className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-text-primary mb-1">Nenhuma campanha encontrada</h3>
          <p className="text-xs text-text-muted max-w-md mx-auto mb-4">
            Crie sua primeira campanha para gerar landing pages com captura automática de leads e métricas de tráfego.
          </p>
          <button
            onClick={() => navigate('/marketing/campanhas/nova')}
            className="px-4 py-2 rounded-xl bg-brand-primary text-white font-semibold text-xs inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Criar Primeira Campanha
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {campaigns.map((camp) => (
            <div
              key={camp.id}
              className="bg-bg-surface border border-border-subtle rounded-2xl p-5 hover:border-border-strong transition-all flex flex-col justify-between shadow-sm group"
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted bg-bg-deep px-2.5 py-0.5 rounded-md border border-border-subtle">
                    {camp.canal_origem || 'META_ADS'}
                  </span>
                  {getStatusBadge(camp.status)}
                </div>

                <h3 className="text-base font-bold text-text-primary group-hover:text-brand-primary transition-colors line-clamp-1 mb-1">
                  {camp.nome}
                </h3>
                <p className="text-xs text-text-muted line-clamp-2 mb-4 min-h-[32px]">
                  {camp.descricao || 'Sem descrição cadastrada.'}
                </p>

                {/* Info Pills */}
                <div className="space-y-2 text-xs text-text-secondary border-t border-border-subtle pt-3 mb-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-text-muted">
                      <Users className="w-3.5 h-3.5" /> Equipe Comercial:
                    </span>
                    <span className="font-semibold text-text-primary truncate max-w-[140px]">
                      {camp.sales_team_nome || 'Fila Geral'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-text-muted">
                      <Globe className="w-3.5 h-3.5" /> Landing Pages:
                    </span>
                    <span className="font-semibold text-text-primary">
                      {camp.landing_pages_count} ativa(s)
                    </span>
                  </div>
                </div>

                {/* Métricas Compactas */}
                <div className="grid grid-cols-3 gap-2 bg-bg-deep/60 p-2.5 rounded-xl border border-border-subtle text-center mb-4">
                  <div>
                    <div className="text-[10px] text-text-muted font-medium">Views</div>
                    <div className="text-sm font-bold text-text-primary">{camp.views_count || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-emerald-500 font-medium">Leads</div>
                    <div className="text-sm font-bold text-emerald-400">{camp.leads_count || 0}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-muted font-medium">Conv. %</div>
                    <div className="text-sm font-bold text-text-primary">
                      {camp.views_count > 0 ? ((camp.leads_count / camp.views_count) * 100).toFixed(1) : 0}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center gap-2 border-t border-border-subtle pt-3">
                <button
                  onClick={() => setSelectedMetricsCampaignId(camp.id)}
                  className="flex-1 py-2 px-2.5 rounded-xl bg-bg-deep hover:bg-bg-deep/80 text-text-primary text-xs font-semibold flex items-center justify-center gap-1.5 border border-border-subtle transition-colors"
                  title="Ver Métricas e Funil"
                >
                  <BarChart3 className="w-3.5 h-3.5 text-brand-primary" /> Métricas
                </button>

                <button
                  onClick={() => navigate(`/marketing/campanhas/${camp.id}`)}
                  className="p-2 rounded-xl bg-bg-deep hover:bg-bg-deep/80 text-text-secondary hover:text-text-primary border border-border-subtle transition-colors"
                  title="Editar Campanha & LP"
                >
                  <Edit className="w-4 h-4" />
                </button>

                <button
                  onClick={() => handleDelete(camp.id, camp.nome)}
                  className="p-2 rounded-xl bg-bg-deep hover:bg-rose-500/10 text-text-secondary hover:text-rose-400 border border-border-subtle transition-colors"
                  title="Excluir Campanha"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Métricas */}
      {selectedMetricsCampaignId && (
        <CampaignMetricsModal
          campaignId={selectedMetricsCampaignId}
          onClose={() => setSelectedMetricsCampaignId(null)}
        />
      )}
    </div>
  );
};
