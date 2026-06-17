from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from src.modules.opportunity_kits.schemas import OpportunityKitResponse

class LicitacaoItemBase(BaseModel):
    codigo: str
    nome: str
    descricao: Optional[str] = None
    quantidade: Decimal = Field(default=Decimal(1))

class LicitacaoItemCreate(LicitacaoItemBase):
    pass

class LicitacaoItemResponse(LicitacaoItemBase):
    id: UUID
    lote_id: UUID
    kits: List[OpportunityKitResponse] = []

    class Config:
        from_attributes = True


class LicitacaoLoteBase(BaseModel):
    numero: str
    nome: str
    descricao: Optional[str] = None

class LicitacaoLoteCreate(LicitacaoLoteBase):
    items: List[LicitacaoItemCreate] = []

class LicitacaoLoteResponse(LicitacaoLoteBase):
    id: UUID
    licitacao_id: UUID
    items: List[LicitacaoItemResponse] = []

    class Config:
        from_attributes = True


class LicitacaoBase(BaseModel):
    company_id: UUID
    customer_id: str
    numero_edital: str
    descricao: Optional[str] = None
    data_publicacao: Optional[datetime] = None
    data_licitacao: Optional[datetime] = None
    data_limite_questionamento: Optional[datetime] = None
    po_id: Optional[str] = None
    status: str = Field(default="Criada")
    modalidade: str
    tipo_licitacao: str

class LicitacaoCreate(LicitacaoBase):
    lotes: List[LicitacaoLoteCreate] = []

class LicitacaoUpdate(BaseModel):
    company_id: Optional[UUID] = None
    customer_id: Optional[str] = None
    numero_edital: Optional[str] = None
    descricao: Optional[str] = None
    data_publicacao: Optional[datetime] = None
    data_licitacao: Optional[datetime] = None
    data_limite_questionamento: Optional[datetime] = None
    po_id: Optional[str] = None
    status: Optional[str] = None
    modalidade: Optional[str] = None
    tipo_licitacao: Optional[str] = None
    aprovado_diretoria: Optional[bool] = None

class LicitacaoSimpleResponse(LicitacaoBase):
    id: UUID
    customer_nome: Optional[str] = None
    po_nome: Optional[str] = None
    valor_total_estimado: Decimal
    valor_total_venda: Decimal
    margem_ponderada_global: Decimal
    precisa_aprovacao_diretoria: bool
    aprovado_diretoria: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LicitacaoResponse(LicitacaoSimpleResponse):
    lotes: List[LicitacaoLoteResponse] = []
    analistas: List['LicitacaoAnalistaResponse'] = []

    class Config:
        from_attributes = True

class LicitacaoListResponse(BaseModel):
    total: int
    items: List[LicitacaoSimpleResponse]


class LicitacaoAnalistaBase(BaseModel):
    usuario_id: str
    data_zero: datetime
    prazo_dias_uteis: int = 4
    data_limite: datetime

class LicitacaoAnalistaCreate(BaseModel):
    usuario_id: str
    prazo_dias_uteis: int = 4

class LicitacaoAnalistaResponse(LicitacaoAnalistaBase):
    id: UUID
    licitacao_id: UUID
    usuario_nome: Optional[str] = None

    class Config:
        from_attributes = True


class LicitacaoHistoryResponse(BaseModel):
    id: UUID
    usuario_id: str
    usuario_nome: Optional[str] = None
    descricao: str
    data_movimentacao: datetime

    class Config:
        from_attributes = True


class LicitacaoChecklistAplicacaoBase(BaseModel):
    usuario_id: str
    status: str = "Pendente"
    observacao: Optional[str] = None

class LicitacaoChecklistAplicacaoCreate(BaseModel):
    usuario_id: str
    observacao: Optional[str] = None

class LicitacaoChecklistAplicacaoUpdate(BaseModel):
    status: Optional[str] = None
    observacao: Optional[str] = None

class LicitacaoChecklistAplicacaoResponse(BaseModel):
    id: UUID
    licitacao_id: UUID
    item_id: UUID
    usuario_id: str
    usuario_nome: Optional[str] = None
    status: str
    observacao: Optional[str] = None
    data_conclusao: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class LicitacaoChecklistItemBase(BaseModel):
    nome: str
    descricao: Optional[str] = None
    status: str = "Pendente"
    usuario_id: Optional[str] = None
    ordem: int = 0

class LicitacaoChecklistItemCreate(BaseModel):
    nome: str
    descricao: Optional[str] = None

class LicitacaoChecklistItemUpdate(BaseModel):
    status: Optional[str] = None
    usuario_id: Optional[str] = None

class LicitacaoChecklistItemResponse(LicitacaoChecklistItemBase):
    id: UUID
    grupo_id: UUID
    usuario_nome: Optional[str] = None
    data_conclusao: Optional[datetime] = None
    aplicacoes: List[LicitacaoChecklistAplicacaoResponse] = []

    class Config:
        from_attributes = True

class LicitacaoChecklistGrupoResponse(BaseModel):
    id: UUID
    licitacao_id: UUID
    nome: str
    ordem: int
    items: List[LicitacaoChecklistItemResponse] = []

    class Config:
        from_attributes = True

class LicitacaoTarefaBase(BaseModel):
    titulo: str
    descricao: Optional[str] = None
    responsavel_id: str
    data_limite: datetime
    checklist_item_id: Optional[UUID] = None
    checklist_aplicacao_id: Optional[UUID] = None

class LicitacaoTarefaCreate(LicitacaoTarefaBase):
    pass

class LicitacaoTarefaUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    responsavel_id: Optional[str] = None
    data_limite: Optional[datetime] = None
    status: Optional[str] = None

class LicitacaoTarefaAndamentoResponse(BaseModel):
    id: UUID
    tarefa_id: UUID
    usuario_id: str
    usuario_nome: Optional[str] = None
    descricao: str
    status_anterior: str
    status_novo: str
    created_at: datetime

    class Config:
        from_attributes = True

class LicitacaoTarefaResponse(BaseModel):
    id: UUID
    licitacao_id: UUID
    checklist_item_id: Optional[UUID] = None
    checklist_aplicacao_id: Optional[UUID] = None
    titulo: str
    descricao: Optional[str] = None
    responsavel_id: str
    responsavel_nome: Optional[str] = None
    criador_id: str
    criador_nome: Optional[str] = None
    data_limite: datetime
    status: str
    created_at: datetime
    updated_at: datetime
    andamentos: List[LicitacaoTarefaAndamentoResponse] = []

    class Config:
        from_attributes = True

class LicitacaoTarefaAndamentoCreate(BaseModel):
    descricao: str
