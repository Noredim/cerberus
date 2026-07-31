import re
import xml.etree.ElementTree as ET
from datetime import datetime
from decimal import Decimal
from typing import Optional

UF_CODES = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO",
    "21": "MA", "22": "PI", "23": "CE", "24": "RN", "25": "PB", "26": "PE", "27": "AL",
    "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR",
    "42": "SC", "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF"
}


class AccessKeyParser:
    @staticmethod
    def parse_access_key(access_key: str) -> dict:
        """
        Extrai os dados estruturais contidos na chave de acesso de 44 dígitos da NF-e.
        """
        if not access_key or len(access_key) != 44 or not access_key.isdigit():
            raise ValueError(f"Chave de acesso inválida: '{access_key}'. Deve conter exatamente 44 dígitos numéricos.")
        
        codigo_uf = access_key[0:2]
        uf_str = UF_CODES.get(codigo_uf, "UF")
        
        aamm = access_key[2:6]  # e.g., '2607'
        ano = f"20{aamm[0:2]}"
        mes = aamm[2:4]
        ano_mes_emissao = f"{ano}-{mes}"
        
        cnpj_emitente = access_key[6:20]
        modelo = access_key[20:22]
        serie = str(int(access_key[22:25]))
        numero_nfe = str(int(access_key[25:34]))
        tipo_emissao = access_key[34:35]
        codigo_numerico = access_key[35:43]
        digito_verificador = access_key[43:44]
        
        return {
            "access_key": access_key,
            "codigo_uf": codigo_uf,
            "uf_emit": uf_str,
            "aamm": aamm,
            "ano_mes_emissao": ano_mes_emissao,
            "cnpj_emitente": cnpj_emitente,
            "modelo": modelo,
            "serie": serie,
            "numero_nfe": numero_nfe,
            "tipo_emissao": tipo_emissao,
            "codigo_numerico": codigo_numerico,
            "digito_verificador": digito_verificador
        }


class NFeEventXmlParser:
    CONFIRMED_STATUS_CODES = {"135", "101", "155"}

    @staticmethod
    def parse_event_xml(xml_content: str) -> dict:
        """
        Parser para arquivos XML de evento da SEFAZ (<procEventoNFe> ou <evento>).
        Suporta o evento 110111 (Cancelamento de NF-e).
        """
        if "<!ENTITY" in xml_content or "<!DOCTYPE" in xml_content:
            raise ValueError("Conteúdo XML inválido ou inseguro (contém declarações ENTITY/DOCTYPE).")

        try:
            if isinstance(xml_content, str):
                cleaned = xml_content.lstrip("\ufeff")
                root = ET.fromstring(cleaned.encode("utf-8"))
            else:
                root = ET.fromstring(xml_content)
        except Exception as e:
            raise ValueError(f"XML de evento inválido: {str(e)}")

        def find_node(node, local_name):
            if NFeXmlParser.clean_tag(node.tag) == local_name:
                return node
            for child in node:
                res = find_node(child, local_name)
                if res is not None:
                    return res
            return None

        def get_text(parent, local_name):
            if parent is None:
                return None
            n = find_node(parent, local_name)
            return n.text.strip() if (n is not None and n.text) else None

        inf_evento = find_node(root, "infEvento")
        if inf_evento is None:
            raise ValueError("Grupo infEvento não localizado no XML do evento.")

        tp_evento = get_text(inf_evento, "tpEvento")
        if not tp_evento:
            raise ValueError("Tipo de evento (tpEvento) não localizado no XML.")

        if tp_evento != "110111":
            raise ValueError(f"O tipo de evento '{tp_evento}' não é suportado pelo sistema. Evento suportado no momento: 110111 (Cancelamento de NF-e).")

        ch_nfe = get_text(inf_evento, "chNFe")
        if not ch_nfe or len(ch_nfe) != 44:
            raise ValueError("Chave de acesso da NF-e (chNFe) não localizada ou inválida no evento.")

        author_cnpj = get_text(inf_evento, "CNPJ") or get_text(inf_evento, "CPF")
        dh_evento_raw = get_text(inf_evento, "dhEvento")
        dh_evento = NFeXmlParser.parse_nfe_date(dh_evento_raw)
        n_seq_evento = int(get_text(inf_evento, "nSeqEvento") or "1")
        desc_evento = get_text(inf_evento, "descEvento") or "Cancelamento"
        n_prot_req = get_text(inf_evento, "nProt")
        x_just = get_text(inf_evento, "xJust")
        tp_amb = get_text(inf_evento, "tpAmb")
        c_orgao = get_text(inf_evento, "cOrgao")

        # Dados da resposta da SEFAZ (retEvento / infEvento)
        ret_inf_evento = None
        ret_evento_node = find_node(root, "retEvento")
        if ret_evento_node is not None:
            ret_inf_evento = find_node(ret_evento_node, "infEvento")

        c_stat = get_text(ret_inf_evento, "cStat") if ret_inf_evento is not None else get_text(root, "cStat")
        x_motivo = get_text(ret_inf_evento, "xMotivo") if ret_inf_evento is not None else get_text(root, "xMotivo")
        n_prot_reg = get_text(ret_inf_evento, "nProt") if ret_inf_evento is not None else n_prot_req
        dh_reg_evento_raw = get_text(ret_inf_evento, "dhRegEvento") if ret_inf_evento is not None else dh_evento_raw
        dh_reg_evento = NFeXmlParser.parse_nfe_date(dh_reg_evento_raw) or dh_evento

        is_confirmed = c_stat in NFeEventXmlParser.CONFIRMED_STATUS_CODES if c_stat else True

        key_info = AccessKeyParser.parse_access_key(ch_nfe)

        return {
            "document_type": "NFE_EVENT",
            "event_type": tp_evento,
            "access_key": ch_nfe,
            "author_cnpj": author_cnpj,
            "event_datetime": dh_evento,
            "registration_datetime": dh_reg_evento,
            "event_sequence": n_seq_evento,
            "event_description": desc_evento,
            "request_protocol": n_prot_req,
            "registration_protocol": n_prot_reg,
            "justification": x_just,
            "cStat": c_stat or "135",
            "xMotivo": x_motivo or "Evento registrado e vinculado a NF-e",
            "tpAmb": tp_amb,
            "cOrgao": c_orgao,
            "is_confirmed": is_confirmed,
            "access_key_info": key_info,
            "raw_xml": xml_content
        }


class NFeXmlParser:
    @staticmethod
    def parse_nfe_date(date_str: Optional[str]) -> Optional[datetime]:
        if not date_str:
            return None
        cleaned = date_str.strip()
        try:
            val = cleaned.replace("Z", "+00:00")
            return datetime.fromisoformat(val)
        except Exception:
            pass

        formats = [
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d",
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(cleaned, fmt)
            except Exception:
                pass

        match = re.search(r"(\d{4})[-/](\d{2})[-/](\d{2})", cleaned)
        if match:
            try:
                return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            except Exception:
                pass
        return None

    @staticmethod
    def clean_tag(tag: Optional[str]) -> str:
        if not tag or not isinstance(tag, str):
            return ""
        if tag.startswith("{"):
            return tag.split("}", 1)[1]
        return tag

    @staticmethod
    def parse_xml(xml_content: str) -> dict:
        # XXE protection: reject DTDs and ENTITY declarations
        if "<!ENTITY" in xml_content or "<!DOCTYPE" in xml_content:
            raise ValueError("Conteúdo XML inválido ou inseguro (contém declarações ENTITY/DOCTYPE).")

        try:
            if isinstance(xml_content, str):
                cleaned = xml_content.lstrip("\ufeff")
                root = ET.fromstring(cleaned.encode("utf-8"))
            else:
                root = ET.fromstring(xml_content)
        except Exception as e:
            raise ValueError(f"XML inválido: {str(e)}")

        # Check if root is an event XML instead of full NFe
        root_tag = NFeXmlParser.clean_tag(root.tag)
        if "evento" in root_tag.lower() or "procevento" in root_tag.lower():
            return NFeEventXmlParser.parse_event_xml(xml_content)

        # Helper functions to locate tags ignoring namespaces
        def find_node_by_local_name(node, local_name):
            if node is None:
                return None
            if NFeXmlParser.clean_tag(node.tag) == local_name:
                return node
            for child in node:
                res = find_node_by_local_name(child, local_name)
                if res is not None:
                    return res
            return None

        def find_all_nodes_by_local_name(parent, local_name):
            if parent is None:
                return []
            matches = []
            for child in parent:
                if NFeXmlParser.clean_tag(child.tag) == local_name:
                    matches.append(child)
                matches.extend(find_all_nodes_by_local_name(child, local_name))
            return matches

        def get_child_text(parent, local_name):
            child = find_node_by_local_name(parent, local_name)
            return child.text if child is not None else None

        inf_nfe_node = find_node_by_local_name(root, "infNFe")
        if inf_nfe_node is None:
            raise ValueError("Grupo infNFe não encontrado no XML.")

        # Access Key (Id attribute of infNFe)
        access_key = inf_nfe_node.attrib.get("Id", "")
        if access_key.startswith("NFe"):
            access_key = access_key[3:]

        if not access_key or len(access_key) != 44:
            raise ValueError("Chave de acesso inválida ou não localizada no XML da NF-e.")

        # Mapeamento do grupo ide
        ide_node = find_node_by_local_name(inf_nfe_node, "ide")
        if ide_node is None:
            raise ValueError("Grupo de identificação (ide) não encontrado no XML.")

        nNF = get_child_text(ide_node, "nNF")
        serie = get_child_text(ide_node, "serie")
        mod = get_child_text(ide_node, "mod")
        natOp = get_child_text(ide_node, "natOp")
        tpNF = get_child_text(ide_node, "tpNF")
        finNFe = get_child_text(ide_node, "finNFe")
        
        dhEmi_raw = get_child_text(ide_node, "dhEmi") or get_child_text(ide_node, "dEmi")
        dhEmi = NFeXmlParser.parse_nfe_date(dhEmi_raw)
        competencia = dhEmi.strftime("%Y-%m") if dhEmi else datetime.now().strftime("%Y-%m")

        # Emitente
        emit_node = find_node_by_local_name(inf_nfe_node, "emit")
        issuer_cnpj = get_child_text(emit_node, "CNPJ") if emit_node is not None else None
        issuer_name = get_child_text(emit_node, "xNome") if emit_node is not None else None
        issuer_ie = get_child_text(emit_node, "IE") if emit_node is not None else None
        ender_emit_node = find_node_by_local_name(emit_node, "enderEmit") if emit_node is not None else None
        uf_emit = get_child_text(ender_emit_node, "UF") if ender_emit_node is not None else None

        # Destinatário
        dest_node = find_node_by_local_name(inf_nfe_node, "dest")
        recipient_cnpj = (get_child_text(dest_node, "CNPJ") or get_child_text(dest_node, "CPF")) if dest_node is not None else None
        recipient_name = get_child_text(dest_node, "xNome") if dest_node is not None else None
        ender_dest_node = find_node_by_local_name(dest_node, "enderDest") if dest_node is not None else None
        uf_dest = get_child_text(ender_dest_node, "UF") if ender_dest_node is not None else None

        # Totais
        total_node = find_node_by_local_name(inf_nfe_node, "total")
        icms_tot_node = find_node_by_local_name(total_node, "ICMSTot") if total_node is not None else None

        def to_dec(val_str):
            if not val_str:
                return Decimal("0.00")
            try:
                return Decimal(val_str.strip())
            except Exception:
                return Decimal("0.00")

        vBC = to_dec(get_child_text(icms_tot_node, "vBC"))
        vICMS = to_dec(get_child_text(icms_tot_node, "vICMS"))
        vBCST = to_dec(get_child_text(icms_tot_node, "vBCST"))
        vICMSST = to_dec(get_child_text(icms_tot_node, "vICMSST"))
        vFCP = to_dec(get_child_text(icms_tot_node, "vFCP"))
        vFCPST = to_dec(get_child_text(icms_tot_node, "vFCPST"))
        vIPI = to_dec(get_child_text(icms_tot_node, "vIPI"))
        vPIS = to_dec(get_child_text(icms_tot_node, "vPIS"))
        vCOFINS = to_dec(get_child_text(icms_tot_node, "vCOFINS"))
        vProd = to_dec(get_child_text(icms_tot_node, "vProd"))
        vFrete = to_dec(get_child_text(icms_tot_node, "vFrete"))
        vSeg = to_dec(get_child_text(icms_tot_node, "vSeg"))
        vDesc = to_dec(get_child_text(icms_tot_node, "vDesc"))
        vOutro = to_dec(get_child_text(icms_tot_node, "vOutro"))
        vNF = to_dec(get_child_text(icms_tot_node, "vNF"))

        # SEFAZ Protocol
        prot_nfe_node = find_node_by_local_name(root, "protNFe")
        inf_prot_node = find_node_by_local_name(prot_nfe_node, "infProt") if prot_nfe_node is not None else None
        cStat = get_child_text(inf_prot_node, "cStat")
        xMotivo = get_child_text(inf_prot_node, "xMotivo")
        nProt = get_child_text(inf_prot_node, "nProt")
        dhRecbto_raw = get_child_text(inf_prot_node, "dhRecbto")
        dhRecbto = NFeXmlParser.parse_nfe_date(dhRecbto_raw)

        # Itens (det)
        items = []
        det_nodes = find_all_nodes_by_local_name(inf_nfe_node, "det")
        for det in det_nodes:
            nItem_attr = det.attrib.get("nItem", "1")
            try:
                nItem = int(nItem_attr)
            except ValueError:
                nItem = 1

            prod_node = find_node_by_local_name(det, "prod")
            cProd = get_child_text(prod_node, "cProd")
            xProd = get_child_text(prod_node, "xProd")
            NCM = get_child_text(prod_node, "NCM")
            CFOP = get_child_text(prod_node, "CFOP")
            uCom = get_child_text(prod_node, "uCom")
            qCom = to_dec(get_child_text(prod_node, "qCom"))
            vUnCom = to_dec(get_child_text(prod_node, "vUnCom"))
            vProd_item = to_dec(get_child_text(prod_node, "vProd"))

            # Impostos do item
            imposto_node = find_node_by_local_name(det, "imposto")
            tributos_item = {}

            if imposto_node is not None:
                icms_group = find_node_by_local_name(imposto_node, "ICMS")
                if icms_group is not None and len(icms_group) > 0:
                    icms_child = icms_group[0]
                    icms_tag_name = NFeXmlParser.clean_tag(icms_child.tag)
                    orig_val = get_child_text(icms_child, "orig")
                    cst_val = get_child_text(icms_child, "CST") or get_child_text(icms_child, "CSOSN")
                    csosn_val = get_child_text(icms_child, "CSOSN")
                    vbc_val = float(to_dec(get_child_text(icms_child, "vBC")))
                    picms_val = float(to_dec(get_child_text(icms_child, "pICMS")))
                    vicms_val = float(to_dec(get_child_text(icms_child, "vICMS")))
                    vbcst_val = float(to_dec(get_child_text(icms_child, "vBCST")))
                    pst_val = float(to_dec(get_child_text(icms_child, "pST")))
                    vicmsst_val = float(to_dec(get_child_text(icms_child, "vICMSST")))

                    icms_dict = {
                        "tipo": icms_tag_name,
                        "orig": orig_val,
                        "CST": cst_val,
                        "CSOSN": csosn_val,
                        "vBC": vbc_val,
                        "pICMS": picms_val,
                        "vICMS": vicms_val,
                        "vBCST": vbcst_val,
                        "pST": pst_val,
                        "vICMSST": vicmsst_val
                    }
                    tributos_item["ICMS"] = {icms_tag_name: icms_dict}
                    tributos_item["vICMS"] = vicms_val
                    tributos_item["pICMS"] = picms_val
                    tributos_item["vBC"] = vbc_val

                ipi_group = find_node_by_local_name(imposto_node, "IPI")
                if ipi_group is not None:
                    ipi_trib = find_node_by_local_name(ipi_group, "IPITrib") or find_node_by_local_name(ipi_group, "IPINT")
                    if ipi_trib is not None:
                        ipi_tag_name = NFeXmlParser.clean_tag(ipi_trib.tag)
                        cst_ipi = get_child_text(ipi_trib, "CST")
                        vbc_ipi = float(to_dec(get_child_text(ipi_trib, "vBC")))
                        pipi_val = float(to_dec(get_child_text(ipi_trib, "pIPI")))
                        vipi_val = float(to_dec(get_child_text(ipi_trib, "vIPI")))

                        ipi_dict = {
                            "CST": cst_ipi,
                            "vBC": vbc_ipi,
                            "pIPI": pipi_val,
                            "vIPI": vipi_val
                        }
                        tributos_item["IPI"] = {ipi_tag_name: ipi_dict}
                        tributos_item["vIPI"] = vipi_val
                        tributos_item["pIPI"] = pipi_val

                pis_group = find_node_by_local_name(imposto_node, "PIS")
                if pis_group is not None and len(pis_group) > 0:
                    pis_child = pis_group[0]
                    pis_tag_name = NFeXmlParser.clean_tag(pis_child.tag)
                    cst_pis = get_child_text(pis_child, "CST")
                    vbc_pis = float(to_dec(get_child_text(pis_child, "vBC")))
                    ppis_val = float(to_dec(get_child_text(pis_child, "pPIS")))
                    vpis_val = float(to_dec(get_child_text(pis_child, "vPIS")))

                    pis_dict = {
                        "CST": cst_pis,
                        "vBC": vbc_pis,
                        "pPIS": ppis_val,
                        "vPIS": vpis_val
                    }
                    tributos_item["PIS"] = {pis_tag_name: pis_dict}
                    tributos_item["vPIS"] = vpis_val
                    tributos_item["pPIS"] = ppis_val

                cofins_group = find_node_by_local_name(imposto_node, "COFINS")
                if cofins_group is not None and len(cofins_group) > 0:
                    cofins_child = cofins_group[0]
                    cofins_tag_name = NFeXmlParser.clean_tag(cofins_child.tag)
                    cst_cofins = get_child_text(cofins_child, "CST")
                    vbc_cofins = float(to_dec(get_child_text(cofins_child, "vBC")))
                    pcofins_val = float(to_dec(get_child_text(cofins_child, "pCOFINS")))
                    vcofins_val = float(to_dec(get_child_text(cofins_child, "vCOFINS")))

                    cofins_dict = {
                        "CST": cst_cofins,
                        "vBC": vbc_cofins,
                        "pCOFINS": pcofins_val,
                        "vCOFINS": vcofins_val
                    }
                    tributos_item["COFINS"] = {cofins_tag_name: cofins_dict}
                    tributos_item["vCOFINS"] = vcofins_val
                    tributos_item["pCOFINS"] = pcofins_val

                ibscbs_group = find_node_by_local_name(imposto_node, "IBSCBS")
                if ibscbs_group is not None:
                    gibscbs_node = find_node_by_local_name(ibscbs_group, "gIBSCBS")
                    gibsuf_node = find_node_by_local_name(gibscbs_node, "gIBSUF") if gibscbs_node is not None else None
                    gcbs_node = find_node_by_local_name(gibscbs_node, "gCBS") if gibscbs_node is not None else None

                    cst_ibscbs = get_child_text(ibscbs_group, "CST")
                    cclass_trib = get_child_text(ibscbs_group, "cClassTrib")
                    vbc_ibscbs = float(to_dec(get_child_text(gibscbs_node, "vBC")))
                    p_ibs_val = float(to_dec(get_child_text(gibsuf_node, "pIBSUF")))
                    v_ibs_val = float(to_dec(get_child_text(gibscbs_node, "vIBS") or get_child_text(gibsuf_node, "vIBSUF")))
                    p_cbs_val = float(to_dec(get_child_text(gcbs_node, "pCBS")))
                    v_cbs_val = float(to_dec(get_child_text(gcbs_node, "vCBS")))

                    tributos_item["IBSCBS"] = {
                        "CST": cst_ibscbs,
                        "cClassTrib": cclass_trib,
                        "vBC": vbc_ibscbs,
                        "gIBSCBS": {
                            "vBC": vbc_ibscbs,
                            "vIBS": v_ibs_val,
                            "pIBS": p_ibs_val,
                            "gIBSUF": {
                                "pIBSUF": p_ibs_val,
                                "vIBSUF": v_ibs_val
                            },
                            "gCBS": {
                                "vBC": vbc_ibscbs,
                                "pCBS": p_cbs_val,
                                "vCBS": v_cbs_val
                            }
                        }
                    }
                    tributos_item["vIBS"] = v_ibs_val
                    tributos_item["pIBS"] = p_ibs_val
                    tributos_item["vCBS"] = v_cbs_val
                    tributos_item["pCBS"] = p_cbs_val

            items.append({
                "nItem": nItem,
                "cProd": cProd,
                "xProd": xProd,
                "NCM": NCM,
                "CFOP": CFOP,
                "uCom": uCom,
                "qCom": qCom,
                "vUnCom": vUnCom,
                "vProd": vProd_item,
                "tributos": tributos_item
            })

        # Duplicatas (cobr -> dup)
        installments = []
        cobr_node = find_node_by_local_name(inf_nfe_node, "cobr")
        if cobr_node is not None:
            dup_nodes = find_all_nodes_by_local_name(cobr_node, "dup")
            for dup in dup_nodes:
                nDup = get_child_text(dup, "nDup")
                dVenc_raw = get_child_text(dup, "dVenc")
                dVenc = None
                if dVenc_raw:
                    dt = NFeXmlParser.parse_nfe_date(dVenc_raw)
                    if dt:
                        dVenc = dt.date()
                vDup = to_dec(get_child_text(dup, "vDup"))
                installments.append({
                    "nDup": nDup,
                    "dVenc": dVenc,
                    "vDup": vDup
                })

        # Formas de Pagamento (pag -> detPag)
        payments = []
        pag_node = find_node_by_local_name(inf_nfe_node, "pag")
        if pag_node is not None:
            det_pag_nodes = find_all_nodes_by_local_name(pag_node, "detPag")
            for det_pag in det_pag_nodes:
                tPag = get_child_text(det_pag, "tPag")
                vPag = to_dec(get_child_text(det_pag, "vPag"))
                payments.append({
                    "tPag": tPag,
                    "vPag": vPag
                })

        return {
            "document_type": "NFE",
            "access_key": access_key,
            "nNF": nNF,
            "serie": serie,
            "mod": mod,
            "natOp": natOp,
            "tpNF": tpNF,
            "finNFe": finNFe,
            "dhEmi": dhEmi,
            "competencia": competencia,
            "issuer_cnpj": issuer_cnpj,
            "issuer_name": issuer_name,
            "issuer_ie": issuer_ie,
            "uf_emit": uf_emit,
            "recipient_cnpj": recipient_cnpj,
            "recipient_name": recipient_name,
            "uf_dest": uf_dest,
            "vBC": vBC,
            "vICMS": vICMS,
            "vBCST": vBCST,
            "vICMSST": vICMSST,
            "vFCP": vFCP,
            "vFCPST": vFCPST,
            "vIPI": vIPI,
            "vPIS": vPIS,
            "vCOFINS": vCOFINS,
            "vProd": vProd,
            "vFrete": vFrete,
            "vSeg": vSeg,
            "vDesc": vDesc,
            "vOutro": vOutro,
            "vNF": vNF,
            "cStat": cStat,
            "xMotivo": xMotivo,
            "nProt": nProt,
            "dhRecbto": dhRecbto,
            "items": items,
            "installments": installments,
            "payments": payments,
            "xml_raw": xml_content
        }
