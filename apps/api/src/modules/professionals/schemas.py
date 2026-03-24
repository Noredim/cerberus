from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re

def clean_digits(v: Optional[str]) -> Optional[str]:
    if v is None:
        return v
    return re.sub(r'[^0-9]', '', str(v))

class ProfessionalBase(BaseModel):
    name: str = Field(..., description="Name of the professional")
    cpf: str = Field(..., description="CPF of the professional")
    role_id: str = Field(..., description="ID of the associated role")
    user_id: Optional[str] = Field(None, description="ID of the associated user account")

    @field_validator('cpf')
    @classmethod
    def validate_cpf(cls, v: str) -> str:
        cleaned = clean_digits(v)
        if not cleaned or len(cleaned) != 11:
            raise ValueError("CPF deve conter exatamente 11 dígitos.")
        # We can implement full CPF loop logic here, but keeping it simple/standard structure
        return cleaned

class ProfessionalCreate(ProfessionalBase):
    pass

class ProfessionalUpdate(BaseModel):
    name: Optional[str] = None
    cpf: Optional[str] = None
    role_id: Optional[str] = None
    user_id: Optional[str] = None

    @field_validator('cpf')
    @classmethod
    def validate_cpf(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        cleaned = clean_digits(v)
        if not cleaned or len(cleaned) != 11:
            raise ValueError("CPF deve conter exatamente 11 dígitos.")
        return cleaned

class RoleNestedResponse(BaseModel):
    id: str
    name: str
    can_perform_sale: bool = False

    class Config:
        from_attributes = True

class UserNestedResponse(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True

class ProfessionalResponse(ProfessionalBase):
    id: str
    tenant_id: str
    role: Optional[RoleNestedResponse] = None
    user: Optional[UserNestedResponse] = None

    class Config:
        from_attributes = True

class AvailableUserResponse(BaseModel):
    id: str
    name: str
    email: str

    class Config:
        from_attributes = True
