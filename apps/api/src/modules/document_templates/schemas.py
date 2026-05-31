from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from uuid import UUID
from datetime import datetime


class VariableBase(BaseModel):
    nome: str
    origem: str
    campo: str
    tipo: str = "TEXTO"
    obrigatoria: bool = False


class VariableCreate(VariableBase):
    pass


class VariableOut(VariableBase):
    id: UUID
    modelo_id: UUID

    model_config = ConfigDict(from_attributes=True)


class TemplateBase(BaseModel):
    nome: str
    tipo_documento: str
    modulo_origem: str
    conteudo_html: str
    descricao: Optional[str] = None


class TemplateCreate(TemplateBase):
    variables: List[VariableCreate] = []


class TemplateUpdate(TemplateBase):
    variables: List[VariableCreate] = []


class VersionOut(BaseModel):
    id: UUID
    modelo_id: UUID
    versao: int
    conteudo_html: str
    usuario_id: str
    data_publicacao: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditOut(BaseModel):
    id: UUID
    modelo_id: UUID
    usuario_id: str
    acao: str
    data_hora: datetime

    model_config = ConfigDict(from_attributes=True)


class TemplateOut(TemplateBase):
    id: UUID
    tenant_id: str
    company_id: UUID
    status: str
    versao: int
    variables: List[VariableOut] = []
    versions: List[VersionOut] = []
    audits: List[AuditOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DocumentRenderRequest(BaseModel):
    oportunidade_id: Optional[str] = None
    # For future extensions
    contrato_id: Optional[str] = None
    ordem_servico_id: Optional[str] = None
