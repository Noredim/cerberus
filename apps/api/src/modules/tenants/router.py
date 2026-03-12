from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.modules.auth.dependencies import verify_tenant

router = APIRouter(prefix="/tenants", tags=["Tenants"])

@router.post("/cnpj-lookup")
def cnpj_lookup(cnpj: str, db: Session = Depends(get_db)):
    # Placeholder para busca na Receita
    return {"cnpj": cnpj, "razao_social": "Exemplo", "cnaes": []}

@router.get("/")
def list_tenants(db: Session = Depends(get_db)):
    # Placeholder
    return []
