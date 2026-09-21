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

function getYouTubeId(rawUrl?: string | null): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const match = rawUrl.trim().match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/i);
  return match && match[1] ? match[1] : null;
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

const LiteVideoPlayer: React.FC<{ url: string; isLight: boolean; titulo?: string }> = ({ url, isLight, titulo }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const ytId = getYouTubeId(url);
  const embedUrl = getEmbedVideoUrl(url);

  if (!embedUrl) return null;

  // Se for arquivo direto (MP4/WebM)
  if (embedUrl.endsWith('.mp4') || embedUrl.endsWith('.webm') || embedUrl.includes('/uploads/')) {
    return (
      <div className={`aspect-video w-full rounded-2xl overflow-hidden border shadow-2xl ${
        isLight ? 'border-slate-200 bg-black/80' : 'border-slate-800 bg-black/60'
      }`}>
        <video src={embedUrl} controls preload="metadata" className="w-full h-full object-cover" />
      </div>
    );
  }

  // Se for YouTube e o usuário ainda não clicou em Play: Padrão Facade Ultraleve
  if (ytId && !isPlaying) {
    const thumbUrl = `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`;
    return (
      <div
        className={`aspect-video w-full rounded-2xl overflow-hidden border shadow-2xl relative group cursor-pointer ${
          isLight ? 'border-slate-200 bg-black/80' : 'border-slate-800 bg-black/60'
        }`}
        onClick={() => setIsPlaying(true)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIsPlaying(true); }}
        aria-label="Assistir ao vídeo de apresentação"
      >
        <img
          src={thumbUrl}
          alt={titulo || 'Vídeo de apresentação'}
          fetchPriority="high"
          loading="eager"
          decoding="async"
          className="w-full h-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105 group-hover:opacity-100"
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors flex items-center justify-center">
          <div className="w-16 h-12 sm:w-20 sm:h-14 bg-red-600/90 group-hover:bg-red-600 text-white rounded-2xl flex items-center justify-center shadow-2xl transition-all duration-300 group-hover:scale-110">
            <svg className="w-6 h-6 sm:w-7 sm:h-7 fill-current translate-x-0.5" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Iframe ativo (carregado apenas sob demanda com autoplay)
  const fullEmbedUrl = ytId
    ? `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0`
    : embedUrl;

  return (
    <div className={`aspect-video w-full rounded-2xl overflow-hidden border shadow-2xl ${
      isLight ? 'border-slate-200 bg-black/80' : 'border-slate-800 bg-black/60'
    }`}>
      <iframe
        src={fullEmbedUrl}
        title={titulo || "Vídeo Apresentação"}
        className="w-full h-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
};

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

  // Fetch Public LP (com suporte a Preload antecipado no index.html)
  useEffect(() => {
    let isMounted = true;

    const applyData = (data: PublicLPData) => {
      if (!isMounted) return;
      setLp(data);
      setLoading(false);

      // Telemetria: PAGE_VIEW
      axios.post('/api/marketing/public/track', {
        landing_page_id: data.id,
        session_id: sessionId,
        event_type: 'PAGE_VIEW'
      }).catch(() => {});
    };

    const fetchLp = async () => {
      try {
        if (typeof window !== 'undefined' && (window as any).__MKT_LP_PRELOAD__) {
          const preloaded = await (window as any).__MKT_LP_PRELOAD__;
          if (preloaded && preloaded.id) {
            applyData(preloaded);
            return;
          }
        }

        const hostname = window.location.hostname;
        const res = await axios.get('/api/marketing/public/resolve', {
          params: { domain: hostname, slug: slug || undefined }
        });
        applyData(res.data);
      } catch (err: any) {
        if (isMounted) {
          setError(err.response?.data?.detail || 'Página não encontrada ou inativa.');
          setLoading(false);
        }
      }
    };

    fetchLp();

    return () => {
      isMounted = false;
    };
  }, [slug, sessionId]);

  // Injetar scripts de rastreamento (Meta Pixel / Analytics / GTM) sob interação ou delay seguro
  useEffect(() => {
    if (!lp?.scripts_cabecalho || loading) return;

    let injected = false;
    const createdElements: HTMLElement[] = [];

    const injectScripts = () => {
      if (injected) return;
      injected = true;

      // Remover listeners de interação
      removeListeners();

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = lp.scripts_cabecalho || '';

      // 1. Processar e instanciar tags <script>
      const scripts = tempDiv.querySelectorAll('script');
      scripts.forEach((oldScript) => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach((attr) => {
          newScript.setAttribute(attr.name, attr.value);
        });
        newScript.setAttribute('data-lp-tracking', 'true');
        newScript.text = oldScript.textContent || oldScript.innerText || '';
        document.head.appendChild(newScript);
        createdElements.push(newScript);
      });

      // 2. Processar outros elementos válidos (ex: <noscript>, <style>, <meta>)
      Array.from(tempDiv.childNodes).forEach((node) => {
        if (node.nodeName.toLowerCase() !== 'script' && node.nodeType === Node.ELEMENT_NODE) {
          const el = (node as HTMLElement).cloneNode(true) as HTMLElement;
          el.setAttribute('data-lp-tracking', 'true');
          document.head.appendChild(el);
          createdElements.push(el);
        }
      });
    };

    const triggerEvents = ['scroll', 'touchstart', 'mousemove', 'keydown', 'click'];
    const onUserInteraction = () => {
      injectScripts();
    };

    const removeListeners = () => {
      triggerEvents.forEach((ev) => {
        window.removeEventListener(ev, onUserInteraction);
      });
    };

    // Adicionar listeners de interação do usuário
    triggerEvents.forEach((ev) => {
      window.addEventListener(ev, onUserInteraction, { once: true, passive: true });
    });

    // Fallback: se o usuário não interagir em 4.5s, injeta suavemente
    const fallbackTimer = setTimeout(injectScripts, 4500);

    return () => {
      clearTimeout(fallbackTimer);
      removeListeners();
      createdElements.forEach((el) => {
        try {
          if (el.parentNode) {
            el.parentNode.removeChild(el);
          }
        } catch {
          // Cleanup silencioso
        }
      });
    };
  }, [lp?.scripts_cabecalho, loading]);

// Helper seguro para disparo de eventos no Meta Pixel
const trackPixelEvent = (eventName: string, params?: Record<string, any>) => {
  try {
    if (typeof window !== 'undefined' && typeof (window as any).fbq === 'function') {
      if (params) {
        (window as any).fbq('track', eventName, params);
      } else {
        (window as any).fbq('track', eventName);
      }
    }
  } catch (err) {
    console.debug('Meta Pixel track error:', err);
  }
};

  // Meta Pixel: ViewContent (ao rolar a página até a área de diferenciais/conteúdo)
  const viewContentFiredRef = useRef(false);
  useEffect(() => {
    if (!lp || viewContentFiredRef.current) return;

    const handleScroll = () => {
      if (viewContentFiredRef.current) return;
      const scrollY = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;

      // Disparar se rolou pelo menos 200px ou 20% da altura da página
      if (scrollY > 200 || (docHeight > 0 && scrollY / docHeight >= 0.2)) {
        viewContentFiredRef.current = true;
        trackPixelEvent('ViewContent', {
          content_name: lp.titulo,
          content_category: 'Landing Page'
        });
        window.removeEventListener('scroll', handleScroll);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const timer = setTimeout(handleScroll, 1200);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [lp]);

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

    // Telemetria Cerberus: Clique no CTA do Formulário
    axios.post('/api/marketing/public/track', {
      landing_page_id: lp.id,
      session_id: sessionId,
      event_type: 'CTA_CLICK',
      metadata: { button: 'form_submit' }
    }).catch(() => {});

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

      // Meta Pixel: Lead (conversão de formulário concluída)
      trackPixelEvent('Lead', {
        content_name: lp.titulo,
        currency: 'BRL',
        value: 0
      });
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
              fetchPriority="high"
              decoding="async"
              className="w-full h-auto max-h-[440px] object-cover transition-transform duration-500 group-hover:scale-[1.01]"
            />
          </div>
        );

      case 'video': {
        if (!lp.url_video) return null;
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
            <LiteVideoPlayer url={lp.url_video} isLight={isLight} titulo={lp.titulo} />
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
      className={`min-h-screen font-sans ${
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
        className={`border-b sticky top-0 z-40 backdrop-blur-md ${
          isLight ? 'border-slate-200/90 bg-white/80 shadow-sm' : 'border-slate-800/80 bg-slate-950/70'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 py-2.5 sm:py-3.5 flex items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-1 sm:gap-3 min-w-0">
            {headerLogo ? (
              <img
                src={headerLogo}
                alt={headerNomeEmpresa || 'Logo'}
                width={140}
                height={28}
                loading="lazy"
                decoding="async"
                className="h-7 sm:h-9 w-auto max-w-[140px] sm:max-w-[180px] object-contain rounded"
              />
            ) : (
              <div
                className="h-7 sm:h-9 px-2.5 sm:px-3 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm shadow"
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
              <span className={`text-[11px] sm:text-sm font-semibold leading-tight line-clamp-2 sm:line-clamp-1 ${isLight ? 'text-slate-900' : 'text-slate-200'}`}>
                {headerNomeEmpresa}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-semibold whitespace-nowrap ${
                isLight
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" /> Atendimento Exclusivo
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
                    <h2 className={`text-xl font-bold mt-1 ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      Preencha seus dados abaixo
                    </h2>
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
                    aria-label="website_url_check"
                    aria-hidden="true"
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

                          // Meta Pixel: Contact (contato iniciado via WhatsApp)
                          trackPixelEvent('Contact', {
                            content_name: 'WhatsApp Click',
                            content_category: lp.titulo
                          });
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
        className={`border-t py-8 text-center text-xs ${
          isLight
            ? 'border-slate-200 bg-white/90 text-slate-700'
            : 'border-slate-900 bg-slate-950 text-slate-300'
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <p>© {new Date().getFullYear()} {headerNomeEmpresa || 'Cerberus'}. Todos os direitos reservados.</p>
          <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
            Página de divulgação comercial oficial. Desenvolvido e monitorado via Cerberus Engine.
          </p>
        </div>
      </footer>
    </div>
  );
};
