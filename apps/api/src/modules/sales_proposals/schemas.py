from pydantic import BaseModel, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from decimal import Decimal

from src.modules.opportunity_kits.schemas import OpportunityKitResponse

class SalesProposalBase(BaseModel):
    titulo: str
    customer_id: str
    vendedor_id: Optional[str] = None
    observacoes: Optional[str] = None
    status: str = "RASCUNHO"
    
    fator_margem_produtos: Optional[Decimal] = None
    fator_margem_servicos: Optional[Decimal] = None
    fator_margem_instalacao: Optional[Decimal] = None
    fator_margem_manutencao: Optional[Decimal] = None
    frete_venda: Optional[Decimal] = None
    despesas_adm: Optional[Decimal] = None
    comissao: Optional[Decimal] = None

class SalesProposalCreate(SalesProposalBase):
    pass

class SalesProposalUpdate(BaseModel):
    titulo: Optional[str] = None
    customer_id: Optional[str] = None
    vendedor_id: Optional[str] = None
    observacoes: Optional[str] = None
    status: Optional[str] = None
    fator_margem_produtos: Optional[Decimal] = None
    fator_margem_servicos: Optional[Decimal] = None
    fator_margem_instalacao: Optional[Decimal] = None
    fator_margem_manutencao: Optional[Decimal] = None
    frete_venda: Optional[Decimal] = None
    despesas_adm: Optional[Decimal] = None
    comissao: Optional[Decimal] = None

class SalesProposalUpdateFactors(BaseModel):
    fator_margem_produtos: Optional[Decimal] = None
    fator_margem_servicos: Optional[Decimal] = None
    fator_margem_instalacao: Optional[Decimal] = None
    fator_margem_manutencao: Optional[Decimal] = None
    frete_venda: Optional[Decimal] = None
    despesas_adm: Optional[Decimal] = None
    comissao: Optional[Decimal] = None

class ChangeResponsavelRequest(BaseModel):
    responsavel_id: str

# Replaced OpportunityKitSimple with OpportunityKitResponse

class SalesProposalKitDetail(BaseModel):
    id: UUID
    opportunity_kit_id: UUID
    quantidade_override: Optional[Decimal] = None
    created_at: datetime
    opportunity_kit: Optional[OpportunityKitResponse] = None

    model_config = ConfigDict(from_attributes=True)

class SalesProposalResponse(SalesProposalBase):
    id: UUID
    numero_sequencial: int
    numero_proposta: str
    responsavel_id: Optional[str] = None
    tenant_id: str
    company_id: UUID
    created_at: datetime
    updated_at: datetime
    kits: Optional[List[SalesProposalKitDetail]] = []

    model_config = ConfigDict(from_attributes=True)

class AddKitRequest(BaseModel):
    opportunity_kit_id: UUID

class SalesProposalKitResponse(BaseModel):
    id: UUID
    opportunity_kit_id: UUID
    quantidade_override: Optional[Decimal] = None
    created_at: datetime
    opportunity_kit: Optional[OpportunityKitResponse] = None

    model_config = ConfigDict(from_attributes=True)
