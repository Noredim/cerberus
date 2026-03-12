import requests
import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from src.modules.utils.models.cep import CepCache
from src.modules.utils.schemas.cep import CepResult
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class CepLookupService:
    @staticmethod
    def lookup(cep: str, db: Session) -> CepResult:
        try:
            # Normalize
            cep = "".join(filter(str.isdigit, cep))
            if len(cep) != 8:
                raise HTTPException(status_code=422, detail="CEP inválido. Deve conter 8 dígitos.")

            # Check cache
            cache_limit = datetime.now(timezone.utc) - timedelta(days=90)
            try:
                cached = db.query(CepCache).filter(CepCache.cep == cep).first()
                logger.debug(f"Cache check for {cep}: {'Found' if cached else 'Not Found'}")
            except Exception as db_err:
                logger.error(f"Erro ao consultar cache de CEP: {db_err}")
                cached = None # Proceed to online lookup if cache fails
        
            if cached and cached.updated_at > cache_limit:
                logger.info(f"CEP {cep} encontrado no cache (válido)")
                return CepResult(
                    cep=cached.cep,
                    logradouro=cached.logradouro,
                    bairro=cached.bairro,
                    cidade=cached.cidade,
                    uf=cached.uf,
                    ibge=cached.ibge,
                    fonte=cached.fonte,
                    cache=True
                )

            # Consult ViaCEP
            try:
                logger.info(f"Consultando ViaCEP para {cep}")
                response = requests.get(f"https://viacep.com.br/ws/{cep}/json/", timeout=5)
                response.raise_for_status()
                data = response.json()
                logger.info(f"ViaCEP request for {cep} successful.")
                
                if data.get("erro"):
                    logger.warning(f"ViaCEP returned 'erro' for CEP {cep}.")
                    raise HTTPException(status_code=404, detail="CEP não encontrado.")
                
                # Upsert cache
                if not cached:
                    cached = CepCache(cep=cep)
                    db.add(cached)
                
                cached.logradouro = data.get("logradouro", "")
                cached.bairro = data.get("bairro", "")
                cached.cidade = data.get("localidade", "")
                cached.uf = data.get("uf", "")
                cached.ibge = data.get("ibge")
                cached.fonte = "viacep"
                cached.raw_json = data
                cached.updated_at = datetime.now(timezone.utc)
                
                db.commit()
                
                return CepResult(
                    cep=cep,
                    logradouro=cached.logradouro,
                    bairro=cached.bairro,
                    cidade=cached.cidade,
                    uf=cached.uf,
                    ibge=cached.ibge,
                    fonte="viacep",
                    cache=False
                )
            except requests.RequestException as e:
                if cached: # Return expired cache as fallback
                    return CepResult(
                        cep=cached.cep,
                        logradouro=cached.logradouro,
                        bairro=cached.bairro,
                        cidade=cached.cidade,
                        uf=cached.uf,
                        ibge=cached.ibge,
                        fonte=cached.fonte,
                        cache=True
                    )
                raise HTTPException(status_code=503, detail="Serviço de consulta de CEP indisponível.")
        except HTTPException:
            raise
        except Exception as e:
            logger.exception("Erro inesperado no lookup de CEP")
            raise HTTPException(status_code=500, detail=f"Erro interno no servidor: {str(e)}")
