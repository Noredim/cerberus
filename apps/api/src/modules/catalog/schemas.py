from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Any
from datetime import datetime
from src.modules.catalog.models import SyncJobStatus

class StateBase(BaseModel):
    ibge_id: int
    sigla: str
    nome: str
    regiao_nome: Optional[str] = None
    regiao_sigla: Optional[str] = None
    is_active: bool = True

class StateCreate(StateBase):
    pass

class StateUpdate(BaseModel):
    sigla: Optional[str] = None
    nome: Optional[str] = None
    regiao_nome: Optional[str] = None
    regiao_sigla: Optional[str] = None
    is_active: Optional[bool] = None

class StateResponse(StateBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    last_sync_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CityBase(BaseModel):
    ibge_id: int
    state_id: str
    nome: str
    microregiao: Optional[str] = None
    mesorregiao: Optional[str] = None
    is_active: bool = True

class CityCreate(CityBase):
    pass

class CityUpdate(BaseModel):
    nome: Optional[str] = None
    microregiao: Optional[str] = None
    mesorregiao: Optional[str] = None
    is_active: Optional[bool] = None

class CityStateNested(BaseModel):
    id: str
    sigla: str
    nome: str

    model_config = ConfigDict(from_attributes=True)

class CityResponse(CityBase):
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    last_sync_at: Optional[datetime] = None
    state: Optional[CityStateNested] = None

    model_config = ConfigDict(from_attributes=True)

class PaginatedCityResponse(BaseModel):
    items: List[CityResponse]
    total: int
    page: int
    page_size: int

class IbgeSyncJobResponse(BaseModel):
    id: str
    tenant_id: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    status: SyncJobStatus
    summary_json: Optional[dict] = None
    error_message: Optional[str] = None
    triggered_by_user_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

# IBGE API Scraper Schemas
class IbgeStateResponse(BaseModel):
    id: int
    sigla: str
    nome: str
    regiao: dict # id, sigla, nome

class IbgeCityResponse(BaseModel):
    id: int
    nome: str
    microrregiao: dict # id, nome, mesorregiao: { id, nome, UF: { id, sigla, nome, regiao: {...} } }
