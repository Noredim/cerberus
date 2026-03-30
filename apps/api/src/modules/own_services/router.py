from datetime import datetime
from typing import List
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import exc
from sqlalchemy.orm import Session, joinedload

from src.core.database import get_db
from src.modules.auth.dependencies import get_active_company, get_current_user
from src.modules.own_services.models import OwnService, OwnServiceItem
from src.modules.own_services.schemas import (
    OwnServiceCreate,
    OwnServiceListItem,
    OwnServiceResponse,
    OwnServiceUpdate,
)
from src.modules.users.models import User

router = APIRouter(prefix="/own-services", tags=["Own Services"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_company(company_id: str | None) -> str:
    if not company_id:
        raise HTTPException(status_code=400, detail="Empresa ativa não informada.")
    return company_id


def _load_service(service_id: str, company_id: str, tenant_id: str, db: Session) -> OwnService:
    svc = (
        db.query(OwnService)
        .options(joinedload(OwnService.items).joinedload(OwnServiceItem.role))
        .filter(
            OwnService.id == service_id,
            OwnService.tenant_id == tenant_id,
            OwnService.company_id == company_id,
        )
        .first()
    )
    if not svc:
        raise HTTPException(status_code=404, detail="Serviço próprio não encontrado.")
    return svc


def _calc_total(items_data) -> int:
    return sum(i.tempo_horas * 60 + i.tempo_minutos for i in items_data)


def _build_items(service_id, items_data) -> list:
    return [
        OwnServiceItem(
            id=_uuid.uuid4(),
            own_service_id=service_id,
            role_id=item.role_id,
            tempo_horas=item.tempo_horas,
            tempo_minutos=item.tempo_minutos,
            tempo_total_minutos=item.tempo_horas * 60 + item.tempo_minutos,
        )
        for item in items_data
    ]


def _to_response(svc: OwnService) -> OwnServiceResponse:
    resp = OwnServiceResponse.model_validate(svc)
    for r_schema, r_orm in zip(resp.items, svc.items):
        r_schema.role_name = r_orm.role.name if r_orm.role else None
    return resp


def _to_list_item(svc: OwnService) -> OwnServiceListItem:
    return OwnServiceListItem(
        id=svc.id,
        nome_servico=svc.nome_servico,
        vigencia=svc.vigencia,
        tempo_total_minutos=svc.tempo_total_minutos,
        qt_cargos=len(svc.items),
    )


def _integrity_error() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail="Já existe um serviço próprio com este nome nesta vigência.",
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[OwnServiceListItem])
def list_own_services(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    company_id = _require_company(company_id)
    services = (
        db.query(OwnService)
        .options(joinedload(OwnService.items))
        .filter(
            OwnService.tenant_id == current_user.tenant_id,
            OwnService.company_id == company_id,
            OwnService.ativo.is_(True),
        )
        .order_by(OwnService.vigencia.desc(), OwnService.nome_servico)
        .all()
    )
    return [_to_list_item(s) for s in services]


@router.get("/{service_id}", response_model=OwnServiceResponse)
def get_own_service(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    company_id = _require_company(company_id)
    svc = _load_service(service_id, company_id, current_user.tenant_id, db)
    return _to_response(svc)


@router.post("", response_model=OwnServiceResponse, status_code=status.HTTP_201_CREATED)
def create_own_service(
    payload: OwnServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    company_id = _require_company(company_id)

    new_id = _uuid.uuid4()
    total = _calc_total(payload.items)

    svc = OwnService(
        id=new_id,
        tenant_id=current_user.tenant_id,
        company_id=company_id,
        nome_servico=payload.nome_servico,
        vigencia=payload.vigencia,
        descricao=payload.descricao,
        tempo_total_minutos=total,
        ativo=True,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(svc)
    db.flush()  # get PK before inserting items

    for item in _build_items(new_id, payload.items):
        db.add(item)

    try:
        db.commit()
    except exc.IntegrityError:
        db.rollback()
        raise _integrity_error()

    saved = _load_service(str(new_id), company_id, current_user.tenant_id, db)
    return _to_response(saved)


@router.put("/{service_id}", response_model=OwnServiceResponse)
def update_own_service(
    service_id: str,
    payload: OwnServiceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    company_id = _require_company(company_id)
    svc = _load_service(service_id, company_id, current_user.tenant_id, db)

    if not svc.ativo:
        raise HTTPException(status_code=400, detail="Não é possível editar um serviço inativo.")

    # Update header fields
    update_data = payload.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(svc, field, value)
    svc.updated_by = current_user.id
    svc.updated_at = datetime.utcnow()

    # Replace all items if provided
    if payload.items is not None:
        db.query(OwnServiceItem).filter(OwnServiceItem.own_service_id == svc.id).delete()
        db.flush()

        for item in _build_items(svc.id, payload.items):
            db.add(item)

        svc.tempo_total_minutos = _calc_total(payload.items)

    try:
        db.commit()
    except exc.IntegrityError:
        db.rollback()
        raise _integrity_error()

    refreshed = _load_service(service_id, company_id, current_user.tenant_id, db)
    return _to_response(refreshed)


@router.delete("/{service_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_own_service(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    company_id = _require_company(company_id)
    svc = _load_service(service_id, company_id, current_user.tenant_id, db)
    svc.ativo = False
    svc.updated_by = current_user.id
    svc.updated_at = datetime.utcnow()
    db.commit()
