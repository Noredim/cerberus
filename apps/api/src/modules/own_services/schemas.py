from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ── Item schemas ──────────────────────────────────────────────────────────────

class OwnServiceItemCreate(BaseModel):
    role_id: str
    tempo_minutos: int = Field(..., gt=0, description="Tempo total em minutos (> 0)")


class OwnServiceItemResponse(BaseModel):
    id: UUID
    own_service_id: UUID
    role_id: str
    role_name: Optional[str] = None
    tempo_minutos: int
    tempo_total_minutos: int

    model_config = {"from_attributes": True}


# ── Service header schemas ────────────────────────────────────────────────────

class OwnServiceCreate(BaseModel):
    nome_servico: str = Field(..., min_length=1, max_length=200)
    vigencia: int = Field(..., ge=2000, le=2099)
    descricao: Optional[str] = None
    items: List[OwnServiceItemCreate] = Field(..., min_length=1)

    @field_validator("nome_servico")
    @classmethod
    def strip_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Nome do serviço é obrigatório.")
        return v

    @field_validator("items")
    @classmethod
    def no_duplicate_roles(cls, items: List[OwnServiceItemCreate]) -> List[OwnServiceItemCreate]:
        role_ids = [i.role_id for i in items]
        if len(role_ids) != len(set(role_ids)):
            raise ValueError("Um mesmo cargo não pode aparecer mais de uma vez na composição.")
        return items


class OwnServiceUpdate(BaseModel):
    nome_servico: Optional[str] = Field(default=None, max_length=200)
    vigencia: Optional[int] = Field(default=None, ge=2000, le=2099)
    descricao: Optional[str] = None
    items: Optional[List[OwnServiceItemCreate]] = None

    @field_validator("nome_servico")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            if not v:
                raise ValueError("Nome do serviço não pode ser vazio.")
        return v

    @field_validator("items")
    @classmethod
    def no_duplicate_roles(cls, items: Optional[List[OwnServiceItemCreate]]) -> Optional[List[OwnServiceItemCreate]]:
        if items is not None:
            role_ids = [i.role_id for i in items]
            if len(role_ids) != len(set(role_ids)):
                raise ValueError("Um mesmo cargo não pode aparecer mais de uma vez na composição.")
        return items


class OwnServiceResponse(BaseModel):
    id: UUID
    tenant_id: str
    company_id: UUID
    nome_servico: str
    vigencia: int
    descricao: Optional[str] = None
    tempo_total_minutos: int
    ativo: bool
    items: List[OwnServiceItemResponse] = []

    model_config = {"from_attributes": True}


class OwnServiceListItem(BaseModel):
    """Lightweight response for the main grid."""
    id: UUID
    nome_servico: str
    vigencia: int
    tempo_total_minutos: int
    qt_cargos: int = 0

    model_config = {"from_attributes": True}
