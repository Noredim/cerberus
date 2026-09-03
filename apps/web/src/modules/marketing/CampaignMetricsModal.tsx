import React, { useEffect, useState } from 'react';
import { api } from '../../services/api';
import type { CampaignMetrics, MarketingSubmission } from './types';
import { X, Eye, MousePointerClick, FileEdit, CheckCircle2, UserCheck, TrendingUp, Link, ExternalLink, Loader2 } from 'lucide-react';

interface Props {
  campaignId: string;
  onClose: () => void;
}

export const CampaignMetricsModal: React.FC<Props> = ({ campaignId, onClose }) => {
  const [metrics, setMetrics] = useState<CampaignMetrics | null>(null);
  const [submissions, setSubmissions] = useState<MarketingSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [metricsRes, subsRes] = await Promise.all([
          api.get(`/marketing/campaigns/${campaignId}/metrics`),
          api.get(`/marketing/campaigns/${campaignId}/submissions`)
        ]);
        setMetrics(metricsRes.data);
        setSubmissions(subsRes.data);
      } catch (err) {
        console.error('Erro ao carregar métricas:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [campaignId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-bg-surface border border-border-subtle rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-border-subtle flex items-center justify-between bg-bg-deep/40">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/10 text-blue-500">
                Dashboard de Resultados
              </span>
              {metrics && (
                <span className="text-xs text-text-muted">
                  Status: <strong>{metrics.status}</strong>
                </span>
              )}
            </div>
            <h2 className="text-xl font-bold text-text-primary">
              {metrics?.campaign_nome || 'Métricas da Campanha'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-deep transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : metrics ? (
            <>
              {/* Funil de Conversão */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-brand-primary" />
                  Funil de Engajamento & Conversão
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-bg-deep/60 border border-border-subtle p-4 rounded-xl">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                      <span className="text-xs font-medium">Visualizações (Views)</span>
                      <Eye className="w-4 h-4 text-blue-400" />
                    </div>
                    <div className="text-2xl font-black text-text-primary">
                      {metrics.total_views.toLocaleString('pt-BR')}
                    </div>
                    <span className="text-[11px] text-text-muted">Visitantes da LP</span>
                  </div>

                  <div className="bg-bg-deep/60 border border-border-subtle p-4 rounded-xl">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                      <span className="text-xs font-medium">Cliques no CTA</span>
                      <MousePointerClick className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-text-primary">
                      {metrics.total_cta_clicks.toLocaleString('pt-BR')}
                    </div>
                    <span className="text-[11px] text-text-muted">Interesse direto</span>
                  </div>

                  <div className="bg-bg-deep/60 border border-border-subtle p-4 rounded-xl">
                    <div className="flex items-center justify-between text-text-muted mb-2">
                      <span className="text-xs font-medium">Inícios de Form</span>
                      <FileEdit className="w-4 h-4 text-indigo-400" />
                    </div>
                    <div className="text-2xl font-black text-text-primary">
                      {metrics.total_form_starts.toLocaleString('pt-BR')}
                    </div>
                    <span className="text-[11px] text-text-muted">Preenchimento iniciado</span>
                  </div>

                  <div className="bg-bg-deep/60 border border-emerald-500/20 bg-emerald-500/5 p-4 rounded-xl">
                    <div className="flex items-center justify-between text-emerald-400 mb-2">
                      <span className="text-xs font-medium">Leads Gerados</span>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-black text-emerald-400">
                      {metrics.leads_generated.toLocaleString('pt-BR')}
                    </div>
                    <div className="text-[11px] font-semibold text-emerald-500">
                      Taxa: {metrics.conversion_rate}%
                    </div>
                  </div>
                </div>
              </div>

              {/* Origens de Tráfego (UTMs) */}
              {metrics.top_utm_sources.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                    <Link className="w-4 h-4 text-brand-primary" />
                    Principais Canais de Tráfego (UTM Source)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {metrics.top_utm_sources.map((item, idx) => (
                      <div key={idx} className="bg-bg-deep/40 border border-border-subtle p-3 rounded-lg flex items-center justify-between">
                        <span className="text-sm font-medium text-text-primary">{item.source || 'Direto / Desconhecido'}</span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400">
                          {item.conversions} leads
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tabela de Leads Gerados Recentemente */}
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-3 flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-brand-primary" />
                  Últimos Leads Convertidos na Campanha
                </h3>
                {submissions.length === 0 ? (
                  <div className="text-center py-8 text-text-muted text-sm border border-dashed border-border-subtle rounded-xl">
                    Nenhuma submissão registrada ainda para esta campanha.
                  </div>
                ) : (
                  <div className="border border-border-subtle rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-bg-deep/80 text-text-muted uppercase border-b border-border-subtle font-semibold">
                        <tr>
                          <th className="p-3">Data/Hora</th>
                          <th className="p-3">Lead / Contato</th>
                          <th className="p-3">Telefone</th>
                          <th className="p-3">Origem (UTM)</th>
                          <th className="p-3">Vendedor na Fila</th>
                          <th className="p-3 text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-subtle">
                        {submissions.map((s) => (
                          <tr key={s.id} className="hover:bg-bg-deep/40 transition-colors">
                            <td className="p-3 text-text-muted whitespace-nowrap">
                              {new Date(s.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                            </td>
                            <td className="p-3 font-semibold text-text-primary">
                              {s.lead_nome || s.dados_formulario?.nome || 'Contato'}
                            </td>
                            <td className="p-3 text-text-secondary">
                              {s.dados_formulario?.telefone || s.dados_formulario?.whatsapp || '-'}
                            </td>
                            <td className="p-3 text-text-muted">
                              {s.utm_source ? `${s.utm_source} / ${s.utm_medium || ''}` : 'Orgânico'}
                            </td>
                            <td className="p-3">
                              {s.vendedor_nome ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-500/10 text-emerald-400">
                                  {s.vendedor_nome}
                                </span>
                              ) : (
                                <span className="text-text-muted text-[11px]">Fila Geral</span>
                              )}
                            </td>
                            <td className="p-3 text-right">
                              {s.lead_id && (
                                <a
                                  href={`/comercial/leads/${s.lead_id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-brand-primary hover:underline"
                                >
                                  Ver Lead <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-10 text-text-muted">
              Não foi possível carregar as métricas desta campanha.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border-subtle bg-bg-deep/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-deep text-text-primary transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
