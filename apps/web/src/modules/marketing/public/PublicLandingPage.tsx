import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ShieldCheck, CheckCircle2, Phone, Mail, MapPin, MessageSquare,
  AlertCircle, Loader2, Sparkles, Check, ChevronRight, Video, MessageCircle
} from 'lucide-react';

interface PublicLPData {
  id: string;
  slug: string;
  custom_domain?: string | null;
  titulo: string;
  subtitulo?: string | null;
  texto_cta: string;
  url_imagem_banner?: string | null;
  url_imagem_fundo?: string | null;
  url_video?: string | null;
  configuracao_formulario: {
    campos: string[];
    obrigatorios: string[];
    campos_personalizados?: Array<{
      id: string;
      label: string;
      tipo?: string;
      placeholder?: string;
      obrigatorio?: boolean;
    }>;
    whatsapp_cta?: {
      ativo: boolean;
      numero: string;
      texto: string;
      mensagem_padrao?: string;
    };
  };
  configuracao_conteudo: {
    url_logo?: string | null;
    nome_empresa?: string | null;
    beneficios?: Array<{ titulo: string; descricao: string }>;
    faq?: Array<{ pergunta: string; resposta: string }>;
    subtitulos?: Array<{ id: string; rotulo?: string; texto: string }>;
    layout?: {
      posicao_formulario: 'right' | 'left' | 'bottom';
      blocos: Array<{ id: string; visivel: boolean }>;
    };
  };
  cor_primaria: string;
  cor_secundaria: string;
  scripts_cabecalho?: string | null;
  scripts_rodape?: string | null;
  campaign_nome: string;
  company_nome?: string | null;
  company_logo_url?: string | null;
  url_logo?: string | null;
  nome_empresa?: string | null;
}

function getEmbedVideoUrl(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const url = rawUrl.trim();

  // YouTube (watch, youtu.be, shorts, embed)
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}`;
  }

  // Vimeo
  const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // Arquivo direto de vídeo
  if (url.endsWith('.mp4') || url.endsWith('.webm') || url.includes('/uploads/marketing/')) {
    return url;
  }

  // Caso já seja um embed explícito válido
  if (url.includes('/embed/')) {
    return url;
  }

  return null;
}

function isLightColor(hexColor?: string | null): boolean {
  if (!hexColor || typeof hexColor !== 'string') return false;
  const cleanHex = hexColor.replace('#', '').trim();
  let r = 0, g = 0, b = 0;
  if (cleanHex.length === 3) {
    r = parseInt(cleanHex[0] + cleanHex[0], 16);
    g = parseInt(cleanHex[1] + cleanHex[1], 16);
    b = parseInt(cleanHex[2] + cleanHex[2], 16);
  } else if (cleanHex.length === 6) {
    r = parseInt(cleanHex.substring(0, 2), 16);
    g = parseInt(cleanHex.substring(2, 4), 16);
    b = parseInt(cleanHex.substring(4, 6), 16);
  } else {
    return false;
  }
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 160;
}

export const PublicLandingPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [lp, setLp] = useState<PublicLPData | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    nome: '',
    telefone: '',
    email: '',
    cidade: '',
    mensagem: '',
    honeypot: '' // Anti-spam hidden field
  });
  const [customFieldsData, setCustomFieldsData] = useState<Record<string, string>>({});

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const formStartedRef = useRef(false);

  // Session ID & UTMs
  const [sessionId] = useState(() => {
    let sid = sessionStorage.getItem('mkt_session_id');
    if (!sid) {
      sid = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem('mkt_session_id', sid);
    }
    return sid;
  });

  const getUtms = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || undefined,
      utm_medium: params.get('utm_medium') || undefined,
      utm_campaign: params.get('utm_campaign') || undefined,
      utm_content: params.get('utm_content') || undefined,
      utm_term: params.get('utm_term') || undefined,
      referrer: document.referrer || undefined
    };
  };

  // Fetch Public LP
  useEffect(() => {
    const fetchLp = async () => {
      try {
        setLoading(true);
        const hostname = window.location.hostname;
        const res = await axios.get('/api/marketing/public/resolve', {
          params: { domain: hostname, slug: slug || undefined }
        });
        setLp(res.data);

        // Injetar scripts de cabeçalho se houver (Meta Pixel / Analytics)
        if (res.data.scripts_cabecalho) {
          const scriptEl = document.createElement('div');
          scriptEl.innerHTML = res.data.scripts_cabecalho;
          document.head.appendChild(scriptEl);
        }

        // Telemetria: PAGE_VIEW
        axios.post('/api/marketing/public/track', {
          landing_page_id: res.data.id,
          session_id: sessionId,
          event_type: 'PAGE_VIEW'
        }).catch(() => {});
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Página não encontrada ou inativa.');
      } finally {
        setLoading(false);
      }
    };
    fetchLp();
  }, [slug]);

  // Telemetria: FORM_START
  const handleFormFocus = () => {
    if (!formStartedRef.current && lp) {
      formStartedRef.current = true;
      axios.post('/api/marketing/public/track', {
        landing_page_id: lp.id,
        session_id: sessionId,
        event_type: 'FORM_START'
      }).catch(() => {});
    }
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lp) return;

    setSubmitError(null);
    setSubmitting(true);

    try {
      const utms = getUtms();
      const payload = {
        landing_page_id: lp.id,
        dados_formulario: {
          nome: formData.nome,
          telefone: formData.telefone,
          email: formData.email,
          cidade: formData.cidade,
          mensagem: formData.mensagem,
          ...customFieldsData
        },
        ...utms,
        session_id: sessionId,
        honeypot: formData.honeypot
      };

      await axios.post('/api/marketing/public/submit', payload);
      setSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.response?.data?.detail || 'Erro ao enviar dados. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <span className="text-sm text-slate-400 font-medium">Carregando apresentação...</span>
      </div>
    );
  }

  if (error || !lp) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center text-white">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2">Página Indisponível</h2>
          <p className="text-sm text-slate-400">
            {error || 'Esta página não existe ou não está mais ativa.'}
          </p>
        </div>
      </div>
    );
  }

  const primaryColor = lp.cor_primaria || '#0f172a';
  const accentColor = lp.cor_secundaria || '#F59E0B';
  const isLight = isLightColor(primaryColor);
  const isAccentLight = isLightColor(accentColor);
  const campos = lp.configuracao_formulario?.campos || ['nome', 'telefone', 'email', 'cidade', 'mensagem'];

  const headerLogo = lp.url_logo || lp.configuracao_conteudo?.url_logo || lp.company_logo_url;
  const headerNomeEmpresa = lp.nome_empresa || lp.configuracao_conteudo?.nome_empresa || lp.company_nome;

  const layoutConfig = lp.configuracao_conteudo?.layout;
  const formPosition = layoutConfig?.posicao_formulario || 'right';

  const defaultBlockOrder = [
    { id: 'badge', visivel: true },
    { id: 'titulo', visivel: true },
    { id: 'subtitulo', visivel: true },
    { id: 'banner', visivel: true },
    { id: 'video', visivel: true },
    { id: 'beneficios', visivel: true }
  ];

  const blocksToRender = (layoutConfig?.blocos && layoutConfig.blocos.length > 0)
    ? layoutConfig.blocos
    : defaultBlockOrder;

  const renderBlock = (blockId: string) => {
    switch (blockId) {
      case 'badge':
        return (
          <div
            key="badge"
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
              isLight
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> Oportunidade por Tempo Limitado
          </div>
        );

      case 'titulo':
        return (
          <h1
            key="titulo"
            className={`text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight ${
              isLight ? 'text-slate-950' : 'text-white'
            }`}
          >
            {lp.titulo}
          </h1>
        );

      case 'subtitulo': {
        const primaryItem = lp.configuracao_conteudo?.subtitulos?.find(s => s.id === 'subtitulo');
        const text = primaryItem?.texto || lp.subtitulo;
        if (!text) return null;
        return (
          <p
            key="subtitulo"
            className={`text-sm sm:text-base md:text-[17px] leading-relaxed sm:leading-7 md:leading-8 text-justify hyphens-auto ${
              formPosition === 'bottom' ? 'max-w-3xl mx-auto' : 'max-w-2xl'
            } ${isLight ? 'text-slate-700' : 'text-slate-300'}`}
            style={{
              textAlign: 'justify',
              textJustify: 'inter-word',
              hyphens: 'auto',
              WebkitHyphens: 'auto'
            }}
          >
            {text}
          </p>
        );
      }

      case 'banner':
        if (!lp.url_imagem_banner) return null;
        return (
          <div
            key="banner"
            className={`w-full rounded-2xl overflow-hidden border shadow-2xl group ${
              isLight ? 'border-slate-200 bg-white shadow-slate-300/40' : 'border-slate-800 bg-slate-900'
            }`}
          >
            <img
              src={lp.url_imagem_banner}
              alt={lp.titulo}
              className="w-full h-auto max-h-[440px] object-cover transition-transform duration-500 group-hover:scale-[1.01]"
            />
          </div>
        );

      case 'video': {
        const embedUrl = getEmbedVideoUrl(lp.url_video);
        if (!embedUrl) return null;
        return (
          <div key="video" className="space-y-2">
            <div
              className={`flex items-center gap-2 text-xs font-semibold pt-1 ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}
            >
              <Video className={`w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`} />
              <span>Vídeo Demonstrativo</span>
            </div>
            <div
              className={`aspect-video w-full rounded-2xl overflow-hidden border shadow-2xl ${
                isLight ? 'border-slate-200 bg-black/80' : 'border-slate-800 bg-black/60'
              }`}
            >
              {embedUrl.endsWith('.mp4') || embedUrl.endsWith('.webm') || embedUrl.includes('/uploads/') ? (
                <video src={embedUrl} controls className="w-full h-full object-cover" />
              ) : (
                <iframe
                  src={embedUrl}
                  title="Vídeo Apresentação"
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              )}
            </div>
          </div>
        );
      }

      case 'beneficios':
        if (!lp.configuracao_conteudo?.beneficios || lp.configuracao_conteudo.beneficios.length === 0) {
          return null;
        }
        return (
          <div key="beneficios" className="pt-2 space-y-3">
            {lp.configuracao_conteudo.beneficios.map((b, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3 rounded-xl border ${
                  isLight
                    ? 'bg-white/90 border-slate-200 shadow-sm'
                    : 'bg-slate-900/50 border-slate-800/80'
                }`}
              >
                <div
                  className={`p-1 rounded flex-shrink-0 mt-0.5 ${
                    isLight
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                      : 'bg-emerald-500/10 text-emerald-400'
                  }`}
                >
                  <Check className="w-4 h-4" />
                </div>
                <div>
                  <div className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>{b.titulo}</div>
                  <div className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{b.descricao}</div>
                </div>
              </div>
            ))}
          </div>
        );

      default: {
        if (blockId.startsWith('subtitulo')) {
          const subItem = lp.configuracao_conteudo?.subtitulos?.find(s => s.id === blockId);
          if (!subItem?.texto) return null;
          return (
            <p
              key={blockId}
              className={`text-sm sm:text-base md:text-[17px] leading-relaxed sm:leading-7 md:leading-8 text-justify hyphens-auto ${
                formPosition === 'bottom' ? 'max-w-3xl mx-auto' : 'max-w-2xl'
              } ${isLight ? 'text-slate-700' : 'text-slate-300'}`}
              style={{
                textAlign: 'justify',
                textJustify: 'inter-word',
                hyphens: 'auto',
                WebkitHyphens: 'auto'
              }}
            >
              {subItem.texto}
            </p>
          );
        }
        return null;
      }
    }
  };

  const inputBgClass = isLight
    ? 'w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:bg-white transition-colors'
    : 'w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors';

  const textareaBgClass = isLight
    ? 'w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:bg-white transition-colors'
    : 'w-full px-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors';

  const labelClass = `block text-xs font-semibold mb-1 ${isLight ? 'text-slate-700' : 'text-slate-300'}`;
  const labelWithIconClass = `block text-xs font-semibold mb-1 flex items-center gap-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`;
  const iconClass = `w-3.5 h-3.5 ${isLight ? 'text-blue-600' : 'text-blue-400'}`;

  return (
    <div
      className={`min-h-screen font-sans transition-colors duration-300 ${
        isLight ? 'text-slate-900 selection:bg-blue-600 selection:text-white' : 'text-slate-100 selection:bg-blue-600 selection:text-white'
      }`}
      style={{
        backgroundColor: primaryColor,
        backgroundImage: lp.url_imagem_fundo
          ? `linear-gradient(to bottom, ${
              isLight
                ? 'rgba(255, 255, 255, 0.88), rgba(255, 255, 255, 0.96)'
                : 'rgba(2, 6, 23, 0.88), rgba(2, 6, 23, 0.96)'
            }), url(${lp.url_imagem_fundo})`
          : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Top Header */}
      <header
        className={`border-b sticky top-0 z-40 backdrop-blur-md transition-colors ${
          isLight ? 'border-slate-200/90 bg-white/80 shadow-sm' : 'border-slate-800/80 bg-slate-950/70'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {headerLogo ? (
              <img
                src={headerLogo}
                alt={headerNomeEmpresa || 'Logo'}
                className="h-9 w-auto max-w-[180px] object-contain rounded"
              />
            ) : (
              <div
                className="h-9 px-3 rounded-lg flex items-center justify-center font-bold text-sm shadow"
                style={{
                  backgroundColor: primaryColor,
                  color: isLight ? '#0f172a' : '#ffffff',
                  border: isLight ? '1px solid #e2e8f0' : undefined
                }}
              >
                {headerNomeEmpresa || 'CERBERUS'}
              </div>
            )}
            {headerNomeEmpresa && (
              <span className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                {headerNomeEmpresa}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" /> Atendimento Exclusivo
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Coluna de Conteúdo */}
          <div
            className={`space-y-6 ${
              formPosition === 'bottom'
                ? 'lg:col-span-12 max-w-4xl mx-auto w-full order-1'
                : formPosition === 'left'
                ? 'lg:col-span-7 order-2'
                : 'lg:col-span-7 order-1'
            }`}
          >
            {blocksToRender
              .filter(b => b.visivel !== false)
              .map(b => renderBlock(b.id))}
          </div>

          {/* Coluna do Formulário de Captura */}
          <div
            className={`${
              formPosition === 'bottom'
                ? 'lg:col-span-12 max-w-xl mx-auto w-full order-2 mt-4'
                : formPosition === 'left'
                ? 'lg:col-span-5 order-1 w-full'
                : 'lg:col-span-5 order-2 w-full'
            }`}
          >
            <div
              className={`border rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative transition-colors ${
                isLight
                  ? 'bg-white/95 border-slate-200 shadow-slate-300/40 text-slate-900'
                  : 'bg-slate-900/90 border-slate-800 text-white'
              }`}
            >
              {submitted ? (
                <div className="py-12 text-center space-y-4 animate-fade-in">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                      isLight ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-emerald-500/10 text-emerald-400'
                    }`}
                  >
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className={`text-2xl font-bold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                    Solicitação Recebida!
                  </h3>
                  <p className={`text-sm leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                    Agradecemos seu interesse. Nossa equipe comercial já recebeu seus dados e entrará em contato o mais breve possível.
                  </p>
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        setSubmitted(false);
                        setFormData({ nome: '', telefone: '', email: '', cidade: '', mensagem: '', honeypot: '' });
                        setCustomFieldsData({});
                      }}
                      className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                        isLight
                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      Enviar Outra Mensagem
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} onFocus={handleFormFocus} className="space-y-4">
                  <div>
                    <span
                      className={`text-xs font-semibold uppercase tracking-wider ${
                        isLight ? 'text-blue-600' : 'text-blue-400'
                      }`}
                    >
                      Receba uma Proposta Sem Compromisso
                    </span>
                    <h3 className={`text-xl font-bold mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Preencha seus dados abaixo
                    </h3>
                  </div>

                  {submitError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  {/* Honeypot invisível contra bots */}
                  <input
                    type="text"
                    name="website_url_check"
                    tabIndex={-1}
                    autoComplete="off"
                    value={formData.honeypot}
                    onChange={e => setFormData({ ...formData, honeypot: e.target.value })}
                    className="opacity-0 absolute -z-10 h-0 w-0 pointer-events-none"
                  />

                  {/* Nome Completo */}
                  {campos.includes('nome') && (
                    <div>
                      <label className={labelClass}>
                        Seu Nome Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Ex.: Carlos Mendes"
                        className={inputBgClass}
                      />
                    </div>
                  )}

                  {/* WhatsApp / Telefone */}
                  {campos.includes('telefone') && (
                    <div>
                      <label className={labelWithIconClass}>
                        <Phone className={iconClass} />
                        WhatsApp / Celular com DDD *
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.telefone}
                        onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                        placeholder="(00) 90000-0000"
                        className={inputBgClass}
                      />
                    </div>
                  )}

                  {/* E-mail */}
                  {campos.includes('email') && (
                    <div>
                      <label className={labelWithIconClass}>
                        <Mail className={iconClass} />
                        E-mail de Contato
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="carlos@exemplo.com.br"
                        className={inputBgClass}
                      />
                    </div>
                  )}

                  {/* Cidade / Estado */}
                  {campos.includes('cidade') && (
                    <div>
                      <label className={labelWithIconClass}>
                        <MapPin className={iconClass} />
                        Cidade / Região
                      </label>
                      <input
                        type="text"
                        value={formData.cidade}
                        onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                        placeholder="Ex.: Cuiabá - MT"
                        className={inputBgClass}
                      />
                    </div>
                  )}

                  {/* Mensagem / Interesse */}
                  {campos.includes('mensagem') && (
                    <div>
                      <label className={labelWithIconClass}>
                        <MessageSquare className={iconClass} />
                        O que você procura? (Opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={formData.mensagem}
                        onChange={e => setFormData({ ...formData, mensagem: e.target.value })}
                        placeholder="Ex.: Tenho interesse em alarme e 12 câmeras para meu condomínio..."
                        className={textareaBgClass}
                      />
                    </div>
                  )}

                  {/* Campos Personalizados Adicionais */}
                  {lp.configuracao_formulario?.campos_personalizados?.map(cf => {
                    if (!campos.includes(cf.id)) return null;
                    const isRequired = Boolean(cf.obrigatorio || lp.configuracao_formulario?.obrigatorios?.includes(cf.id));
                    return (
                      <div key={cf.id}>
                        <label className={labelClass}>
                          {cf.label} {isRequired && '*'}
                        </label>
                        <input
                          type={cf.tipo || 'text'}
                          required={isRequired}
                          value={customFieldsData[cf.id] || ''}
                          onChange={e => setCustomFieldsData(prev => ({ ...prev, [cf.id]: e.target.value }))}
                          placeholder={cf.placeholder || `Informe ${cf.label.toLowerCase()}...`}
                          className={inputBgClass}
                        />
                      </div>
                    );
                  })}

                  {/* Botão CTA Principal */}
                  <div className="pt-2 space-y-2.5">
                    <button
                      type="submit"
                      disabled={submitting}
                      className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2 shadow-xl hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60 ${
                        isAccentLight ? 'text-slate-950' : 'text-white'
                      }`}
                      style={{ backgroundColor: accentColor }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Enviando dados...</span>
                        </>
                      ) : (
                        <>
                          <span>{lp.texto_cta || 'Quero uma Proposta Personalizada'}</span>
                          <ChevronRight className="w-5 h-5" />
                        </>
                      )}
                    </button>

                    {/* Botão de Ação WhatsApp (Opcional) */}
                    {lp.configuracao_formulario?.whatsapp_cta?.ativo && lp.configuracao_formulario.whatsapp_cta.numero && (
                      <a
                        href={`https://wa.me/${lp.configuracao_formulario.whatsapp_cta.numero.replace(/\D/g, '')}?text=${encodeURIComponent(
                          lp.configuracao_formulario.whatsapp_cta.mensagem_padrao || `Olá! Gostaria de mais informações sobre ${lp.titulo}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          axios.post('/api/marketing/public/track', {
                            landing_page_id: lp.id,
                            session_id: sessionId,
                            event_type: 'CTA_CLICK',
                            metadata: { button: 'whatsapp' }
                          }).catch(() => {});
                        }}
                        className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20 transition-all active:scale-[0.99]"
                      >
                        <MessageCircle className="w-4 h-4" />
                        <span>{lp.configuracao_formulario.whatsapp_cta.texto || 'Chamar direto no WhatsApp'}</span>
                      </a>
                    )}
                  </div>

                  <p
                    className={`text-[11px] text-center pt-2 flex items-center justify-center gap-1 ${
                      isLight ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                    Seus dados estão protegidos e não enviamos spam.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer
        className={`border-t py-8 text-center text-xs transition-colors ${
          isLight
            ? 'border-slate-200 bg-white/80 text-slate-600'
            : 'border-slate-900 bg-slate-950 text-slate-500'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <p>© {new Date().getFullYear()} {headerNomeEmpresa || 'Cerberus'}. Todos os direitos reservados.</p>
          <p className={`text-[11px] ${isLight ? 'text-slate-500' : 'text-slate-600'}`}>
            Página de divulgação comercial oficial. Desenvolvido e monitorado via Cerberus Engine.
          </p>
        </div>
      </footer>
    </div>
  );
};
