from pydantic import BaseModel
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Any

class FiscalDocumentPaymentOut(BaseModel):
    id: UUID
    tPag: Optional[str] = None
    vPag: Optional[Decimal] = None

    class Config:
        from_attributes = True


class FiscalDocumentInstallmentOut(BaseModel):
    id: UUID
    nDup: Optional[str] = None
    dVenc: Optional[date] = None
    vDup: Optional[Decimal] = None

    class Config:
        from_attributes = True


class FiscalDocumentItemOut(BaseModel):
    id: UUID
    nItem: int
    cProd: Optional[str] = None
    xProd: Optional[str] = None
    NCM: Optional[str] = None
    CFOP: Optional[str] = None
    uCom: Optional[str] = None
    qCom: Optional[Decimal] = None
    vUnCom: Optional[Decimal] = None
    vProd: Optional[Decimal] = None
    tributos: Optional[Any] = None

    class Config:
        from_attributes = True


class FiscalDocumentOut(BaseModel):
    id: UUID
    access_key: str
    nNF: Optional[str] = None
    serie: Optional[str] = None
    mod: Optional[str] = None
    dhEmi: Optional[datetime] = None
    issuer_cnpj: Optional[str] = None
    issuer_name: Optional[str] = None
    recipient_cnpj: Optional[str] = None
    recipient_name: Optional[str] = None
    vProd: Optional[Decimal] = None
    vNF: Optional[Decimal] = None
    cStat: Optional[str] = None
    xMotivo: Optional[str] = None
    nProt: Optional[str] = None
    dhRecbto: Optional[datetime] = None
    xml_version: Optional[str] = None
    items: List[FiscalDocumentItemOut] = []
    installments: List[FiscalDocumentInstallmentOut] = []
    payments: List[FiscalDocumentPaymentOut] = []

    class Config:
        from_attributes = True


class NfeAnalysisOut(BaseModel):
    id: UUID
    tenant_id: str
    name: str
    file_name: Optional[str] = None
    file_hash: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    fiscal_document: Optional[FiscalDocumentOut] = None

    class Config:
        from_attributes = True
