import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import {
  ShieldCheck, CheckCircle2, Phone, Mail, MapPin, MessageSquare,
  AlertCircle, Loader2, Sparkles, Check, ChevronRight
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
  };
  configuracao_conteudo: {
    beneficios?: Array<{ titulo: string; descricao: string }>;
    faq?: Array<{ pergunta: string; resposta: string }>;
  };
  cor_primaria: string;
  cor_secundaria: string;
  scripts_cabecalho?: string | null;
  scripts_rodape?: string | null;
  campaign_nome: string;
  company_nome?: string | null;
  company_logo_url?: string | null;
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
          mensagem: formData.mensagem
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

  const primaryColor = lp.cor_primaria || '#1E40AF';
  const accentColor = lp.cor_secundaria || '#F59E0B';
  const campos = lp.configuracao_formulario?.campos || ['nome', 'telefone', 'email', 'cidade', 'mensagem'];

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-blue-600 selection:text-white"
      style={{
        backgroundImage: lp.url_imagem_fundo ? `linear-gradient(to bottom, rgba(2, 6, 23, 0.88), rgba(2, 6, 23, 0.96)), url(${lp.url_imagem_fundo})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed'
      }}
    >
      {/* Top Header */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {lp.company_logo_url ? (
              <img src={lp.company_logo_url} alt={lp.company_nome || 'Logo'} className="h-9 w-auto object-contain rounded" />
            ) : (
              <div
                className="h-9 px-3 rounded-lg flex items-center justify-center font-bold text-sm text-white shadow"
                style={{ backgroundColor: primaryColor }}
              >
                {lp.company_nome || 'CERBERUS'}
              </div>
            )}
            {lp.company_nome && (
              <span className="text-sm font-semibold text-slate-200 hidden sm:inline">
                {lp.company_nome}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-3.5 h-3.5" /> Atendimento Exclusivo
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-4 py-10 md:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Coluna Esquerda: Headline & Mídia */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-3.5 h-3.5" /> Oportunidade por Tempo Limitado
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white leading-tight">
              {lp.titulo}
            </h1>

            {lp.subtitulo && (
              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-xl">
                {lp.subtitulo}
              </p>
            )}

            {/* Mídia: Vídeo ou Banner */}
            {(() => {
              const embedUrl = getEmbedVideoUrl(lp.url_video);
              if (embedUrl) {
                const isFileVideo = embedUrl.endsWith('.mp4') || embedUrl.endsWith('.webm') || embedUrl.includes('/uploads/');
                if (isFileVideo) {
                  return (
                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black/60">
                      <video src={embedUrl} controls className="w-full h-full object-cover" />
                    </div>
                  );
                }
                return (
                  <div className="aspect-video w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-black/60">
                    <iframe
                      src={embedUrl}
                      title="Vídeo Apresentação"
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                );
              }
              if (lp.url_imagem_banner) {
                return (
                  <div className="w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl bg-slate-900">
                    <img
                      src={lp.url_imagem_banner}
                      alt={lp.titulo}
                      className="w-full h-auto max-h-[380px] object-cover"
                    />
                  </div>
                );
              }
              return null;
            })()}

            {/* Diferenciais / Benefícios Rápidos */}
            {lp.configuracao_conteudo?.beneficios && lp.configuracao_conteudo.beneficios.length > 0 && (
              <div className="pt-4 space-y-3">
                {lp.configuracao_conteudo.beneficios.map((b, idx) => (
                  <div key={idx} className="flex items-start gap-3 bg-slate-900/50 p-3 rounded-xl border border-slate-800/80">
                    <div className="p-1 rounded bg-emerald-500/10 text-emerald-400 flex-shrink-0 mt-0.5">
                      <Check className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{b.titulo}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{b.descricao}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Coluna Direita: Formulário de Captura */}
          <div className="lg:col-span-5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative">
              {submitted ? (
                <div className="py-12 text-center space-y-4 animate-fade-in">
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-2xl font-bold text-white">Solicitação Recebida!</h3>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    Agradecemos seu interesse. Nossa equipe comercial já recebeu seus dados e entrará em contato o mais breve possível.
                  </p>
                  <div className="pt-4">
                    <button
                      onClick={() => {
                        setSubmitted(false);
                        setFormData({ nome: '', telefone: '', email: '', cidade: '', mensagem: '', honeypot: '' });
                      }}
                      className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                    >
                      Enviar Outra Mensagem
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} onFocus={handleFormFocus} className="space-y-4">
                  <div>
                    <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">
                      Receba uma Proposta Sem Compromisso
                    </span>
                    <h3 className="text-xl font-bold text-white mt-1">Preencha seus dados abaixo</h3>
                  </div>

                  {submitError && (
                    <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
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
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Seu Nome Completo *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.nome}
                        onChange={e => setFormData({ ...formData, nome: e.target.value })}
                        placeholder="Ex.: Carlos Mendes"
                        className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  )}

                  {/* WhatsApp / Telefone */}
                  {campos.includes('telefone') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-blue-400" />
                        WhatsApp / Celular com DDD *
                      </label>
                      <input
                        type="tel"
                        required
                        value={formData.telefone}
                        onChange={e => setFormData({ ...formData, telefone: e.target.value })}
                        placeholder="(00) 90000-0000"
                        className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  )}

                  {/* E-mail */}
                  {campos.includes('email') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        E-mail de Contato
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        placeholder="carlos@exemplo.com.br"
                        className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  )}

                  {/* Cidade / Estado */}
                  {campos.includes('cidade') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-400" />
                        Cidade / Região
                      </label>
                      <input
                        type="text"
                        value={formData.cidade}
                        onChange={e => setFormData({ ...formData, cidade: e.target.value })}
                        placeholder="Ex.: Cuiabá - MT"
                        className="w-full px-4 py-3 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  )}

                  {/* Mensagem / Interesse */}
                  {campos.includes('mensagem') && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                        O que você procura? (Opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={formData.mensagem}
                        onChange={e => setFormData({ ...formData, mensagem: e.target.value })}
                        placeholder="Ex.: Tenho interesse em alarme e 12 câmeras para meu condomínio..."
                        className="w-full px-4 py-2.5 bg-slate-950/80 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  )}

                  {/* Botão CTA Principal */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-4 px-6 rounded-2xl font-bold text-base text-slate-950 flex items-center justify-center gap-2 shadow-xl hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-60"
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
                  </div>

                  <p className="text-[11px] text-center text-slate-500 pt-2 flex items-center justify-center gap-1">
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
      <footer className="border-t border-slate-900 bg-slate-950 py-8 text-center text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 space-y-2">
          <p>© {new Date().getFullYear()} {lp.company_nome || 'Cerberus'}. Todos os direitos reservados.</p>
          <p className="text-[11px] text-slate-600">
            Página de divulgação comercial oficial. Desenvolvido e monitorado via Cerberus Engine.
          </p>
        </div>
      </footer>
    </div>
  );
};
