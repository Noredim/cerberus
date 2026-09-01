from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.integrations.google.schemas import (
    GoogleAuthUrlResponse,
    GoogleCallbackRequest,
    GoogleIntegrationStatusResponse
)
from src.modules.integrations.google import service as google_service

router = APIRouter(prefix="/integrations/google", tags=["Integrations - Google Calendar"])

@router.get("/auth-url", response_model=GoogleAuthUrlResponse)
def get_google_auth_url(
    current_user: User = Depends(get_current_user)
):
    """
    Gera a URL segura com state anti-CSRF para o usuário conectar sua conta Google.
    """
    url = google_service.get_auth_url(user_id=current_user.id, tenant_id=current_user.tenant_id)
    return GoogleAuthUrlResponse(auth_url=url)

@router.post("/callback", response_model=GoogleIntegrationStatusResponse)
def handle_google_callback(
    payload: GoogleCallbackRequest,
    db: Session = Depends(get_db)
):
    """
    Processa o retorno do OAuth 2.0 do Google, validando o state e salvando os tokens criptografados.
    """
    integration = google_service.handle_oauth_callback(db, code=payload.code, state=payload.state)
    return GoogleIntegrationStatusResponse(
        is_connected=True,
        is_active=integration.is_active,
        google_email=integration.google_email,
        last_sync_at=integration.last_sync_at,
        last_error_message=integration.last_error_message,
        created_at=integration.created_at
    )

@router.get("/status", response_model=GoogleIntegrationStatusResponse)
def get_user_google_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Retorna o status atual da integração Google Calendar do usuário logado.
    """
    return google_service.get_integration_status(db, user_id=current_user.id)

@router.post("/disconnect")
def disconnect_google(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Desconecta a conta Google do usuário logado e revoga autorizações.
    """
    success = google_service.disconnect_integration(db, user_id=current_user.id)
    return {"success": success, "message": "Conta Google desconectada com sucesso."}
