from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, check_not_engenharia_preco
from src.modules.users.models import User
from .schemas import (
    NcmStHeaderResponse, NcmStHeaderCreate, NcmStHeaderUpdate,
    NcmStItemResponse, NcmStImportRequest, ImportSummary
)
from .service import NcmStService

router = APIRouter(
    prefix="/cadastro/ncm-st", 
    tags=["NCM ST"],
    dependencies=[Depends(check_not_engenharia_preco)]
)

@router.get("/", response_model=List[NcmStHeaderResponse])
def list_headers(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return NcmStService.get_headers(db, current_user.tenant_id, skip, limit)

@router.post("/", response_model=NcmStHeaderResponse)
def create_header(
    payload: NcmStHeaderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return NcmStService.create_header(db, payload, current_user.tenant_id, current_user.id)

@router.get("/modelo-csv")
def download_modelo_csv():
    csv_content = (
        "item,ativo,ncm_sh,ncm_normalizado,cest,descricao,observacoes,vigencia_inicio,fundamento,segmento_anexo,cest_normalizado,mva_percent,vigencia_fim\n"
        "1,true,84713012,84713012,2103100,Computadores portateis de peso inferior a 10kg,Exemplo de observacao,2026-01-01,Decreto 12345/2026,Informatica,2103100,12.00,\n"
    )
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=modelo_importacao_ncm_st.csv"
        }
    )

@router.get("/{header_id}", response_model=NcmStHeaderResponse)
def get_header(
    header_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    header = NcmStService.get_header(db, header_id, current_user.tenant_id)
    if not header:
        raise HTTPException(status_code=404, detail="Cadastro NCM ST não encontrado")
    return header

@router.put("/{header_id}", response_model=NcmStHeaderResponse)
def update_header(
    header_id: str,
    payload: NcmStHeaderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    header = NcmStService.update_header(db, header_id, payload, current_user.tenant_id, current_user.id)
    if not header:
        raise HTTPException(status_code=404, detail="Cadastro NCM ST não encontrado")
    return header

@router.delete("/{header_id}")
def delete_header(
    header_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = NcmStService.delete_header(db, header_id, current_user.tenant_id)
    if not success:
        raise HTTPException(status_code=404, detail="Cadastro NCM ST não encontrado")
    return {"message": "Cadastro excluído com sucesso"}

@router.get("/{header_id}/itens")
def list_items(
    header_id: str,
    skip: int = 0,
    limit: int = 100,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify ownership
    header = NcmStService.get_header(db, header_id, current_user.tenant_id)
    if not header:
        raise HTTPException(status_code=404, detail="Cadastro NCM ST não encontrado")
    
    items = NcmStService.get_items(db, header_id, skip, limit, q)
    total = NcmStService.count_items(db, header_id, q)
    
    return {
        "items": items,
        "total": total,
        "skip": skip,
        "limit": limit
    }

def sanitize_csv_quotes(csv_text: str) -> str:
    chars = list(csv_text)
    n = len(chars)
    for i in range(n):
        if chars[i] == '"':
            is_prev_boundary = False
            j = i - 1
            while j >= 0 and chars[j] in (' ', '\t'):
                j -= 1
            if j < 0 or chars[j] in (',', '\n', '\r', ';'):
                is_prev_boundary = True
                
            is_next_boundary = False
            j = i + 1
            while j < n and chars[j] in (' ', '\t'):
                j += 1
            if j >= n or chars[j] in (',', '\n', '\r', ';'):
                is_next_boundary = True
                
            if not (is_prev_boundary or is_next_boundary):
                chars[i] = "'"
    return "".join(chars)

@router.post("/{header_id}/importar-csv", response_model=ImportSummary)
async def import_csv(
    header_id: str,
    strategy: str = Form("REPLACE"),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify ownership
    header = NcmStService.get_header(db, header_id, current_user.tenant_id)
    if not header:
        raise HTTPException(status_code=404, detail="Cadastro NCM ST não encontrado")
    
    content = await file.read()
    try:
        csv_text = content.decode("utf-8")
    except UnicodeDecodeError:
        csv_text = content.decode("iso-8859-1")
    
    csv_text = sanitize_csv_quotes(csv_text)
    
    processed, success, errors = NcmStService.import_csv(db, header_id, csv_text, strategy)
    
    return {
        "total_processed": processed,
        "success_count": success,
        "error_count": errors,
        "message": f"Importação concluída: {success} itens importados com sucesso."
    }
