from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.messaging.models import EmailConfig, EmailTrigger, EmailLog, EmailStatusEnum
from src.modules.messaging.schemas import (
    EmailConfigCreate,
    EmailConfigUpdate,
    EmailConfigResponse,
    EmailTriggerCreate,
    EmailTriggerUpdate,
    EmailTriggerResponse,
    EmailLogResponse,
    EmailTestRequest,
    AvailableAction,
)
from src.modules.messaging.service import (
    encrypt_password,
    get_active_config,
    send_test_email_sync,
    create_and_dispatch_email,
    AVAILABLE_ACTIONS,
)

router = APIRouter(prefix="/messaging", tags=["Messaging"])


def _require_admin(current_user: User):
    """Validate that the current user has ADMIN role."""
    roles = [r.role.value for r in current_user.roles]
    if "ADMIN" not in roles:
        raise HTTPException(status_code=403, detail="Acesso restrito a administradores.")


# ==================== SMTP CONFIG ====================

@router.get("/config", response_model=Optional[EmailConfigResponse])
def get_config(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    config = get_active_config(db, current_user.tenant_id)
    return config


@router.post("/config", response_model=EmailConfigResponse)
def save_config(
    payload: EmailConfigCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    # Check if config already exists for this tenant
    existing = get_active_config(db, current_user.tenant_id)

    encrypted_pwd = encrypt_password(payload.smtp_password)
    encrypted_imap_pwd = None
    if payload.imap_password:
        encrypted_imap_pwd = encrypt_password(payload.imap_password)

    if existing:
        # Update existing
        existing.smtp_host = payload.smtp_host
        existing.smtp_port = payload.smtp_port
        existing.smtp_user = payload.smtp_user
        existing.smtp_password_encrypted = encrypted_pwd
        existing.smtp_use_tls = payload.smtp_use_tls
        existing.smtp_use_ssl = payload.smtp_use_ssl
        existing.sender_name = payload.sender_name
        existing.sender_email = payload.sender_email
        
        # IMAP Fields
        existing.imap_host = payload.imap_host
        existing.imap_port = payload.imap_port
        existing.imap_user = payload.imap_user
        if encrypted_imap_pwd:
            existing.imap_password_encrypted = encrypted_imap_pwd
        existing.imap_use_ssl = payload.imap_use_ssl if payload.imap_use_ssl is not None else True
        existing.imap_use_tls = payload.imap_use_tls if payload.imap_use_tls is not None else False
        
        db.commit()
        db.refresh(existing)
        return existing
    else:
        # Create new
        config = EmailConfig(
            tenant_id=current_user.tenant_id,
            smtp_host=payload.smtp_host,
            smtp_port=payload.smtp_port,
            smtp_user=payload.smtp_user,
            smtp_password_encrypted=encrypted_pwd,
            smtp_use_tls=payload.smtp_use_tls,
            smtp_use_ssl=payload.smtp_use_ssl,
            sender_name=payload.sender_name,
            sender_email=payload.sender_email,
            
            # IMAP Fields
            imap_host=payload.imap_host,
            imap_port=payload.imap_port,
            imap_user=payload.imap_user,
            imap_password_encrypted=encrypted_imap_pwd,
            imap_use_ssl=payload.imap_use_ssl if payload.imap_use_ssl is not None else True,
            imap_use_tls=payload.imap_use_tls if payload.imap_use_tls is not None else False,
        )
        db.add(config)
        db.commit()
        db.refresh(config)
        return config


@router.put("/config", response_model=EmailConfigResponse)
def update_config(
    payload: EmailConfigUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    config = get_active_config(db, current_user.tenant_id)
    if not config:
        raise HTTPException(status_code=404, detail="Configuração SMTP/IMAP não encontrada.")

    # SMTP Fields
    if payload.smtp_host is not None:
        config.smtp_host = payload.smtp_host
    if payload.smtp_port is not None:
        config.smtp_port = payload.smtp_port
    if payload.smtp_user is not None:
        config.smtp_user = payload.smtp_user
    if payload.smtp_password is not None:
        config.smtp_password_encrypted = encrypt_password(payload.smtp_password)
    if payload.smtp_use_tls is not None:
        config.smtp_use_tls = payload.smtp_use_tls
    if payload.smtp_use_ssl is not None:
        config.smtp_use_ssl = payload.smtp_use_ssl
    if payload.sender_name is not None:
        config.sender_name = payload.sender_name
    if payload.sender_email is not None:
        config.sender_email = payload.sender_email

    # IMAP Fields
    if payload.imap_host is not None:
        config.imap_host = payload.imap_host
    if payload.imap_port is not None:
        config.imap_port = payload.imap_port
    if payload.imap_user is not None:
        config.imap_user = payload.imap_user
    if payload.imap_password is not None:
        config.imap_password_encrypted = encrypt_password(payload.imap_password)
    if payload.imap_use_ssl is not None:
        config.imap_use_ssl = payload.imap_use_ssl
    if payload.imap_use_tls is not None:
        config.imap_use_tls = payload.imap_use_tls

    db.commit()
    db.refresh(config)
    return config


@router.post("/config/test")
def test_config(
    payload: EmailTestRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    if payload.smtp_host:
        # Use provided SMTP details to test live values without saving them first.
        existing = get_active_config(db, current_user.tenant_id)
        pwd_encrypted = ""
        if payload.smtp_password:
            pwd_encrypted = encrypt_password(payload.smtp_password)
        elif existing:
            pwd_encrypted = existing.smtp_password_encrypted

        config = EmailConfig(
            tenant_id=current_user.tenant_id,
            smtp_host=payload.smtp_host,
            smtp_port=payload.smtp_port or 587,
            smtp_user=payload.smtp_user,
            smtp_password_encrypted=pwd_encrypted,
            smtp_use_tls=payload.smtp_use_tls if payload.smtp_use_tls is not None else True,
            smtp_use_ssl=payload.smtp_use_ssl if payload.smtp_use_ssl is not None else False,
            sender_name=payload.sender_name or "Cerberus Test",
            sender_email=payload.sender_email or payload.smtp_user,
        )
    else:
        # Load saved SMTP configuration from database
        config = get_active_config(db, current_user.tenant_id)
        if not config:
            raise HTTPException(status_code=404, detail="Configure o SMTP antes de testar.")

    result = send_test_email_sync(config, payload.recipient_email, payload.subject, payload.body)

    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])

    return result


# ==================== TRIGGERS ====================

@router.get("/triggers", response_model=List[EmailTriggerResponse])
def list_triggers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    triggers = db.query(EmailTrigger).filter(
        EmailTrigger.tenant_id == current_user.tenant_id
    ).order_by(EmailTrigger.action_key).all()

    return triggers


@router.post("/triggers", response_model=EmailTriggerResponse)
def create_trigger(
    payload: EmailTriggerCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    # Validate action_key exists in available actions
    valid_keys = [a["key"] for a in AVAILABLE_ACTIONS]
    if payload.action_key not in valid_keys:
        raise HTTPException(status_code=400, detail=f"Ação inválida: {payload.action_key}")

    trigger = EmailTrigger(
        tenant_id=current_user.tenant_id,
        action_key=payload.action_key,
        action_label=payload.action_label,
        is_active=payload.is_active,
        subject_template=payload.subject_template,
        body_template=payload.body_template,
        recipients_type=payload.recipients_type.value,
        recipients_fixed=payload.recipients_fixed,
        recipients_roles=payload.recipients_roles,
    )
    db.add(trigger)
    db.commit()
    db.refresh(trigger)
    return trigger


@router.put("/triggers/{trigger_id}", response_model=EmailTriggerResponse)
def update_trigger(
    trigger_id: str,
    payload: EmailTriggerUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    trigger = db.query(EmailTrigger).filter(
        EmailTrigger.id == trigger_id,
        EmailTrigger.tenant_id == current_user.tenant_id,
    ).first()

    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger não encontrado.")

    if payload.action_label is not None:
        trigger.action_label = payload.action_label
    if payload.is_active is not None:
        trigger.is_active = payload.is_active
    if payload.subject_template is not None:
        trigger.subject_template = payload.subject_template
    if payload.body_template is not None:
        trigger.body_template = payload.body_template
    if payload.recipients_type is not None:
        trigger.recipients_type = payload.recipients_type.value
    if payload.recipients_fixed is not None:
        trigger.recipients_fixed = payload.recipients_fixed
    if payload.recipients_roles is not None:
        trigger.recipients_roles = payload.recipients_roles

    db.commit()
    db.refresh(trigger)
    return trigger


@router.delete("/triggers/{trigger_id}")
def delete_trigger(
    trigger_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    trigger = db.query(EmailTrigger).filter(
        EmailTrigger.id == trigger_id,
        EmailTrigger.tenant_id == current_user.tenant_id,
    ).first()

    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger não encontrado.")

    db.delete(trigger)
    db.commit()
    return {"status": "success", "message": "Trigger removido com sucesso."}


@router.patch("/triggers/{trigger_id}/toggle", response_model=EmailTriggerResponse)
def toggle_trigger(
    trigger_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    trigger = db.query(EmailTrigger).filter(
        EmailTrigger.id == trigger_id,
        EmailTrigger.tenant_id == current_user.tenant_id,
    ).first()

    if not trigger:
        raise HTTPException(status_code=404, detail="Trigger não encontrado.")

    trigger.is_active = not trigger.is_active
    db.commit()
    db.refresh(trigger)
    return trigger


# ==================== LOGS ====================

@router.get("/logs", response_model=List[EmailLogResponse])
def list_logs(
    status: Optional[str] = Query(None, description="Filtrar por status (PENDING, RETRYING, SENT, FAILED)"),
    action_key: Optional[str] = Query(None, description="Filtrar por ação"),
    date_from: Optional[str] = Query(None, description="Data início (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Data fim (YYYY-MM-DD)"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    query = db.query(EmailLog).filter(
        EmailLog.tenant_id == current_user.tenant_id
    )

    if status:
        try:
            status_enum = EmailStatusEnum(status)
            query = query.filter(EmailLog.status == status_enum)
        except ValueError:
            pass

    if action_key:
        query = query.filter(EmailLog.action_key == action_key)

    if date_from:
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(EmailLog.created_at >= dt_from)
        except ValueError:
            pass

    if date_to:
        try:
            dt_to = datetime.strptime(date_to, "%Y-%m-%d")
            query = query.filter(EmailLog.created_at <= dt_to.replace(hour=23, minute=59, second=59))
        except ValueError:
            pass

    total = query.count()
    logs = query.order_by(EmailLog.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()

    # Return total count in header for frontend pagination
    from fastapi.responses import JSONResponse
    from pydantic import TypeAdapter
    adapter = TypeAdapter(List[EmailLogResponse])
    data = adapter.validate_python(logs, from_attributes=True)

    response = JSONResponse(content=[item.model_dump(mode="json") for item in data])
    response.headers["X-Total-Count"] = str(total)
    return response


@router.get("/logs/{log_id}", response_model=EmailLogResponse)
def get_log_detail(
    log_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)

    log = db.query(EmailLog).filter(
        EmailLog.id == log_id,
        EmailLog.tenant_id == current_user.tenant_id,
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Log não encontrado.")

    return log


@router.post("/logs/{log_id}/resend")
def resend_email(
    log_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Re-send a FAILED email manually."""
    _require_admin(current_user)

    log = db.query(EmailLog).filter(
        EmailLog.id == log_id,
        EmailLog.tenant_id == current_user.tenant_id,
        EmailLog.status == EmailStatusEnum.FAILED,
    ).first()

    if not log:
        raise HTTPException(status_code=404, detail="Log não encontrado ou não está com status FAILED.")

    config = get_active_config(db, current_user.tenant_id)
    if not config:
        raise HTTPException(status_code=400, detail="Configuração SMTP não encontrada.")

    # Reset retry count and re-dispatch
    log.status = EmailStatusEnum.PENDING
    log.retry_count = 0
    log.error_message = None
    db.commit()

    from src.modules.messaging.service import _send_with_retry
    from src.core.config import settings

    background_tasks.add_task(
        _send_with_retry,
        log_id=log.id,
        config_id=config.id,
        recipient_email=log.recipient_email,
        subject=log.subject,
        body_html=log.body_preview or "",
        db_url=str(settings.DATABASE_URL),
    )

    return {"status": "success", "message": "Re-envio agendado com sucesso."}


# ==================== AVAILABLE ACTIONS ====================

@router.get("/actions", response_model=List[AvailableAction])
def list_available_actions(
    current_user: User = Depends(get_current_user),
):
    _require_admin(current_user)
    return AVAILABLE_ACTIONS
