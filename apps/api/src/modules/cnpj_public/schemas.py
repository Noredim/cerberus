# src/modules/cnpj_public/schemas.py
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import date, datetime

class CnaeSchema(BaseModel):
    codigo: str
    descricao: Optional[str] = None

class EnderecoSchema(BaseModel):
    logradouro: Optional[str] = None
    numero: Optional[str] = None
    complemento: Optional[str] = None
    bairro: Optional[str] = None
    cep: Optional[str] = None
    municipio_ibge: Optional[str] = None
    uf: Optional[str] = None

class CnpjLookupResponse(BaseModel):
    cnpj: str
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    situacao_cadastral: Optional[str] = None
    data_inicio_atividade: Optional[date] = None
    natureza_juridica_codigo: Optional[str] = None
    porte_codigo: Optional[str] = None
    endereco: Optional[EnderecoSchema] = None
    cnae_principal: Optional[CnaeSchema] = None
    cnaes_secundarios: List[CnaeSchema] = []

class SyncTriggerRequest(BaseModel):
    source_ref: str = Field(..., description="Referência do lote. Ex: '2024-05'")
    dry_run: bool = False

class BatchRunResponse(BaseModel):
    batch_id: str
    status: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    source_ref: Optional[str] = None
    error_message: Optional[str] = None
    rows_public_json: Optional[Any] = None

    class Config:
        from_attributes = True
