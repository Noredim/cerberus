from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from decimal import Decimal

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from src.modules.opportunity_kits.models import OpportunityKit

from . import schemas
from .service import LicitacaoService
from .models import LicitacaoLote, LicitacaoItem, Licitacao
from .reports import LicitacoesReportService

router = APIRouter(
    prefix="/licitacoes",
    tags=["Licitações"]
)

@router.get("", response_model=schemas.LicitacaoListResponse)
def list_licitacoes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    items, total = LicitacaoService.get_licitacoes(db, tenant_id, company_id, skip, limit, status)
    
    # We return standard list metadata
    return {"total": total, "items": items}

@router.get("/{licitacao_id}", response_model=schemas.LicitacaoResponse)
def get_licitacao(
    licitacao_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)

@router.post("/{licitacao_id}/recalculate", response_model=schemas.LicitacaoResponse)
def recalculate_licitacao(
    licitacao_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    licitacao = LicitacaoService.recalculate_licitacao(db, tenant_id, licitacao_id)
    if not licitacao:
        raise HTTPException(status_code=404, detail="Licitação não encontrada")
    return licitacao

@router.post("", response_model=schemas.LicitacaoResponse)
def create_licitacao(
    data: schemas.LicitacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.create_licitacao(db, tenant_id, company_id, data, current_user)

@router.put("/{licitacao_id}", response_model=schemas.LicitacaoResponse)
def update_licitacao(
    licitacao_id: UUID,
    data: schemas.LicitacaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.update_licitacao(db, tenant_id, company_id, licitacao_id, data, current_user)

@router.delete("/{licitacao_id}", status_code=204)
def delete_licitacao(
    licitacao_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.delete_licitacao(db, tenant_id, company_id, licitacao_id)
    return None

# --- Lotes CRUD endpoints ---

@router.post("/{licitacao_id}/lotes", response_model=schemas.LicitacaoLoteResponse)
def add_lote(
    licitacao_id: UUID,
    data: schemas.LicitacaoLoteBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    tenant_id = str(current_user.tenant_id)
    user_id = str(current_user.id)
    licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
        raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")
    
    lote = LicitacaoLote(
        licitacao_id=licitacao_id,
        numero=data.numero,
        nome=data.nome,
        descricao=data.descricao
    )
    db.add(lote)
    
    # Log to timeline
    LicitacaoService.register_history(
        db,
        licitacao_id,
        tenant_id,
        user_id,
        f"{current_user.name} adicionou o Lote {data.numero}: {data.nome}."
    )
    
    db.commit()
    db.refresh(lote)
    LicitacaoService.invalidate_licitacao_totals(db, licitacao_id)
    return lote

@router.put("/{licitacao_id}/lotes/{lote_id}", response_model=schemas.LicitacaoLoteResponse)
def update_lote(
    licitacao_id: UUID,
    lote_id: UUID,
    data: schemas.LicitacaoLoteBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    tenant_id = str(current_user.tenant_id)
    user_id = str(current_user.id)
    licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
        raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")
    
    lote = db.query(LicitacaoLote).filter(LicitacaoLote.id == lote_id, LicitacaoLote.licitacao_id == licitacao_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    
    lote.numero = data.numero
    lote.nome = data.nome
    lote.descricao = data.descricao
    
    # Log to timeline
    LicitacaoService.register_history(
        db,
        licitacao_id,
        tenant_id,
        user_id,
        f"{current_user.name} alterou o Lote {data.numero}: {data.nome}."
    )
    
    db.commit()
    db.refresh(lote)
    LicitacaoService.invalidate_licitacao_totals(db, licitacao_id)
    return lote

@router.delete("/{licitacao_id}/lotes/{lote_id}", status_code=204)
def delete_lote(
    licitacao_id: UUID,
    lote_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    tenant_id = str(current_user.tenant_id)
    user_id = str(current_user.id)
    licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
        raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")
    
    lote = db.query(LicitacaoLote).filter(LicitacaoLote.id == lote_id, LicitacaoLote.licitacao_id == licitacao_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    
    lote_num = lote.numero
    lote_name = lote.nome
    
    db.delete(lote)
    
    # Log to timeline
    LicitacaoService.register_history(
        db,
        licitacao_id,
        tenant_id,
        user_id,
        f"{current_user.name} excluiu o Lote {lote_num}: {lote_name}."
    )
    
    db.commit()
    LicitacaoService.invalidate_licitacao_totals(db, licitacao_id)
    return None

# --- Itens CRUD endpoints ---

@router.post("/{licitacao_id}/lotes/{lote_id}/items", response_model=schemas.LicitacaoItemResponse)
def add_item(
    licitacao_id: UUID,
    lote_id: UUID,
    data: schemas.LicitacaoItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    tenant_id = str(current_user.tenant_id)
    user_id = str(current_user.id)
    licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
        raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")
    
    lote = db.query(LicitacaoLote).filter(LicitacaoLote.id == lote_id, LicitacaoLote.licitacao_id == licitacao_id).first()
    if not lote:
        raise HTTPException(status_code=404, detail="Lote não encontrado")
    
    # Calculate quantidade_total
    qty_total = data.quantidade
    if data.tipo_fornecimento == "Mensal":
        qty_total = data.quantidade * Decimal(str(data.total_meses))
    else:
        qty_total = data.quantidade

    item = LicitacaoItem(
        lote_id=lote_id,
        codigo=data.codigo,
        nome=data.nome,
        descricao=data.descricao,
        quantidade=data.quantidade,
        tipo_fornecimento=data.tipo_fornecimento,
        total_meses=data.total_meses,
        quantidade_total=qty_total
    )
    db.add(item)
    
    # Log to timeline
    LicitacaoService.register_history(
        db,
        licitacao_id,
        tenant_id,
        user_id,
        f"{current_user.name} adicionou o Item {data.codigo}: {data.nome} no Lote {lote.numero}."
    )
    
    db.commit()
    db.refresh(item)
    LicitacaoService.invalidate_licitacao_totals(db, licitacao_id)
    return LicitacaoService.populate_item_kits_financials(db, tenant_id, item)

@router.put("/{licitacao_id}/items/{item_id}", response_model=schemas.LicitacaoItemResponse)
def update_item(
    licitacao_id: UUID,
    item_id: UUID,
    data: schemas.LicitacaoItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    tenant_id = str(current_user.tenant_id)
    user_id = str(current_user.id)
    licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
        raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")
    
    item = db.query(LicitacaoItem).join(LicitacaoLote).filter(LicitacaoItem.id == item_id, LicitacaoLote.licitacao_id == licitacao_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    # Validação de travamento de edição de campos de quantidade quando há kits ativos
    has_kits = db.query(OpportunityKit).filter(OpportunityKit.licitacao_item_id == item_id).first() is not None
    if has_kits:
        qty_changed = Decimal(str(item.quantidade)) != Decimal(str(data.quantidade))
        tipo_changed = item.tipo_fornecimento != data.tipo_fornecimento
        meses_changed = item.total_meses != data.total_meses
        if qty_changed or tipo_changed or meses_changed:
            raise HTTPException(
                status_code=400,
                detail="Este item está vinculado a um Kit de Oportunidade e seus campos quantitativos (Quantidade, Tipo de Fornecimento ou Total de Meses) não podem ser alterados diretamente."
            )

    # Calculate quantidade_total
    qty_total = data.quantidade
    if data.tipo_fornecimento == "Mensal":
        qty_total = data.quantidade * Decimal(str(data.total_meses))
    else:
        qty_total = data.quantidade

    # Detailed history logging
    prev_tipo = item.tipo_fornecimento
    prev_meses = "vazio" if item.total_meses is None else str(item.total_meses)
    prev_total = str(item.quantidade_total)
    
    new_tipo = data.tipo_fornecimento
    new_meses = "vazio" if data.total_meses is None else str(data.total_meses)
    new_total = str(qty_total)

    item.codigo = data.codigo
    item.nome = data.nome
    item.descricao = data.descricao
    item.quantidade = data.quantidade
    item.tipo_fornecimento = data.tipo_fornecimento
    item.total_meses = data.total_meses
    item.quantidade_total = qty_total
    
    # Log to timeline
    LicitacaoService.register_history(
        db,
        licitacao_id,
        tenant_id,
        user_id,
        f"{current_user.name} alterou o Item {data.codigo}: {data.nome}. Detalhes: Tipo de Fornecimento de {prev_tipo} para {new_tipo}, Total de Meses de {prev_meses} para {new_meses}, Quantidade Total de {prev_total} para {new_total}."
    )
    
    db.commit()
    db.refresh(item)
    
    LicitacaoService.invalidate_licitacao_totals(db, licitacao_id)
    return LicitacaoService.populate_item_kits_financials(db, tenant_id, item)

@router.delete("/{licitacao_id}/items/{item_id}", status_code=204)
def delete_item(
    licitacao_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    tenant_id = str(current_user.tenant_id)
    user_id = str(current_user.id)
    licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    if licitacao.status in ["Ganha", "Perdida", "Cancelada"]:
        raise HTTPException(status_code=400, detail="Esta licitação está finalizada/cancelada e não pode ser editada.")
    
    item = db.query(LicitacaoItem).join(LicitacaoLote).filter(LicitacaoItem.id == item_id, LicitacaoLote.licitacao_id == licitacao_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    
    # Travamento de exclusão se houver kit vinculado
    has_kits = db.query(OpportunityKit).filter(OpportunityKit.licitacao_item_id == item_id).first() is not None
    if has_kits:
        raise HTTPException(
            status_code=400,
            detail="Não é possível excluir este item pois ele está vinculado a um Kit de Oportunidade ativo."
        )

    item_code = item.codigo
    item_name = item.nome
    
    db.delete(item)
    
    # Log to timeline
    LicitacaoService.register_history(
        db,
        licitacao_id,
        tenant_id,
        user_id,
        f"{current_user.name} excluiu o Item {item_code}: {item_name}."
    )
    
    db.commit()
    
    LicitacaoService.invalidate_licitacao_totals(db, licitacao_id)
    return None


# --- Team (PO and Analistas) endpoints ---

@router.post("/{licitacao_id}/analistas", response_model=schemas.LicitacaoAnalistaResponse)
def add_analista(
    licitacao_id: UUID,
    data: schemas.LicitacaoAnalistaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.add_analista(db, tenant_id, company_id, licitacao_id, data.usuario_id, data.prazo_dias_uteis, current_user)

@router.delete("/{licitacao_id}/analistas/{analista_id}", status_code=204)
def remove_analista(
    licitacao_id: UUID,
    analista_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.remove_analista(db, tenant_id, company_id, licitacao_id, analista_id, current_user)
    return None

# --- Timeline (History) endpoints ---

@router.get("/{licitacao_id}/history", response_model=List[schemas.LicitacaoHistoryResponse])
def get_licitacao_history(
    licitacao_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    return LicitacaoService.get_history(db, tenant_id, licitacao_id)

# --- Purchase Budget vínculo endpoints ---

@router.post("/{licitacao_id}/purchase-budgets/{budget_id}", status_code=204)
def link_purchase_budget(
    licitacao_id: UUID,
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.link_purchase_budget(db, tenant_id, company_id, licitacao_id, budget_id, current_user)
    return None

@router.delete("/{licitacao_id}/purchase-budgets/{budget_id}", status_code=204)
def unlink_purchase_budget(
    licitacao_id: UUID,
    budget_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.unlink_purchase_budget(db, tenant_id, company_id, licitacao_id, budget_id, current_user)
    return None


# --- Checklist endpoints ---

@router.get("/{licitacao_id}/checklist", response_model=List[schemas.LicitacaoChecklistGrupoResponse])
def get_checklist(
    licitacao_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.get_checklist(db, tenant_id, licitacao_id, current_user)

@router.put("/{licitacao_id}/checklist/items/{item_id}", response_model=schemas.LicitacaoChecklistItemResponse)
def update_checklist_item(
    licitacao_id: UUID,
    item_id: UUID,
    data: schemas.LicitacaoChecklistItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    return LicitacaoService.update_checklist_item(db, tenant_id, item_id, data, current_user)

@router.post("/{licitacao_id}/checklist/grupos/{grupo_id}/items", response_model=schemas.LicitacaoChecklistItemResponse)
def create_checklist_item(
    licitacao_id: UUID,
    grupo_id: UUID,
    data: schemas.LicitacaoChecklistItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.create_checklist_item(db, tenant_id, company_id, licitacao_id, grupo_id, data, current_user)

@router.delete("/{licitacao_id}/checklist/items/{item_id}", status_code=204)
def delete_checklist_item(
    licitacao_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.delete_checklist_item(db, tenant_id, company_id, licitacao_id, item_id, current_user)
    return None

@router.post("/{licitacao_id}/checklist/items/{item_id}/aplicacoes", response_model=schemas.LicitacaoChecklistAplicacaoResponse)
def create_technical_aplicacao(
    licitacao_id: UUID,
    item_id: UUID,
    data: schemas.LicitacaoChecklistAplicacaoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    return LicitacaoService.create_technical_aplicacao(db, tenant_id, item_id, data, current_user)

@router.put("/{licitacao_id}/checklist/aplicacoes/{aplicacao_id}", response_model=schemas.LicitacaoChecklistAplicacaoResponse)
def update_technical_aplicacao(
    licitacao_id: UUID,
    aplicacao_id: UUID,
    data: schemas.LicitacaoChecklistAplicacaoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    return LicitacaoService.update_technical_aplicacao(db, tenant_id, aplicacao_id, data, current_user)

@router.delete("/{licitacao_id}/checklist/aplicacoes/{aplicacao_id}", status_code=204)
def delete_technical_aplicacao(
    licitacao_id: UUID,
    aplicacao_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    LicitacaoService.delete_technical_aplicacao(db, tenant_id, aplicacao_id, current_user)
    return None

# --- Tarefas endpoints ---

@router.get("/{licitacao_id}/tarefas", response_model=List[schemas.LicitacaoTarefaResponse])
def get_tarefas(
    licitacao_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    licitacao = LicitacaoService.get_licitacao_by_id(db, tenant_id, licitacao_id, company_id)
    return LicitacaoService.get_tarefas(db, tenant_id, licitacao_id, licitacao, current_user)

@router.post("/{licitacao_id}/tarefas", response_model=schemas.LicitacaoTarefaResponse)
def create_tarefa(
    licitacao_id: UUID,
    data: schemas.LicitacaoTarefaCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.create_tarefa(db, tenant_id, company_id, licitacao_id, data, current_user)

@router.put("/{licitacao_id}/tarefas/{tarefa_id}", response_model=schemas.LicitacaoTarefaResponse)
def update_tarefa(
    licitacao_id: UUID,
    tarefa_id: UUID,
    data: schemas.LicitacaoTarefaUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.update_tarefa(db, tenant_id, company_id, licitacao_id, tarefa_id, data, current_user)

@router.post("/{licitacao_id}/tarefas/{tarefa_id}/andamentos", response_model=schemas.LicitacaoTarefaAndamentoResponse)
def create_tarefa_andamento(
    licitacao_id: UUID,
    tarefa_id: UUID,
    data: schemas.LicitacaoTarefaAndamentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.create_tarefa_andamento(db, tenant_id, company_id, licitacao_id, tarefa_id, data.descricao, current_user)

@router.get("/{licitacao_id}/dashboard-summary", response_model=schemas.LicitacaoDashboardResponse)
def get_dashboard_summary(
    licitacao_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    tenant_id = str(current_user.tenant_id)
    return LicitacaoService.get_dashboard_summary(db, tenant_id, company_id, licitacao_id, current_user)


@router.get("/{licitacao_id}/reports/envio-proposta")
def get_envio_proposta_report(
    licitacao_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")
    return LicitacoesReportService.generate_envio_proposta_pdf(db, licitacao_id, current_user)


