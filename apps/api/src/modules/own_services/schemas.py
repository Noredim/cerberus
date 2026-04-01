from __future__ import annotations

from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fator_to_hhmmss(fator: float) -> str:
    """Convert a decimal factor (hours) to HH:MM:SS string.
    e.g. fator=1.5 → '01:30:00', fator=0.25 → '00:15:00'
    """
    total_seconds = round(fator * 3600)
    h = total_seconds // 3600
    m = (total_seconds % 3600) // 60
    s = total_seconds % 60
    return f"{h:02d}:{m:02d}:{s:02d}"


# ── Item schemas ──────────────────────────────────────────────────────────────

class OwnServiceItemCreate(BaseModel):
    role_id: str
    fator: float = Field(..., gt=0, description="Fator de tempo em horas (ex: 1.5 = 1h30m)")


class OwnServiceItemResponse(BaseModel):
    id: UUID
    own_service_id: UUID
    role_id: str
    role_name: Optional[str] = None
    fator: float
    tempo_hhmmss: str = ""
    # Legacy fields kept for compatibility
    tempo_minutos: int
    tempo_total_minutos: int

    model_config = {"from_attributes": True}


# ── Service header schemas ────────────────────────────────────────────────────

class OwnServiceCreate(BaseModel):
    nome_servico: str = Field(..., min_length=1, max_length=200)
    unidade: Optional[str] = Field(None, max_length=10)
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
    unidade: Optional[str] = Field(default=None, max_length=10)
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
    unidade: Optional[str] = None
    vigencia: int
    descricao: Optional[str] = None
    tempo_total_minutos: int
    fator_consolidado: float = 0.0
    tempo_consolidado_hhmmss: str = "00:00:00"
    ativo: bool
    items: List[OwnServiceItemResponse] = []

    model_config = {"from_attributes": True}


class OwnServiceListItem(BaseModel):
    """Lightweight response for the main grid."""
    id: UUID
    nome_servico: str
    unidade: Optional[str] = None
    vigencia: int
    tempo_total_minutos: int
    fator_consolidado: float = 0.0
    tempo_consolidado_hhmmss: str = "00:00:00"
    qt_cargos: int = 0

    model_config = {"from_attributes": True}
