import uuid
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from src.modules.companies.models import Company, CompanyInsideConfig
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem
from src.modules.products.models import Product
from src.modules.customers.models import Customer
from src.modules.professionals.models import Professional
from src.modules.payment_methods.models import FormaPagamento, FormaPagamentoParcela
from .models import IntegrationLog
from .client import InsideServiceClient
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
    def get_client(db: Session, company_id: UUID, target_env: str = "DEFAULT") -> InsideServiceClient:
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

        if not is_active:
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
            client = InsideIntegrationService.get_client(db, company_id, target_env=target_env)
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
            endpoint=f"[{target_env}] /api/prospect-mobile/configuracoes",
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

        client = InsideIntegrationService.get_client(db, company_id, target_env=target_env)
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
            codigo = item.get("codigo") or item.get("codFormaPagamento") or item.get("formaPagamento") or item.get("id") or item.get("codForma")
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
