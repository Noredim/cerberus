from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, check_not_engenharia_preco
from src.modules.users.models import User
from .schemas import (
    TipiImportacaoOut,
    NcmTipiOut,
    TipiImportacaoPaginated,
    NcmTipiPaginated
)
from .service import TipiService
from datetime import date
from typing import Optional

router = APIRouter(prefix="/cadastro/tipi", tags=["Tabela TIPI"])

@router.post("/importar", response_model=TipiImportacaoOut)
async def importar_tipi(
    vigencia: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(check_not_engenharia_preco)
):
    try:
        vigencia_date = date.fromisoformat(vigencia)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Data de vigência inválida. Use o formato AAAA-MM-DD."
        )

    file_bytes = await file.read()
    return TipiService.importar_tipi(db, file_bytes, file.filename, vigencia_date)


@router.get("/importacoes", response_model=TipiImportacaoPaginated)
def get_importacoes(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items, total = TipiService.get_importacoes(db, skip, limit)
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }


@router.get("/valores", response_model=NcmTipiPaginated)
def get_valores(
    skip: int = 0,
    limit: int = 100,
    codigo_ncm: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    items, total = TipiService.get_valores(db, skip, limit, codigo_ncm)
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }
