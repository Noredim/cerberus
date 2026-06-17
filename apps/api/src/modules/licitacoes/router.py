from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User

from . import schemas
from .service import LicitacaoService
from .models import LicitacaoLote, LicitacaoItem, Licitacao

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
    LicitacaoService.recalculate_licitacao(db, tenant_id, licitacao_id)
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
    
    item = LicitacaoItem(
        lote_id=lote_id,
        codigo=data.codigo,
        nome=data.nome,
        descricao=data.descricao,
        quantidade=data.quantidade
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
    return item

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
    
    item.codigo = data.codigo
    item.nome = data.nome
    item.descricao = data.descricao
    item.quantidade = data.quantidade
    
    # Log to timeline
    LicitacaoService.register_history(
        db,
        licitacao_id,
        tenant_id,
        user_id,
        f"{current_user.name} alterou o Item {data.codigo}: {data.nome}."
    )
    
    db.commit()
    db.refresh(item)
    
    LicitacaoService.recalculate_licitacao(db, tenant_id, licitacao_id)
    return item

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
    
    LicitacaoService.recalculate_licitacao(db, tenant_id, licitacao_id)
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
    return LicitacaoService.get_checklist(db, tenant_id, licitacao_id)

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
