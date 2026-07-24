from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, check_not_engenharia_preco
from src.modules.users.models import User

from .schemas import NfeAnalysisOut
from .service import NfeAnalysisService

router = APIRouter(
    prefix="/fiscal", 
    tags=["Fiscal & Análise de NF-e"],
    dependencies=[Depends(check_not_engenharia_preco)]
)

@router.get("/ncm/{ncm}")
def get_ncm(ncm: str, db: Session = Depends(get_db)):
    return {"ncm": ncm, "cest": "123456", "mva": 50.0}

@router.post("/ncm")
def create_ncm(db: Session = Depends(get_db)):
    return {"message": "NCM created"}


# --- Endpoints para Análise de NF-e ---

@router.post("/analise-nfe", response_model=NfeAnalysisOut, status_code=status.HTTP_201_CREATED)
async def create_analysis(
    name: str = Form(...),
    force_reprocess: bool = Form(False),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not file.filename.endswith(".xml"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de arquivo inválido. Somente arquivos XML (.xml) são permitidos."
        )

    try:
        content_bytes = await file.read()
        xml_content = content_bytes.decode("utf-8")
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Não foi possível ler o conteúdo do arquivo XML: {str(e)}"
        )

    # Process XML via service
    analysis = NfeAnalysisService.create_analysis(
        db=db,
        tenant_id=current_user.tenant_id,
        name=name,
        xml_content=xml_content,
        file_name=file.filename,
        user_id=current_user.id,
        force_reprocess=force_reprocess
    )
    return analysis


@router.get("/analise-nfe", response_model=List[NfeAnalysisOut])
def list_analyses(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return NfeAnalysisService.list_analyses(db, current_user.tenant_id)


@router.get("/analise-nfe/{analysis_id}", response_model=NfeAnalysisOut)
def get_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = NfeAnalysisService.get_analysis(db, current_user.tenant_id, analysis_id)
    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Análise de NF-e não encontrada."
        )
    return analysis


@router.delete("/analise-nfe/{analysis_id}", status_code=status.HTTP_200_OK)
def delete_analysis(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = NfeAnalysisService.delete_analysis(db, current_user.tenant_id, analysis_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Análise de NF-e não encontrada."
        )
    return {"message": "Análise excluída com sucesso", "id": analysis_id}
