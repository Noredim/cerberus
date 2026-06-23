from pydantic import BaseModel, ConfigDict, Field
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID
from decimal import Decimal

class TipiImportacaoOut(BaseModel):
    id: UUID
    arquivo_nome: str
    vigencia: date
    total_linhas: int
    total_importados: int
    total_ignorados: int
    total_erros: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class NcmTipiOut(BaseModel):
    id: UUID
    ncm_id: UUID
    importacao_id: UUID
    aliquota: Decimal
    vigencia: date
    codigo_ncm: Optional[str] = None
    descricao_ncm: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TipiImportacaoPaginated(BaseModel):
    items: List[TipiImportacaoOut]
    total: int
    skip: int
    limit: int


class NcmTipiPaginated(BaseModel):
    items: List[NcmTipiOut]
    total: int
    skip: int
    limit: int
