from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from decimal import Decimal


class TaxRecoveryCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=200, description="Nome da recuperação")
    entry_purpose: str = Field(..., description="Finalidade de entrada (ex: REVENDA, USO_CONSUMO, ATIVO_IMOBILIZADO)")
    real_destination: str = Field(..., description="Destinação real (ex: REVENDA, USO_CONSUMO, ATIVO_IMOBILIZADO)")
    description: Optional[str] = Field(None, description="Observação ou descrição adicional")


class TaxRecoveryUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=200)
    entry_purpose: Optional[str] = None
    real_destination: Optional[str] = None
    description: Optional[str] = None


class TaxRecoveryItemDetailOut(BaseModel):
    id: UUID
    tax_recovery_document_id: UUID
    fiscal_document_item_id: UUID
    nItem: int
    status: str
    
    # Item fiscal details from NFe item
    cProd: Optional[str] = None
    xProd: Optional[str] = None
    NCM: Optional[str] = None
    CFOP: Optional[str] = None
    uCom: Optional[str] = None
    qCom: Optional[Decimal] = Decimal("0")
    vUnCom: Optional[Decimal] = Decimal("0")
    vProd: Optional[Decimal] = Decimal("0")

    icms_st_original: Decimal = Decimal("0")
    icms_st_recalculated: Decimal = Decimal("0")
    icms_st_diff: Decimal = Decimal("0")
    difal_original: Decimal = Decimal("0")
    difal_recalculated: Decimal = Decimal("0")
    difal_diff: Decimal = Decimal("0")
    total_to_recover: Decimal = Decimal("0")
    total_to_collect: Decimal = Decimal("0")
    net_balance: Decimal = Decimal("0")

    original_scenario_json: Optional[Dict[str, Any]] = None
    destination_scenario_json: Optional[Dict[str, Any]] = None
    audit_memory_json: Optional[Dict[str, Any]] = None
    pending_reasons: Optional[List[str]] = None

    class Config:
        from_attributes = True


class TaxRecoveryDocumentOut(BaseModel):
    id: UUID
    tax_recovery_id: UUID
    fiscal_document_id: UUID
    
    # Header fields from linked FiscalDocument
    access_key: Optional[str] = None
    nNF: Optional[str] = None
    serie: Optional[str] = None
    dhEmi: Optional[datetime] = None
    issuer_name: Optional[str] = None
    issuer_cnpj: Optional[str] = None
    uf_emit: Optional[str] = None
    recipient_name: Optional[str] = None
    recipient_cnpj: Optional[str] = None
    uf_dest: Optional[str] = None
    vNF: Optional[Decimal] = Decimal("0")
    
    entry_purpose: Optional[str] = None
    real_destination: Optional[str] = None

    calculation_status: str = "OK"
    status_message: Optional[str] = None

    icms_st_original: Decimal = Decimal("0")
    difal_original: Decimal = Decimal("0")
    icms_st_recalculated: Decimal = Decimal("0")
    difal_recalculated: Decimal = Decimal("0")
    total_to_recover: Decimal = Decimal("0")
    total_to_collect: Decimal = Decimal("0")
    net_balance: Decimal = Decimal("0")

    items_count: int = 0
    items: Optional[List[TaxRecoveryItemDetailOut]] = None

    class Config:
        from_attributes = True


class TaxRecoveryOut(BaseModel):
    id: UUID
    tenant_id: str
    name: str
    description: Optional[str] = None
    entry_purpose: str
    real_destination: str
    status: str

    total_notes_count: int = 0
    total_notes_value: Decimal = Decimal("0")
    total_icms_st_original: Decimal = Decimal("0")
    total_difal_original: Decimal = Decimal("0")
    total_icms_st_recalculated: Decimal = Decimal("0")
    total_difal_recalculated: Decimal = Decimal("0")
    total_to_recover: Decimal = Decimal("0")
    total_to_collect: Decimal = Decimal("0")
    net_balance: Decimal = Decimal("0")
    pending_items_count: int = 0
    pending_notes_value: Decimal = Decimal("0")

    created_by: Optional[str] = None
    creator_name: Optional[str] = None
    updated_by: Optional[str] = None
    company_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TaxRecoveryDetailOut(TaxRecoveryOut):
    documents: List[TaxRecoveryDocumentOut] = []


class PaginatedTaxRecoveryList(BaseModel):
    items: List[TaxRecoveryOut]
    total: int
    page: int
    size: int
    pages: int
