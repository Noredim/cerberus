from pydantic import BaseModel, Field, ConfigDict, field_validator
import re
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID

class NcmBase(BaseModel):
    codigo: str
    descricao: str
    data_inicio: date
    data_fim: date
    tipo_ato_ini: Optional[str] = None
    numero_ato_ini: Optional[str] = None
    ano_ato_ini: Optional[str] = None

    @field_validator('codigo', mode='before')
    @classmethod
    def clean_codigo(cls, v):
        return re.sub(r'\D', '', v) if isinstance(v, str) else v

class NcmCreate(NcmBase):
    pass

class NcmUpdate(BaseModel):
    codigo: Optional[str] = None
    descricao: Optional[str] = None
    data_inicio: Optional[date] = None
    data_fim: Optional[date] = None
    tipo_ato_ini: Optional[str] = None
    numero_ato_ini: Optional[str] = None
    ano_ato_ini: Optional[str] = None

    @field_validator('codigo', mode='before')
    @classmethod
    def clean_codigo(cls, v):
        if v is None: return v
        return re.sub(r'\D', '', v) if isinstance(v, str) else v

class NcmOut(NcmBase):
    id: UUID
    importacao_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    
    model_config = ConfigDict(from_attributes=True)

class NcmImportacaoOut(BaseModel):
    id: UUID
    data_ultima_atualizacao_ncm: Optional[str] = None
    ato: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class NcmImportResult(BaseModel):
    total_processados: int
    total_inseridos: int
    total_atualizados: int
    total_ignorados: int
    importacao_id: UUID

class NcmImportItemSchema(BaseModel):
    # Match the JSON keys exactly for the parser
    Codigo: str
    Descricao: str
    Data_Inicio: str
    Data_Fim: str
    Tipo_Ato_Ini: Optional[str] = None
    Numero_Ato_Ini: Optional[str] = None
    Ano_Ato_Ini: Optional[str] = None

    @field_validator('Codigo', mode='before')
    @classmethod
    def clean_codigo(cls, v):
        return re.sub(r'\D', '', v) if isinstance(v, str) else v

class NcmImportSchema(BaseModel):
    Data_Ultima_Atualizacao_NCM: str
    Ato: str
    Nomenclaturas: List[NcmImportItemSchema]

class NcmPaginatedResponse(BaseModel):
    items: List[NcmOut]
    total: int
    skip: int
    limit: int
