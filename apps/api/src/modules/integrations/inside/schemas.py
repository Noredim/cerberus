from typing import Optional, List, Any, Dict
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class IntegrationLogRead(BaseModel):
    id: UUID
    company_id: UUID
    integration_type: str
    endpoint: str
    http_method: str
    status_code: Optional[int] = None
    request_payload: Optional[Any] = None
    response_payload: Optional[Any] = None
    execution_time_ms: Optional[int] = None
    error_message: Optional[str] = None
    user_id: Optional[UUID] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class IntegrationLogsPaginated(BaseModel):
    items: List[IntegrationLogRead]
    total: int
    page: int
    size: int


class InsideTestConnectionResponse(BaseModel):
    success: bool
    status_code: int
    message: str
    latency_ms: int
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class InsideMappingCheckItem(BaseModel):
    tipo: str  # CLIENTE, PRODUTO, SERVICO, VENDEDOR, FORMA_PAGAMENTO
    item_id: Optional[str] = None
    nome_descricao: str
    codigo_service: Optional[int] = None
    status: str  # OK, PENDENTE
    mensagem: Optional[str] = None


class InsideDryRunResponse(BaseModel):
    is_valid: bool
    status_conexao: bool
    mensagem: str
    itens_analisados: int
    itens_pendentes: int
    checklist: List[InsideMappingCheckItem]
    payloads: Dict[str, Any]
