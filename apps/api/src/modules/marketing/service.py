import uuid
import hashlib
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_, and_

from src.modules.marketing.models import (
    MarketingCampaign, MarketingLandingPage, MarketingSubmission, MarketingEvent
)
from src.modules.marketing.schemas import (
    CampaignCreate, CampaignUpdate, LandingPageCreate, LandingPageUpdate,
    PublicSubmissionCreate, PublicEventCreate, CampaignMetricsResponse
)
from src.modules.leads.models import (
    Lead, LeadTimeline, LeadDistributionHistory
)
from src.modules.leads.service import (
    get_next_queue_vendor, _notify_vendor_new_lead
)
from src.modules.companies.models import Company, SalesTeam


class MarketingService:

    # ─── CAMPANHAS ───

    @staticmethod
    def create_campaign(db: Session, tenant_id: str, company_id: UUID, current_user_id: str, data: CampaignCreate) -> MarketingCampaign:
        campaign = MarketingCampaign(
            tenant_id=tenant_id,
            company_id=company_id,
            sales_team_id=data.sales_team_id,
            nome=data.nome,
            descricao=data.descricao,
            status=data.status,
            canal_origem=data.canal_origem,
            orcamento_total=data.orcamento_total,
            data_inicio=data.data_inicio,
            data_fim=data.data_fim,
            created_by_id=current_user_id
        )
        db.add(campaign)
        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def update_campaign(db: Session, campaign_id: UUID, data: CampaignUpdate) -> MarketingCampaign:
        campaign = db.query(MarketingCampaign).filter(MarketingCampaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(404, "Campanha não encontrada")

        update_dict = data.model_dump(exclude_unset=True)
        for key, val in update_dict.items():
            setattr(campaign, key, val)

        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def get_campaign(db: Session, campaign_id: UUID) -> MarketingCampaign:
        campaign = db.query(MarketingCampaign).filter(MarketingCampaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(404, "Campanha não encontrada")
        return campaign

    @staticmethod
    def list_campaigns(
        db: Session,
        tenant_id: str,
        company_id: Optional[UUID] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        query = db.query(MarketingCampaign).filter(MarketingCampaign.tenant_id == tenant_id)
        if company_id:
            query = query.filter(MarketingCampaign.company_id == company_id)
        if status:
            query = query.filter(MarketingCampaign.status == status)
        if search:
            query = query.filter(MarketingCampaign.nome.ilike(f"%{search}%"))

        campaigns = query.order_by(desc(MarketingCampaign.created_at)).all()
        result = []

        for c in campaigns:
            lp_count = db.query(func.count(MarketingLandingPage.id)).filter(
                MarketingLandingPage.campaign_id == c.id
            ).scalar() or 0

            leads_count = db.query(func.count(MarketingSubmission.id)).filter(
                MarketingSubmission.campaign_id == c.id,
                MarketingSubmission.status == "CONVERTIDO"
            ).scalar() or 0

            views_count = db.query(func.count(MarketingEvent.id)).join(
                MarketingLandingPage, MarketingEvent.landing_page_id == MarketingLandingPage.id
            ).filter(
                MarketingLandingPage.campaign_id == c.id,
                MarketingEvent.event_type == "PAGE_VIEW"
            ).scalar() or 0

            result.append({
                "id": c.id,
                "tenant_id": c.tenant_id,
                "company_id": c.company_id,
                "sales_team_id": c.sales_team_id,
                "sales_team_nome": c.sales_team.nome if c.sales_team else None,
                "nome": c.nome,
                "descricao": c.descricao,
                "status": c.status,
                "canal_origem": c.canal_origem,
                "orcamento_total": c.orcamento_total,
                "data_inicio": c.data_inicio,
                "data_fim": c.data_fim,
                "created_by_id": c.created_by_id,
                "created_at": c.created_at,
                "updated_at": c.updated_at,
                "landing_pages_count": lp_count,
                "leads_count": leads_count,
                "views_count": views_count
            })

        return result

    @staticmethod
    def delete_campaign(db: Session, campaign_id: UUID) -> bool:
        campaign = db.query(MarketingCampaign).filter(MarketingCampaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(404, "Campanha não encontrada")
        db.delete(campaign)
        db.commit()
        return True

    # ─── LANDING PAGES ───

    @staticmethod
    def create_landing_page(db: Session, tenant_id: str, data: LandingPageCreate) -> MarketingLandingPage:
        # Check slug uniqueness in tenant
        existing = db.query(MarketingLandingPage).filter(
            MarketingLandingPage.tenant_id == tenant_id,
            MarketingLandingPage.slug == data.slug
        ).first()
        if existing:
            raise HTTPException(400, f"Já existe uma Landing Page com o slug '{data.slug}' neste tenant.")

        lp = MarketingLandingPage(
            tenant_id=tenant_id,
            campaign_id=data.campaign_id,
            slug=data.slug,
            custom_domain=data.custom_domain.strip().lower() if data.custom_domain else None,
            is_default_for_domain=data.is_default_for_domain,
            titulo=data.titulo,
            subtitulo=data.subtitulo,
            texto_cta=data.texto_cta,
            url_imagem_banner=data.url_imagem_banner,
            url_imagem_fundo=data.url_imagem_fundo,
            url_video=data.url_video,
            configuracao_formulario=data.configuracao_formulario,
            configuracao_conteudo=data.configuracao_conteudo,
            cor_primaria=data.cor_primaria,
            cor_secundaria=data.cor_secundaria,
            scripts_cabecalho=data.scripts_cabecalho,
            scripts_rodape=data.scripts_rodape,
            ativo=data.ativo
        )
        db.add(lp)
        db.commit()
        db.refresh(lp)
        return lp

    @staticmethod
    def update_landing_page(db: Session, lp_id: UUID, data: LandingPageUpdate) -> MarketingLandingPage:
        lp = db.query(MarketingLandingPage).filter(MarketingLandingPage.id == lp_id).first()
        if not lp:
            raise HTTPException(404, "Landing Page não encontrada")

        if data.slug and data.slug != lp.slug:
            existing = db.query(MarketingLandingPage).filter(
                MarketingLandingPage.tenant_id == lp.tenant_id,
                MarketingLandingPage.slug == data.slug,
                MarketingLandingPage.id != lp_id
            ).first()
            if existing:
                raise HTTPException(400, f"Já existe outra Landing Page com o slug '{data.slug}'.")

        update_dict = data.model_dump(exclude_unset=True)
        if "custom_domain" in update_dict and update_dict["custom_domain"]:
            update_dict["custom_domain"] = update_dict["custom_domain"].strip().lower()

        for key, val in update_dict.items():
            setattr(lp, key, val)

        db.commit()
        db.refresh(lp)
        return lp

    @staticmethod
    def get_landing_page(db: Session, lp_id: UUID) -> MarketingLandingPage:
        lp = db.query(MarketingLandingPage).filter(MarketingLandingPage.id == lp_id).first()
        if not lp:
            raise HTTPException(404, "Landing Page não encontrada")
        return lp

    @staticmethod
    def list_landing_pages(db: Session, tenant_id: str, campaign_id: Optional[UUID] = None) -> List[Dict[str, Any]]:
        query = db.query(MarketingLandingPage).filter(MarketingLandingPage.tenant_id == tenant_id)
        if campaign_id:
            query = query.filter(MarketingLandingPage.campaign_id == campaign_id)

        pages = query.order_by(desc(MarketingLandingPage.created_at)).all()
        result = []
        for p in pages:
            subs_count = db.query(func.count(MarketingSubmission.id)).filter(
                MarketingSubmission.landing_page_id == p.id
            ).scalar() or 0

            views_count = db.query(func.count(MarketingEvent.id)).filter(
                MarketingEvent.landing_page_id == p.id,
                MarketingEvent.event_type == "PAGE_VIEW"
            ).scalar() or 0

            result.append({
                "id": p.id,
                "tenant_id": p.tenant_id,
                "campaign_id": p.campaign_id,
                "campaign_nome": p.campaign.nome if p.campaign else None,
                "slug": p.slug,
                "custom_domain": p.custom_domain,
                "is_default_for_domain": p.is_default_for_domain,
                "titulo": p.titulo,
                "subtitulo": p.subtitulo,
                "texto_cta": p.texto_cta,
                "url_imagem_banner": p.url_imagem_banner,
                "url_imagem_fundo": p.url_imagem_fundo,
                "url_video": p.url_video,
                "configuracao_formulario": p.configuracao_formulario,
                "configuracao_conteudo": p.configuracao_conteudo,
                "cor_primaria": p.cor_primaria,
                "cor_secundaria": p.cor_secundaria,
                "scripts_cabecalho": p.scripts_cabecalho,
                "scripts_rodape": p.scripts_rodape,
                "ativo": p.ativo,
                "created_at": p.created_at,
                "updated_at": p.updated_at,
                "submissions_count": subs_count,
                "views_count": views_count
            })
        return result

    @staticmethod
    def delete_landing_page(db: Session, lp_id: UUID) -> bool:
        lp = db.query(MarketingLandingPage).filter(MarketingLandingPage.id == lp_id).first()
        if not lp:
            raise HTTPException(404, "Landing Page não encontrada")
        db.delete(lp)
        db.commit()
        return True

    # ─── RESOLUÇÃO PÚBLICA (MULTI-DOMÍNIO & SLUG) ───

    @staticmethod
    def resolve_public_landing_page(db: Session, domain: Optional[str] = None, slug: Optional[str] = None) -> MarketingLandingPage:
        clean_domain = None
        if domain:
            clean_domain = domain.split(":")[0].strip().lower()
            if clean_domain.startswith("www."):
                clean_domain = clean_domain[4:]

        clean_slug = slug.strip() if slug else None
        if clean_slug in ("/", "index", ""):
            clean_slug = None

        lp = None

        # 1. Se tem domínio customizado
        if clean_domain:
            if clean_slug:
                # Busca pelo par (custom_domain, slug)
                lp = db.query(MarketingLandingPage).filter(
                    MarketingLandingPage.custom_domain == clean_domain,
                    MarketingLandingPage.slug == clean_slug,
                    MarketingLandingPage.ativo == True
                ).first()

            if not lp and not clean_slug:
                # Se acessou a raiz do domínio customizado, busca a LP padrão daquele domínio
                lp = db.query(MarketingLandingPage).filter(
                    MarketingLandingPage.custom_domain == clean_domain,
                    MarketingLandingPage.is_default_for_domain == True,
                    MarketingLandingPage.ativo == True
                ).first()

                if not lp:
                    # Fallback para a primeira LP ativa do domínio
                    lp = db.query(MarketingLandingPage).filter(
                        MarketingLandingPage.custom_domain == clean_domain,
                        MarketingLandingPage.ativo == True
                    ).order_by(desc(MarketingLandingPage.created_at)).first()

        # 2. Busca pelo slug diretamente
        if not lp and clean_slug:
            lp = db.query(MarketingLandingPage).filter(
                MarketingLandingPage.slug == clean_slug,
                MarketingLandingPage.ativo == True
            ).first()

        if not lp:
            raise HTTPException(404, "Landing Page não encontrada ou inativa.")

        return lp

    # ─── PROCESSAMENTO DE SUBMISSÃO & CONVERSÃO EM LEAD ───

    @staticmethod
    def process_public_submission(
        db: Session,
        payload: PublicSubmissionCreate,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Dict[str, Any]:
        lp = db.query(MarketingLandingPage).filter(MarketingLandingPage.id == payload.landing_page_id).first()
        if not lp:
            raise HTTPException(404, "Landing Page não encontrada.")

        campaign = lp.campaign
        if not campaign:
            raise HTTPException(404, "Campanha associada não encontrada.")

        # Hash de IP para auditoria sem armazenar PII bruta
        ip_hash = hashlib.sha256(client_ip.encode("utf-8")).hexdigest() if client_ip else None

        # Proteção Anti-Spam Honeypot (campo invisível preenchido por bots)
        if payload.honeypot and payload.honeypot.strip():
            sub = MarketingSubmission(
                tenant_id=lp.tenant_id,
                landing_page_id=lp.id,
                campaign_id=campaign.id,
                lead_id=None,
                dados_formulario=payload.dados_formulario,
                utm_source=payload.utm_source,
                utm_medium=payload.utm_medium,
                utm_campaign=payload.utm_campaign,
                utm_content=payload.utm_content,
                utm_term=payload.utm_term,
                referrer=payload.referrer,
                ip_address_hash=ip_hash,
                user_agent=user_agent[:500] if user_agent else None,
                status="SPAM_BLOQUEADO"
            )
            db.add(sub)
            db.commit()
            return {
                "success": True,
                "message": "Mensagem recebida com sucesso!",
                "lead_created": False
            }

        dados = payload.dados_formulario or {}
        nome_contato = dados.get("nome") or dados.get("nome_contato") or "Lead Marketing"
        telefone = dados.get("telefone") or dados.get("whatsapp")
        email = dados.get("email")
        cidade = dados.get("cidade")
        estado = dados.get("estado")
        razao_social = dados.get("empresa") or dados.get("razao_social")
        mensagem = dados.get("mensagem") or dados.get("interesse")

        # Formatar observações com contexto completo da captura
        obs_linhas = [
            f"Origem: Landing Page '{lp.titulo}'",
            f"Campanha: {campaign.nome}"
        ]
        if cidade:
            loc = f"{cidade}/{estado}" if estado else cidade
            obs_linhas.append(f"Localização: {loc}")
        if razao_social:
            obs_linhas.append(f"Empresa: {razao_social}")
        if mensagem:
            obs_linhas.append(f"Mensagem/Interesse: {mensagem}")

        # Incluir campos dinâmicos customizados adicionais
        ignored_keys = {"nome", "nome_contato", "telefone", "whatsapp", "email", "cidade", "estado", "empresa", "razao_social", "mensagem", "interesse", "honeypot", "website_url_check"}
        for k, v in dados.items():
            if k not in ignored_keys and v:
                label_field = k.replace("_", " ").title()
                obs_linhas.append(f"{label_field}: {v}")

        utm_info = []
        if payload.utm_source:
            utm_info.append(f"utm_source={payload.utm_source}")
        if payload.utm_medium:
            utm_info.append(f"utm_medium={payload.utm_medium}")
        if payload.utm_campaign:
            utm_info.append(f"utm_campaign={payload.utm_campaign}")
        if utm_info:
            obs_linhas.append("Rastreamento: " + ", ".join(utm_info))

        observacoes_completas = "\n".join(obs_linhas)

        # Determinar distribuição comercial
        sales_team_id = campaign.sales_team_id
        vendedor_atribuido_id = None
        status_lead = "NOVO"
        data_atribuicao = None
        tipo_distribuicao = "ROUND_ROBIN" if sales_team_id else "FILA_GERAL"
        next_vendor = None

        if sales_team_id:
            next_vendor = get_next_queue_vendor(db, lp.tenant_id, campaign.company_id, sales_team_id)
            if next_vendor:
                status_lead = "AGUARDANDO_ACEITE"
                vendedor_atribuido_id = next_vendor.id
                data_atribuicao = func.now()

        # Criação do Lead
        lead = Lead(
            tenant_id=lp.tenant_id,
            company_id=campaign.company_id,
            sales_team_id=sales_team_id,
            nome_contato=nome_contato,
            razao_social=razao_social,
            email=email,
            telefone=telefone,
            origem="LANDING_PAGE",
            canal=campaign.nome,
            status=status_lead,
            tipo_distribuicao=tipo_distribuicao,
            vendedor_atribuido_id=vendedor_atribuido_id,
            data_atribuicao=data_atribuicao,
            observacoes=observacoes_completas,
            created_by_id=campaign.created_by_id
        )
        db.add(lead)
        db.flush()

        # Registro na Linha do Tempo do Lead
        db.add(LeadTimeline(
            lead_id=lead.id,
            user_id=None,
            tipo_evento="CRIACAO",
            titulo="Lead Capturado via Landing Page",
            descricao=f"Lead originado da Landing Page '{lp.titulo}' na Campanha '{campaign.nome}'."
        ))

        # Histórico de distribuição e Notificação se vendedor atribuído
        if next_vendor:
            db.add(LeadDistributionHistory(
                lead_id=lead.id,
                vendedor_id=next_vendor.id,
                tentativa_numero=1,
                tipo_atribuicao="ROUND_ROBIN",
                resultado="AGUARDANDO"
            ))
            _notify_vendor_new_lead(db, lp.tenant_id, campaign.company_id, next_vendor.id, lead)

        # Registro da Submissão de Marketing
        sub = MarketingSubmission(
            tenant_id=lp.tenant_id,
            landing_page_id=lp.id,
            campaign_id=campaign.id,
            lead_id=lead.id,
            dados_formulario=payload.dados_formulario,
            utm_source=payload.utm_source,
            utm_medium=payload.utm_medium,
            utm_campaign=payload.utm_campaign,
            utm_content=payload.utm_content,
            utm_term=payload.utm_term,
            referrer=payload.referrer,
            ip_address_hash=ip_hash,
            user_agent=user_agent[:500] if user_agent else None,
            status="CONVERTIDO"
        )
        db.add(sub)

        # Evento de FORM_SUBMIT para telemetria
        db.add(MarketingEvent(
            landing_page_id=lp.id,
            session_id=payload.session_id,
            event_type="FORM_SUBMIT",
            metadata_={"lead_id": str(lead.id)}
        ))

        db.commit()

        return {
            "success": True,
            "message": "Sua solicitação foi enviada com sucesso! Nossa equipe entrará em contato em breve.",
            "lead_created": True
        }

    # ─── TELEMETRIA / EVENTOS ───

    @staticmethod
    def record_public_event(db: Session, payload: PublicEventCreate) -> bool:
        event = MarketingEvent(
            landing_page_id=payload.landing_page_id,
            session_id=payload.session_id,
            event_type=payload.event_type,
            metadata_=payload.metadata
        )
        db.add(event)
        db.commit()
        return True

    # ─── MÉTRICAS DA CAMPANHA ───

    @staticmethod
    def get_campaign_metrics(db: Session, campaign_id: UUID) -> CampaignMetricsResponse:
        campaign = db.query(MarketingCampaign).filter(MarketingCampaign.id == campaign_id).first()
        if not campaign:
            raise HTTPException(404, "Campanha não encontrada")

        lp_ids = [lp.id for lp in campaign.landing_pages]

        if not lp_ids:
            return CampaignMetricsResponse(
                campaign_id=campaign.id,
                campaign_nome=campaign.nome,
                status=campaign.status,
                total_views=0,
                total_cta_clicks=0,
                total_form_starts=0,
                total_submissions=0,
                conversion_rate=0.0,
                leads_generated=0,
                top_utm_sources=[]
            )

        views = db.query(func.count(MarketingEvent.id)).filter(
            MarketingEvent.landing_page_id.in_(lp_ids),
            MarketingEvent.event_type == "PAGE_VIEW"
        ).scalar() or 0

        cta_clicks = db.query(func.count(MarketingEvent.id)).filter(
            MarketingEvent.landing_page_id.in_(lp_ids),
            MarketingEvent.event_type == "CTA_CLICK"
        ).scalar() or 0

        form_starts = db.query(func.count(MarketingEvent.id)).filter(
            MarketingEvent.landing_page_id.in_(lp_ids),
            MarketingEvent.event_type == "FORM_START"
        ).scalar() or 0

        submissions = db.query(func.count(MarketingSubmission.id)).filter(
            MarketingSubmission.campaign_id == campaign.id
        ).scalar() or 0

        leads_generated = db.query(func.count(MarketingSubmission.id)).filter(
            MarketingSubmission.campaign_id == campaign.id,
            MarketingSubmission.status == "CONVERTIDO",
            MarketingSubmission.lead_id.isnot(None)
        ).scalar() or 0

        conv_rate = (leads_generated / views * 100) if views > 0 else 0.0

        # Top UTM sources
        utm_query = db.query(
            MarketingSubmission.utm_source,
            func.count(MarketingSubmission.id).label("count")
        ).filter(
            MarketingSubmission.campaign_id == campaign.id,
            MarketingSubmission.utm_source.isnot(None)
        ).group_by(MarketingSubmission.utm_source).order_by(desc("count")).limit(5).all()

        top_utms = [{"source": row[0], "conversions": row[1]} for row in utm_query]

        return CampaignMetricsResponse(
            campaign_id=campaign.id,
            campaign_nome=campaign.nome,
            status=campaign.status,
            total_views=views,
            total_cta_clicks=cta_clicks,
            total_form_starts=form_starts,
            total_submissions=submissions,
            conversion_rate=round(conv_rate, 2),
            leads_generated=leads_generated,
            top_utm_sources=top_utms
        )

    # ─── SUBMISSÕES DETALHADAS (PAINEL ADMINISTRATIVO) ───

    @staticmethod
    def list_submissions(db: Session, campaign_id: Optional[UUID] = None, landing_page_id: Optional[UUID] = None) -> List[Dict[str, Any]]:
        query = db.query(MarketingSubmission)
        if campaign_id:
            query = query.filter(MarketingSubmission.campaign_id == campaign_id)
        if landing_page_id:
            query = query.filter(MarketingSubmission.landing_page_id == landing_page_id)

        subs = query.order_by(desc(MarketingSubmission.created_at)).limit(100).all()
        result = []
        for s in subs:
            lead = s.lead
            vendedor_nome = lead.vendedor_atribuido.name if (lead and lead.vendedor_atribuido) else None
            result.append({
                "id": s.id,
                "landing_page_id": s.landing_page_id,
                "campaign_id": s.campaign_id,
                "lead_id": s.lead_id,
                "dados_formulario": s.dados_formulario,
                "utm_source": s.utm_source,
                "utm_medium": s.utm_medium,
                "utm_campaign": s.utm_campaign,
                "utm_content": s.utm_content,
                "utm_term": s.utm_term,
                "referrer": s.referrer,
                "status": s.status,
                "created_at": s.created_at,
                "lead_nome": lead.nome_contato if lead else None,
                "lead_status": lead.status if lead else None,
                "vendedor_nome": vendedor_nome
            })
        return result
