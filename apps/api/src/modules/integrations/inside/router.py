from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from .service import InsideIntegrationService
from .schemas import (
    InsideTestConnectionResponse,
    InsideDryRunResponse,
    IntegrationLogsPaginated,
)

router = APIRouter(prefix="/companies/{company_id}/inside", tags=["Inside ERP Integration"])


@router.post("/test-connection", response_model=InsideTestConnectionResponse)
def test_inside_connection(
    company_id: UUID,
    target_env: str = Query("DEFAULT", description="Ambiente alvo: SERVICOS, PRODUTOS ou DEFAULT"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Testa a conectividade com o servidor Inside Service OnPremises (porta 65191)
    para o ambiente especificado (SERVICOS, PRODUTOS ou DEFAULT) e valida a chave Hash Token.
    """
    return InsideIntegrationService.test_connection(
        db=db,
        company_id=company_id,
        target_env=target_env,
        user_id=current_user.id,
    )


@router.get("/logs", response_model=IntegrationLogsPaginated)
def get_inside_logs(
    company_id: UUID,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna o histórico paginado de logs de auditoria da integração Inside ERP.
    """
    return InsideIntegrationService.list_logs(
        db=db,
        company_id=company_id,
        page=page,
        size=size,
    )


@router.post("/sync/formas-pagamento")
def sync_formas_pagamento(
    company_id: UUID,
    target_env: str = Query("SERVICOS", description="Ambiente alvo: SERVICOS, PRODUTOS ou DEFAULT"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Sincroniza as Formas de Pagamento do Inside ERP com o Cerberus:
    consulta o ERP, cadastra novas formas e correlaciona as existentes.
    """
    return InsideIntegrationService.sync_formas_pagamento(
        db=db,
        company_id=company_id,
        user_id=current_user.id,
        target_env=target_env,
    )


@router.post("/dry-run/sales-budget/{budget_id}", response_model=InsideDryRunResponse)
def dry_run_sales_budget(
    company_id: UUID,
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Executa a simulação completa (Dry-Run) do envio de um orçamento para o Inside ERP,
    validando todos os de-paras e gerando os payloads sem persistir alterações reais no ERP.
    """
    return InsideIntegrationService.dry_run_sales_budget(
        db=db,
        company_id=company_id,
        budget_id=budget_id,
        user_id=current_user.id,
    )
