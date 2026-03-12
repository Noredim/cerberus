from pydantic import BaseModel
from typing import Optional

class CepResult(BaseModel):
    cep: str
    logradouro: str
    bairro: str
    cidade: str
    uf: str
    ibge: Optional[str] = None
    fonte: str = "viacep"
    cache: bool = False
