from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ManHourBase(BaseModel):
    role_id: str
    vigencia: int = Field(..., ge=2000, le=2099, description="Ano de vigência (AAAA)")

    hora_normal: Decimal = Field(..., ge=0)
    hora_extra: Decimal = Field(..., ge=0)
    hora_extra_adicional_noturno: Decimal = Field(..., ge=0)
    hora_extra_domingos_feriados: Decimal = Field(..., ge=0)
    hora_extra_domingos_feriados_noturno: Decimal = Field(..., ge=0)

    @field_validator(
        "hora_normal",
        "hora_extra",
        "hora_extra_adicional_noturno",
        "hora_extra_domingos_feriados",
        "hora_extra_domingos_feriados_noturno",
    )
    @classmethod
    def must_be_non_negative(cls, v: Decimal) -> Decimal:
        if v < 0:
            raise ValueError("O valor não pode ser negativo.")
        return v


class ManHourCreate(ManHourBase):
    pass


class ManHourUpdate(BaseModel):
    role_id: Optional[str] = None
    vigencia: Optional[int] = Field(default=None, ge=2000, le=2099)

    hora_normal: Optional[Decimal] = Field(default=None, ge=0)
    hora_extra: Optional[Decimal] = Field(default=None, ge=0)
    hora_extra_adicional_noturno: Optional[Decimal] = Field(default=None, ge=0)
    hora_extra_domingos_feriados: Optional[Decimal] = Field(default=None, ge=0)
    hora_extra_domingos_feriados_noturno: Optional[Decimal] = Field(default=None, ge=0)
    ativo: Optional[bool] = None

    @field_validator(
        "hora_normal",
        "hora_extra",
        "hora_extra_adicional_noturno",
        "hora_extra_domingos_feriados",
        "hora_extra_domingos_feriados_noturno",
    )
    @classmethod
    def must_be_non_negative(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v < 0:
            raise ValueError("O valor não pode ser negativo.")
        return v


class ManHourResponse(ManHourBase):
    id: str
    tenant_id: str
    company_id: UUID          # UUID object from SQLAlchemy UUID(as_uuid=True) column
    ativo: bool
    role_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    created_by: Optional[str] = None
    updated_by: Optional[str] = None

    model_config = {"from_attributes": True}
