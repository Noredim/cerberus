from pydantic import BaseModel, EmailStr
from typing import List, Optional


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    tenant_id: str
    is_active: bool
    roles: List[str]
    companies: List[str] = []

    class Config:
        from_attributes = True

class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str
    companies: Optional[List[str]] = []

class UserUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    roles: Optional[List[str]] = None
    is_active: Optional[bool] = None
    companies: Optional[List[str]] = None

class UserCompanyResponse(BaseModel):
    id: str
    company_id: str
    is_default: bool
    # We can include partial Company data to avoid extra lookups
    company_name: str
    company_cnpj: str

    class Config:
        from_attributes = True

class UserCompanyAssign(BaseModel):
    company_id: str
    is_default: Optional[bool] = False
