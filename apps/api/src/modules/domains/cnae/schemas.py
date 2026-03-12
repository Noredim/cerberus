from pydantic import BaseModel, Field
from typing import List, Optional

class CnaeDomainBase(BaseModel):
    codigo: str = Field(..., description="Código do CNAE")
    descricao: str = Field(..., description="Descrição completa da atividade econômica")

    class Config:
        from_attributes = True

class PaginatedCnaeResponse(BaseModel):
    items: List[CnaeDomainBase]
    limit: int
    offset: int
    total: int
