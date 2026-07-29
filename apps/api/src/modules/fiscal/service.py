import hashlib
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_, desc
from fastapi import HTTPException, status
from uuid import UUID, uuid4
from typing import List, Optional, Dict, Any
from datetime import datetime
from decimal import Decimal

from .models import (
    NfeAnalysis,
    FiscalDocument,
    FiscalDocumentItem,
    FiscalDocumentInstallment,
    FiscalDocumentPayment,
    FiscalDocumentEvent,
    FiscalNfeHistory,
)
from .parser import NFeXmlParser
from .rules import validate_classification


class NfeAnalysisService:
    @staticmethod
    def calculate_hash(content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    @staticmethod
    def lookup_supplier_name_by_cnpj(db: Session, cnpj: Optional[str]) -> Optional[str]:
        if not cnpj:
            return None
        clean_cnpj = "".join(filter(str.isdigit, str(cnpj)))
        if len(clean_cnpj) != 14:
            return None

        # 1. Busca no banco de dados local do ETL (cnpj_public)
        try:
            from sqlalchemy import text
            query = text("""
                SELECT emp.razao_social, e.nome_fantasia 
                FROM cnpj_public.estabelecimentos e 
                JOIN cnpj_public.empresas emp ON e.cnpj_basico = emp.cnpj_basico 
                WHERE e.cnpj = :cnpj
            """)
            row = db.execute(query, {"cnpj": clean_cnpj}).mappings().first()
            if row:
                name = row.get("razao_social") or row.get("nome_fantasia")
                if name:
                    return str(name)
        except Exception:
            pass

        # 2. Busca no cache de consultas CNPJ (CnpjQueryCache)
        try:
            from src.modules.companies.models import CnpjQueryCache
            cached = db.query(CnpjQueryCache).filter(CnpjQueryCache.cnpj == clean_cnpj).first()
            if cached and cached.mapped_body_json:
                name = cached.mapped_body_json.get("razaoSocial") or cached.mapped_body_json.get("nomeFantasia")
                if name:
                    return str(name)
        except Exception:
            pass

        # 3. Consulta Provedor ReceitaWS (Receita Federal AWS)
        try:
            import urllib.request
            import json
            req = urllib.request.Request(
                f"https://www.receitaws.com.br/v1/cnpj/{clean_cnpj}",
                headers={"User-Agent": "Mozilla/5.0"}
            )
            with urllib.request.urlopen(req, timeout=3) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                name = data.get("nome") or data.get("fantasia")
                if name and str(name).upper() != "ERROR":
                    return str(name)
        except Exception:
            pass

        return None

    @staticmethod
    def preview_xml(db: Session, tenant_id: str, file_name: str, xml_content: str) -> Dict[str, Any]:
        """
        Lê e valida o XML sem persistir no banco de dados.
        Verifica se a chave de acesso já foi importada anteriormente para o mesmo tenant.
        """
        try:
            parsed = NFeXmlParser.parse_xml(xml_content)
        except Exception as e:
            return {
                "file_name": file_name,
                "access_key": "",
                "error": str(e),
                "is_duplicate": False,
                "xml_content": xml_content,
            }

        access_key = parsed["access_key"]
        doc_type = parsed.get("document_type", "NFE")

        # Verificar se a nota/evento já existe no sistema para este tenant
        existing_doc = (
            db.query(FiscalDocument)
            .filter(
                FiscalDocument.tenant_id == tenant_id,
                FiscalDocument.access_key == access_key,
            )
            .first()
        )

        is_duplicate = False
        existing_imported_at = None
        existing_imported_by = None

        if existing_doc:
            if doc_type == "NFE" and not existing_doc.criada_por_evento:
                is_duplicate = True
                existing_imported_at = existing_doc.created_at
                if existing_doc.analysis and existing_doc.analysis.created_by:
                    existing_imported_by = existing_doc.analysis.created_by
            elif doc_type == "NFE_EVENT":
                existing_event = (
                    db.query(FiscalDocumentEvent)
                    .filter(
                        FiscalDocumentEvent.tenant_id == tenant_id,
                        FiscalDocumentEvent.access_key == access_key,
                        FiscalDocumentEvent.event_type == parsed.get("event_type"),
                        FiscalDocumentEvent.event_sequence == parsed.get("event_sequence", 1),
                        FiscalDocumentEvent.registration_protocol == parsed.get("registration_protocol"),
                    )
                    .first()
                )
                if existing_event:
                    is_duplicate = True
                    existing_imported_at = existing_event.created_at
                    existing_imported_by = existing_event.imported_by

        if doc_type == "NFE_EVENT":
            key_info = parsed.get("access_key_info", {})
            issuer_cnpj = key_info.get("cnpj_emitente")
            issuer_name = NfeAnalysisService.lookup_supplier_name_by_cnpj(db, issuer_cnpj)
            return {
                "file_name": file_name,
                "document_type": "NFE_EVENT",
                "access_key": access_key,
                "nNF": key_info.get("numero_nfe"),
                "serie": key_info.get("serie"),
                "mod": key_info.get("modelo"),
                "natOp": "EMITIDA E CANCELADA POR EVENTO",
                "dhEmi": None,
                "competencia": key_info.get("ano_mes_emissao"),
                "issuer_cnpj": issuer_cnpj,
                "issuer_name": issuer_name,
                "issuer_ie": None,
                "uf_emit": key_info.get("uf_emit"),
                "recipient_cnpj": None,
                "recipient_name": None,
                "uf_dest": None,
                "vProd": None,
                "vNF": None,
                "vBC": None,
                "vICMS": None,
                "vBCST": None,
                "vICMSST": None,
                "vFCP": None,
                "vFCPST": None,
                "vIPI": None,
                "vPIS": None,
                "vCOFINS": None,
                "vFrete": None,
                "vSeg": None,
                "vDesc": None,
                "vOutro": None,
                "item_count": 0,
                "items": [],
                "is_duplicate": is_duplicate,
                "is_event": True,
                "event_type": parsed.get("event_type"),
                "event_description": parsed.get("event_description"),
                "justification": parsed.get("justification"),
                "cStat": parsed.get("cStat"),
                "xMotivo": parsed.get("xMotivo"),
                "registration_protocol": parsed.get("registration_protocol"),
                "existing_imported_at": existing_imported_at,
                "existing_imported_by": existing_imported_by,
                "xml_content": xml_content,
                "error": None,
            }

        raw_items = parsed.get("items", [])
        clean_items = []
        for it in raw_items:
            clean_items.append({
                "nItem": it.get("nItem", 1),
                "cProd": it.get("cProd"),
                "xProd": it.get("xProd"),
                "NCM": it.get("NCM"),
                "CFOP": it.get("CFOP"),
                "uCom": it.get("uCom"),
                "qCom": float(it.get("qCom", 0)) if it.get("qCom") is not None else 0.0,
                "vUnCom": float(it.get("vUnCom", 0)) if it.get("vUnCom") is not None else 0.0,
                "vProd": float(it.get("vProd", 0)) if it.get("vProd") is not None else 0.0,
            })

        return {
            "file_name": file_name,
            "document_type": "NFE",
            "access_key": access_key,
            "nNF": parsed.get("nNF"),
            "serie": parsed.get("serie"),
            "mod": parsed.get("mod"),
            "natOp": parsed.get("natOp"),
            "dhEmi": parsed.get("dhEmi"),
            "competencia": parsed.get("competencia"),
            "issuer_cnpj": parsed.get("issuer_cnpj"),
            "issuer_name": parsed.get("issuer_name"),
            "issuer_ie": parsed.get("issuer_ie"),
            "uf_emit": parsed.get("uf_emit"),
            "recipient_cnpj": parsed.get("recipient_cnpj"),
            "recipient_name": parsed.get("recipient_name"),
            "uf_dest": parsed.get("uf_dest"),
            "vProd": parsed.get("vProd", Decimal(0)),
            "vNF": parsed.get("vNF", Decimal(0)),
            "vBC": parsed.get("vBC", Decimal(0)),
            "vICMS": parsed.get("vICMS", Decimal(0)),
            "vBCST": parsed.get("vBCST", Decimal(0)),
            "vICMSST": parsed.get("vICMSST", Decimal(0)),
            "vFCP": parsed.get("vFCP", Decimal(0)),
            "vFCPST": parsed.get("vFCPST", Decimal(0)),
            "vIPI": parsed.get("vIPI", Decimal(0)),
            "vPIS": parsed.get("vPIS", Decimal(0)),
            "vCOFINS": parsed.get("vCOFINS", Decimal(0)),
            "vFrete": parsed.get("vFrete", Decimal(0)),
            "vSeg": parsed.get("vSeg", Decimal(0)),
            "vDesc": parsed.get("vDesc", Decimal(0)),
            "vOutro": parsed.get("vOutro", Decimal(0)),
            "item_count": len(clean_items),
            "items": clean_items,
            "is_duplicate": is_duplicate,
            "is_event": False,
            "existing_imported_at": existing_imported_at,
            "existing_imported_by": existing_imported_by,
            "xml_content": xml_content,
            "error": None,
        }

    @staticmethod
    def import_classified_notes(
        db: Session,
        tenant_id: str,
        notes: List[Dict[str, Any]],
        user_id: Optional[str] = None,
        force_reprocess: bool = False,
        allow_event_without_invoice: bool = True,
    ) -> Dict[str, Any]:
        """
        Importa e armazena notas fiscais e eventos de cancelamento no banco de dados.
        Suporta o registro de eventos sem a nota original e a conciliação posterior.
        """
        total_sent = len(notes)
        imported_count = 0
        classified_count = 0
        duplicate_count = 0
        rejected_count = 0
        errors = []
        imported_ids = []

        for item in notes:
            file_name = item.get("file_name", "nota.xml")
            xml_content = item.get("xml_content", "")
            aplicacao = item.get("aplicacao")
            tipo_tributacao = item.get("tipo_tributacao")
            observacao = item.get("observacao_classificacao")

            # 1. Parse XML
            try:
                parsed = NFeXmlParser.parse_xml(xml_content)
            except Exception as parse_err:
                rejected_count += 1
                errors.append({"file_name": file_name, "reason": str(parse_err)})
                continue

            doc_type = parsed.get("document_type", "NFE")
            access_key = parsed["access_key"]
            file_hash = NfeAnalysisService.calculate_hash(xml_content)

            # --- PROCESSAMENTO DE EVENTO FISCAL DE CANCELAMENTO ---
            if doc_type == "NFE_EVENT":
                event_type = parsed.get("event_type")
                if event_type != "110111":
                    rejected_count += 1
                    errors.append({
                        "file_name": file_name,
                        "access_key": access_key,
                        "reason": f"Tipo de evento '{event_type}' não suportado. Apenas cancelamento (110111) é suportado."
                    })
                    continue

                # Idempotência do evento
                existing_event = (
                    db.query(FiscalDocumentEvent)
                    .filter(
                        FiscalDocumentEvent.tenant_id == tenant_id,
                        FiscalDocumentEvent.access_key == access_key,
                        FiscalDocumentEvent.event_type == event_type,
                        FiscalDocumentEvent.event_sequence == parsed.get("event_sequence", 1),
                        FiscalDocumentEvent.registration_protocol == parsed.get("registration_protocol"),
                    )
                    .first()
                )

                if existing_event:
                    duplicate_count += 1
                    errors.append({
                        "file_name": file_name,
                        "access_key": access_key,
                        "reason": "Este evento de cancelamento já foi importado anteriormente.",
                        "duplicate": True,
                        "status_code": "EVENTO_DUPLICADO"
                    })
                    continue

                # Procurar NF-e existente
                existing_doc = (
                    db.query(FiscalDocument)
                    .filter(
                        FiscalDocument.tenant_id == tenant_id,
                        FiscalDocument.access_key == access_key,
                    )
                    .first()
                )

                try:
                    if existing_doc:
                        # Cenário 1: NF-e já existente -> Atualizar situação para CANCELADA e vincular evento
                        prev_cstat = existing_doc.cStat
                        existing_doc.cStat = parsed.get("cStat", "135")
                        existing_doc.xMotivo = parsed.get("xMotivo", "Cancelada por evento de cancelamento")
                        existing_doc.nProt = parsed.get("registration_protocol") or existing_doc.nProt
                        existing_doc.dhRecbto = parsed.get("registration_datetime") or existing_doc.dhRecbto

                        event_rec = FiscalDocumentEvent(
                            tenant_id=tenant_id,
                            fiscal_document_id=existing_doc.id,
                            access_key=access_key,
                            event_type=event_type,
                            event_sequence=parsed.get("event_sequence", 1),
                            event_description=parsed.get("event_description"),
                            event_datetime=parsed.get("event_datetime"),
                            registration_datetime=parsed.get("registration_datetime"),
                            request_protocol=parsed.get("request_protocol"),
                            registration_protocol=parsed.get("registration_protocol"),
                            justification=parsed.get("justification"),
                            environment=parsed.get("tpAmb"),
                            authority_code=parsed.get("cOrgao"),
                            status_code=parsed.get("cStat"),
                            status_message=parsed.get("xMotivo"),
                            processing_status="CONFIRMED" if parsed.get("is_confirmed", True) else "UNCONFIRMED",
                            raw_xml=xml_content,
                            imported_by=user_id
                        )
                        db.add(event_rec)

                        history = FiscalNfeHistory(
                            fiscal_document_id=existing_doc.id,
                            tenant_id=tenant_id,
                            user_id=user_id,
                            action="CANCELAMENTO_EVENTO",
                            justification=f"NF-e localizada e situação atualizada para Cancelada. Justificativa SEFAZ: {parsed.get('justification', '-')}",
                            previous_values={"cStat": prev_cstat},
                            new_values={
                                "cStat": parsed.get("cStat"),
                                "xMotivo": parsed.get("xMotivo"),
                                "nProt": parsed.get("registration_protocol")
                            }
                        )
                        db.add(history)
                        db.commit()

                        imported_count += 1
                        imported_ids.append(str(existing_doc.id))
                        continue
                    else:
                        # Cenário 2: NF-e não existente -> Criar NF-e Resumida por Evento
                        if not allow_event_without_invoice:
                            rejected_count += 1
                            errors.append({
                                "file_name": file_name,
                                "access_key": access_key,
                                "reason": "NF-e original não encontrada e a opção de criar registro resumido está desativada."
                            })
                            continue

                        key_info = parsed.get("access_key_info", {})
                        issuer_cnpj = key_info.get("cnpj_emitente")
                        issuer_name = NfeAnalysisService.lookup_supplier_name_by_cnpj(db, issuer_cnpj)
                        
                        from src.modules.companies.models import Company
                        tenant_company = db.query(Company).filter(Company.tenant_id == tenant_id).first()
                        recip_cnpj = tenant_company.cnpj if tenant_company else None
                        recip_name = (tenant_company.razao_social or tenant_company.nome_fantasia) if tenant_company else None
                        recip_uf = getattr(tenant_company, 'uf', None) if tenant_company else None

                        doc = FiscalDocument(
                            tenant_id=tenant_id,
                            nfe_analysis_id=None,
                            access_key=access_key,
                            nNF=key_info.get("numero_nfe"),
                            serie=key_info.get("serie"),
                            mod=key_info.get("modelo"),
                            natOp="EMITIDA E CANCELADA POR EVENTO",
                            dhEmi=None,
                            competencia=key_info.get("ano_mes_emissao"),
                            issuer_cnpj=issuer_cnpj,
                            issuer_name=issuer_name,
                            issuer_ie=None,
                            uf_emit=key_info.get("uf_emit"),
                            recipient_cnpj=recip_cnpj,
                            recipient_name=recip_name,
                            uf_dest=recip_uf,
                            aplicacao=aplicacao if aplicacao else "CANCELAMENTO",
                            tipo_tributacao=tipo_tributacao if tipo_tributacao else "CANCELAMENTO",
                            status_classificacao="CLASSIFICADO",
                            status_importacao="CANCELADA",
                            criada_por_evento=True,
                            dados_completos=False,
                            xml_nfe_original_importado=False,
                            vProd=None,
                            vNF=None,
                            vBC=None,
                            vICMS=None,
                            vBCST=None,
                            vICMSST=None,
                            vFCP=None,
                            vFCPST=None,
                            vIPI=None,
                            vPIS=None,
                            vCOFINS=None,
                            vFrete=None,
                            vSeg=None,
                            vDesc=None,
                            vOutro=None,
                            cStat=parsed.get("cStat", "135"),
                            xMotivo=parsed.get("xMotivo", "Cancelada por evento de cancelamento"),
                            nProt=parsed.get("registration_protocol"),
                            dhRecbto=parsed.get("registration_datetime"),
                            xml_version="4.00",
                            xml_raw=None,
                            origem_importacao="EVENTO_CANCELAMENTO",
                            ano_mes_emissao=key_info.get("ano_mes_emissao"),
                            codigo_uf=key_info.get("codigo_uf")
                        )
                        db.add(doc)
                        db.flush()

                        event_rec = FiscalDocumentEvent(
                            tenant_id=tenant_id,
                            fiscal_document_id=doc.id,
                            access_key=access_key,
                            event_type=event_type,
                            event_sequence=parsed.get("event_sequence", 1),
                            event_description=parsed.get("event_description"),
                            event_datetime=parsed.get("event_datetime"),
                            registration_datetime=parsed.get("registration_datetime"),
                            request_protocol=parsed.get("request_protocol"),
                            registration_protocol=parsed.get("registration_protocol"),
                            justification=parsed.get("justification"),
                            environment=parsed.get("tpAmb"),
                            authority_code=parsed.get("cOrgao"),
                            status_code=parsed.get("cStat"),
                            status_message=parsed.get("xMotivo"),
                            processing_status="CONFIRMED" if parsed.get("is_confirmed", True) else "UNCONFIRMED",
                            raw_xml=xml_content,
                            imported_by=user_id
                        )
                        db.add(event_rec)

                        history = FiscalNfeHistory(
                            fiscal_document_id=doc.id,
                            tenant_id=tenant_id,
                            user_id=user_id,
                            action="CRIACAO_POR_EVENTO_CANCELAMENTO",
                            justification=f"NF-e resumida criada a partir do evento de cancelamento. Justificativa: {parsed.get('justification', '-')}",
                            new_values={
                                "status_importacao": "RESUMIDA_EVENTO",
                                "cStat": parsed.get("cStat"),
                                "nProt": parsed.get("registration_protocol")
                            }
                        )
                        db.add(history)
                        db.commit()

                        imported_count += 1
                        imported_ids.append(str(doc.id))
                        continue
                except Exception as event_err:
                    db.rollback()
                    rejected_count += 1
                    errors.append({"file_name": file_name, "access_key": access_key, "reason": str(event_err)})
                    continue

            # --- PROCESSAMENTO DE NF-E COMPLETA (<nfeProc>) ---
            # 1. Validar classificação se informada
            if aplicacao and tipo_tributacao:
                try:
                    validate_classification(aplicacao, tipo_tributacao)
                except Exception as val_err:
                    rejected_count += 1
                    errors.append({"file_name": file_name, "reason": str(val_err)})
                    continue

            # 2. Verificar duplicidade por tenant e access_key
            existing_doc = (
                db.query(FiscalDocument)
                .filter(
                    FiscalDocument.tenant_id == tenant_id,
                    FiscalDocument.access_key == access_key,
                )
                .first()
            )

            if existing_doc:
                # Cenário 3: Conciliação Retroativa se a nota foi criada por evento previamente
                if existing_doc.criada_por_evento or existing_doc.status_importacao == "RESUMIDA_EVENTO":
                    try:
                        existing_doc.natOp = parsed.get("natOp") or existing_doc.natOp
                        existing_doc.dhEmi = parsed.get("dhEmi")
                        existing_doc.competencia = parsed.get("competencia") or existing_doc.competencia
                        existing_doc.issuer_cnpj = parsed.get("issuer_cnpj") or existing_doc.issuer_cnpj
                        existing_doc.issuer_name = parsed.get("issuer_name")
                        existing_doc.issuer_ie = parsed.get("issuer_ie")
                        existing_doc.uf_emit = parsed.get("uf_emit") or existing_doc.uf_emit
                        existing_doc.recipient_cnpj = parsed.get("recipient_cnpj")
                        existing_doc.recipient_name = parsed.get("recipient_name")
                        existing_doc.uf_dest = parsed.get("uf_dest")
                        if aplicacao:
                            existing_doc.aplicacao = aplicacao
                        if tipo_tributacao:
                            existing_doc.tipo_tributacao = tipo_tributacao
                        existing_doc.vProd = parsed.get("vProd", Decimal(0))
                        existing_doc.vNF = parsed.get("vNF", Decimal(0))
                        existing_doc.vBC = parsed.get("vBC", Decimal(0))
                        existing_doc.vICMS = parsed.get("vICMS", Decimal(0))
                        existing_doc.vBCST = parsed.get("vBCST", Decimal(0))
                        existing_doc.vICMSST = parsed.get("vICMSST", Decimal(0))
                        existing_doc.vFCP = parsed.get("vFCP", Decimal(0))
                        existing_doc.vFCPST = parsed.get("vFCPST", Decimal(0))
                        existing_doc.vIPI = parsed.get("vIPI", Decimal(0))
                        existing_doc.vPIS = parsed.get("vPIS", Decimal(0))
                        existing_doc.vCOFINS = parsed.get("vCOFINS", Decimal(0))
                        existing_doc.vFrete = parsed.get("vFrete", Decimal(0))
                        existing_doc.vSeg = parsed.get("vSeg", Decimal(0))
                        existing_doc.vDesc = parsed.get("vDesc", Decimal(0))
                        existing_doc.vOutro = parsed.get("vOutro", Decimal(0))
                        existing_doc.xml_version = parsed.get("xml_version")
                        existing_doc.xml_raw = xml_content
                        existing_doc.status_importacao = "COMPLETA"
                        existing_doc.dados_completos = True
                        existing_doc.xml_nfe_original_importado = True

                        # Limpar itens anteriores caso existam e re-inserir completos
                        db.query(FiscalDocumentItem).filter(FiscalDocumentItem.fiscal_document_id == existing_doc.id).delete()
                        db.query(FiscalDocumentInstallment).filter(FiscalDocumentInstallment.fiscal_document_id == existing_doc.id).delete()
                        db.query(FiscalDocumentPayment).filter(FiscalDocumentPayment.fiscal_document_id == existing_doc.id).delete()
                        db.flush()

                        for item_data in parsed.get("items", []):
                            item_obj = FiscalDocumentItem(
                                fiscal_document_id=existing_doc.id,
                                nItem=item_data["nItem"],
                                cProd=item_data["cProd"],
                                xProd=item_data["xProd"],
                                NCM=item_data["NCM"],
                                CFOP=item_data["CFOP"],
                                uCom=item_data["uCom"],
                                qCom=item_data["qCom"],
                                vUnCom=item_data["vUnCom"],
                                vProd=item_data["vProd"],
                                tributos=item_data["tributos"],
                            )
                            db.add(item_obj)

                        for inst_data in parsed.get("installments", []):
                            inst_obj = FiscalDocumentInstallment(
                                fiscal_document_id=existing_doc.id,
                                nDup=inst_data["nDup"],
                                dVenc=inst_data["dVenc"],
                                vDup=inst_data["vDup"],
                            )
                            db.add(inst_obj)

                        for pay_data in parsed.get("payments", []):
                            pay_obj = FiscalDocumentPayment(
                                fiscal_document_id=existing_doc.id,
                                tPag=pay_data["tPag"],
                                vPag=pay_data["vPag"],
                            )
                            db.add(pay_obj)

                        history = FiscalNfeHistory(
                            fiscal_document_id=existing_doc.id,
                            tenant_id=tenant_id,
                            user_id=user_id,
                            action="COMPLEMENTACAO_XML_ORIGINAL",
                            justification="NF-e localizada como registro resumido. Os dados da nota foram complementados com o XML original e o cancelamento anterior foi preservado.",
                            new_values={
                                "status_importacao": "COMPLETA",
                                "dados_completos": True,
                                "xml_nfe_original_importado": True
                            }
                        )
                        db.add(history)
                        db.commit()

                        imported_count += 1
                        imported_ids.append(str(existing_doc.id))
                        continue
                    except Exception as comp_err:
                        db.rollback()
                        rejected_count += 1
                        errors.append({"file_name": file_name, "access_key": access_key, "reason": str(comp_err)})
                        continue

                elif not force_reprocess:
                    duplicate_count += 1
                    errors.append(
                        {
                            "file_name": file_name,
                            "access_key": access_key,
                            "reason": "Nota fiscal já importada anteriormente.",
                            "duplicate": True,
                        }
                    )
                    continue
                else:
                    if existing_doc.analysis:
                        db.delete(existing_doc.analysis)
                    db.delete(existing_doc)
                    db.flush()

            # 4. Criar NfeAnalysis + FiscalDocument em transação
            try:
                analysis = NfeAnalysis(
                    tenant_id=tenant_id,
                    name=f"NF-e {parsed.get('nNF', '')} - {parsed.get('issuer_name', '')}",
                    xml_content=xml_content,
                    file_name=file_name,
                    file_hash=file_hash,
                    status="PROCESSED",
                    created_by=user_id,
                )
                db.add(analysis)
                db.flush()

                doc = FiscalDocument(
                    tenant_id=tenant_id,
                    nfe_analysis_id=analysis.id,
                    access_key=access_key,
                    nNF=parsed.get("nNF"),
                    serie=parsed.get("serie"),
                    mod=parsed.get("mod"),
                    natOp=parsed.get("natOp"),
                    dhEmi=parsed.get("dhEmi"),
                    competencia=parsed.get("competencia"),
                    issuer_cnpj=parsed.get("issuer_cnpj"),
                    issuer_name=parsed.get("issuer_name"),
                    issuer_ie=parsed.get("issuer_ie"),
                    uf_emit=parsed.get("uf_emit"),
                    recipient_cnpj=parsed.get("recipient_cnpj"),
                    recipient_name=parsed.get("recipient_name"),
                    uf_dest=parsed.get("uf_dest"),
                    aplicacao=aplicacao,
                    tipo_tributacao=tipo_tributacao,
                    status_classificacao="CLASSIFICADO",
                    data_classificacao=datetime.now(),
                    usuario_classificacao_id=user_id,
                    observacao_classificacao=observacao,
                    divergencia_flag=False,
                    vProd=parsed.get("vProd", Decimal(0)),
                    vNF=parsed.get("vNF", Decimal(0)),
                    vBC=parsed.get("vBC", Decimal(0)),
                    vICMS=parsed.get("vICMS", Decimal(0)),
                    vBCST=parsed.get("vBCST", Decimal(0)),
                    vICMSST=parsed.get("vICMSST", Decimal(0)),
                    vFCP=parsed.get("vFCP", Decimal(0)),
                    vFCPST=parsed.get("vFCPST", Decimal(0)),
                    vIPI=parsed.get("vIPI", Decimal(0)),
                    vPIS=parsed.get("vPIS", Decimal(0)),
                    vCOFINS=parsed.get("vCOFINS", Decimal(0)),
                    vFrete=parsed.get("vFrete", Decimal(0)),
                    vSeg=parsed.get("vSeg", Decimal(0)),
                    vDesc=parsed.get("vDesc", Decimal(0)),
                    vOutro=parsed.get("vOutro", Decimal(0)),
                    cStat=parsed.get("cStat"),
                    xMotivo=parsed.get("xMotivo"),
                    nProt=parsed.get("nProt"),
                    dhRecbto=parsed.get("dhRecbto"),
                    xml_version=parsed.get("xml_version"),
                    xml_raw=xml_content,
                )
                db.add(doc)
                db.flush()

                # Criar Itens
                for item_data in parsed.get("items", []):
                    item_obj = FiscalDocumentItem(
                        fiscal_document_id=doc.id,
                        nItem=item_data["nItem"],
                        cProd=item_data["cProd"],
                        xProd=item_data["xProd"],
                        NCM=item_data["NCM"],
                        CFOP=item_data["CFOP"],
                        uCom=item_data["uCom"],
                        qCom=item_data["qCom"],
                        vUnCom=item_data["vUnCom"],
                        vProd=item_data["vProd"],
                        tributos=item_data["tributos"],
                    )
                    db.add(item_obj)

                # Criar Duplicatas
                for inst_data in parsed.get("installments", []):
                    inst_obj = FiscalDocumentInstallment(
                        fiscal_document_id=doc.id,
                        nDup=inst_data["nDup"],
                        dVenc=inst_data["dVenc"],
                        vDup=inst_data["vDup"],
                    )
                    db.add(inst_obj)

                # Criar Pagamentos
                for pay_data in parsed.get("payments", []):
                    pay_obj = FiscalDocumentPayment(
                        fiscal_document_id=doc.id,
                        tPag=pay_data["tPag"],
                        vPag=pay_data["vPag"],
                    )
                    db.add(pay_obj)

                # Registrar histórico de auditoria
                history = FiscalNfeHistory(
                    fiscal_document_id=doc.id,
                    tenant_id=tenant_id,
                    user_id=user_id,
                    action="IMPORTACAO",
                    new_values={
                        "aplicacao": aplicacao,
                        "tipo_tributacao": tipo_tributacao,
                        "nNF": parsed.get("nNF"),
                        "access_key": access_key,
                        "file_name": file_name,
                    },
                    justification="Importação inicial de NF-e com classificação.",
                )
                db.add(history)

                db.commit()
                imported_count += 1
                classified_count += 1
                imported_ids.append(doc.id)

            except Exception as save_err:
                db.rollback()
                rejected_count += 1
                errors.append(
                    {
                        "file_name": file_name,
                        "reason": f"Erro de persistência no banco de dados: {str(save_err)}",
                    }
                )

        return {
            "total_sent": total_sent,
            "imported_count": imported_count,
            "classified_count": classified_count,
            "duplicate_count": duplicate_count,
            "rejected_count": rejected_count,
            "errors": errors,
            "imported_ids": imported_ids,
        }

    @staticmethod
    def list_monthly_documents(
        db: Session,
        tenant_id: str,
        competencia: Optional[str] = None,
        search: Optional[str] = None,
        aplicacao: Optional[str] = None,
        tipo_tributacao: Optional[str] = None,
        status_classificacao: Optional[str] = None,
        uf_emit: Optional[str] = None,
        issuer_cnpj: Optional[str] = None,
        divergencia_flag: Optional[bool] = None,
        page: int = 1,
        size: int = 20,
    ) -> Dict[str, Any]:
        """
        Retorna consulta paginada de documentos fiscais por competência mensal
        junto com indicadores agregados (cards resumidos).
        """
        query = db.query(FiscalDocument).filter(FiscalDocument.tenant_id == tenant_id)

        if competencia:
            query = query.filter(FiscalDocument.competencia == competencia)

        if aplicacao:
            query = query.filter(FiscalDocument.aplicacao == aplicacao)

        if tipo_tributacao:
            query = query.filter(FiscalDocument.tipo_tributacao == tipo_tributacao)

        if status_classificacao:
            query = query.filter(FiscalDocument.status_classificacao == status_classificacao)

        if uf_emit:
            query = query.filter(FiscalDocument.uf_emit == uf_emit.upper())

        if issuer_cnpj:
            query = query.filter(FiscalDocument.issuer_cnpj == issuer_cnpj)

        if divergencia_flag is not None:
            query = query.filter(FiscalDocument.divergencia_flag == divergencia_flag)

        if search:
            s = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    FiscalDocument.nNF.ilike(s),
                    FiscalDocument.access_key.ilike(s),
                    FiscalDocument.issuer_name.ilike(s),
                    FiscalDocument.issuer_cnpj.ilike(s),
                )
            )

        # Total de registros filtrados
        total = query.count()

        # Calcular Métricas Agregadas nos registros filtrados
        all_docs = query.all()

        total_vNF = float(sum((d.vNF or Decimal(0)) for d in all_docs))
        total_vProd = float(sum((d.vProd or Decimal(0)) for d in all_docs))
        total_vICMS = float(sum((d.vICMS or Decimal(0)) for d in all_docs))
        total_vICMSST = float(sum((d.vICMSST or Decimal(0)) for d in all_docs))
        total_vIPI = float(sum((d.vIPI or Decimal(0)) for d in all_docs))
        total_vPIS = float(sum((d.vPIS or Decimal(0)) for d in all_docs))
        total_vCOFINS = float(sum((d.vCOFINS or Decimal(0)) for d in all_docs))

        suppliers = set(d.issuer_cnpj for d in all_docs if d.issuer_cnpj)
        total_suppliers = len(suppliers)

        pending_classification_count = sum(
            1 for d in all_docs if d.status_classificacao != "CLASSIFICADO" or not d.aplicacao
        )
        divergence_count = sum(1 for d in all_docs if d.divergencia_flag)

        metrics = {
            "total_notes": total,
            "total_vNF": total_vNF,
            "total_vProd": total_vProd,
            "total_vICMS": total_vICMS,
            "total_vICMSST": total_vICMSST,
            "total_vIPI": total_vIPI,
            "total_vPIS": total_vPIS,
            "total_vCOFINS": total_vCOFINS,
            "total_suppliers": total_suppliers,
            "pending_classification_count": pending_classification_count,
            "divergence_count": divergence_count,
        }

        # Padrão de Paginação
        offset = (page - 1) * size
        items = query.order_by(desc(FiscalDocument.dhEmi)).offset(offset).limit(size).all()
        pages = (total + size - 1) // size if size > 0 else 1

        return {
            "items": items,
            "total": total,
            "page": page,
            "size": size,
            "pages": pages,
            "metrics": metrics,
        }

    @staticmethod
    def get_document_by_id(db: Session, tenant_id: str, document_id: UUID) -> Optional[FiscalDocument]:
        return (
            db.query(FiscalDocument)
            .filter(FiscalDocument.tenant_id == tenant_id, FiscalDocument.id == document_id)
            .first()
        )

    @staticmethod
    def update_classification(
        db: Session,
        tenant_id: str,
        document_id: UUID,
        aplicacao: str,
        tipo_tributacao: str,
        observacao: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> FiscalDocument:
        validate_classification(aplicacao, tipo_tributacao)

        doc = NfeAnalysisService.get_document_by_id(db, tenant_id, document_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Documento fiscal não encontrado.",
            )

        prev_values = {
            "aplicacao": doc.aplicacao,
            "tipo_tributacao": doc.tipo_tributacao,
            "status_classificacao": doc.status_classificacao,
            "observacao_classificacao": doc.observacao_classificacao,
        }

        doc.aplicacao = aplicacao
        doc.tipo_tributacao = tipo_tributacao
        doc.observacao_classificacao = observacao
        doc.status_classificacao = "CLASSIFICADO"
        doc.data_classificacao = datetime.now()
        doc.usuario_classificacao_id = user_id

        new_values = {
            "aplicacao": aplicacao,
            "tipo_tributacao": tipo_tributacao,
            "status_classificacao": "CLASSIFICADO",
            "observacao_classificacao": observacao,
        }

        # Registrar histórico
        history = FiscalNfeHistory(
            fiscal_document_id=doc.id,
            tenant_id=tenant_id,
            user_id=user_id,
            action="RECLASSIFICACAO" if prev_values["aplicacao"] else "CLASSIFICACAO",
            previous_values=prev_values,
            new_values=new_values,
            justification="Atualização de classificação fiscal do documento.",
        )
        db.add(history)
        db.commit()
        db.refresh(doc)

        return doc

    @staticmethod
    def cancel_document(
        db: Session,
        tenant_id: str,
        document_id: UUID,
        justificativa: str,
        user_id: Optional[str] = None,
    ) -> FiscalDocument:
        doc = NfeAnalysisService.get_document_by_id(db, tenant_id, document_id)
        if not doc:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Documento fiscal não encontrado.",
            )

        prev_values = {
            "aplicacao": doc.aplicacao,
            "tipo_tributacao": doc.tipo_tributacao,
            "status_classificacao": doc.status_classificacao,
            "observacao_classificacao": doc.observacao_classificacao,
        }

        doc.status_classificacao = "CANCELADA"
        doc.observacao_classificacao = f"[CANCELAMENTO FISCAL]: {justificativa}"
        doc.data_classificacao = datetime.now()
        doc.usuario_classificacao_id = user_id

        new_values = {
            "status_classificacao": "CANCELADA",
            "justificativa": justificativa,
            "user_id": user_id,
        }

        history = FiscalNfeHistory(
            fiscal_document_id=doc.id,
            tenant_id=tenant_id,
            user_id=user_id,
            action="CANCELAMENTO",
            previous_values=prev_values,
            new_values=new_values,
            justification=justificativa,
        )
        db.add(history)
        db.commit()
        db.refresh(doc)

        return doc


    @staticmethod
    def batch_update_classification(
        db: Session,
        tenant_id: str,
        document_ids: List[UUID],
        aplicacao: str,
        tipo_tributacao: str,
        observacao: Optional[str] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        validate_classification(aplicacao, tipo_tributacao)

        docs = (
            db.query(FiscalDocument)
            .filter(
                FiscalDocument.tenant_id == tenant_id,
                FiscalDocument.id.in_(document_ids),
            )
            .all()
        )

        updated_count = 0
        for doc in docs:
            prev_values = {
                "aplicacao": doc.aplicacao,
                "tipo_tributacao": doc.tipo_tributacao,
            }
            doc.aplicacao = aplicacao
            doc.tipo_tributacao = tipo_tributacao
            doc.observacao_classificacao = observacao
            doc.status_classificacao = "CLASSIFICADO"
            doc.data_classificacao = datetime.now()
            doc.usuario_classificacao_id = user_id

            history = FiscalNfeHistory(
                fiscal_document_id=doc.id,
                tenant_id=tenant_id,
                user_id=user_id,
                action="CLASSIFICACAO_LOTE",
                previous_values=prev_values,
                new_values={"aplicacao": aplicacao, "tipo_tributacao": tipo_tributacao},
                justification="Classificação em lote realizada via painel de acompanhamento.",
            )
            db.add(history)
            updated_count += 1

        db.commit()

        return {
            "total_requested": len(document_ids),
            "updated_count": updated_count,
            "aplicacao": aplicacao,
            "tipo_tributacao": tipo_tributacao,
        }

    @staticmethod
    def get_document_histories(db: Session, tenant_id: str, document_id: UUID) -> List[FiscalNfeHistory]:
        return (
            db.query(FiscalNfeHistory)
            .filter(
                FiscalNfeHistory.tenant_id == tenant_id,
                FiscalNfeHistory.fiscal_document_id == document_id,
            )
            .order_by(desc(FiscalNfeHistory.created_at))
            .all()
        )

    @staticmethod
    def get_available_competencias(db: Session, tenant_id: str) -> List[str]:
        """
        Retorna a lista de competências (YYYY-MM) que possuem documentos fiscais gravados no banco.
        """
        results = (
            db.query(FiscalDocument.competencia)
            .filter(
                FiscalDocument.tenant_id == tenant_id,
                FiscalDocument.competencia.isnot(None),
                FiscalDocument.competencia != "",
            )
            .distinct()
            .order_by(desc(FiscalDocument.competencia))
            .all()
        )
        return [r[0] for r in results if r[0]]

    @staticmethod
    def get_monthly_summary_reports(db: Session, tenant_id: str, competencia: str) -> Dict[str, Any]:
        """
        Retorna consolidados agrupados por Aplicação, Tributação, Fornecedor, CFOP e NCM.
        """
        docs = (
            db.query(FiscalDocument)
            .filter(
                FiscalDocument.tenant_id == tenant_id,
                FiscalDocument.competencia == competencia,
            )
            .all()
        )

        by_aplicacao: Dict[str, Dict[str, Any]] = {}
        by_tributacao: Dict[str, Dict[str, Any]] = {}
        by_supplier: Dict[str, Dict[str, Any]] = {}

        for d in docs:
            # Por Aplicação
            ap = d.aplicacao or "NAO_CLASSIFICADO"
            if ap not in by_aplicacao:
                by_aplicacao[ap] = {"count": 0, "total_vNF": Decimal(0), "total_vProd": Decimal(0)}
            by_aplicacao[ap]["count"] += 1
            by_aplicacao[ap]["total_vNF"] += d.vNF or Decimal(0)
            by_aplicacao[ap]["total_vProd"] += d.vProd or Decimal(0)

            # Por Tributação
            trib = d.tipo_tributacao or "NAO_CLASSIFICADO"
            if trib not in by_tributacao:
                by_tributacao[trib] = {"count": 0, "total_vNF": Decimal(0), "total_vICMS": Decimal(0), "total_vICMSST": Decimal(0)}
            by_tributacao[trib]["count"] += 1
            by_tributacao[trib]["total_vNF"] += d.vNF or Decimal(0)
            by_tributacao[trib]["total_vICMS"] += d.vICMS or Decimal(0)
            by_tributacao[trib]["total_vICMSST"] += d.vICMSST or Decimal(0)

            # Por Fornecedor
            cnpj = d.issuer_cnpj or "SEM_CNPJ"
            if cnpj not in by_supplier:
                by_supplier[cnpj] = {
                    "issuer_name": d.issuer_name,
                    "uf_emit": d.uf_emit,
                    "count": 0,
                    "total_vNF": Decimal(0),
                    "total_vICMS": Decimal(0),
                    "total_vICMSST": Decimal(0),
                }
            by_supplier[cnpj]["count"] += 1
            by_supplier[cnpj]["total_vNF"] += d.vNF or Decimal(0)
            by_supplier[cnpj]["total_vICMS"] += d.vICMS or Decimal(0)
            by_supplier[cnpj]["total_vICMSST"] += d.vICMSST or Decimal(0)

        # Agrupamento por CFOP e NCM via FiscalDocumentItem
        doc_ids = [d.id for d in docs]

        by_cfop: Dict[str, Dict[str, Any]] = {}
        by_ncm: Dict[str, Dict[str, Any]] = {}

        if doc_ids:
            items = (
                db.query(FiscalDocumentItem)
                .filter(FiscalDocumentItem.fiscal_document_id.in_(doc_ids))
                .all()
            )
            for item in items:
                cfop = item.CFOP or "N/I"
                if cfop not in by_cfop:
                    by_cfop[cfop] = {"item_count": 0, "total_vProd": Decimal(0)}
                by_cfop[cfop]["item_count"] += 1
                by_cfop[cfop]["total_vProd"] += item.vProd or Decimal(0)

                ncm = item.NCM or "N/I"
                if ncm not in by_ncm:
                    by_ncm[ncm] = {"item_count": 0, "total_vProd": Decimal(0)}
                by_ncm[ncm]["item_count"] += 1
                by_ncm[ncm]["total_vProd"] += item.vProd or Decimal(0)

        return {
            "competencia": competencia,
            "total_notes": len(docs),
            "by_aplicacao": by_aplicacao,
            "by_tributacao": by_tributacao,
            "by_supplier": list(by_supplier.values()),
            "by_cfop": by_cfop,
            "by_ncm": by_ncm,
        }

    @staticmethod
    def delete_document(db: Session, tenant_id: str, document_id: UUID, user_id: Optional[str] = None) -> bool:
        doc = NfeAnalysisService.get_document_by_id(db, tenant_id, document_id)
        if not doc:
            return False

        if doc.analysis:
            db.delete(doc.analysis)
        db.delete(doc)
        db.commit()
        return True

    @staticmethod
    def delete_analysis(db: Session, tenant_id: str, analysis_id: UUID) -> bool:
        analysis = (
            db.query(NfeAnalysis)
            .filter(NfeAnalysis.tenant_id == tenant_id, NfeAnalysis.id == analysis_id)
            .first()
        )
        if not analysis:
            return False

        if analysis.fiscal_document:
            db.delete(analysis.fiscal_document)
        db.delete(analysis)
        db.commit()
        return True
