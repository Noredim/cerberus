import urllib.parse
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any
import httpx
from cryptography.fernet import Fernet
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from fastapi import HTTPException

from src.core.config import settings
from src.modules.integrations.google.models import UserGoogleIntegration, CalendarEventSyncLog
from src.modules.integrations.google.schemas import GoogleIntegrationStatusResponse

GOOGLE_AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO_ENDPOINT = "https://www.googleapis.com/oauth2/v2/userinfo"
GOOGLE_REVOKE_ENDPOINT = "https://oauth2.googleapis.com/revoke"

SCOPES = [
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/userinfo.email"
]

def _get_fernet() -> Fernet:
    key = settings.EMAIL_ENCRYPTION_KEY
    if not key:
        import hashlib, base64
        key_hash = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        key = base64.urlsafe_b64encode(key_hash).decode()
    return Fernet(key.encode() if isinstance(key, str) else key)

def encrypt_token(token: str) -> str:
    if not token:
        return ""
    f = _get_fernet()
    return f.encrypt(token.encode()).decode()

def decrypt_token(encrypted_token: str) -> str:
    if not encrypted_token:
        return ""
    f = _get_fernet()
    return f.decrypt(encrypted_token.encode()).decode()

def generate_state_token(user_id: str, tenant_id: str) -> str:
    payload = {
        "user_id": user_id,
        "tenant_id": tenant_id,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15)
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_and_validate_state_token(state: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(state, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if "user_id" not in payload or "tenant_id" not in payload:
            raise HTTPException(status_code=400, detail="State token inválido.")
        return payload
    except JWTError:
        raise HTTPException(status_code=400, detail="State token expirado ou inválido.")

def get_auth_url(user_id: str, tenant_id: str) -> str:
    if not settings.GOOGLE_CLIENT_ID:
        raise HTTPException(
            status_code=400,
            detail="Integração Google não configurada. Defina GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no servidor."
        )

    state = generate_state_token(user_id, tenant_id)
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "access_type": "offline",
        "prompt": "consent",
        "state": state
    }
    return f"{GOOGLE_AUTH_ENDPOINT}?{urllib.parse.urlencode(params)}"

def handle_oauth_callback(db: Session, code: str, state: str) -> UserGoogleIntegration:
    payload = decode_and_validate_state_token(state)
    user_id = payload["user_id"]
    tenant_id = payload["tenant_id"]

    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(status_code=500, detail="Credenciais Google não configuradas no servidor.")

    # 1. Troca de code por tokens
    token_data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
    }

    with httpx.Client(timeout=15.0) as client:
        res = client.post(GOOGLE_TOKEN_ENDPOINT, data=token_data)
        if res.status_code != 200:
            error_text = res.text
            raise HTTPException(
                status_code=400,
                detail=f"Erro ao trocar código por tokens no Google: {error_text}"
            )
        tokens = res.json()

        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        expires_in = tokens.get("expires_in", 3600)

        # 2. Obter e-mail da conta do usuário
        userinfo_res = client.get(
            GOOGLE_USERINFO_ENDPOINT,
            headers={"Authorization": f"Bearer {access_token}"}
        )
        google_email = "desconhecido@google.com"
        google_user_id = None
        if userinfo_res.status_code == 200:
            u_info = userinfo_res.json()
            google_email = u_info.get("email", google_email)
            google_user_id = u_info.get("id")

    token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)

    # 3. Salvar ou atualizar na base
    integration = db.query(UserGoogleIntegration).filter(
        UserGoogleIntegration.user_id == user_id
    ).first()

    if not integration:
        integration = UserGoogleIntegration(
            user_id=user_id,
            tenant_id=tenant_id,
            google_email=google_email,
            google_user_id=google_user_id,
            access_token_encrypted=encrypt_token(access_token),
            refresh_token_encrypted=encrypt_token(refresh_token) if refresh_token else None,
            token_expires_at=token_expires_at,
            scopes=SCOPES,
            is_active=True
        )
        db.add(integration)
    else:
        integration.google_email = google_email
        integration.google_user_id = google_user_id
        integration.access_token_encrypted = encrypt_token(access_token)
        if refresh_token:
            integration.refresh_token_encrypted = encrypt_token(refresh_token)
        integration.token_expires_at = token_expires_at
        integration.is_active = True
        integration.last_error_message = None

    db.commit()
    db.refresh(integration)
    return integration

def get_valid_access_token(db: Session, integration: UserGoogleIntegration) -> Optional[str]:
    if not integration or not integration.is_active:
        return None

    now = datetime.now(timezone.utc)
    # Se expira nos próximos 90 segundos, renovar
    if integration.token_expires_at > now + timedelta(seconds=90):
        return decrypt_token(integration.access_token_encrypted)

    refresh_token = decrypt_token(integration.refresh_token_encrypted)
    if not refresh_token:
        integration.last_error_message = "Refresh token ausente. Reconexão necessária."
        integration.is_active = False
        db.commit()
        return None

    # Chamar endpoint de refresh do Google
    refresh_data = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }

    try:
        with httpx.Client(timeout=10.0) as client:
            res = client.post(GOOGLE_TOKEN_ENDPOINT, data=refresh_data)
            if res.status_code != 200:
                integration.last_error_message = f"Falha ao renovar token: {res.text}"
                if res.status_code in [400, 401]:
                    integration.is_active = False
                db.commit()
                return None

            data = res.json()
            new_access_token = data.get("access_token")
            expires_in = data.get("expires_in", 3600)

            integration.access_token_encrypted = encrypt_token(new_access_token)
            integration.token_expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
            integration.last_error_message = None
            db.commit()
            return new_access_token
    except Exception as e:
        integration.last_error_message = f"Erro de conexão ao renovar token: {str(e)}"
        db.commit()
        return None

def disconnect_integration(db: Session, user_id: str) -> bool:
    integration = db.query(UserGoogleIntegration).filter(
        UserGoogleIntegration.user_id == user_id
    ).first()

    if not integration:
        return False

    # Tenta revogar no Google de forma silenciosa
    token = decrypt_token(integration.access_token_encrypted)
    if token:
        try:
            with httpx.Client(timeout=5.0) as client:
                client.post(f"{GOOGLE_REVOKE_ENDPOINT}?token={token}")
        except Exception:
            pass

    db.delete(integration)
    db.commit()
    return True

def get_integration_status(db: Session, user_id: str) -> GoogleIntegrationStatusResponse:
    integration = db.query(UserGoogleIntegration).filter(
        UserGoogleIntegration.user_id == user_id
    ).first()

    if not integration:
        return GoogleIntegrationStatusResponse(is_connected=False, is_active=False)

    return GoogleIntegrationStatusResponse(
        is_connected=True,
        is_active=integration.is_active,
        google_email=integration.google_email,
        last_sync_at=integration.last_sync_at,
        last_error_message=integration.last_error_message,
        created_at=integration.created_at
    )
