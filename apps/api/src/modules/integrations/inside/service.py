import uuid
from typing import Optional, List, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, timezone
import unicodedata
import re
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from src.modules.companies.models import Company, CompanyInsideConfig
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem
from src.modules.products.models import Product, ProductInsideStock
from src.modules.customers.models import Customer
from src.modules.professionals.models import Professional
from src.modules.payment_methods.models import FormaPagamento, FormaPagamentoParcela
from .models import IntegrationLog
from .client import InsideServiceClient, InsideEstoqueClient
from .schemas import (
    InsideTestConnectionResponse,
    InsideDryRunResponse,
    InsideMappingCheckItem,
    IntegrationLogsPaginated,
    IntegrationLogRead,
)


class InsideIntegrationService:

    @staticmethod
    def get_config(db: Session, company_id: UUID) -> CompanyInsideConfig:
        config = db.query(CompanyInsideConfig).filter(CompanyInsideConfig.company_id == company_id).first()
        if not config:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integração Inside ERP não configurada para esta empresa."
            )
        return config

    @staticmethod
    def get_client(
        db: Session, 
        company_id: UUID, 
        target_env: str = "DEFAULT", 
        allow_inactive: bool = False
    ) -> InsideServiceClient:
        config = InsideIntegrationService.get_config(db, company_id)
        target_env = (target_env or "DEFAULT").upper()

        if target_env == "SERVICOS":
            base_url = config.servicos_base_url or config.base_url
            hash_token = config.servicos_hash_token or config.hash_token
            cod_unidade = config.servicos_cod_unidade if config.servicos_cod_unidade is not None else config.cod_unidade
            is_active = config.servicos_is_active if config.servicos_base_url else config.is_active
            env_name = "Base de Serviços (Ambiente A)"
        elif target_env == "PRODUTOS":
            base_url = config.produtos_base_url or config.base_url
            hash_token = config.produtos_hash_token or config.hash_token
            cod_unidade = config.produtos_cod_unidade if config.produtos_cod_unidade is not None else config.cod_unidade
            is_active = config.produtos_is_active if config.produtos_base_url else config.is_active
            env_name = "Base de Produtos (Ambiente B)"
        else:
            base_url = config.base_url or config.servicos_base_url or config.produtos_base_url
            hash_token = config.hash_token or config.servicos_hash_token or config.produtos_hash_token
            cod_unidade = config.cod_unidade if config.cod_unidade is not None else (config.servicos_cod_unidade or config.produtos_cod_unidade)
            is_active = config.is_active or config.servicos_is_active or config.produtos_is_active
            env_name = "Ambiente Geral"

        if not is_active and not allow_inactive:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Integração do {env_name} está inativa nas configurações da empresa."
            )
        if not base_url or not hash_token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"URL Base e Hash Token do {env_name} são obrigatórios."
            )

        return InsideServiceClient(
            base_url=base_url,
            hash_token=hash_token,
            cod_unidade=cod_unidade,
        )

    @staticmethod
    def get_estoque_client(
        db: Session,
        company_id: UUID,
        allow_inactive: bool = False
    ) -> InsideEstoqueClient:
        config = InsideIntegrationService.get_config(db, company_id)
        if not config.estoque_is_active and not allow_inactive:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Integração de Consulta de Estoque em Tempo Real está inativa nas configurações da empresa."
            )
        if not config.estoque_base_url or not config.estoque_api_key:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="URL Base e Chave X-API-KEY da API de Estoque são obrigatórias."
            )
        return InsideEstoqueClient(
            base_url=config.estoque_base_url,
            api_key=config.estoque_api_key,
            empresa_id=config.estoque_cod_empresa,
            tipo_padrao=config.estoque_tipo_padrao or "NOVOS",
        )

    @staticmethod
    def log_request(
        db: Session,
        company_id: UUID,
        endpoint: str,
        http_method: str,
        status_code: int,
        request_payload: Optional[Any] = None,
        response_payload: Optional[Any] = None,
        latency_ms: Optional[int] = None,
        error_message: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> IntegrationLog:
        try:
            log_entry = IntegrationLog(
                id=uuid.uuid4(),
                company_id=company_id,
                integration_type="INSIDE_ERP",
                endpoint=endpoint,
                http_method=http_method,
                status_code=status_code,
                request_payload=request_payload,
                response_payload=response_payload,
                execution_time_ms=latency_ms,
                error_message=error_message,
                user_id=user_id,
                created_at=datetime.utcnow(),
            )
            db.add(log_entry)
            db.commit()
            db.refresh(log_entry)
            return log_entry
        except Exception as e:
            db.rollback()
            print(f"[INTEGRATION LOG ERROR] Failed to save log: {e}")
            return None

    @staticmethod
    def test_connection(
        db: Session,
        company_id: UUID,
        target_env: str = "DEFAULT",
        user_id: Optional[UUID] = None,
    ) -> InsideTestConnectionResponse:
        target_env = (target_env or "DEFAULT").upper()
        env_label = "Base de Serviços (A)" if target_env == "SERVICOS" else ("Base de Produtos (B)" if target_env == "PRODUTOS" else "Inside ERP")

        try:
            client = InsideIntegrationService.get_client(db, company_id, target_env=target_env, allow_inactive=True)
        except HTTPException as he:
            return InsideTestConnectionResponse(
                success=False,
                status_code=he.status_code,
                message=he.detail,
                latency_ms=0,
                error=he.detail,
            )

        status_code, res_json, latency_ms, error_msg = client.test_connection()
        success = (status_code == 200)

        # Gravar log de auditoria com identificador do ambiente
        InsideIntegrationService.log_request(
            db=db,
            company_id=company_id,
            endpoint=f"[{target_env}] /api/integracoes-terceiros/forma-pagamento/listar-formas-pagamento",
            http_method="GET",
            status_code=status_code,
            request_payload={"codUnidade": client.cod_unidade, "target_env": target_env, "base_url": client.base_url},
            response_payload=res_json,
            latency_ms=latency_ms,
            error_message=error_msg,
            user_id=user_id,
        )

        msg = f"Conexão com {env_label} estabelecida com sucesso!" if success else f"Falha na conexão com {env_label}: {error_msg or 'Erro desconhecido'}"
        return InsideTestConnectionResponse(
            success=success,
            status_code=status_code,
            message=msg,
            latency_ms=latency_ms,
            data=res_json,
            error=error_msg,
        )

    @staticmethod
    def test_estoque_connection(
        db: Session,
        company_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> InsideTestConnectionResponse:
        try:
            client = InsideIntegrationService.get_estoque_client(db, company_id, allow_inactive=True)
        except HTTPException as he:
            return InsideTestConnectionResponse(
                success=False,
                status_code=he.status_code,
                message=he.detail,
                latency_ms=0,
                error=he.detail,
            )

        status_code, res_json, latency_ms, error_msg = client.test_connection()
        success = (status_code == 200)

        InsideIntegrationService.log_request(
            db=db,
            company_id=company_id,
            endpoint="[ESTOQUE_REALTIME] /api/consulta-produto",
            http_method="GET",
            status_code=status_code,
            request_payload={"base_url": client.base_url, "empresa_id": client.empresa_id},
            response_payload=res_json,
            latency_ms=latency_ms,
            error_message=error_msg,
            user_id=user_id,
        )

        msg = "Conexão com API de Estoque & Custos (Tempo Real) estabelecida com sucesso!" if success else f"Falha na conexão com API de Estoque: {error_msg or 'Erro desconhecido'}"
        return InsideTestConnectionResponse(
            success=success,
            status_code=status_code,
            message=msg,
            latency_ms=latency_ms,
            data=res_json,
            error=error_msg,
        )

    KNOWN_BRANDS = [
        ("INTELBRAS", "INTELBRAS"),
        ("HIKVISION", "HIKVISION"),
        ("TP-LINK", "TP-LINK"),
        ("TPLINK", "TP-LINK"),
        ("CAMBIUM", "CAMBIUM"),
        ("MIKROTIK", "MIKROTIK"),
        ("PPA", "PPA"),
        ("JFL", "JFL"),
        ("SYSTIMAX", "SYSTIMAX"),
        ("SEAGATE", "SEAGATE"),
        ("WESTERN DIGITAL", "WESTERN DIGITAL"),
        ("WD", "WESTERN DIGITAL"),
        ("MOURA", "MOURA"),
        ("APC", "APC"),
        ("ELGIN", "ELGIN"),
        ("CISER", "CISER"),
        ("CORTAG", "CORTAG"),
        ("VONDER", "VONDER"),
        ("BESTFER", "BESTFER"),
        ("GAYA", "GAYA"),
        ("PRATIK", "PRATIK"),
        ("KAISE", "KAISE"),
        ("MEGATRON", "MEGATRON"),
        ("FIBERHOME", "FIBERHOME"),
        ("MAXMETAL", "MAXMETAL"),
        ("PANTANEIRO", "PANTANEIRO"),
        ("INCA", "INCA"),
        ("JOMARCA", "JOMARCA"),
        ("SYLC", "SYLC"),
        ("RUIJIE", "RUIJIE"),
        ("TOSHIBA", "TOSHIBA"),
        ("TOSCHIBA", "TOSHIBA"),
        ("LENOVO", "LENOVO"),
        ("MOTOROLA", "MOTOROLA"),
        ("QUALITRONIX", "QUALITRONIX"),
    ]

    @staticmethod
    def extract_brand_manufacturer(desc: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
        if not desc:
            return None, None
        d_upper = desc.upper()
        for brand_key, brand_name in InsideIntegrationService.KNOWN_BRANDS:
            pattern = r'\b' + re.escape(brand_key) + r'\b'
            if re.search(pattern, d_upper):
                return brand_name, brand_name
        return None, None

    @staticmethod
    def consultar_estoque_realtime(
        db: Session,
        company_id: UUID,
        nome: Optional[str] = None,
        cod_produto: Optional[str] = None,
        tipo_estoque: Optional[str] = None,
        user_id: Optional[UUID] = None,
    ) -> List[Dict[str, Any]]:
        client = InsideIntegrationService.get_estoque_client(db, company_id, allow_inactive=False)
        status_code, data, latency_ms, error_msg = client.consultar(
            nome=nome,
            cod_produto=cod_produto,
            tipo_estoque=tipo_estoque,
        )
        if status_code != 200 or data is None:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY if status_code == 0 else status_code,
                detail=f"Erro ao consultar API de estoque: {error_msg or 'Resposta inválida do servidor'}"
            )
        items = data if isinstance(data, list) else [data]
        for it in items:
            marca, fab = InsideIntegrationService.extract_brand_manufacturer(it.get("descricao"))
            it["marca"] = marca
            it["fabricante"] = fab
        return items

    @staticmethod
    def list_logs(
        db: Session,
        company_id: UUID,
        page: int = 1,
        size: int = 20,
    ) -> IntegrationLogsPaginated:
        query = db.query(IntegrationLog).filter(
            IntegrationLog.company_id == company_id,
            IntegrationLog.integration_type == "INSIDE_ERP",
        ).order_by(IntegrationLog.created_at.desc())

        total = query.count()
        items = query.offset((page - 1) * size).limit(size).all()

        return IntegrationLogsPaginated(
            items=[IntegrationLogRead.model_validate(item) for item in items],
            total=total,
            page=page,
            size=size,
        )

    @staticmethod
    def sync_formas_pagamento(
        db: Session,
        company_id: UUID,
        user_id: Optional[UUID] = None,
        target_env: str = "SERVICOS"
    ) -> Dict[str, Any]:
        """
        Consulta as formas de pagamento disponíveis no Inside ERP,
        cadastra novas formas no Cerberus e correlaciona as existentes (pelo codigo_service ou descrição).
        """
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")

        client = InsideIntegrationService.get_client(db, company_id, target_env=target_env, allow_inactive=True)
        status_code, res_json, latency_ms, error_msg = client.listar_formas_pagamento()

        # Gravar log de auditoria
        InsideIntegrationService.log_request(
            db=db,
            company_id=company_id,
            endpoint=f"[{target_env}] /api/integracoes-terceiros/forma-pagamento/listar-formas-pagamento",
            http_method="GET",
            status_code=status_code,
            request_payload={"target_env": target_env, "base_url": client.base_url},
            response_payload=res_json,
            latency_ms=latency_ms,
            error_message=error_msg,
            user_id=user_id,
        )

        if status_code != 200 or not res_json:
            detail = error_msg or f"Falha ao consultar formas de pagamento no Inside ERP (HTTP {status_code})."
            if isinstance(res_json, dict) and "raw_text" in res_json and "<!doctype html>" in str(res_json["raw_text"]).lower():
                detail = f"A URL configurada ({client.base_url}) respondeu como interface web (HTML) e não como API JSON do Inside Service (porta padrão 65191)."
            raise HTTPException(status_code=status_code if status_code >= 400 else 500, detail=detail)

        # Tratar formato retornado pelo Inside ERP
        items_data = []
        if isinstance(res_json, list):
            items_data = res_json
        elif isinstance(res_json, dict):
            if isinstance(res_json.get("data"), list):
                items_data = res_json["data"]
            elif isinstance(res_json.get("formasPagamento"), list):
                items_data = res_json["formasPagamento"]
            elif isinstance(res_json.get("itens"), list):
                items_data = res_json["itens"]
            elif "raw_text" in res_json and "<!doctype html>" in str(res_json["raw_text"]).lower():
                raise HTTPException(
                    status_code=400,
                    detail=f"A URL configurada ({client.base_url}) respondeu como interface web (HTML) e não como API JSON do Inside Service (porta padrão 65191)."
                )

        if not items_data:
            return {
                "success": True,
                "total_processados": 0,
                "total_criados": 0,
                "total_atualizados": 0,
                "itens": [],
                "mensagem": "Nenhuma forma de pagamento retornada pelo Inside ERP."
            }

        total_criados = 0
        total_atualizados = 0
        synced_items = []

        for item in items_data:
            codigo = (
                item.get("codigoFormaPagamento") 
                or item.get("codFormaPagamento") 
                or item.get("codigo") 
                or item.get("formaPagamento") 
                or item.get("id") 
                or item.get("codForma")
            )
            descricao = item.get("descricao") or item.get("nome") or item.get("nomeFormaPagamento") or item.get("descricaoFormaPagamento") or f"Forma {codigo}"
            
            if codigo is not None:
                try:
                    codigo = int(codigo)
                except Exception:
                    pass

            descricao = str(descricao).strip()

            db_forma = None
            if codigo is not None:
                db_forma = db.query(FormaPagamento).filter(
                    FormaPagamento.tenant_id == company.tenant_id,
                    FormaPagamento.codigo_service == codigo
                ).first()
            
            if not db_forma:
                db_forma = db.query(FormaPagamento).filter(
                    FormaPagamento.tenant_id == company.tenant_id,
                    FormaPagamento.descricao.ilike(descricao)
                ).first()

            if db_forma:
                db_forma.codigo_service = codigo
                db_forma.ativo = True
                total_atualizados += 1
                action = "ATUALIZADO"
            else:
                db_forma = FormaPagamento(
                    id=uuid.uuid4(),
                    tenant_id=company.tenant_id,
                    descricao=descricao,
                    codigo_service=codigo,
                    tipo_uso="AMBOS",
                    tipo_distribuicao="PERCENTUAL",
                    taxa_juros_mensal=Decimal("0.000000"),
                    ativo=True,
                    is_default=False,
                    observacao="Importado automaticamente do ERP Inside"
                )
                db.add(db_forma)
                db.flush()

                parcelas_raw = item.get("parcelas") or item.get("condicoes") or []
                if isinstance(parcelas_raw, list) and len(parcelas_raw) > 0:
                    for idx, p in enumerate(parcelas_raw, start=1):
                        dias = int(p.get("dias") or p.get("intervaloDias") or 0)
                        perc = Decimal(str(p.get("percentual") or p.get("porcentagem") or (100.0 / len(parcelas_raw))))
                        desc_p = str(p.get("descricao") or f"{idx}ª Parcela ({dias} dias)")
                        db_p = FormaPagamentoParcela(
                            id=uuid.uuid4(),
                            forma_pagamento_id=db_forma.id,
                            sequencia=idx,
                            descricao=desc_p,
                            intervalo_dias=dias,
                            percentual=perc
                        )
                        db.add(db_p)
                else:
                    db_p = FormaPagamentoParcela(
                        id=uuid.uuid4(),
                        forma_pagamento_id=db_forma.id,
                        sequencia=1,
                        descricao="1ª Parcela",
                        intervalo_dias=0,
                        percentual=Decimal("100.0000")
                    )
                    db.add(db_p)

                total_criados += 1
                action = "CRIADO"

            synced_items.append({
                "id": str(db_forma.id),
                "codigo_service": codigo,
                "descricao": descricao,
                "acao": action
            })

        db.commit()

        return {
            "success": True,
            "total_processados": len(items_data),
            "total_criados": total_criados,
            "total_atualizados": total_atualizados,
            "itens": synced_items,
            "mensagem": f"Sincronização concluída: {total_criados} formas criadas e {total_atualizados} correlacionadas com sucesso."
        }

    @staticmethod
    def dry_run_sales_budget(
        db: Session,
        company_id: UUID,
        budget_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> InsideDryRunResponse:
        # 1. Carregar orçamento
        budget = db.query(SalesBudget).filter(
            SalesBudget.id == budget_id,
            SalesBudget.company_id == company_id,
        ).first()

        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Orçamento de venda não encontrado."
            )

        # 2. Obter configuração do Inside (se existir)
        config = db.query(CompanyInsideConfig).filter(CompanyInsideConfig.company_id == company_id).first()
        is_config_active = bool(config and config.is_active and config.base_url and config.hash_token)
        cod_unidade = config.cod_unidade if (config and config.cod_unidade is not None) else 0

        checklist: List[InsideMappingCheckItem] = []

        # 3. Validar Cliente
        customer = budget.customer
        if customer:
            tem_codigo = bool(customer.codigo_cliente_service)
            checklist.append(InsideMappingCheckItem(
                tipo="CLIENTE",
                item_id=str(customer.id),
                nome_descricao=customer.razao_social or customer.nome_fantasia or "Cliente",
                codigo_service=customer.codigo_cliente_service,
                status="OK" if tem_codigo else "OK", # Se não tiver codigo_cliente_service, será cadastrado como Prospect
                mensagem="Cliente com código direto no Inside" if tem_codigo else "Será cadastrado automaticamente como Prospect",
            ))
        else:
            checklist.append(InsideMappingCheckItem(
                tipo="CLIENTE",
                item_id=None,
                nome_descricao="Cliente não associado",
                codigo_service=None,
                status="PENDENTE",
                mensagem="Orçamento não possui cliente vinculado",
            ))

        # 4. Validar Vendedor / Responsável
        vendedor = budget.vendedor
        if vendedor:
            tem_codigo = bool(vendedor.codigo_service)
            checklist.append(InsideMappingCheckItem(
                tipo="VENDEDOR",
                item_id=str(vendedor.id),
                nome_descricao=vendedor.nome,
                codigo_service=vendedor.codigo_service,
                status="OK" if tem_codigo else "PENDENTE",
                mensagem="Vendedor correlacionado" if tem_codigo else "Vendedor sem 'codigo_service' cadastrado",
            ))
        else:
            checklist.append(InsideMappingCheckItem(
                tipo="VENDEDOR",
                item_id=None,
                nome_descricao="Vendedor não selecionado",
                codigo_service=None,
                status="PENDENTE",
                mensagem="Vendedor obrigatório para o Inside ERP",
            ))

        # 5. Validar Forma de Pagamento
        forma_pagamento = budget.forma_pagamento
        if forma_pagamento:
            tem_codigo = bool(forma_pagamento.codigo_service)
            checklist.append(InsideMappingCheckItem(
                tipo="FORMA_PAGAMENTO",
                item_id=str(forma_pagamento.id),
                nome_descricao=forma_pagamento.nome,
                codigo_service=forma_pagamento.codigo_service,
                status="OK" if tem_codigo else "PENDENTE",
                mensagem="Forma de pagamento correlacionada" if tem_codigo else "Forma de pagamento sem 'codigo_service'",
            ))
        else:
            checklist.append(InsideMappingCheckItem(
                tipo="FORMA_PAGAMENTO",
                item_id=None,
                nome_descricao="Forma de pagamento não definida",
                codigo_service=None,
                status="PENDENTE",
                mensagem="Forma de pagamento obrigatória para o Inside ERP",
            ))

        # 6. Validar Itens (Produtos e Serviços)
        produtos_list = []
        servicos_list = []

        for item in budget.items:
            if item.tipo_item == "PRODUTO" or item.product_id:
                prod = item.product
                nome = prod.nome if prod else (item.descricao_servico or "Produto")
                cod_service = prod.codigo_service if prod else None
                tem_codigo = bool(cod_service)
                checklist.append(InsideMappingCheckItem(
                    tipo="PRODUTO",
                    item_id=str(item.id),
                    nome_descricao=f"{nome} (Qtd: {item.quantidade})",
                    codigo_service=cod_service,
                    status="OK" if tem_codigo else "PENDENTE",
                    mensagem="Produto correlacionado" if tem_codigo else "Produto sem 'codigo_service' no catálogo",
                ))
                produtos_list.append({
                    "codProduto": cod_service or 0,
                    "descricao": nome,
                    "quantidade": float(item.quantidade or 1),
                    "unitario": float(item.preco_unitario or 0),
                    "cobraLocado": False,
                })
            else:
                # Serviço
                nome = item.descricao_servico or "Serviço"
                cod_service = None
                # Se houver serviço próprio associado futuramente
                checklist.append(InsideMappingCheckItem(
                    tipo="SERVICO",
                    item_id=str(item.id),
                    nome_descricao=f"{nome} (Qtd: {item.quantidade})",
                    codigo_service=cod_service,
                    status="OK" if cod_service else "PENDENTE",
                    mensagem="Serviço correlacionado" if cod_service else "Serviço sem 'codigo_service'",
                ))
                servicos_list.append({
                    "codServico": cod_service or 0,
                    "quantidade": float(item.quantidade or 1),
                    "unitario": float(item.preco_unitario or 0),
                })

        # 7. Montar os Payloads Simulados
        dt_emissao = (budget.data_orcamento or datetime.utcnow()).strftime("%Y-%m-%dT00:00:00")
        dt_vencimento = (budget.data_vencimento_inicial or budget.data_orcamento or datetime.utcnow()).strftime("%Y-%m-%dT00:00:00")

        prospect_payload = {
            "prospects": [
                {
                    "codUnidade": cod_unidade,
                    "nome": customer.razao_social if customer else "Cliente Cerberus",
                    "cpf": (customer.cpf_cnpj or "") if customer else "",
                    "codCliente": (customer.codigo_cliente_service or 0) if customer else 0,
                    "email": (customer.email or "") if customer else "",
                    "fone1": ((customer.telefone or customer.celular) or "") if customer else "",
                    "endereco": (customer.logradouro or "") if customer else "",
                    "numCasa": (customer.numero or "") if customer else "",
                    "bairro": (customer.bairro or "") if customer else "",
                    "estado": (customer.uf or "") if customer else "",
                    "cidade": (customer.municipio or "") if customer else "",
                    "cep": (customer.cep or "") if customer else "",
                    "vendedor": (vendedor.codigo_service if vendedor and vendedor.codigo_service else 0),
                }
            ]
        }

        orcamento_payload = {
            "codUnidade": cod_unidade,
            "empresa": 1,
            "codProspect": 0,
            "titulo": budget.titulo or f"Orçamento Cerberus #{budget.numero_orcamento or ''}",
            "modalidade": "V",
            "vendedor": vendedor.codigo_service if vendedor and vendedor.codigo_service else 0,
            "formaPagamento": forma_pagamento.codigo_service if forma_pagamento and forma_pagamento.codigo_service else 0,
            "validade": dt_vencimento,
            "emissao": dt_emissao,
        }

        produtos_payload = {
            "codInternoOrcamento": 0,
            "produtos": produtos_list,
        }

        servicos_payload = {
            "codInternoOrcamento": 0,
            "servicos": servicos_list,
        }

        antecipacao_payload = {
            "codUnidade": cod_unidade,
            "orcamentoPlanilha": 0,
            "formaPagamento": forma_pagamento.codigo_service if forma_pagamento and forma_pagamento.codigo_service else 0,
            "centroResultados": 0,
            "parcelas": [
                {
                    "dataVencimento": dt_vencimento,
                    "valorParcela": float(budget.valor_total or 0),
                }
            ],
        }

        total_itens = len(checklist)
        itens_pendentes = sum(1 for item in checklist if item.status == "PENDENTE")
        is_valid = (itens_pendentes == 0)

        # Gravar log da simulação Dry-Run
        InsideIntegrationService.log_request(
            db=db,
            company_id=company_id,
            endpoint="/dry-run/sales-budget",
            http_method="SIMULATION",
            status_code=200 if is_valid else 422,
            request_payload={"budget_id": str(budget_id)},
            response_payload={
                "is_valid": is_valid,
                "itens_analisados": total_itens,
                "itens_pendentes": itens_pendentes,
            },
            latency_ms=1,
            error_message="Existem itens com mapeamento pendente" if not is_valid else None,
            user_id=user_id,
        )

        msg = "Simulação concluída com sucesso! Todos os itens estão correlacionados para integração." if is_valid else f"Simulação identificou {itens_pendentes} item(ns) com mapeamento pendente para o Inside ERP."

        return InsideDryRunResponse(
            is_valid=is_valid,
            status_conexao=is_config_active,
            mensagem=msg,
            itens_analisados=total_itens,
            itens_pendentes=itens_pendentes,
            checklist=checklist,
            payloads={
                "prospect": prospect_payload,
                "orcamento": orcamento_payload,
                "produtos": produtos_payload if produtos_list else None,
                "servicos": servicos_payload if servicos_list else None,
                "antecipacao": antecipacao_payload,
            },
        )

    @staticmethod
    def sync_product_stock(
        db: Session,
        company_id: UUID,
        product_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.company_id == company_id,
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="Produto não encontrado nesta empresa.")

        data = None
        if product.codigo_service:
            results = InsideIntegrationService.consultar_estoque_realtime(
                db=db,
                company_id=company_id,
                cod_produto=str(product.codigo_service),
                user_id=user_id,
            )
            if results:
                data = results[0]

        if not data and product.nome:
            results = InsideIntegrationService.consultar_estoque_realtime(
                db=db,
                company_id=company_id,
                nome=product.nome,
                user_id=user_id,
            )
            if results:
                for item in results:
                    if item.get("descricao", "").strip().upper() == product.nome.strip().upper():
                        data = item
                        break
                if not data and len(results) == 1:
                    data = results[0]

        if not data:
            raise HTTPException(
                status_code=404,
                detail=f"Nenhum registro correspondente encontrado no Inside ERP para o produto '{product.nome}' (Cód. Service: {product.codigo_service or 'Não informado'})."
            )

        now = datetime.now(timezone.utc)
        if not product.codigo_service and data.get("codProduto"):
            try:
                product.codigo_service = int(data["codProduto"])
            except Exception:
                pass

        product.inside_cached_custo = data.get("custo")
        product.inside_cached_saldo = data.get("saldo")
        product.inside_cached_preco = data.get("preco")
        product.inside_cached_raw = data
        product.inside_last_sync_at = now
        db.commit()
        db.refresh(product)

        return {
            "success": True,
            "product_id": str(product.id),
            "codigo_service": product.codigo_service,
            "custo": float(product.inside_cached_custo or 0),
            "saldo": float(product.inside_cached_saldo or 0),
            "preco": float(product.inside_cached_preco or 0),
            "inside_last_sync_at": product.inside_last_sync_at.isoformat() if product.inside_last_sync_at else None,
            "raw": data,
        }

    @staticmethod
    def get_correlation_analysis(
        db: Session,
        company_id: UUID,
        filter_stock_only: bool = False,
    ) -> Dict[str, Any]:
        from difflib import SequenceMatcher

        def _norm(text: str) -> str:
            if not text:
                return ""
            t = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('ASCII')
            t = re.sub(r'[^a-zA-Z0-9]', ' ', t.upper())
            return ' '.join(t.split())

        inside_items = InsideIntegrationService.consultar_estoque_realtime(
            db=db,
            company_id=company_id,
            tipo_estoque="NOVOS",
        )

        if filter_stock_only:
            inside_items = [i for i in inside_items if (i.get("saldo") or 0) > 0]

        products = db.query(Product).filter(Product.company_id == company_id).all()
        products_by_cod_service = {p.codigo_service: p for p in products if p.codigo_service}
        products_by_exact_name = {p.nome.strip().upper(): p for p in products if p.nome}
        products_by_norm = {_norm(p.nome): p for p in products if p.nome}

        correlated_items = []
        summary = {
            "total_inside": len(inside_items),
            "linked_count": 0,
            "exact_match_count": 0,
            "high_similarity_count": 0,
            "medium_similarity_count": 0,
            "low_similarity_count": 0,
            "unmatched_count": 0,
        }

        for item in inside_items:
            cod_str = str(item.get("codProduto", "")).strip()
            cod_int = int(cod_str) if cod_str.isdigit() else None
            desc = item.get("descricao", "").strip()
            desc_upper = desc.upper()
            desc_norm = _norm(desc)

            matched_product = None
            tier = "UNMATCHED"
            ratio = 0.0

            if cod_int and cod_int in products_by_cod_service:
                matched_product = products_by_cod_service[cod_int]
                tier = "LINKED"
                ratio = 1.0
                summary["linked_count"] += 1
            elif desc_upper in products_by_exact_name:
                matched_product = products_by_exact_name[desc_upper]
                tier = "EXACT_MATCH"
                ratio = 1.0
                summary["exact_match_count"] += 1
            elif desc_norm in products_by_norm:
                matched_product = products_by_norm[desc_norm]
                tier = "EXACT_MATCH"
                ratio = 0.99
                summary["exact_match_count"] += 1
            else:
                best_ratio = 0.0
                best_p = None
                for p in products:
                    p_norm = _norm(p.nome)
                    r = SequenceMatcher(None, desc_norm, p_norm).ratio()
                    if r > best_ratio:
                        best_ratio = r
                        best_p = p

                ratio = round(best_ratio, 4)
                matched_product = best_p
                if ratio >= 0.80:
                    tier = "HIGH_SIMILARITY"
                    summary["high_similarity_count"] += 1
                elif ratio >= 0.50:
                    tier = "MEDIUM_SIMILARITY"
                    summary["medium_similarity_count"] += 1
                elif ratio >= 0.25:
                    tier = "LOW_SIMILARITY"
                    summary["low_similarity_count"] += 1
                else:
                    tier = "UNMATCHED"
                    summary["unmatched_count"] += 1
                    matched_product = None

            correlated_items.append({
                "inside": item,
                "tier": tier,
                "similarity_ratio": ratio,
                "is_linked": tier == "LINKED",
                "suggested_product": {
                    "id": str(matched_product.id),
                    "codigo": matched_product.codigo,
                    "nome": matched_product.nome,
                    "codigo_service": matched_product.codigo_service,
                    "categoria": matched_product.categoria,
                    "part_number": matched_product.part_number,
                    "ultimo_preco_compra": float(matched_product.ultimo_preco_compra) if matched_product.ultimo_preco_compra else None,
                } if matched_product else None,
            })

        return {
            "summary": summary,
            "items": correlated_items,
        }

    @staticmethod
    def link_product_manually(
        db: Session,
        company_id: UUID,
        product_id: UUID,
        cod_produto: int,
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        product = db.query(Product).filter(
            Product.id == product_id,
            Product.company_id == company_id,
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="Produto não encontrado.")

        product.codigo_service = cod_produto
        db.commit()
        return InsideIntegrationService.sync_product_stock(db, company_id, product_id, user_id=user_id)

    @staticmethod
    def auto_link_exact(
        db: Session,
        company_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        analysis = InsideIntegrationService.get_correlation_analysis(db, company_id)
        linked_count = 0
        errors = []

        for item_data in analysis.get("items", []):
            if item_data.get("tier") == "EXACT_MATCH" and item_data.get("suggested_product"):
                prod_id = UUID(item_data["suggested_product"]["id"])
                cod_prod_str = str(item_data["inside"].get("codProduto", ""))
                if cod_prod_str.isdigit():
                    try:
                        InsideIntegrationService.link_product_manually(
                            db=db,
                            company_id=company_id,
                            product_id=prod_id,
                            cod_produto=int(cod_prod_str),
                            user_id=user_id,
                        )
                        linked_count += 1
                    except Exception as e:
                        errors.append(f"Erro ao vincular {prod_id}: {str(e)}")

        return {
            "success": True,
            "linked_count": linked_count,
            "errors": errors,
            "message": f"{linked_count} produtos foram vinculados e sincronizados com o Inside ERP com sucesso."
        }

    @staticmethod
    def batch_link_products(
        db: Session,
        company_id: UUID,
        items: List[Any],
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        linked_count = 0
        errors = []

        prod_map: Dict[UUID, int] = {}
        for it in items:
            p_id = getattr(it, "product_id", None) or (it.get("product_id") if isinstance(it, dict) else None)
            cod_prod = getattr(it, "cod_produto", None) or (it.get("cod_produto") if isinstance(it, dict) else None)
            if not p_id or cod_prod is None:
                continue
            try:
                p_uuid = UUID(str(p_id))
                prod_map[p_uuid] = int(cod_prod)
            except Exception as ex:
                errors.append(f"Item inválido ({p_id}): {str(ex)}")

        if prod_map:
            products = db.query(Product).filter(
                Product.id.in_(list(prod_map.keys())),
                Product.company_id == company_id,
            ).all()

            for p in products:
                p.codigo_service = prod_map[p.id]
                linked_count += 1

            db.commit()

            # Sincroniza o estoque individualmente
            for p in products:
                try:
                    InsideIntegrationService.sync_product_stock(db, company_id, p.id, user_id=user_id)
                except Exception:
                    pass

        return {
            "success": True,
            "linked_count": linked_count,
            "errors": errors,
            "message": f"{linked_count} produtos foram vinculados e sincronizados com sucesso."
        }

    @staticmethod
    def import_product_from_inside(
        db: Session,
        company_id: UUID,
        cod_produto: int,
        tenant_id: str,
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        results = InsideIntegrationService.consultar_estoque_realtime(
            db=db,
            company_id=company_id,
            cod_produto=str(cod_produto),
            user_id=user_id,
        )
        if not results:
            raise HTTPException(status_code=404, detail="Produto não encontrado na API do Inside.")
        data = results[0]

        from src.modules.products.service import ProductService
        prod_service = ProductService(db)
        sku = prod_service._generate_sku(tenant_id)

        now = datetime.now(timezone.utc)
        marca, fab = InsideIntegrationService.extract_brand_manufacturer(data.get("descricao"))
        new_product = Product(
            tenant_id=tenant_id,
            company_id=company_id,
            codigo=sku,
            codigo_service=cod_produto,
            nome=data.get("descricao", f"PRODUTO INSIDE {cod_produto}").strip().upper()[:300],
            descricao=data.get("descricao"),
            marca=marca,
            fabricante=fab,
            tipo="EQUIPAMENTO",
            finalidade="REVENDA",
            unidade="UN",
            ativo=True,
            inside_cached_custo=data.get("custo"),
            inside_cached_saldo=data.get("saldo"),
            inside_cached_preco=data.get("preco"),
            inside_cached_raw=data,
            inside_last_sync_at=now,
        )
        db.add(new_product)
        db.commit()
        db.refresh(new_product)

        return {
            "success": True,
            "product_id": str(new_product.id),
            "codigo": new_product.codigo,
            "nome": new_product.nome,
            "codigo_service": new_product.codigo_service,
            "custo": float(new_product.inside_cached_custo or 0),
            "saldo": float(new_product.inside_cached_saldo or 0),
        }

    @staticmethod
    def get_multi_stock_summary(
        db: Session,
        company_id: UUID,
    ) -> Dict[str, Any]:
        """Retorna o resumo estatístico dos estoques correlacionados e posições de ERP."""
        from sqlalchemy import func as sa_func

        # Totais de product_inside_stocks agrupados por (empresa_erp, tipo_estoque)
        stock_groups = db.query(
            ProductInsideStock.empresa_erp,
            ProductInsideStock.tipo_estoque,
            sa_func.count(ProductInsideStock.id).label("total_itens"),
            sa_func.sum(ProductInsideStock.saldo).label("saldo_total"),
            sa_func.count(sa_func.nullif(ProductInsideStock.saldo <= 0, True)).label("com_saldo_positivo"),
        ).join(Product, Product.id == ProductInsideStock.product_id).filter(
            Product.company_id == company_id
        ).group_by(
            ProductInsideStock.empresa_erp,
            ProductInsideStock.tipo_estoque
        ).all()

        stocks_summary = {}
        for row in stock_groups:
            key = f"empresa_{row.empresa_erp}_{row.tipo_estoque.lower().replace(' ', '_')}"
            stocks_summary[key] = {
                "empresa_erp": row.empresa_erp,
                "tipo_estoque": row.tipo_estoque,
                "total_itens": row.total_itens or 0,
                "saldo_total": float(row.saldo_total or 0),
                "com_saldo_positivo": row.com_saldo_positivo or 0,
            }

        total_produtos = db.query(sa_func.count(Product.id)).filter(
            Product.company_id == company_id,
            Product.tipo != "SERVICO"
        ).scalar() or 0

        total_servicos = db.query(sa_func.count(Product.id)).filter(
            Product.company_id == company_id,
            Product.tipo == "SERVICO"
        ).scalar() or 0

        produtos_vinculados = db.query(sa_func.count(sa_func.distinct(ProductInsideStock.product_id))).join(
            Product, Product.id == ProductInsideStock.product_id
        ).filter(
            Product.company_id == company_id
        ).scalar() or 0

        servicos_erp_vinculados = db.query(sa_func.count(Product.id)).filter(
            Product.company_id == company_id,
            Product.tipo == "SERVICO",
            Product.codigo_service != None
        ).scalar() or 0

        # Última sincronização registrada
        last_sync = db.query(sa_func.max(ProductInsideStock.last_sync_at)).join(
            Product, Product.id == ProductInsideStock.product_id
        ).filter(
            Product.company_id == company_id
        ).scalar()

        return {
            "stocks": stocks_summary,
            "total_produtos_catalogo": total_produtos,
            "total_servicos_catalogo": total_servicos,
            "produtos_com_vinculo_erp": produtos_vinculados,
            "servicos_com_vinculo_erp": servicos_erp_vinculados,
            "last_sync_at": last_sync.isoformat() if last_sync else None,
        }

    @staticmethod
    def sync_multi_stock_complete(
        db: Session,
        company_id: UUID,
        user_id: Optional[UUID] = None,
    ) -> Dict[str, Any]:
        """
        Executa a sincronização completa e correlação em 3 fases:
        1. Empresa 02 (Stelseg) - Tipo 'ESTOQUE SECUNDARIO' (primário)
        2. Empresa 01 (Stelmat) - Tipo 'NOVOS'
        3. Serviços do ERP (Ambiente A) -> Criados em products como tipo='SERVICO' e categoria='SERVIÇOS ERP'
        """
        import time
        from difflib import SequenceMatcher
        from src.modules.products.service import ProductService

        start_time = time.perf_counter()
        now = datetime.now(timezone.utc)

        # 1. Obter empresa e tenant
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            raise HTTPException(status_code=404, detail="Empresa não encontrada.")
        tenant_id = company.tenant_id

        # 2. Obter clientes da integração
        estoque_client = InsideIntegrationService.get_estoque_client(db, company_id, allow_inactive=False)
        servico_client = InsideIntegrationService.get_client(db, company_id, target_env="SERVICOS", allow_inactive=True)

        prod_service = ProductService(db)

        def _norm(text: str) -> str:
            if not text:
                return ""
            t = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('ASCII')
            t = re.sub(r'[^a-zA-Z0-9]', ' ', t.upper())
            return ' '.join(t.split())

        # 3. Carregar todos os produtos existentes na memória para consultas O(1)
        products = db.query(Product).filter(Product.company_id == company_id).all()
        prods_by_id: Dict[UUID, Product] = {p.id: p for p in products}
        prods_by_cod_service: Dict[int, Product] = {p.codigo_service: p for p in products if p.codigo_service}
        prods_by_norm: Dict[str, Product] = {_norm(p.nome): p for p in products if p.nome}

        # Carregar registros existentes de ProductInsideStock
        existing_stocks = db.query(ProductInsideStock).join(Product, Product.id == ProductInsideStock.product_id).filter(
            Product.company_id == company_id
        ).all()
        stocks_by_key: Dict[Tuple[UUID, str, str], ProductInsideStock] = {
            (s.product_id, str(s.empresa_erp), str(s.tipo_estoque).upper()): s for s in existing_stocks
        }
        prods_by_erp_code: Dict[Tuple[str, int], Product] = {
            (str(s.empresa_erp), s.cod_produto_erp): prods_by_id[s.product_id]
            for s in existing_stocks if s.product_id in prods_by_id
        }

        def _find_or_create_product_for_item(
            item_data: Dict[str, Any],
            empresa_erp: str,
            target_tipo_estoque: str,
            created_counter_ref: List[int],
            linked_counter_ref: List[int]
        ) -> Product:
            cod_str = str(item_data.get("codProduto", "")).strip()
            cod_int = int(cod_str) if cod_str.isdigit() else None
            desc = str(item_data.get("descricao", "")).strip()
            desc_norm = _norm(desc)

            matched_product = None

            # 1. Procura por vínculo prévio de estoque ERP
            if cod_int and (empresa_erp, cod_int) in prods_by_erp_code:
                matched_product = prods_by_erp_code[(empresa_erp, cod_int)]
            # 2. Procura por codigo_service
            elif cod_int and cod_int in prods_by_cod_service:
                matched_product = prods_by_cod_service[cod_int]
            # 3. Procura por nome normalizado exato
            elif desc_norm and desc_norm in prods_by_norm:
                matched_product = prods_by_norm[desc_norm]
            else:
                # 4. Procura por similaridade de texto (>= 0.85)
                best_ratio = 0.0
                best_p = None
                for p in prods_by_id.values():
                    if p.tipo == "SERVICO":
                        continue
                    p_norm = _norm(p.nome)
                    r = SequenceMatcher(None, desc_norm, p_norm).ratio()
                    if r > best_ratio:
                        best_ratio = r
                        best_p = p
                if best_ratio >= 0.85:
                    matched_product = best_p

            custo_val = float(item_data.get("custo") or 0.0)
            saldo_val = float(item_data.get("saldo") or 0.0)
            preco_val = float(item_data.get("preco") or 0.0)
            cod_est = str(item_data.get("codEstoque", ""))

            if matched_product:
                linked_counter_ref[0] += 1
                # Atualizar dados do produto legado/ativo se aplicável
                if matched_product.codigo_service is None and cod_int:
                    matched_product.codigo_service = cod_int
                    prods_by_cod_service[cod_int] = matched_product

                # Atualiza cache geral da tabela products se for empresa 1 (Stelmat) ou se não tiver ainda
                if empresa_erp == "1" or not matched_product.inside_cached_saldo:
                    matched_product.inside_cached_saldo = saldo_val
                    matched_product.inside_cached_custo = custo_val
                    matched_product.inside_cached_preco = preco_val
                    matched_product.inside_last_sync_at = now
                    matched_product.inside_cached_raw = item_data
            else:
                # Criar produto novo no Cerberus
                created_counter_ref[0] += 1
                sku = prod_service._generate_sku(tenant_id)
                marca, fab = InsideIntegrationService.extract_brand_manufacturer(desc)
                matched_product = Product(
                    tenant_id=tenant_id,
                    company_id=company_id,
                    codigo=sku,
                    codigo_service=cod_int,
                    nome=desc.upper()[:300] if desc else f"PRODUTO ERP {cod_str}",
                    descricao=desc,
                    marca=marca,
                    fabricante=fab,
                    tipo="EQUIPAMENTO",
                    finalidade="REVENDA",
                    categoria="PRODUTOS ERP",
                    unidade="UN",
                    ativo=True,
                    inside_cached_custo=custo_val,
                    inside_cached_saldo=saldo_val,
                    inside_cached_preco=preco_val,
                    inside_cached_raw=item_data,
                    inside_last_sync_at=now,
                )
                db.add(matched_product)
                db.flush() # Gera ID

                # Atualiza os caches em memória
                prods_by_id[matched_product.id] = matched_product
                if cod_int:
                    prods_by_cod_service[cod_int] = matched_product
                if desc_norm:
                    prods_by_norm[desc_norm] = matched_product

            # Upsert na tabela product_inside_stocks
            stock_key = (matched_product.id, empresa_erp, target_tipo_estoque.upper())
            if stock_key in stocks_by_key:
                stock_record = stocks_by_key[stock_key]
                stock_record.saldo = saldo_val
                stock_record.custo = custo_val
                stock_record.preco = preco_val
                stock_record.cod_estoque = cod_est
                stock_record.cod_produto_erp = cod_int or 0
                stock_record.last_sync_at = now
                stock_record.raw_data = item_data
            else:
                stock_record = ProductInsideStock(
                    product_id=matched_product.id,
                    empresa_erp=empresa_erp,
                    tipo_estoque=target_tipo_estoque.upper(),
                    cod_estoque=cod_est,
                    cod_produto_erp=cod_int or 0,
                    saldo=saldo_val,
                    custo=custo_val,
                    preco=preco_val,
                    last_sync_at=now,
                    raw_data=item_data,
                )
                db.add(stock_record)
                stocks_by_key[stock_key] = stock_record

            if cod_int:
                prods_by_erp_code[(empresa_erp, cod_int)] = matched_product

            return matched_product

        # =========================================================================
        # FASE 1: Empresa 02 (STELSEG) - ESTOQUE SECUNDARIO
        # =========================================================================
        created_stelseg = [0]
        linked_stelseg = [0]
        stelseg_items: List[Dict[str, Any]] = []
        try:
            # Consulta direta na API da porta 44923 sem filtros de empresa/tipo para termos todo o universo de estoques
            status_code, raw_data, lat, err = estoque_client.consultar(tipo_estoque="TODOS", empresa_id="TODAS")
            if status_code == 200 and isinstance(raw_data, list):
                stelseg_items = [
                    d for d in raw_data 
                    if str(d.get("empresa")) == "2" and "SEC" in str(d.get("tipoEstoque", "")).upper()
                ]
            for it in stelseg_items:
                _find_or_create_product_for_item(
                    item_data=it,
                    empresa_erp="2",
                    target_tipo_estoque="ESTOQUE SECUNDARIO",
                    created_counter_ref=created_stelseg,
                    linked_counter_ref=linked_stelseg,
                )
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Erro durante a sincronização do Estoque Secundário Stelseg: {str(e)}"
            )

        # =========================================================================
        # FASE 2: Empresa 01 (STELMAT) - NOVOS
        # =========================================================================
        created_stelmat = [0]
        linked_stelmat = [0]
        stelmat_items: List[Dict[str, Any]] = []
        try:
            if status_code == 200 and isinstance(raw_data, list):
                stelmat_items = [
                    d for d in raw_data 
                    if str(d.get("empresa")) == "1" and str(d.get("tipoEstoque", "")).upper() in ["NOVOS", "NOVO"]
                ]
            for it in stelmat_items:
                _find_or_create_product_for_item(
                    item_data=it,
                    empresa_erp="1",
                    target_tipo_estoque="NOVOS",
                    created_counter_ref=created_stelmat,
                    linked_counter_ref=linked_stelmat,
                )
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=500,
                detail=f"Erro durante a sincronização do Estoque Novos Stelmat: {str(e)}"
            )

        # =========================================================================
        # FASE 3: SERVIÇOS DO ERP (Ambiente A) -> Categoria 'SERVIÇOS ERP', tipo='SERVICO'
        # =========================================================================
        created_services = 0
        linked_services = 0
        total_services_erp = 0
        try:
            # Lista serviços paginados (tamanho 100)
            st_serv, serv_data, lat_serv, err_serv = servico_client.listar_servicos(pagina=1, tamanho_pagina=200)
            if st_serv == 200 and serv_data:
                raw_inner = serv_data.get("data") if isinstance(serv_data, dict) else serv_data
                if isinstance(raw_inner, dict):
                    serv_list = raw_inner.get("itens") or raw_inner.get("data") or raw_inner.get("items") or []
                elif isinstance(raw_inner, list):
                    serv_list = raw_inner
                else:
                    serv_list = []
                total_services_erp = len(serv_list)

                # Mapa de serviços existentes na tabela products
                services_in_db = db.query(Product).filter(
                    Product.company_id == company_id,
                    Product.tipo == "SERVICO"
                ).all()
                srv_by_code: Dict[int, Product] = {p.codigo_service: p for p in services_in_db if p.codigo_service}
                srv_by_norm: Dict[str, Product] = {_norm(p.nome): p for p in services_in_db if p.nome}

                for s_item in serv_list:
                    cod_serv = s_item.get("codServico")
                    desc_serv = str(s_item.get("descricao", "")).strip()
                    desc_serv_norm = _norm(desc_serv)
                    custo_serv = float(s_item.get("custo") or 0.0)
                    preco_serv = float(s_item.get("valorUnitario") or 0.0)

                    matched_service = None
                    if cod_serv and cod_serv in srv_by_code:
                        matched_service = srv_by_code[cod_serv]
                    elif desc_serv_norm in srv_by_norm:
                        matched_service = srv_by_norm[desc_serv_norm]

                    if matched_service:
                        linked_services += 1
                        matched_service.codigo_service = cod_serv
                        matched_service.inside_cached_custo = custo_serv
                        matched_service.inside_cached_preco = preco_serv
                        matched_service.inside_last_sync_at = now
                        matched_service.inside_cached_raw = s_item
                    else:
                        created_services += 1
                        sku = prod_service._generate_sku(tenant_id)
                        new_srv = Product(
                            tenant_id=tenant_id,
                            company_id=company_id,
                            codigo=sku,
                            codigo_service=cod_serv,
                            nome=desc_serv.upper()[:300] if desc_serv else f"SERVIÇO ERP {cod_serv}",
                            descricao=desc_serv,
                            tipo="SERVICO",
                            finalidade="REVENDA",
                            categoria="SERVIÇOS ERP",
                            unidade="UN",
                            ativo=True,
                            inside_cached_custo=custo_serv,
                            inside_cached_saldo=0.0,
                            inside_cached_preco=preco_serv,
                            inside_cached_raw=s_item,
                            inside_last_sync_at=now,
                        )
                        db.add(new_srv)
                        srv_by_code[cod_serv] = new_srv
                        srv_by_norm[desc_serv_norm] = new_srv

                db.commit()
        except Exception as e:
            db.rollback()
            # Se a API de serviços falhar ou não estiver configurada, não aborta os estoques já salvos
            print(f"[WARN] Sincronização de serviços do Inside falhou: {e}")

        total_elapsed = round(time.perf_counter() - start_time, 2)

        return {
            "success": True,
            "message": "Sincronização e correlação multi-empresa concluída com sucesso.",
            "execution_time_seconds": total_elapsed,
            "stelseg_secundario": {
                "total_erp": len(stelseg_items),
                "vinculados": linked_stelseg[0],
                "criados": created_stelseg[0],
                "saldo_total": sum(float(i.get("saldo") or 0.0) for i in stelseg_items),
            },
            "stelmat_novos": {
                "total_erp": len(stelmat_items),
                "vinculados": linked_stelmat[0],
                "criados": created_stelmat[0],
                "saldo_total": sum(float(i.get("saldo") or 0.0) for i in stelmat_items),
            },
            "servicos_erp": {
                "total_erp": total_services_erp,
                "vinculados": linked_services,
                "criados": created_services,
            },
        }
