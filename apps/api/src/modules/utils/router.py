from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.utils.services.cep_service import CepLookupService
from src.modules.utils.schemas.cep import CepResult

router = APIRouter(prefix="/utils/cep", tags=["Utils"])

@router.get("/{cep}", response_model=CepResult)
def lookup_cep(
    cep: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return CepLookupService.lookup(cep, db)
