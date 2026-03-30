from datetime import datetime
from typing import List
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import exc
from sqlalchemy.orm import Session, joinedload

from src.core.database import get_db
from src.modules.auth.dependencies import get_active_company, get_current_user
from src.modules.man_hours.models import ManHour
from src.modules.man_hours.schemas import ManHourCreate, ManHourResponse, ManHourUpdate
from src.modules.users.models import User

router = APIRouter(prefix="/man-hours", tags=["Man Hours"])


def _load_with_role(item_id: str, db: Session) -> ManHour | None:
    """Re-query a record eagerly loading the role relationship."""
    return (
        db.query(ManHour)
        .options(joinedload(ManHour.role))
        .filter(ManHour.id == item_id)
        .first()
    )


def _to_response(mh: ManHour) -> ManHourResponse:
    """Convert ORM model to response schema, injecting role_name."""
    data = ManHourResponse.model_validate(mh)
    data.role_name = mh.role.name if mh.role else None
    return data


def _get_owned_or_404(item_id: str, company_id: str, tenant_id: str, db: Session) -> ManHour:
    mh = (
        db.query(ManHour)
        .options(joinedload(ManHour.role))
        .filter(
            ManHour.id == item_id,
            ManHour.tenant_id == tenant_id,
            ManHour.company_id == company_id,
        )
        .first()
    )
    if not mh:
        raise HTTPException(status_code=404, detail="Registro de hora/homem não encontrado.")
    return mh


@router.get("", response_model=List[ManHourResponse])
def list_man_hours(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    """List active man-hour records for the active company."""
    if not company_id:
        raise HTTPException(status_code=400, detail="Empresa ativa não informada.")

    records = (
        db.query(ManHour)
        .options(joinedload(ManHour.role))
        .filter(
            ManHour.tenant_id == current_user.tenant_id,
            ManHour.company_id == company_id,
            ManHour.ativo.is_(True),
        )
        .order_by(ManHour.vigencia.desc())
        .all()
    )
    return [_to_response(r) for r in records]


@router.get("/{item_id}", response_model=ManHourResponse)
def get_man_hour(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    """Retrieve a single man-hour record (including inactive)."""
    if not company_id:
        raise HTTPException(status_code=400, detail="Empresa ativa não informada.")
    mh = _get_owned_or_404(item_id, company_id, current_user.tenant_id, db)
    return _to_response(mh)


@router.post("", response_model=ManHourResponse, status_code=status.HTTP_201_CREATED)
def create_man_hour(
    payload: ManHourCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    """Create a new man-hour record."""
    if not company_id:
        raise HTTPException(status_code=400, detail="Empresa ativa não informada.")

    new_id = str(uuid.uuid4())
    new_mh = ManHour(
        id=new_id,
        tenant_id=current_user.tenant_id,
        company_id=company_id,
        role_id=payload.role_id,
        vigencia=payload.vigencia,
        hora_normal=payload.hora_normal,
        hora_extra=payload.hora_extra,
        hora_extra_adicional_noturno=payload.hora_extra_adicional_noturno,
        hora_extra_domingos_feriados=payload.hora_extra_domingos_feriados,
        hora_extra_domingos_feriados_noturno=payload.hora_extra_domingos_feriados_noturno,
        ativo=True,
        created_by=current_user.id,
        updated_by=current_user.id,
    )
    db.add(new_mh)
    try:
        db.commit()
    except exc.IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um cadastro de Hora/Homem para este cargo nesta vigência.",
        )

    # Re-query with joinedload to avoid lazy-load issues on role
    saved = _load_with_role(new_id, db)
    return _to_response(saved)


@router.put("/{item_id}", response_model=ManHourResponse)
def update_man_hour(
    item_id: str,
    payload: ManHourUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    """Update an existing man-hour record."""
    if not company_id:
        raise HTTPException(status_code=400, detail="Empresa ativa não informada.")

    mh = _get_owned_or_404(item_id, company_id, current_user.tenant_id, db)

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(mh, field, value)
    mh.updated_by = current_user.id
    mh.updated_at = datetime.utcnow()

    try:
        db.commit()
    except exc.IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Já existe um cadastro de Hora/Homem para este cargo nesta vigência.",
        )

    # Re-query with joinedload
    refreshed = _load_with_role(item_id, db)
    return _to_response(refreshed)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def deactivate_man_hour(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company),
):
    """Logical deletion: set ativo = False."""
    if not company_id:
        raise HTTPException(status_code=400, detail="Empresa ativa não informada.")

    mh = _get_owned_or_404(item_id, company_id, current_user.tenant_id, db)
    mh.ativo = False
    mh.updated_by = current_user.id
    mh.updated_at = datetime.utcnow()
    db.commit()
