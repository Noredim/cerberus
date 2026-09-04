export interface MarketingCampaign {
  id: string;
  tenant_id: string;
  company_id: string;
  sales_team_id?: string | null;
  sales_team_nome?: string | null;
  nome: string;
  descricao?: string | null;
  status: 'RASCUNHO' | 'ATIVA' | 'PAUSADA' | 'ENCERRADA';
  canal_origem: string;
  orcamento_total?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
  landing_pages_count: number;
  leads_count: number;
  views_count: number;
}

export type LayoutBlockId = string;

export interface LayoutBlockItem {
  id: string;
  visivel: boolean;
}

export interface SubtitleItem {
  id: string;
  texto: string;
  rotulo?: string;
}

export interface LayoutConfig {
  posicao_formulario: 'right' | 'left' | 'bottom';
  blocos: LayoutBlockItem[];
}

export interface MarketingLandingPage {
  id: string;
  tenant_id: string;
  campaign_id: string;
  campaign_nome?: string | null;
  slug: string;
  custom_domain?: string | null;
  is_default_for_domain: boolean;
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
    beneficios?: Array<{ titulo: string; descricao: string; icone?: string }>;
    faq?: Array<{ pergunta: string; resposta: string }>;
    subtitulos?: SubtitleItem[];
    layout?: LayoutConfig;
  };
  cor_primaria: string;
  cor_secundaria: string;
  scripts_cabecalho?: string | null;
  scripts_rodape?: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  submissions_count: number;
  views_count: number;
}

export interface CampaignMetrics {
  campaign_id: string;
  campaign_nome: string;
  status: string;
  total_views: number;
  total_cta_clicks: number;
  total_form_starts: number;
  total_submissions: number;
  conversion_rate: number;
  leads_generated: number;
  top_utm_sources: Array<{ source: string; conversions: number }>;
}

export interface MarketingSubmission {
  id: string;
  landing_page_id: string;
  campaign_id: string;
  lead_id?: string | null;
  dados_formulario: Record<string, any>;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
  referrer?: string | null;
  status: string;
  created_at: string;
  lead_nome?: string | null;
  lead_status?: string | null;
  vendedor_nome?: string | null;
}
