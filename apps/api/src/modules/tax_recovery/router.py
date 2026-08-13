from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, check_not_engenharia_preco
from src.modules.users.models import User
from src.modules.tenants.models import Tenant
from src.modules.fiscal.models import FiscalDocument, FiscalDocumentItem

from .models import TaxRecoveryAnalysis, TaxRecoveryDocument, TaxRecoveryItemResult
from .schemas import (
    TaxRecoveryCreate,
    TaxRecoveryUpdate,
    TaxRecoveryOut,
    TaxRecoveryDetailOut,
    TaxRecoveryDocumentOut,
    TaxRecoveryItemDetailOut,
    PaginatedTaxRecoveryList
)
from .service import TaxRecoveryService

router = APIRouter(
    prefix="/fiscal/tax-recovery",
    tags=["Fiscal > Recuperação de Impostos"],
    dependencies=[Depends(check_not_engenharia_preco)]
)


@router.get("", response_model=PaginatedTaxRecoveryList)
def list_tax_recoveries(
    name: Optional[str] = Query(None, description="Filtro por nome"),
    entry_purpose: Optional[str] = Query(None),
    real_destination: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    created_by: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tenant_id = current_user.tenant_id
    query = db.query(TaxRecoveryAnalysis).filter(TaxRecoveryAnalysis.tenant_id == tenant_id)

    if name:
        query = query.filter(TaxRecoveryAnalysis.name.ilike(f"%{name}%"))
    if entry_purpose:
        query = query.filter(TaxRecoveryAnalysis.entry_purpose == entry_purpose.upper())
    if real_destination:
        query = query.filter(TaxRecoveryAnalysis.real_destination == real_destination.upper())
    if status_filter:
        query = query.filter(TaxRecoveryAnalysis.status == status_filter.upper())
    if created_by:
        query = query.filter(TaxRecoveryAnalysis.created_by == created_by)

    total = query.count()
    pages = (total + size - 1) // size

    items_db = query.order_by(TaxRecoveryAnalysis.created_at.desc()).offset((page - 1) * size).limit(size).all()

    # Preencher metadados de nome do usuário e tenant
    result_items = []
    for item in items_db:
        item_out = TaxRecoveryOut.model_validate(item)
        if item.creator:
            item_out.creator_name = getattr(item.creator, "full_name", None) or item.creator.email
        if item.tenant:
            item_out.company_name = getattr(item.tenant, "razao_social", None) or item.tenant.id
        result_items.append(item_out)

    return {
        "items": result_items,
        "total": total,
        "page": page,
        "size": size,
        "pages": pages
    }


@router.post("", response_model=TaxRecoveryOut, status_code=status.HTTP_201_CREATED)
def create_tax_recovery(
    data: TaxRecoveryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = TaxRecoveryService.create_analysis(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=str(current_user.id),
        data=data
    )
    res = TaxRecoveryOut.model_validate(analysis)
    if current_user:
        res.creator_name = getattr(current_user, "full_name", None) or current_user.email
    return res


@router.get("/{analysis_id}", response_model=TaxRecoveryDetailOut)
def get_tax_recovery_detail(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = TaxRecoveryService.get_analysis_or_404(db, current_user.tenant_id, str(analysis_id))
    
    docs_db = db.query(TaxRecoveryDocument).filter(
        TaxRecoveryDocument.tax_recovery_id == analysis.id
    ).all()

    docs_out = []
    for d in docs_db:
        fdoc = db.query(FiscalDocument).filter(FiscalDocument.id == d.fiscal_document_id).first()
        items_count = db.query(FiscalDocumentItem).filter(
            FiscalDocumentItem.fiscal_document_id == d.fiscal_document_id
        ).count() if fdoc else 0

        d_out = TaxRecoveryDocumentOut(
            id=d.id,
            tax_recovery_id=d.tax_recovery_id,
            fiscal_document_id=d.fiscal_document_id,
            access_key=fdoc.access_key if fdoc else None,
            nNF=fdoc.nNF if fdoc else None,
            serie=fdoc.serie if fdoc else None,
            dhEmi=fdoc.dhEmi if fdoc else None,
            issuer_name=fdoc.issuer_name if fdoc else None,
            issuer_cnpj=fdoc.issuer_cnpj if fdoc else None,
            uf_emit=fdoc.uf_emit if fdoc else None,
            recipient_name=fdoc.recipient_name if fdoc else None,
            recipient_cnpj=fdoc.recipient_cnpj if fdoc else None,
            uf_dest=fdoc.uf_dest if fdoc else None,
            vNF=fdoc.vNF if fdoc else 0,
            entry_purpose=analysis.entry_purpose,
            real_destination=analysis.real_destination,
            calculation_status=d.calculation_status,
            status_message=d.status_message,
            icms_st_original=d.icms_st_original,
            difal_original=d.difal_original,
            icms_st_recalculated=d.icms_st_recalculated,
            difal_recalculated=d.difal_recalculated,
            total_to_recover=d.total_to_recover,
            total_to_collect=d.total_to_collect,
            net_balance=d.net_balance,
            items_count=items_count
        )
        docs_out.append(d_out)

    res = TaxRecoveryDetailOut.model_validate(analysis)
    res.documents = docs_out
    if analysis.creator:
        res.creator_name = getattr(analysis.creator, "full_name", None) or analysis.creator.email
    if analysis.tenant:
        res.company_name = getattr(analysis.tenant, "razao_social", None) or analysis.tenant.id

    return res


@router.put("/{analysis_id}", response_model=TaxRecoveryOut)
def update_tax_recovery(
    analysis_id: UUID,
    data: TaxRecoveryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = TaxRecoveryService.get_analysis_or_404(db, current_user.tenant_id, str(analysis_id))

    if data.name is not None:
        analysis.name = data.name.strip()
    if data.description is not None:
        analysis.description = data.description
    if data.entry_purpose is not None:
        analysis.entry_purpose = data.entry_purpose.strip().upper()
    if data.real_destination is not None:
        analysis.real_destination = data.real_destination.strip().upper()

    if analysis.entry_purpose == analysis.real_destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A finalidade de entrada e a destinação real da mercadoria devem ser diferentes."
        )

    analysis.updated_by = str(current_user.id)
    db.commit()
    db.refresh(analysis)
    return TaxRecoveryOut.model_validate(analysis)


@router.delete("/{analysis_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_tax_recovery(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    TaxRecoveryService.delete_analysis(db, current_user.tenant_id, str(analysis_id))
    return None


@router.post("/{analysis_id}/xml")
async def import_xmls(
    analysis_id: UUID,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    xml_files = []
    for f in files:
        if not f.filename.endswith(".xml"):
            continue
        content_bytes = await f.read()
        try:
            content_str = content_bytes.decode("utf-8")
        except UnicodeDecodeError:
            content_str = content_bytes.decode("iso-8859-1")
        xml_files.append((f.filename, content_str))

    if not xml_files:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nenhum arquivo XML válido foi enviado."
        )

    res = TaxRecoveryService.import_xmls(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=str(current_user.id),
        analysis_id=str(analysis_id),
        xml_files=xml_files
    )
    return res


@router.post("/{analysis_id}/process", response_model=TaxRecoveryOut)
def process_tax_recovery(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = TaxRecoveryService.process_analysis(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=str(current_user.id),
        analysis_id=str(analysis_id)
    )
    return TaxRecoveryOut.model_validate(analysis)


@router.post("/{analysis_id}/reprocess", response_model=TaxRecoveryOut)
def reprocess_tax_recovery(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = TaxRecoveryService.process_analysis(
        db=db,
        tenant_id=current_user.tenant_id,
        user_id=str(current_user.id),
        analysis_id=str(analysis_id)
    )
    return TaxRecoveryOut.model_validate(analysis)


@router.post("/{analysis_id}/complete", response_model=TaxRecoveryOut)
def complete_tax_recovery(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = TaxRecoveryService.get_analysis_or_404(db, current_user.tenant_id, str(analysis_id))
    analysis.status = "CONCLUIDA"
    analysis.updated_by = str(current_user.id)
    db.commit()
    db.refresh(analysis)
    return TaxRecoveryOut.model_validate(analysis)


@router.post("/{analysis_id}/cancel", response_model=TaxRecoveryOut)
def cancel_tax_recovery(
    analysis_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = TaxRecoveryService.get_analysis_or_404(db, current_user.tenant_id, str(analysis_id))
    analysis.status = "CANCELADA"
    analysis.updated_by = str(current_user.id)
    db.commit()
    db.refresh(analysis)
    return TaxRecoveryOut.model_validate(analysis)


@router.get("/{analysis_id}/documents/{rec_doc_id}", response_model=TaxRecoveryDocumentOut)
def get_tax_recovery_document_detail(
    analysis_id: UUID,
    rec_doc_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = TaxRecoveryService.get_analysis_or_404(db, current_user.tenant_id, str(analysis_id))
    
    rec_doc = db.query(TaxRecoveryDocument).filter(
        TaxRecoveryDocument.id == rec_doc_id,
        TaxRecoveryDocument.tax_recovery_id == analysis.id
    ).first()

    if not rec_doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Documento fiscal da recuperação não encontrado."
        )

    fdoc = db.query(FiscalDocument).filter(FiscalDocument.id == rec_doc.fiscal_document_id).first()

    item_results_db = db.query(TaxRecoveryItemResult).filter(
        TaxRecoveryItemResult.tax_recovery_document_id == rec_doc.id
    ).order_by(TaxRecoveryItemResult.nItem).all()

    items_out = []
    for ir in item_results_db:
        fitem = db.query(FiscalDocumentItem).filter(FiscalDocumentItem.id == ir.fiscal_document_item_id).first()
        ir_out = TaxRecoveryItemDetailOut(
            id=ir.id,
            tax_recovery_document_id=ir.tax_recovery_document_id,
            fiscal_document_item_id=ir.fiscal_document_item_id,
            nItem=ir.nItem,
            status=ir.status,
            cProd=fitem.cProd if fitem else None,
            xProd=fitem.xProd if fitem else None,
            NCM=fitem.NCM if fitem else None,
            CFOP=fitem.CFOP if fitem else None,
            uCom=fitem.uCom if fitem else None,
            qCom=fitem.qCom if fitem else 0,
            vUnCom=fitem.vUnCom if fitem else 0,
            vProd=fitem.vProd if fitem else 0,
            icms_st_original=ir.icms_st_original,
            icms_st_recalculated=ir.icms_st_recalculated,
            icms_st_diff=ir.icms_st_diff,
            difal_original=ir.difal_original,
            difal_recalculated=ir.difal_recalculated,
            difal_diff=ir.difal_diff,
            total_to_recover=ir.total_to_recover,
            total_to_collect=ir.total_to_collect,
            net_balance=ir.net_balance,
            original_scenario_json=ir.original_scenario_json,
            destination_scenario_json=ir.destination_scenario_json,
            audit_memory_json=ir.audit_memory_json,
            pending_reasons=ir.pending_reasons
        )
        items_out.append(ir_out)

    doc_out = TaxRecoveryDocumentOut(
        id=rec_doc.id,
        tax_recovery_id=rec_doc.tax_recovery_id,
        fiscal_document_id=rec_doc.fiscal_document_id,
        access_key=fdoc.access_key if fdoc else None,
        nNF=fdoc.nNF if fdoc else None,
        serie=fdoc.serie if fdoc else None,
        dhEmi=fdoc.dhEmi if fdoc else None,
        issuer_name=fdoc.issuer_name if fdoc else None,
        issuer_cnpj=fdoc.issuer_cnpj if fdoc else None,
        uf_emit=fdoc.uf_emit if fdoc else None,
        recipient_name=fdoc.recipient_name if fdoc else None,
        recipient_cnpj=fdoc.recipient_cnpj if fdoc else None,
        uf_dest=fdoc.uf_dest if fdoc else None,
        vNF=fdoc.vNF if fdoc else 0,
        entry_purpose=analysis.entry_purpose,
        real_destination=analysis.real_destination,
        calculation_status=rec_doc.calculation_status,
        status_message=rec_doc.status_message,
        icms_st_original=rec_doc.icms_st_original,
        difal_original=rec_doc.difal_original,
        icms_st_recalculated=rec_doc.icms_st_recalculated,
        difal_recalculated=rec_doc.difal_recalculated,
        total_to_recover=rec_doc.total_to_recover,
        total_to_collect=rec_doc.total_to_collect,
        net_balance=rec_doc.net_balance,
        items_count=len(items_out),
        items=items_out
    )

    return doc_out


@router.delete("/{analysis_id}/documents/{rec_doc_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_document_from_analysis(
    analysis_id: UUID,
    rec_doc_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    analysis = TaxRecoveryService.get_analysis_or_404(db, current_user.tenant_id, str(analysis_id))
    rec_doc = db.query(TaxRecoveryDocument).filter(
        TaxRecoveryDocument.id == rec_doc_id,
        TaxRecoveryDocument.tax_recovery_id == analysis.id
    ).first()

    if rec_doc:
        db.delete(rec_doc)
        db.commit()
        TaxRecoveryService._update_analysis_totals(db, analysis)

    return None
