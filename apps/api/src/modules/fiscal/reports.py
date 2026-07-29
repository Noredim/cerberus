import os
import io
import datetime
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import or_
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

# Import models
from src.modules.fiscal.models import NfeAnalysis, FiscalDocument, FiscalDocumentItem
from src.modules.users.models import User

# Formatting helpers
def format_currency(val) -> str:
    if val is None:
        return "0,00"
    return f"{float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def format_percent(val) -> str:
    if val is None:
        return "0,00%"
    return f"{float(val):.2f}%".replace(".", ",")

def format_number(val, decimals=2) -> str:
    if val is None:
        return "0"
    return f"{float(val):,.{decimals}f}".replace(",", "X").replace(".", ",").replace("X", ".")

PAYMENT_METHODS = {
    '01': 'Dinheiro',
    '02': 'Cheque',
    '03': 'Cartão de Crédito',
    '04': 'Cartão de Débito',
    '05': 'Crédito Loja',
    '10': 'Vale Alimentação',
    '11': 'Vale Refeição',
    '12': 'Vale Presente',
    '13': 'Vale Combustível',
    '14': 'Duplicata Mercantil',
    '15': 'Boleto Bancário',
    '16': 'Depósito Bancário',
    '17': 'Pagamento Instantâneo (Pix)',
    '18': 'Transferência bancária, Carteira Digital',
    '19': 'Programa de fidelidade, Cashback, Crédito Virtual',
    '90': 'Sem pagamento',
    '99': 'Outros'
}

def get_payment_method_label(code: str) -> str:
    if not code:
        return 'Não informado'
    return PAYMENT_METHODS.get(code, f'Outros ({code})')

# XML extraction helpers
import xml.etree.ElementTree as ET

def clean_tag(tag: str) -> str:
    if tag.startswith("{"):
        return tag.split("}", 1)[1]
    return tag

def find_node(node, name):
    if clean_tag(node.tag) == name:
        return node
    for child in node:
        res = find_node(child, name)
        if res is not None:
            return res
    return None

def extract_uf_from_xml(xml_content: str, section: str) -> str:
    try:
        content = xml_content.lstrip("\ufeff").encode("utf-8") if isinstance(xml_content, str) else xml_content
        root = ET.fromstring(content)
        inf_nfe = find_node(root, "infNFe")
        if inf_nfe is not None:
            section_node = find_node(inf_nfe, section)
            if section_node is not None:
                uf_node = find_node(section_node, "UF")
                if uf_node is not None and uf_node.text:
                    return uf_node.text.strip().upper()
    except Exception as e:
        print(f"Error parsing UF for {section} in PDF: {e}")
    return "SP" if section == "emit" else "MT"

def extract_nat_op_from_xml(xml_content: str) -> str:
    try:
        content = xml_content.lstrip("\ufeff").encode("utf-8") if isinstance(xml_content, str) else xml_content
        root = ET.fromstring(content)
        inf_nfe = find_node(root, "infNFe")
        if inf_nfe is not None:
            nat_op_node = find_node(inf_nfe, "natOp")
            if nat_op_node is not None and nat_op_node.text:
                return nat_op_node.text.strip()
    except Exception as e:
        print(f"Error parsing natOp in PDF: {e}")
    return "-"

# Taxes extraction helpers from JSONB
def get_icms_info(tributos):
    if not tributos or "ICMS" not in tributos:
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    icms = tributos["ICMS"]
    if not icms or not isinstance(icms, dict):
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    values = list(icms.values())
    if not values:
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    inner = values[0]
    if not isinstance(inner, dict):
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    
    return {
        "cst": inner.get("CST") or inner.get("CSOSN") or "-",
        "base": float(inner.get("vBC") or 0.0),
        "aliq": float(inner.get("pICMS") or 0.0),
        "valor": float(inner.get("vICMS") or 0.0)
    }

def get_ipi_info(tributos):
    if not tributos or "IPI" not in tributos:
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    ipi = tributos["IPI"]
    if not ipi or not isinstance(ipi, dict):
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    inner = ipi.get("IPITrib") or ipi.get("IPINT") or {}
    if not isinstance(inner, dict):
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    
    return {
        "cst": inner.get("CST") or "-",
        "base": float(inner.get("vBC") or 0.0),
        "aliq": float(inner.get("pIPI") or 0.0),
        "valor": float(inner.get("vIPI") or 0.0)
    }

def get_pis_info(tributos):
    if not tributos or "PIS" not in tributos:
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    pis = tributos["PIS"]
    if not pis or not isinstance(pis, dict):
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    values = list(pis.values())
    if not values:
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    inner = values[0]
    if not isinstance(inner, dict):
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    
    return {
        "cst": inner.get("CST") or "-",
        "base": float(inner.get("vBC") or 0.0),
        "aliq": float(inner.get("pPIS") or 0.0),
        "valor": float(inner.get("vPIS") or 0.0)
    }

def get_cofins_info(tributos):
    if not tributos or "COFINS" not in tributos:
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    cofins = tributos["COFINS"]
    if not cofins or not isinstance(cofins, dict):
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    values = list(cofins.values())
    if not values:
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    inner = values[0]
    if not isinstance(inner, dict):
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    
    return {
        "cst": inner.get("CST") or "-",
        "base": float(inner.get("vBC") or 0.0),
        "aliq": float(inner.get("pCOFINS") or 0.0),
        "valor": float(inner.get("vCOFINS") or 0.0)
    }

def get_ibs_info(tributos):
    if not tributos:
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    ibscbs = tributos.get("IBSCBS") or {}
    gibscbs = {}
    if isinstance(ibscbs, dict):
        gibscbs = ibscbs.get("gIBSCBS") or tributos.get("gIBSCBS") or {}
    else:
        ibscbs = {}
        gibscbs = tributos.get("gIBSCBS") or {}
        
    gibs = {}
    if isinstance(gibscbs, dict):
        gibs = gibscbs.get("gIBS") or tributos.get("gIBS") or {}
    else:
        gibscbs = {}
        gibs = tributos.get("gIBS") or {}
        
    ibsuf = {}
    if isinstance(gibscbs, dict):
        ibsuf = gibscbs.get("gIBSUF") or {}
    if not ibsuf and isinstance(gibs, dict):
        ibsuf = gibs.get("gIBSUF") or {}
        
    cst = "-"
    if isinstance(ibscbs, dict):
        cst = ibscbs.get("CST")
    if not cst and isinstance(gibscbs, dict):
        cst = gibscbs.get("CST")
    if not cst:
        ibs_tag = tributos.get("IBS") or {}
        if isinstance(ibs_tag, dict):
            cst = ibs_tag.get("CST")
            
    base = 0.0
    if isinstance(gibscbs, dict) and "vBC" in gibscbs:
        base = gibscbs["vBC"]
    elif isinstance(gibs, dict) and "vBC" in gibs:
        base = gibs["vBC"]
    elif isinstance(ibscbs, dict) and "vBC" in ibscbs:
        base = ibscbs["vBC"]
    else:
        ibs_tag = tributos.get("IBS") or {}
        if isinstance(ibs_tag, dict):
            base = ibs_tag.get("vBC") or 0.0
            
    aliq = 0.0
    if isinstance(ibsuf, dict) and "pIBSUF" in ibsuf:
        aliq = ibsuf["pIBSUF"]
    elif isinstance(gibscbs, dict) and "pIBS" in gibscbs:
        aliq = gibscbs["pIBS"]
    elif isinstance(gibs, dict) and "pIBS" in gibs:
        aliq = gibs["pIBS"]
    else:
        ibs_tag = tributos.get("IBS") or {}
        if isinstance(ibs_tag, dict):
            aliq = ibs_tag.get("pIBS") or 0.0
            
    valor = 0.0
    if isinstance(gibscbs, dict) and "vIBS" in gibscbs:
        valor = gibscbs["vIBS"]
    elif isinstance(ibsuf, dict) and "vIBSUF" in ibsuf:
        valor = ibsuf["vIBSUF"]
    elif isinstance(gibs, dict) and "vIBS" in gibs:
        valor = gibs["vIBS"]
    else:
        ibs_tag = tributos.get("IBS") or {}
        if isinstance(ibs_tag, dict):
            valor = ibs_tag.get("vIBS") or 0.0
            
    return {
        "cst": str(cst or "-"),
        "base": float(base or 0.0),
        "aliq": float(aliq or 0.0),
        "valor": float(valor or 0.0)
    }

def get_cbs_info(tributos):
    if not tributos:
        return {"cst": "-", "base": 0.0, "aliq": 0.0, "valor": 0.0}
    
    ibscbs = tributos.get("IBSCBS") or {}
    gibscbs = {}
    if isinstance(ibscbs, dict):
        gibscbs = ibscbs.get("gIBSCBS") or tributos.get("gIBSCBS") or {}
    else:
        ibscbs = {}
        gibscbs = tributos.get("gIBSCBS") or {}
        
    gcbs = {}
    if isinstance(gibscbs, dict):
        gcbs = gibscbs.get("gCBS") or tributos.get("gCBS") or tributos.get("CBS") or {}
    else:
        gcbs = tributos.get("gCBS") or tributos.get("CBS") or {}
        
    base = 0.0
    if isinstance(gcbs, dict) and "vBC" in gcbs:
        base = gcbs["vBC"]
    elif isinstance(gibscbs, dict) and "vBC" in gibscbs:
        base = gibscbs["vBC"]
    elif isinstance(ibscbs, dict) and "vBC" in ibscbs:
        base = ibscbs["vBC"]
        
    aliq = 0.0
    if isinstance(gcbs, dict) and "pCBS" in gcbs:
        aliq = gcbs["pCBS"]
        
    valor = 0.0
    if isinstance(gcbs, dict) and "vCBS" in gcbs:
        valor = gcbs["vCBS"]
        
    return {
        "cst": "-",
        "base": float(base or 0.0),
        "aliq": float(aliq or 0.0),
        "valor": float(valor or 0.0)
    }

class NfeReportsService:
    @staticmethod
    def generate_analise_compra_pdf(
        db: Session,
        analysis_id: UUID,
        current_user: User,
        tax_type: str,
        company_id: Optional[UUID]
    ) -> StreamingResponse:
        # 1. Fetch analysis
        analysis = db.query(NfeAnalysis).filter(
            NfeAnalysis.id == analysis_id,
            NfeAnalysis.tenant_id == current_user.tenant_id
        ).first()
        
        if not analysis or not analysis.fiscal_document:
            raise HTTPException(status_code=404, detail="Análise de NF-e não encontrada.")

        doc = analysis.fiscal_document
        xml_content = analysis.xml_content
        
        # Resolve company logo and name
        company_logo = None
        company_name = None
        from src.modules.companies.models import Company
        company = None
        if company_id:
            company = db.query(Company).filter(
                Company.id == company_id,
                Company.tenant_id == current_user.tenant_id
            ).first()
        if not company and doc.recipient_cnpj:
            company = db.query(Company).filter(
                Company.cnpj == doc.recipient_cnpj,
                Company.tenant_id == current_user.tenant_id
            ).first()
        if not company:
            company = db.query(Company).filter(Company.tenant_id == current_user.tenant_id).first()

        if company:
            company_name = company.razao_social or company.nome_fantasia
            if company.logo_url:
                base_dir_calc = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                base_dir_root = os.path.dirname(os.path.dirname(base_dir_calc))
                clean_path = company.logo_url.lstrip("/")
                abs_logo_path = os.path.join(base_dir_root, clean_path)
                if os.path.exists(abs_logo_path):
                    normalized_path = abs_logo_path.replace("\\", "/")
                    company_logo = f"file:///{normalized_path}"
        
        # 2. Extract origin & destination UFs, and natOp
        uf_origem = extract_uf_from_xml(xml_content, "emit")
        uf_destino = extract_uf_from_xml(xml_content, "dest")
        op_interestadual = uf_origem != uf_destino
        nat_op = extract_nat_op_from_xml(xml_content)

        # 3. Compile general tax totals
        icms_total_sum = 0.0
        ipi_total_sum = 0.0
        pis_total_sum = 0.0
        cofins_total_sum = 0.0
        ibs_total_sum = 0.0
        cbs_total_sum = 0.0

        for item in doc.items:
            tributos = item.tributos or {}
            icms_total_sum += get_icms_info(tributos)["valor"]
            ipi_total_sum += get_ipi_info(tributos)["valor"]
            pis_total_sum += get_pis_info(tributos)["valor"]
            cofins_total_sum += get_cofins_info(tributos)["valor"]
            ibs_total_sum += get_ibs_info(tributos)["valor"]
            cbs_total_sum += get_cbs_info(tributos)["valor"]

        tax_sums = {
            "icmsSum": icms_total_sum,
            "ipiSum": ipi_total_sum,
            "pisSum": pis_total_sum,
            "cofinsSum": cofins_total_sum,
            "ibsSum": ibs_total_sum,
            "cbsSum": cbs_total_sum
        }

        # 4. Calculation of purchase taxes per item
        calculated_items = []
        total_tax_amount = 0.0
        total_simulated_cost = 0.0

        for item in doc.items:
            qty = float(item.qCom or 0.0)
            unitValue = float(item.vUnCom or 0.0)
            tributos = item.tributos or {}
            
            # Extract taxes
            icms_info = get_icms_info(tributos)
            ipi_info = get_ipi_info(tributos)
            pis_info = get_pis_info(tributos)
            cofins_info = get_cofins_info(tributos)
            ibs_info = get_ibs_info(tributos)
            cbs_info = get_cbs_info(tributos)
            
            # IPI and Frete per unit
            ipiTotal = ipi_info["valor"]
            ipiUnit = ipiTotal / qty if qty > 0 else 0.0
            freteUnit = 0.0 # Standard 0.0 frete from detail screen
            
            aliquotaOrcamento = icms_info["aliq"]
            
            # Fetch cache data for ICMS ST if required
            mvaPercent = 0.0
            bitFlag = False
            
            if tax_type == 'ICMS_ST' and company_id:
                # 1. Fetch MVA from ProductService
                try:
                    from src.modules.products.service import ProductService
                    prod_service = ProductService(db)
                    mva_data = prod_service.get_product_mva(current_user.tenant_id, item.NCM, str(company_id), "REVENDA")
                    if mva_data:
                        mvaPercent = float(mva_data.get("mva_percent") or 0.0)
                except Exception as e:
                    print(f"Error fetching MVA in PDF: {e}")

                # 2. Check benefits (BIT)
                try:
                    from src.modules.ncm.services.ncm_service import NcmService
                    ncm_service = NcmService(db)
                    benefits = ncm_service.get_linked_benefits(item.NCM)
                    benefits = [b for b in benefits if str(b.tenant_id) == str(current_user.tenant_id)]
                    bitFlag = any("BIT" in (b.nome or "").upper() for b in benefits)
                except Exception as e:
                    print(f"Error checking NCM benefits in PDF: {e}")

            stFlag = mvaPercent > 0
            
            # Constant variables for rules
            ALIQ_INTERNA_DESTINO = 0.17
            aliquotaInternaDestino = 17
            FATOR_BIT = 0.4117
            DESCONTO_CREDITO_OUTORGADO = 0.12
            
            def apply_icms_cap(icms_raw: float) -> float:
                if icms_raw <= 4:
                    return icms_raw
                return 7.0
                
            icmsEntradaEffective = apply_icms_cap(aliquotaOrcamento)
            
            calculatedTax = 0.0
            formulaDetails = {}
            
            if tax_type == 'DIFAL':
                # DIFAL logic
                baseComIpiEFrete = unitValue + ipiUnit + freteUnit
                c_icmsOrigem = baseComIpiEFrete * (aliquotaOrcamento / 100)
                baseSemIcms = baseComIpiEFrete - c_icmsOrigem
                divisor = 1 - ALIQ_INTERNA_DESTINO
                c_baseCalculoDifal = baseSemIcms / divisor if divisor > 0 else 0.0
                c_icmsDestino = c_baseCalculoDifal * ALIQ_INTERNA_DESTINO
                c_valorDifalBase = c_icmsDestino - c_icmsOrigem
                valorDifal = max(0.0, c_valorDifalBase) if op_interestadual else 0.0
                
                calculatedTax = valorDifal
                formulaDetails = {
                    "baseComIpiEFrete": baseComIpiEFrete,
                    "c_icmsOrigem": c_icmsOrigem,
                    "baseSemIcms": baseSemIcms,
                    "c_baseCalculoDifal": c_baseCalculoDifal,
                    "c_icmsDestino": c_icmsDestino,
                    "c_valorDifalBase": c_valorDifalBase,
                    "valorDifal": valorDifal
                }
            else:
                # ICMS ST logic (REVENDA)
                baseComMVA = (unitValue + ipiUnit) * (1 + mvaPercent / 100)
                CRED = icmsEntradaEffective / 100
                calcIcmsStFinal = 0.0
                
                if stFlag and op_interestadual:
                    if bitFlag:
                        icmsStSaida = baseComMVA * FATOR_BIT * ALIQ_INTERNA_DESTINO
                        icmsCredito = unitValue * FATOR_BIT * CRED
                        calcIcmsStFinal = max(0.0, icmsStSaida - icmsCredito)
                        formulaDetails = {
                            "baseComMVA": baseComMVA,
                            "icmsStSaida": icmsStSaida,
                            "icmsCredito": icmsCredito,
                            "calcIcmsStFinal": calcIcmsStFinal
                        }
                    else:
                        icmsStBruto = baseComMVA * ALIQ_INTERNA_DESTINO - unitValue * CRED
                        icmsStProtegido = max(0.0, icmsStBruto)
                        calcIcmsStFinal = max(0.0, icmsStProtegido * (1 - DESCONTO_CREDITO_OUTORGADO))
                        formulaDetails = {
                            "baseComMVA": baseComMVA,
                            "icmsStBruto": icmsStBruto,
                            "icmsStProtegido": icmsStProtegido,
                            "calcIcmsStFinal": calcIcmsStFinal
                        }
                else:
                    formulaDetails = {
                        "notEligible": True
                    }
                    
                calculatedTax = calcIcmsStFinal

            total_tax_amount += calculatedTax * qty
            total_cost_item = (unitValue + ipiUnit + freteUnit + calculatedTax) * qty
            total_simulated_cost += total_cost_item

            calculated_items.append({
                "item": item,
                "qty": qty,
                "unitValue": unitValue,
                "ipiUnit": ipiUnit,
                "freteUnit": freteUnit,
                "mvaPercent": mvaPercent,
                "bitFlag": bitFlag,
                "stFlag": stFlag,
                "aliquotaOrcamento": aliquotaOrcamento,
                "icmsEntradaEffective": icmsEntradaEffective,
                "calculatedTax": calculatedTax,
                "formulaDetails": formulaDetails,
                "total_cost": total_cost_item,
                
                "icms": icms_info,
                "ipi": ipi_info,
                "pis": pis_info,
                "cofins": cofins_info,
                "ibs": ibs_info,
                "cbs": cbs_info
            })

        # 5. Locate Templates
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) # src/modules
        templates_dir = os.path.join(os.path.dirname(base_dir), "templates", "reports")
        
        css_path = os.path.join(templates_dir, "analise_nfe_compra_v1.css")
        html_path = os.path.join(templates_dir, "analise_nfe_compra_v1.html")
        
        css_content = ""
        if os.path.exists(css_path):
            with open(css_path, "r", encoding="utf-8") as f:
                css_content = f.read()

        if os.path.exists(html_path):
            with open(html_path, "r", encoding="utf-8") as f:
                html_template = f.read()
        else:
            raise HTTPException(status_code=500, detail="Report HTML template file not found.")

        # Render Jinja2 template
        from jinja2 import Template
        template = Template(html_template)
        rendered_html = template.render(
            css_content=css_content,
            analysis=analysis,
            doc=doc,
            company_logo=company_logo,
            company_name=company_name,
            uf_origem=uf_origem,
            uf_destino=uf_destino,
            nat_op=nat_op,
            tax_sums=tax_sums,
            calculated_items=calculated_items,
            selected_tax_type=tax_type,
            total_tax_amount=total_tax_amount,
            total_simulated_cost=total_simulated_cost,
            format_currency=format_currency,
            format_percent=format_percent,
            format_number=format_number,
            get_payment_method_label=get_payment_method_label
        )

        # 6. PDF Generation with WeasyPrint & Fallback to ReportLab
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=rendered_html).write_pdf()
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=analise-compra-nfe-{doc.nNF or 'report'}.pdf"
                }
            )
        except Exception as weasy_err:
            print(f"[Warning] WeasyPrint failed for NFe report. Falling back to ReportLab. Error: {weasy_err}")
            
            # REPORTLAB FALLBACK IN LANDSCAPE
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            
            pdf_buffer = io.BytesIO()
            doc_rl = SimpleDocTemplate(
                pdf_buffer,
                pagesize=landscape(letter),
                rightMargin=20, leftMargin=20, topMargin=20, bottomMargin=20
            )
            story = []
            styles = getSampleStyleSheet()
            
            # Define custom styles
            title_style = ParagraphStyle(
                'ReportTitle',
                parent=styles['Heading1'],
                fontSize=14,
                textColor=colors.HexColor('#1e3a8a'),
                spaceAfter=5
            )
            sub_style = ParagraphStyle(
                'SubStyle',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#475569'),
                spaceAfter=10
            )
            table_hdr_style = ParagraphStyle(
                'TableHdr',
                parent=styles['Normal'],
                fontSize=7,
                fontName='Helvetica-Bold',
                textColor=colors.white
            )
            table_cell_style = ParagraphStyle(
                'TableCell',
                parent=styles['Normal'],
                fontSize=7,
                textColor=colors.HexColor('#1e293b')
            )
            
            # Title & Metadata
            story.append(Paragraph("RELATÓRIO ANALÍTICO DE COMPRA (ReportLab Fallback)", title_style))
            story.append(Paragraph(
                f"NF-e: {doc.nNF or '-'} | Série: {doc.serie or '-'} | Chave: {doc.access_key} | Emitente: {doc.issuer_name} | Destinatário: {doc.recipient_name} | Cenário: {tax_type}",
                sub_style
            ))
            story.append(Spacer(1, 10))
            
            # Financial summary
            summary_data = [
                ["Produtos", "ICMS", "IPI", "PIS", "COFINS", "IBS/CBS", "Valor Total NF"],
                [
                    f"R$ {format_currency(doc.vProd)}",
                    f"R$ {format_currency(tax_sums['icmsSum'])}",
                    f"R$ {format_currency(tax_sums['ipiSum'])}",
                    f"R$ {format_currency(tax_sums['pisSum'])}",
                    f"R$ {format_currency(tax_sums['cofinsSum'])}",
                    f"R$ {format_currency(tax_sums['ibsSum'] + tax_sums['cbsSum'])}",
                    f"R$ {format_currency(doc.vNF)}"
                ]
            ]
            summary_table = Table(summary_data, colWidths=[90]*7)
            summary_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#f1f5f9')),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,-1), 8),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ('PADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(summary_table)
            story.append(Spacer(1, 15))
            
            # Items table
            items_headers = ["#", "Código/Descrição", "NCM", "CFOP", "Qtd", "Unit", "Total", f"{tax_type} Unit", f"{tax_type} Total", "Custo Total"]
            items_rows = [items_headers]
            for calc in calculated_items:
                item_obj = calc["item"]
                items_rows.append([
                    str(item_obj.nItem),
                    item_obj.xProd[:40] + "..." if len(item_obj.xProd) > 40 else item_obj.xProd,
                    item_obj.NCM or "-",
                    item_obj.CFOP or "-",
                    format_number(calc["qty"]),
                    f"R$ {format_currency(calc['unitValue'])}",
                    f"R$ {format_currency(item_obj.vProd)}",
                    f"R$ {format_currency(calc['calculatedTax'])}",
                    f"R$ {format_currency(calc['calculatedTax'] * calc['qty'])}",
                    f"R$ {format_currency(calc['total_cost'])}"
                ])
                
            items_table = Table(items_rows, colWidths=[20, 180, 50, 40, 45, 55, 60, 60, 60, 65])
            items_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('ALIGN', (4,1), (-1,-1), 'RIGHT'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,-1), 7),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#f8fafc')]),
                ('PADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(Paragraph("ITENS DA NOTA E IMPOSTOS DE COMPRA", ParagraphStyle('SectionHeader', parent=styles['Heading2'], fontSize=10, textColor=colors.HexColor('#1e3a8a'))))
            story.append(Spacer(1, 4))
            story.append(items_table)
            story.append(Spacer(1, 15))
            
            # Consolidated Simulation totals
            consol_data = [
                [f"Total de {tax_type} Calculado:", f"R$ {format_currency(total_tax_amount)}"],
                ["Custo Total de Compra Simulado:", f"R$ {format_currency(total_simulated_cost)}"]
            ]
            consol_table = Table(consol_data, colWidths=[250, 150])
            consol_table.setStyle(TableStyle([
                ('ALIGN', (0,0), (0,-1), 'RIGHT'),
                ('ALIGN', (1,0), (1,-1), 'LEFT'),
                ('FONTNAME', (0,0), (-1,-1), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,-1), 9),
                ('TEXTCOLOR', (1,0), (1,0), colors.HexColor('#1e3a8a')),
                ('TEXTCOLOR', (1,1), (1,1), colors.HexColor('#15803d')),
                ('PADDING', (0,0), (-1,-1), 4),
            ]))
            story.append(consol_table)
            
            doc_rl.build(story)
            pdf_buffer.seek(0)
            return StreamingResponse(
                pdf_buffer,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=analise-compra-nfe-{doc.nNF or 'report'}.pdf"
                }
            )

    @staticmethod
    def generate_acompanhamento_nfe_pdf(
        db: Session,
        current_user: User,
        competencia: Optional[str] = None,
        recipient_cnpj: Optional[str] = None
    ) -> StreamingResponse:
        """
        Gera relatório em formato PDF nativo (A4 Paisagem) do Acompanhamento Mensal de NF-e,
        incluindo a logo da empresa no cabeçalho e os dados do sistema/usuário no rodapé.
        """
        from src.modules.fiscal.rules import APLICACAO_LABELS, TRIBUTACAO_LABELS
        from src.modules.companies.models import Company

        # 1. Resolve a logo da empresa (do destinatário ou do tenant)
        company_logo = None
        company_name = None
        company = None
        if recipient_cnpj and recipient_cnpj != 'ALL':
            company = db.query(Company).filter(
                Company.cnpj == recipient_cnpj,
                Company.tenant_id == current_user.tenant_id
            ).first()

        if not company:
            company = db.query(Company).filter(Company.tenant_id == current_user.tenant_id).first()

        if company:
            company_name = company.razao_social or company.nome_fantasia
            if company.logo_url:
                base_dir_calc = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                base_dir_root = os.path.dirname(os.path.dirname(base_dir_calc))
                clean_path = company.logo_url.lstrip("/")
                abs_logo_path = os.path.join(base_dir_root, clean_path)
                if os.path.exists(abs_logo_path):
                    normalized_path = abs_logo_path.replace("\\", "/")
                    company_logo = f"file:///{normalized_path}"

        query = db.query(FiscalDocument).filter(FiscalDocument.tenant_id == current_user.tenant_id)
        if competencia and competencia != 'ALL':
            query = query.filter(FiscalDocument.competencia == competencia)
        if recipient_cnpj and recipient_cnpj != 'ALL':
            query = query.filter(
                or_(
                    FiscalDocument.recipient_cnpj == recipient_cnpj,
                    FiscalDocument.recipient_cnpj.is_(None)
                )
            )

        docs = query.order_by(FiscalDocument.created_at.desc()).all()

        # Determina a etiqueta amigável da competência
        if not competencia or competencia == 'ALL':
            comp_label = "Todas as Competências"
        else:
            try:
                parts = competencia.split('-')
                months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
                          'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
                m_idx = int(parts[1]) - 1
                comp_label = f"{months[m_idx]} / {parts[0]}"
            except Exception:
                comp_label = competencia

        # Determina os dados do destinatário para o cabeçalho
        recipient_name = None
        recipient_uf = None
        if recipient_cnpj and recipient_cnpj != 'ALL':
            if company:
                recipient_name = company.razao_social or company.nome_fantasia
                recipient_uf = getattr(company, 'uf', None)
            for d in docs:
                if d.recipient_cnpj == recipient_cnpj and d.recipient_name:
                    recipient_name = d.recipient_name
                    recipient_uf = d.uf_dest or recipient_uf
                    break

        if recipient_cnpj and recipient_cnpj != 'ALL':
            dest_header = f"{recipient_name or 'Destinatário'} — CNPJ: {recipient_cnpj}"
            if recipient_uf:
                dest_header += f" ({recipient_uf})"
        else:
            dest_header = "Todas as Empresas Destinatárias"

        # Totais
        total_vBC = sum(d.vBC or 0 for d in docs)
        total_vICMS = sum(d.vICMS or 0 for d in docs)
        total_vBCST = sum(d.vBCST or 0 for d in docs)
        total_vICMSST = sum(d.vICMSST or 0 for d in docs)
        total_vProd = sum(d.vProd or 0 for d in docs)
        total_vFrete = sum(d.vFrete or 0 for d in docs)
        total_vNF = sum(d.vNF or 0 for d in docs)

        rows_html = ""
        for idx, doc in enumerate(docs):
            bg_class = "bg-alt" if idx % 2 == 1 else ""
            app_label = APLICACAO_LABELS.get(doc.aplicacao, doc.aplicacao or 'Pendente')
            trib_label = TRIBUTACAO_LABELS.get(doc.tipo_tributacao, doc.tipo_tributacao or 'Pendente')
            dh_str = doc.dhRecbto.strftime("%d/%m/%Y, %H:%M:%S") if doc.dhRecbto else ""
            
            is_cancelled = (
                doc.status_importacao in ('CANCELADA', 'RESUMIDA_EVENTO') or
                doc.aplicacao == 'CANCELAMENTO' or
                doc.tipo_tributacao == 'CANCELAMENTO' or
                doc.criada_por_evento or
                str(doc.cStat or '') in ('101', '135', '155')
            )

            status_badge_class = "badge-status-cancelled" if is_cancelled else "badge-status"
            if is_cancelled:
                cstat_str = f"{doc.cStat or '101'} - {doc.xMotivo or 'NF-e Cancelada'}"
            else:
                cstat_str = f"{doc.cStat} - {doc.xMotivo or 'Autorizado'}" if doc.cStat else "100 - Autorizada"

            rows_html += f"""
            <tr class="{bg_class}">
                <td class="font-mono">
                    <div class="bold text-main">Nº {doc.nNF or '-'}</div>
                    <div class="badge-key font-mono">{doc.access_key}</div>
                </td>
                <td>
                    <div class="bold">{app_label}</div>
                    <div class="text-brand bold">{trib_label}</div>
                </td>
                <td class="center bold">{doc.serie or '1'}</td>
                <td class="wrap-col">{doc.natOp or '-'}</td>
                <td class="font-mono">
                    <div class="bold">{doc.nProt or '-'}</div>
                    <div class="text-muted text-xs">{dh_str}</div>
                    <div class="{status_badge_class}">{cstat_str}</div>
                </td>
                <td>
                    <div class="bold">{doc.issuer_name or '-'}</div>
                    <div class="tags flex">
                        <span className="tag tag-uf">{doc.uf_emit or 'UF'}</span>
                        <span className="tag tag-cnpj">{doc.issuer_cnpj or '-'}</span>
                        <span className="tag tag-ie">IE: {doc.issuer_ie or 'ISENTO'}</span>
                    </div>
                </td>
                <td class="right font-mono">{format_currency(doc.vBC)}</td>
                <td class="right font-mono">{format_currency(doc.vICMS)}</td>
                <td class="right font-mono">{format_currency(doc.vBCST) if doc.vBCST else '-'}</td>
                <td class="right font-mono bold">{format_currency(doc.vICMSST) if doc.vICMSST else '-'}</td>
                <td class="right font-mono">{format_currency(doc.vProd)}</td>
                <td class="right font-mono">{format_currency(doc.vFrete) if doc.vFrete else '-'}</td>
                <td class="right font-mono bold text-main">{format_currency(doc.vNF)}</td>
            </tr>
            """

        generated_at = datetime.datetime.now().strftime("%d/%m/%Y, %H:%M:%S")
        user_display_name = getattr(current_user, 'full_name', None) or current_user.email
        user_info_str = f"{user_display_name} ({current_user.email})"

        logo_html = ""
        if company_logo:
            logo_html = f'<img src="{company_logo}" alt="Logo Empresa" style="max-height: 42px; max-width: 220px; display: block; margin-bottom: 6px;" />'

        html_template = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Relatório Acompanhamento Mensal de NF-e</title>
            <style>
                @page {{
                    size: A4 landscape;
                    margin-top: 8mm;
                    margin-left: 6mm;
                    margin-right: 6mm;
                    margin-bottom: 12mm;
                    @bottom-left {{
                        content: "CERBERUS — SISTEMA OPERACIONAL FISCAL  |  Usuário: {user_info_str}  |  Gerado em: {generated_at}";
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                        font-size: 7pt;
                        color: #64748b;
                        border-top: 1px solid #cbd5e1;
                        padding-top: 4px;
                    }}
                    @bottom-right {{
                        content: "Página " counter(page) " de " counter(pages);
                        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                        font-size: 7pt;
                        color: #64748b;
                        border-top: 1px solid #cbd5e1;
                        padding-top: 4px;
                    }}
                }}
                body {{
                    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                    font-size: 8px;
                    color: #0f172a;
                    margin: 0;
                    padding: 0;
                    background-color: #ffffff;
                }}
                .header-container {{
                    border-bottom: 2px solid #0f172a;
                    padding-bottom: 6px;
                    margin-bottom: 8px;
                }}
                .header-flex {{
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }}
                .system-title {{
                    font-size: 8px;
                    font-weight: bold;
                    color: #64748b;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }}
                .report-title {{
                    font-size: 14px;
                    font-weight: 800;
                    color: #0f172a;
                    margin: 2px 0 4px 0;
                    text-transform: uppercase;
                }}
                .info-badge {{
                    background-color: #f1f5f9;
                    border: 1px solid #cbd5e1;
                    padding: 3px 6px;
                    border-radius: 4px;
                    display: inline-block;
                    margin-top: 2px;
                    font-size: 8.5px;
                }}
                .meta-info {{
                    text-align: right;
                    font-size: 8px;
                    color: #475569;
                }}
                table {{
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 7.5px;
                }}
                th {{
                    background-color: #0f172a;
                    color: #ffffff;
                    text-transform: uppercase;
                    font-size: 7px;
                    font-weight: bold;
                    padding: 5px 4px;
                    border: 1px solid #334155;
                    text-align: left;
                }}
                td {{
                    padding: 4px;
                    border: 1px solid #e2e8f0;
                    vertical-align: top;
                }}
                tr.bg-alt {{
                    background-color: #f8fafc;
                }}
                .font-mono {{ font-family: 'Courier', monospace; }}
                .bold {{ font-weight: bold; }}
                .center {{ text-align: center; }}
                .right {{ text-align: right; }}
                .text-main {{ color: #0f172a; }}
                .text-brand {{ color: #4f46e5; }}
                .text-muted {{ color: #64748b; font-size: 7px; }}
                .badge-key {{
                    background-color: #f1f5f9;
                    border: 1px solid #cbd5e1;
                    padding: 1px 3px;
                    border-radius: 3px;
                    font-size: 6.5px;
                    word-break: break-all;
                    margin-top: 2px;
                    letter-spacing: -0.2px;
                }}
                .badge-status {{
                    background-color: #ecfdf5;
                    color: #065f46;
                    border: 1px solid #a7f3d0;
                    padding: 1px 3px;
                    border-radius: 3px;
                    font-size: 6.5px;
                    font-weight: bold;
                    margin-top: 2px;
                    display: inline-block;
                }}
                .badge-status-cancelled {{
                    background-color: #fef2f2;
                    color: #991b1b;
                    border: 1px solid #fecaca;
                    padding: 1px 3px;
                    border-radius: 3px;
                    font-size: 6.5px;
                    font-weight: bold;
                    margin-top: 2px;
                    display: inline-block;
                }}
                .wrap-col {{
                    word-wrap: break-word;
                    white-space: normal;
                    max-width: 110px;
                }}
                .tag {{
                    padding: 1px 3px;
                    border-radius: 2px;
                    font-size: 6.5px;
                    font-family: 'Courier', monospace;
                    margin-right: 2px;
                }}
                .tag-uf {{ background-color: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; font-weight: bold; }}
                .tag-cnpj {{ background-color: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }}
                .tag-ie {{ background-color: #faf5ff; color: #7e22ce; border: 1px solid #e9d5ff; }}
                tfoot tr {{
                    background-color: #0f172a;
                    color: #ffffff;
                    font-weight: bold;
                    font-size: 8px;
                }}
                tfoot td {{
                    border: 1px solid #334155;
                    padding: 5px 4px;
                }}
                .text-accent {{ color: #fbbf24; }}
                .footer-bar {{
                    margin-top: 15px;
                    padding-top: 6px;
                    border-top: 1px solid #cbd5e1;
                    font-size: 7px;
                    color: #64748b;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }}
            </style>
        </head>
        <body>
            <div class="header-container">
                <div class="header-flex">
                    <div>
                        {logo_html}
                        <div class="report-title">RELATÓRIO ACOMPANHAMENTO MENSAL DE NF-E</div>
                        <div>Competência: <strong>{comp_label}</strong></div>
                        <div class="info-badge">
                            <strong>Empresa Destinatária:</strong> {dest_header}
                        </div>
                    </div>
                    <div class="meta-info">
                        <div>Total de Registros: <strong>{len(docs)}</strong></div>
                        <div>Gerado em: <strong>{generated_at}</strong></div>
                        <div>Formato A4 Paisagem</div>
                    </div>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Nº NF / Chave</th>
                        <th>Aplicação / Tributação</th>
                        <th style="text-align: center;">Série</th>
                        <th>Nat. Operação</th>
                        <th>Protocolo / Autorização / Situação</th>
                        <th>Fornecedor (Origem / CNPJ / I.E)</th>
                        <th style="text-align: right;">Base ICMS</th>
                        <th style="text-align: right;">Valor ICMS</th>
                        <th style="text-align: right;">Base ST</th>
                        <th style="text-align: right;">ICMS ST</th>
                        <th style="text-align: right;">Valor Prod</th>
                        <th style="text-align: right;">Frete</th>
                        <th style="text-align: right;">Valor Total NF</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_html}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="6" style="text-align: right; font-weight: bold;">TOTAIS AGREGADOS DO RELATÓRIO:</td>
                        <td style="text-align: right;" class="font-mono">{format_currency(total_vBC)}</td>
                        <td style="text-align: right;" class="font-mono">{format_currency(total_vICMS)}</td>
                        <td style="text-align: right;" class="font-mono">{format_currency(total_vBCST)}</td>
                        <td style="text-align: right;" class="font-mono text-accent">{format_currency(total_vICMSST)}</td>
                        <td style="text-align: right;" class="font-mono">{format_currency(total_vProd)}</td>
                        <td style="text-align: right;" class="font-mono">{format_currency(total_vFrete)}</td>
                        <td style="text-align: right;" class="font-mono text-accent">{format_currency(total_vNF)}</td>
                    </tr>
                </tfoot>
            </table>
        </body>
        </html>
        """

        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=html_template).write_pdf()
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=relatorio-acompanhamento-nfe-{competencia or 'geral'}.pdf"
                }
            )
        except Exception as weasy_err:
            print(f"[Warning] WeasyPrint failed for Acompanhamento NF-e report. Error: {weasy_err}")
            raise HTTPException(
                status_code=500,
                detail=f"Erro ao gerar relatório em PDF via WeasyPrint: {str(weasy_err)}"
            )


