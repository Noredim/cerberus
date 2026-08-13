from typing import List, Dict, Any, Optional, Tuple
from decimal import Decimal, ROUND_HALF_UP
from sqlalchemy.orm import Session
import re
from sqlalchemy import func, or_, and_, literal_column, desc
from fastapi import HTTPException, status
import json

from src.modules.fiscal.models import FiscalDocument, FiscalDocumentItem, NcmRule
from src.modules.fiscal.parser import NFeXmlParser
from src.modules.ncm.models import Ncm
from src.modules.ncm_st.models import NcmStHeader, NcmStItem
from src.modules.catalog.models import State
try:
    from engines.tax_engine.logic import calcular_difal_item_formacao_preco
except ModuleNotFoundError:
    def calcular_difal_item_formacao_preco(data: dict) -> dict:
        uf_origem = (data.get("uf_origem") or "").upper()
        uf_destino = (data.get("uf_destino") or "").upper()
        operacao_interestadual = bool(uf_origem and uf_destino and uf_origem != uf_destino)
        valor_produto = float(data.get("valor_produto") or 0.0)
        aliquota_orcamento = float(data.get("aliquota_orcamento") or 0.0)
        aliquota_interna_destino = float(data.get("aliquota_interna_destino") or 0.0)
        valor_icms_st = float(data.get("valor_icms_st") or 0.0)
        valor_ipi = float(data.get("valor_ipi") or 0.0)
        valor_frete = float(data.get("valor_frete") or 0.0)

        missing = []
        if not uf_origem: missing.append("uf_origem")
        if not uf_destino: missing.append("uf_destino")

        ret = {
            "operacao_interestadual": operacao_interestadual,
            "icms_origem": 0.0,
            "valor_difal_base": 0.0,
            "diferenca_difal_st": 0.0,
            "valor_difal": 0.0,
            "custo_com_difal": 0.0,
            "is_valid": len(missing) == 0,
            "missing_fields": missing
        }

        if missing:
            return ret

        if operacao_interestadual:
            icms_origem = valor_produto * aliquota_orcamento
            ret["icms_origem"] = icms_origem
            aliquota_destino_eff = min(aliquota_interna_destino, 0.99)
            base_calculo = (valor_produto - icms_origem) / (1.0 - aliquota_destino_eff)
            valor_difal_base = (base_calculo * aliquota_destino_eff) - icms_origem
            ret["valor_difal_base"] = valor_difal_base

        tipo_orcamento = data.get("tipo_orcamento", "REVENDA")
        if tipo_orcamento == "ATIVO_IMOBILIZADO_USO_CONSUMO":
            if operacao_interestadual:
                ret["valor_difal"] = ret["valor_difal_base"]
            ret["custo_com_difal"] = valor_produto + valor_ipi + valor_frete + ret["valor_difal"]
        else:
            if data.get("criar_cenario_difal", False) and operacao_interestadual:
                diferenca = ret["valor_difal_base"] - valor_icms_st
                ret["diferenca_difal_st"] = diferenca
                ret["valor_difal"] = max(valor_icms_st + diferenca, ret["valor_difal_base"])
            ret["custo_com_difal"] = valor_produto + valor_ipi + valor_frete + ret["valor_difal"]

        return ret

from .models import TaxRecoveryAnalysis, TaxRecoveryDocument, TaxRecoveryItemResult
from .schemas import TaxRecoveryCreate, TaxRecoveryUpdate


class TaxRecoveryService:

    @staticmethod
    def _round(val: Any) -> Decimal:
        if val is None:
            return Decimal("0.0000")
        try:
            d = Decimal(str(val))
            return d.quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        except Exception:
            return Decimal("0.0000")

    @classmethod
    def create_analysis(
        cls, db: Session, tenant_id: str, user_id: str, data: TaxRecoveryCreate
    ) -> TaxRecoveryAnalysis:
        entry = (data.entry_purpose or "").strip().upper()
        dest = (data.real_destination or "").strip().upper()

        if entry == dest:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A finalidade de entrada e a destinação real da mercadoria devem ser diferentes."
            )

        analysis = TaxRecoveryAnalysis(
            tenant_id=tenant_id,
            name=data.name.strip(),
            description=data.description,
            entry_purpose=entry,
            real_destination=dest,
            status="RASCUNHO",
            created_by=user_id,
            updated_by=user_id
        )
        db.add(analysis)
        db.commit()
        db.refresh(analysis)
        return analysis

    @classmethod
    def get_analysis_or_404(cls, db: Session, tenant_id: str, analysis_id: str) -> TaxRecoveryAnalysis:
        analysis = db.query(TaxRecoveryAnalysis).filter(
            TaxRecoveryAnalysis.id == analysis_id,
            TaxRecoveryAnalysis.tenant_id == tenant_id
        ).first()
        if not analysis:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Análise de recuperação de impostos não encontrada."
            )
        return analysis

    @classmethod
    def import_xmls(
        cls, db: Session, tenant_id: str, user_id: str, analysis_id: str, xml_files: List[Tuple[str, str]]
    ) -> Dict[str, Any]:
        """
        xml_files: Lista de tuplas (filename, xml_content)
        """
        analysis = cls.get_analysis_or_404(db, tenant_id, analysis_id)

        imported_docs = []
        errors = []

        for filename, xml_content in xml_files:
            try:
                # 1. Parsing via NFeXmlParser
                parsed = NFeXmlParser.parse_xml(xml_content)
                header = parsed
                items = parsed.get("items", [])
                access_key = parsed.get("access_key")

                if not access_key:
                    errors.append({"filename": filename, "error": "Chave de acesso não identificada no XML."})
                    continue

                # 2. Localiza ou cria FiscalDocument existente no tenant
                fiscal_doc = db.query(FiscalDocument).filter(
                    FiscalDocument.tenant_id == tenant_id,
                    FiscalDocument.access_key == access_key
                ).first()

                if not fiscal_doc:
                    # Criar documento fiscal no banco
                    fiscal_doc = FiscalDocument(
                        tenant_id=tenant_id,
                        access_key=access_key,
                        nNF=header.get("nNF"),
                        serie=header.get("serie"),
                        mod=header.get("mod"),
                        natOp=header.get("natOp"),
                        dhEmi=header.get("dhEmi"),
                        issuer_cnpj=header.get("issuer_cnpj"),
                        issuer_name=header.get("issuer_name"),
                        issuer_ie=header.get("issuer_ie"),
                        uf_emit=header.get("uf_emit"),
                        recipient_cnpj=header.get("recipient_cnpj"),
                        recipient_name=header.get("recipient_name"),
                        uf_dest=header.get("uf_dest"),
                        vProd=cls._round(header.get("vProd")),
                        vNF=cls._round(header.get("vNF")),
                        vBC=cls._round(header.get("vBC")),
                        vICMS=cls._round(header.get("vICMS")),
                        vBCST=cls._round(header.get("vBCST")),
                        vICMSST=cls._round(header.get("vICMSST")),
                        vFCP=cls._round(header.get("vFCP")),
                        vFCPST=cls._round(header.get("vFCPST")),
                        vIPI=cls._round(header.get("vIPI")),
                        vPIS=cls._round(header.get("vPIS")),
                        vCOFINS=cls._round(header.get("vCOFINS")),
                        vFrete=cls._round(header.get("vFrete")),
                        vSeg=cls._round(header.get("vSeg")),
                        vDesc=cls._round(header.get("vDesc")),
                        vOutro=cls._round(header.get("vOutro")),
                        xml_raw=xml_content
                    )
                    db.add(fiscal_doc)
                    db.flush()

                    # Adicionar itens do documento
                    for idx, item_data in enumerate(items, start=1):
                        doc_item = FiscalDocumentItem(
                            fiscal_document_id=fiscal_doc.id,
                            nItem=item_data.get("nItem", idx),
                            cProd=item_data.get("cProd"),
                            xProd=item_data.get("xProd"),
                            NCM=item_data.get("NCM"),
                            CFOP=item_data.get("CFOP"),
                            uCom=item_data.get("uCom"),
                            qCom=cls._round(item_data.get("qCom")),
                            vUnCom=cls._round(item_data.get("vUnCom")),
                            vProd=cls._round(item_data.get("vProd")),
                            tributos=item_data.get("tributos", {})
                        )
                        db.add(doc_item)
                    db.flush()

                # 3. Verifica se o documento já está vinculado à análise atual
                existing_link = db.query(TaxRecoveryDocument).filter(
                    TaxRecoveryDocument.tax_recovery_id == analysis.id,
                    TaxRecoveryDocument.fiscal_document_id == fiscal_doc.id
                ).first()

                if existing_link:
                    errors.append({
                        "filename": filename,
                        "error": f"Nota Fiscal (Chave: {access_key}) já está vinculada a esta análise."
                    })
                    continue

                # 4. Criar vínculo
                rec_doc = TaxRecoveryDocument(
                    tax_recovery_id=analysis.id,
                    fiscal_document_id=fiscal_doc.id,
                    tenant_id=tenant_id,
                    calculation_status="OK",
                    icms_st_original=fiscal_doc.vICMSST or Decimal("0"),
                    difal_original=Decimal("0")  # Será preenchido/apurado no recálculo
                )
                db.add(rec_doc)
                imported_docs.append(access_key)

            except Exception as e:
                errors.append({"filename": filename, "error": f"Erro no processamento do XML: {str(e)}"})

        # Atualizar metadata da análise
        analysis.updated_by = user_id
        db.commit()
        
        cls._update_analysis_totals(db, analysis)

        return {
            "imported_count": len(imported_docs),
            "imported_keys": imported_docs,
            "errors": errors
        }

    @classmethod
    def process_analysis(cls, db: Session, tenant_id: str, user_id: str, analysis_id: str) -> TaxRecoveryAnalysis:
        analysis = cls.get_analysis_or_404(db, tenant_id, analysis_id)
        analysis.status = "EM_PROCESSAMENTO"
        analysis.updated_by = user_id
        db.commit()

        docs = db.query(TaxRecoveryDocument).filter(TaxRecoveryDocument.tax_recovery_id == analysis.id).all()

        has_pendencies = False

        for rec_doc in docs:
            fiscal_doc = db.query(FiscalDocument).filter(FiscalDocument.id == rec_doc.fiscal_document_id).first()
            if not fiscal_doc:
                continue

            # Apagar resultados de itens anteriores
            db.query(TaxRecoveryItemResult).filter(
                TaxRecoveryItemResult.tax_recovery_document_id == rec_doc.id
            ).delete()

            items = db.query(FiscalDocumentItem).filter(
                FiscalDocumentItem.fiscal_document_id == fiscal_doc.id
            ).order_by(FiscalDocumentItem.nItem).all()

            doc_icms_st_orig = Decimal("0")
            doc_difal_orig = Decimal("0")
            doc_icms_st_recalc = Decimal("0")
            doc_difal_recalc = Decimal("0")
            doc_to_recover = Decimal("0")
            doc_to_collect = Decimal("0")

            doc_has_pendency = False

            for item in items:
                res = cls._calculate_item_scenarios(
                    db=db,
                    tenant_id=tenant_id,
                    analysis=analysis,
                    fiscal_doc=fiscal_doc,
                    item=item
                )

                item_result = TaxRecoveryItemResult(
                    tax_recovery_document_id=rec_doc.id,
                    fiscal_document_item_id=item.id,
                    nItem=item.nItem,
                    status=res["status"],
                    icms_st_original=res["icms_st_original"],
                    icms_st_recalculated=res["icms_st_recalculated"],
                    icms_st_diff=res["icms_st_diff"],
                    difal_original=res["difal_original"],
                    difal_recalculated=res["difal_recalculated"],
                    difal_diff=res["difal_diff"],
                    total_to_recover=res["total_to_recover"],
                    total_to_collect=res["total_to_collect"],
                    net_balance=res["net_balance"],
                    original_scenario_json=res["original_scenario"],
                    destination_scenario_json=res["destination_scenario"],
                    audit_memory_json=res["audit_memory"],
                    pending_reasons=res["pending_reasons"]
                )
                db.add(item_result)

                if res["status"] == "PENDENTE_PARAMETRIZACAO":
                    doc_has_pendency = True
                    has_pendencies = True

                doc_icms_st_orig += res["icms_st_original"]
                doc_difal_orig += res["difal_original"]
                doc_icms_st_recalc += res["icms_st_recalculated"]
                doc_difal_recalc += res["difal_recalculated"]
                doc_to_recover += res["total_to_recover"]
                doc_to_collect += res["total_to_collect"]

            rec_doc.icms_st_original = doc_icms_st_orig
            rec_doc.difal_original = doc_difal_orig
            rec_doc.icms_st_recalculated = doc_icms_st_recalc
            rec_doc.difal_recalculated = doc_difal_recalc
            rec_doc.total_to_recover = doc_to_recover
            rec_doc.total_to_collect = doc_to_collect
            rec_doc.net_balance = doc_to_recover - doc_to_collect
            rec_doc.calculation_status = "PENDENTE_PARAMETRIZACAO" if doc_has_pendency else "OK"

        analysis.status = "PROCESSADA_COM_PENDENCIAS" if has_pendencies else "PROCESSADA"
        analysis.updated_by = user_id
        db.commit()

        cls._update_analysis_totals(db, analysis)
        return analysis

    @classmethod
    @staticmethod
    def _extract_icms_dict(tributos: dict) -> dict:
        if not isinstance(tributos, dict):
            return {}
        icms_group = tributos.get("ICMS")
        if isinstance(icms_group, dict):
            if "vICMSST" in icms_group or "vBCST" in icms_group or "CST" in icms_group or "pICMSST" in icms_group:
                return icms_group
            for key, val in icms_group.items():
                if isinstance(val, dict):
                    return val
        return {}

    @classmethod
    def _lookup_mva(cls, db: Session, tenant_id: str, ncm_code: Optional[str], uf_destino: Optional[str]) -> Tuple[Optional[Decimal], str]:
        if not ncm_code:
            return None, "Item sem NCM preenchido."

        ncm_clean = re.sub(r'\D', '', str(ncm_code))
        if not ncm_clean:
            return None, f"NCM inválido ({ncm_code})."

        uf_dest_upper = (uf_destino or "").upper()

        # 1. Buscar em NcmStItem + NcmStHeader + State (específico por UF)
        if uf_dest_upper:
            state_obj = db.query(State).filter(
                State.tenant_id == tenant_id,
                func.upper(State.sigla) == uf_dest_upper
            ).first()

            if state_obj:
                match = db.query(NcmStItem).join(NcmStHeader).filter(
                    NcmStHeader.tenant_id == tenant_id,
                    NcmStHeader.state_id == state_obj.id,
                    NcmStHeader.is_active == True,
                    NcmStItem.is_active == True,
                    func.length(NcmStItem.ncm_normalizado) >= 4,
                    literal_column(f"'{ncm_clean}'").like(func.concat(NcmStItem.ncm_normalizado, '%'))
                ).order_by(desc(func.length(NcmStItem.ncm_normalizado))).first()

                if match and match.mva_percent is not None:
                    mva_val = Decimal(str(match.mva_percent))
                    if mva_val > Decimal("1.0"):
                        mva_val = mva_val / Decimal("100")
                    return mva_val, f"Regra MVA ({mva_val * 100:.2f}%) localizada no cadastro de NCM-ST (UF: {uf_dest_upper})."

        # 2. Buscar em NcmRule por NCM e UF
        ncm_rule = db.query(NcmRule).filter(
            NcmRule.ncm == ncm_clean,
            func.upper(NcmRule.uf) == uf_dest_upper
        ).first()

        if ncm_rule and ncm_rule.mva is not None:
            mva_val = Decimal(str(ncm_rule.mva))
            if mva_val > Decimal("1.0"):
                mva_val = mva_val / Decimal("100")
            return mva_val, f"Regra MVA ({mva_val * 100:.2f}%) localizada no NcmRule."

        # 3. Buscar em NcmStItem por prefixo de NCM em qualquer tabela ativa do tenant
        match_fallback = db.query(NcmStItem).join(NcmStHeader).filter(
            NcmStHeader.tenant_id == tenant_id,
            NcmStHeader.is_active == True,
            NcmStItem.is_active == True,
            func.length(NcmStItem.ncm_normalizado) >= 4,
            literal_column(f"'{ncm_clean}'").like(func.concat(NcmStItem.ncm_normalizado, '%'))
        ).order_by(desc(func.length(NcmStItem.ncm_normalizado))).first()

        if match_fallback and match_fallback.mva_percent is not None:
            mva_val = Decimal(str(match_fallback.mva_percent))
            if mva_val > Decimal("1.0"):
                mva_val = mva_val / Decimal("100")
            return mva_val, f"Regra MVA ({mva_val * 100:.2f}%) localizada no cadastro NCM ST (Global)."

        return None, f"Regra de MVA/ST não cadastrada para NCM {ncm_code} na UF {uf_destino}."

    @classmethod
    def _calculate_item_scenarios(
        cls, db: Session, tenant_id: str, analysis: TaxRecoveryAnalysis, fiscal_doc: FiscalDocument, item: FiscalDocumentItem
    ) -> Dict[str, Any]:
        tributos = item.tributos or {}
        icms_data = cls._extract_icms_dict(tributos)
        
        # 1. Extração de valores destacados na NF-e original (XML)
        vICMSST_xml = cls._round(icms_data.get("vICMSST") or tributos.get("vICMSST") or 0)
        vBCST_orig = cls._round(icms_data.get("vBCST") or tributos.get("vBCST") or 0)
        pICMSST_orig = cls._round(icms_data.get("pICMSST") or icms_data.get("pST") or 0)
        
        vBC_orig = cls._round(icms_data.get("vBC") or item.vProd or 0)
        pICMS_orig = cls._round(icms_data.get("pICMS") or 0)
        vICMS_orig = cls._round(icms_data.get("vICMS") or 0)

        difal_xml = tributos.get("ICMSUFDest", {})
        vDIFAL_orig = cls._round(difal_xml.get("vICMSUFDest") or 0)

        uf_origem = (fiscal_doc.uf_emit or "").upper()
        uf_destino = (fiscal_doc.uf_dest or "").upper()
        is_interestadual = (uf_origem != uf_destino) and bool(uf_origem) and bool(uf_destino)

        pending_reasons = []
        audit_steps = []

        audit_steps.append(f"Finalidade Entrada Original: {analysis.entry_purpose} | Destinação Real: {analysis.real_destination}")
        audit_steps.append(f"Operação: {uf_origem} -> {uf_destino} (Interestadual: {'Sim' if is_interestadual else 'Não'})")

        # Função interna para cálculo de ICMS-ST para finalidade REVENDA (Engine Oficial Cerberus / MT)
        def calc_st_for_revenda(target_uf: str) -> Tuple[Decimal, Optional[Decimal], Optional[str], List[str]]:
            mva, mva_msg = cls._lookup_mva(db, tenant_id, item.NCM, target_uf)
            steps = [mva_msg]
            if mva is None:
                return Decimal("0"), None, mva_msg, steps

            ALIQ_INTERNA_DESTINO = Decimal("0.17") if target_uf == "MT" else Decimal("0.18")
            DESCONTO_CREDITO_OUTORGADO = Decimal("0.12") if target_uf == "MT" else Decimal("0.0")

            # Crédito de entrada efetivo (Regra MT / Engine Cerberus: se > 4%, usa 7% de crédito efetivo na ST)
            pICMS_float = float(pICMS_orig or 0)
            if target_uf == "MT":
                icms_entrada_effective = pICMS_float if (pICMS_float > 0 and pICMS_float <= 4.0) else 7.0
            else:
                icms_entrada_effective = pICMS_float if pICMS_float > 0 else 12.0

            cred = Decimal(str(icms_entrada_effective)) / Decimal("100")

            vProd_val = Decimal(str(item.vProd or 0))
            vIPI_val = Decimal(str(tributos.get("IPI", {}).get("vIPI") or 0))
            base_calculo = vProd_val + vIPI_val

            base_st = base_calculo * (Decimal("1") + mva)
            icms_proprio_deduzido = vProd_val * cred
            icms_st_bruto = (base_st * ALIQ_INTERNA_DESTINO) - icms_proprio_deduzido
            icms_st_protegido = max(Decimal("0"), icms_st_bruto)

            st_calculated = max(Decimal("0"), icms_st_protegido * (Decimal("1") - DESCONTO_CREDITO_OUTORGADO))

            steps.append(
                f"Recálculo ST Revenda (Engine Cerberus): Base ST R$ {base_st:.2f} (MVA {mva*100:.2f}%). "
                f"ST Bruto ({ALIQ_INTERNA_DESTINO*100:.0f}% - Créd Efetivo {cred*100:.0f}%): R$ {icms_st_bruto:.2f}. "
                f"Crédito Outorgado ({DESCONTO_CREDITO_OUTORGADO*100:.0f}%): ST Final R$ {st_calculated:.2f}"
            )
            return st_calculated, mva, None, steps

        # 2. Definição dos valores do Cenário Original (Finalidade de Entrada)
        if vICMSST_xml > 0:
            vICMSST_orig = vICMSST_xml
            audit_steps.append(f"ICMS-ST de Entrada: Destacado na NF-e original (R$ {vICMSST_orig:.2f}).")
        elif analysis.entry_purpose == "REVENDA":
            st_calc, mva_val, err_msg, steps = calc_st_for_revenda(uf_destino)
            vICMSST_orig = st_calc
            audit_steps.extend(steps)
            if err_msg:
                pending_reasons.append(err_msg)
        else:
            vICMSST_orig = Decimal("0")

        original_scenario = {
            "cfop": item.CFOP,
            "cst_csosn": icms_data.get("CST") or icms_data.get("CSOSN"),
            "ncm": item.NCM,
            "vProd": float(item.vProd or 0),
            "vBC": float(vBC_orig),
            "pICMS": float(pICMS_orig),
            "vICMS": float(vICMS_orig),
            "vBCST": float(vBCST_orig),
            "pICMSST": float(pICMSST_orig),
            "vICMSST": float(vICMSST_orig),
            "vDIFAL": float(vDIFAL_orig)
        }

        # 3. Recálculo para o Cenário da Destinação Real
        dest = analysis.real_destination
        icms_st_recalc = Decimal("0")
        difal_recalc = Decimal("0")

        if dest in ("ATIVO_IMOBILIZADO", "USO_CONSUMO"):
            audit_steps.append(f"Destinação Real ({dest}): Mercadoria aplicada no uso/consumo ou ativo imobilizado.")
            icms_st_recalc = Decimal("0")  # Não há ST de revenda na destinação final
            
            if is_interestadual:
                ALIQ_INTERNA_DESTINO = Decimal("0.17") if uf_destino == "MT" else Decimal("0.18")
                aliq_origem = Decimal(str(pICMS_orig)) / Decimal("100") if pICMS_orig > 0 else Decimal("0.12")

                vProd_val = Decimal(str(item.vProd or 0))
                vIPI_val = Decimal(str(tributos.get("IPI", {}).get("vIPI") or 0))
                vFrete_val = Decimal(str(fiscal_doc.vFrete or 0)) / max(len(fiscal_doc.items or [1]), 1)

                base_com_ipi_e_frete = vProd_val + vIPI_val + vFrete_val
                c_icms_origem = base_com_ipi_e_frete * aliq_origem
                base_sem_icms = base_com_ipi_e_frete - c_icms_origem
                divisor = Decimal("1") - ALIQ_INTERNA_DESTINO

                if divisor > Decimal("0"):
                    c_base_calculo_difal = base_sem_icms / divisor
                    c_icms_destino = c_base_calculo_difal * ALIQ_INTERNA_DESTINO
                    difal_recalc = max(Decimal("0"), c_icms_destino - c_icms_origem)

                    audit_steps.append(
                        f"DIFAL Recalculado (Engine Cerberus - Base por dentro): "
                        f"Base sem ICMS R$ {base_sem_icms:.2f} / (1 - {ALIQ_INTERNA_DESTINO*100:.0f}%) = Base DIFAL R$ {c_base_calculo_difal:.2f}. "
                        f"ICMS Destino R$ {c_icms_destino:.2f} - ICMS Origem R$ {c_icms_origem:.2f} = DIFAL R$ {difal_recalc:.2f}"
                    )
            else:
                audit_steps.append("Operação interna: DIFAL não aplicável.")

        elif dest == "REVENDA":
            audit_steps.append("Destinação Real (REVENDA): Aplicável regra de ICMS-ST por MVA.")
            st_calc, mva_val, err_msg, steps = calc_st_for_revenda(uf_destino)
            icms_st_recalc = st_calc
            audit_steps.extend(steps)
            if err_msg:
                pending_reasons.append(err_msg)

        destination_scenario = {
            "real_destination": dest,
            "icms_st_recalculated": float(icms_st_recalc),
            "difal_recalculated": float(difal_recalc)
        }

        # 4. Cálculo da Diferença e Apuração de Saldos
        icms_st_diff = vICMSST_orig - icms_st_recalc
        difal_diff = vDIFAL_orig - difal_recalc

        total_to_recover = Decimal("0")
        total_to_collect = Decimal("0")

        if icms_st_diff > 0:
            total_to_recover += icms_st_diff
            audit_steps.append(f"Diferença ICMS-ST: A RECUPERAR R$ {icms_st_diff:.2f}")
        elif icms_st_diff < 0:
            total_to_collect += abs(icms_st_diff)
            audit_steps.append(f"Diferença ICMS-ST: A RECOLHER R$ {abs(icms_st_diff):.2f}")

        if difal_diff > 0:
            total_to_recover += difal_diff
            audit_steps.append(f"Diferença DIFAL: A RECUPERAR R$ {difal_diff:.2f}")
        elif difal_diff < 0:
            total_to_collect += abs(difal_diff)
            audit_steps.append(f"Diferença DIFAL: A RECOLHER R$ {abs(difal_diff):.2f}")

        net_balance = total_to_recover - total_to_collect

        if pending_reasons:
            item_status = "PENDENTE_PARAMETRIZACAO"
        elif net_balance > 0:
            item_status = "A_RECUPERAR"
        elif net_balance < 0:
            item_status = "A_RECOLHER"
        else:
            item_status = "SEM_DIFERENCA"

        audit_memory = {
            "steps": audit_steps,
            "summary": {
                "icms_st_original": float(vICMSST_orig),
                "icms_st_recalculated": float(icms_st_recalc),
                "difal_original": float(vDIFAL_orig),
                "difal_recalculated": float(difal_recalc),
                "total_to_recover": float(total_to_recover),
                "total_to_collect": float(total_to_collect),
                "net_balance": float(net_balance)
            }
        }

        return {
            "status": item_status,
            "icms_st_original": vICMSST_orig,
            "icms_st_recalculated": icms_st_recalc,
            "icms_st_diff": icms_st_diff,
            "difal_original": vDIFAL_orig,
            "difal_recalculated": difal_recalc,
            "difal_diff": difal_diff,
            "total_to_recover": total_to_recover,
            "total_to_collect": total_to_collect,
            "net_balance": net_balance,
            "original_scenario": original_scenario,
            "destination_scenario": destination_scenario,
            "audit_memory": audit_memory,
            "pending_reasons": pending_reasons
        }

    @classmethod
    def _update_analysis_totals(cls, db: Session, analysis: TaxRecoveryAnalysis):
        docs = db.query(TaxRecoveryDocument).filter(TaxRecoveryDocument.tax_recovery_id == analysis.id).all()

        total_notes_count = len(docs)
        total_notes_value = Decimal("0")
        total_icms_st_orig = Decimal("0")
        total_difal_orig = Decimal("0")
        total_icms_st_recalc = Decimal("0")
        total_difal_recalc = Decimal("0")
        total_to_recover = Decimal("0")
        total_to_collect = Decimal("0")
        pending_items_count = 0
        pending_notes_value = Decimal("0")

        for d in docs:
            fiscal_doc = db.query(FiscalDocument).filter(FiscalDocument.id == d.fiscal_document_id).first()
            if fiscal_doc:
                total_notes_value += (fiscal_doc.vNF or Decimal("0"))

            total_icms_st_orig += d.icms_st_original
            total_difal_orig += d.difal_original
            total_icms_st_recalc += d.icms_st_recalculated
            total_difal_recalc += d.difal_recalculated
            total_to_recover += d.total_to_recover
            total_to_collect += d.total_to_collect

            # Contar itens pendentes
            pending_count = db.query(func.count(TaxRecoveryItemResult.id)).filter(
                TaxRecoveryItemResult.tax_recovery_document_id == d.id,
                TaxRecoveryItemResult.status == "PENDENTE_PARAMETRIZACAO"
            ).scalar() or 0

            if pending_count > 0:
                pending_items_count += pending_count
                if fiscal_doc:
                    pending_notes_value += (fiscal_doc.vNF or Decimal("0"))

        analysis.total_notes_count = total_notes_count
        analysis.total_notes_value = total_notes_value
        analysis.total_icms_st_original = total_icms_st_orig
        analysis.total_difal_original = total_difal_orig
        analysis.total_icms_st_recalculated = total_icms_st_recalc
        analysis.total_difal_recalculated = total_difal_recalc
        analysis.total_to_recover = total_to_recover
        analysis.total_to_collect = total_to_collect
        analysis.net_balance = total_to_recover - total_to_collect
        analysis.pending_items_count = pending_items_count
        analysis.pending_notes_value = pending_notes_value

        db.commit()

    @classmethod
    def delete_analysis(cls, db: Session, tenant_id: str, analysis_id: str):
        analysis = cls.get_analysis_or_404(db, tenant_id, analysis_id)
        db.delete(analysis)
        db.commit()
