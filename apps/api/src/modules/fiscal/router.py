from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, status, Query
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, check_not_engenharia_preco
from src.modules.users.models import User

from .schemas import (
    NfeAnalysisOut,
    FiscalDocumentOut,
    FiscalDocumentItemOut,
    NfeBatchPreviewResponse,
    BatchImportRequest,
    BatchImportSummary,
    ClassificationUpdateInput,
    BatchClassificationInput,
    CancelDocumentInput,
    PaginatedMonthlyDocumentsOut,
    FiscalNfeHistoryOut,
)
from .service import NfeAnalysisService
from .rules import APLICACOES_VALIDAS, TRIBUTACOES_VALIDAS, COMPATIBILIDADE_TRIBUTACAO, APLICACAO_LABELS, TRIBUTACAO_LABELS

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


# --- Endpoints Legados para Análise de NF-e ---

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


@router.get("/analise-nfe/{analysis_id}/pdf")
def download_analysis_report(
    analysis_id: UUID,
    type: str = Query("DIFAL", description="Tipo de análise: DIFAL ou ICMS_ST"),
    report_type: str = Query("ANALITICO", description="Tipo de relatório: ANALITICO ou SINTETICO"),
    company_id: Optional[UUID] = Query(None, description="ID da empresa para consulta MVA/Benefícios"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from .reports import NfeReportsService
    return NfeReportsService.generate_analise_compra_pdf(
        db=db,
        analysis_id=analysis_id,
        current_user=current_user,
        tax_type=type,
        report_type=report_type,
        company_id=company_id
    )


# --- Novos Endpoints para Acompanhamento Mensal de NF-e ---

@router.get("/acompanhamento-nfe/regras", status_code=status.HTTP_200_OK)
def get_fiscal_rules():
    """
    Retorna opções válidas e matriz de compatibilidade para classificação de NF-e.
    """
    return {
        "aplicacoes": APLICACOES_VALIDAS,
        "aplicacao_labels": APLICACAO_LABELS,
        "tributacoes": TRIBUTACOES_VALIDAS,
        "tributacao_labels": TRIBUTACAO_LABELS,
        "compatibilidade": COMPATIBILIDADE_TRIBUTACAO
    }


@router.get("/acompanhamento-nfe/pdf")
def download_acompanhamento_nfe_pdf(
    recipient_cnpj: str = Query(..., description="CNPJ da empresa destinatária (Obrigatório)"),
    competencia: Optional[str] = Query(None, description="Competência no formato YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not recipient_cnpj or recipient_cnpj.strip() == '' or recipient_cnpj == 'ALL':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A seleção da empresa destinatária é obrigatória para a geração do relatório em PDF."
        )
    from .reports import NfeReportsService
    return NfeReportsService.generate_acompanhamento_nfe_pdf(
        db=db,
        current_user=current_user,
        competencia=competencia,
        recipient_cnpj=recipient_cnpj
    )


@router.post("/acompanhamento-nfe/preview", response_model=NfeBatchPreviewResponse, status_code=status.HTTP_200_OK)
async def preview_batch_xmls(
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Realiza a pré-leitura dos arquivos XMLs enviados sem persisti-los.
    Valida formato, estrutura e checa duplicidade no banco por tenant.
    """
    previews = []
    total_files = len(files)
    valid_count = 0
    duplicate_count = 0
    rejected_count = 0

    for file in files:
        if not file.filename.lower().endswith(".xml"):
            rejected_count += 1
            previews.append({
                "file_name": file.filename,
                "access_key": "",
                "error": "Formato de arquivo não suportado. Somente extensões .xml são permitidas.",
                "is_duplicate": False,
                "xml_content": "",
                "vProd": 0, "vNF": 0, "vBC": 0, "vICMS": 0, "vBCST": 0, "vICMSST": 0,
                "vFCP": 0, "vFCPST": 0, "vIPI": 0, "vPIS": 0, "vCOFINS": 0, "vFrete": 0, "vSeg": 0, "vDesc": 0, "vOutro": 0
            })
            continue

        try:
            content_bytes = await file.read()
            xml_content = content_bytes.decode("utf-8", errors="replace")
        except Exception as e:
            rejected_count += 1
            previews.append({
                "file_name": file.filename,
                "access_key": "",
                "error": f"Erro de leitura de arquivo: {str(e)}",
                "is_duplicate": False,
                "xml_content": "",
                "vProd": 0, "vNF": 0, "vBC": 0, "vICMS": 0, "vBCST": 0, "vICMSST": 0,
                "vFCP": 0, "vFCPST": 0, "vIPI": 0, "vPIS": 0, "vCOFINS": 0, "vFrete": 0, "vSeg": 0, "vDesc": 0, "vOutro": 0
            })
            continue

        prev = NfeAnalysisService.preview_xml(db, current_user.tenant_id, file.filename, xml_content)
        if prev.get("error"):
            rejected_count += 1
        else:
            valid_count += 1
            if prev.get("is_duplicate"):
                duplicate_count += 1

        previews.append(prev)

    return {
        "total_files": total_files,
        "valid_count": valid_count,
        "duplicate_count": duplicate_count,
        "rejected_count": rejected_count,
        "previews": previews
    }


@router.post("/acompanhamento-nfe/importar", response_model=BatchImportSummary, status_code=status.HTTP_201_CREATED)
def import_classified_batch(
    payload: BatchImportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Importa definitivamente as notas fiscais previamente classificadas.
    """
    notes_data = [item.dict() for item in payload.notes]
    return NfeAnalysisService.import_classified_notes(
        db=db,
        tenant_id=current_user.tenant_id,
        notes=notes_data,
        user_id=current_user.id,
        force_reprocess=payload.force_reprocess_duplicates,
        allow_event_without_invoice=payload.allow_event_without_invoice
    )


@router.get("/acompanhamento-nfe", response_model=PaginatedMonthlyDocumentsOut)
def list_monthly_documents(
    competencia: Optional[str] = Query(None, description="Competência mensal no formato YYYY-MM (ex: 2026-07)"),
    search: Optional[str] = Query(None, description="Busca textual por Nº NF-e, Chave ou Fornecedor"),
    aplicacao: Optional[str] = Query(None, description="Filtro por Aplicação"),
    tipo_tributacao: Optional[str] = Query(None, description="Filtro por Tipo de Tributação"),
    status_classificacao: Optional[str] = Query(None, description="Filtro por Status de Classificação"),
    uf_emit: Optional[str] = Query(None, description="Filtro por Estado (UF) do emitente"),
    issuer_cnpj: Optional[str] = Query(None, description="Filtro por CNPJ do Fornecedor"),
    divergencia_flag: Optional[bool] = Query(None, description="Filtro por notas com divergência"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=10000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Consulta paginada da lista de acompanhamento mensal de NF-e com cards de indicadores agregados.
    """
    return NfeAnalysisService.list_monthly_documents(
        db=db,
        tenant_id=current_user.tenant_id,
        competencia=competencia,
        search=search,
        aplicacao=aplicacao,
        tipo_tributacao=tipo_tributacao,
        status_classificacao=status_classificacao,
        uf_emit=uf_emit,
        issuer_cnpj=issuer_cnpj,
        divergencia_flag=divergencia_flag,
        page=page,
        size=size
    )


@router.get("/acompanhamento-nfe/competencias", response_model=List[str])
def list_available_competencias(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retorna a lista de competências (YYYY-MM) que possuem lançamentos no banco de dados.
    """
    return NfeAnalysisService.get_available_competencias(db, current_user.tenant_id)


@router.get("/acompanhamento-nfe/resumo-mensal")
def get_monthly_summary(
    competencia: str = Query(..., description="Competência mensal no formato YYYY-MM"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Retorna o resumo consolidado mensal por Aplicação, Tributação, Fornecedor, CFOP e NCM.
    """
    return NfeAnalysisService.get_monthly_summary_reports(db, current_user.tenant_id, competencia)


@router.get("/acompanhamento-nfe/{document_id}", response_model=FiscalDocumentOut)
def get_monthly_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = NfeAnalysisService.get_document_by_id(db, current_user.tenant_id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento fiscal não encontrado."
        )
    return doc


@router.get("/acompanhamento-nfe/{document_id}/itens", response_model=List[FiscalDocumentItemOut])
def get_monthly_document_items(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    doc = NfeAnalysisService.get_document_by_id(db, current_user.tenant_id, document_id)
    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento fiscal não encontrado."
        )
    return doc.items


@router.get("/acompanhamento-nfe/{document_id}/historico", response_model=List[FiscalNfeHistoryOut])
def get_monthly_document_history(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return NfeAnalysisService.get_document_histories(db, current_user.tenant_id, document_id)


@router.put("/acompanhamento-nfe/{document_id}/classificacao", response_model=FiscalDocumentOut)
def update_single_classification(
    document_id: UUID,
    payload: ClassificationUpdateInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualiza a classificação de um único documento fiscal.
    """
    return NfeAnalysisService.update_classification(
        db=db,
        tenant_id=current_user.tenant_id,
        document_id=document_id,
        aplicacao=payload.aplicacao,
        tipo_tributacao=payload.tipo_tributacao,
        observacao=payload.observacao_classificacao,
        user_id=current_user.id
    )


@router.post("/acompanhamento-nfe/{document_id}/cancelar", response_model=FiscalDocumentOut)
def cancel_monthly_document(
    document_id: UUID,
    payload: CancelDocumentInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Marca um documento fiscal como CANCELADA e grava a justificativa obrigatoria no historico.
    """
    if not payload.justificativa or len(payload.justificativa.strip()) < 3:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A justificativa/observação é obrigatória para cancelar a nota fiscal."
        )
    return NfeAnalysisService.cancel_document(
        db=db,
        tenant_id=current_user.tenant_id,
        document_id=document_id,
        justificativa=payload.justificativa.strip(),
        user_id=current_user.id
    )



@router.put("/acompanhamento-nfe/classificacao/lote")
def batch_update_classification(
    payload: BatchClassificationInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualiza a classificação em lote para múltiplos documentos fiscais.
    """
    return NfeAnalysisService.batch_update_classification(
        db=db,
        tenant_id=current_user.tenant_id,
        document_ids=payload.document_ids,
        select_all_matching=payload.select_all_matching or False,
        competencia=payload.competencia,
        search=payload.search,
        status_classificacao=payload.status_classificacao,
        uf_emit=payload.uf_emit,
        divergencia_flag=payload.divergencia_flag,
        aplicacao=payload.aplicacao,
        tipo_tributacao=payload.tipo_tributacao,
        observacao=payload.observacao_classificacao,
        user_id=current_user.id
    )


@router.delete("/acompanhamento-nfe/{document_id}", status_code=status.HTTP_200_OK)
def delete_monthly_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    success = NfeAnalysisService.delete_document(db, current_user.tenant_id, document_id, current_user.id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento fiscal não encontrado."
        )
    return {"message": "Documento fiscal excluído com sucesso", "id": document_id}
