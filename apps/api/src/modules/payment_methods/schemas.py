from pydantic import BaseModel, Field, ConfigDict, model_validator, field_validator
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from enum import Enum

class TipoUsoEnum(str, Enum):
    COMPRA = 'COMPRA'
    VENDA = 'VENDA'
    AMBOS = 'AMBOS'

class TipoDistribuicaoEnum(str, Enum):
    PERCENTUAL = 'PERCENTUAL'
    RATEIO_IGUAL = 'RATEIO_IGUAL'
    VALOR_FIXO = 'VALOR_FIXO'

class StatusMovimentoEnum(str, Enum):
    PREVISTO = 'PREVISTO'
    REALIZADO = 'REALIZADO'

class TipoMovimentoEnum(str, Enum):
    RECEBIMENTO = 'RECEBIMENTO'
    PAGAMENTO = 'PAGAMENTO'

# --- Parcelas ---
class FormaPagamentoParcelaBase(BaseModel):
    sequencia: int = Field(..., ge=1)
    descricao: str = Field(..., min_length=1)
    intervalo_dias: int = Field(..., ge=0, description="Intervalo de dias (não pode ser negativo)")
    percentual: Optional[Decimal] = Field(default=None, max_digits=10, decimal_places=4)
    valor_fixo: Optional[Decimal] = Field(default=None, max_digits=15, decimal_places=4)

class FormaPagamentoParcelaCreate(FormaPagamentoParcelaBase):
    pass

class FormaPagamentoParcelaOut(FormaPagamentoParcelaBase):
    id: UUID
    forma_pagamento_id: UUID

    class Config:
        from_attributes = True

# --- Formas de Pagamento ---
class FormaPagamentoBase(BaseModel):
    descricao: str = Field(..., min_length=1)
    tipo_uso: TipoUsoEnum
    tipo_distribuicao: TipoDistribuicaoEnum
    ativo: bool = True
    observacao: Optional[str] = None

class FormaPagamentoCreate(FormaPagamentoBase):
    parcelas: List[FormaPagamentoParcelaCreate]

    @model_validator(mode='after')
    def validate_installments(self) -> 'FormaPagamentoCreate':
        if not self.parcelas:
            raise ValueError("Toda forma de pagamento deve possuir ao menos uma parcela.")

        # Check sequence uniqueness and ordering
        sequences = [p.sequencia for p in self.parcelas]
        if len(sequences) != len(set(sequences)):
            raise ValueError("Sequências de parcelas duplicadas detectadas.")

        # Validation for PERCENTUAL
        if self.tipo_distribuicao == TipoDistribuicaoEnum.PERCENTUAL:
            total_pct = sum((p.percentual or Decimal('0')) for p in self.parcelas)
            if total_pct != Decimal('100.0000') and total_pct != Decimal('100'):
                raise ValueError("A distribuição percentual deve totalizar exatamente 100%.")
            for p in self.parcelas:
                if p.percentual is None or p.percentual < 0:
                    raise ValueError("O percentual de cada parcela deve ser maior ou igual a zero.")

        # Validation for VALOR_FIXO template creation
        # (Templates can have null default fixed values since they are filled during operations,
        # but if provided, they must be positive)
        elif self.tipo_distribuicao == TipoDistribuicaoEnum.VALOR_FIXO:
            for p in self.parcelas:
                if p.valor_fixo is not None and p.valor_fixo < 0:
                    raise ValueError("Os valores fixos das parcelas não podem ser negativos.")

        return self

class FormaPagamentoUpdate(FormaPagamentoBase):
    parcelas: List[FormaPagamentoParcelaCreate]

    @model_validator(mode='after')
    def validate_installments(self) -> 'FormaPagamentoUpdate':
        if not self.parcelas:
            raise ValueError("Toda forma de pagamento deve possuir ao menos uma parcela.")

        # Check sequence uniqueness
        sequences = [p.sequencia for p in self.parcelas]
        if len(sequences) != len(set(sequences)):
            raise ValueError("Sequências de parcelas duplicadas detectadas.")

        # Validation for PERCENTUAL
        if self.tipo_distribuicao == TipoDistribuicaoEnum.PERCENTUAL:
            total_pct = sum((p.percentual or Decimal('0')) for p in self.parcelas)
            if total_pct != Decimal('100.0000') and total_pct != Decimal('100'):
                raise ValueError("A distribuição percentual deve totalizar exatamente 100%.")
            for p in self.parcelas:
                if p.percentual is None or p.percentual < 0:
                    raise ValueError("O percentual de cada parcela deve ser maior ou igual a zero.")

        return self

class FormaPagamentoOut(FormaPagamentoBase):
    id: UUID
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    parcelas: List[FormaPagamentoParcelaOut] = []

    class Config:
        from_attributes = True

# --- Planejamento Financeiro ---
class PlanejamentoFinanceiroOut(BaseModel):
    id: UUID
    tenant_id: str
    company_id: UUID
    origem_tipo: str
    origem_id: UUID
    numero_parcela: int
    descricao: str
    data_prevista: date
    valor_previsto: Decimal
    tipo_movimento: TipoMovimentoEnum
    status: StatusMovimentoEnum
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
