import httpx
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy.orm import Session

from src.modules.integrations.google.models import UserGoogleIntegration, CalendarEventSyncLog
from src.modules.integrations.google.schemas import CalendarEventData
from src.modules.integrations.google.service import get_valid_access_token

GOOGLE_CALENDAR_EVENTS_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events"

def _build_google_event_payload(data: CalendarEventData) -> dict:
    start_iso = data.start_time.isoformat()
    end_iso = data.end_time.isoformat()

    payload = {
        "summary": data.summary,
        "description": data.description or "",
        "start": {
            "dateTime": start_iso,
            "timeZone": data.time_zone
        },
        "end": {
            "dateTime": end_iso,
            "timeZone": data.time_zone
        }
    }
    if data.location:
        payload["location"] = data.location

    if data.attendees:
        valid_attendees = [{"email": e.strip()} for e in data.attendees if e and e.strip() and "@" in e]
        if valid_attendees:
            payload["attendees"] = valid_attendees

    return payload

def create_calendar_event(
    db: Session,
    user_id: str,
    event_data: CalendarEventData,
    entity_type: str = "LEAD_TASK",
    entity_id: str = ""
) -> Optional[str]:
    integration = db.query(UserGoogleIntegration).filter(
        UserGoogleIntegration.user_id == user_id,
        UserGoogleIntegration.is_active == True
    ).first()

    if not integration:
        # Usuário não possui conta Google conectada
        return None

    token = get_valid_access_token(db, integration)
    if not token:
        _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, None, "CREATE", "FAILED", "Não foi possível obter token de acesso válido.")
        return None

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    body = _build_google_event_payload(event_data)
    params = {"sendUpdates": "all"} if event_data.attendees else None

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(GOOGLE_CALENDAR_EVENTS_API, headers=headers, json=body, params=params)
            if res.status_code in [200, 201]:
                event_json = res.json()
                event_id = event_json.get("id")
                integration.last_sync_at = datetime.now(timezone.utc)
                integration.last_error_message = None
                db.commit()

                _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, event_id, "CREATE", "SUCCESS")
                return event_id
            else:
                err_msg = f"HTTP {res.status_code}: {res.text}"
                integration.last_error_message = err_msg
                db.commit()
                _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, None, "CREATE", "FAILED", err_msg)
                return None
    except Exception as e:
        err_msg = f"Erro de conexão com a API Google Calendar: {str(e)}"
        integration.last_error_message = err_msg
        db.commit()
        _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, None, "CREATE", "FAILED", err_msg)
        return None

def update_calendar_event(
    db: Session,
    user_id: str,
    google_event_id: str,
    event_data: CalendarEventData,
    entity_type: str = "LEAD_TASK",
    entity_id: str = ""
) -> bool:
    if not google_event_id:
        return False

    integration = db.query(UserGoogleIntegration).filter(
        UserGoogleIntegration.user_id == user_id,
        UserGoogleIntegration.is_active == True
    ).first()

    if not integration:
        return False

    token = get_valid_access_token(db, integration)
    if not token:
        _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, google_event_id, "UPDATE", "FAILED", "Token inválido.")
        return False

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    body = _build_google_event_payload(event_data)
    url = f"{GOOGLE_CALENDAR_EVENTS_API}/{google_event_id}"
    params = {"sendUpdates": "all"} if event_data.attendees else None

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.patch(url, headers=headers, json=body, params=params)
            if res.status_code == 200:
                integration.last_sync_at = datetime.now(timezone.utc)
                integration.last_error_message = None
                db.commit()
                _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, google_event_id, "UPDATE", "SUCCESS")
                return True
            elif res.status_code == 404:
                # Evento não existe mais no Google, tentar recriar
                new_id = create_calendar_event(db, user_id, event_data, entity_type, entity_id)
                return bool(new_id)
            else:
                err_msg = f"HTTP {res.status_code}: {res.text}"
                integration.last_error_message = err_msg
                db.commit()
                _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, google_event_id, "UPDATE", "FAILED", err_msg)
                return False
    except Exception as e:
        err_msg = f"Erro ao atualizar evento no Google: {str(e)}"
        integration.last_error_message = err_msg
        db.commit()
        _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, google_event_id, "UPDATE", "FAILED", err_msg)
        return False

def delete_calendar_event(
    db: Session,
    user_id: str,
    google_event_id: str,
    entity_type: str = "LEAD_TASK",
    entity_id: str = ""
) -> bool:
    if not google_event_id:
        return False

    integration = db.query(UserGoogleIntegration).filter(
        UserGoogleIntegration.user_id == user_id,
        UserGoogleIntegration.is_active == True
    ).first()

    if not integration:
        return False

    token = get_valid_access_token(db, integration)
    if not token:
        return False

    headers = {"Authorization": f"Bearer {token}"}
    url = f"{GOOGLE_CALENDAR_EVENTS_API}/{google_event_id}"
    params = {"sendUpdates": "all"}

    try:
        with httpx.Client(timeout=8.0) as client:
            res = client.delete(url, headers=headers, params=params)
            if res.status_code in [200, 204, 404, 410]:
                _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, google_event_id, "DELETE", "SUCCESS")
                return True
            else:
                _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, google_event_id, "DELETE", "FAILED", res.text)
                return False
    except Exception as e:
        _log_sync(db, integration.tenant_id, user_id, entity_type, entity_id, google_event_id, "DELETE", "FAILED", str(e))
        return False

def _log_sync(
    db: Session,
    tenant_id: str,
    user_id: str,
    entity_type: str,
    entity_id: str,
    google_event_id: Optional[str],
    action: str,
    status: str,
    error_detail: Optional[str] = None
):
    try:
        log = CalendarEventSyncLog(
            tenant_id=tenant_id,
            user_id=user_id,
            entity_type=entity_type,
            entity_id=str(entity_id),
            google_event_id=google_event_id,
            action=action,
            status=status,
            error_detail=error_detail
        )
        db.add(log)
        db.commit()
    except Exception as err:
        print(f"[GOOGLE CALENDAR LOG ERROR] {err}")
