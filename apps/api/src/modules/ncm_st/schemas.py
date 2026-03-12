from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime
from decimal import Decimal

class NcmStItemBase(BaseModel):
    item: Optional[str] = None
    is_active: bool = True
    ncm_sh: Optional[str] = None
    ncm_normalizado: Optional[str] = None
    cest: Optional[str] = None
    descricao: Optional[str] = None
    observacoes: Optional[str] = None
    vigencia_inicio: Optional[datetime] = None
    fundamento: Optional[str] = None
    segmento_anexo: Optional[str] = None
    cest_normalizado: Optional[str] = None
    mva_percent: Optional[Decimal] = None
    vigencia_fim: Optional[datetime] = None

class NcmStItemCreate(NcmStItemBase):
    pass

class NcmStItemResponse(NcmStItemBase):
    id: str
    cad_ncm_st_id: str
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)

class NcmStHeaderBase(BaseModel):
    state_id: str
    description: str
    is_active: bool = True

class NcmStHeaderCreate(NcmStHeaderBase):
    pass

class NcmStHeaderUpdate(BaseModel):
    state_id: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None

class NcmStHeaderResponse(NcmStHeaderBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None
    item_count: Optional[int] = 0
    state_sigla: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class NcmStImportRequest(BaseModel):
    strategy: str = "REPLACE" # REPLACE or APPEND

class ImportSummary(BaseModel):
    total_processed: int
    success_count: int
    error_count: int
    message: str
