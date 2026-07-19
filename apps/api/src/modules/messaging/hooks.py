import logging
from typing import Optional, Dict, Any

from sqlalchemy.orm import Session

from src.modules.messaging.models import EmailTrigger
from src.modules.messaging.service import (
    get_active_config,
    resolve_recipients,
    render_template,
    create_and_dispatch_email,
)
from src.modules.users.models import User

logger = logging.getLogger(__name__)


def emit_messaging_event(
    action_key: str,
    context: Dict[str, Any],
    source_module: str,
    user: User,
    db: Session,
    background_tasks,
    source_entity_id: Optional[str] = None,
) -> None:
    """
    Hook to be called from any module after an action.
    Checks if there are active triggers for the action and dispatches emails.

    Usage in routers:
        from src.modules.messaging.hooks import emit_messaging_event

        emit_messaging_event(
            action_key="opportunity.created",
            context={"nome": opp.name, "numero": opp.numero, "cliente": opp.customer_name},
            source_module="oportunidades",
            user=current_user,
            db=db,
            background_tasks=background_tasks,
            source_entity_id=str(opp.id),
        )
    """
    tenant_id = user.tenant_id

    # Find active config for tenant
    config = get_active_config(db, tenant_id)
    if not config:
        logger.debug(f"[Messaging] No active SMTP config for tenant={tenant_id}. Skipping.")
        return

    # Find active triggers for this action
    triggers = db.query(EmailTrigger).filter(
        EmailTrigger.tenant_id == tenant_id,
        EmailTrigger.action_key == action_key,
        EmailTrigger.is_active == True,
    ).all()

    if not triggers:
        logger.debug(f"[Messaging] No active triggers for action={action_key}. Skipping.")
        return

    for trigger in triggers:
        # Resolve recipients
        recipients = resolve_recipients(db, trigger, tenant_id)

        if not recipients:
            logger.warning(f"[Messaging] No recipients resolved for trigger={trigger.id}.")
            continue

        # Render templates
        subject = render_template(trigger.subject_template, context)
        body = render_template(trigger.body_template, context)

        # Dispatch email for each recipient
        for recipient in recipients:
            try:
                create_and_dispatch_email(
                    db=db,
                    config=config,
                    trigger=trigger,
                    action_key=action_key,
                    source_module=source_module,
                    source_entity_id=source_entity_id,
                    user=user,
                    recipient_email=recipient,
                    subject=subject,
                    body_html=body,
                    background_tasks=background_tasks,
                )
            except Exception as e:
                logger.error(f"[Messaging] Failed to dispatch email to {recipient}: {e}")
