import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { MarketingCampaign, MarketingLandingPage } from './types';
import {
  ArrowLeft, Save, Globe, Megaphone, Users, Calendar, DollarSign,
  Palette, Upload, Video, Image, FileText, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy
} from 'lucide-react';

export const CampaignForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const [activeTab, setActiveTab] = useState<'campanha' | 'landing_page'>('campanha');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [salesTeams, setSalesTeams] = useState<Array<{ id: string; nome: string }>>([]);

  // Campaign Form State
  const [campaignData, setCampaignData] = useState({
    nome: '',
    descricao: '',
    status: 'RASCUNHO' as 'RASCUNHO' | 'ATIVA' | 'PAUSADA' | 'ENCERRADA',
    canal_origem: 'META_ADS',
    orcamento_total: '',
    data_inicio: '',
    data_fim: '',
    sales_team_id: ''
  });

  // Landing Page Form State
  const [lpId, setLpId] = useState<string | null>(null);
  const [lpData, setLpData] = useState({
    slug: '',
    custom_domain: '',
    is_default_for_domain: false,
    titulo: '',
    subtitulo: '',
    texto_cta: 'Quero uma Proposta Personalizada',
    url_imagem_banner: '',
    url_imagem_fundo: '',
    url_video: '',
    cor_primaria: '#1E40AF',
    cor_secundaria: '#F59E0B',
    scripts_cabecalho: '',
    scripts_rodape: '',
    campos_form: ['nome', 'telefone', 'email', 'cidade', 'mensagem'],
    obrigatorios_form: ['nome', 'telefone'],
    beneficios: [
      { titulo: 'Atendimento Rápido e Especializado', descricao: 'Equipe técnica certificada pronta para dimensionar o melhor projeto.' },
      { titulo: 'Equipamentos de Última Geração', descricao: 'Tecnologia homologada com garantia total e alta durabilidade.' },
      { titulo: 'Proposta Sem Compromisso', descricao: 'Condições comerciais sob medida para sua necessidade.' }
    ]
  });

  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingFundo, setUploadingFundo] = useState(false);

  // Load sales teams
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const res = await api.get('/companies/sales-teams');
        setSalesTeams(res.data || []);
      } catch (err) {
        console.error('Erro ao buscar equipes de venda:', err);
      }
    };
    fetchTeams();
  }, []);

  // Load existing campaign & LP
  useEffect(() => {
    if (!id) return;
    const fetchCampaign = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/marketing/campaigns/${id}`);
        const c: MarketingCampaign = res.data;
        setCampaignData({
          nome: c.nome || '',
          descricao: c.descricao || '',
          status: c.status || 'RASCUNHO',
          canal_origem: c.canal_origem || 'META_ADS',
          orcamento_total: c.orcamento_total ? String(c.orcamento_total) : '',
          data_inicio: c.data_inicio ? c.data_inicio.substring(0, 10) : '',
          data_fim: c.data_fim ? c.data_fim.substring(0, 10) : '',
          sales_team_id: c.sales_team_id || ''
        });

        // Buscar LP associada à campanha
        const lpRes = await api.get(`/marketing/landing-pages?campaign_id=${id}`);
        if (lpRes.data && lpRes.data.length > 0) {
          const lp: MarketingLandingPage = lpRes.data[0];
          setLpId(lp.id);
          setLpData({
            slug: lp.slug || '',
            custom_domain: lp.custom_domain || '',
            is_default_for_domain: lp.is_default_for_domain || false,
            titulo: lp.titulo || '',
            subtitulo: lp.subtitulo || '',
            texto_cta: lp.texto_cta || 'Quero uma Proposta Personalizada',
            url_imagem_banner: lp.url_imagem_banner || '',
            url_imagem_fundo: lp.url_imagem_fundo || '',
            url_video: lp.url_video || '',
            cor_primaria: lp.cor_primaria || '#1E40AF',
            cor_secundaria: lp.cor_secundaria || '#F59E0B',
            scripts_cabecalho: lp.scripts_cabecalho || '',
            scripts_rodape: lp.scripts_rodape || '',
            campos_form: lp.configuracao_formulario?.campos || ['nome', 'telefone', 'email', 'cidade', 'mensagem'],
            obrigatorios_form: lp.configuracao_formulario?.obrigatorios || ['nome', 'telefone'],
            beneficios: lp.configuracao_conteudo?.beneficios?.length ? lp.configuracao_conteudo.beneficios : [
              { titulo: 'Atendimento Rápido e Especializado', descricao: 'Equipe técnica certificada pronta para dimensionar o melhor projeto.' },
              { titulo: 'Equipamentos de Última Geração', descricao: 'Tecnologia homologada com garantia total e alta durabilidade.' },
              { titulo: 'Proposta Sem Compromisso', descricao: 'Condições comerciais sob medida para sua necessidade.' }
            ]
          });
        }
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Erro ao carregar campanha');
      } finally {
        setLoading(false);
      }
    };
    fetchCampaign();
  }, [id]);

  // Upload handler
  const handleUpload = async (file: File, type: 'banner' | 'fundo') => {
    try {
      if (type === 'banner') setUploadingBanner(true);
      if (type === 'fundo') setUploadingFundo(true);

      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/marketing/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (type === 'banner') {
        setLpData(prev => ({ ...prev, url_imagem_banner: res.data.url }));
      } else {
        setLpData(prev => ({ ...prev, url_imagem_fundo: res.data.url }));
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao fazer upload da imagem');
    } finally {
      if (type === 'banner') setUploadingBanner(false);
      if (type === 'fundo') setUploadingFundo(false);
    }
  };

  // Submit Handler
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      // 1. Salvar Campanha
      const campaignPayload = {
        nome: campaignData.nome,
        descricao: campaignData.descricao || null,
        status: campaignData.status,
        canal_origem: campaignData.canal_origem,
        orcamento_total: campaignData.orcamento_total ? parseFloat(campaignData.orcamento_total) : null,
        data_inicio: campaignData.data_inicio ? new Date(campaignData.data_inicio).toISOString() : null,
        data_fim: campaignData.data_fim ? new Date(campaignData.data_fim).toISOString() : null,
        sales_team_id: campaignData.sales_team_id || null
      };

      let targetCampaignId = id;

      if (isEditing && id) {
        await api.put(`/marketing/campaigns/${id}`, campaignPayload);
      } else {
        const campRes = await api.post('/marketing/campaigns', campaignPayload);
        targetCampaignId = campRes.data.id;
      }

      // 2. Salvar ou Atualizar Landing Page
      if (targetCampaignId) {
        // Gerar slug caso vazio
        let finalSlug = lpData.slug.trim().toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-');

        if (!finalSlug) {
          finalSlug = campaignData.nome.trim().toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-');
        }

        const lpPayload = {
          campaign_id: targetCampaignId,
          slug: finalSlug,
          custom_domain: lpData.custom_domain.trim() || null,
          is_default_for_domain: lpData.is_default_for_domain,
          titulo: lpData.titulo || campaignData.nome,
          subtitulo: lpData.subtitulo || null,
          texto_cta: lpData.texto_cta || 'Quero uma Proposta Personalizada',
          url_imagem_banner: lpData.url_imagem_banner || null,
          url_imagem_fundo: lpData.url_imagem_fundo || null,
          url_video: lpData.url_video || null,
          configuracao_formulario: {
            campos: lpData.campos_form,
            obrigatorios: lpData.obrigatorios_form
          },
          configuracao_conteudo: {
            beneficios: lpData.beneficios,
            faq: []
          },
          cor_primaria: lpData.cor_primaria || '#1E40AF',
          cor_secundaria: lpData.cor_secundaria || '#F59E0B',
          scripts_cabecalho: lpData.scripts_cabecalho || null,
          scripts_rodape: lpData.scripts_rodape || null,
          ativo: true
        };

        if (lpId) {
          await api.put(`/marketing/landing-pages/${lpId}`, lpPayload);
        } else {
          const lpRes = await api.post('/marketing/landing-pages', lpPayload);
          setLpId(lpRes.data.id);
        }
      }

      setSuccess('Campanha e Landing Page salvas com sucesso!');
      if (!isEditing && targetCampaignId) {
        setTimeout(() => navigate(`/marketing/campanhas/${targetCampaignId}`), 1000);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Erro ao salvar campanha');
    } finally {
      setSaving(false);
    }
  };

  const copyPublicLink = () => {
    const publicUrl = lpData.custom_domain
      ? `https://${lpData.custom_domain}${lpData.is_default_for_domain ? '' : `/${lpData.slug}`}`
      : `${window.location.origin}/lp/${lpData.slug}`;

    navigator.clipboard.writeText(publicUrl);
    alert(`Link copiado para a área de transferência:\n${publicUrl}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/marketing')}
            className="p-2 text-text-muted hover:text-text-primary rounded-lg hover:bg-bg-surface border border-border-subtle transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">
              {isEditing ? 'Editar Campanha & Landing Page' : 'Nova Campanha de Marketing'}
            </h1>
            <p className="text-sm text-text-muted">
              Configure os objetivos comerciais, mídia e a página de captura pública
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lpData.slug && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={copyPublicLink}
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-bg-surface border border-border-subtle hover:bg-bg-deep text-text-secondary flex items-center gap-1.5"
                title="Copiar Link da LP"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar Link
              </button>
              <a
                href={lpData.custom_domain ? `https://${lpData.custom_domain}` : `/lp/${lpData.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 text-xs font-semibold rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Ver LP
              </a>
            </div>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-semibold rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white flex items-center gap-2 shadow-lg shadow-brand-primary/20 transition-all disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border-subtle gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('campanha')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'campanha'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          1. Gestão da Campanha
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('landing_page')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'landing_page'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-text-muted hover:text-text-secondary'
          }`}
        >
          <Globe className="w-4 h-4" />
          2. Landing Page & Multi-Domínio
        </button>
      </div>

      {/* Tab 1: Campanha */}
      {activeTab === 'campanha' && (
        <div className="space-y-6 bg-bg-surface border border-border-subtle p-6 rounded-2xl">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2 border-b border-border-subtle pb-3">
            <Megaphone className="w-5 h-5 text-brand-primary" />
            Parâmetros da Campanha
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Nome da Campanha *
              </label>
              <input
                type="text"
                required
                value={campaignData.nome}
                onChange={e => setCampaignData({ ...campaignData, nome: e.target.value })}
                placeholder="Ex.: Campanha Segurança Condomínios - Instagram Q3"
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Status da Campanha
              </label>
              <select
                value={campaignData.status}
                onChange={e => setCampaignData({ ...campaignData, status: e.target.value as any })}
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              >
                <option value="RASCUNHO">Rascunho (Não pública)</option>
                <option value="ATIVA">Ativa (Recebendo Tráfego)</option>
                <option value="PAUSADA">Pausada</option>
                <option value="ENCERRADA">Encerrada</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Canal Principal de Tráfego
              </label>
              <select
                value={campaignData.canal_origem}
                onChange={e => setCampaignData({ ...campaignData, canal_origem: e.target.value })}
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              >
                <option value="META_ADS">Meta Ads (Instagram / Facebook)</option>
                <option value="GOOGLE_ADS">Google Ads (Search / Display)</option>
                <option value="TIKTOK_ADS">TikTok Ads</option>
                <option value="LINKEDIN_ADS">LinkedIn Ads</option>
                <option value="EMAIL_MARKETING">E-mail Marketing</option>
                <option value="ORGANICO">Tráfego Orgânico / Direto</option>
                <option value="OUTROS">Outros</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-brand-primary" />
                Equipe Comercial (Fila Round Robin)
              </label>
              <select
                value={campaignData.sales_team_id}
                onChange={e => setCampaignData({ ...campaignData, sales_team_id: e.target.value })}
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              >
                <option value="">Fila Geral (Sem equipe específica)</option>
                {salesTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.nome}</option>
                ))}
              </select>
              <span className="text-[11px] text-text-muted mt-1 block">
                Se selecionada, cada lead convertido da LP será distribuído automaticamente em rodízio (Round Robin) para os vendedores desta equipe.
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-brand-primary" />
                Orçamento Previsto (R$)
              </label>
              <input
                type="number"
                step="0.01"
                value={campaignData.orcamento_total}
                onChange={e => setCampaignData({ ...campaignData, orcamento_total: e.target.value })}
                placeholder="0.00"
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                Data de Início
              </label>
              <input
                type="date"
                value={campaignData.data_inicio}
                onChange={e => setCampaignData({ ...campaignData, data_inicio: e.target.value })}
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-brand-primary" />
                Data de Término
              </label>
              <input
                type="date"
                value={campaignData.data_fim}
                onChange={e => setCampaignData({ ...campaignData, data_fim: e.target.value })}
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Descrição e Objetivos
              </label>
              <textarea
                rows={3}
                value={campaignData.descricao}
                onChange={e => setCampaignData({ ...campaignData, descricao: e.target.value })}
                placeholder="Detalhes sobre a estratégia de tráfego, público-alvo, criativos e metas..."
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              />
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Landing Page & Multi-Domínio */}
      {activeTab === 'landing_page' && (
        <div className="space-y-6 bg-bg-surface border border-border-subtle p-6 rounded-2xl">
          <h2 className="text-base font-bold text-text-primary flex items-center gap-2 border-b border-border-subtle pb-3">
            <Globe className="w-5 h-5 text-brand-primary" />
            Configuração da Landing Page Pública
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Slug e Multi-Domínio */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Slug da URL (Identificador) *
              </label>
              <div className="flex items-center">
                <span className="px-3 py-2.5 bg-bg-deep border border-r-0 border-border-subtle rounded-l-xl text-xs text-text-muted">
                  /lp/
                </span>
                <input
                  type="text"
                  required
                  value={lpData.slug}
                  onChange={e => setLpData({ ...lpData, slug: e.target.value })}
                  placeholder="seguranca-condominios"
                  className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-r-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm font-mono"
                />
              </div>
              <span className="text-[11px] text-text-muted mt-1 block">
                Ex.: {window.location.origin}/lp/{lpData.slug || 'seu-slug'}
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Domínio Personalizado (Opcional)
              </label>
              <input
                type="text"
                value={lpData.custom_domain}
                onChange={e => setLpData({ ...lpData, custom_domain: e.target.value })}
                placeholder="Ex.: promo.stelseg.com.br"
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm font-mono"
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="is_default_for_domain"
                  checked={lpData.is_default_for_domain}
                  onChange={e => setLpData({ ...lpData, is_default_for_domain: e.target.checked })}
                  className="rounded border-border-subtle text-brand-primary focus:ring-0"
                />
                <label htmlFor="is_default_for_domain" className="text-xs text-text-secondary cursor-pointer">
                  Página principal da raiz deste domínio (ex.: <code>https://{lpData.custom_domain || 'dominio'}/</code>)
                </label>
              </div>
            </div>

            {/* Conteúdo Principal */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Título Principal de Impacto (Headline) *
              </label>
              <input
                type="text"
                required
                value={lpData.titulo}
                onChange={e => setLpData({ ...lpData, titulo: e.target.value })}
                placeholder="Ex.: Soluções Completas em Segurança Eletrônica 24h"
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Subtítulo Explicativo
              </label>
              <textarea
                rows={2}
                value={lpData.subtitulo}
                onChange={e => setLpData({ ...lpData, subtitulo: e.target.value })}
                placeholder="Ex.: Proteja seu patrimônio com câmeras inteligentes, portaria remota e controle de acesso integrado com condições especiais."
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Texto do Botão de Ação (CTA)
              </label>
              <input
                type="text"
                value={lpData.texto_cta}
                onChange={e => setLpData({ ...lpData, texto_cta: e.target.value })}
                placeholder="Ex.: Quero uma Proposta Personalizada"
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-brand-primary" />
                URL de Vídeo (YouTube ou Vimeo)
              </label>
              <input
                type="text"
                value={lpData.url_video}
                onChange={e => setLpData({ ...lpData, url_video: e.target.value })}
                placeholder="https://www.youtube.com/watch?v=..."
                className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
              />
            </div>

            {/* Imagem do Banner / Destaque */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-brand-primary" />
                Imagem do Banner / Produto
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={lpData.url_imagem_banner}
                  onChange={e => setLpData({ ...lpData, url_imagem_banner: e.target.value })}
                  placeholder="/uploads/marketing/banner.jpg"
                  className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary text-sm"
                />
                <label className="cursor-pointer px-4 py-2.5 bg-bg-deep border border-border-subtle hover:bg-bg-surface rounded-xl text-xs font-semibold text-text-secondary flex items-center gap-1.5 whitespace-nowrap">
                  {uploadingBanner ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'banner')}
                  />
                </label>
              </div>
            </div>

            {/* Imagem de Fundo (Hero Background) */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                <Image className="w-3.5 h-3.5 text-brand-primary" />
                Imagem de Fundo (Hero Background)
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="text"
                  value={lpData.url_imagem_fundo}
                  onChange={e => setLpData({ ...lpData, url_imagem_fundo: e.target.value })}
                  placeholder="/uploads/marketing/fundo.jpg"
                  className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary text-sm"
                />
                <label className="cursor-pointer px-4 py-2.5 bg-bg-deep border border-border-subtle hover:bg-bg-surface rounded-xl text-xs font-semibold text-text-secondary flex items-center gap-1.5 whitespace-nowrap">
                  {uploadingFundo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'fundo')}
                  />
                </label>
              </div>
            </div>

            {/* Cores da Marca */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-brand-primary" />
                Cor Primária da Página
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={lpData.cor_primaria}
                  onChange={e => setLpData({ ...lpData, cor_primaria: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-border-subtle cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={lpData.cor_primaria}
                  onChange={e => setLpData({ ...lpData, cor_primaria: e.target.value })}
                  className="w-32 px-3 py-2 bg-bg-deep border border-border-subtle rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5 text-brand-primary" />
                Cor de Destaque (Botão CTA)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={lpData.cor_secundaria}
                  onChange={e => setLpData({ ...lpData, cor_secundaria: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-border-subtle cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={lpData.cor_secundaria}
                  onChange={e => setLpData({ ...lpData, cor_secundaria: e.target.value })}
                  className="w-32 px-3 py-2 bg-bg-deep border border-border-subtle rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            {/* Campos do Formulário */}
            <div className="md:col-span-2 border-t border-border-subtle pt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-2 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-brand-primary" />
                Campos Exibidos no Formulário de Conversão
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  { id: 'nome', label: 'Nome Completo', requiredAlways: true },
                  { id: 'telefone', label: 'WhatsApp / Telefone', requiredAlways: true },
                  { id: 'email', label: 'E-mail', requiredAlways: false },
                  { id: 'cidade', label: 'Cidade / Estado', requiredAlways: false },
                  { id: 'mensagem', label: 'Mensagem / Necessidade', requiredAlways: false }
                ].map(field => {
                  const isActive = lpData.campos_form.includes(field.id);
                  return (
                    <div
                      key={field.id}
                      onClick={() => {
                        if (field.requiredAlways) return;
                        if (isActive) {
                          setLpData({
                            ...lpData,
                            campos_form: lpData.campos_form.filter(f => f !== field.id)
                          });
                        } else {
                          setLpData({
                            ...lpData,
                            campos_form: [...lpData.campos_form, field.id]
                          });
                        }
                      }}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isActive
                          ? 'border-brand-primary/50 bg-brand-primary/10 text-text-primary'
                          : 'border-border-subtle bg-bg-deep text-text-muted hover:border-border-strong'
                      }`}
                    >
                      <div className="font-semibold">{field.label}</div>
                      <div className="text-[10px] mt-1 text-text-muted">
                        {field.requiredAlways ? 'Obrigatório' : isActive ? 'Ativo' : 'Desativado'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Scripts de Rastreamento (Meta Pixel / GTM) */}
            <div className="md:col-span-2 border-t border-border-subtle pt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Scripts de Rastreamento (Meta Pixel / Google Tag Manager)
              </label>
              <textarea
                rows={3}
                value={lpData.scripts_cabecalho}
                onChange={e => setLpData({ ...lpData, scripts_cabecalho: e.target.value })}
                placeholder="<!-- Cole aqui scripts como <script>fbq('init', '...');</script> ou Google Analytics -->"
                className="w-full px-4 py-2 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-xs font-mono"
              />
              <span className="text-[11px] text-text-muted mt-1 block">
                Esses scripts serão injetados com segurança no cabeçalho da Landing Page pública.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
