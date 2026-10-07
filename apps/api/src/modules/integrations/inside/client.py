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
        
        # Remove trailing /api if user added it to prevent /api/api/...
        if clean_url.endswith("/api"):
            clean_url = clean_url[:-4].rstrip("/")

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
        """
        Valida conectividade e autenticação via Header 'Hash: <token>'
        utilizando o endpoint padrão da API IntegracoesTerceiros.
        """
        path = "/api/integracoes-terceiros/forma-pagamento/listar-formas-pagamento"
        return self._execute_request("GET", path)

    def consultar_clientes(
        self,
        documento: Optional[str] = None,
        cod_cliente: Optional[int] = None,
        nome: Optional[str] = None,
        pagina: int = 1,
        tamanho_pagina: int = 50,
    ) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """Consulta clientes existentes por documento (CPF/CNPJ), código ou nome."""
        path = "/api/integracoes-terceiros/cliente/consultar-clientes"
        params: Dict[str, Any] = {
            "pagina": pagina,
            "tamanhoPagina": tamanho_pagina,
        }
        if self.cod_unidade is not None:
            params["codUnidade"] = self.cod_unidade
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

    def listar_produtos(
        self,
        pagina: int = 1,
        tamanho_pagina: int = 50,
        descricao: Optional[str] = None,
        cod_produto: Optional[str] = None,
    ) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """Lista os produtos cadastrados de forma paginada."""
        path = "/api/integracoes-terceiros/produtos"
        params: Dict[str, Any] = {
            "pagina": pagina,
            "tamanhoPagina": tamanho_pagina,
        }
        if descricao:
            params["descricao"] = descricao
        if cod_produto:
            params["codProduto"] = cod_produto

        return self._execute_request("GET", path, params=params)

    def listar_servicos(
        self,
        pagina: int = 1,
        tamanho_pagina: int = 50,
        descricao: Optional[str] = None,
        cod_servico: Optional[str] = None,
    ) -> Tuple[int, Optional[Dict[str, Any]], int, Optional[str]]:
        """Lista os serviços cadastrados de forma paginada."""
        path = "/api/integracoes-terceiros/servicos"
        params: Dict[str, Any] = {
            "pagina": pagina,
            "tamanhoPagina": tamanho_pagina,
        }
        if descricao:
            params["descricao"] = descricao
        if cod_servico:
            params["codServico"] = cod_servico

        return self._execute_request("GET", path, params=params)

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


class InsideEstoqueClient:
    """
    Cliente HTTP para consulta de Estoque, Preços e Custos em Tempo Real (porta 44923).
    Utiliza autenticação via Header HTTP 'X-API-KEY: <api_key>'.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str,
        empresa_id: Optional[str] = None,
        tipo_padrao: Optional[str] = "NOVOS",
        timeout: float = 12.0,
    ):
        clean_url = (base_url or "").strip().rstrip("/")
        if clean_url and not clean_url.startswith("http://") and not clean_url.startswith("https://"):
            clean_url = f"http://{clean_url}"
        
        self.base_url = clean_url
        self.api_key = (api_key or "").strip()
        self.empresa_id = str(empresa_id).strip() if empresa_id is not None and str(empresa_id).strip() else None
        self.tipo_padrao = tipo_padrao or "NOVOS"
        self.timeout = timeout

    def _headers(self) -> Dict[str, str]:
        return {
            "accept": "application/json",
            "X-API-KEY": self.api_key,
            "User-Agent": "Cerberus-Estoque-Engine/1.0",
        }

    def _get_target_url(self) -> str:
        url = self.base_url
        if not url.endswith("/consulta-produto") and "/api/" not in url:
            url = f"{url}/api/consulta-produto"
        elif not url.endswith("/consulta-produto") and url.endswith("/api"):
            url = f"{url}/consulta-produto"
        return url

    def test_connection(self) -> Tuple[int, Optional[Any], int, Optional[str]]:
        """Testa a conectividade com a API de estoque e a validade da X-API-KEY."""
        target_url = self._get_target_url()
        start_time = time.perf_counter()
        try:
            with httpx.Client(timeout=self.timeout, verify=False) as client:
                response = client.get(target_url, headers=self._headers(), params={"nome": "teste"})
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                if response.is_success:
                    try:
                        data = response.json()
                        return response.status_code, {"total_retornado": len(data) if isinstance(data, list) else 1}, latency_ms, None
                    except Exception:
                        return response.status_code, {"raw_text": response.text[:200]}, latency_ms, None
                else:
                    return response.status_code, None, latency_ms, f"HTTP {response.status_code}: {response.text[:200]}"
        except Exception as exc:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return 0, None, latency_ms, str(exc)

    def consultar(
        self,
        nome: Optional[str] = None,
        cod_produto: Optional[str] = None,
        tipo_estoque: Optional[str] = None,
    ) -> Tuple[int, Optional[Any], int, Optional[str]]:
        """Consulta produtos, estoques, custos e preços na API de tempo real."""
        target_url = self._get_target_url()
        params: Dict[str, Any] = {}
        if nome:
            params["nome"] = nome.strip()

        start_time = time.perf_counter()
        try:
            with httpx.Client(timeout=self.timeout, verify=False) as client:
                response = client.get(target_url, headers=self._headers(), params=params)
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                if response.is_success:
                    data = response.json()
                    if isinstance(data, list):
                        # Filtrar por empresa se configurada
                        if self.empresa_id:
                            data = [d for d in data if str(d.get("empresa")) == str(self.empresa_id)]
                        # Filtrar por tipo de estoque se solicitado
                        target_tipo = (tipo_estoque or self.tipo_padrao or "").upper()
                        if target_tipo and target_tipo != "TODOS":
                            data = [d for d in data if str(d.get("tipoEstoque", "")).upper() == target_tipo]
                        # Filtrar por codProduto se fornecido
                        if cod_produto:
                            data = [d for d in data if str(d.get("codProduto")) == str(cod_produto)]
                    return response.status_code, data, latency_ms, None
                else:
                    return response.status_code, None, latency_ms, f"HTTP {response.status_code}: {response.text[:200]}"
        except Exception as exc:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            return 0, None, latency_ms, str(exc)

