from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import Optional, List, Any
from uuid import UUID
from datetime import datetime
from enum import Enum


class LeadStatusEnum(str, Enum):
    NOVO = "NOVO"
    AGUARDANDO_ACEITE = "AGUARDANDO_ACEITE"
    ASSUMIDO = "ASSUMIDO"
    EM_ATENDIMENTO = "EM_ATENDIMENTO"
    QUALIFICADO = "QUALIFICADO"
    CONVERTIDO = "CONVERTIDO"
    PERDIDO = "PERDIDO"


class LeadOriginEnum(str, Enum):
    LIGACAO = "LIGACAO"
    VISITA = "VISITA"
    EMAIL = "EMAIL"
    REDES_SOCIAIS = "REDES_SOCIAIS"
    POS_VISITA = "POS_VISITA"
    INDICACAO = "INDICACAO"
    SITE = "SITE"
    OUTROS = "OUTROS"


class LeadDistTypeEnum(str, Enum):
    DIRETA_VENDEDOR = "DIRETA_VENDEDOR"
    DIRECIONADO_MANUAL = "DIRECIONADO_MANUAL"
    ROUND_ROBIN = "ROUND_ROBIN"


class LeadLossReasonEnum(str, Enum):
    PRECO_ORCAMENTO = "Preço / Orçamento"
    CONCORRENTE = "Concorrente"
    SEM_INTERESSE = "Sem interesse / Momento inadequado"
    SEM_RETORNO = "Contato sem retorno / Desistência"
    FORA_PERFIL = "Fora do perfil / Escopo não atendido"
    OUTROS = "Outros"


# ─── Queue Schemas ───

class LeadQueueMemberResponse(BaseModel):
    id: UUID
    sales_team_id: UUID
    user_id: str
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    ordem_posicao: int
    ativo: bool
    ultima_atribuicao_em: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class LeadQueueOrderUpdate(BaseModel):
    member_ids_in_order: List[UUID]


class LeadQueueToggleActive(BaseModel):
    ativo: bool


# ─── Timeline Schemas ───

class LeadTimelineCreate(BaseModel):
    titulo: str = Field(..., min_length=2, max_length=255)
    descricao: Optional[str] = None
    tipo_evento: str = Field(default="ANDAMENTO")
    metadados: Optional[dict] = None


class LeadTimelineResponse(BaseModel):
    id: UUID
    lead_id: UUID
    user_id: Optional[str] = None
    user_name: Optional[str] = None
    tipo_evento: str
    titulo: str
    descricao: Optional[str] = None
    metadados: Optional[dict] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Task Schemas ───

class LeadTaskCreate(BaseModel):
    titulo: str = Field(..., min_length=2, max_length=255)
    descricao: Optional[str] = None
    tipo: str = Field(default="LIGACAO")  # LIGACAO, REUNIAO_PRESENCIAL, REUNIAO_ONLINE, EMAIL, WHATSAPP, VISITA, OUTRO
    data_agendamento: datetime
    hora_inicio: Optional[str] = None
    hora_fim: Optional[str] = None
    fuso_horario: Optional[str] = "America/Manaus"
    participantes: Optional[str] = None
    retroativo: bool = False
    user_id: Optional[str] = None  # Se omitido, atribui ao criador/responsável


class LeadTaskUpdate(BaseModel):
    titulo: Optional[str] = None
    descricao: Optional[str] = None
    tipo: Optional[str] = None
    data_agendamento: Optional[datetime] = None
    hora_inicio: Optional[str] = None
    hora_fim: Optional[str] = None
    fuso_horario: Optional[str] = None
    participantes: Optional[str] = None
    concluida: Optional[bool] = None
    resultado: Optional[str] = None
    user_id: Optional[str] = None


class LeadTaskResponse(BaseModel):
    id: UUID
    lead_id: UUID
    user_id: str
    user_name: Optional[str] = None
    titulo: str
    descricao: Optional[str] = None
    tipo: str
    data_agendamento: datetime
    hora_inicio: Optional[str] = None
    hora_fim: Optional[str] = None
    fuso_horario: Optional[str] = "America/Manaus"
    participantes: Optional[str] = None
    retroativo: bool = False
    concluida: bool
    concluida_em: Optional[datetime] = None
    resultado: Optional[str] = None
    google_event_id: Optional[str] = None
    google_sync_status: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Distribution History Schemas ───

class LeadDistributionHistoryResponse(BaseModel):
    id: UUID
    lead_id: UUID
    vendedor_id: str
    vendedor_name: Optional[str] = None
    tentativa_numero: int
    tipo_atribuicao: str
    data_atribuicao: datetime
    data_resposta: Optional[datetime] = None
    resultado: str
    motivo_recusa: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ─── Lead CRUD Schemas ───

class LeadBase(BaseModel):
    nome_contato: str = Field(..., min_length=2, max_length=255)
    razao_social: Optional[str] = None
    cpf_cnpj: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    cargo_contato: Optional[str] = None
    origem: str = Field(default="LIGACAO")
    canal: Optional[str] = None
    sales_team_id: Optional[UUID] = None
    observacoes: Optional[str] = None


class LeadCreate(LeadBase):
    tipo_distribuicao: str = Field(default="ROUND_ROBIN")  # DIRETA_VENDEDOR, DIRECIONADO_MANUAL, ROUND_ROBIN
    vendedor_especifico_id: Optional[str] = None  # Se preenchido pela Central com DIRECIONADO_MANUAL


class LeadUpdate(BaseModel):
    nome_contato: Optional[str] = None
    razao_social: Optional[str] = None
    cpf_cnpj: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    cargo_contato: Optional[str] = None
    origem: Optional[str] = None
    canal: Optional[str] = None
    sales_team_id: Optional[UUID] = None
    observacoes: Optional[str] = None


class LeadRejectRequest(BaseModel):
    motivo_recusa: Optional[str] = None


class LeadLossRequest(BaseModel):
    motivo_perda: str = Field(..., min_length=2)
    detalhes_perda: Optional[str] = None


class LeadConvertRequest(BaseModel):
    titulo_oportunidade: Optional[str] = None
    customer_id: Optional[str] = None
    # Dados para criar cliente se não fornecido customer_id:
    razao_social: Optional[str] = None
    nome_fantasia: Optional[str] = None
    cnpj: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None


class LeadSimpleResponse(BaseModel):
    id: UUID
    tenant_id: str
    company_id: UUID
    sales_team_id: Optional[UUID] = None
    sales_team_nome: Optional[str] = None

    nome_contato: str
    razao_social: Optional[str] = None
    cpf_cnpj: Optional[str] = None
    email: Optional[str] = None
    telefone: Optional[str] = None
    cargo_contato: Optional[str] = None

    origem: str
    canal: Optional[str] = None
    status: str
    tipo_distribuicao: str

    vendedor_atribuido_id: Optional[str] = None
    vendedor_atribuido_nome: Optional[str] = None
    vendedor_responsavel_id: Optional[str] = None
    vendedor_responsavel_nome: Optional[str] = None

    data_atribuicao: Optional[datetime] = None
    data_aceite: Optional[datetime] = None

    customer_id: Optional[str] = None
    customer_nome: Optional[str] = None
    sales_budget_id: Optional[UUID] = None
    sales_budget_numero: Optional[str] = None

    motivo_perda: Optional[str] = None
    detalhes_perda: Optional[str] = None
    observacoes: Optional[str] = None

    created_by_id: Optional[str] = None
    created_by_nome: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    # Flags calculadas
    tempo_restante_aceite_segundos: Optional[int] = None
    tem_cnpj: bool = False

    model_config = ConfigDict(from_attributes=True)


class LeadDetailResponse(LeadSimpleResponse):
    timeline: List[LeadTimelineResponse] = []
    tasks: List[LeadTaskResponse] = []
    distribution_history: List[LeadDistributionHistoryResponse] = []


class LeadMetricsResponse(BaseModel):
    total_leads: int = 0
    aguardando_aceite: int = 0
    meus_aguardando_aceite: int = 0
    assumidos_em_atendimento: int = 0
    convertidos: int = 0
    perdidos: int = 0
    taxa_conversao_pct: float = 0.0
