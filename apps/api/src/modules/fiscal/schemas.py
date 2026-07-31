from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from typing import List, Optional, Any

class FiscalDocumentPaymentOut(BaseModel):
    id: UUID
    tPag: Optional[str] = None
    vPag: Optional[float] = None

    class Config:
        from_attributes = True


class FiscalDocumentInstallmentOut(BaseModel):
    id: UUID
    nDup: Optional[str] = None
    dVenc: Optional[date] = None
    vDup: Optional[float] = None

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
    qCom: Optional[float] = None
    vUnCom: Optional[float] = None
    vProd: Optional[float] = None
    tributos: Optional[Any] = None

    class Config:
        from_attributes = True


class FiscalDocumentEventOut(BaseModel):
    id: UUID
    access_key: str
    event_type: str
    event_sequence: Optional[int] = 1
    event_description: Optional[str] = None
    event_datetime: Optional[datetime] = None
    registration_datetime: Optional[datetime] = None
    request_protocol: Optional[str] = None
    registration_protocol: Optional[str] = None
    justification: Optional[str] = None
    environment: Optional[str] = None
    authority_code: Optional[str] = None
    status_code: Optional[str] = None
    status_message: Optional[str] = None
    processing_status: Optional[str] = "CONFIRMED"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FiscalDocumentOut(BaseModel):
    id: UUID
    access_key: str
    nNF: Optional[str] = None
    serie: Optional[str] = None
    mod: Optional[str] = None
    natOp: Optional[str] = None
    dhEmi: Optional[datetime] = None
    competencia: Optional[str] = None
    issuer_cnpj: Optional[str] = None
    issuer_name: Optional[str] = None
    issuer_ie: Optional[str] = None
    uf_emit: Optional[str] = None
    recipient_cnpj: Optional[str] = None
    recipient_name: Optional[str] = None
    uf_dest: Optional[str] = None
    
    aplicacao: Optional[str] = None
    tipo_tributacao: Optional[str] = None
    status_classificacao: Optional[str] = "PENDENTE"
    data_classificacao: Optional[datetime] = None
    usuario_classificacao_id: Optional[str] = None
    observacao_classificacao: Optional[str] = None
    divergencia_flag: Optional[bool] = False

    vProd: Optional[float] = None
    vNF: Optional[float] = None
    vBC: Optional[float] = None
    vICMS: Optional[float] = None
    vBCST: Optional[float] = None
    vICMSST: Optional[float] = None
    vFCP: Optional[float] = None
    vFCPST: Optional[float] = None
    vIPI: Optional[float] = None
    vPIS: Optional[float] = None
    vCOFINS: Optional[float] = None
    vFrete: Optional[float] = None
    vSeg: Optional[float] = None
    vDesc: Optional[float] = None
    vOutro: Optional[float] = None

    cStat: Optional[str] = None
    xMotivo: Optional[str] = None
    nProt: Optional[str] = None
    dhRecbto: Optional[datetime] = None
    xml_version: Optional[str] = None

    status_importacao: Optional[str] = "COMPLETA"
    origem_importacao: Optional[str] = "XML_NFE"
    dados_completos: Optional[bool] = True
    xml_nfe_original_importado: Optional[bool] = True
    criada_por_evento: Optional[bool] = False
    ano_mes_emissao: Optional[str] = None
    codigo_uf: Optional[str] = None

    items: List[FiscalDocumentItemOut] = []
    installments: List[FiscalDocumentInstallmentOut] = []
    payments: List[FiscalDocumentPaymentOut] = []
    events: List[FiscalDocumentEventOut] = []

    class Config:
        from_attributes = True


class NfeAnalysisOut(BaseModel):
    id: UUID
    tenant_id: str
    name: str
    xml_content: Optional[str] = None
    file_name: Optional[str] = None
    file_hash: Optional[str] = None
    status: str
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    fiscal_document: Optional[FiscalDocumentOut] = None

    class Config:
        from_attributes = True


class NfePreviewItemOut(BaseModel):
    nItem: int
    cProd: Optional[str] = None
    xProd: Optional[str] = None
    NCM: Optional[str] = None
    CFOP: Optional[str] = None
    uCom: Optional[str] = None
    qCom: Optional[float] = 0.0
    vUnCom: Optional[float] = 0.0
    vProd: Optional[float] = None
    tributos: Optional[Any] = None


class NfePreviewSingleOut(BaseModel):
    file_name: Optional[str] = "nota.xml"
    document_type: Optional[str] = "NFE"
    access_key: str
    nNF: Optional[str] = None
    serie: Optional[str] = None
    mod: Optional[str] = None
    dhEmi: Optional[datetime] = None
    competencia: Optional[str] = None
    natOp: Optional[str] = None
    issuer_cnpj: Optional[str] = None
    issuer_name: Optional[str] = None
    issuer_ie: Optional[str] = None
    uf_emit: Optional[str] = None
    recipient_cnpj: Optional[str] = None
    recipient_name: Optional[str] = None
    uf_dest: Optional[str] = None
    vProd: Optional[float] = None
    vNF: Optional[float] = None
    vBC: Optional[float] = None
    vICMS: Optional[float] = None
    vBCST: Optional[float] = None
    vICMSST: Optional[float] = None
    vFCP: Optional[float] = None
    vFCPST: Optional[float] = None
    vIPI: Optional[float] = None
    vPIS: Optional[float] = None
    vCOFINS: Optional[float] = None
    vFrete: Optional[float] = None
    vSeg: Optional[float] = None
    vDesc: Optional[float] = None
    vOutro: Optional[float] = None
    item_count: int = 0
    items: List[NfePreviewItemOut] = []
    is_duplicate: bool = False
    is_from_analise_nfe: bool = False
    info_message: Optional[str] = None
    is_event: bool = False
    event_type: Optional[str] = None
    event_description: Optional[str] = None
    justification: Optional[str] = None
    cStat: Optional[str] = None
    xMotivo: Optional[str] = None
    registration_protocol: Optional[str] = None
    existing_imported_at: Optional[datetime] = None
    existing_imported_by: Optional[str] = None
    xml_content: str
    error: Optional[str] = None


class NfeBatchPreviewResponse(BaseModel):
    total_files: int
    valid_count: int
    duplicate_count: int
    rejected_count: int
    previews: List[NfePreviewSingleOut]


class ImportClassifiedNfeItem(BaseModel):
    file_name: Optional[str] = "nota.xml"
    xml_content: str
    aplicacao: Optional[str] = None
    tipo_tributacao: Optional[str] = None
    observacao_classificacao: Optional[str] = None


class BatchImportRequest(BaseModel):
    notes: List[ImportClassifiedNfeItem]
    force_reprocess_duplicates: bool = False
    allow_event_without_invoice: bool = True


class BatchImportSummary(BaseModel):
    total_sent: int
    imported_count: int
    classified_count: int
    duplicate_count: int
    rejected_count: int
    errors: List[dict] = []
    imported_ids: List[UUID] = []


class CancelDocumentInput(BaseModel):
    justificativa: str


class ClassificationUpdateInput(BaseModel):
    aplicacao: str
    tipo_tributacao: str
    observacao_classificacao: Optional[str] = None


class BatchClassificationInput(BaseModel):
    document_ids: Optional[List[UUID]] = None
    select_all_matching: Optional[bool] = False
    competencia: Optional[str] = None
    search: Optional[str] = None
    status_classificacao: Optional[str] = None
    uf_emit: Optional[str] = None
    divergencia_flag: Optional[bool] = None
    aplicacao: str
    tipo_tributacao: str
    observacao_classificacao: Optional[str] = None


class FiscalNfeHistoryOut(BaseModel):
    id: UUID
    fiscal_document_id: UUID
    action: str
    previous_values: Optional[Any] = None
    new_values: Optional[Any] = None
    justification: Optional[str] = None
    user_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MonthlyMetricsOut(BaseModel):
    total_notes: int = 0
    total_vNF: float = 0.0
    total_vProd: float = 0.0
    total_vICMS: float = 0.0
    total_vICMSST: float = 0.0
    total_vIPI: float = 0.0
    total_vPIS: float = 0.0
    total_vCOFINS: float = 0.0
    total_suppliers: int = 0
    pending_classification_count: int = 0
    divergence_count: int = 0


class PaginatedMonthlyDocumentsOut(BaseModel):
    items: List[FiscalDocumentOut]
    total: int
    page: int
    size: int
    pages: int
    metrics: MonthlyMetricsOut
