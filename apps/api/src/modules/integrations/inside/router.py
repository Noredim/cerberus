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


@router.post("/test-estoque-connection", response_model=InsideTestConnectionResponse)
def test_inside_estoque_connection(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Testa a conectividade com a API de Consulta de Estoque e Preços em Tempo Real
    e valida a chave X-API-KEY.
    """
    return InsideIntegrationService.test_estoque_connection(
        db=db,
        company_id=company_id,
        user_id=current_user.id,
    )


@router.get("/estoque/consulta")
def consultar_estoque_realtime(
    company_id: UUID,
    nome: Optional[str] = Query(None, description="Nome ou termo de busca do produto"),
    cod_produto: Optional[str] = Query(None, description="Código numérico do produto no ERP (codProduto)"),
    tipo_estoque: Optional[str] = Query(None, description="Tipo de estoque (ex: NOVOS, TODOS)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Consulta a posição de estoque, custos e preços de produtos em tempo real na API do Inside.
    """
    return InsideIntegrationService.consultar_estoque_realtime(
        db=db,
        company_id=company_id,
        nome=nome,
        cod_produto=cod_produto,
        tipo_estoque=tipo_estoque,
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


@router.post("/products/{product_id}/sync")
def sync_product_stock(
    company_id: UUID,
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Consulta o Inside ERP em tempo real para o produto e atualiza os campos de estoque/custo em cache.
    """
    return InsideIntegrationService.sync_product_stock(
        db=db,
        company_id=company_id,
        product_id=product_id,
        user_id=current_user.id,
    )


@router.get("/correlation/analysis")
def get_correlation_analysis(
    company_id: UUID,
    filter_stock_only: bool = Query(False, description="Filtrar apenas itens com saldo positivo"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Retorna o levantamento de correlação entre os produtos do estoque Novos do Inside e os produtos do Cerberus.
    """
    return InsideIntegrationService.get_correlation_analysis(
        db=db,
        company_id=company_id,
        filter_stock_only=filter_stock_only,
    )


@router.post("/correlation/link")
def link_product_manually(
    company_id: UUID,
    product_id: UUID = Query(...),
    cod_produto: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Vincula manualmente um produto do Cerberus ao código do Inside ERP e sincroniza seu estoque.
    """
    return InsideIntegrationService.link_product_manually(
        db=db,
        company_id=company_id,
        product_id=product_id,
        cod_produto=cod_produto,
        user_id=current_user.id,
    )


@router.post("/correlation/auto-link-exact")
def auto_link_exact(
    company_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Vincula automaticamente todos os produtos que possuem correspondência exata de nome com o Inside ERP.
    """
    return InsideIntegrationService.auto_link_exact(
        db=db,
        company_id=company_id,
        user_id=current_user.id,
    )


@router.post("/correlation/import-product")
def import_product_from_inside(
    company_id: UUID,
    cod_produto: int = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Importa um produto novo do Inside ERP para a base do Cerberus já vinculado.
    """
    return InsideIntegrationService.import_product_from_inside(
        db=db,
        company_id=company_id,
        cod_produto=cod_produto,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
    )

