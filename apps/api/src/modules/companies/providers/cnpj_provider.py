import abc
from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ICnpjProvider(abc.ABC):
    @abc.abstractmethod
    async def consultar(self, cnpj: str) -> Dict[str, Any]:
        """Fetch raw CNPJ data from the external provider."""
        pass
        
    @abc.abstractmethod
    async def check_rate_limit(self) -> None:
        """Check and enforce provider-specific rate limits."""
        pass

import httpx
from fastapi import HTTPException
import asyncio

class ReceitaWsProvider(ICnpjProvider):
    def __init__(self):
        self.base_url = "https://www.receitaws.com.br/v1/cnpj/"
        self.timeout = httpx.Timeout(10.0)
        
    async def consultar(self, cnpj: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                # ReceitaWS only accepts 14 digits
                response = await client.get(f"{self.base_url}{cnpj}")
                response.raise_for_status()
                data = response.json()
                
                if data.get("status") == "ERROR":
                    raise HTTPException(status_code=400, detail=data.get("message", "Erro na consulta ReceitaWS"))
                    
                return data
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    raise HTTPException(status_code=429, detail="Limite de consultas excedido na ReceitaWS. Tente novamente em 1 minuto.")
                raise HTTPException(status_code=e.response.status_code, detail=f"Erro do Provedor ReceitaWS: {str(e)}")
            except httpx.RequestError as e:
                # Retry logic or simple exception for MVP
                raise HTTPException(status_code=503, detail="Serviço da ReceitaWS indisponível.")
                
    async def check_rate_limit(self) -> None:
        # MVP: No Redis rate limiting implemented yet. We rely on the 429 catch above.
        # Future: Implement a token bucket or short sleep queue per provider here.
        pass
