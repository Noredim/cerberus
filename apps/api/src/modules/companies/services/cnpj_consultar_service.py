import re
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException
from src.modules.companies.models import CnpjQueryCache, CompanyCnpjQueryLog
from src.modules.companies.providers.cnpj_provider import ICnpjProvider

def normalize_cnpj(cnpj: str) -> str:
    return "".join(filter(str.isdigit, cnpj))

def is_valid_cnpj(cnpj: str) -> bool:
    if len(cnpj) != 14:
        return False
    # Basic repeated digits check
    if len(set(cnpj)) == 1:
        return False
    return True

def map_receitaws_to_dto(raw: dict) -> dict:
    # Safely get first item of lists or raw string
    email = raw.get("email", "")
    telefone = raw.get("telefone", "")
    
    # Process CNAE Principal
    atividade_principal = raw.get("atividade_principal", [])
    primary_cnae = []
    if atividade_principal and len(atividade_principal) > 0:
        c = atividade_principal[0]
        primary_cnae.append({
            "codigo": normalize_cnpj(c.get("code", "")),  # strip non-digits if needed, actually just keep raw or remove '.' and '-'
            "descricao": c.get("text", ""),
            "tipoCnae": "PRINCIPAL"
        })
        
    # Process CNAEs Secundarios
    atividades_secundarias = raw.get("atividades_secundarias", [])
    sec_cnaes = []
    for c in atividades_secundarias:
        sec_cnaes.append({
            "codigo": normalize_cnpj(c.get("code", "")),
            "descricao": c.get("text", ""),
            "tipoCnae": "SECUNDARIO"
        })
        
    # Process QSA
    qsa_raw = raw.get("qsa", [])
    qsa_list = []
    for q in qsa_raw:
        qsa_list.append({
            "nome": q.get("nome", ""),
            "qualificacao": q.get("qual", ""),
            "pais_origem": q.get("pais_origem", ""),
            "nome_rep_legal": q.get("nome_rep_legal", ""),
            "qualificacao_rep_legal": q.get("qual_rep_legal", "")
        })

    # Capital Social formatting
    capital_social = raw.get("capital_social", "0.0")
    try:
        cs_float = float(capital_social)
    except:
        cs_float = 0.0

    return {
        "cnpj": normalize_cnpj(raw.get("cnpj", "")),
        "tipo": raw.get("tipo", "MATRIZ"),
        "razaoSocial": raw.get("nome", ""),
        "nomeFantasia": raw.get("fantasia", ""),
        "situacaoCadastral": raw.get("situacao", ""),
        "dataAbertura": raw.get("abertura", ""),
        "naturezaJuridica": raw.get("natureza_juridica", ""),
        "porte": raw.get("porte", ""),
        "capitalSocial": cs_float,
        "email": email,
        "telefone": telefone,
        "endereco": {
            "logradouro": raw.get("logradouro", ""),
            "numero": raw.get("numero", ""),
            "complemento": raw.get("complemento", ""),
            "bairro": raw.get("bairro", ""),
            "municipio": raw.get("municipio", ""),
            "uf": raw.get("uf", ""),
            "cep": normalize_cnpj(raw.get("cep", ""))
        },
        "atividadePrincipal": primary_cnae,
        "atividadesSecundarias": sec_cnaes,
        "qsa": qsa_list,
        "simples": raw.get("simples", {"optante": False}),
        "simei": raw.get("simei", {"optante": False})
    }

class ConsultarEmpresaPorCNPJService:
    def __init__(self, provider: ICnpjProvider, db: Session):
        self.provider = provider
        self.db = db

    async def execute(self, cnpj: str, tenant_id: str, user_id: str, force_refresh: bool = False):
        clean_cnpj = normalize_cnpj(cnpj)
        
        if not is_valid_cnpj(clean_cnpj):
            raise HTTPException(status_code=400, detail="CNPJ inválido.")

        # 1. Check cache
        if not force_refresh:
            cached = self.db.query(CnpjQueryCache).filter(
                CnpjQueryCache.cnpj == clean_cnpj,
                CnpjQueryCache.expires_at > datetime.utcnow()
            ).first()
            
            if cached:
                # Audit log for cache hit
                self._save_log(tenant_id, None, clean_cnpj, cached.provider, 200, "OK", 0, True, cached.response_body_json, cached.mapped_body_json, user_id)
                return self._format_response("CACHE", clean_cnpj, cached.mapped_body_json, cached.provider, cached.fetched_at.isoformat(), True, 0)

        # 2. Rate Limit Check
        await self.provider.check_rate_limit()

        # 3. Fetch from Provider
        start_time = datetime.utcnow()
        raw_response = {}
        provider_name = self.provider.__class__.__name__.replace("Provider", "").upper()
        try:
            raw_response = await self.provider.consultar(clean_cnpj)
            http_status = 200
            provider_status = "OK"
        except HTTPException as e:
            # Audit log for failure
            resp_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            self._save_log(tenant_id, None, clean_cnpj, provider_name, e.status_code, "ERROR", resp_time, False, {}, {}, user_id)
            raise e

        resp_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)

        # 4. Map DTO
        mapped_data = map_receitaws_to_dto(raw_response)

        # 5. Save Cache
        expires = datetime.utcnow() + timedelta(days=7)
        
        # update or create cache
        cache_entry = self.db.query(CnpjQueryCache).filter(CnpjQueryCache.cnpj == clean_cnpj).first()
        if cache_entry:
            cache_entry.response_body_json = raw_response
            cache_entry.mapped_body_json = mapped_data
            cache_entry.fetched_at = datetime.utcnow()
            cache_entry.expires_at = expires
            cache_entry.provider = provider_name
        else:
            cache_entry = CnpjQueryCache(
                cnpj=clean_cnpj,
                provider=provider_name,
                response_body_json=raw_response,
                mapped_body_json=mapped_data,
                fetched_at=datetime.utcnow(),
                expires_at=expires,
                status="OK"
            )
            self.db.add(cache_entry)

        # 6. Save Audit Log
        self._save_log(tenant_id, None, clean_cnpj, provider_name, http_status, provider_status, resp_time, False, raw_response, mapped_data, user_id)
        
        self.db.commit()

        return self._format_response("RECEITAWS", clean_cnpj, mapped_data, provider_name, datetime.utcnow().isoformat(), False, resp_time)

    def _save_log(self, tenant_id, company_id, cnpj, provider, http_status, p_status, resp_time, from_cache, raw, mapped, user_id):
        log = CompanyCnpjQueryLog(
            tenant_id=tenant_id,
            company_id=company_id,
            cnpj_consultado=cnpj,
            provider=provider,
            http_status=http_status,
            provider_status=p_status,
            response_time_ms=resp_time,
            from_cache=from_cache,
            response_body_json=raw,
            mapped_body_json=mapped,
            consulted_by_user_id=user_id
        )
        self.db.add(log)
        if from_cache: # For cache hits, we commit immediately because there's no major transaction block
            self.db.commit()

    def _format_response(self, source, requested_cnpj, normalized_data, provider_name, consulted_at, from_cache, response_time):
        return {
            "success": True,
            "source": source,
            "message": "Consulta realizada com sucesso.",
            "requestedCnpj": requested_cnpj,
            "normalizedData": normalized_data,
            "providerMeta": {
                "provider": provider_name,
                "consultedAt": consulted_at,
                "fromCache": from_cache,
                "responseTimeMs": response_time,
                "providerStatus": "OK",
                "providerMessage": ""
            }
        }
