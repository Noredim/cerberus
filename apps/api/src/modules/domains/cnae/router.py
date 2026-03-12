from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from typing import Optional

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from .models import CnaeDomain
from .schemas import PaginatedCnaeResponse

router = APIRouter(prefix="/domains/cnaes", tags=["Domains - CNAE"])

def normalize_search(query: str) -> str:
    import unicodedata
    if not query: return ""
    normalized = unicodedata.normalize("NFD", query.strip().lower())
    return "".join(c for c in normalized if unicodedata.category(c) != "Mn")

@router.get("", response_model=PaginatedCnaeResponse)
def search_cnaes(
    q: Optional[str] = Query(None, description="Busca por código ou descrição"),
    codigo: Optional[str] = Query(None, description="Busca exata por código"),
    limit: int = Query(20, ge=1, le=50),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(CnaeDomain)

    # Filtro exato
    if codigo:
        codigo_norm = "".join(filter(str.isdigit, codigo))
        query = query.filter(CnaeDomain.codigo_norm == codigo_norm)
    
    # Filtro flexível (Busca Q)
    elif q:
        q_str = q.strip()
        
        # Se contiver apenas dígitos, assuma busca por prefixo no código_norm
        if q_str.replace("-", "").replace(".", "").replace("/", "").isdigit():
            q_norm = "".join(filter(str.isdigit, q_str))
            query = query.filter(CnaeDomain.codigo_norm.startswith(q_norm))
        else:
            # Caso contrário, busque pelo nome normalizado ignoring accents and case
            q_norm = normalize_search(q_str)
            query = query.filter(CnaeDomain.descricao_norm.ilike(f"%{q_norm}%"))

    # Count total
    total = query.count()

    # Apply pagination and ordering
    # Ordering by codigo length prioritizing smaller codes when matching by description
    items = query.order_by(CnaeDomain.codigo).offset(offset).limit(limit).all()

    return {
        "items": items,
        "limit": limit,
        "offset": offset,
        "total": total
    }
