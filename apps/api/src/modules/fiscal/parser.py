import xml.etree.ElementTree as ET
from datetime import datetime
from decimal import Decimal

class NFeXmlParser:
    @staticmethod
    def clean_tag(tag: str) -> str:
        # Removes the namespace prefix, e.g. "{http://www.portalfiscal.inf.br/nfe}infNFe" -> "infNFe"
        if tag.startswith("{"):
            return tag.split("}", 1)[1]
        return tag

    @staticmethod
    def parse_xml(xml_content: str) -> dict:
        # XXE protection: reject DTDs
        if "<!ENTITY" in xml_content or "<!DOCTYPE" in xml_content:
            raise ValueError("Conteúdo XML inválido ou inseguro (contém declarações ENTITY/DOCTYPE).")

        try:
            root = ET.fromstring(xml_content)
        except Exception as e:
            raise ValueError(f"XML inválido: {str(e)}")

        # Helper functions to locate tags ignoring namespaces
        def find_node_by_local_name(node, local_name):
            if NFeXmlParser.clean_tag(node.tag) == local_name:
                return node
            for child in node:
                res = find_node_by_local_name(child, local_name)
                if res is not None:
                    return res
            return None

        def find_all_nodes_by_local_name(parent, local_name):
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
        # Remove 'NFe' prefix if exists
        if access_key.startswith("NFe"):
            access_key = access_key[3:]
        
        # Mapeamento do grupo ide
        ide_node = find_node_by_local_name(inf_nfe_node, "ide")
        if ide_node is None:
            raise ValueError("Grupo de identificação (ide) não encontrado no XML.")

        nNF = get_child_text(ide_node, "nNF")
        serie = get_child_text(ide_node, "serie")
        mod = get_child_text(ide_node, "mod")
        
        # dhEmi (datetime format) or dEmi (date format in older versions)
        dhEmi_raw = get_child_text(ide_node, "dhEmi") or get_child_text(ide_node, "dEmi")
        dhEmi = None
        if dhEmi_raw:
            try:
                val = dhEmi_raw.replace("Z", "+00:00")
                dhEmi = datetime.fromisoformat(val)
            except Exception:
                try:
                    dhEmi = datetime.strptime(dhEmi_raw, "%Y-%m-%d")
                except Exception:
                    pass

        # Mapeamento emitente
        emit_node = find_node_by_local_name(inf_nfe_node, "emit")
        issuer_cnpj = None
        issuer_name = None
        if emit_node is not None:
            issuer_cnpj = get_child_text(emit_node, "CNPJ") or get_child_text(emit_node, "CPF")
            issuer_name = get_child_text(emit_node, "xNome")

        # Mapeamento destinatário
        dest_node = find_node_by_local_name(inf_nfe_node, "dest")
        recipient_cnpj = None
        recipient_name = None
        if dest_node is not None:
            recipient_cnpj = get_child_text(dest_node, "CNPJ") or get_child_text(dest_node, "CPF")
            recipient_name = get_child_text(dest_node, "xNome")

        # Mapeamento itens (det)
        det_nodes = []
        for child in inf_nfe_node:
            if NFeXmlParser.clean_tag(child.tag) == "det":
                det_nodes.append(child)

        items = []
        for det in det_nodes:
            nItem_str = det.attrib.get("nItem")
            nItem = int(nItem_str) if nItem_str else 0

            prod_node = find_node_by_local_name(det, "prod")
            if prod_node is None:
                continue

            cProd = get_child_text(prod_node, "cProd")
            xProd = get_child_text(prod_node, "xProd")
            ncm = get_child_text(prod_node, "NCM")
            cfop = get_child_text(prod_node, "CFOP")
            uCom = get_child_text(prod_node, "uCom")
            
            qCom_str = get_child_text(prod_node, "qCom")
            qCom = Decimal(qCom_str) if qCom_str else Decimal("0")

            vUnCom_str = get_child_text(prod_node, "vUnCom")
            vUnCom = Decimal(vUnCom_str) if vUnCom_str else Decimal("0")

            vProd_str = get_child_text(prod_node, "vProd")
            vProd = Decimal(vProd_str) if vProd_str else Decimal("0")

            # Extract tributos
            imposto_node = find_node_by_local_name(det, "imposto")
            tributos_dict = {}
            if imposto_node is not None:
                def node_to_dict(node):
                    res = {}
                    children = list(node)
                    if children:
                        for child in children:
                            c_tag = NFeXmlParser.clean_tag(child.tag)
                            c_val = node_to_dict(child)
                            if c_tag in res:
                                if not isinstance(res[c_tag], list):
                                    res[c_tag] = [res[c_tag]]
                                res[c_tag].append(c_val)
                            else:
                                res[c_tag] = c_val
                    else:
                        return node.text
                    return res
                
                for child in imposto_node:
                    tag = NFeXmlParser.clean_tag(child.tag)
                    tributos_dict[tag] = node_to_dict(child)

            items.append({
                "nItem": nItem,
                "cProd": cProd,
                "xProd": xProd,
                "NCM": ncm,
                "CFOP": cfop,
                "uCom": uCom,
                "qCom": qCom,
                "vUnCom": vUnCom,
                "vProd": vProd,
                "tributos": tributos_dict
            })

        # Mapeamento cobr (duplicatas)
        installments = []
        cobr_node = find_node_by_local_name(inf_nfe_node, "cobr")
        if cobr_node is not None:
            dup_nodes = find_all_nodes_by_local_name(cobr_node, "dup")
            for dup in dup_nodes:
                nDup = get_child_text(dup, "nDup")
                dVenc_str = get_child_text(dup, "dVenc")
                vDup_str = get_child_text(dup, "vDup")
                
                vDup = Decimal(vDup_str) if vDup_str else Decimal("0")
                dVenc = None
                if dVenc_str:
                    try:
                        dVenc = datetime.strptime(dVenc_str, "%Y-%m-%d").date()
                    except Exception:
                        pass
                
                installments.append({
                    "nDup": nDup,
                    "dVenc": dVenc,
                    "vDup": vDup
                })

        # Mapeamento pag
        payments = []
        pag_node = find_node_by_local_name(inf_nfe_node, "pag")
        if pag_node is not None:
            det_pag_nodes = find_all_nodes_by_local_name(pag_node, "detPag")
            for det_pag in det_pag_nodes:
                tPag = get_child_text(det_pag, "tPag")
                vPag_str = get_child_text(det_pag, "vPag")
                vPag = Decimal(vPag_str) if vPag_str else Decimal("0")
                payments.append({
                    "tPag": tPag,
                    "vPag": vPag
                })

        # Mapeamento totais
        vProd_total = Decimal("0")
        vNF_total = Decimal("0")
        total_node = find_node_by_local_name(inf_nfe_node, "total")
        if total_node is not None:
            icms_tot = find_node_by_local_name(total_node, "ICMSTot")
            if icms_tot is not None:
                vProd_str = get_child_text(icms_tot, "vProd")
                vNF_str = get_child_text(icms_tot, "vNF")
                vProd_total = Decimal(vProd_str) if vProd_str else Decimal("0")
                vNF_total = Decimal(vNF_str) if vNF_str else Decimal("0")
            
            ibscbs_tot = find_node_by_local_name(total_node, "IBSCBSTot")
            if ibscbs_tot is not None:
                vNF_str = get_child_text(ibscbs_tot, "vNFTot")
                if vNF_str:
                    vNF_total = Decimal(vNF_str)

        # Mapeamento protocolo
        cStat = None
        xMotivo = None
        nProt = None
        dhRecbto = None
        prot_node = find_node_by_local_name(root, "protNFe")
        if prot_node is not None:
            inf_prot = find_node_by_local_name(prot_node, "infProt")
            if inf_prot is not None:
                cStat = get_child_text(inf_prot, "cStat")
                xMotivo = get_child_text(inf_prot, "xMotivo")
                nProt = get_child_text(inf_prot, "nProt")
                dhRecbto_raw = get_child_text(inf_prot, "dhRecbto")
                if dhRecbto_raw:
                    try:
                        dhRecbto = datetime.fromisoformat(dhRecbto_raw.replace("Z", "+00:00"))
                    except Exception:
                        pass

        # XML Version
        xml_version = inf_nfe_node.attrib.get("versao", "4.00")

        return {
            "access_key": access_key,
            "nNF": nNF,
            "serie": serie,
            "mod": mod,
            "dhEmi": dhEmi,
            "issuer_cnpj": issuer_cnpj,
            "issuer_name": issuer_name,
            "recipient_cnpj": recipient_cnpj,
            "recipient_name": recipient_name,
            "vProd": vProd_total,
            "vNF": vNF_total,
            "items": items,
            "installments": installments,
            "payments": payments,
            "cStat": cStat,
            "xMotivo": xMotivo,
            "nProt": nProt,
            "dhRecbto": dhRecbto,
            "xml_version": xml_version
        }
