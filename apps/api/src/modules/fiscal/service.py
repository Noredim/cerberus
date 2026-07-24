import hashlib
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from uuid import UUID
from typing import List, Optional
from datetime import datetime

from .models import NfeAnalysis, FiscalDocument, FiscalDocumentItem, FiscalDocumentInstallment, FiscalDocumentPayment
from .parser import NFeXmlParser

class NfeAnalysisService:
    @staticmethod
    def calculate_hash(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @staticmethod
    def create_analysis(
        db: Session,
        tenant_id: str,
        name: str,
        xml_content: str,
        file_name: str,
        user_id: Optional[str] = None,
        force_reprocess: bool = False
    ) -> NfeAnalysis:
        # Calculate file hash
        file_hash = NfeAnalysisService.calculate_hash(xml_content)

        # Parse XML first to get the access key and validate structure
        try:
            parsed_data = NFeXmlParser.parse_xml(xml_content)
        except Exception as e:
            # Save analysis with ERROR status
            analysis = NfeAnalysis(
                tenant_id=tenant_id,
                name=name,
                xml_content=xml_content,
                file_name=file_name,
                file_hash=file_hash,
                status="ERROR",
                error_message=str(e),
                created_by=user_id
            )
            db.add(analysis)
            db.commit()
            db.refresh(analysis)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Falha na validação do XML: {str(e)}"
            )

        access_key = parsed_data["access_key"]

        # Check duplication by access_key or file_hash
        existing_doc = db.query(FiscalDocument).filter(
            FiscalDocument.tenant_id == tenant_id,
            FiscalDocument.access_key == access_key
        ).first()

        existing_analysis = None
        if existing_doc:
            existing_analysis = db.query(NfeAnalysis).filter(
                NfeAnalysis.id == existing_doc.nfe_analysis_id
            ).first()

        if not existing_analysis:
            # Fallback check by hash
            existing_analysis = db.query(NfeAnalysis).filter(
                NfeAnalysis.tenant_id == tenant_id,
                NfeAnalysis.file_hash == file_hash
            ).first()

        if existing_analysis:
            if not force_reprocess:
                # Raise 409 Conflict with detailed metadata for frontend confirmation
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail={
                        "message": "Esta nota fiscal já foi importada no sistema.",
                        "duplicate": True,
                        "analysis_id": str(existing_analysis.id),
                        "access_key": access_key,
                        "name": existing_analysis.name,
                        "imported_at": existing_analysis.created_at.isoformat()
                    }
                )
            else:
                # Reprocess the note: delete the old doc and recreate
                # Update analysis details
                existing_analysis.name = name
                existing_analysis.xml_content = xml_content
                existing_analysis.file_name = file_name
                existing_analysis.file_hash = file_hash
                existing_analysis.status = "PENDING"
                existing_analysis.error_message = None
                existing_analysis.updated_at = datetime.now()
                
                # Delete the linked fiscal document if exists (cascade deletes items, installments, payments)
                if existing_analysis.fiscal_document:
                    db.delete(existing_analysis.fiscal_document)
                    db.flush()
                
                analysis = existing_analysis
        else:
            # Create a brand new analysis
            analysis = NfeAnalysis(
                tenant_id=tenant_id,
                name=name,
                xml_content=xml_content,
                file_name=file_name,
                file_hash=file_hash,
                status="PENDING",
                created_by=user_id
            )
            db.add(analysis)
            db.flush()

        try:
            # Create FiscalDocument
            doc = FiscalDocument(
                tenant_id=tenant_id,
                nfe_analysis_id=analysis.id,
                access_key=access_key,
                nNF=parsed_data["nNF"],
                serie=parsed_data["serie"],
                mod=parsed_data["mod"],
                dhEmi=parsed_data["dhEmi"],
                issuer_cnpj=parsed_data["issuer_cnpj"],
                issuer_name=parsed_data["issuer_name"],
                recipient_cnpj=parsed_data["recipient_cnpj"],
                recipient_name=parsed_data["recipient_name"],
                vProd=parsed_data["vProd"],
                vNF=parsed_data["vNF"],
                cStat=parsed_data["cStat"],
                xMotivo=parsed_data["xMotivo"],
                nProt=parsed_data["nProt"],
                dhRecbto=parsed_data["dhRecbto"],
                xml_version=parsed_data["xml_version"]
            )
            db.add(doc)
            db.flush()

            # Create items
            for item_data in parsed_data["items"]:
                item = FiscalDocumentItem(
                    fiscal_document_id=doc.id,
                    nItem=item_data["nItem"],
                    cProd=item_data["cProd"],
                    xProd=item_data["xProd"],
                    NCM=item_data["NCM"],
                    CFOP=item_data["CFOP"],
                    uCom=item_data["uCom"],
                    qCom=item_data["qCom"],
                    vUnCom=item_data["vUnCom"],
                    vProd=item_data["vProd"],
                    tributos=item_data["tributos"]
                )
                db.add(item)

            # Create installments
            for inst_data in parsed_data["installments"]:
                installment = FiscalDocumentInstallment(
                    fiscal_document_id=doc.id,
                    nDup=inst_data["nDup"],
                    dVenc=inst_data["dVenc"],
                    vDup=inst_data["vDup"]
                )
                db.add(installment)

            # Create payments
            for pay_data in parsed_data["payments"]:
                payment = FiscalDocumentPayment(
                    fiscal_document_id=doc.id,
                    tPag=pay_data["tPag"],
                    vPag=pay_data["vPag"]
                )
                db.add(payment)

            # Success
            analysis.status = "PROCESSED"
            db.commit()
            db.refresh(analysis)
            return analysis

        except Exception as e:
            db.rollback()
            # Set analysis status to ERROR
            db.begin()
            analysis.status = "ERROR"
            analysis.error_message = str(e)
            db.add(analysis)
            db.commit()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro durante processamento interno da nota fiscal: {str(e)}"
            )

    @staticmethod
    def list_analyses(db: Session, tenant_id: str) -> List[NfeAnalysis]:
        return db.query(NfeAnalysis).filter(
            NfeAnalysis.tenant_id == tenant_id
        ).order_by(NfeAnalysis.created_at.desc()).all()

    @staticmethod
    def get_analysis(db: Session, tenant_id: str, analysis_id: UUID) -> Optional[NfeAnalysis]:
        return db.query(NfeAnalysis).filter(
            NfeAnalysis.tenant_id == tenant_id,
            NfeAnalysis.id == analysis_id
        ).first()

    @staticmethod
    def delete_analysis(db: Session, tenant_id: str, analysis_id: UUID) -> bool:
        analysis = NfeAnalysisService.get_analysis(db, tenant_id, analysis_id)
        if not analysis:
            return False
        db.delete(analysis)
        db.commit()
        return True
