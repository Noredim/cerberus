from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID

class RoleBase(BaseModel):
    company_id: UUID = Field(..., description="ID of the associated company")
    name: str = Field(..., description="Name of the role")
    can_perform_sale: bool = Field(default=False, description="Whether this role can perform sales")

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseModel):
    company_id: Optional[UUID] = None
    name: Optional[str] = None
    can_perform_sale: Optional[bool] = None

class RoleResponse(RoleBase):
    id: str
    tenant_id: str

    class Config:
        from_attributes = True
