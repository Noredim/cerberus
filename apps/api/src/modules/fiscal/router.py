from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.core.database import get_db

from src.modules.auth.dependencies import check_not_engenharia_preco

router = APIRouter(
    prefix="/fiscal", 
    tags=["Fiscal (NCM/ST/BIT)"],
    dependencies=[Depends(check_not_engenharia_preco)]
)

@router.get("/ncm/{ncm}")
def get_ncm(ncm: str, db: Session = Depends(get_db)):
    return {"ncm": ncm, "cest": "123456", "mva": 50.0}

@router.post("/ncm")
def create_ncm(db: Session = Depends(get_db)):
    return {"message": "NCM created"}
