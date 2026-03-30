from __future__ import annotations
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, field_validator
from decimal import Decimal


# ── Item schemas ──────────────────────────────────────────────────────────────

class SolutionItemSlot(BaseModel):
    """One solution slot inside an add-items request."""
    item_id: Optional[UUID] = None
    quantidade: Optional[Decimal] = None

    @field_validator("quantidade")
    @classmethod
    def qty_positive(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("Quantidade deve ser maior que zero")
        return v


class SolutionAnalysisItemCreate(BaseModel):
    """Payload to add a new comparison row."""
    solucao_a: Optional[SolutionItemSlot] = None
    solucao_b: Optional[SolutionItemSlot] = None
    solucao_c: Optional[SolutionItemSlot] = None


class SolutionAnalysisItemResponse(BaseModel):
    id: UUID
    analise_id: UUID
    sequencia: int

    # A
    item_a_id: Optional[UUID] = None
    item_a_nome: Optional[str] = None
    qtd_a: Optional[Decimal] = None
    vlr_unit_a: Optional[Decimal] = None
    vlr_total_a: Optional[Decimal] = None

    # B
    item_b_id: Optional[UUID] = None
    item_b_nome: Optional[str] = None
    qtd_b: Optional[Decimal] = None
    vlr_unit_b: Optional[Decimal] = None
    vlr_total_b: Optional[Decimal] = None

    # C
    item_c_id: Optional[UUID] = None
    item_c_nome: Optional[str] = None
    qtd_c: Optional[Decimal] = None
    vlr_unit_c: Optional[Decimal] = None
    vlr_total_c: Optional[Decimal] = None

    # Result
    melhor_solucao: Optional[str] = None
    diferenca_valor: Optional[Decimal] = None
    diferenca_percentual: Optional[Decimal] = None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Analysis header schemas ───────────────────────────────────────────────────

class SolutionAnalysisCreate(BaseModel):
    titulo: str
    tipo_analise: str  # REVENDA | LOCACAO
    nome_solucao_a: Optional[str] = None
    nome_solucao_b: Optional[str] = None
    nome_solucao_c: Optional[str] = None

    @field_validator("titulo")
    @classmethod
    def titulo_max_length(cls, v: str) -> str:
        if len(v.strip()) == 0:
            raise ValueError("Título é obrigatório")
        if len(v) > 150:
            raise ValueError("Título deve ter no máximo 150 caracteres")
        return v

    @field_validator("tipo_analise")
    @classmethod
    def tipo_valido(cls, v: str) -> str:
        if v not in ("REVENDA", "LOCACAO"):
            raise ValueError("Tipo deve ser REVENDA ou LOCACAO")
        return v


class SolutionAnalysisUpdate(BaseModel):
    titulo: Optional[str] = None
    tipo_analise: Optional[str] = None
    nome_solucao_a: Optional[str] = None
    nome_solucao_b: Optional[str] = None
    nome_solucao_c: Optional[str] = None


class SolutionAnalysisResponse(BaseModel):
    id: UUID
    tenant_id: str
    company_id: UUID
    titulo: str
    tipo_analise: str
    nome_solucao_a: Optional[str] = None
    nome_solucao_b: Optional[str] = None
    nome_solucao_c: Optional[str] = None
    usuario_id: Optional[str] = None
    criado_por_nome: Optional[str] = None
    ultima_alteracao_por_id: Optional[str] = None
    ultima_alteracao_por_nome: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[SolutionAnalysisItemResponse] = []

    model_config = {"from_attributes": True}


class SolutionAnalysisSummary(BaseModel):
    """Lightweight response for list view, with computed totals."""
    id: UUID
    titulo: str
    tipo_analise: str
    nome_solucao_a: Optional[str] = None
    nome_solucao_b: Optional[str] = None
    nome_solucao_c: Optional[str] = None
    criado_por_nome: Optional[str] = None
    usuario_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime
    qtde_linhas: int
    total_a: Decimal
    total_b: Decimal
    total_c: Decimal
    melhor_solucao_geral: Optional[str] = None

    model_config = {"from_attributes": True}
