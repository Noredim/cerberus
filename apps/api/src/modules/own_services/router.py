from datetime import datetime
from typing import List, Optional
import uuid as _uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import exc
from sqlalchemy.orm import Session, joinedload

from src.core.database import get_db
from src.modules.auth.dependencies import get_active_company, get_current_user
from src.modules.man_hours.models import ManHour
from src.modules.own_services.models import OwnService, OwnServiceItem, OwnServiceHistory
from src.modules.own_services.schemas import (
    OwnServiceCreate,
    OwnServiceListItem,
    OwnServiceResponse,
    OwnServiceUpdate,
    OwnServiceItemResponse,
    OwnServiceHistoryResponse,
    OwnServiceValoresFaixa,
    _fator_to_hhmmss,
)
from src.modules.users.models import User

router = APIRouter(
    prefix="/own-services", 
    tags=["Own Services"]
)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _require_company(company_id: Optional[str]) -> str:
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


def _calc_consolidated(items_data) -> tuple[float, int]:
    """Returns (fator_consolidado, tempo_total_minutos) as average-of-factors."""
    if not items_data:
        return 0.0, 0
    fatores = [float(i.fator) for i in items_data]
    fator_medio = sum(fatores) / len(fatores)
    tempo_minutos = round(fator_medio * 60)
    return round(fator_medio, 4), tempo_minutos


def _build_items(service_id, items_data) -> list:
    return [
        OwnServiceItem(
            id=_uuid.uuid4(),
            own_service_id=service_id,
            role_id=item.role_id,
            fator=item.fator,
            tempo_minutos=round(item.fator * 60),
            tempo_total_minutos=round(item.fator * 60),
        )
        for item in items_data
    ]


def _calc_valores_faixa(services: list[OwnService], tenant_id: str, company_id: str, db: Session) -> dict[str, OwnServiceValoresFaixa]:
    if not services:
        return {}

    role_ids = set()
    for svc in services:
        for item in svc.items:
            if item.role_id:
                role_ids.add(str(item.role_id))

    if not role_ids:
        return {str(svc.id): OwnServiceValoresFaixa() for svc in services}

    man_hours = (
        db.query(ManHour)
        .filter(
            ManHour.tenant_id == tenant_id,
            ManHour.company_id == company_id,
            ManHour.role_id.in_(role_ids),
            ManHour.ativo.is_(True),
        )
        .order_by(ManHour.vigencia.desc())
        .all()
    )

    mh_by_role_year = {}
    mh_by_role_latest = {}
    for mh in man_hours:
        r_id = str(mh.role_id)
        if r_id not in mh_by_role_latest:
            mh_by_role_latest[r_id] = mh
        mh_by_role_year[(r_id, mh.vigencia)] = mh

    result = {}
    for svc in services:
        val_hn = 0.0
        val_he = 0.0
        val_headn = 0.0
        val_hedf = 0.0
        val_hedfn = 0.0

        for item in svc.items:
            r_id = str(item.role_id)
            fator = float(item.fator or 0)
            mh = mh_by_role_year.get((r_id, svc.vigencia)) or mh_by_role_latest.get(r_id)
            if mh:
                val_hn += fator * float(mh.hora_normal or 0)
                val_he += fator * float(mh.hora_extra or 0)
                val_headn += fator * float(mh.hora_extra_adicional_noturno or 0)
                val_hedf += fator * float(mh.hora_extra_domingos_feriados or 0)
                val_hedfn += fator * float(mh.hora_extra_domingos_feriados_noturno or 0)

        result[str(svc.id)] = OwnServiceValoresFaixa(
            hora_normal=round(val_hn, 2),
            hora_extra=round(val_he, 2),
            hora_extra_adicional_noturno=round(val_headn, 2),
            hora_extra_domingos_feriados=round(val_hedf, 2),
            hora_extra_domingos_feriados_noturno=round(val_hedfn, 2),
        )

    return result


def _add_history(
    db: Session,
    tenant_id: str,
    service_id: _uuid.UUID,
    user: User,
    acao: str,
    detalhes: str
):
    user_name = getattr(user, "name", None) or getattr(user, "email", None) or str(getattr(user, "id", ""))
    log = OwnServiceHistory(
        id=_uuid.uuid4(),
        tenant_id=tenant_id,
        own_service_id=service_id,
        user_id=user.id,
        user_name=user_name,
        user_email=user.email,
        acao=acao,
        detalhes_alteracao=detalhes,
    )
    db.add(log)


def _to_response(svc: OwnService, valores_faixa: Optional[OwnServiceValoresFaixa] = None) -> OwnServiceResponse:
    resp = OwnServiceResponse.model_validate(svc)
    fator_consolidado, _ = _calc_consolidated(svc.items)
    resp.fator_consolidado = fator_consolidado
    resp.tempo_consolidado_hhmmss = _fator_to_hhmmss(fator_consolidado)
    if valores_faixa:
        resp.valores_faixa = valores_faixa

    for r_schema, r_orm in zip(resp.items, svc.items):
        r_schema.role_name = r_orm.role.name if r_orm.role else None
        r_schema.fator = float(r_orm.fator)
        r_schema.tempo_hhmmss = _fator_to_hhmmss(r_schema.fator)

    return resp


def _to_list_item(svc: OwnService, valores_faixa: Optional[OwnServiceValoresFaixa] = None) -> OwnServiceListItem:
    fator_consolidado, _ = _calc_consolidated(svc.items)
    items_out = []
    for item in svc.items:
        items_out.append(OwnServiceItemResponse(
            id=item.id,
            own_service_id=item.own_service_id,
            role_id=item.role_id,
            fator=float(item.fator),
            tempo_minutos=item.tempo_minutos,
            tempo_total_minutos=item.tempo_total_minutos,
            role_name=item.role.name if item.role else None
        ))
    return OwnServiceListItem(
        id=svc.id,
        nome_servico=svc.nome_servico,
        unidade=svc.unidade,
        vigencia=svc.vigencia,
        tempo_total_minutos=svc.tempo_total_minutos,
        fator_consolidado=fator_consolidado,
        tempo_consolidado_hhmmss=_fator_to_hhmmss(fator_consolidado),
        qt_cargos=len(svc.items),
        items=items_out,
        valores_faixa=valores_faixa or OwnServiceValoresFaixa(),
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
        .options(joinedload(OwnService.items).joinedload(OwnServiceItem.role))
        .filter(
            OwnService.tenant_id == current_user.tenant_id,
            OwnService.company_id == company_id,
            OwnService.ativo.is_(True),
        )
        .order_by(OwnService.vigencia.desc(), OwnService.nome_servico)
        .all()
    )
    valores_map = _calc_valores_faixa(services, current_user.tenant_id, company_id, db)
    return [_to_list_item(s, valores_map.get(str(s.id))) for s in services]


@router.get("/{service_id}", response_model=OwnServiceResponse)
def get_own_service(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    company_id = _require_company(company_id)
    svc = _load_service(service_id, company_id, current_user.tenant_id, db)
    valores_map = _calc_valores_faixa([svc], current_user.tenant_id, company_id, db)
    return _to_response(svc, valores_map.get(str(svc.id)))


@router.get("/{service_id}/historico", response_model=List[OwnServiceHistoryResponse])
def get_own_service_history(
    service_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    company_id = _require_company(company_id)
    svc = _load_service(service_id, company_id, current_user.tenant_id, db)
    history_logs = (
        db.query(OwnServiceHistory)
        .filter(
            OwnServiceHistory.own_service_id == svc.id,
            OwnServiceHistory.tenant_id == current_user.tenant_id,
        )
        .order_by(OwnServiceHistory.created_at.desc())
        .all()
    )
    return [OwnServiceHistoryResponse.model_validate(h) for h in history_logs]


@router.post("", response_model=OwnServiceResponse, status_code=status.HTTP_201_CREATED)
def create_own_service(
    payload: OwnServiceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    company_id = _require_company(company_id)

    new_id = _uuid.uuid4()
    _, total_minutos = _calc_consolidated(payload.items)

    svc = OwnService(
        id=new_id,
        tenant_id=current_user.tenant_id,
        company_id=company_id,
        nome_servico=payload.nome_servico,
        unidade=payload.unidade,
        vigencia=payload.vigencia,
        descricao=payload.descricao,
        tempo_total_minutos=total_minutos,
        ativo=True,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(svc)
    db.flush()

    for item in _build_items(new_id, payload.items):
        db.add(item)

    detalhes = f"Serviço Próprio '{payload.nome_servico}' criado com {len(payload.items)} cargo(s). Vigência: {payload.vigencia}, Unidade: '{payload.unidade or 'UN'}'."
    _add_history(db, current_user.tenant_id, new_id, current_user, "CRIACAO", detalhes)

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

    changes = []
    if payload.nome_servico is not None and payload.nome_servico != svc.nome_servico:
        changes.append(f"Nome alterado de '{svc.nome_servico}' para '{payload.nome_servico}'.")
    if payload.vigencia is not None and payload.vigencia != svc.vigencia:
        changes.append(f"Vigência alterada de {svc.vigencia} para {payload.vigencia}.")
    if payload.unidade is not None and payload.unidade != svc.unidade:
        changes.append(f"Unidade alterada de '{svc.unidade or 'UN'}' para '{payload.unidade}'.")
    if payload.descricao is not None and payload.descricao != svc.descricao:
        changes.append("Descrição atualizada.")
    if payload.items is not None:
        changes.append(f"Composição de cargos atualizada para {len(payload.items)} cargo(s).")

    update_data = payload.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(svc, field, value)
    svc.updated_by = current_user.id
    svc.updated_at = datetime.utcnow()

    if payload.items is not None:
        db.query(OwnServiceItem).filter(OwnServiceItem.own_service_id == svc.id).delete()
        db.flush()

        for item in _build_items(svc.id, payload.items):
            db.add(item)

        _, total_minutos = _calc_consolidated(payload.items)
        svc.tempo_total_minutos = total_minutos

    detalhes = " | ".join(changes) if changes else "Serviço próprio atualizado."
    _add_history(db, current_user.tenant_id, svc.id, current_user, "EDICAO", detalhes)

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
    
    _add_history(db, current_user.tenant_id, svc.id, current_user, "EXCLUSAO", "Serviço próprio inativado/excluído.")
    
    svc.ativo = False
    svc.updated_by = current_user.id
    svc.updated_at = datetime.utcnow()
    db.commit()

