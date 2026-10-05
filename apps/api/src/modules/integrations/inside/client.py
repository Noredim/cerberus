import time
import httpx
from typing import Dict, Any, Optional, Tuple


class InsideServiceClient:
    """
    Cliente HTTP para comunicação com a API Inside Service OnPremises (porta padrão 65191).
    Utiliza autenticação via Header HTTP 'Hash: <hash_token>'.
    """

    def __init__(
        self,
        base_url: str,
        hash_token: str,
        cod_unidade: Optional[int] = None,
        timeout: float = 15.0,
    ):
        clean_url = (base_url or "").strip().rstrip("/")
        if clean_url and not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            clean_url = f"http://{clean_url}"
        
        self.base_url = clean_url
        self.hash_token = (hash_token or "").strip()
        self.cod_unidade = cod_unidade
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "accept": "application/json",
            "Content-Type": "application/json",
            "Hash": self.hash_token,
            "User-Agent": "Cerberus-Inside-Engine/1.0",
        }

    def _execute_request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        json_data: Optional[Any] = None,
    ) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """
        Executa requisição HTTP com medição de latência em milissegundos.
        Retorna: (status_code, response_json, latency_ms, error_message)
        """
        url = f"{self.base_url}{path}"
        start_time = time.perf_counter()
        
        try:
            with httpx.Client(timeout=self.timeout, verify=False) as client:
                response = client.request(
                    method=method.upper(),
                    url=url,
                    headers=self._headers(),
                    params=params,
                    json=json_data,
                )
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                status_code = response.status_code
                
                try:
                    res_json = response.json()
                except Exception:
                    res_json = {"raw_text": response.text}

                error_msg = None
                if status_code >= 400:
                    if isinstance(res_json, dict):
                        error_msg = res_json.get("message") or str(res_json.get("notifications") or res_json)
                    else:
                        error_msg = response.text

                return status_code, res_json, latency_ms, error_msg

        except httpx.TimeoutException:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return 504, None, latency_ms, f"Timeout de conexão após {self.timeout}s com {self.base_url}"
        except httpx.ConnectError as ce:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return 502, None, latency_ms, f"Falha ao conectar com {self.base_url}: {str(ce)}"
        except Exception as ex:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return 500, None, latency_ms, f"Erro inesperado na integração: {str(ex)}"

    def test_connection(self) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """Consulta as configurações da unidade no Inside ERP para validar conectividade e token."""
        cod_unidade = self.cod_unidade or 0
        path = "/api/prospect-mobile/configuracoes"
        params = {"codUnidade": cod_unidade}
        return self._execute_request("GET", path, params=params)

    def consultar_clientes(
        self,
        documento: Optional[str] = None,
        cod_cliente: Optional[int] = None,
        nome: Optional[str] = None,
    ) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """Consulta clientes existentes por documento (CPF/CNPJ), código ou nome."""
        path = "/api/integracoes-terceiros/cliente/consultar-clientes"
        params: Dict[str, Any] = {
            "codUnidade": self.cod_unidade or 0,
            "pagina": 1,
            "tamanhoPagina": 10,
        }
        if documento:
            params["documento"] = documento
        if cod_cliente:
            params["codCliente"] = cod_cliente
        if nome:
            params["nome"] = nome

        return self._execute_request("GET", path, params=params)

    def listar_formas_pagamento(self) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """Lista as formas de pagamento disponíveis no ERP Inside."""
        path = "/api/integracoes-terceiros/forma-pagamento/listar-formas-pagamento"
        return self._execute_request("GET", path)

    def cadastrar_prospect(self, payload: Dict[str, Any]) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """POST /api/integracoes-terceiros/prospects/cadastrar-prospect"""
        path = "/api/integracoes-terceiros/prospects/cadastrar-prospect"
        return self._execute_request("POST", path, json_data=payload)

    def cadastrar_orcamento(self, payload: Dict[str, Any]) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """POST /api/integracoes-terceiros/orcamento/cadastrar-orcamento"""
        path = "/api/integracoes-terceiros/orcamento/cadastrar-orcamento"
        return self._execute_request("POST", path, json_data=payload)

    def vincular_produtos(self, payload: Dict[str, Any]) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """POST /api/integracoes-terceiros/orcamento/produto"""
        path = "/api/integracoes-terceiros/orcamento/produto"
        return self._execute_request("POST", path, json_data=payload)

    def vincular_servicos(self, payload: Dict[str, Any]) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """POST /api/integracoes-terceiros/orcamento/servico"""
        path = "/api/integracoes-terceiros/orcamento/servico"
        return self._execute_request("POST", path, json_data=payload)

    def gerar_antecipacao(self, payload: Dict[str, Any]) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """POST /api/integracoes-terceiros/orcamento/gerar-antecipacao"""
        path = "/api/integracoes-terceiros/orcamento/gerar-antecipacao"
        return self._execute_request("POST", path, json_data=payload)
