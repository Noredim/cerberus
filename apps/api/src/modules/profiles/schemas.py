from pydantic import BaseModel, Field
from typing import Optional

class FunctionalProfileBase(BaseModel):
    name: str = Field(..., min_length=1)
    margin_factor_limit: float = Field(..., ge=0)
    view_director_consolidation: bool = False

class FunctionalProfileCreate(FunctionalProfileBase):
    pass

class FunctionalProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    margin_factor_limit: Optional[float] = Field(None, ge=0)
    view_director_consolidation: Optional[bool] = None

class FunctionalProfileResponse(FunctionalProfileBase):
    id: str
    tenant_id: str
    is_protected: bool

    class Config:
        orm_mode = True
