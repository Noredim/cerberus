import asyncio
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any, List

from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

from src.core.config import settings
from src.modules.messaging.models import (
    EmailConfig,
    EmailTrigger,
    EmailLog,
    EmailStatusEnum,
    RecipientsTypeEnum,
)
from src.modules.users.models import User, UserRole, UserRoleEnum

logger = logging.getLogger(__name__)

# --- Available Actions Registry ---
AVAILABLE_ACTIONS = [
    {
        "key": "opportunity.created",
        "label": "Nova Oportunidade Criada",
        "module": "oportunidades",
        "variables": [
            {"name": "numero", "description": "Número identificador da oportunidade"},
            {"name": "vendedor", "description": "Nome do vendedor associado"},
            {"name": "responsavel", "description": "Nome do responsável comercial/técnico"},
            {"name": "cliente", "description": "Razão social do cliente"},
            {"name": "valor_total", "description": "Valor monetário total estimado"},
            {"name": "status", "description": "Status atual da oportunidade"},
        ],
    },
    {
        "key": "opportunity.status_changed",
        "label": "Status de Oportunidade Alterado",
        "module": "oportunidades",
        "variables": [
            {"name": "numero", "description": "Número identificador da oportunidade"},
            {"name": "vendedor", "description": "Nome do vendedor associado"},
            {"name": "responsavel", "description": "Nome do responsável comercial/técnico"},
            {"name": "cliente", "description": "Razão social do cliente"},
            {"name": "valor_total", "description": "Valor monetário total estimado"},
            {"name": "status", "description": "Status atual da oportunidade"},
        ],
    },
    {
        "key": "proposal.approved",
        "label": "Proposta Aprovada",
        "module": "propostas",
        "variables": [
            {"name": "numero", "description": "Número da proposta de venda"},
            {"name": "vendedor", "description": "Nome do vendedor que elaborou a proposta"},
            {"name": "cliente", "description": "Razão social do cliente"},
            {"name": "valor", "description": "Valor total da proposta comercial"},
            {"name": "status", "description": "Status de aprovação"},
        ],
    },
    {
        "key": "proposal.rejected",
        "label": "Proposta Rejeitada",
        "module": "propostas",
        "variables": [
            {"name": "numero", "description": "Número da proposta de venda"},
            {"name": "vendedor", "description": "Nome do vendedor que elaborou a proposta"},
            {"name": "cliente", "description": "Razão social do cliente"},
            {"name": "valor", "description": "Valor total da proposta comercial"},
            {"name": "status", "description": "Status de aprovação"},
        ],
    },
    {
        "key": "licitacao.created",
        "label": "Nova Licitação Cadastrada",
        "module": "licitações",
        "variables": [
            {"name": "numero_edital", "description": "Número do edital da licitação pública"},
            {"name": "cliente", "description": "Órgão ou autarquia licitante"},
            {"name": "modalidade", "description": "Modalidade da licitação"},
            {"name": "valor_total_estimado", "description": "Valor estimado do edital"},
            {"name": "status", "description": "Status interno da licitação"},
        ],
    },
    {
        "key": "licitacao.status_changed",
        "label": "Status de Licitação Alterado",
        "module": "licitações",
        "variables": [
            {"name": "numero_edital", "description": "Número do edital da licitação pública"},
            {"name": "cliente", "description": "Órgão ou autarquia licitante"},
            {"name": "modalidade", "description": "Modalidade da licitação"},
            {"name": "valor_total_estimado", "description": "Valor estimado do edital"},
            {"name": "status", "description": "Status interno da licitação"},
        ],
    },
    {
        "key": "user.created",
        "label": "Novo Usuário Criado",
        "module": "usuários",
        "variables": [
            {"name": "nome", "description": "Nome completo do usuário"},
            {"name": "email", "description": "E-mail de login do usuário"},
        ],
    },
    {
        "key": "user.deactivated",
        "label": "Usuário Desativado",
        "module": "usuários",
        "variables": [
            {"name": "nome", "description": "Nome completo do usuário"},
            {"name": "email", "description": "E-mail de login do usuário"},
        ],
    },
]


# Retry settings
MAX_RETRIES = 5
RETRY_INTERVAL_SECONDS = 120  # 2 minutes


# --- Encryption ---

def _get_fernet() -> Fernet:
    key = settings.EMAIL_ENCRYPTION_KEY
    if not key:
        raise ValueError("EMAIL_ENCRYPTION_KEY not configured. Cannot encrypt/decrypt SMTP passwords.")
    return Fernet(key.encode() if isinstance(key, str) else key)


def encrypt_password(password: str) -> str:
    f = _get_fernet()
    return f.encrypt(password.encode()).decode()


def decrypt_password(encrypted: str) -> str:
    f = _get_fernet()
    return f.decrypt(encrypted.encode()).decode()


# --- SMTP Config ---

def get_active_config(db: Session, tenant_id: str) -> Optional[EmailConfig]:
    return db.query(EmailConfig).filter(
        EmailConfig.tenant_id == tenant_id,
        EmailConfig.is_active == True
    ).first()


# --- Template Rendering ---

def render_template(template: str, context: Dict[str, Any]) -> str:
    """Replace {{variable}} placeholders in template with context values."""
    result = template
    for key, value in context.items():
        result = result.replace("{{" + key + "}}", str(value) if value is not None else "")
    return result


# --- Email Sending (Sync, used inside background task) ---

def _send_smtp_email(
    config: EmailConfig,
    recipient_email: str,
    subject: str,
    body_html: str,
) -> None:
    """Send a single email via SMTP. Raises on failure."""
    password = decrypt_password(config.smtp_password_encrypted)

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{config.sender_name} <{config.sender_email}>"
    msg["To"] = recipient_email
    msg["Subject"] = subject

    # HTML body
    html_part = MIMEText(body_html, "html", "utf-8")
    msg.attach(html_part)

    # Plain text fallback
    import re
    plain_text = re.sub(r"<[^>]+>", "", body_html)
    text_part = MIMEText(plain_text, "plain", "utf-8")
    msg.attach(text_part)

    if config.smtp_use_ssl:
        server = smtplib.SMTP_SSL(config.smtp_host, config.smtp_port, timeout=30)
    else:
        server = smtplib.SMTP(config.smtp_host, config.smtp_port, timeout=30)

    try:
        if config.smtp_use_tls and not config.smtp_use_ssl:
            server.starttls()
        server.login(config.smtp_user, password)
        server.sendmail(config.sender_email, recipient_email, msg.as_string())
    finally:
        server.quit()


# --- Retry Logic (Background Task) ---

async def _send_with_retry(
    log_id: str,
    config_id: str,
    recipient_email: str,
    subject: str,
    body_html: str,
    db_url: str,
) -> None:
    """Background task: tries sending up to MAX_RETRIES times with RETRY_INTERVAL_SECONDS delay."""
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    engine = create_engine(db_url)
    SessionLocal = sessionmaker(bind=engine)

    for attempt in range(1, MAX_RETRIES + 1):
        db = SessionLocal()
        try:
            email_log = db.query(EmailLog).filter(EmailLog.id == log_id).first()
            config = db.query(EmailConfig).filter(EmailConfig.id == config_id).first()

            if not email_log or not config:
                logger.error(f"[Messaging] Log or config not found: log={log_id}, config={config_id}")
                return

            # Update retry count and status
            email_log.retry_count = attempt
            if attempt > 1:
                email_log.status = EmailStatusEnum.RETRYING

            try:
                _send_smtp_email(config, recipient_email, subject, body_html)

                # Success
                email_log.status = EmailStatusEnum.SENT
                email_log.sent_at = datetime.now(timezone.utc)
                email_log.error_message = None
                email_log.next_retry_at = None
                db.commit()
                logger.info(f"[Messaging] Email sent successfully: log={log_id}, attempt={attempt}")
                return

            except Exception as e:
                error_msg = str(e)[:500]
                email_log.error_message = f"Tentativa {attempt}/{MAX_RETRIES}: {error_msg}"
                logger.warning(f"[Messaging] Send failed (attempt {attempt}/{MAX_RETRIES}): {error_msg}")

                if attempt < MAX_RETRIES:
                    email_log.next_retry_at = datetime.now(timezone.utc) + timedelta(seconds=RETRY_INTERVAL_SECONDS)
                    email_log.status = EmailStatusEnum.RETRYING
                    db.commit()
                else:
                    # All retries exhausted
                    email_log.status = EmailStatusEnum.FAILED
                    email_log.next_retry_at = None
                    db.commit()
                    logger.error(f"[Messaging] All retries exhausted for log={log_id}. Marked as FAILED.")
                    return

        finally:
            db.close()

        # Wait before next retry
        if attempt < MAX_RETRIES:
            await asyncio.sleep(RETRY_INTERVAL_SECONDS)

    engine.dispose()


# --- Dispatch Email ---

def create_and_dispatch_email(
    db: Session,
    config: EmailConfig,
    trigger: Optional[EmailTrigger],
    action_key: str,
    source_module: str,
    source_entity_id: Optional[str],
    user: User,
    recipient_email: str,
    subject: str,
    body_html: str,
    background_tasks,
) -> EmailLog:
    """Create email log entry and dispatch background send with retry."""
    email_log = EmailLog(
        tenant_id=config.tenant_id,
        trigger_id=trigger.id if trigger else None,
        action_key=action_key,
        source_module=source_module,
        source_entity_id=source_entity_id,
        requested_by_user_id=user.id,
        requested_by_user_name=user.name,
        recipient_email=recipient_email,
        subject=subject,
        body_preview=body_html[:500] if body_html else None,
        status=EmailStatusEnum.PENDING,
        retry_count=0,
        max_retries=MAX_RETRIES,
    )
    db.add(email_log)
    db.commit()
    db.refresh(email_log)

    # Schedule background send with retry
    background_tasks.add_task(
        _send_with_retry,
        log_id=email_log.id,
        config_id=config.id,
        recipient_email=recipient_email,
        subject=subject,
        body_html=body_html,
        db_url=str(settings.DATABASE_URL),
    )

    return email_log


# --- Resolve Recipients ---

def resolve_recipients(
    db: Session,
    trigger: EmailTrigger,
    tenant_id: str,
) -> List[str]:
    """Resolve recipient emails based on trigger configuration."""
    if trigger.recipients_type == RecipientsTypeEnum.FIXED:
        return trigger.recipients_fixed or []

    elif trigger.recipients_type == RecipientsTypeEnum.ROLE_BASED:
        roles = trigger.recipients_roles or []
        role_enums = []
        for role_str in roles:
            try:
                role_enums.append(UserRoleEnum(role_str))
            except ValueError:
                continue

        if not role_enums:
            return []

        users = db.query(User).join(UserRole).filter(
            User.tenant_id == tenant_id,
            User.is_active == True,
            UserRole.role.in_(role_enums),
        ).all()

        return list(set(u.email for u in users))

    # DYNAMIC: handled by the calling module (context-dependent)
    return []


# --- Send Test Email ---

def send_test_email_sync(
    config: EmailConfig,
    recipient_email: str,
    subject: str = "Cerberus - E-mail de Teste",
    body: str = "Este é um e-mail de teste enviado pelo Cerberus para validar a configuração SMTP.",
) -> dict:
    """Send a test email synchronously. Returns status dict."""
    try:
        body_html = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 600px;">
            <h2 style="color: #2563eb;">✅ Cerberus - Teste de E-mail</h2>
            <p>{body}</p>
            <hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="font-size: 12px; color: #6b7280;">
                Este e-mail foi enviado automaticamente pelo sistema Cerberus para verificar a configuração SMTP.
            </p>
        </div>
        """
        _send_smtp_email(config, recipient_email, subject, body_html)
        return {"success": True, "message": "E-mail de teste enviado com sucesso!"}
    except Exception as e:
        return {"success": False, "message": f"Falha no envio: {str(e)}"}
