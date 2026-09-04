import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { MarketingCampaign, MarketingLandingPage, LayoutConfig, SubtitleItem } from './types';
import { CampaignLayoutBuilder } from './components/CampaignLayoutBuilder';
import {
  ArrowLeft, Save, Globe, Megaphone, Users, Calendar, DollarSign,
  Palette, Upload, Video, Image, FileText, CheckCircle, AlertCircle, Loader2, ExternalLink, Copy,
  Plus, Trash2, MessageCircle, X, Check, ListChecks, ArrowUp, ArrowDown, AlignJustify
} from 'lucide-react';

export const CampaignForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { activeCompanyId } = useAuth();
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
    sales_team_id: '',
    company_id: ''
  });

  // Landing Page Form State
  const [lpId, setLpId] = useState<string | null>(null);
  const [lpData, setLpData] = useState({
    slug: '',
    custom_domain: '',
    is_default_for_domain: true,
    url_logo: '',
    nome_empresa: '',
    titulo: '',
    subtitulo: '',
    subtitulos: [
      { id: 'subtitulo', rotulo: 'Subtítulo Principal', texto: '' }
    ] as SubtitleItem[],
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
    campos_personalizados: [] as Array<{
      id: string;
      label: string;
      tipo?: string;
      placeholder?: string;
      obrigatorio?: boolean;
    }>,
    whatsapp_cta: {
      ativo: false,
      numero: '',
      texto: 'Falar direto no WhatsApp',
      mensagem_padrao: ''
    },
    layout: {
      posicao_formulario: 'right',
      blocos: [
        { id: 'badge', visivel: true },
        { id: 'titulo', visivel: true },
        { id: 'subtitulo', visivel: true },
        { id: 'banner', visivel: true },
        { id: 'video', visivel: true },
        { id: 'beneficios', visivel: true }
      ]
    } as LayoutConfig,
    beneficios: [
      { titulo: 'Atendimento Rápido e Especializado', descricao: 'Equipe técnica certificada pronta para dimensionar o melhor projeto.' },
      { titulo: 'Equipamentos de Última Geração', descricao: 'Tecnologia homologada com garantia total e alta durabilidade.' },
      { titulo: 'Proposta Sem Compromisso', descricao: 'Condições comerciais sob medida para sua necessidade.' }
    ]
  });

  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [uploadingFundo, setUploadingFundo] = useState(false);

  // Custom Field Form Modal/Inline state
  const [showNewFieldModal, setShowNewFieldModal] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldRequired, setNewFieldRequired] = useState(false);

  // Load sales teams for active company or tenant
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        const targetCompanyId = campaignData.company_id || activeCompanyId;
        const endpoint = targetCompanyId ? `/companies/${targetCompanyId}/sales-teams` : '/companies/sales-teams';
        const res = await api.get(endpoint);
        setSalesTeams(res.data || []);
      } catch (err) {
        try {
          const res = await api.get('/companies/sales-teams');
          setSalesTeams(res.data || []);
        } catch (e) {
          console.error('Erro ao buscar equipes de venda:', e);
        }
      }
    };
    fetchTeams();
  }, [activeCompanyId, campaignData.company_id]);

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
          sales_team_id: c.sales_team_id || '',
          company_id: c.company_id || ''
        });

        // Buscar LP associada à campanha
        const lpRes = await api.get(`/marketing/landing-pages?campaign_id=${id}`);
        if (lpRes.data && lpRes.data.length > 0) {
          const lp: MarketingLandingPage = lpRes.data[0];
          setLpId(lp.id);
          setLpData({
            slug: lp.slug || '',
            custom_domain: lp.custom_domain || '',
            is_default_for_domain: true,
            url_logo: lp.configuracao_conteudo?.url_logo || '',
            nome_empresa: lp.configuracao_conteudo?.nome_empresa || '',
            titulo: lp.titulo || '',
            subtitulo: lp.subtitulo || '',
            subtitulos: (lp.configuracao_conteudo?.subtitulos && lp.configuracao_conteudo.subtitulos.length > 0)
              ? lp.configuracao_conteudo.subtitulos
              : [{ id: 'subtitulo', rotulo: 'Subtítulo Principal', texto: lp.subtitulo || '' }],
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
            campos_personalizados: lp.configuracao_formulario?.campos_personalizados || [],
            whatsapp_cta: {
              ativo: Boolean(lp.configuracao_formulario?.whatsapp_cta?.ativo),
              numero: lp.configuracao_formulario?.whatsapp_cta?.numero || '',
              texto: lp.configuracao_formulario?.whatsapp_cta?.texto || 'Falar direto no WhatsApp',
              mensagem_padrao: lp.configuracao_formulario?.whatsapp_cta?.mensagem_padrao || ''
            },
            layout: lp.configuracao_conteudo?.layout || {
              posicao_formulario: 'right',
              blocos: [
                { id: 'badge', visivel: true },
                { id: 'titulo', visivel: true },
                { id: 'subtitulo', visivel: true },
                { id: 'banner', visivel: true },
                { id: 'video', visivel: true },
                { id: 'beneficios', visivel: true }
              ]
            },
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
  const handleUpload = async (file: File, type: 'banner' | 'fundo' | 'logo') => {
    try {
      if (type === 'banner') setUploadingBanner(true);
      if (type === 'fundo') setUploadingFundo(true);
      if (type === 'logo') setUploadingLogo(true);

      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/marketing/upload-media', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      if (type === 'banner') {
        setLpData(prev => ({ ...prev, url_imagem_banner: res.data.url }));
      } else if (type === 'fundo') {
        setLpData(prev => ({ ...prev, url_imagem_fundo: res.data.url }));
      } else {
        setLpData(prev => ({ ...prev, url_logo: res.data.url }));
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Erro ao fazer upload da imagem');
    } finally {
      if (type === 'banner') setUploadingBanner(false);
      if (type === 'fundo') setUploadingFundo(false);
      if (type === 'logo') setUploadingLogo(false);
    }
  };

  // Custom Fields Handlers
  const handleAddCustomField = () => {
    if (!newFieldLabel.trim()) return;
    const cleanId = newFieldLabel
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '') || `campo_${Date.now()}`;

    let finalId = cleanId;
    let counter = 1;
    while (
      lpData.campos_form.includes(finalId) ||
      lpData.campos_personalizados.some(c => c.id === finalId)
    ) {
      finalId = `${cleanId}_${counter}`;
      counter++;
    }

    const newField = {
      id: finalId,
      label: newFieldLabel.trim(),
      tipo: 'text',
      placeholder: `Informe ${newFieldLabel.trim().toLowerCase()}...`,
      obrigatorio: newFieldRequired
    };

    setLpData(prev => ({
      ...prev,
      campos_form: [...prev.campos_form, finalId],
      obrigatorios_form: newFieldRequired
        ? [...prev.obrigatorios_form, finalId]
        : prev.obrigatorios_form,
      campos_personalizados: [...prev.campos_personalizados, newField]
    }));

    setNewFieldLabel('');
    setNewFieldRequired(false);
    setShowNewFieldModal(false);
  };

  const handleRemoveCustomField = (fieldId: string) => {
    if (!confirm('Deseja realmente remover este botão/campo do formulário?')) return;
    setLpData(prev => ({
      ...prev,
      campos_form: prev.campos_form.filter(f => f !== fieldId),
      obrigatorios_form: prev.obrigatorios_form.filter(f => f !== fieldId),
      campos_personalizados: prev.campos_personalizados.filter(c => c.id !== fieldId)
    }));
  };

  // Benefícios / Diferenciais Handlers
  const handleAddBeneficio = () => {
    setLpData(prev => ({
      ...prev,
      beneficios: [
        ...prev.beneficios,
        { titulo: '', descricao: '' }
      ]
    }));
  };

  const handleUpdateBeneficio = (index: number, field: 'titulo' | 'descricao', value: string) => {
    setLpData(prev => {
      const updated = [...prev.beneficios];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, beneficios: updated };
    });
  };

  const handleRemoveBeneficio = (index: number) => {
    setLpData(prev => ({
      ...prev,
      beneficios: prev.beneficios.filter((_, i) => i !== index)
    }));
  };

  const handleMoveBeneficio = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lpData.beneficios.length) return;
    setLpData(prev => {
      const updated = [...prev.beneficios];
      const [moved] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, moved);
      return { ...prev, beneficios: updated };
    });
  };

  // Subtítulos Explicativos Handlers
  const handleAddSubtitulo = () => {
    const newId = `subtitulo_${Date.now()}`;
    const nextNum = lpData.subtitulos.length + 1;
    const newItem: SubtitleItem = {
      id: newId,
      rotulo: `Subtítulo Explicativo ${nextNum}`,
      texto: ''
    };
    const updatedSubtitulos = [...lpData.subtitulos, newItem];
    const updatedBlocks = [
      ...(lpData.layout?.blocos || []),
      { id: newId, visivel: true }
    ];
    setLpData(prev => ({
      ...prev,
      subtitulos: updatedSubtitulos,
      layout: {
        posicao_formulario: prev.layout?.posicao_formulario || 'right',
        blocos: updatedBlocks
      }
    }));
  };

  const handleUpdateSubtitulo = (index: number, field: 'rotulo' | 'texto', value: string) => {
    setLpData(prev => {
      const updated = [...prev.subtitulos];
      updated[index] = { ...updated[index], [field]: value };
      return {
        ...prev,
        subtitulos: updated,
        ...(index === 0 && field === 'texto' ? { subtitulo: value } : {})
      };
    });
  };

  const handleRemoveSubtitulo = (index: number) => {
    if (lpData.subtitulos.length <= 1) {
      handleUpdateSubtitulo(0, 'texto', '');
      return;
    }
    const removedId = lpData.subtitulos[index].id;
    const updated = lpData.subtitulos.filter((_, i) => i !== index);
    const updatedBlocks = (lpData.layout?.blocos || []).filter(b => b.id !== removedId);
    setLpData(prev => ({
      ...prev,
      subtitulos: updated,
      subtitulo: updated[0]?.texto || '',
      layout: {
        posicao_formulario: prev.layout?.posicao_formulario || 'right',
        blocos: updatedBlocks
      }
    }));
  };

  const handleMoveSubtitulo = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= lpData.subtitulos.length) return;
    setLpData(prev => {
      const updated = [...prev.subtitulos];
      const [moved] = updated.splice(index, 1);
      updated.splice(targetIndex, 0, moved);
      return {
        ...prev,
        subtitulos: updated,
        subtitulo: updated[0]?.texto || ''
      };
    });
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
          custom_domain: lpData.custom_domain ? lpData.custom_domain.trim() : null,
          is_default_for_domain: true,
          titulo: lpData.titulo || campaignData.nome,
          subtitulo: lpData.subtitulos[0]?.texto || lpData.subtitulo || null,
          texto_cta: lpData.texto_cta || 'Quero uma Proposta Personalizada',
          url_imagem_banner: lpData.url_imagem_banner || null,
          url_imagem_fundo: lpData.url_imagem_fundo || null,
          url_video: lpData.url_video || null,
          configuracao_formulario: {
            campos: lpData.campos_form,
            obrigatorios: lpData.obrigatorios_form,
            campos_personalizados: lpData.campos_personalizados,
            whatsapp_cta: lpData.whatsapp_cta
          },
          configuracao_conteudo: {
            url_logo: lpData.url_logo || null,
            nome_empresa: lpData.nome_empresa || null,
            subtitulos: lpData.subtitulos,
            beneficios: lpData.beneficios,
            faq: [],
            layout: lpData.layout
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
            {/* Slug da Landing Page */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                Slug da URL (Identificador) *
              </label>
              <div className="flex items-center max-w-xl">
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
                Link da Landing Page: {window.location.origin}/lp/{lpData.slug || 'seu-slug'}
              </span>
            </div>

            {/* Identidade Visual do Cabeçalho (Logo & Nome da Empresa) */}
            <div className="md:col-span-2 border-t border-border-subtle pt-4 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="w-4 h-4 text-brand-primary" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Identidade do Cabeçalho Superior (Logo & Empresa)
                </h3>
              </div>
              <p className="text-[11px] text-text-muted mb-4">
                Personalize o logotipo e o nome da marca exibidos no cabeçalho fixo no topo da Landing Page.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Logo da LP */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5 text-brand-primary" />
                      Logo do Cabeçalho
                    </label>
                    <span className="text-[10px] font-semibold text-text-muted bg-bg-surface px-2 py-0.5 rounded border border-border-subtle">
                      PNG com transparência
                    </span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={lpData.url_logo}
                      onChange={e => setLpData({ ...lpData, url_logo: e.target.value })}
                      placeholder="/uploads/marketing/logo.png"
                      className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary text-sm"
                    />
                    <label className="cursor-pointer px-4 py-2.5 bg-bg-deep border border-border-subtle hover:bg-bg-surface rounded-xl text-xs font-semibold text-text-secondary flex items-center gap-1.5 whitespace-nowrap">
                      {uploadingLogo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo')}
                      />
                    </label>
                  </div>
                  {lpData.url_logo && (
                    <div className="mt-2 flex items-center gap-3 p-2 rounded-lg bg-bg-deep border border-border-subtle">
                      <img src={lpData.url_logo} alt="Preview Logo" className="h-8 max-w-[120px] object-contain rounded" />
                      <span className="text-[11px] text-text-muted truncate">Logo carregada para o topo</span>
                    </div>
                  )}
                </div>

                {/* Nome da Empresa no Topo */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary mb-1">
                    Nome da Empresa ao lado da Logo
                  </label>
                  <input
                    type="text"
                    value={lpData.nome_empresa}
                    onChange={e => setLpData({ ...lpData, nome_empresa: e.target.value })}
                    placeholder="Ex.: STELMAT TELEINFORMÁTICA"
                    className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
                  />
                  <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
                    Este nome aparecerá logo ao lado da logo superior. Caso vazio, usará a razão/fantasia da empresa.
                  </p>
                </div>
              </div>
            </div>

            {/* Construtor Visual do Layout (Posicionamento do Formulário e Ordem dos Blocos) */}
            <div className="md:col-span-2 border-t border-border-subtle pt-4 pb-2">
              <CampaignLayoutBuilder
                layout={lpData.layout}
                subtitulos={lpData.subtitulos}
                onChange={newLayout => setLpData(prev => ({ ...prev, layout: newLayout }))}
              />
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

            {/* Subtítulos Explicativos (com suporte a múltiplos blocos organizáveis no layout) */}
            <div className="md:col-span-2 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <AlignJustify className="w-3.5 h-3.5 text-brand-primary" />
                    Subtítulos Explicativos (Blocos para o Layout)
                  </label>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Adicione subtítulos explicativos. Cada um se torna um bloco independente no construtor de layout acima para ser posicionado onde preferir.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSubtitulo}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 border border-brand-primary/30 transition-colors self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Adicionar Outro Subtítulo
                </button>
              </div>

              <div className="space-y-3">
                {lpData.subtitulos.map((sub, idx) => (
                  <div
                    key={sub.id}
                    className="p-3.5 rounded-xl border border-border-subtle bg-bg-surface space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <input
                          type="text"
                          value={sub.rotulo || ''}
                          onChange={e => handleUpdateSubtitulo(idx, 'rotulo', e.target.value)}
                          placeholder={idx === 0 ? 'Subtítulo Principal' : `Subtítulo Explicativo ${idx + 1}`}
                          className="px-2.5 py-1 text-xs font-semibold bg-bg-deep border border-border-subtle rounded-lg text-text-primary focus:outline-none focus:border-brand-primary flex-1 max-w-xs"
                          title="Rótulo de identificação no construtor de layout"
                        />
                        <span className="text-[10px] text-text-muted hidden md:inline truncate">
                          (bloco: {sub.id})
                        </span>
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => handleMoveSubtitulo(idx, 'up')}
                          className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed hover:bg-bg-hover"
                          title="Mover para cima na lista"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === lpData.subtitulos.length - 1}
                          onClick={() => handleMoveSubtitulo(idx, 'down')}
                          className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed hover:bg-bg-hover"
                          title="Mover para baixo na lista"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        {lpData.subtitulos.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveSubtitulo(idx)}
                            className="p-1 text-text-muted hover:text-rose-500 rounded hover:bg-rose-500/10 transition-colors ml-1"
                            title="Remover este subtítulo"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      value={sub.texto}
                      onChange={e => handleUpdateSubtitulo(idx, 'texto', e.target.value)}
                      placeholder={idx === 0
                        ? "Ex.: Proteja seu patrimônio com câmeras inteligentes, portaria remota e controle de acesso integrado com condições especiais."
                        : "Ex.: Explicativo sobre diferenciais técnicos, garantias estendidas ou detalhes da proposta."}
                      className="w-full px-4 py-2.5 bg-bg-deep border border-border-subtle rounded-xl text-text-primary focus:outline-none focus:border-brand-primary text-sm"
                    />
                    <div className="flex items-center justify-between text-[11px] text-text-muted">
                      <span>Diagramação diagramada de forma justificada na Landing Page.</span>
                      <span>{sub.texto.length} caracteres</span>
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-brand-primary" />
                  Imagem do Banner / Produto
                </label>
                <span className="text-[10px] font-semibold text-text-muted bg-bg-surface px-2 py-0.5 rounded border border-border-subtle">
                  Sugerido: 1200 × 800 px
                </span>
              </div>
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
              <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
                Tamanho recomendado: <strong>1200 × 800 px</strong> (proporção 4:3 ou 16:9). Formatos: JPG, PNG ou WebP (máx. 5MB).
              </p>
            </div>

            {/* Imagem de Fundo (Hero Background) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                  <Image className="w-3.5 h-3.5 text-brand-primary" />
                  Imagem de Fundo (Hero Background)
                </label>
                <span className="text-[10px] font-semibold text-text-muted bg-bg-surface px-2 py-0.5 rounded border border-border-subtle">
                  Sugerido: 1920 × 1080 px
                </span>
              </div>
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
              <p className="text-[11px] text-text-muted mt-1.5 leading-relaxed">
                Tamanho recomendado: <strong>1920 × 1080 px</strong> (Full HD widescreen 16:9). Formatos: JPG ou WebP (máx. 5MB).
              </p>
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

            {/* Diferenciais e Benefícios Rápidos (Cards com Título e Subtítulo) */}
            <div className="md:col-span-2 border-t border-border-subtle pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <ListChecks className="w-3.5 h-3.5 text-brand-primary" />
                    Diferenciais e Benefícios Rápidos (Cards de Destaque)
                  </label>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Cadastre, edite ou exclua os cards com selo verde exibidos na Landing Page para destacar diferenciais competitivos.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBeneficio}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-semibold transition-colors self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Card de Benefício
                </button>
              </div>

              {lpData.beneficios.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border-subtle text-center space-y-2 bg-bg-deep/40">
                  <p className="text-xs text-text-muted">Nenhum diferencial cadastrado no momento.</p>
                  <button
                    type="button"
                    onClick={handleAddBeneficio}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary/90 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Adicionar Primeiro Card
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {lpData.beneficios.map((b, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl border border-border-subtle bg-bg-deep/50 space-y-2.5 transition-all hover:border-border-default"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center text-[10px] font-bold">
                            {idx + 1}º
                          </span>
                          <span className="text-xs font-semibold text-text-secondary">
                            Card de Diferencial #{idx + 1}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveBeneficio(idx, 'up')}
                            className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed hover:bg-bg-hover"
                            title="Mover card para cima"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === lpData.beneficios.length - 1}
                            onClick={() => handleMoveBeneficio(idx, 'down')}
                            className="p-1 rounded text-text-muted hover:text-text-primary disabled:opacity-20 disabled:cursor-not-allowed hover:bg-bg-hover"
                            title="Mover card para baixo"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveBeneficio(idx)}
                            className="p-1 rounded text-text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors ml-1"
                            title="Excluir este card"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                            Título do Diferencial *
                          </label>
                          <input
                            type="text"
                            required
                            value={b.titulo}
                            onChange={e => handleUpdateBeneficio(idx, 'titulo', e.target.value)}
                            placeholder="Ex.: Monitoramento 24h Especializado"
                            className="w-full px-3 py-2 bg-bg-surface border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                          />
                        </div>

                        <div className="sm:col-span-7">
                          <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                            Subtítulo / Descrição Explicativa
                          </label>
                          <input
                            type="text"
                            value={b.descricao}
                            onChange={e => handleUpdateBeneficio(idx, 'descricao', e.target.value)}
                            placeholder="Ex.: Equipe técnica certificada de prontidão para atuação imediata..."
                            className="w-full px-3 py-2 bg-bg-surface border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={handleAddBeneficio}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border-subtle hover:border-brand-primary text-xs font-semibold text-text-muted hover:text-brand-primary hover:bg-brand-primary/5 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Adicionar Outro Card de Diferencial
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Campos do Formulário */}
            <div className="md:col-span-2 border-t border-border-subtle pt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-brand-primary" />
                    Campos Exibidos no Formulário de Conversão
                  </label>
                  <p className="text-[11px] text-text-muted mt-0.5">
                    Clique nos botões abaixo para ativar/desativar campos ou cadastre novos botões para o formulário.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewFieldModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary text-xs font-semibold transition-colors self-start sm:self-auto"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Botão / Campo
                </button>
              </div>

              {/* Caixa Inline para Adicionar Novo Campo */}
              {showNewFieldModal && (
                <div className="mb-4 p-4 rounded-xl bg-bg-surface border border-brand-primary/40 shadow-sm space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                      <Plus className="w-3.5 h-3.5 text-brand-primary" />
                      Cadastrar Novo Botão / Campo no Formulário
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowNewFieldModal(false)}
                      className="p-1 rounded text-text-muted hover:text-text-primary"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                        Nome do Campo / Rótulo do Botão *
                      </label>
                      <input
                        type="text"
                        autoFocus
                        value={newFieldLabel}
                        onChange={e => setNewFieldLabel(e.target.value)}
                        placeholder="Ex.: Nome da Empresa, CNPJ, Cargo, Segmento..."
                        className="w-full px-3 py-2 bg-bg-deep border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomField();
                          }
                        }}
                      />
                    </div>

                    <div className="flex flex-col justify-end">
                      <div className="flex items-center gap-2 h-9">
                        <input
                          type="checkbox"
                          id="newFieldRequired"
                          checked={newFieldRequired}
                          onChange={e => setNewFieldRequired(e.target.checked)}
                          className="rounded border-border-subtle text-brand-primary focus:ring-0"
                        />
                        <label htmlFor="newFieldRequired" className="text-xs text-text-secondary cursor-pointer select-none">
                          Campo obrigatório
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAddCustomField}
                      disabled={!newFieldLabel.trim()}
                      className="px-3.5 py-1.5 rounded-lg bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Adicionar Botão
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewFieldLabel('');
                        setNewFieldRequired(false);
                        setShowNewFieldModal(false);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-bg-deep hover:bg-bg-surface text-text-secondary text-xs font-medium border border-border-subtle transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Grid de Botões/Campos Padrões e Personalizados */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                {/* 1. Campos Padrões */}
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
                      className={`p-3 rounded-xl border text-xs cursor-pointer select-none transition-all relative ${
                        isActive
                          ? 'border-brand-primary/50 bg-brand-primary/10 text-text-primary shadow-sm'
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

                {/* 2. Campos/Botões Personalizados Cadastrados */}
                {lpData.campos_personalizados.map(field => {
                  const isActive = lpData.campos_form.includes(field.id);
                  const isRequired = field.obrigatorio || lpData.obrigatorios_form.includes(field.id);
                  return (
                    <div
                      key={field.id}
                      onClick={() => {
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
                      className={`p-3 rounded-xl border text-xs cursor-pointer select-none transition-all relative group ${
                        isActive
                          ? 'border-emerald-500/50 bg-emerald-500/10 text-text-primary shadow-sm'
                          : 'border-border-subtle bg-bg-deep text-text-muted hover:border-border-strong'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <div className="font-semibold truncate pr-2">{field.label}</div>
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            handleRemoveCustomField(field.id);
                          }}
                          title="Excluir este botão/campo"
                          className="text-text-muted hover:text-rose-500 p-0.5 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="text-[10px] mt-1 flex items-center justify-between">
                        <span className={isActive ? 'text-emerald-400 font-medium' : 'text-text-muted'}>
                          {isRequired ? 'Obrigatório' : isActive ? 'Ativo' : 'Desativado'}
                        </span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-bg-surface border border-border-subtle text-text-muted">
                          Personalizado
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Configuração do Botão WhatsApp (Opcional) */}
            <div className="md:col-span-2 border-t border-border-subtle pt-4 pb-2">
              <div className="flex items-center gap-2 mb-1">
                <MessageCircle className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  Botão de Ação Direta via WhatsApp (Opcional)
                </h3>
              </div>
              <p className="text-[11px] text-text-muted mb-3">
                Exiba um botão secundário para contato direto pelo WhatsApp logo abaixo do formulário da Landing Page.
              </p>

              <div className="p-4 rounded-xl bg-bg-surface border border-border-subtle space-y-3">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="whatsapp_cta_ativo"
                    checked={lpData.whatsapp_cta.ativo}
                    onChange={e =>
                      setLpData({
                        ...lpData,
                        whatsapp_cta: { ...lpData.whatsapp_cta, ativo: e.target.checked }
                      })
                    }
                    className="rounded border-border-subtle text-emerald-600 focus:ring-0"
                  />
                  <label htmlFor="whatsapp_cta_ativo" className="text-xs font-semibold text-text-primary cursor-pointer">
                    Habilitar botão de WhatsApp no formulário da Landing Page
                  </label>
                </div>

                {lpData.whatsapp_cta.ativo && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-subtle animate-fade-in">
                    <div>
                      <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                        Número de WhatsApp (DDD + Número) *
                      </label>
                      <input
                        type="text"
                        value={lpData.whatsapp_cta.numero}
                        onChange={e =>
                          setLpData({
                            ...lpData,
                            whatsapp_cta: {
                              ...lpData.whatsapp_cta,
                              numero: e.target.value.replace(/\D/g, '')
                            }
                          })
                        }
                        placeholder="Ex.: 65999998888"
                        className="w-full px-3 py-2 bg-bg-deep border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                      />
                      <span className="text-[10px] text-text-muted mt-1 block">
                        Apenas dígitos (DDD + 9 dígitos)
                      </span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                        Texto do Botão
                      </label>
                      <input
                        type="text"
                        value={lpData.whatsapp_cta.texto}
                        onChange={e =>
                          setLpData({
                            ...lpData,
                            whatsapp_cta: { ...lpData.whatsapp_cta, texto: e.target.value }
                          })
                        }
                        placeholder="Falar direto no WhatsApp"
                        className="w-full px-3 py-2 bg-bg-deep border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                        Mensagem Pré-configurada ao Iniciar Conversa (Opcional)
                      </label>
                      <input
                        type="text"
                        value={lpData.whatsapp_cta.mensagem_padrao}
                        onChange={e =>
                          setLpData({
                            ...lpData,
                            whatsapp_cta: { ...lpData.whatsapp_cta, mensagem_padrao: e.target.value }
                          })
                        }
                        placeholder="Olá! Vi a oferta na página e gostaria de mais informações."
                        className="w-full px-3 py-2 bg-bg-deep border border-border-subtle rounded-lg text-xs text-text-primary focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
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
