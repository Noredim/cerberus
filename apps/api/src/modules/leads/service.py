import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Tuple
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc, asc

from src.modules.leads.models import (
    Lead, LeadQueueMember, LeadDistributionHistory, LeadTimeline, LeadTask
)
from src.modules.leads.schemas import (
    LeadCreate, LeadUpdate, LeadRejectRequest, LeadLossRequest, LeadConvertRequest,
    LeadTimelineCreate, LeadTaskCreate, LeadTaskUpdate, LeadQueueOrderUpdate,
    LeadSimpleResponse, LeadDetailResponse, LeadMetricsResponse, LeadTimelineResponse,
    LeadTaskResponse, LeadDistributionHistoryResponse, LeadQueueMemberResponse
)
from src.modules.users.models import User
from src.modules.companies.models import Company, SalesTeam, SalesTeamMember
from src.modules.customers.models import Customer
from src.modules.professionals.models import Professional
from src.modules.notifications.models import Notification
from src.modules.sales_budgets.models import SalesBudget
from src.modules.sales_budgets import service as sales_budget_service
from src.modules.sales_budgets.schemas import SalesBudgetCreate
from src.modules.integrations.google.schemas import CalendarEventData
from src.modules.integrations.google.provider import (
    create_calendar_event, update_calendar_event, delete_calendar_event
)


TIMEOUT_HOURS = 24


def _enrich_lead_response(lead: Lead, current_time: datetime) -> dict:
    # Calculate time remaining for 24h acceptance
    tempo_restante = None
    if lead.status == "AGUARDANDO_ACEITE" and lead.data_atribuicao:
        deadline = lead.data_atribuicao + timedelta(hours=TIMEOUT_HOURS)
        diff = (deadline - current_time).total_seconds()
        tempo_restante = max(0, int(diff))

    tem_cnpj = bool(lead.cpf_cnpj and lead.cpf_cnpj.strip())

    return {
        "id": lead.id,
        "tenant_id": lead.tenant_id,
        "company_id": lead.company_id,
        "sales_team_id": lead.sales_team_id,
        "sales_team_nome": lead.sales_team.nome if lead.sales_team else None,
        "nome_contato": lead.nome_contato,
        "razao_social": lead.razao_social,
        "cpf_cnpj": lead.cpf_cnpj,
        "email": lead.email,
        "telefone": lead.telefone,
        "cargo_contato": lead.cargo_contato,
        "origem": lead.origem,
        "canal": lead.canal,
        "status": lead.status,
        "tipo_distribuicao": lead.tipo_distribuicao,
        "vendedor_atribuido_id": lead.vendedor_atribuido_id,
        "vendedor_atribuido_nome": lead.vendedor_atribuido.name if lead.vendedor_atribuido else None,
        "vendedor_responsavel_id": lead.vendedor_responsavel_id,
        "vendedor_responsavel_nome": lead.vendedor_responsavel.name if lead.vendedor_responsavel else None,
        "data_atribuicao": lead.data_atribuicao,
        "data_aceite": lead.data_aceite,
        "customer_id": lead.customer_id,
        "customer_nome": (lead.customer.razao_social or lead.customer.nome_fantasia) if lead.customer else None,
        "sales_budget_id": lead.sales_budget_id,
        "sales_budget_numero": (lead.sales_budget.numero_orcamento or lead.sales_budget.titulo) if lead.sales_budget else None,
        "motivo_perda": lead.motivo_perda,
        "detalhes_perda": lead.detalhes_perda,
        "observacoes": lead.observacoes,
        "created_by_id": lead.created_by_id,
        "created_by_nome": lead.created_by.name if lead.created_by else None,
        "created_at": lead.created_at,
        "updated_at": lead.updated_at,
        "tempo_restante_aceite_segundos": tempo_restante,
        "tem_cnpj": tem_cnpj
    }


# ─── Queue Management & Round Robin ───

def sync_team_queue_members(db: Session, tenant_id: str, company_id: UUID, sales_team_id: UUID) -> List[LeadQueueMember]:
    """Ensures all active sales team members with role 'VENDEDOR' are present in lead_queue_members."""
    team_members = db.query(SalesTeamMember).filter(
        SalesTeamMember.sales_team_id == sales_team_id,
        SalesTeamMember.cargo == "VENDEDOR"
    ).all()

    existing_members = db.query(LeadQueueMember).filter(
        LeadQueueMember.sales_team_id == sales_team_id
    ).all()
    existing_user_ids = {m.user_id: m for m in existing_members}

    max_pos = max([m.ordem_posicao for m in existing_members], default=0)

    for tm in team_members:
        if tm.user_id not in existing_user_ids:
            max_pos += 1
            new_qm = LeadQueueMember(
                tenant_id=tenant_id,
                company_id=company_id,
                sales_team_id=sales_team_id,
                user_id=tm.user_id,
                ordem_posicao=max_pos,
                ativo=True
            )
            db.add(new_qm)

    db.commit()
    return db.query(LeadQueueMember).filter(
        LeadQueueMember.sales_team_id == sales_team_id
    ).order_by(asc(LeadQueueMember.ordem_posicao)).all()


def get_next_queue_vendor(
    db: Session,
    tenant_id: str,
    company_id: UUID,
    sales_team_id: UUID,
    exclude_user_ids: Optional[List[str]] = None
) -> Optional[User]:
    """Selects the next available vendor from the team queue using atomic locking, and advances the queue."""
    sync_team_queue_members(db, tenant_id, company_id, sales_team_id)

    query = db.query(LeadQueueMember).filter(
        LeadQueueMember.sales_team_id == sales_team_id,
        LeadQueueMember.ativo == True
    )
    if exclude_user_ids:
        query = query.filter(~LeadQueueMember.user_id.in_(exclude_user_ids))

    selected = query.order_by(asc(LeadQueueMember.ordem_posicao)).with_for_update().first()
    if not selected:
        return None

    # Move selected member to end of the queue
    max_pos = db.query(func.max(LeadQueueMember.ordem_posicao)).filter(
        LeadQueueMember.sales_team_id == sales_team_id
    ).scalar() or 0

    selected.ordem_posicao = max_pos + 1
    selected.ultima_atribuicao_em = func.now()
    db.flush()

    return db.query(User).filter(User.id == selected.user_id).first()


def list_queue_members(db: Session, tenant_id: str, company_id: UUID, sales_team_id: UUID) -> List[dict]:
    members = sync_team_queue_members(db, tenant_id, company_id, sales_team_id)
    result = []
    for m in members:
        result.append({
            "id": m.id,
            "sales_team_id": m.sales_team_id,
            "user_id": m.user_id,
            "user_name": m.user.name if m.user else None,
            "user_email": m.user.email if m.user else None,
            "ordem_posicao": m.ordem_posicao,
            "ativo": m.ativo,
            "ultima_atribuicao_em": m.ultima_atribuicao_em
        })
    return result


def update_queue_order(db: Session, sales_team_id: UUID, order_data: LeadQueueOrderUpdate):
    members = db.query(LeadQueueMember).filter(LeadQueueMember.sales_team_id == sales_team_id).all()
    member_map = {m.id: m for m in members}

    for idx, mid in enumerate(order_data.member_ids_in_order, start=1):
        if mid in member_map:
            member_map[mid].ordem_posicao = idx
    db.commit()


def toggle_queue_member_active(db: Session, member_id: UUID, ativo: bool):
    qm = db.query(LeadQueueMember).filter(LeadQueueMember.id == member_id).first()
    if not qm:
        raise HTTPException(404, "Membro da fila não encontrado")
    qm.ativo = ativo
    db.commit()


# ─── Notifications Helper ───

def _notify_vendor_new_lead(db: Session, tenant_id: str, company_id: UUID, user_id: str, lead: Lead):
    try:
        notif = Notification(
            tenant_id=tenant_id,
            company_id=company_id,
            user_id=user_id,
            title="Novo Lead Atribuído!",
            message=f"Você recebeu o Lead '{lead.nome_contato}' ({lead.origem}). Acesse para assumir o atendimento.",
            opportunity_id=str(lead.id),
            opportunity_number=lead.nome_contato,
            vendedor_name=lead.vendedor_atribuido.name if lead.vendedor_atribuido else "Vendedor"
        )
        db.add(notif)
        db.flush()
    except Exception as e:
        print(f"Erro ao criar notificação: {e}")


# ─── Timeout Processor (24h) ───

def check_and_process_timeouts(db: Session, tenant_id: str, company_id: UUID):
    """Redistributes leads in AGUARDANDO_ACEITE whose data_atribuicao is older than 24 hours."""
    now = datetime.now(timezone.utc)
    threshold = now - timedelta(hours=TIMEOUT_HOURS)

    expired_leads = db.query(Lead).filter(
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id,
        Lead.status == "AGUARDANDO_ACEITE",
        Lead.data_atribuicao <= threshold
    ).all()

    for lead in expired_leads:
        last_vendor_id = lead.vendedor_atribuido_id
        # Update current active history item
        hist = db.query(LeadDistributionHistory).filter(
            LeadDistributionHistory.lead_id == lead.id,
            LeadDistributionHistory.resultado == "AGUARDANDO"
        ).order_by(desc(LeadDistributionHistory.created_at)).first()

        if hist:
            hist.resultado = "TIMEOUT"
            hist.data_resposta = func.now()

        # Add timeline entry
        timeline_entry = LeadTimeline(
            lead_id=lead.id,
            user_id=None,
            tipo_evento="TIMEOUT",
            titulo="Prazo de Aceite Expirado (24h)",
            descricao=f"O prazo limite de 24 horas para aceite do vendedor expirou. O Lead foi redistribuído automaticamente."
        )
        db.add(timeline_entry)

        # Redistribute if sales_team_id is available
        if lead.sales_team_id:
            already_tried = [
                h.vendedor_id for h in db.query(LeadDistributionHistory.vendedor_id).filter(
                    LeadDistributionHistory.lead_id == lead.id
                ).all()
            ]
            next_vendor = get_next_queue_vendor(
                db, tenant_id, company_id, lead.sales_team_id, exclude_user_ids=already_tried
            )
            if next_vendor:
                tentativa = (hist.tentativa_numero + 1) if hist else 1
                lead.vendedor_atribuido_id = next_vendor.id
                lead.data_atribuicao = func.now()

                new_hist = LeadDistributionHistory(
                    lead_id=lead.id,
                    vendedor_id=next_vendor.id,
                    tentativa_numero=tentativa,
                    tipo_atribuicao="ROUND_ROBIN",
                    resultado="AGUARDANDO"
                )
                db.add(new_hist)
                _notify_vendor_new_lead(db, tenant_id, company_id, next_vendor.id, lead)

    if expired_leads:
        db.commit()


# ─── Lead CRUD ───

def create_lead(db: Session, tenant_id: str, company_id: UUID, current_user: User, data: LeadCreate) -> Lead:
    # Verify if current user is a vendor registering their own lead
    is_direct_vendor = (data.tipo_distribuicao == "DIRETA_VENDEDOR")

    vendedor_atribuido_id = None
    vendedor_responsavel_id = None
    status = "NOVO"
    data_atribuicao = None
    data_aceite = None

    if is_direct_vendor:
        status = "ASSUMIDO"
        vendedor_atribuido_id = current_user.id
        vendedor_responsavel_id = current_user.id
        data_atribuicao = func.now()
        data_aceite = func.now()
    elif data.tipo_distribuicao == "DIRECIONADO_MANUAL" and data.vendedor_especifico_id:
        status = "AGUARDANDO_ACEITE"
        vendedor_atribuido_id = data.vendedor_especifico_id
        data_atribuicao = func.now()
    elif data.tipo_distribuicao == "ROUND_ROBIN" and data.sales_team_id:
        next_vendor = get_next_queue_vendor(db, tenant_id, company_id, data.sales_team_id)
        if next_vendor:
            status = "AGUARDANDO_ACEITE"
            vendedor_atribuido_id = next_vendor.id
            data_atribuicao = func.now()

    lead = Lead(
        tenant_id=tenant_id,
        company_id=company_id,
        sales_team_id=data.sales_team_id,
        nome_contato=data.nome_contato,
        razao_social=data.razao_social,
        cpf_cnpj=data.cpf_cnpj.strip() if data.cpf_cnpj else None,
        email=data.email,
        telefone=data.telefone,
        cargo_contato=data.cargo_contato,
        origem=data.origem,
        canal=data.canal,
        status=status,
        tipo_distribuicao=data.tipo_distribuicao,
        vendedor_atribuido_id=vendedor_atribuido_id,
        vendedor_responsavel_id=vendedor_responsavel_id,
        data_atribuicao=data_atribuicao,
        data_aceite=data_aceite,
        observacoes=data.observacoes,
        created_by_id=current_user.id
    )
    db.add(lead)
    db.flush()

    # Timeline entry for creation
    db.add(LeadTimeline(
        lead_id=lead.id,
        user_id=current_user.id,
        tipo_evento="CRIACAO",
        titulo="Lead Cadastrado no Sistema",
        descricao=f"Lead registrado via {lead.origem} por {current_user.name}."
    ))

    # Distribution History entry if assigned
    if vendedor_atribuido_id:
        resultado = "ACEITO_EXPLICITO" if is_direct_vendor else "AGUARDANDO"
        db.add(LeadDistributionHistory(
            lead_id=lead.id,
            vendedor_id=vendedor_atribuido_id,
            tentativa_numero=1,
            tipo_atribuicao=data.tipo_distribuicao,
            resultado=resultado,
            data_resposta=func.now() if is_direct_vendor else None
        ))
        if not is_direct_vendor:
            _notify_vendor_new_lead(db, tenant_id, company_id, vendedor_atribuido_id, lead)

    db.commit()
    db.refresh(lead)
    return lead


def list_leads(
    db: Session,
    tenant_id: str,
    company_id: UUID,
    current_user: User,
    tab: Optional[str] = None,  # "meus", "aguardando", "equipe", "todos"
    status: Optional[str] = None,
    origem: Optional[str] = None,
    sales_team_id: Optional[UUID] = None,
    q: Optional[str] = None,
    skip: int = 0,
    limit: int = 50
) -> Tuple[List[dict], int]:
    # Run timeout check lazily on listing
    check_and_process_timeouts(db, tenant_id, company_id)

    query = db.query(Lead).filter(
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    )

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Lead.nome_contato.ilike(term),
                Lead.razao_social.ilike(term),
                Lead.cpf_cnpj.ilike(term),
                Lead.email.ilike(term),
                Lead.telefone.ilike(term)
            )
        )

    if status:
        query = query.filter(Lead.status == status)

    if origem:
        query = query.filter(Lead.origem == origem)

    if sales_team_id:
        query = query.filter(Lead.sales_team_id == sales_team_id)

    # Check if user has ADMIN or ENGENHARIA_PRECO role (handles list of str or UserRole relationship)
    is_admin = False
    if current_user and current_user.roles:
        for r in current_user.roles:
            role_name = getattr(r, "role", r)
            if hasattr(role_name, "value"):
                role_name = role_name.value
            if str(role_name).upper() in ["ADMIN", "ENGENHARIA_PRECO"]:
                is_admin = True
                break

    # Check if user is GERENTE in any sales team
    gerente_team_ids = [
        m.sales_team_id for m in db.query(SalesTeamMember.sales_team_id).filter(
            SalesTeamMember.user_id == current_user.id,
            SalesTeamMember.cargo == "GERENTE"
        ).all()
    ]
    is_gerente = len(gerente_team_ids) > 0

    # Filter by Tab
    if tab == "meus":
        query = query.filter(
            or_(
                Lead.vendedor_responsavel_id == current_user.id,
                Lead.vendedor_atribuido_id == current_user.id
            )
        )
    elif tab == "aguardando":
        if is_admin:
            # Administradores veem todos os leads aguardando aceite na empresa
            query = query.filter(Lead.status == "AGUARDANDO_ACEITE")
        elif is_gerente:
            # Gerentes veem todos os leads aguardando aceite das suas equipes
            query = query.filter(
                Lead.status == "AGUARDANDO_ACEITE",
                Lead.sales_team_id.in_(gerente_team_ids)
            )
        else:
            # Vendedores veem estritamente os leads atribuídos a eles aguardando aceite
            query = query.filter(
                Lead.status == "AGUARDANDO_ACEITE",
                Lead.vendedor_atribuido_id == current_user.id
            )
    elif tab == "equipe":
        # Find user's sales teams
        user_team_ids = [
            m.sales_team_id for m in db.query(SalesTeamMember.sales_team_id).filter(
                SalesTeamMember.user_id == current_user.id
            ).all()
        ]
        if user_team_ids:
            query = query.filter(Lead.sales_team_id.in_(user_team_ids))
        elif is_admin:
            query = query.filter(Lead.sales_team_id != None)

    total = query.count()
    leads = query.order_by(desc(Lead.updated_at), desc(Lead.created_at)).offset(skip).limit(limit).all()

    now = datetime.now(timezone.utc)
    return [_enrich_lead_response(l, now) for l in leads], total


def get_lead(db: Session, lead_id: UUID, tenant_id: str, company_id: UUID, current_user: User) -> dict:
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    ).first()

    if not lead:
        raise HTTPException(404, "Lead não encontrado")

    # ─── IMPLICIT ACCEPTANCE BY OPENING ───
    # If the assigned vendor opens a lead that is AGUARDANDO_ACEITE, accept automatically!
    if lead.status == "AGUARDANDO_ACEITE" and lead.vendedor_atribuido_id == current_user.id:
        lead.status = "ASSUMIDO"
        lead.vendedor_responsavel_id = current_user.id
        lead.data_aceite = func.now()

        # Update distribution history
        hist = db.query(LeadDistributionHistory).filter(
            LeadDistributionHistory.lead_id == lead.id,
            LeadDistributionHistory.vendedor_id == current_user.id,
            LeadDistributionHistory.resultado == "AGUARDANDO"
        ).order_by(desc(LeadDistributionHistory.created_at)).first()

        if hist:
            hist.resultado = "ACEITO_ABERTURA"
            hist.data_resposta = func.now()

        # Timeline entry
        db.add(LeadTimeline(
            lead_id=lead.id,
            user_id=current_user.id,
            tipo_evento="ACEITE",
            titulo="Lead Assumido por Abertura",
            descricao=f"O consultor {current_user.name} abriu o Lead e assumiu automaticamente a responsabilidade do atendimento."
        ))
        db.commit()
        db.refresh(lead)

    now = datetime.now(timezone.utc)
    base_data = _enrich_lead_response(lead, now)

    # Attach sub-resources
    timeline_items = [
        {
            "id": t.id,
            "lead_id": t.lead_id,
            "user_id": t.user_id,
            "user_name": t.user.name if t.user else "Sistema",
            "tipo_evento": t.tipo_evento,
            "titulo": t.titulo,
            "descricao": t.descricao,
            "metadados": t.metadados,
            "created_at": t.created_at
        } for t in lead.timeline
    ]

    task_items = [
        {
            "id": tk.id,
            "lead_id": tk.lead_id,
            "user_id": tk.user_id,
            "user_name": tk.user.name if tk.user else None,
            "titulo": tk.titulo,
            "descricao": tk.descricao,
            "tipo": tk.tipo,
            "data_agendamento": tk.data_agendamento,
            "hora_inicio": tk.hora_inicio,
            "hora_fim": tk.hora_fim,
            "fuso_horario": tk.fuso_horario or "America/Manaus",
            "participantes": tk.participantes,
            "concluida": tk.concluida,
            "concluida_em": tk.concluida_em,
            "resultado": tk.resultado,
            "google_event_id": tk.google_event_id,
            "google_sync_status": tk.google_sync_status,
            "created_at": tk.created_at,
            "updated_at": tk.updated_at
        } for tk in lead.tasks
    ]

    hist_items = [
        {
            "id": h.id,
            "lead_id": h.lead_id,
            "vendedor_id": h.vendedor_id,
            "vendedor_name": h.vendedor.name if h.vendedor else None,
            "tentativa_numero": h.tentativa_numero,
            "tipo_atribuicao": h.tipo_atribuicao,
            "data_atribuicao": h.data_atribuicao,
            "data_resposta": h.data_resposta,
            "resultado": h.resultado,
            "motivo_recusa": h.motivo_recusa,
            "created_at": h.created_at
        } for h in lead.distribution_history
    ]

    base_data["timeline"] = timeline_items
    base_data["tasks"] = task_items
    base_data["distribution_history"] = hist_items

    return base_data


def update_lead(db: Session, lead_id: UUID, tenant_id: str, company_id: UUID, current_user: User, data: LeadUpdate) -> Lead:
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    ).first()

    if not lead:
        raise HTTPException(404, "Lead não encontrado")

    update_dict = data.model_dump(exclude_unset=True)
    if "cpf_cnpj" in update_dict and update_dict["cpf_cnpj"]:
        update_dict["cpf_cnpj"] = update_dict["cpf_cnpj"].strip()

    for k, v in update_dict.items():
        setattr(lead, k, v)

    db.add(LeadTimeline(
        lead_id=lead.id,
        user_id=current_user.id,
        tipo_evento="EDICAO",
        titulo="Dados do Lead Atualizados",
        descricao=f"Informações cadastrais atualizadas por {current_user.name}."
    ))

    db.commit()
    db.refresh(lead)
    return lead


# ─── Accept & Reject & Loss ───

def accept_lead(db: Session, lead_id: UUID, tenant_id: str, company_id: UUID, current_user: User) -> dict:
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    ).with_for_update().first()

    if not lead:
        raise HTTPException(404, "Lead não encontrado")

    if lead.status != "AGUARDANDO_ACEITE":
        raise HTTPException(400, f"O Lead não está aguardando aceite (Status atual: {lead.status}).")

    if lead.vendedor_atribuido_id != current_user.id:
        raise HTTPException(403, "Este Lead não está atribuído ao seu usuário.")

    lead.status = "ASSUMIDO"
    lead.vendedor_responsavel_id = current_user.id
    lead.data_aceite = func.now()

    hist = db.query(LeadDistributionHistory).filter(
        LeadDistributionHistory.lead_id == lead.id,
        LeadDistributionHistory.vendedor_id == current_user.id,
        LeadDistributionHistory.resultado == "AGUARDANDO"
    ).order_by(desc(LeadDistributionHistory.created_at)).first()

    if hist:
        hist.resultado = "ACEITO_EXPLICITO"
        hist.data_resposta = func.now()

    db.add(LeadTimeline(
        lead_id=lead.id,
        user_id=current_user.id,
        tipo_evento="ACEITE",
        titulo="Lead Aceito Explicitamente",
        descricao=f"O consultor {current_user.name} aceitou o atendimento do Lead."
    ))

    db.commit()
    now = datetime.now(timezone.utc)
    return _enrich_lead_response(lead, now)


def reject_lead(db: Session, lead_id: UUID, tenant_id: str, company_id: UUID, current_user: User, data: LeadRejectRequest) -> dict:
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    ).with_for_update().first()

    if not lead:
        raise HTTPException(404, "Lead não encontrado")

    if lead.status != "AGUARDANDO_ACEITE":
        raise HTTPException(400, f"O Lead não está aguardando aceite.")

    if lead.vendedor_atribuido_id != current_user.id:
        raise HTTPException(403, "Este Lead não está atribuído ao seu usuário.")

    # Update distribution history
    hist = db.query(LeadDistributionHistory).filter(
        LeadDistributionHistory.lead_id == lead.id,
        LeadDistributionHistory.vendedor_id == current_user.id,
        LeadDistributionHistory.resultado == "AGUARDANDO"
    ).order_by(desc(LeadDistributionHistory.created_at)).first()

    if hist:
        hist.resultado = "RECUSADO"
        hist.motivo_recusa = data.motivo_recusa
        hist.data_resposta = func.now()

    db.add(LeadTimeline(
        lead_id=lead.id,
        user_id=current_user.id,
        tipo_evento="RECUSA",
        titulo="Lead Recusado",
        descricao=f"O consultor {current_user.name} recusou o Lead.{f' Motivo: {data.motivo_recusa}' if data.motivo_recusa else ''}"
    ))

    # Redistribute to next vendor in team queue
    if lead.sales_team_id:
        already_tried = [
            h.vendedor_id for h in db.query(LeadDistributionHistory.vendedor_id).filter(
                LeadDistributionHistory.lead_id == lead.id
            ).all()
        ]
        next_vendor = get_next_queue_vendor(
            db, tenant_id, company_id, lead.sales_team_id, exclude_user_ids=already_tried
        )
        if next_vendor:
            tentativa = (hist.tentativa_numero + 1) if hist else 1
            lead.vendedor_atribuido_id = next_vendor.id
            lead.data_atribuicao = func.now()

            new_hist = LeadDistributionHistory(
                lead_id=lead.id,
                vendedor_id=next_vendor.id,
                tentativa_numero=tentativa,
                tipo_atribuicao="ROUND_ROBIN",
                resultado="AGUARDANDO"
            )
            db.add(new_hist)
            _notify_vendor_new_lead(db, tenant_id, company_id, next_vendor.id, lead)

    db.commit()
    now = datetime.now(timezone.utc)
    return _enrich_lead_response(lead, now)


def mark_lead_lost(db: Session, lead_id: UUID, tenant_id: str, company_id: UUID, current_user: User, data: LeadLossRequest) -> dict:
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    ).first()

    if not lead:
        raise HTTPException(404, "Lead não encontrado")

    if lead.status == "CONVERTIDO":
        raise HTTPException(400, "Não é possível marcar como perdido um Lead já convertido em oportunidade.")

    lead.status = "PERDIDO"
    lead.motivo_perda = data.motivo_perda
    lead.detalhes_perda = data.detalhes_perda

    db.add(LeadTimeline(
        lead_id=lead.id,
        user_id=current_user.id,
        tipo_evento="PERDA",
        titulo="Lead Marcado como Perdido",
        descricao=f"Motivo: {data.motivo_perda}. Detalhes: {data.detalhes_perda or 'Nenhum detalhe adicional informado.'}"
    ))

    db.commit()
    now = datetime.now(timezone.utc)
    return _enrich_lead_response(lead, now)


# ─── Timeline / Andamento Management (CNPJ Mandatory) ───

def add_timeline_entry(
    db: Session,
    lead_id: UUID,
    tenant_id: str,
    company_id: UUID,
    current_user: User,
    data: LeadTimelineCreate
) -> LeadTimelineResponse:
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    ).first()

    if not lead:
        raise HTTPException(404, "Lead não encontrado")

    # 🔴 MANDATORY RULE: Must have CNPJ/CPF to register andamento!
    if not lead.cpf_cnpj or not lead.cpf_cnpj.strip():
        raise HTTPException(
            status_code=400,
            detail="Para registrar um andamento no Lead, é obrigatório concluir o cadastro informando o CNPJ/CPF do cliente."
        )

    entry = LeadTimeline(
        lead_id=lead.id,
        user_id=current_user.id,
        tipo_evento=data.tipo_evento,
        titulo=data.titulo,
        descricao=data.descricao,
        metadados=data.metadados
    )
    db.add(entry)

    # Transition status to EM_ATENDIMENTO if ASSUMIDO
    if lead.status == "ASSUMIDO":
        lead.status = "EM_ATENDIMENTO"

    db.commit()
    db.refresh(entry)

    return LeadTimelineResponse(
        id=entry.id,
        lead_id=entry.lead_id,
        user_id=entry.user_id,
        user_name=current_user.name,
        tipo_evento=entry.tipo_evento,
        titulo=entry.titulo,
        descricao=entry.descricao,
        metadados=entry.metadados,
        created_at=entry.created_at
    )


# ─── Task Management (CNPJ Mandatory & Google Calendar Sync) ───

def _parse_task_datetimes(data_agendamento, hora_inicio, hora_fim, time_zone_str="America/Manaus"):
    tz_name = time_zone_str or "America/Manaus"
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name)
    except Exception:
        try:
            import pytz
            tz = pytz.timezone(tz_name)
        except Exception:
            tz = timezone(timedelta(hours=-4))

    date_obj = data_agendamento.date() if isinstance(data_agendamento, datetime) else data_agendamento
    h_in, m_in = 9, 0
    if hora_inicio and ":" in str(hora_inicio):
        try:
            parts = str(hora_inicio).strip().split(":")
            h_in, m_in = int(parts[0]), int(parts[1])
        except Exception:
            pass

    h_out, m_out = (h_in + 1) % 24, m_in
    if hora_fim and ":" in str(hora_fim):
        try:
            parts = str(hora_fim).strip().split(":")
            h_out, m_out = int(parts[0]), int(parts[1])
        except Exception:
            pass

    start_dt = datetime(date_obj.year, date_obj.month, date_obj.day, h_in, m_in, tzinfo=tz)
    end_dt = datetime(date_obj.year, date_obj.month, date_obj.day, h_out, m_out, tzinfo=tz)
    if end_dt <= start_dt:
        end_dt = start_dt + timedelta(hours=1)
    return start_dt, end_dt


def _sync_task_with_google(db: Session, task: LeadTask, lead: Optional[Lead] = None):
    try:
        if not lead:
            lead = db.query(Lead).filter(Lead.id == task.lead_id).first()

        tz_name = task.fuso_horario or "America/Manaus"
        start_dt, end_dt = _parse_task_datetimes(task.data_agendamento, task.hora_inicio, task.hora_fim, tz_name)
        prefix = "[CONCLUÍDA] " if task.concluida else ""
        lead_info = f"Lead: {lead.nome_contato}" if lead else "Lead Comercial"
        summary = f"{prefix}[{task.tipo}] {task.titulo} - {lead_info}"

        desc_lines = [
            "Compromisso Comercial Cerberus",
            f"Contato: {lead.nome_contato if lead else 'N/I'}",
            f"Empresa: {lead.razao_social if lead and lead.razao_social else 'Pessoa Física'}",
            f"Telefone: {lead.telefone if lead and lead.telefone else 'N/I'}",
            f"Origem: {lead.origem if lead else 'N/I'}",
            "",
            "Detalhes da Atividade:",
            task.descricao or "Sem observações adicionais."
        ]
        if task.participantes:
            desc_lines.extend(["", f"Participantes Convidados: {task.participantes}"])
        if task.concluida and task.resultado:
            desc_lines.extend(["", "Resultado Registrado:", task.resultado])

        # Coletar e-mails para envio de convites no Google Calendar
        attendees = []
        if task.participantes:
            raw_emails = [e.strip() for e in task.participantes.replace(";", ",").split(",") if e.strip()]
            attendees.extend(raw_emails)
        elif lead and lead.email and "@" in lead.email:
            attendees.append(lead.email.strip())

        event_data = CalendarEventData(
            summary=summary,
            description="\n".join(desc_lines),
            start_time=start_dt,
            end_time=end_dt,
            time_zone=tz_name,
            attendees=attendees if attendees else None
        )

        if not task.google_event_id:
            google_event_id = create_calendar_event(
                db,
                user_id=task.user_id,
                event_data=event_data,
                entity_type="LEAD_TASK",
                entity_id=str(task.id)
            )
            if google_event_id:
                task.google_event_id = google_event_id
                task.google_sync_status = "SYNCED"
                db.commit()
            else:
                task.google_sync_status = "NOT_CONNECTED"
                db.commit()
        else:
            updated = update_calendar_event(
                db,
                user_id=task.user_id,
                google_event_id=task.google_event_id,
                event_data=event_data,
                entity_type="LEAD_TASK",
                entity_id=str(task.id)
            )
            if updated:
                task.google_sync_status = "SYNCED"
                db.commit()
            else:
                task.google_sync_status = "FAILED"
                db.commit()
    except Exception as e:
        print(f"[GOOGLE CALENDAR SYNC ERROR] Task {task.id}: {e}")


def create_task(
    db: Session,
    lead_id: UUID,
    tenant_id: str,
    company_id: UUID,
    current_user: User,
    data: LeadTaskCreate
) -> LeadTaskResponse:
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    ).first()

    if not lead:
        raise HTTPException(404, "Lead não encontrado")

    # 🔴 MANDATORY RULE: Must have CNPJ/CPF to schedule a task!
    if not lead.cpf_cnpj or not lead.cpf_cnpj.strip():
        raise HTTPException(
            status_code=400,
            detail="Para agendar uma tarefa no Lead, é obrigatório concluir o cadastro informando o CNPJ/CPF do cliente."
        )

    # 🔴 Validate date/time: cannot be in the past unless marked as retroativo
    tz_name = data.fuso_horario or "America/Manaus"
    start_dt, _ = _parse_task_datetimes(data.data_agendamento, data.hora_inicio, data.hora_fim, tz_name)
    now_in_tz = datetime.now(start_dt.tzinfo)

    if not data.retroativo and start_dt < (now_in_tz - timedelta(minutes=5)):
        raise HTTPException(
            status_code=400,
            detail="A data e horário do agendamento devem ser futuros. Para registrar atividades que já aconteceram, marque a opção 'Lançamento Retroativo'."
        )

    target_user_id = data.user_id or lead.vendedor_responsavel_id or current_user.id

    task = LeadTask(
        tenant_id=tenant_id,
        company_id=company_id,
        lead_id=lead.id,
        user_id=target_user_id,
        titulo=data.titulo,
        descricao=data.descricao,
        tipo=data.tipo,
        data_agendamento=data.data_agendamento,
        hora_inicio=data.hora_inicio,
        hora_fim=data.hora_fim,
        fuso_horario=tz_name,
        participantes=data.participantes,
        retroativo=data.retroativo,
        concluida=False,
        google_sync_status="RETROATIVO" if data.retroativo else "PENDING"
    )
    db.add(task)

    # Timeline entry for scheduled task
    timeline_title = f"Atividade Registrada (Retroativa): {task.titulo}" if data.retroativo else f"Tarefa Agendada: {task.titulo}"
    db.add(LeadTimeline(
        lead_id=lead.id,
        user_id=current_user.id,
        tipo_evento="TAREFA_CRIADA",
        titulo=timeline_title,
        descricao=f"Atividade ({task.tipo}) {'realizada em' if data.retroativo else 'programada para'} {task.data_agendamento.strftime('%d/%m/%Y')} {task.hora_inicio or ''}."
    ))

    db.commit()
    db.refresh(task)

    # Sync with Google Calendar ONLY if NOT retroativo
    if not data.retroativo:
        _sync_task_with_google(db, task, lead)
        db.refresh(task)

    return LeadTaskResponse(
        id=task.id,
        lead_id=task.lead_id,
        user_id=task.user_id,
        user_name=task.user.name if task.user else current_user.name,
        titulo=task.titulo,
        descricao=task.descricao,
        tipo=task.tipo,
        data_agendamento=task.data_agendamento,
        hora_inicio=task.hora_inicio,
        hora_fim=task.hora_fim,
        fuso_horario=task.fuso_horario,
        participantes=task.participantes,
        retroativo=task.retroativo,
        concluida=task.concluida,
        concluida_em=task.concluida_em,
        resultado=task.resultado,
        google_event_id=task.google_event_id,
        google_sync_status=task.google_sync_status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


def update_task(
    db: Session,
    task_id: UUID,
    tenant_id: str,
    company_id: UUID,
    current_user: User,
    data: LeadTaskUpdate
) -> LeadTaskResponse:
    task = db.query(LeadTask).filter(
        LeadTask.id == task_id,
        LeadTask.tenant_id == tenant_id,
        LeadTask.company_id == company_id
    ).first()

    if not task:
        raise HTTPException(404, "Tarefa não encontrada")

    update_dict = data.model_dump(exclude_unset=True)
    was_completed_before = task.concluida

    for k, v in update_dict.items():
        setattr(task, k, v)

    if task.concluida and not was_completed_before:
        task.concluida_em = func.now()
        db.add(LeadTimeline(
            lead_id=task.lead_id,
            user_id=current_user.id,
            tipo_evento="TAREFA_CONCLUIDA",
            titulo=f"Tarefa Concluída: {task.titulo}",
            descricao=f"Resultado: {task.resultado or 'Concluída com sucesso.'}"
        ))

    db.commit()
    db.refresh(task)

    # Sync updated status or times with Google Calendar
    _sync_task_with_google(db, task)
    db.refresh(task)

    return LeadTaskResponse(
        id=task.id,
        lead_id=task.lead_id,
        user_id=task.user_id,
        user_name=task.user.name if task.user else None,
        titulo=task.titulo,
        descricao=task.descricao,
        tipo=task.tipo,
        data_agendamento=task.data_agendamento,
        hora_inicio=task.hora_inicio,
        hora_fim=task.hora_fim,
        fuso_horario=task.fuso_horario,
        participantes=task.participantes,
        concluida=task.concluida,
        concluida_em=task.concluida_em,
        resultado=task.resultado,
        google_event_id=task.google_event_id,
        google_sync_status=task.google_sync_status,
        created_at=task.created_at,
        updated_at=task.updated_at
    )


def delete_task(
    db: Session,
    task_id: UUID,
    tenant_id: str,
    company_id: UUID,
    current_user: User
) -> bool:
    task = db.query(LeadTask).filter(
        LeadTask.id == task_id,
        LeadTask.tenant_id == tenant_id,
        LeadTask.company_id == company_id
    ).first()

    if not task:
        raise HTTPException(404, "Tarefa não encontrada")

    if task.google_event_id:
        try:
            delete_calendar_event(
                db,
                user_id=task.user_id,
                google_event_id=task.google_event_id,
                entity_type="LEAD_TASK",
                entity_id=str(task.id)
            )
        except Exception as e:
            print(f"[GOOGLE CALENDAR DELETE ERROR] Task {task.id}: {e}")

    db.delete(task)
    db.commit()
    return True


# ─── Conversion Lead → Opportunity (SalesBudget) ───

def convert_lead_to_opportunity(
    db: Session,
    lead_id: UUID,
    tenant_id: str,
    company_id: UUID,
    current_user: User,
    data: LeadConvertRequest
) -> dict:
    lead = db.query(Lead).filter(
        Lead.id == lead_id,
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    ).with_for_update().first()

    if not lead:
        raise HTTPException(404, "Lead não encontrado")

    if lead.status == "CONVERTIDO":
        raise HTTPException(400, f"Este Lead já foi convertido anteriormente (Oportunidade ID: {lead.sales_budget_id}).")

    if lead.status == "PERDIDO":
        raise HTTPException(400, "Não é possível converter um Lead marcado como perdido.")

    # 1. Resolve / Create Customer
    customer_id = data.customer_id or lead.customer_id
    if not customer_id:
        doc = (data.cnpj or lead.cpf_cnpj or "").strip()
        if not doc:
            raise HTTPException(400, "Para converter o Lead em Oportunidade, é necessário informar o CNPJ/CPF do cliente.")

        # Search existing customer by CNPJ in tenant
        existing_cust = db.query(Customer).filter(
            Customer.tenant_id == tenant_id,
            Customer.cnpj == doc
        ).first()

        if existing_cust:
            customer_id = existing_cust.id
        else:
            # Create new customer record
            new_cust = Customer(
                tenant_id=tenant_id,
                company_id=company_id,
                cnpj=doc,
                razao_social=data.razao_social or lead.razao_social or lead.nome_contato,
                nome_fantasia=data.nome_fantasia or lead.nome_contato,
                email=data.email or lead.email,
                telefone=data.telefone or lead.telefone,
                tipo="PRIVADO"
            )
            db.add(new_cust)
            db.flush()
            customer_id = new_cust.id

    lead.customer_id = customer_id

    # 2. Resolve Professional (vendedor_id in SalesBudget)
    responsavel_user_id = lead.vendedor_responsavel_id or current_user.id
    prof = db.query(Professional).filter(
        Professional.tenant_id == tenant_id,
        Professional.user_id == responsavel_user_id
    ).first()
    vendedor_id = prof.id if prof else None

    # 3. Create SalesBudget via SalesBudgetService
    titulo = data.titulo_oportunidade or f"Oportunidade - {lead.razao_social or lead.nome_contato}"
    budget_in = SalesBudgetCreate(
        customer_id=customer_id,
        vendedor_id=vendedor_id,
        sales_team_id=lead.sales_team_id,
        titulo=titulo,
        observacoes=f"Oportunidade gerada automaticamente a partir da conversão do Lead: {lead.nome_contato} ({lead.origem}).\nObservações originais: {lead.observacoes or 'Nenhuma'}",
        data_orcamento=datetime.now(timezone.utc)
    )

    budget = sales_budget_service.create_budget(db, tenant_id, str(company_id), budget_in)

    # 4. Mark Lead as CONVERTIDO and link budget
    lead.status = "CONVERTIDO"
    lead.sales_budget_id = budget.id

    db.add(LeadTimeline(
        lead_id=lead.id,
        user_id=current_user.id,
        tipo_evento="CONVERSAO",
        titulo="Lead Convertido em Oportunidade",
        descricao=f"Lead qualificado e convertido na Oportunidade '{budget.titulo}' (Nº {budget.numero_orcamento or budget.id}).",
        metadados={"sales_budget_id": str(budget.id)}
    ))

    db.commit()
    now = datetime.now(timezone.utc)
    return {
        "lead": _enrich_lead_response(lead, now),
        "sales_budget_id": str(budget.id),
        "numero_orcamento": budget.numero_orcamento or str(budget.id)
    }


# ─── Metrics / Dashboard ───

def get_lead_metrics(db: Session, tenant_id: str, company_id: UUID, current_user: Optional[User] = None) -> LeadMetricsResponse:
    total = db.query(func.count(Lead.id)).filter(
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id
    ).scalar() or 0

    aguardando = db.query(func.count(Lead.id)).filter(
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id,
        Lead.status == "AGUARDANDO_ACEITE"
    ).scalar() or 0

    meus_aguardando = 0
    if current_user:
        is_admin = False
        if current_user.roles:
            for r in current_user.roles:
                role_name = getattr(r, "role", r)
                if hasattr(role_name, "value"):
                    role_name = role_name.value
                if str(role_name).upper() in ["ADMIN", "ENGENHARIA_PRECO"]:
                    is_admin = True
                    break

        gerente_team_ids = [
            m.sales_team_id for m in db.query(SalesTeamMember.sales_team_id).filter(
                SalesTeamMember.user_id == current_user.id,
                SalesTeamMember.cargo == "GERENTE"
            ).all()
        ]
        is_gerente = len(gerente_team_ids) > 0

        if is_admin:
            meus_aguardando = aguardando
        elif is_gerente:
            meus_aguardando = db.query(func.count(Lead.id)).filter(
                Lead.tenant_id == tenant_id,
                Lead.company_id == company_id,
                Lead.status == "AGUARDANDO_ACEITE",
                Lead.sales_team_id.in_(gerente_team_ids)
            ).scalar() or 0
        else:
            meus_aguardando = db.query(func.count(Lead.id)).filter(
                Lead.tenant_id == tenant_id,
                Lead.company_id == company_id,
                Lead.status == "AGUARDANDO_ACEITE",
                Lead.vendedor_atribuido_id == current_user.id
            ).scalar() or 0

    assumidos = db.query(func.count(Lead.id)).filter(
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id,
        Lead.status.in_(["ASSUMIDO", "EM_ATENDIMENTO", "QUALIFICADO"])
    ).scalar() or 0

    convertidos = db.query(func.count(Lead.id)).filter(
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id,
        Lead.status == "CONVERTIDO"
    ).scalar() or 0

    perdidos = db.query(func.count(Lead.id)).filter(
        Lead.tenant_id == tenant_id,
        Lead.company_id == company_id,
        Lead.status == "PERDIDO"
    ).scalar() or 0

    taxa = round((convertidos / total * 100), 2) if total > 0 else 0.0

    return LeadMetricsResponse(
        total_leads=total,
        aguardando_aceite=aguardando,
        meus_aguardando_aceite=meus_aguardando,
        assumidos_em_atendimento=assumidos,
        convertidos=convertidos,
        perdidos=perdidos,
        taxa_conversao_pct=taxa
    )
