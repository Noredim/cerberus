import os
import io
import datetime
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from fastapi import HTTPException
from fastapi.responses import StreamingResponse

# Import models
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem, RentalBudgetItem, SalesBudgetApproval
from src.modules.purchase_budgets.models import PurchaseBudget, PurchaseBudgetItem
from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitItem
from src.modules.opportunity_kits.service import OpportunityKitService
from src.modules.payment_methods.models import PlanejamentoFinanceiro
from src.modules.users.models import User

# Formatting helper
def format_currency(val) -> str:
    if val is None:
        return "0,00"
    return f"{float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def format_usd(val) -> str:
    if val is None:
        return "0,00"
    return f"{float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def format_rate(val) -> str:
    if val is None:
        return "0,0000"
    return f"{float(val):,.4f}".replace(",", "X").replace(".", ",").replace("X", ".")

def parse_payment_condition(condition_str: str, total_value: float, base_date: datetime.date) -> tuple[List[dict], Optional[str]]:
    import re
    from datetime import timedelta
    
    if not condition_str:
        return [
            {
                "label_parcela": "Parcela Única",
                "percentual": "100.00",
                "data_prevista": "Não Calculada",
                "valor": format_currency(total_value),
                "_valor_numerico": float(total_value)
            }
        ], "Forma de pagamento não estruturada."
        
    condition_clean = condition_str.strip().lower()
    
    # 1. Check for "à vista" or "a vista" or "vista"
    if "vista" in condition_clean or "imediato" in condition_clean:
        val = round(total_value, 2)
        return [
            {
                "label_parcela": "Parcela Única",
                "percentual": "100.00",
                "data_prevista": base_date.strftime("%d/%m/%Y"),
                "valor": format_currency(val),
                "_valor_numerico": float(val)
            }
        ], None
        
    # 2. Check for percentages match like "50% entrada + 50% 30 dias"
    match_percent_days = re.findall(r'(\d+(?:\.\d+)?)\s*%\s*(?:de\s+)?(entrada|[\w\s\-]+)?', condition_clean)
    if match_percent_days and len(match_percent_days) >= 2:
        parsed_insts = []
        for idx, (pct_str, desc) in enumerate(match_percent_days):
            pct = float(pct_str)
            days = 0
            if desc and "entrada" in desc:
                days = 0
            elif desc:
                days_match = re.search(r'(\d+)', desc)
                if days_match:
                    days = int(days_match.group(1))
            parsed_insts.append((pct, days))
        
        installments = []
        cumulative_val = 0.0
        for idx, (pct, days) in enumerate(parsed_insts):
            is_last = (idx == len(parsed_insts) - 1)
            if is_last:
                val = total_value - cumulative_val
                pct = (val / total_value * 100.0) if total_value > 0 else pct
            else:
                val = round(total_value * (pct / 100.0), 2)
                cumulative_val += val
            
            dt = base_date + timedelta(days=days)
            installments.append({
                "label_parcela": f"{idx + 1}ª Parcela",
                "percentual": f"{pct:.2f}",
                "data_prevista": dt.strftime("%d/%m/%Y"),
                "valor": format_currency(val),
                "_valor_numerico": float(val)
            })
        return installments, None
        
    # 3. Check for slashes like "30/60/90"
    if "/" in condition_clean:
        parts = condition_clean.split("/")
        days_list = []
        for p in parts:
            p_clean = re.sub(r'[^\d]', '', p)
            if p_clean:
                days_list.append(int(p_clean))
        
        if days_list:
            num_parts = len(days_list)
            base_pct = round(100.0 / num_parts, 2)
            pcts = [base_pct] * num_parts
            pcts[-1] = round(100.0 - sum(pcts[:-1]), 2)
            
            installments = []
            cumulative_val = 0.0
            for idx, days in enumerate(days_list):
                is_last = (idx == num_parts - 1)
                pct = pcts[idx]
                if is_last:
                    val = total_value - cumulative_val
                else:
                    val = round(total_value * (pct / 100.0), 2)
                    cumulative_val += val
                    
                dt = base_date + timedelta(days=days)
                installments.append({
                    "label_parcela": f"{idx + 1}ª Parcela",
                    "percentual": f"{pct:.2f}",
                    "data_prevista": dt.strftime("%d/%m/%Y"),
                    "valor": format_currency(val),
                    "_valor_numerico": float(val)
                })
            return installments, None
            
    # 4. Check for single days like "28 dias" or "30 dias"
    single_days_match = re.search(r'^(\d+)\s*(?:dias|dia)?$', condition_clean)
    if not single_days_match:
        single_days_match = re.search(r'(?:em|prazo\s+de)?\s*(\d+)\s*(?:dias|dia)', condition_clean)
        
    if single_days_match:
        days = int(single_days_match.group(1))
        dt = base_date + timedelta(days=days)
        return [
            {
                "label_parcela": "Parcela Única",
                "percentual": "100.00",
                "data_prevista": dt.strftime("%d/%m/%Y"),
                "valor": format_currency(total_value),
                "_valor_numerico": float(total_value)
            }
        ], None
        
    # 5. Fallback for uninterpreted strings
    return [
        {
            "label_parcela": "Parcela Única",
            "percentual": "100.00",
            "data_prevista": "Não Calculada",
            "valor": format_currency(total_value),
            "_valor_numerico": float(total_value)
        }
    ], "Forma de pagamento não estruturada."


class OpportunitiesReportService:
    @staticmethod
    def generate_dre_pdf(db: Session, opportunity_id: UUID, current_user: User) -> StreamingResponse:
        from src.modules.sales_budgets.service import get_opportunity_dre
        
        # 1. Fetch Opportunity
        opportunity = db.query(SalesBudget).filter(
            SalesBudget.id == opportunity_id,
            SalesBudget.tenant_id == current_user.tenant_id
        ).first()
        if not opportunity:
            raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
            
        # 2. Get DRE dictionary
        dre_data = get_opportunity_dre(db, current_user.tenant_id, opportunity_id, opportunity.company_id)
        
        # 3. Calculate helper totals
        total_fornecedores = sum(f["valor"] for f in dre_data["saidas"]["fornecedores"])
        total_impostos_compra = sum(
            imp["valor"] for imp in dre_data["saidas"]["impostos_compra"].values()
        )
        total_impostos_venda = sum(
            imp["valor"] for imp in dre_data["saidas"]["impostos_venda"].values()
        )
        total_despesas_venda = sum(
            exp["valor"] for exp in dre_data["saidas"]["despesas_venda"].values()
        )
        
        total_impostos_instalacao = dre_data["saidas"]["impostos_instalacao"]["total"]
        total_impostos_locacao = dre_data["saidas"]["impostos_locacao"]["total"]
        
        def format_currency_helper(val) -> str:
            if val is None:
                return "0,00"
            return f"{float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

        def format_percent_helper(val) -> str:
            if val is None:
                return "0,00"
            return f"{float(val):.2f}".replace(".", ",")

        def format_percent_ratio_helper(val, base) -> str:
            if not base or not val:
                return "0,00"
            ratio = (float(val) / float(base)) * 100.0
            return f"{ratio:.2f}".replace(".", ",")
        
        # Formatting close date
        data_fechamento = dre_data["header"]["data_fechamento"]
        if isinstance(data_fechamento, (datetime.datetime, datetime.date)):
            data_fechamento_str = data_fechamento.strftime("%d/%m/%Y")
        else:
            data_fechamento_str = str(data_fechamento)
            
        dre_data["header"]["data_fechamento_str"] = data_fechamento_str
        
        now = datetime.datetime.now()
        emissao_data_hora = now.strftime("%d/%m/%Y às %H:%M")
        
        auditoria = {
            "usuario_emissor": current_user.name or current_user.email,
            "data": now.strftime("%d/%m/%Y"),
            "hora": now.strftime("%H:%M"),
            "versao": "1.0.0"
        }
        
        # Render Template
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        templates_dir = os.path.join(base_dir, "templates", "reports")
        
        # Company logo path
        company_logo = None
        if opportunity.company and opportunity.company.logo_url:
            root_dir = os.path.dirname(os.path.dirname(base_dir))
            clean_path = opportunity.company.logo_url.lstrip("/")
            abs_logo_path = os.path.join(root_dir, clean_path)
            if os.path.exists(abs_logo_path):
                normalized_path = abs_logo_path.replace("\\", "/")
                company_logo = f"file:///{normalized_path}"
                
        css_path = os.path.join(templates_dir, "dre_report_v1.css")
        html_path = os.path.join(templates_dir, "dre_report_v1.html")
        
        css_content = ""
        if os.path.exists(css_path):
            with open(css_path, "r", encoding="utf-8") as f:
                css_content = f.read()
                
        html_template = ""
        if os.path.exists(html_path):
            with open(html_path, "r", encoding="utf-8") as f:
                html_template = f.read()
        else:
            raise HTTPException(status_code=500, detail="DRE Report HTML template file not found.")
            
        from jinja2 import Template
        template = Template(html_template)
        
        rendered_html = template.render(
            css_content=css_content,
            opportunity_company_nome=opportunity.company.nome_fantasia or opportunity.company.razao_social if opportunity.company else "Empresa Não Informada",
            company_logo=company_logo,
            header=dre_data["header"],
            entradas=dre_data["entradas"],
            saidas=dre_data["saidas"],
            total_fornecedores=total_fornecedores,
            total_impostos_compra=total_impostos_compra,
            total_impostos_venda=total_impostos_venda,
            total_despesas_venda=total_despesas_venda,
            total_impostos_instalacao=total_impostos_instalacao,
            total_impostos_locacao=total_impostos_locacao,
            lucro_ebitda=dre_data["lucro_ebitda"],
            margem_liquida=dre_data["margem_liquida"],
            emissao_data_hora=emissao_data_hora,
            auditoria=auditoria,
            format_currency=format_currency_helper,
            format_percent=format_percent_helper,
            format_percent_ratio=format_percent_ratio_helper
        )
        
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=rendered_html).write_pdf()
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=DRV_Oportunidade_{opportunity.numero_orcamento or opportunity_id}.pdf"
                }
            )
        except Exception as weasy_err:
            print(f"[Warning] WeasyPrint failed. Falling back to ReportLab. Error: {weasy_err}")
            from reportlab.lib.pagesizes import letter
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
            
            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buffer, 
                pagesize=letter,
                rightMargin=30, leftMargin=30, topMargin=20, bottomMargin=20
            )
            story = []
            styles = getSampleStyleSheet()
            
            # Styles
            title_style = ParagraphStyle(
                'ReportTitle',
                parent=styles['Heading1'],
                fontSize=12,
                textColor=colors.HexColor('#0f172a'),
                spaceAfter=5
            )
            sub_style = ParagraphStyle(
                'SubStyle',
                parent=styles['Normal'],
                fontSize=7.5,
                textColor=colors.HexColor('#475569'),
                spaceAfter=8
            )
            th_style = ParagraphStyle(
                'TableHeader',
                parent=styles['Normal'],
                fontSize=8.0,
                fontName='Helvetica-Bold',
                textColor=colors.white
            )
            td_style = ParagraphStyle(
                'TableCell',
                parent=styles['Normal'],
                fontSize=7.5,
                textColor=colors.HexColor('#1e293b')
            )
            td_bold_style = ParagraphStyle(
                'TableCellBold',
                parent=styles['Normal'],
                fontSize=7.5,
                fontName='Helvetica-Bold',
                textColor=colors.HexColor('#0f172a')
            )
            
            # Header
            story.append(Paragraph("Demonstrativo de Resultado de Venda (DRV)", title_style))
            story.append(Paragraph(
                f"Oportunidade Comercial: #{dre_data['header']['numero_oportunidade']} | "
                f"Cliente: {dre_data['header']['cliente_nome']} ({dre_data['header']['cidade']}-{dre_data['header']['estado']})<br/>"
                f"Vendedor: {dre_data['header']['vendedor_nome']} | "
                f"Responsável: {dre_data['header']['responsavel_nome']} | "
                f"Fechamento: {data_fechamento_str}",
                sub_style
            ))
            
            # Build Table Data
            table_data = [
                [Paragraph("<b>Descrição da Conta (DRV)</b>", th_style), Paragraph("<b>%</b>", th_style), Paragraph("<b>Valor (R$)</b>", th_style)]
            ]
            
            t_style = [
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
                ('ALIGN', (0,0), (-1,-1), 'LEFT'),
                ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
            ]
            
            # Helper to add row
            def add_row(desc, pct_val, amount, is_bold=False, is_indent=False, bg_color=None):
                p_desc = f"&nbsp;&nbsp;&nbsp;&nbsp;{desc}" if is_indent else desc
                style = td_bold_style if is_bold else td_style
                pct_str = format_percent_helper(pct_val) + "%" if pct_val is not None else "-"
                
                if amount is not None:
                    val_str = f"R$ {format_currency_helper(amount)}"
                else:
                    val_str = "-"
                    
                table_data.append([
                    Paragraph(p_desc, style),
                    Paragraph(pct_str, style),
                    Paragraph(val_str, style)
                ])
                if bg_color:
                    row_idx = len(table_data) - 1
                    t_style.append(('BACKGROUND', (0, row_idx), (-1, row_idx), colors.HexColor(bg_color)))
                
            # Entradas
            add_row("1. RECEITA OPERACIONAL BRUTA (ENTRADAS)", 100.0, dre_data["entradas"]["total_entradas"], is_bold=True, bg_color='#f1f5f9')
            add_row("(+) Venda de Equipamentos", (float(dre_data["entradas"]["total_produtos"]) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, dre_data["entradas"]["total_produtos"], is_indent=True)
            add_row("(+) Faturamento de Serviços", (float(dre_data["entradas"]["total_servicos"]) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, dre_data["entradas"]["total_servicos"], is_indent=True)
            if dre_data["entradas"]["restituicao_icms_st"] > 0:
                add_row("(+) Restituição ICMS ST", (float(dre_data["entradas"]["restituicao_icms_st"]) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, dre_data["entradas"]["restituicao_icms_st"], is_indent=True)
                
            # Saidas
            add_row("2. SAÍDAS (CUSTOS E DEDUÇÕES)", (float(dre_data["saidas"]["total_saidas"]) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, dre_data["saidas"]["total_saidas"], is_bold=True, bg_color='#f1f5f9')
            
            # Fornecedores subheader
            add_row("2.1 Custo de Aquisição (Fornecedores)", (float(total_fornecedores) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_fornecedores, is_bold=True, is_indent=True, bg_color='#f8fafc')
            for f in dre_data["saidas"]["fornecedores"]:
                add_row(f"(-) {f['nome']}", (float(f['valor']) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, f['valor'], is_indent=True)
            add_row("(=) Total Pagamento a fornecedores", (float(total_fornecedores) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_fornecedores, is_bold=True, bg_color='#f1f5f9')
                
            # Impostos compra
            add_row("2.2 Impostos de Compra (FPC)", (float(total_impostos_compra) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_impostos_compra, is_bold=True, is_indent=True, bg_color='#f8fafc')
            for k, imp in dre_data["saidas"]["impostos_compra"].items():
                add_row(f"(-) Imposto de Compra {k.upper()}", float(imp.get('percent', 0.0) or 0.0), imp['valor'], is_indent=True)
            add_row("(=) Total Impostos de Compra", (float(total_impostos_compra) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_impostos_compra, is_bold=True, bg_color='#f1f5f9')
                
            # Impostos venda
            if dre_data["header"]["is_rental"]:
                add_row("2.3 Impostos de Venda (FPV)", (float(total_impostos_venda) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_impostos_venda, is_bold=True, is_indent=True, bg_color='#f8fafc')
                
                # Impostos Instalacao
                add_row("2.3.1 Impostos de Instalação", (float(total_impostos_instalacao) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_impostos_instalacao, is_bold=True, is_indent=True, bg_color='#f8fafc')
                for k, imp in dre_data["saidas"]["impostos_instalacao"].items():
                    if k != "total":
                        add_row(f"(-) Imposto {k.upper()}", float(imp.get('percent', 0.0) or 0.0), imp['valor'], is_indent=True)
                add_row("(=) Total Impostos de Instalação", (float(total_impostos_instalacao) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_impostos_instalacao, is_bold=True, bg_color='#f1f5f9')
                
                # Impostos Locacao
                add_row("2.3.2 Impostos de Locação / Comodato", (float(total_impostos_locacao) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_impostos_locacao, is_bold=True, is_indent=True, bg_color='#f8fafc')
                for k, imp in dre_data["saidas"]["impostos_locacao"].items():
                    if k != "total":
                        add_row(f"(-) Imposto {k.upper()}", float(imp.get('percent', 0.0) or 0.0), imp['valor'], is_indent=True)
                add_row("(=) Total Impostos de Locação / Comodato", (float(total_impostos_locacao) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_impostos_locacao, is_bold=True, bg_color='#f1f5f9')
            else:
                add_row("2.3 Impostos de Venda (FPV)", (float(total_impostos_venda) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_impostos_venda, is_bold=True, is_indent=True, bg_color='#f8fafc')
                for k, imp in dre_data["saidas"]["impostos_venda"].items():
                    add_row(f"(-) Imposto de Venda {k.upper()}", float(imp.get('percent', 0.0) or 0.0), imp['valor'], is_indent=True)
                add_row("(=) Total Impostos de Venda", (float(total_impostos_venda) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_impostos_venda, is_bold=True, bg_color='#f1f5f9')
                
            # Despesas venda
            add_row("2.4 Despesas de Venda", (float(total_despesas_venda) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_despesas_venda, is_bold=True, is_indent=True, bg_color='#f8fafc')
            # Frete
            frete_exp = dre_data["saidas"]["despesas_venda"].get("frete")
            if frete_exp and float(frete_exp.get("valor") or 0.0) > 0:
                add_row("(-) Frete de Venda", float(frete_exp.get('percent', 0.0) or 0.0), frete_exp['valor'], is_indent=True)
                
            # Commission grouping
            com_keys = ["comissao", "comissao_dsr", "comissao_fgts", "comissao_inss", "comissao_demais"]
            comissao_total_val = sum(float(dre_data["saidas"]["despesas_venda"].get(k, {}).get("valor") or 0.0) for k in com_keys)
            
            if comissao_total_val > 0:
                comissao_total_pct = (comissao_total_val / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0
                add_row("(-) Comissão", comissao_total_pct, comissao_total_val, is_bold=True, is_indent=True)
                
                desp_labels = {
                    "comissao": "Comissão Líquida",
                    "comissao_dsr": "DSR sobre Comissão",
                    "comissao_fgts": "FGTS sobre Comissão",
                    "comissao_inss": "INSS sobre Comissão",
                    "comissao_demais": "Encargos sobre Comissão (Outros)"
                }
                for k in com_keys:
                    exp = dre_data["saidas"]["despesas_venda"].get(k)
                    if exp and float(exp.get("valor") or 0.0) > 0:
                        label = desp_labels.get(k, k.capitalize())
                        add_row(f"  (-) {label}", float(exp.get('percent', 0.0) or 0.0), exp['valor'], is_indent=True)
                        
            # Despesa Operacional
            op_exp = dre_data["saidas"]["despesas_venda"].get("despesa_operacional")
            if op_exp and float(op_exp.get("valor") or 0.0) > 0:
                add_row("(-) Despesa Operacional", float(op_exp.get('percent', 0.0) or 0.0), op_exp['valor'], is_indent=True)
                
            # Despesas Administrativas
            adm_exp = dre_data["saidas"]["despesas_venda"].get("despesas_administrativas")
            if adm_exp and float(adm_exp.get("valor") or 0.0) > 0:
                add_row("(-) Despesas Administrativas", float(adm_exp.get('percent', 0.0) or 0.0), adm_exp['valor'], is_indent=True)
            add_row("(=) Total Despesas de Venda", (float(total_despesas_venda) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_despesas_venda, is_bold=True, bg_color='#f1f5f9')
            
            # Custos Operacionais (Rental only)
            if dre_data["header"]["is_rental"] and "custos_operacionais" in dre_data["saidas"]:
                co_data = dre_data["saidas"]["custos_operacionais"]
                total_custos_operacionais = co_data["total"]
                add_row("2.5 Custos Operacionais", (float(total_custos_operacionais) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_custos_operacionais, is_bold=True, is_indent=True, bg_color='#f8fafc')
                add_row("(-) Monitoramento", float(co_data["monitoramento"].get("percent", 0.0) or 0.0), co_data["monitoramento"]["valor"], is_indent=True)
                add_row("(-) Manutenção", float(co_data["manutencao"].get("percent", 0.0) or 0.0), co_data["manutencao"]["valor"], is_indent=True)
                for d in co_data["manutencao"].get("detalhes", []):
                    add_row(f"  (-) Manut. - {d['tipo']}", float(d.get("percent", 0.0) or 0.0), d["valor"], is_indent=True)
                add_row("(=) Total Custos Operacionais", (float(total_custos_operacionais) / float(dre_data["entradas"]["total_entradas"]) * 100) if dre_data["entradas"]["total_entradas"] > 0 else 0, total_custos_operacionais, is_bold=True, bg_color='#f1f5f9')
                
            # Resultado
            add_row("3. RESULTADO FINANCEIRO CONSOLIDADO", None, None, is_bold=True, bg_color='#f1f5f9')
            add_row("(=) LUCRO OPERACIONAL (EBITDA)", None, dre_data["lucro_ebitda"], is_bold=True, bg_color='#d1fae5')
            add_row("(=) MARGEM LÍQUIDA DA OPERAÇÃO", dre_data["margem_liquida"], None, is_bold=True, bg_color='#d1fae5')
            
            # Render ReportLab Table
            t = Table(table_data, colWidths=[300, 100, 150])
            t.setStyle(TableStyle(t_style))
            story.append(t)
            
            # Auditoria info
            story.append(Spacer(1, 6))
            story.append(Paragraph(
                f"Emitido por: {auditoria['usuario_emissor']} | Data: {auditoria['data']} às {auditoria['hora']} | ID Oportunidade: {opportunity_id} | Versão DRV: {auditoria['versao']}",
                ParagraphStyle('AuditStyle', parent=styles['Normal'], fontSize=6.5, textColor=colors.HexColor('#94a3b8'), alignment=1)
            ))
            
            doc.build(story)
            pdf_bytes = pdf_buffer.getvalue()
            pdf_buffer.close()
            
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=DRV_Oportunidade_{opportunity.numero_orcamento or opportunity_id}.pdf"
                }
            )

    @staticmethod
    def generate_fechamento_fornecedores_pdf(db: Session, opportunity_id: UUID, current_user: User) -> StreamingResponse:
        # 1. Fetch Opportunity
        opportunity = db.query(SalesBudget).filter(
            SalesBudget.id == opportunity_id,
            SalesBudget.tenant_id == current_user.tenant_id
        ).first()
        if not opportunity:
            raise HTTPException(status_code=404, detail="Oportunidade não encontrada")

        # 2. Fetch associated Purchase Budgets (Supplier Budgets)
        purchase_budgets = db.query(PurchaseBudget).filter(
            PurchaseBudget.sales_budget_id == opportunity_id,
            PurchaseBudget.tenant_id == current_user.tenant_id
        ).all()

        # 3. Fetch latest approval if approved
        approval_rec = db.query(SalesBudgetApproval).filter(
            SalesBudgetApproval.sales_budget_id == opportunity_id,
            SalesBudgetApproval.tenant_id == current_user.tenant_id
        ).order_by(SalesBudgetApproval.data_aprovacao.desc()).first()

        approval_data = None
        if opportunity.status == "APROVADO" and approval_rec:
            approval_data = {
                "aprovador_nome": approval_rec.usuario_aprovador.name if approval_rec.usuario_aprovador else "Aprovador",
                "data": approval_rec.data_aprovacao.strftime("%d/%m/%Y"),
                "hora": approval_rec.data_aprovacao.strftime("%H:%M")
            }

        # Determine Base Date for financial planning
        base_date = None
        if opportunity.data_vencimento_inicial:
            base_date = opportunity.data_vencimento_inicial
        elif approval_rec and approval_rec.data_aprovacao:
            base_date = approval_rec.data_aprovacao
        else:
            base_date = datetime.datetime.now()
            
        if isinstance(base_date, datetime.datetime):
            base_date = base_date.date()

        # 4. Consolidate Items and group by Supplier
        unpacked_items = []

        # Process standard items (including unpacking standard kits)
        for item in opportunity.items:
            if not item.opportunity_kit_id and item.product_id:
                unpacked_items.append({
                    "product_id": item.product_id,
                    "descricao": item.product_nome or (item.product.nome if item.product else "Equipamento"),
                    "part_number": item.product.part_number if item.product else None,
                    "quantidade": float(item.quantidade)
                })
            elif item.opportunity_kit_id:
                # Kit found: unpack items
                kit = db.query(OpportunityKit).filter(OpportunityKit.id == item.opportunity_kit_id).first()
                if kit:
                    for kit_item in kit.items:
                        if kit_item.product_id:
                            qty = float(item.quantidade) * float(kit_item.quantidade_no_kit)
                            unpacked_items.append({
                                "product_id": kit_item.product_id,
                                "descricao": kit_item.descricao_item or (kit_item.product.nome if kit_item.product else "Componente do Kit"),
                                "part_number": kit_item.product.part_number if kit_item.product else None,
                                "quantidade": qty
                            })

        # Process rental items
        for item in opportunity.rental_items:
            if item.product_id and not item.opportunity_kit_id:
                unpacked_items.append({
                    "product_id": item.product_id,
                    "descricao": item.product_nome or (item.product.nome if item.product else "Equipamento"),
                    "part_number": item.product.part_number if item.product else None,
                    "quantidade": float(item.quantidade)
                })
            elif item.opportunity_kit_id:
                # Kit found: unpack items
                kit = db.query(OpportunityKit).filter(OpportunityKit.id == item.opportunity_kit_id).first()
                if kit:
                    for kit_item in kit.items:
                        if kit_item.product_id:
                            qty = float(item.quantidade) * float(kit_item.quantidade_no_kit)
                            unpacked_items.append({
                                "product_id": kit_item.product_id,
                                "descricao": kit_item.descricao_item or (kit_item.product.nome if kit_item.product else "Componente do Kit"),
                                "part_number": kit_item.product.part_number if kit_item.product else None,
                                "quantidade": qty
                            })

        # Build product suppliers map for lookups (including fallback budgets from historical data)
        product_suppliers = {}
        for pb in purchase_budgets:
            for pb_item in pb.items:
                if pb_item.product_id:
                    product_suppliers[pb_item.product_id] = {
                        "pb_item": pb_item,
                        "pb": pb
                    }

        # For product IDs that don't have a supplier in the current opportunity's purchase budgets,
        # find the latest PurchaseBudgetItem and its PurchaseBudget for that product under the tenant
        all_product_ids = {item["product_id"] for item in unpacked_items if item.get("product_id")}
        for prod_id in all_product_ids:
            if prod_id not in product_suppliers:
                latest_pbi = db.query(PurchaseBudgetItem).join(
                    PurchaseBudget, PurchaseBudget.id == PurchaseBudgetItem.budget_id
                ).filter(
                    PurchaseBudgetItem.product_id == prod_id,
                    PurchaseBudget.tenant_id == current_user.tenant_id
                ).order_by(
                    PurchaseBudget.data_orcamento.desc(),
                    PurchaseBudget.created_at.desc()
                ).first()
                
                if latest_pbi:
                    product_suppliers[prod_id] = {
                        "pb_item": latest_pbi,
                        "pb": latest_pbi.budget
                    }

        all_pbs = list(purchase_budgets)
        seen_pb_ids = {pb.id for pb in all_pbs}
        for info in product_suppliers.values():
            pb = info["pb"]
            if pb.id not in seen_pb_ids:
                all_pbs.append(pb)
                seen_pb_ids.add(pb.id)

        if not all_pbs:
            raise HTTPException(
                status_code=400, 
                detail="Não existem orçamentos de fornecedores vinculados para gerar o relatório."
            )

        # Build tax lookup map: product_id -> {difal, st, source}
        opp_product_taxes = {}
        
        # A. Direct items in opportunity.rental_items
        for item in opportunity.rental_items:
            if not item.opportunity_kit_id and item.product_id:
                difal = float(item.difal_unit) if item.difal_unit is not None else 0.0
                st = float(item.icms_st_unit) if item.icms_st_unit is not None else 0.0
                opp_product_taxes[item.product_id] = {
                    "difal": difal,
                    "st": st,
                    "source": "opportunity_item"
                }

        # B. Kit items (both in opportunity.items and opportunity.rental_items)
        from src.modules.opportunity_kits.service import OpportunityKitService
        kit_service = OpportunityKitService(db)
        
        kit_ids = set()
        for item in opportunity.items:
            if item.opportunity_kit_id:
                kit_ids.add(item.opportunity_kit_id)
        for item in opportunity.rental_items:
            if item.opportunity_kit_id:
                kit_ids.add(item.opportunity_kit_id)
                
        for kit_id in kit_ids:
            kit = db.query(OpportunityKit).filter(OpportunityKit.id == kit_id).first()
            if kit:
                try:
                    # Find corresponding budget item or rental budget item to get override factor
                    override_factor = None
                    sale_item = next((item for item in opportunity.items if item.opportunity_kit_id == kit_id), None)
                    if sale_item:
                        override_factor = None
                    else:
                        rental_item = next((item for item in opportunity.rental_items if item.opportunity_kit_id == kit_id), None)
                        if rental_item:
                            override_factor = rental_item.fator_margem
                    
                    kit_financials = kit_service.calculate_financials(kit, opportunity.tenant_id, override_factor=override_factor, sales_budget_id=str(opportunity.id))
                    for item_sum in kit_financials.get("item_summaries", []):
                        p_id = item_sum.get("product_id")
                        if p_id:
                            p_uuid = UUID(p_id) if isinstance(p_id, str) else p_id
                            difal_val = float(item_sum.get("difal_unitario") or 0.0)
                            st_val = float(item_sum.get("icms_st_unitario") or 0.0)
                            opp_product_taxes[p_uuid] = {
                                "difal": difal_val,
                                "st": st_val,
                                "source": "opportunity_kit"
                            }
                except Exception as e:
                    print(f"[Warning] Failed to calculate financials for kit {kit_id}: {e}")

        # Helper to retrieve purchase tax unit breakdown for a product
        def get_purchase_tax_breakdown(prod_id, pb_item):
            tax_info = opp_product_taxes.get(prod_id)
            origem = None
            difal = 0.0
            st = 0.0
            ipi = 0.0
            
            if tax_info:
                difal = tax_info["difal"]
                st = tax_info["st"]
                origem = tax_info["source"]
            
            if difal == 0.0 and pb_item and pb_item.difal_unitario is not None and float(pb_item.difal_unitario) > 0.0:
                difal = float(pb_item.difal_unitario)
                origem = "purchase_budget"
            if st == 0.0 and pb_item and pb_item.st_unitario is not None and float(pb_item.st_unitario) > 0.0:
                st = float(pb_item.st_unitario)
                origem = "purchase_budget"
                
            if pb_item and pb_item.ipi_valor is not None and float(pb_item.ipi_valor) > 0.0:
                pb_qty = float(pb_item.quantidade) if float(pb_item.quantidade) > 0 else 1.0
                ipi = float(pb_item.ipi_valor) / pb_qty
            
            if origem is None:
                origem = "fallback_zero"
                
            return difal, st, ipi, origem

        # (product_suppliers is already built with fallback budgets at the start of the function)

        # Compile product calculations from opportunity items & kits exactly as in Approval report
        product_totals = {}
        
        def process_opp_items(items_list):
            for item in items_list:
                qty = float(item.quantidade)
                if item.opportunity_kit_id:
                    kit = db.query(OpportunityKit).filter(OpportunityKit.id == item.opportunity_kit_id).first()
                    if kit:
                        try:
                            override_factor = getattr(item, "fator_margem", None)
                            kit_financials = kit_service.calculate_financials(kit, opportunity.tenant_id, override_factor=override_factor, sales_budget_id=str(opportunity.id))
                            for c in kit_financials.get("item_summaries", []):
                                c_prod_id = c.get("product_id")
                                if c_prod_id:
                                    c_uuid = UUID(c_prod_id) if isinstance(c_prod_id, str) else c_prod_id
                                    c_qty = float(c.get("quantidade_no_kit") or 1.0) * qty
                                    c_cost_total = float(c.get("custo_total_item_no_kit") or 0.0) * qty
                                    
                                    pb_info = product_suppliers.get(c_uuid)
                                    pb_item = pb_info["pb_item"] if pb_info else None
                                    difal, st, ipi, source = get_purchase_tax_breakdown(c_uuid, pb_item)
                                    tax_total = (difal + st + ipi) * c_qty
                                    
                                    if c_uuid not in product_totals:
                                        product_totals[c_uuid] = {
                                            "qty": 0.0,
                                            "cost_total": 0.0,
                                            "tax_total": 0.0,
                                            "difal_total": 0.0,
                                            "st_total": 0.0,
                                            "ipi_total": 0.0,
                                            "source": source
                                        }
                                    product_totals[c_uuid]["qty"] += c_qty
                                    product_totals[c_uuid]["cost_total"] += c_cost_total
                                    product_totals[c_uuid]["tax_total"] += tax_total
                                    product_totals[c_uuid]["difal_total"] += difal * c_qty
                                    product_totals[c_uuid]["st_total"] += st * c_qty
                                    product_totals[c_uuid]["ipi_total"] += ipi * c_qty
                        except Exception as e:
                            print(f"[Warning] Failed to calculate financials for kit in fechamento: {e}")
                else:
                    if item.product_id:
                        pb_info = product_suppliers.get(item.product_id)
                        pb_item = pb_info["pb_item"] if pb_info else None
                        difal, st, ipi, source = get_purchase_tax_breakdown(item.product_id, pb_item)
                        tax_total = (difal + st + ipi) * qty
                        cost_total = float(item.custo_total_aquisicao or 0.0) * qty
                        
                        if item.product_id not in product_totals:
                            product_totals[item.product_id] = {
                                "qty": 0.0,
                                "cost_total": 0.0,
                                "tax_total": 0.0,
                                "difal_total": 0.0,
                                "st_total": 0.0,
                                "ipi_total": 0.0,
                                "source": source
                            }
                        product_totals[item.product_id]["qty"] += qty
                        product_totals[item.product_id]["cost_total"] += cost_total
                        product_totals[item.product_id]["tax_total"] += tax_total
                        product_totals[item.product_id]["difal_total"] += difal * qty
                        product_totals[item.product_id]["st_total"] += st * qty
                        product_totals[item.product_id]["ipi_total"] += ipi * qty

        process_opp_items(opportunity.items)
        process_opp_items(opportunity.rental_items)

        # Map unpacked items to purchase budget items
        mapped_by_supplier = {}
        for pb in all_pbs:
            supplier_id = pb.supplier_id
            supplier_name = pb.supplier_nome_fantasia
            if pb.dolar_orcamento and pb.valor_conversao:
                supplier_name = f"{supplier_name} (Cotação Dólar: R$ {format_rate(pb.valor_conversao)})"
            supplier_cnpj = pb.supplier_cnpj

            if supplier_id not in mapped_by_supplier:
                payment_desc = "Não informado"
                if pb.forma_pagamento:
                    payment_desc = pb.forma_pagamento.descricao
                elif pb.forma_pagamento_snapshot:
                    payment_desc = pb.forma_pagamento_snapshot.get("descricao", "Não informado")

                prazo_medio = 0
                if pb.forma_pagamento and pb.forma_pagamento.parcelas:
                    intervals = [p.intervalo_dias for p in pb.forma_pagamento.parcelas if p.intervalo_dias is not None]
                    if intervals:
                        prazo_medio = int(sum(intervals) / len(intervals))

                mapped_by_supplier[supplier_id] = {
                    "nome": supplier_name,
                    "cnpj": supplier_cnpj,
                    "contato": pb.vendedor_nome,
                    "condicao_pagamento": payment_desc,
                    "prazo_medio": prazo_medio,
                    "items": [],
                    "totais": {
                        "total_produtos": 0.0,
                        "total_difal": 0.0,
                        "total_st": 0.0,
                        "total_impostos": 0.0,
                        "total_geral": 0.0
                    },
                    "parcelas": []
                }

            # Map items for this supplier budget
            for pb_item in pb.items:
                prod_calc = product_totals.get(pb_item.product_id)
                if not prod_calc:
                    continue # Skip items that are not in the opportunity

                opp_qty = prod_calc["qty"]

                # Proportional Freight Calculation
                frete_unit = 0.0
                if pb_item.frete_valor is not None and float(pb_item.frete_valor) > 0.0:
                    pb_qty = float(pb_item.quantidade) if float(pb_item.quantidade) > 0 else 1.0
                    frete_unit = float(pb_item.frete_valor) / pb_qty
                frete_total = frete_unit * opp_qty

                val_final = prod_calc["cost_total"]
                difal_total = prod_calc["difal_total"]
                st_total = prod_calc["st_total"]
                ipi_total = prod_calc["ipi_total"]
                val_total = val_final - difal_total - st_total - ipi_total - frete_total

                val_unit = val_total / opp_qty if opp_qty > 0 else 0.0
                difal_unit = difal_total / opp_qty if opp_qty > 0 else 0.0
                st_unit = st_total / opp_qty if opp_qty > 0 else 0.0
                ipi_unit = ipi_total / opp_qty if opp_qty > 0 else 0.0
                origem_imposto = prod_calc["source"]

                product_desc = pb_item.product_nome or (pb_item.product.nome if pb_item.product else "Produto")
                if pb.dolar_orcamento and pb.valor_conversao and pb_item.valor_unitario_dolar is not None:
                    product_desc = f"{product_desc} (U$ {format_usd(pb_item.valor_unitario_dolar)} * Cot. R$ {format_rate(pb.valor_conversao)})"

                mapped_by_supplier[supplier_id]["items"].append({
                    "codigo_produto": pb_item.product_codigo or "",
                    "descricao": product_desc,
                    "part_number": pb_item.product.part_number if (pb_item.product and pb_item.product.part_number) else "",
                    "quantidade": opp_qty,
                    "valor_unitario": format_currency(val_unit),
                    "valor_total": format_currency(val_total),
                    "difal_unitario": format_currency(difal_unit),
                    "difal_total": format_currency(difal_total),
                    "st_unitario": format_currency(st_unit),
                    "st_total": format_currency(st_total),
                    "ipi_unitario": format_currency(ipi_unit),
                    "ipi_total": format_currency(ipi_total),
                    "frete_unitario": format_currency(frete_unit),
                    "frete_total": format_currency(frete_total),
                    "valor_final": format_currency(val_final),
                    "origem_imposto": origem_imposto,
                    # Numeric versions for backend summation
                    "_val_total": val_total,
                    "_difal_total": difal_total,
                    "_st_total": st_total,
                    "_ipi_total": ipi_total,
                    "_frete_total": frete_total,
                    "_val_final": val_final,
                    "_difal_unit": difal_unit,
                    "_st_unit": st_unit,
                    "_ipi_unit": ipi_unit
                })

        # Calculate supplier totals and fetch financial planning installments
        for supplier_id, data in list(mapped_by_supplier.items()):
            if not data["items"]:
                mapped_by_supplier.pop(supplier_id)
                continue

            total_prod = sum(item["_val_total"] for item in data["items"])
            total_difal = sum(item["_difal_total"] for item in data["items"])
            total_st = sum(item["_st_total"] for item in data["items"])
            total_ipi = sum(item["_ipi_total"] for item in data["items"])
            total_frete = sum(item["_frete_total"] for item in data["items"])
            total_imp = total_difal + total_st + total_ipi
            total_geral = total_prod + total_imp + total_frete
            total_custo_base = total_prod + total_ipi

            data["totais"] = {
                "total_produtos": format_currency(total_prod),
                "total_difal": format_currency(total_difal),
                "total_st": format_currency(total_st),
                "total_ipi": format_currency(total_ipi),
                "total_frete": format_currency(total_frete),
                "total_custo_base": format_currency(total_custo_base),
                "total_impostos": format_currency(total_imp),
                "total_geral": format_currency(total_geral),
                # Numeric
                "_total_produtos": total_prod,
                "_total_difal": total_difal,
                "_total_st": total_st,
                "_total_ipi": total_ipi,
                "_total_frete": total_frete,
                "_total_custo_base": total_custo_base,
                "_total_impostos": total_imp,
                "_total_geral": total_geral
            }

            # Parse payment condition dynamically
            pb = next(pb for pb in all_pbs if pb.supplier_id == supplier_id)
            cond_desc = "Não informado"
            if pb.forma_pagamento:
                cond_desc = pb.forma_pagamento.descricao
            elif pb.forma_pagamento_snapshot:
                cond_desc = pb.forma_pagamento_snapshot.get("descricao", "Não informado")
                
            parcelas, obs_pag = parse_payment_condition(cond_desc, total_geral, base_date)
            data["parcelas"] = parcelas
            data["observacao_pagamento"] = obs_pag

        if not mapped_by_supplier:
            raise HTTPException(status_code=400, detail="Nenhum item válido com fornecedor pôde ser extraído da oportunidade.")

        # 5. Build Fiscal Summary Lists (Filtered: only DIFAL > 0 or ST > 0 or IPI > 0)
        fiscal_difal_items = []
        fiscal_st_items = []
        fiscal_ipi_items = []
        for supplier_id, data in mapped_by_supplier.items():
            for item in data["items"]:
                if item["_difal_unit"] > 0:
                    fiscal_difal_items.append({
                        "descricao": item["descricao"],
                        "quantidade": item["quantidade"],
                        "difal_unitario": item["difal_unitario"],
                        "difal_total": item["difal_total"]
                    })
                if item["_st_unit"] > 0:
                    fiscal_st_items.append({
                        "descricao": item["descricao"],
                        "quantidade": item["quantidade"],
                        "st_unitario": item["st_unitario"],
                        "st_total": item["st_total"]
                    })
                if item["_ipi_unit"] > 0:
                    fiscal_ipi_items.append({
                        "descricao": item["descricao"],
                        "quantidade": item["quantidade"],
                        "ipi_unitario": item["ipi_unitario"],
                        "ipi_total": item["ipi_total"]
                    })

        # 6. Calculate Consolidated Opportunity KPIs
        venda_consolidada = float(opportunity.valor_total or 0.0)
        
        # 8. Build Consolidated General Section
        total_prod_all = sum(float(item["_val_total"]) for data in mapped_by_supplier.values() for item in data["items"])
        total_difal_all = sum(float(item["_difal_total"]) for data in mapped_by_supplier.values() for item in data["items"])
        total_st_all = sum(float(item["_st_total"]) for data in mapped_by_supplier.values() for item in data["items"])
        total_ipi_all = sum(float(item["_ipi_total"]) for data in mapped_by_supplier.values() for item in data["items"])
        total_frete_all = sum(float(item["_frete_total"]) for data in mapped_by_supplier.values() for item in data["items"])
        total_imp_all = total_difal_all + total_st_all + total_ipi_all
        total_geral_all = total_prod_all + total_imp_all + total_frete_all

        custo_consolidado = total_geral_all
        lucro_bruto = venda_consolidada - custo_consolidado
        custo_impostos = total_imp_all
        markup = (venda_consolidada / custo_consolidado) if custo_consolidado > 0 else 1.0
        
        qtd_fornecedores = len(mapped_by_supplier)
        qtd_produtos = sum(float(item["quantidade"]) for supplier in mapped_by_supplier.values() for item in supplier["items"])
        
        if qtd_produtos.is_integer():
            qtd_produtos_str = str(int(qtd_produtos))
        else:
            qtd_produtos_str = f"{qtd_produtos:.2f}"

        kpis = {
            "venda_consolidada": format_currency(venda_consolidada),
            "custo_consolidado": format_currency(custo_consolidado),
            "lucro_bruto": format_currency(lucro_bruto),
            "custo_impostos": format_currency(custo_impostos),
            "markup": f"{markup:.2f}",
            "qtd_fornecedores": str(qtd_fornecedores),
            "qtd_produtos": qtd_produtos_str,
            "custo_total_base_ipi": format_currency(total_prod_all + total_ipi_all),
            "custo_impostos_compra": format_currency(total_difal_all + total_st_all)
        }

        # 7. Build Fechamento por Fornecedor Section
        fechamento_fornecedores = []
        total_equipamentos_f = 0.0
        total_impostos_f = 0.0
        total_frete_f = 0.0
        
        for data in mapped_by_supplier.values():
            e_val = data["totais"]["_total_produtos"]
            i_val = data["totais"]["_total_impostos"]
            f_val = data["totais"]["_total_frete"]
            t_val = data["totais"]["_total_geral"]
            
            total_equipamentos_f += e_val
            total_impostos_f += i_val
            total_frete_f += f_val
            
            fechamento_fornecedores.append({
                "nome": data["nome"],
                "equipamentos": format_currency(e_val),
                "impostos": format_currency(i_val),
                "frete": format_currency(f_val),
                "total": format_currency(t_val)
            })
            
        total_geral_f = total_equipamentos_f + total_impostos_f + total_frete_f
        
        fechamento_totals = {
            "total_equipamentos": format_currency(total_equipamentos_f),
            "total_impostos": format_currency(total_impostos_f),
            "total_frete": format_currency(total_frete_f),
            "total_geral": format_currency(total_geral_f)
        }

        consolidado_geral = {
            "total_produtos": format_currency(total_prod_all),
            "total_difal": format_currency(total_difal_all),
            "total_st": format_currency(total_st_all),
            "total_ipi": format_currency(total_ipi_all),
            "total_frete": format_currency(total_frete_all),
            "total_impostos": format_currency(total_imp_all),
            "total_geral_aquisicao": format_currency(total_geral_all)
        }

        # 8.5. Validate Mathematical Consistency
        import logging
        logger = logging.getLogger("cerberus.reports")

        for supplier_id, data in mapped_by_supplier.items():
            s_nome = data["nome"]
            s_total_prod = data["totais"]["_total_produtos"]
            s_total_imp = data["totais"]["_total_impostos"]
            s_total_frete = data["totais"]["_total_frete"]
            s_total_geral = data["totais"]["_total_geral"]

            # Validação 1: Σ Equipamentos + Σ Impostos + Σ Frete = Custo Total
            diff1 = abs((s_total_prod + s_total_imp + s_total_frete) - s_total_geral)
            if diff1 > 0.005:
                logger.warning(
                    f"SupplierClosingReportWarning\n\n"
                    f"Fornecedor:\n{s_nome}\n\n"
                    f"Diferença:\nR$ {diff1:.2f}"
                )

            # Validação 3: Σ Parcelas = Total do Fornecedor
            sum_parcelas = sum(p["_valor_numerico"] for p in data["parcelas"])
            diff3 = abs(sum_parcelas - s_total_geral)
            if diff3 > 0.005:
                logger.warning(
                    f"SupplierClosingReportWarning\n\n"
                    f"Fornecedor:\n{s_nome}\n\n"
                    f"Diferença:\nR$ {diff3:.2f}"
                )

        # Validação 2: Σ Fornecedores = Total Geral Aquisição
        sum_suppliers_totals = sum(data["totais"]["_total_geral"] for data in mapped_by_supplier.values())
        diff2 = abs(sum_suppliers_totals - total_geral_all)
        if diff2 > 0.005:
            logger.warning(
                f"SupplierClosingReportWarning\n\n"
                f"Fornecedor:\nCONSOLIDADO (Validação 2)\n\n"
                f"Diferença:\nR$ {diff2:.2f}"
            )

        # Status translation
        status_labels = {
            "EM_LANCAMENTO": "RASCUNHO",
            "ENVIADO_APROVACAO": "EM APROVAÇÃO",
            "RETORNADO_VENDEDOR": "REPROVADA",
            "APROVADO": "APROVADA",
            "CANCELADO": "CANCELADA",
            "GANHO": "GANHA"
        }

        opportunity_dict = {
            "id": str(opportunity.id),
            "numero_orcamento": opportunity.numero_orcamento or str(opportunity.id)[:8],
            "titulo": opportunity.titulo,
            "customer_nome": opportunity.customer.nome_fantasia or opportunity.customer.razao_social if opportunity.customer else "Cliente Não Informado",
            "vendedor_nome": opportunity.vendedor.name if opportunity.vendedor else "Não Informado",
            "status_label": status_labels.get(opportunity.status, opportunity.status),
            "company_nome": opportunity.company.nome_fantasia or opportunity.company.razao_social if opportunity.company else "Empresa Não Informada"
        }

        now = datetime.datetime.now()
        emissao_data_hora = now.strftime("%d/%m/%Y às %H:%M")

        auditoria = {
            "usuario_emissor": current_user.name or current_user.email,
            "data": now.strftime("%d/%m/%Y"),
            "hora": now.strftime("%H:%M"),
            "versao": "1.0.0"
        }

        # 8. Render Template
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        templates_dir = os.path.join(base_dir, "templates", "reports")
        
        # Determine company logo path
        company_logo = None
        if opportunity.company and opportunity.company.logo_url:
            root_dir = os.path.dirname(os.path.dirname(base_dir))
            clean_path = opportunity.company.logo_url.lstrip("/")
            abs_logo_path = os.path.join(root_dir, clean_path)
            if os.path.exists(abs_logo_path):
                normalized_path = abs_logo_path.replace("\\", "/")
                company_logo = f"file:///{normalized_path}"

        css_path = os.path.join(templates_dir, "fechamento_fornecedores_v1.css")
        html_path = os.path.join(templates_dir, "fechamento_fornecedores_v1.html")

        # Load stylesheet
        css_content = ""
        if os.path.exists(css_path):
            with open(css_path, "r", encoding="utf-8") as f:
                css_content = f.read()

        # Load HTML
        html_template = ""
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
            opportunity=opportunity_dict,
            company_logo=company_logo,
            emissao_data_hora=emissao_data_hora,
            approval=approval_data,
            kpis=kpis,
            suppliers_data=list(mapped_by_supplier.values()),
            fiscal_difal_items=fiscal_difal_items,
            fiscal_st_items=fiscal_st_items,
            fiscal_ipi_items=fiscal_ipi_items,
            consolidado_geral=consolidado_geral,
            auditoria=auditoria,
            fechamento_fornecedores=fechamento_fornecedores,
            fechamento_totals=fechamento_totals
        )

        # 9. PDF Generation with WeasyPrint & Fallback to ReportLab
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=rendered_html).write_pdf()
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=fechamento-fornecedores-{opportunity_dict['numero_orcamento']}.pdf"
                }
            )
        except Exception as weasy_err:
            print(f"[Warning] WeasyPrint failed. Falling back to ReportLab. Error: {weasy_err}")
            # REPORTLAB FALLBACK
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buffer, 
                pagesize=landscape(letter),
                rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30
            )
            story = []
            styles = getSampleStyleSheet()

            # Define styles
            title_style = ParagraphStyle(
                'ReportTitle',
                parent=styles['Heading1'],
                fontSize=18,
                textColor=colors.HexColor('#0f172a'),
                spaceAfter=15
            )
            sub_style = ParagraphStyle(
                'SubStyle',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#475569'),
                spaceAfter=15
            )
            table_header_style = ParagraphStyle(
                'TableHeader',
                parent=styles['Normal'],
                fontSize=8,
                fontName='Helvetica-Bold',
                textColor=colors.white
            )
            table_cell_style = ParagraphStyle(
                'TableCell',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#1e293b')
            )

            story.append(Paragraph(f"Relatório Executivo de Fechamento de Fornecedores - #{opportunity_dict['numero_orcamento']}", title_style))
            story.append(Paragraph(f"Cliente: {opportunity_dict['customer_nome']} | Vendedor: {opportunity_dict['vendedor_nome']} | Emissão: {emissao_data_hora}", sub_style))

            # Render summary table (updated to match KPIs)
            kpi_data = [
                ["Venda Consolidada", "Custo Consolidado", "Custo Impostos", "MKP", "Qtd. Fornecedores", "Qtd. Produtos"],
                [f"R$ {kpis['venda_consolidada']}", f"R$ {kpis['custo_consolidado']}", f"R$ {kpis['custo_impostos']}", f"{kpis['markup']}x", kpis['qtd_fornecedores'], kpis['qtd_produtos']]
            ]
            kpi_table = Table(kpi_data, colWidths=[115]*6)
            kpi_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,-1), 9),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0')),
            ]))
            story.append(kpi_table)
            story.append(Spacer(1, 20))

            # Group by supplier
            for supplier in list(mapped_by_supplier.values()):
                story.append(Paragraph(f"Fornecedor: {supplier['nome']} (CNPJ: {supplier['cnpj'] or '-'})", styles['Heading2']))
                story.append(Paragraph(f"Condição: {supplier['condicao_pagamento']} | Prazo Médio: {supplier['prazo_medio']} dias", styles['Normal']))
                if supplier.get("observacao_pagamento"):
                    story.append(Paragraph(f"Observação: {supplier['observacao_pagamento']}", styles['Normal']))
                story.append(Spacer(1, 6))

                table_data = [[
                    Paragraph("Cod. produto", table_header_style),
                    Paragraph("Produto", table_header_style), 
                    Paragraph("Part Number", table_header_style), 
                    Paragraph("Qtd", table_header_style), 
                    Paragraph("Val. Unit", table_header_style), 
                    Paragraph("Total", table_header_style), 
                    Paragraph("ST Total", table_header_style), 
                    Paragraph("DIFAL Total", table_header_style), 
                    Paragraph("IPI Total", table_header_style), 
                    Paragraph("Frete Total", table_header_style), 
                    Paragraph("Valor Final", table_header_style)
                ]]
                for item in supplier["items"]:
                    table_data.append([
                        Paragraph(item["codigo_produto"], table_cell_style),
                        Paragraph(item["descricao"], table_cell_style),
                        Paragraph(item["part_number"] or "", table_cell_style),
                        Paragraph(str(item["quantidade"]), table_cell_style),
                        Paragraph(f"R$ {item['valor_unitario']}", table_cell_style),
                        Paragraph(f"R$ {item['valor_total']}", table_cell_style),
                        Paragraph(f"R$ {item['st_total']}", table_cell_style),
                        Paragraph(f"R$ {item['difal_total']}", table_cell_style),
                        Paragraph(f"R$ {item['ipi_total']}", table_cell_style),
                        Paragraph(f"R$ {item['frete_total']}", table_cell_style),
                        Paragraph(f"R$ {item['valor_final']}", table_cell_style)
                    ])

                table_data.append([
                    Paragraph("TOTAL FORNECEDOR", table_cell_style),
                    Paragraph("-", table_cell_style),
                    Paragraph("-", table_cell_style),
                    Paragraph("-", table_cell_style),
                    Paragraph("-", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_produtos']}", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_st']}", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_difal']}", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_ipi']}", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_frete']}", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_geral']}", table_cell_style)
                ])

                supplier_table = Table(table_data, colWidths=[50, 120, 50, 30, 55, 55, 55, 55, 55, 55, 70])
                supplier_table.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#334155')),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                    ('TOPPADDING', (0,0), (-1,-1), 4),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                    ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
                    ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
                ]))
                story.append(supplier_table)
                story.append(Spacer(1, 10))

                # Render payment planning table inside ReportLab fallback
                story.append(Paragraph("Cronograma de Pagamentos Previstos", styles['Heading3']))
                pay_data = [["Parcela", "Percentual (%)", "Data Prevista", "Valor Previsto"]]
                for p in supplier["parcelas"]:
                    pay_data.append([
                        Paragraph(p["label_parcela"], table_cell_style),
                        Paragraph(p["percentual"] + "%", table_cell_style),
                        Paragraph(p["data_prevista"], table_cell_style),
                        Paragraph(f"R$ {p['valor']}", table_cell_style)
                    ])
                pay_table = Table(pay_data, colWidths=[100, 100, 100, 100])
                pay_table.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#475569')),
                    ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                    ('TOPPADDING', (0,0), (-1,-1), 4),
                    ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ]))
                story.append(pay_table)
                story.append(Spacer(1, 15))

            # Fechamento por Fornecedor table in ReportLab
            story.append(Paragraph("Fechamento por Fornecedor", styles['Heading2']))
            story.append(Spacer(1, 6))
            
            fech_data = [[
                Paragraph("Fornecedor", table_header_style),
                Paragraph("Equipamentos", table_header_style),
                Paragraph("Impostos", table_header_style),
                Paragraph("Frete", table_header_style),
                Paragraph("Total", table_header_style)
            ]]
            for f in fechamento_fornecedores:
                fech_data.append([
                    Paragraph(f["nome"], table_cell_style),
                    Paragraph(f"R$ {f['equipamentos']}", table_cell_style),
                    Paragraph(f"R$ {f['impostos']}", table_cell_style),
                    Paragraph(f"R$ {f['frete']}", table_cell_style),
                    Paragraph(f"R$ {f['total']}", table_cell_style)
                ])
            fech_data.append([
                Paragraph("TOTAL GERAL", table_cell_style),
                Paragraph(f"R$ {fechamento_totals['total_equipamentos']}", table_cell_style),
                Paragraph(f"R$ {fechamento_totals['total_impostos']}", table_cell_style),
                Paragraph(f"R$ {fechamento_totals['total_frete']}", table_cell_style),
                Paragraph(f"R$ {fechamento_totals['total_geral']}", table_cell_style)
            ])
            fech_table = Table(fech_data, colWidths=[200, 100, 100, 100, 100])
            fech_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ('FONTNAME', (0,-1), (-1,-1), 'Helvetica-Bold'),
                ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
            ]))
            story.append(fech_table)
            story.append(Spacer(1, 15))

            # Build document
            doc.build(story)
            pdf_buffer.seek(0)
            return StreamingResponse(
                pdf_buffer,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=fechamento-fornecedores-{opportunity_dict['numero_orcamento']}.pdf"
                }
            )

    @staticmethod
    def generate_venda_approval_pdf(db: Session, opportunity_id: UUID, current_user: User) -> StreamingResponse:
        # 1. Fetch Opportunity
        opportunity = db.query(SalesBudget).filter(
            SalesBudget.id == opportunity_id,
            SalesBudget.tenant_id == current_user.tenant_id
        ).first()
        if not opportunity:
            raise HTTPException(status_code=404, detail="Oportunidade não encontrada")

        # 2. Fetch associated Purchase Budgets (Supplier Budgets)
        purchase_budgets = db.query(PurchaseBudget).filter(
            PurchaseBudget.sales_budget_id == opportunity_id,
            PurchaseBudget.tenant_id == current_user.tenant_id
        ).all()
        # Sort by created_at descending to prioritize the latest budgets when matching names/terms
        purchase_budgets = sorted(purchase_budgets, key=lambda x: getattr(x, "created_at", None) or datetime.datetime.min, reverse=True)

        # Check if company CNPJ is same as customer CNPJ (Intercompany)
        is_same_cnpj = False
        if opportunity.company and opportunity.customer and opportunity.company.cnpj and opportunity.customer.cnpj:
            import re
            def clean_cnpj(val):
                return re.sub(r"\D", "", val)
            is_same_cnpj = clean_cnpj(opportunity.company.cnpj) == clean_cnpj(opportunity.customer.cnpj)

        # Build tax lookup map: product_id -> {difal, st, source}
        opp_product_taxes = {}
        
        # A. Direct items in opportunity.items
        for item in opportunity.items:
            if not item.opportunity_kit_id and item.product_id:
                difal = float(getattr(item, "difal_unit", 0.0) or 0.0)
                st = float(getattr(item, "icms_st_unit", 0.0) or 0.0)
                opp_product_taxes[item.product_id] = {
                    "difal": difal,
                    "st": st,
                    "source": "opportunity_item"
                }

        # B. Kit items in opportunity.items
        kit_service = OpportunityKitService(db)
        kit_ids = set()
        for item in opportunity.items:
            if item.opportunity_kit_id:
                kit_ids.add(item.opportunity_kit_id)
                
        kits_by_id = {}
        for kit_id in kit_ids:
            kit = db.query(OpportunityKit).filter(OpportunityKit.id == kit_id).first()
            if kit:
                kits_by_id[kit.id] = kit
                try:
                    budget_item = next((item for item in opportunity.items if item.opportunity_kit_id == kit_id), None)
                    kit_financials = kit_service.calculate_financials(kit, opportunity.tenant_id, override_factor=None, sales_budget_id=str(opportunity.id))
                    for item_sum in kit_financials.get("item_summaries", []):
                        p_id = item_sum.get("product_id")
                        if p_id:
                            p_uuid = UUID(p_id) if isinstance(p_id, str) else p_id
                            difal_val = float(item_sum.get("difal_unitario") or 0.0)
                            st_val = float(item_sum.get("icms_st_unitario") or 0.0)
                            opp_product_taxes[p_uuid] = {
                                "difal": difal_val,
                                "st": st_val,
                                "source": "opportunity_kit"
                            }
                except Exception as e:
                    print(f"[Warning] Failed to calculate financials for kit {kit_id}: {e}")

        # Build supplier lookup map: product_id -> {fornecedor, pb_item, pb}
        product_suppliers = {}
        for pb in purchase_budgets:
            for pb_item in pb.items:
                if pb_item.product_id:
                    product_suppliers[pb_item.product_id] = {
                        "fornecedor": pb.supplier_nome_fantasia,
                        "pb_item": pb_item,
                        "pb": pb
                    }

        # Extract types from kits
        sales_types = set()
        purchase_tax_types = set()
        contract_types_mapping = {
            "VENDA_EQUIPAMENTOS": "Venda",
            "LOCACAO": "Locação",
            "COMODATO": "Comodato",
            "INSTALACAO": "Instalação"
        }
        for kit in kits_by_id.values():
            if kit.tipo_contrato:
                sales_types.add(contract_types_mapping.get(kit.tipo_contrato, kit.tipo_contrato))
            if kit.considerar_st_ou_difal:
                purchase_tax_types.add(kit.considerar_st_ou_difal)

        tipo_venda = ", ".join(sorted(list(sales_types))) if sales_types else "Venda"
        forma_compra = ", ".join(sorted(list(purchase_tax_types))) if purchase_tax_types else "DIFAL"
        if "Venda" in tipo_venda or tipo_venda.upper() == "VENDA":
            forma_compra = "ST"

        # Now consolidate items_details (Block 1)
        items_details = []
        total_frete_compra_all = 0.0

        # Helper to retrieve purchase tax unit breakdown for a product
        def get_purchase_tax_breakdown(prod_id, pb_item):
            tax_info = opp_product_taxes.get(prod_id)
            origem = None
            difal = 0.0
            st = 0.0
            ipi = 0.0
            
            if tax_info:
                difal = tax_info["difal"]
                st = tax_info["st"]
                origem = tax_info["source"]
            
            # Fallback to purchase budget item if zero/missing
            if difal == 0.0 and pb_item and pb_item.difal_unitario is not None and float(pb_item.difal_unitario) > 0.0:
                difal = float(pb_item.difal_unitario)
                origem = "purchase_budget"
            if st == 0.0 and pb_item and pb_item.st_unitario is not None and float(pb_item.st_unitario) > 0.0:
                st = float(pb_item.st_unitario)
                origem = "purchase_budget"
                
            if pb_item and pb_item.ipi_valor is not None and float(pb_item.ipi_valor) > 0.0:
                pb_qty = float(pb_item.quantidade) if float(pb_item.quantidade) > 0 else 1.0
                ipi = float(pb_item.ipi_valor) / pb_qty
            
            if origem is None:
                origem = "fallback_zero"
                
            return difal, st, ipi, origem

        # Determine if interestate sale
        is_interestadual = False

        if opportunity.company and opportunity.customer and opportunity.company.state and opportunity.customer.state:
            is_interestadual = opportunity.company.state.sigla != opportunity.customer.state.sigla

        # A. Loop standard items
        for item in opportunity.items:
            qty = float(item.quantidade)
            if not item.opportunity_kit_id and item.product_id:
                # Standalone item
                pb_info = product_suppliers.get(item.product_id)
                supplier_name = pb_info["fornecedor"] if pb_info else None
                if not supplier_name and item.product_id:
                    from src.modules.products.models import Product
                    product = db.query(Product).filter(Product.id == item.product_id).first()
                    if product:
                        ref_id = product.orcamento_referencia_revenda_id or product.orcamento_referencia_uso_consumo_id
                        if ref_id:
                            pb = db.query(PurchaseBudget).filter(PurchaseBudget.id == ref_id).first()
                            if pb:
                                supplier_name = pb.supplier_nome_fantasia
                if not supplier_name:
                    supplier_name = "Não Cadastrado"
                pb_item = pb_info["pb_item"] if pb_info else None
                
                difal_unit, st_unit, ipi_unit, origem_imposto = get_purchase_tax_breakdown(item.product_id, pb_item)
                frete_compra_unit = float(pb_item.frete_valor) / float(pb_item.quantidade) if (pb_item and pb_item.frete_valor and pb_item.quantidade > 0) else 0.0
                custo_unit = (float(pb_item.valor_unitario) if pb_item else float(item.custo_unit_base or 0.0)) + frete_compra_unit
                purchase_tax_unit = difal_unit + st_unit + ipi_unit
                
                # Accumulate freight
                total_frete_compra_all += frete_compra_unit * qty
                
                # Exibição de custos unificando base + IPI + ST + DIFAL
                custo_unit_exibido = custo_unit + ipi_unit + st_unit + difal_unit
                custo_total_exibido = custo_unit_exibido * qty
                
                # Sales tax unit
                if is_same_cnpj and item.tipo_item == "MERCADORIA":
                    pis_unit = 0.0
                    cofins_unit = 0.0
                    csll_unit = 0.0
                    irpj_unit = 0.0
                    icms_unit = 0.0
                    iss_unit = 0.0
                else:
                    pis_unit = float(item.pis_unit or 0.0)
                    cofins_unit = float(item.cofins_unit or 0.0)
                    csll_unit = float(item.csll_unit or 0.0)
                    irpj_unit = float(item.irpj_unit or 0.0)
                    icms_unit = float(item.icms_unit or 0.0)
                    iss_unit = float(item.iss_unit or 0.0)
                sales_tax_unit = pis_unit + cofins_unit + csll_unit + irpj_unit + icms_unit + iss_unit
                
                if is_same_cnpj and item.tipo_item == "MERCADORIA":
                    venda_unit = custo_unit + purchase_tax_unit + ipi_unit
                else:
                    venda_unit = float(item.venda_unit or 0.0)
                venda_total = venda_unit * qty
                custo_total = custo_unit * qty
                purchase_tax_total = purchase_tax_unit * qty
                difal_total = difal_unit * qty
                st_total = st_unit * qty
                ipi_total = ipi_unit * qty
                
                # Deduct ICMS ST if interestate
                sales_tax_total = sales_tax_unit * qty
                if is_interestadual and st_total > 0:
                    sales_tax_total = max(0.0, sales_tax_total - st_total)
                
                # Expenses
                if is_same_cnpj and item.tipo_item == "MERCADORIA":
                    frete_venda_unit = 0.0
                    desp_adm_unit = 0.0
                    comissao_unit = 0.0
                    despesa_op_unit = 0.0
                else:
                    frete_venda_unit = float(item.frete_venda_unit or 0.0)
                    desp_adm_unit = float(item.despesa_adm_unit or 0.0)
                    comissao_unit = float(item.comissao_unit or 0.0)
                    despesa_op_unit = float(getattr(item, "despesa_operacional_unit", 0.0) or 0.0)
                
                frete_total = frete_venda_unit * qty
                desp_adm_total = desp_adm_unit * qty
                comissao_total = comissao_unit * qty
                despesa_op_total = despesa_op_unit * qty
                despesas_adm_total = frete_total + desp_adm_total + comissao_total + despesa_op_total
                
                lucro_total = 0.0 if (is_same_cnpj and item.tipo_item == "MERCADORIA") else (venda_total - custo_total - ipi_total - st_total - difal_total - sales_tax_total - despesas_adm_total)
                if is_same_cnpj and item.tipo_item == "MERCADORIA":
                    mkp_venda = (venda_unit / custo_unit) if custo_unit > 0 else 1.0
                else:
                    mkp_venda = float(item.markup or 1.0)
                
                item_desc = item.product_nome or (item.product.nome if item.product else "Equipamento")
                if pb_info and pb_info.get("pb") and pb_info["pb"].dolar_orcamento:
                    pb = pb_info["pb"]
                    pb_item = pb_info["pb_item"]
                    if pb.valor_conversao and pb_item.valor_unitario_dolar is not None:
                        item_desc = f"{item_desc} (U$ {format_usd(pb_item.valor_unitario_dolar)} * Cot. R$ {format_rate(pb.valor_conversao)})"

                items_details.append({
                    "product_id": item.product_id,
                    "descricao": item_desc,
                    "fornecedor": supplier_name,
                    "quantidade": qty,
                    "custo_unitario": format_currency(custo_unit_exibido),
                    "custo_total": format_currency(custo_total_exibido),
                    "imposto_compra_unit": format_currency(purchase_tax_unit),
                    "markup": f"{mkp_venda:.2f}",
                    "valor_venda": format_currency(venda_unit),
                    "venda_total": format_currency(venda_total),
                    "impostos_venda": format_currency(sales_tax_total),
                    "despesas_adm": format_currency(despesas_adm_total),
                    "lucro_total": format_currency(lucro_total),
                    "origem_imposto": origem_imposto,
                    "components": [],
                    # Numeric for summaries
                    "_venda_total": venda_total,
                    "_custo_total": custo_total,
                    "_custo_total_exibido": custo_total_exibido,
                    "_purchase_tax_total": purchase_tax_total,
                    "_sales_tax_total": sales_tax_total,
                    "_despesas_adm_total": despesas_adm_total,
                    "_lucro_total": lucro_total,
                    "_difal_total": difal_total,
                    "_st_total": st_total,
                    "_ipi_total": ipi_total,
                    "_pis_unit": pis_unit,
                    "_pis_total": pis_unit * qty,
                    "_cofins_unit": cofins_unit,
                    "_cofins_total": cofins_unit * qty,
                    "_csll_unit": csll_unit,
                    "_csll_total": csll_unit * qty,
                    "_irpj_unit": irpj_unit,
                    "_irpj_total": irpj_unit * qty,
                    "_icms_unit": icms_unit,
                    "_icms_total": icms_unit * qty,
                    "_iss_unit": iss_unit,
                    "_iss_total": iss_unit * qty,
                    "_frete_unit": frete_venda_unit,
                    "_frete_total": frete_total,
                    "_desp_adm_unit": desp_adm_unit,
                    "_desp_adm_total": desp_adm_total,
                    "_comissao_unit": comissao_unit,
                    "_comissao_total": comissao_total,
                    "_despesa_op_unit": despesa_op_unit,
                    "_despesa_op_total": despesa_op_total,
                })
            elif item.opportunity_kit_id:
                # Kit item (pack components into it)
                kit = kits_by_id.get(item.opportunity_kit_id)
                if kit:
                    try:
                        kit_financials = kit_service.calculate_financials(kit, opportunity.tenant_id, override_factor=None, sales_budget_id=str(opportunity.id))
                        
                        # Initialize kit details consolidator
                        kit_qty = float(item.quantidade)
                        kit_details = {
                            "product_id": None,
                            "descricao": kit.nome_kit or "Kit",
                            "fornecedor": "-",
                            "quantidade": kit_qty,
                            "custo_unitario": "0,00",
                            "custo_total": "0,00",
                            "imposto_compra_unit": "0,00",
                            "markup": "1.00",
                            "valor_venda": "0,00",
                            "venda_total": "0,00",
                            "impostos_venda": "0,00",
                            "despesas_adm": "0,00",
                            "lucro_total": "0,00",
                            "origem_imposto": "opportunity_kit",
                            "components": [],
                            "_venda_total": 0.0,
                            "_custo_total": 0.0,
                            "_custo_total_exibido": 0.0,
                            "_custo_servicos_proprios_total": 0.0,
                            "_purchase_tax_total": 0.0,
                            "_sales_tax_total": 0.0,
                            "_despesas_adm_total": 0.0,
                            "_lucro_total": 0.0,
                            "_difal_total": 0.0,
                            "_st_total": 0.0,
                            "_ipi_total": 0.0,
                            "_pis_unit": 0.0,
                            "_pis_total": 0.0,
                            "_cofins_unit": 0.0,
                            "_cofins_total": 0.0,
                            "_csll_unit": 0.0,
                            "_csll_total": 0.0,
                            "_irpj_unit": 0.0,
                            "_irpj_total": 0.0,
                            "_icms_unit": 0.0,
                            "_icms_total": 0.0,
                            "_iss_unit": 0.0,
                            "_iss_total": 0.0,
                            "_frete_unit": 0.0,
                            "_frete_total": 0.0,
                            "_desp_adm_unit": 0.0,
                            "_desp_adm_total": 0.0,
                            "_comissao_unit": 0.0,
                            "_comissao_total": 0.0,
                            "_despesa_op_total": 0.0
                        }
                        
                        components_list = []
                        
                        for summary in kit_financials.get("item_summaries", []):
                            p_id = summary.get("product_id")
                            p_uuid = UUID(p_id) if isinstance(p_id, str) else p_id
                            
                            # Find matching kit item to get the quantity per kit
                            own_service_id = summary.get("own_service_id")
                            if own_service_id:
                                o_uuid = UUID(own_service_id) if isinstance(own_service_id, str) else own_service_id
                                kit_item = next((ki for ki in kit.items if ki.own_service_id == o_uuid), None)
                            else:
                                kit_item = next((ki for ki in kit.items if ki.product_id == p_uuid), None)

                            qty_in_kit = float(kit_item.quantidade_no_kit) if kit_item else 1.0
                            component_qty = kit_qty * qty_in_kit
                            
                            pb_info = product_suppliers.get(p_uuid) if p_uuid else None
                            supplier_name = pb_info["fornecedor"] if pb_info else None
                            if not supplier_name and p_uuid:
                                from src.modules.products.models import Product
                                product = db.query(Product).filter(Product.id == p_uuid).first()
                                if product:
                                    ref_id = product.orcamento_referencia_revenda_id or product.orcamento_referencia_uso_consumo_id
                                    if ref_id:
                                        pb = db.query(PurchaseBudget).filter(PurchaseBudget.id == ref_id).first()
                                        if pb:
                                            supplier_name = pb.supplier_nome_fantasia
                            if not supplier_name:
                                supplier_name = "Não Cadastrado"
                            
                            if p_uuid:
                                difal_unit = float(summary.get("difal_unitario") or 0.0)
                                st_unit = float(summary.get("icms_st_unitario") or 0.0)
                                ipi_unit = float(summary.get("ipi_unit") or 0.0)
                                frete_compra_unit = float(summary.get("frete_cif_unit") or 0.0)
                                base_forn = summary.get("base_fornecedor")
                                if base_forn is not None:
                                    custo_unit = float(base_forn) + frete_compra_unit
                                else:
                                    custo_unit = float(summary.get("custo_base_unitario_item") or 0.0) - (difal_unit + st_unit + ipi_unit)
                                origem_imposto = "opportunity_kit"
                            else:
                                difal_unit = 0.0
                                st_unit = 0.0
                                ipi_unit = 0.0
                                frete_compra_unit = 0.0
                                custo_unit = float(summary.get("custo_base_unitario_item") or 0.0)
                                origem_imposto = "service"
                                
                            total_frete_compra_all += frete_compra_unit * component_qty
                                
                            purchase_tax_unit = difal_unit + st_unit + ipi_unit
                            
                            # Custo Unitário com impostos (IPI + ST + DIFAL) embutidos na exibição
                            custo_unit_exibido = custo_unit + ipi_unit + st_unit + difal_unit
                            custo_total_exibido = custo_unit_exibido * component_qty
                            
                            # Sales tax from kit summary
                            if is_same_cnpj:
                                sales_tax_unit = 0.0
                                pis_unit = 0.0
                                cofins_unit = 0.0
                                csll_unit = 0.0
                                irpj_unit = 0.0
                                icms_unit = 0.0
                                iss_unit = 0.0
                            else:
                                sales_tax_unit = float(summary.get("imposto_venda_item") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                                pis_unit = float(summary.get("pis_unit") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                                cofins_unit = float(summary.get("cofins_unit") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                                csll_unit = float(summary.get("csll_unit") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                                irpj_unit = float(summary.get("irpj_unit") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                                icms_unit = float(summary.get("icms_unit") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                                iss_unit = float(summary.get("iss_unit") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                            
                            if is_same_cnpj:
                                venda_unit = custo_unit + purchase_tax_unit + ipi_unit
                                venda_total = venda_unit * component_qty
                            else:
                                venda_unit = float(summary.get("venda_unitario_item") or 0.0)
                                # Puxar venda total diretamente do kit para evitar discrepâncias de arredondamento
                                venda_total = float(summary.get("venda_total_item") or 0.0) * kit_qty
                                
                            custo_total = custo_unit * component_qty
                            purchase_tax_total = purchase_tax_unit * component_qty
                            difal_total = difal_unit * component_qty
                            st_total = st_unit * component_qty
                            ipi_total = ipi_unit * component_qty
                            
                            # Deduct ICMS ST if interestate
                            sales_tax_total = sales_tax_unit * component_qty
                            if is_interestadual and st_total > 0:
                                sales_tax_total = max(0.0, sales_tax_total - st_total)
                            
                            # Expenses
                            if is_same_cnpj:
                                frete_venda_unit = 0.0
                                desp_adm_unit = 0.0
                                comissao_unit = 0.0
                            else:
                                frete_venda_unit = float(summary.get("frete_venda_item") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                                desp_adm_unit = float(summary.get("desp_adm_item") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                                comissao_unit = float(summary.get("comissao_item") or 0.0) / qty_in_kit if qty_in_kit > 0 else 0.0
                            
                            frete_total = frete_venda_unit * component_qty
                            desp_adm_total = desp_adm_unit * component_qty
                            comissao_total = comissao_unit * component_qty
                            despesas_adm_total = frete_total + desp_adm_total + comissao_total
                            
                            lucro_total = 0.0 if is_same_cnpj else (venda_total - custo_total - ipi_total - st_total - difal_total - sales_tax_total - despesas_adm_total)
                            
                            # Usar o markup calculado de cada item dentro do kit lançado
                            mkp_venda = float(summary.get("fator_item") or 1.0)
                            
                            product_desc = summary.get("descricao")
                            if not product_desc and kit_item:
                                product_desc = kit_item.descricao_item or (kit_item.product.nome if kit_item.product else "Componente")
                            if not product_desc:
                                product_desc = "Componente do Kit"
                            if pb_info and pb_info.get("pb") and pb_info["pb"].dolar_orcamento:
                                pb = pb_info["pb"]
                                pb_item = pb_info["pb_item"]
                                if pb.valor_conversao and pb_item.valor_unitario_dolar is not None:
                                    product_desc = f"{product_desc} (U$ {format_usd(pb_item.valor_unitario_dolar)} * Cot. R$ {format_rate(pb.valor_conversao)})"
                                
                            comp_dict = {
                                "product_id": p_uuid,
                                "descricao": product_desc,
                                "fornecedor": supplier_name,
                                "quantidade": component_qty,
                                "custo_unitario": format_currency(custo_unit_exibido),
                                "custo_total": format_currency(custo_total_exibido),
                                "imposto_compra_unit": format_currency(purchase_tax_unit),
                                "markup": f"{mkp_venda:.2f}",
                                "valor_venda": format_currency(venda_unit),
                                "venda_total": format_currency(venda_total),
                                "impostos_venda": format_currency(sales_tax_total),
                                "despesas_adm": format_currency(despesas_adm_total),
                                "lucro_total": format_currency(lucro_total),
                                "origem_imposto": origem_imposto,
                                "components": [],
                                "_custo_total": custo_total,
                                "_custo_total_exibido": custo_total_exibido,
                                "_ipi_total": ipi_total
                            }
                            components_list.append(comp_dict)
                            
                            # Accumulate in kit details
                            kit_details["_custo_total"] += custo_total
                            kit_details["_custo_total_exibido"] += custo_total_exibido
                            kit_details["_venda_total"] += venda_total
                            kit_details["_purchase_tax_total"] += purchase_tax_total
                            kit_details["_sales_tax_total"] += sales_tax_total
                            kit_details["_despesas_adm_total"] += despesas_adm_total
                            kit_details["_lucro_total"] += lucro_total
                            kit_details["_difal_total"] += difal_total
                            kit_details["_st_total"] += st_total
                            kit_details["_ipi_total"] += ipi_total
                            kit_details["_pis_total"] += pis_unit * component_qty
                            kit_details["_cofins_total"] += cofins_unit * component_qty
                            kit_details["_csll_total"] += csll_unit * component_qty
                            kit_details["_irpj_total"] += irpj_unit * component_qty
                            kit_details["_icms_total"] += icms_unit * component_qty
                            kit_details["_iss_total"] += iss_unit * component_qty
                            kit_details["_frete_total"] += frete_total
                            kit_details["_desp_adm_total"] += desp_adm_total
                            kit_details["_comissao_total"] += comissao_total

                        # 4.2. Virtual components for Installation and Maintenance inside the kit
                        vlr_instal_calc = float(kit_financials["summary"].get("vlr_instal_calc", 0.0) or 0.0)
                        fator_margem_inst = float(getattr(kit, "fator_margem_instalacao", 1.0) or 1.0)
                        if getattr(kit, "instalacao_inclusa", False):
                            valor_venda_instalacao = float(kit_financials["summary"].get("valor_venda_instalacao", 0.0) or 0.0)
                        else:
                            valor_venda_instalacao = vlr_instal_calc * fator_margem_inst
                        
                        if valor_venda_instalacao > 0:
                            venda_total_inst = valor_venda_instalacao * kit_qty
                            custo_total_inst = vlr_instal_calc * kit_qty
                            
                            pis_unit = (valor_venda_instalacao * float(kit.aliq_pis or 0.0) / 100.0)
                            cofins_unit = (valor_venda_instalacao * float(kit.aliq_cofins or 0.0) / 100.0)
                            csll_unit = (valor_venda_instalacao * float(kit.aliq_csll or 0.0) / 100.0)
                            irpj_unit = (valor_venda_instalacao * float(kit.aliq_irpj or 0.0) / 100.0)
                            iss_unit = (valor_venda_instalacao * float(kit.aliq_iss or 0.0) / 100.0)
                            sales_tax_unit = pis_unit + cofins_unit + csll_unit + irpj_unit + iss_unit
                            sales_tax_total = sales_tax_unit * kit_qty
                            
                            frete_venda_unit = valor_venda_instalacao * (float(kit.perc_frete_venda or 0.0) / 100.0)
                            desp_adm_unit = valor_venda_instalacao * (float(kit.perc_despesas_adm or 0.0) / 100.0)
                            comissao_unit = valor_venda_instalacao * (float(kit.perc_comissao or 0.0) / 100.0)
                            
                            frete_total = frete_venda_unit * kit_qty
                            desp_adm_total = desp_adm_unit * kit_qty
                            comissao_total = comissao_unit * kit_qty
                            despesas_adm_total = frete_total + desp_adm_total + comissao_total
                            
                            lucro_total = venda_total_inst - custo_total_inst - sales_tax_total - despesas_adm_total
                            
                            inst_dict = {
                                "product_id": None,
                                "descricao": f"Serviço de Instalação - Kit: {kit.nome_kit}",
                                "fornecedor": "Próprio",
                                "quantidade": kit_qty,
                                "custo_unitario": format_currency(0.0),
                                "custo_total": format_currency(0.0),
                                "imposto_compra_unit": format_currency(0.0),
                                "markup": f"{fator_margem_inst:.2f}",
                                "valor_venda": format_currency(valor_venda_instalacao),
                                "venda_total": format_currency(venda_total_inst),
                                "impostos_venda": format_currency(sales_tax_total),
                                "despesas_adm": format_currency(despesas_adm_total),
                                "lucro_total": format_currency(lucro_total),
                                "origem_imposto": "n/a",
                                "components": [],
                                "_custo_total_exibido": 0.0
                            }
                            components_list.append(inst_dict)
                            
                            # Accumulate
                            kit_details["_custo_servicos_proprios_total"] += custo_total_inst
                            kit_details["_venda_total"] += venda_total_inst
                            kit_details["_sales_tax_total"] += sales_tax_total
                            kit_details["_despesas_adm_total"] += despesas_adm_total
                            kit_details["_lucro_total"] += lucro_total
                            kit_details["_pis_total"] += pis_unit * kit_qty
                            kit_details["_cofins_total"] += cofins_unit * kit_qty
                            kit_details["_csll_total"] += csll_unit * kit_qty
                            kit_details["_irpj_total"] += irpj_unit * kit_qty
                            kit_details["_iss_total"] += iss_unit * kit_qty
                            kit_details["_frete_total"] += frete_total
                            kit_details["_desp_adm_total"] += desp_adm_total
                            kit_details["_comissao_total"] += comissao_total

                        # Maintenance
                        vlt_manut = float(kit_financials["summary"].get("vlt_manut", 0.0) or 0.0)
                        venda_manutencao_total = float(kit_financials["summary"].get("venda_manutencao_total", 0.0) or 0.0)
                        fator_margem_manut = float(getattr(kit, "fator_margem_manutencao", 1.0) or 1.0)
                        
                        if venda_manutencao_total > 0:
                            venda_total_manut = venda_manutencao_total * kit_qty
                            custo_total_manut = vlt_manut * kit_qty
                            
                            pis_unit = (venda_manutencao_total * float(kit.aliq_pis or 0.0) / 100.0)
                            cofins_unit = (venda_manutencao_total * float(kit.aliq_cofins or 0.0) / 100.0)
                            csll_unit = (venda_manutencao_total * float(kit.aliq_csll or 0.0) / 100.0)
                            irpj_unit = (venda_manutencao_total * float(kit.aliq_irpj or 0.0) / 100.0)
                            iss_unit = (venda_manutencao_total * float(kit.aliq_iss or 0.0) / 100.0)
                            sales_tax_unit = pis_unit + cofins_unit + csll_unit + irpj_unit + iss_unit
                            sales_tax_total = sales_tax_unit * kit_qty
                            
                            frete_venda_unit = venda_manutencao_total * (float(kit.perc_frete_venda or 0.0) / 100.0)
                            desp_adm_unit = venda_manutencao_total * (float(kit.perc_despesas_adm or 0.0) / 100.0)
                            comissao_unit = venda_manutencao_total * (float(kit.perc_comissao or 0.0) / 100.0)
                            
                            frete_total = frete_venda_unit * kit_qty
                            desp_adm_total = desp_adm_unit * kit_qty
                            comissao_total = comissao_unit * kit_qty
                            despesas_adm_total = frete_total + desp_adm_total + comissao_total
                            
                            lucro_total = venda_total_manut - custo_total_manut - sales_tax_total - despesas_adm_total
                            
                            manut_dict = {
                                "product_id": None,
                                "descricao": f"Serviço de Manutenção - Kit: {kit.nome_kit}",
                                "fornecedor": "Próprio",
                                "quantidade": kit_qty,
                                "custo_unitario": format_currency(0.0),
                                "custo_total": format_currency(0.0),
                                "imposto_compra_unit": format_currency(0.0),
                                "markup": f"{fator_margem_manut:.2f}",
                                "valor_venda": format_currency(venda_manutencao_total),
                                "venda_total": format_currency(venda_total_manut),
                                "impostos_venda": format_currency(sales_tax_total),
                                "despesas_adm": format_currency(despesas_adm_total),
                                "lucro_total": format_currency(lucro_total),
                                "origem_imposto": "n/a",
                                "components": [],
                                "_custo_total_exibido": 0.0
                            }
                            components_list.append(manut_dict)
                            
                            # Accumulate
                            kit_details["_custo_servicos_proprios_total"] += custo_total_manut
                            kit_details["_venda_total"] += venda_total_manut
                            kit_details["_sales_tax_total"] += sales_tax_total
                            kit_details["_despesas_adm_total"] += despesas_adm_total
                            kit_details["_lucro_total"] += lucro_total
                            kit_details["_pis_total"] += pis_unit * kit_qty
                            kit_details["_cofins_total"] += cofins_unit * kit_qty
                            kit_details["_csll_total"] += csll_unit * kit_qty
                            kit_details["_irpj_total"] += irpj_unit * kit_qty
                            kit_details["_iss_total"] += iss_unit * kit_qty
                            kit_details["_frete_total"] += frete_total
                            kit_details["_desp_adm_total"] += desp_adm_total
                            kit_details["_comissao_total"] += comissao_total
                        
                        # Set formatted values for the Kit itself
                        kit_details["custo_total"] = format_currency(kit_details["_custo_total_exibido"])
                        kit_details["custo_unitario"] = format_currency(kit_details["_custo_total_exibido"] / kit_qty if kit_qty > 0 else 0.0)
                        kit_details["imposto_compra_unit"] = format_currency(kit_details["_purchase_tax_total"] / kit_qty if kit_qty > 0 else 0.0)
                        
                        # Calculate kit average factor dynamically based on active factors
                        summary_dct = kit_financials.get("summary", {})
                        items_list = kit.items or []
                        cost_summaries = kit_financials.get("cost_summaries", [])
                        
                        inst_sums = [cs for cs in cost_summaries if cs.get("tipo_custo") == "INSTALACAO"]
                        custo_b5 = sum(float(cs.get("custo_total_item_no_kit") or 0.0) for cs in inst_sums)
                        venda_b5 = sum(float(cs.get("venda_total_item") or 0.0) for cs in inst_sums)
                        
                        has_products = any(ki.product_id for ki in items_list) or float(summary_dct.get("custo_aquisicao_produtos") or 0.0) > 0
                        has_services = any(ki.own_service_id for ki in items_list) or float(summary_dct.get("custo_aquisicao_servicos") or 0.0) > 0
                        
                        active_factors = []
                        if has_products:
                            active_factors.append(float(kit.fator_margem_locacao or 0.0))
                        if has_services:
                            active_factors.append(float(kit.fator_margem_servicos_produtos or 0.0))
                        if custo_b5 > 0 or venda_b5 > 0 or getattr(kit, "instalacao_inclusa", False):
                            active_factors.append(float(kit.fator_margem_instalacao or 0.0))
                        if getattr(kit, "havera_manutencao", False):
                            active_factors.append(float(kit.fator_margem_manutencao or 0.0))
                            
                        if active_factors:
                            avg_fator = sum(active_factors) / len(active_factors)
                        else:
                            avg_fator = float(kit.fator_margem_locacao or 1.0)
                            
                        # Set markup to dash for parent kit row per user request
                        kit_details["markup"] = "-"
                        
                        despesa_op_total = float(kit_financials["summary"].get("vlt_despesa_operacional", 0.0) or 0.0) * kit_qty
                        kit_details["_despesa_op_total"] = despesa_op_total
                        kit_details["_despesas_adm_total"] += despesa_op_total
                        kit_details["_lucro_total"] -= despesa_op_total
                        
                        kit_details["valor_venda"] = format_currency(kit_details["_venda_total"] / kit_qty if kit_qty > 0 else 0.0)
                        kit_details["venda_total"] = format_currency(kit_details["_venda_total"])
                        kit_details["impostos_venda"] = format_currency(kit_details["_sales_tax_total"])
                        kit_details["despesas_adm"] = format_currency(kit_details["_despesas_adm_total"])
                        kit_details["lucro_total"] = format_currency(kit_details["_lucro_total"])
                        kit_details["components"] = components_list
                        
                        items_details.append(kit_details)
                    except Exception as e:
                        print(f"[Warning] Failed to pack kit item {item.id}: {e}")

        # B. Rental items loop removed from sale approval to prevent duplicates

        # 3. Calculate Consolidated proposal KPIs
        venda_consolidada = sum(x["_venda_total"] for x in items_details)
        custo_consolidado = sum(x["_custo_total"] for x in items_details)
        custo_servicos_proprios_total = sum(x.get("_custo_servicos_proprios_total", 0.0) for x in items_details)
        
        # Obter totais de impostos de compra
        total_difal_all = sum(x["_difal_total"] for x in items_details)
        total_st_all = sum(x["_st_total"] for x in items_details)
        total_ipi_all = sum(x["_ipi_total"] for x in items_details)
        
        # Imposto de Compra no card superior = ST + DIFAL
        custo_impostos = total_difal_all + total_st_all
        
        # Custo de Aquisição no card superior = Custo Base + IPI + Serviços Próprios
        custo_total_com_impostos = custo_consolidado + total_ipi_all + custo_servicos_proprios_total
        
        total_custo_aquisicao = custo_total_com_impostos + custo_impostos
        
        if is_same_cnpj:
            impostos_venda = 0.0
            despesas_totais = 0.0
            lucro_total = 0.0
            margem_percentual = 0.0
            markup = 1.0
            custo_total_com_impostos = venda_consolidada
            total_custo_aquisicao = venda_consolidada
        else:
            impostos_venda = sum(x["_sales_tax_total"] for x in items_details)
            despesas_totais = sum(x["_despesas_adm_total"] for x in items_details)
            lucro_total = venda_consolidada - custo_total_com_impostos - custo_impostos - impostos_venda - despesas_totais
            margem_percentual = (lucro_total / venda_consolidada * 100.0) if venda_consolidada > 0 else 0.0
            markup = (venda_consolidada / total_custo_aquisicao) if total_custo_aquisicao > 0 else 1.0

        kpis = {
            "venda_consolidada": format_currency(venda_consolidada),
            "custo_consolidado": format_currency(custo_consolidado),
            "custo_impostos": format_currency(custo_impostos),
            "impostos_venda": format_currency(impostos_venda),
            "despesas_totais": format_currency(despesas_totais),
            "lucro_total": format_currency(lucro_total),
            "margem_percentual": f"{margem_percentual:.2f}",
            "markup": f"{markup:.2f}",
            "mkp_venda_relatorio": f"{(venda_consolidada / total_custo_aquisicao):.4f}" if total_custo_aquisicao > 0 else "0.0000",
            "custo_total_com_impostos": format_currency(custo_total_com_impostos),
            "custo_total_consolidado_relatorio": format_currency(sum(x.get("_custo_total_exibido", 0.0) for x in items_details))
        }
        print("PDF REPORT KPIS:", kpis)

        # 4. Block 2: Supplier Summaries
        # Group real products from items_details (flattened, filtering product_id is not None to exclude services)
        real_products = []
        for x in items_details:
            if x.get("components"):
                for c in x["components"]:
                    if c.get("product_id") is not None:
                        real_products.append(c)
            else:
                if x.get("product_id") is not None:
                    real_products.append(x)
                    
        by_supplier = {}
        for p in real_products:
            sup_name = p.get("fornecedor") or "Não Cadastrado"
            if sup_name not in by_supplier:
                by_supplier[sup_name] = {
                    "total_sem_imposto": 0.0,
                    "total_imposto": 0.0,
                }
            by_supplier[sup_name]["total_sem_imposto"] += p["_custo_total"]
            by_supplier[sup_name]["total_imposto"] += p["_ipi_total"]
            
        supplier_summaries = []
        for sup_name, data in by_supplier.items():
            pb = next((b for b in purchase_budgets if b.supplier_nome_fantasia == sup_name), None)
            
            orcamento_num = "Não Informado"
            payment_desc = "Não informado"
            if pb:
                orcamento_num = pb.numero_orcamento or str(pb.id)[:8]
                if pb.forma_pagamento:
                    payment_desc = pb.forma_pagamento.descricao
                elif pb.forma_pagamento_snapshot:
                    payment_desc = pb.forma_pagamento_snapshot.get("descricao", "Não informado")
                    
            total_sem_imposto = data["total_sem_imposto"]
            total_imposto = data["total_imposto"]
            total_custo = total_sem_imposto + total_imposto
            
            supplier_summaries.append({
                "orcamento": orcamento_num,
                "fornecedor": sup_name,
                "total_sem_imposto": format_currency(total_sem_imposto),
                "total_imposto": format_currency(total_imposto),
                "total_custo": format_currency(total_custo),
                "forma_pagamento": payment_desc,
                # Numeric for totalizers
                "_total_sem_imposto": total_sem_imposto,
                "_total_imposto": total_imposto,
                "_total_custo": total_custo
            })

        # Calculate supplier summary totals
        supplier_totals = {
            "total_sem_imposto": format_currency(sum(x["_total_sem_imposto"] for x in supplier_summaries)),
            "total_imposto": format_currency(sum(x["_total_imposto"] for x in supplier_summaries)),
            "total_custo": format_currency(sum(x["_total_custo"] for x in supplier_summaries))
        }

        # 4.5. Calculate Totalized Sales and Purchase Taxes and Expenses
        pis_total = sum(x["_pis_total"] for x in items_details)
        cofins_total = sum(x["_cofins_total"] for x in items_details)
        csll_total = sum(x["_csll_total"] for x in items_details)
        irpj_total = sum(x["_irpj_total"] for x in items_details)
        icms_total = sum(x["_icms_total"] for x in items_details)
        iss_total = sum(x["_iss_total"] for x in items_details)
        
        total_qty = sum(float(x["quantidade"]) for x in items_details)
        
        # Unit values calculated based on total divided by total quantity (Point 4)
        pis_unit = (pis_total / total_qty) if total_qty > 0 else 0.0
        cofins_unit = (cofins_total / total_qty) if total_qty > 0 else 0.0
        csll_unit = (csll_total / total_qty) if total_qty > 0 else 0.0
        irpj_unit = (irpj_total / total_qty) if total_qty > 0 else 0.0
        icms_unit = (icms_total / total_qty) if total_qty > 0 else 0.0
        iss_unit = (iss_total / total_qty) if total_qty > 0 else 0.0
        
        # Nominal tax rates directly from opportunity defaults if active, otherwise 0.0% (Point 3)
        if is_same_cnpj:
            pis_rate = 0.0
            cofins_rate = 0.0
            csll_rate = 0.0
            irpj_rate = 0.0
            icms_rate = 0.0
            iss_rate = 0.0
            total_sales_tax_rate = 0.0
            
            pis_unit = 0.0
            cofins_unit = 0.0
            csll_unit = 0.0
            irpj_unit = 0.0
            icms_unit = 0.0
            iss_unit = 0.0
            
            pis_total = 0.0
            cofins_total = 0.0
            csll_total = 0.0
            irpj_total = 0.0
            icms_total = 0.0
            iss_total = 0.0
        else:
            pis_rate = float(opportunity.perc_pis or 0.0) if pis_total > 0 else 0.0
            cofins_rate = float(opportunity.perc_cofins or 0.0) if cofins_total > 0 else 0.0
            csll_rate = float(opportunity.perc_csll or 0.0) if csll_total > 0 else 0.0
            irpj_rate = float(opportunity.perc_irpj or 0.0) if irpj_total > 0 else 0.0
            icms_rate = float(opportunity.perc_icms_interno or 0.0) if icms_total > 0 else 0.0
            iss_rate = float(opportunity.perc_iss or 0.0) if iss_total > 0 else 0.0
            total_sales_tax_rate = pis_rate + cofins_rate + csll_rate + irpj_rate + icms_rate + iss_rate
        
        sales_taxes_summary = [
            {"name": "PIS", "percent": f"{pis_rate:.2f}%", "unit": format_currency(pis_unit), "total": format_currency(pis_total)},
            {"name": "COFINS", "percent": f"{cofins_rate:.2f}%", "unit": format_currency(cofins_unit), "total": format_currency(cofins_total)},
            {"name": "CSLL", "percent": f"{csll_rate:.2f}%", "unit": format_currency(csll_unit), "total": format_currency(csll_total)},
            {"name": "IRPJ", "percent": f"{irpj_rate:.2f}%", "unit": format_currency(irpj_unit), "total": format_currency(irpj_total)},
            {"name": "ICMS", "percent": f"{icms_rate:.2f}%", "unit": format_currency(icms_unit), "total": format_currency(icms_total)},
            {"name": "ISS", "percent": f"{iss_rate:.2f}%", "unit": format_currency(iss_unit), "total": format_currency(iss_total)},
        ]
        
        total_st_all = sum(x["_st_total"] for x in items_details)
        if is_interestadual and total_st_all > 0:
            sales_taxes_summary.append({
                "name": "Dedução ICMS ST (Compra)",
                "percent": "-",
                "unit": "-",
                "total": f"-{format_currency(total_st_all)}"
            })
            
        sales_taxes_totals = {
            "percent": f"{total_sales_tax_rate:.2f}%",
            "unit": format_currency(pis_unit + cofins_unit + csll_unit + irpj_unit + icms_unit + iss_unit),
            "total": format_currency(impostos_venda)
        }

        total_difal_all = sum(x["_difal_total"] for x in items_details)
        total_st_all = sum(x["_st_total"] for x in items_details)
        total_ipi_all = sum(x["_ipi_total"] for x in items_details)
        
        # Calculate percentages relative to the total cost without tax (custo_consolidado)
        difal_pct = (total_difal_all / custo_consolidado * 100.0) if custo_consolidado > 0 else 0.0
        st_pct = (total_st_all / custo_consolidado * 100.0) if custo_consolidado > 0 else 0.0
        ipi_pct = (total_ipi_all / custo_consolidado * 100.0) if custo_consolidado > 0 else 0.0
        
        purchase_taxes_summary = [
            {"name": "DIFAL", "percent": f"{difal_pct:.2f}%", "total": format_currency(total_difal_all)},
            {"name": "Substituição Tributária (ST)", "percent": f"{st_pct:.2f}%", "total": format_currency(total_st_all)},
            {"name": "IPI", "percent": f"{ipi_pct:.2f}%", "total": format_currency(total_ipi_all)},
        ]
        purchase_taxes_totals = {
            "percent": f"{(difal_pct + st_pct + ipi_pct):.2f}%",
            "total": format_currency(total_difal_all + total_st_all + total_ipi_all)
        }

        frete_total = sum(x["_frete_total"] for x in items_details)
        desp_adm_total = sum(x["_desp_adm_total"] for x in items_details)
        comissao_total = sum(x["_comissao_total"] for x in items_details)
        despesa_op_total = sum(x.get("_despesa_op_total", 0.0) for x in items_details)
        
        # Unit values calculated based on total divided by total quantity (Point 4)
        if is_same_cnpj:
            frete_pct = 0.0
            desp_adm_pct = 0.0
            comissao_pct = 0.0
            despesa_op_pct = 0.0
            
            frete_unit = 0.0
            desp_adm_unit = 0.0
            comissao_unit = 0.0
            despesa_op_unit = 0.0
            
            frete_total = 0.0
            desp_adm_total = 0.0
            comissao_total = 0.0
            despesa_op_total = 0.0
        else:
            frete_unit = (frete_total / total_qty) if total_qty > 0 else 0.0
            desp_adm_unit = (desp_adm_total / total_qty) if total_qty > 0 else 0.0
            comissao_unit = (comissao_total / total_qty) if total_qty > 0 else 0.0
            despesa_op_unit = (despesa_op_total / total_qty) if total_qty > 0 else 0.0
            
            # Percentages relative to total revenue (venda_consolidada)
            frete_pct = (frete_total / venda_consolidada * 100.0) if venda_consolidada > 0 else 0.0
            desp_adm_pct = (desp_adm_total / venda_consolidada * 100.0) if venda_consolidada > 0 else 0.0
            comissao_pct = (comissao_total / venda_consolidada * 100.0) if venda_consolidada > 0 else 0.0
            despesa_op_pct = (despesa_op_total / venda_consolidada * 100.0) if venda_consolidada > 0 else 0.0
        
        expenses_summary = [
            {"name": "Despesas Administrativas", "percent": f"{desp_adm_pct:.2f}%", "unit": format_currency(desp_adm_unit), "total": format_currency(desp_adm_total)},
            {"name": "Frete de Venda", "percent": f"{frete_pct:.2f}%", "unit": format_currency(frete_unit), "total": format_currency(frete_total)},
            {"name": "Comissão de Venda", "percent": f"{comissao_pct:.2f}%", "unit": format_currency(comissao_unit), "total": format_currency(comissao_total)},
            {"name": "Despesas Operacionais", "percent": f"{despesa_op_pct:.2f}%", "unit": format_currency(despesa_op_unit), "total": format_currency(despesa_op_total)},
        ]
        expenses_totals = {
            "percent": f"{(desp_adm_pct + frete_pct + comissao_pct + despesa_op_pct):.2f}%",
            "unit": format_currency(desp_adm_unit + frete_unit + comissao_unit + despesa_op_unit),
            "total": format_currency(desp_adm_total + frete_total + comissao_total + despesa_op_total)
        }
        
        commission_expenses_summary = [
            {"name": "Comissão de Venda", "percent": f"{comissao_pct:.2f}%", "unit": format_currency(comissao_unit), "total": format_currency(comissao_total)},
            {"name": "Despesas Operacionais", "percent": f"{despesa_op_pct:.2f}%", "unit": format_currency(despesa_op_unit), "total": format_currency(despesa_op_total)},
        ]
        commission_expenses_totals = {
            "percent": f"{(comissao_pct + despesa_op_pct):.2f}%",
            "unit": format_currency(comissao_unit + despesa_op_unit),
            "total": format_currency(comissao_total + despesa_op_total)
        }
        
        admin_expenses_summary = [
            {"name": "Despesas Administrativas", "percent": f"{desp_adm_pct:.2f}%", "unit": format_currency(desp_adm_unit), "total": format_currency(desp_adm_total)},
            {"name": "Frete de Venda", "percent": f"{frete_pct:.2f}%", "unit": format_currency(frete_unit), "total": format_currency(frete_total)},
        ]
        admin_expenses_totals = {
            "percent": f"{(desp_adm_pct + frete_pct):.2f}%",
            "unit": format_currency(desp_adm_unit + frete_unit),
            "total": format_currency(desp_adm_total + frete_total)
        }

        # 5. Opportunity dict
        status_labels = {
            "EM_LANCAMENTO": "RASCUNHO",
            "ENVIADO_APROVACAO": "EM APROVAÇÃO",
            "RETORNADO_VENDEDOR": "REPROVADA",
            "APROVADO": "APROVADA",
            "CANCELADO": "CANCELADA",
            "GANHO": "GANHA"
        }
        opportunity_dict = {
            "id": str(opportunity.id),
            "numero_orcamento": opportunity.numero_orcamento or str(opportunity.id)[:8],
            "titulo": opportunity.titulo,
            "customer_nome": opportunity.customer.nome_fantasia or opportunity.customer.razao_social if opportunity.customer else "Cliente Não Informado",
            "vendedor_nome": opportunity.vendedor.name if opportunity.vendedor else "Não Informado",
            "status_label": status_labels.get(opportunity.status, opportunity.status),
            "company_nome": opportunity.company.nome_fantasia or opportunity.company.razao_social if opportunity.company else "Empresa Não Informada"
        }

        now = datetime.datetime.now()
        emissao_data_hora = now.strftime("%d/%m/%Y às %H:%M")
        auditoria = {
            "usuario_emissor": current_user.name or current_user.email,
            "data": now.strftime("%d/%m/%Y"),
            "hora": now.strftime("%H:%M"),
            "versao": "1.0.0"
        }

        # 6. Render Template
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        templates_dir = os.path.join(base_dir, "templates", "reports")
        
        # Determine company logo path
        company_logo = None
        if opportunity.company and opportunity.company.logo_url:
            root_dir = os.path.dirname(os.path.dirname(base_dir))
            clean_path = opportunity.company.logo_url.lstrip("/")
            abs_logo_path = os.path.join(root_dir, clean_path)
            if os.path.exists(abs_logo_path):
                normalized_path = abs_logo_path.replace("\\", "/")
                company_logo = f"file:///{normalized_path}"

        css_path = os.path.join(templates_dir, "venda_approval_v1.css")
        html_path = os.path.join(templates_dir, "venda_approval_v1.html")

        # Load stylesheet
        css_content = ""
        if os.path.exists(css_path):
            with open(css_path, "r", encoding="utf-8") as f:
                css_content = f.read()

        # Load HTML
        html_template = ""
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
            opportunity=opportunity_dict,
            company_logo=company_logo,
            emissao_data_hora=emissao_data_hora,
            kpis=kpis,
            tipo_venda=tipo_venda,
            forma_compra=forma_compra,
            items_details=items_details,
            supplier_summaries=supplier_summaries,
            supplier_totals=supplier_totals,
            sales_taxes_summary=sales_taxes_summary,
            sales_taxes_totals=sales_taxes_totals,
            purchase_taxes_summary=purchase_taxes_summary,
            purchase_taxes_totals=purchase_taxes_totals,
            expenses_summary=expenses_summary,
            expenses_totals=expenses_totals,
            commission_expenses_summary=commission_expenses_summary,
            commission_expenses_totals=commission_expenses_totals,
            admin_expenses_summary=admin_expenses_summary,
            admin_expenses_totals=admin_expenses_totals,
            auditoria=auditoria
        )

        # 7. PDF Generation with WeasyPrint & Fallback to ReportLab
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=rendered_html).write_pdf()
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=approval-venda-{opportunity_dict['numero_orcamento']}.pdf"
                }
            )
        except Exception as weasy_err:
            print(f"[Warning] WeasyPrint failed. Falling back to ReportLab. Error: {weasy_err}")
            # REPORTLAB FALLBACK
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buffer, 
                pagesize=landscape(letter),
                rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30
            )
            story = []
            styles = getSampleStyleSheet()

            # Define styles
            title_style = ParagraphStyle(
                'ReportTitle',
                parent=styles['Heading1'],
                fontSize=16,
                textColor=colors.HexColor('#0f172a'),
                spaceAfter=10
            )
            sub_style = ParagraphStyle(
                'SubStyle',
                parent=styles['Normal'],
                fontSize=8.5,
                textColor=colors.HexColor('#475569'),
                spaceAfter=10
            )
            table_header_style = ParagraphStyle(
                'TableHeader',
                parent=styles['Normal'],
                fontSize=7.5,
                fontName='Helvetica-Bold',
                textColor=colors.white
            )
            table_cell_style = ParagraphStyle(
                'TableCell',
                parent=styles['Normal'],
                fontSize=7.5,
                textColor=colors.HexColor('#1e293b')
            )

            story.append(Paragraph(f"Relatório Executivo de Approval de Venda - #{opportunity_dict['numero_orcamento']}", title_style))
            story.append(Paragraph(f"Cliente: {opportunity_dict['customer_nome']} | Vendedor: {opportunity_dict['vendedor_nome']} | Tipo: {tipo_venda} | Forma Compra: {forma_compra}", sub_style))

            kpi_data = [
                ["Venda Consolidada", "Custo de Aquisição", "Custo Impostos", "Imp. Venda", "Despesas Venda", "Lucro Total", "Margem"],
                [f"R$ {kpis['venda_consolidada']}", f"R$ {kpis['custo_total_com_impostos']}", f"R$ {kpis['custo_impostos']}", f"R$ {kpis['impostos_venda']}", f"R$ {kpis['despesas_totais']}", f"R$ {kpis['lucro_total']}", f"{kpis['margem_percentual']}%"]
            ]
            kpi_table = Table(kpi_data, colWidths=[100]*7)
            kpi_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e293b')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('FONTSIZE', (0,0), (-1,-1), 8.5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0')),
            ]))
            story.append(kpi_table)
            story.append(Spacer(1, 15))

            story.append(Paragraph("Detalhamento Comercial dos Produtos/Serviços", styles['Heading2']))
            table_data = [[
                Paragraph("Produto", table_header_style), 
                Paragraph("Fornecedor", table_header_style), 
                Paragraph("Qtd", table_header_style), 
                Paragraph("Custo Unit", table_header_style), 
                Paragraph("Custo Total", table_header_style), 
                Paragraph("Imp Compra", table_header_style), 
                Paragraph("MKP", table_header_style), 
                Paragraph("Val Venda", table_header_style), 
                Paragraph("Venda Total", table_header_style), 
                Paragraph("Imp Venda", table_header_style), 
                Paragraph("Despesas adm", table_header_style),
                Paragraph("Lucro", table_header_style)
            ]]
            for item in items_details:
                # Main row
                table_data.append([
                    Paragraph(item["descricao"], table_cell_style),
                    Paragraph(item["fornecedor"], table_cell_style),
                    Paragraph(str(item["quantidade"]), table_cell_style),
                    Paragraph(f"R$ {item['custo_unitario']}", table_cell_style),
                    Paragraph(f"R$ {item['custo_total']}", table_cell_style),
                    Paragraph(f"R$ {item['imposto_compra_unit']}", table_cell_style),
                    Paragraph(item["markup"] + ("x" if not item["markup"].endswith("x") else ""), table_cell_style),
                    Paragraph(f"R$ {item['valor_venda']}", table_cell_style),
                    Paragraph(f"R$ {item['venda_total']}", table_cell_style),
                    Paragraph(f"R$ {item['impostos_venda']}", table_cell_style),
                    Paragraph(f"R$ {item['despesas_adm']}", table_cell_style),
                    Paragraph(f"R$ {item['lucro_total']}", table_cell_style)
                ])
                # Component rows if present
                if "components" in item and item["components"]:
                    for comp in item["components"]:
                        table_data.append([
                            Paragraph(f"   ↳ {comp['descricao']}", table_cell_style),
                            Paragraph(comp["fornecedor"], table_cell_style),
                            Paragraph(str(comp["quantidade"]), table_cell_style),
                            Paragraph(f"R$ {comp['custo_unitario']}", table_cell_style),
                            Paragraph(f"R$ {comp['custo_total']}", table_cell_style),
                            Paragraph(f"R$ {comp['imposto_compra_unit']}", table_cell_style),
                            Paragraph(comp["markup"] + ("x" if not comp["markup"].endswith("x") else ""), table_cell_style),
                            Paragraph(f"R$ {comp['valor_venda']}", table_cell_style),
                            Paragraph(f"R$ {comp['venda_total']}", table_cell_style),
                            Paragraph(f"R$ {comp['impostos_venda']}", table_cell_style),
                            Paragraph(f"R$ {comp['despesas_adm']}", table_cell_style),
                            Paragraph(f"R$ {comp['lucro_total']}", table_cell_style)
                        ])

            table_data.append([
                Paragraph("TOTAL CONSOLIDADO", table_cell_style),
                Paragraph("-", table_cell_style),
                Paragraph("-", table_cell_style),
                Paragraph("-", table_cell_style),
                Paragraph(f"R$ {kpis['custo_consolidado']}", table_cell_style),
                Paragraph(f"R$ {kpis['custo_impostos']}", table_cell_style),
                Paragraph(f"{kpis['markup']}x", table_cell_style),
                Paragraph("-", table_cell_style),
                Paragraph(f"R$ {kpis['venda_consolidada']}", table_cell_style),
                Paragraph(f"R$ {kpis['impostos_venda']}", table_cell_style),
                Paragraph(f"R$ {kpis['despesas_totais']}", table_cell_style),
                Paragraph(f"R$ {kpis['lucro_total']}", table_cell_style)
            ])

            items_table = Table(table_data, colWidths=[120, 85, 25, 50, 50, 50, 30, 50, 50, 50, 50, 60])
            items_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#334155')),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
            ]))
            story.append(items_table)
            story.append(Spacer(1, 15))

            story.append(Paragraph("Tributação das Vendas (Impostos de Venda)", styles['Heading3']))
            sales_tax_data = [[
                Paragraph("Imposto", table_header_style),
                Paragraph("%", table_header_style),
                Paragraph("Valor Total", table_header_style)
            ]]
            for t in sales_taxes_summary:
                is_neg = t["total"].startswith("-")
                tax_style = ParagraphStyle(
                    'TaxStyle',
                    parent=table_cell_style,
                    textColor=colors.HexColor('#16a34a') if is_neg else colors.HexColor('#1e293b')
                )
                sales_tax_data.append([
                    Paragraph(t["name"], tax_style),
                    Paragraph(t["percent"], table_cell_style),
                    Paragraph(f"R$ {t['total']}" if (not t['total'].startswith("R$") and not t['total'].startswith("-R$")) else t['total'].replace("-R$ ", "-R$"), tax_style)
                ])
            sales_tax_data.append([
                Paragraph("TOTAL IMPOSTOS VENDA", table_cell_style),
                Paragraph(sales_taxes_totals['percent'], table_cell_style),
                Paragraph(f"R$ {sales_taxes_totals['total']}" if not sales_taxes_totals['total'].startswith("R$") else sales_taxes_totals['total'], table_cell_style)
            ])
            sales_tax_table = Table(sales_tax_data, colWidths=[200, 100, 200])
            sales_tax_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#475569')),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
            ]))
            story.append(sales_tax_table)
            story.append(Spacer(1, 10))

            story.append(Paragraph("Tributação das Aquisições (Impostos de Compra)", styles['Heading3']))
            purchase_tax_data = [[
                Paragraph("Imposto", table_header_style),
                Paragraph("Valor Total", table_header_style)
            ]]
            for t in purchase_taxes_summary:
                purchase_tax_data.append([
                    Paragraph(t["name"], table_cell_style),
                    Paragraph(f"R$ {t['total']}" if not t['total'].startswith("R$") else t['total'], table_cell_style)
                ])
            purchase_tax_data.append([
                Paragraph("TOTAL IMPOSTOS COMPRA", table_cell_style),
                Paragraph(f"R$ {purchase_taxes_totals['total']}" if not purchase_taxes_totals['total'].startswith("R$") else purchase_taxes_totals['total'], table_cell_style)
            ])
            purchase_tax_table = Table(purchase_tax_data, colWidths=[250, 250])
            purchase_tax_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#475569')),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
            ]))
            story.append(purchase_tax_table)
            story.append(Spacer(1, 10))

            story.append(Paragraph("Detalhamento de Despesas, Frete e Comissão", styles['Heading3']))
            expenses_data_table = [[
                Paragraph("Despesa", table_header_style),
                Paragraph("% do Faturamento", table_header_style),
                Paragraph("Valor Total", table_header_style)
            ]]
            for e in expenses_summary:
                expenses_data_table.append([
                    Paragraph(e["name"], table_cell_style),
                    Paragraph(e["percent"], table_cell_style),
                    Paragraph(f"R$ {e['total']}" if not e['total'].startswith("R$") else e['total'], table_cell_style)
                ])
            expenses_data_table.append([
                Paragraph("TOTAL DESPESAS", table_cell_style),
                Paragraph(expenses_totals['percent'], table_cell_style),
                Paragraph(f"R$ {expenses_totals['total']}" if not expenses_totals['total'].startswith("R$") else expenses_totals['total'], table_cell_style)
            ])
            expenses_table = Table(expenses_data_table, colWidths=[200, 150, 150])
            expenses_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#475569')),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
            ]))
            story.append(expenses_table)
            story.append(Spacer(1, 15))

            story.append(Paragraph("Resumo Financeiro por Fornecedor (Custos de Aquisição)", styles['Heading2']))
            sup_data = [[
                Paragraph("Orçamento", table_header_style),
                Paragraph("Fornecedor", table_header_style),
                Paragraph("Valor Sem Imposto", table_header_style),
                Paragraph("Total de Imposto IPI", table_header_style),
                Paragraph("Total com Impostos", table_header_style),
                Paragraph("Forma de Pagamento", table_header_style)
            ]]
            for f in supplier_summaries:
                sup_data.append([
                    Paragraph(f["orcamento"], table_cell_style),
                    Paragraph(f["fornecedor"], table_cell_style),
                    Paragraph(f"R$ {f['total_sem_imposto']}" if not f['total_sem_imposto'].startswith("R$") else f['total_sem_imposto'], table_cell_style),
                    Paragraph(f"R$ {f['total_imposto']}" if not f['total_imposto'].startswith("R$") else f['total_imposto'], table_cell_style),
                    Paragraph(f"R$ {f['total_custo']}" if not f['total_custo'].startswith("R$") else f['total_custo'], table_cell_style),
                    Paragraph(f["forma_pagamento"], table_cell_style)
                ])
            sup_data.append([
                Paragraph("TOTAL DE CUSTOS", table_cell_style),
                Paragraph("-", table_cell_style),
                Paragraph(f"R$ {supplier_totals['total_sem_imposto']}" if not supplier_totals['total_sem_imposto'].startswith("R$") else supplier_totals['total_sem_imposto'], table_cell_style),
                Paragraph(f"R$ {supplier_totals['total_imposto']}" if not supplier_totals['total_imposto'].startswith("R$") else supplier_totals['total_imposto'], table_cell_style),
                Paragraph(f"R$ {supplier_totals['total_custo']}" if not supplier_totals['total_custo'].startswith("R$") else supplier_totals['total_custo'], table_cell_style),
                Paragraph("-", table_cell_style)
            ])
            sup_table = Table(sup_data, colWidths=[90, 140, 110, 100, 110, 130])
            sup_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#475569')),
                ('BOTTOMPADDING', (0,0), (-1,-1), 3),
                ('TOPPADDING', (0,0), (-1,-1), 3),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
                ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
            ]))
            story.append(sup_table)

            doc.build(story)
            pdf_buffer.seek(0)
            return StreamingResponse(
                pdf_buffer,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=approval-venda-{opportunity_dict['numero_orcamento']}.pdf"
                }
            )

    @staticmethod
    def generate_svg_cashflow_chart(
        investimento: float,
        faturamento_mensal: float,
        impostos_mensal: float,
        custo_op_mensal: float,
        comissao_mensal: float,
        prazo_contrato: int,
        prazo_instalacao: int,
        total_instalacao: float,
        impostos_instalacao: float,
        custo_op_instalacao: float,
        comissao_instalacao: float,
        despesas_adm_mensal: float = 0.0,
        despesas_adm_instalacao: float = 0.0
    ) -> str:
        """Generate a raw vector SVG stacked bar and line chart for rendering in WeasyPrint."""
        chart_data = []
        saldo_acumulado = -investimento
        saldo_investimento = investimento
        payback_mes = None
        lucro_acumulado_geral = 0.0

        pCtr = prazo_contrato
        pInst = prazo_instalacao
        
        for m in range(1, pCtr + 1):
            if m <= pInst:
                fat_mes = total_instalacao / (pInst if pInst > 0 else 1)
                imp_mes = 0.0
                op_mes = custo_op_instalacao / (pInst if pInst > 0 else 1) if total_instalacao > 0 else 0.0
                com_mes = comissao_instalacao / (pInst if pInst > 0 else 1) if total_instalacao > 0 else 0.0
                desp_adm_mes = despesas_adm_instalacao / (pInst if pInst > 0 else 1) if total_instalacao > 0 else 0.0
            else:
                fat_mes = faturamento_mensal
                imp_mes = impostos_mensal
                op_mes = custo_op_mensal
                com_mes = comissao_mensal
                desp_adm_mes = despesas_adm_mensal
                
            gastos_mes = imp_mes + op_mes + com_mes + desp_adm_mes
            receita_livre = fat_mes - gastos_mes
            
            saldo_acumulado += receita_livre
            
            quitar_mes = 0.0
            if saldo_investimento > 0.0 and receita_livre > 0.0:
                quitar_mes = min(receita_livre, saldo_investimento)
                saldo_investimento -= quitar_mes
                
            lucro_livre_mes = max(0.0, receita_livre - quitar_mes)
            lucro_acumulado_geral += lucro_livre_mes
            
            if saldo_acumulado >= 0.0 and payback_mes is None:
                prev_saldo = saldo_acumulado - receita_livre
                if receita_livre > 0:
                    fraction = -prev_saldo / receita_livre
                    payback_mes = (m - 1) + float(fraction)
                else:
                    payback_mes = float(m)
                
            chart_data.append({
                "mes": m,
                "mes_label": f"M{m}",
                "GastosOperacionais": gastos_mes,
                "QuitarInvestimento": quitar_mes,
                "LucroLivre": lucro_livre_mes,
                "Faturamento": fat_mes,
                "SaldoAcumulado": saldo_acumulado
            })

        # Override payback_mes with the simple division formula requested by user
        retorno_mensal = faturamento_mensal - impostos_mensal - custo_op_mensal - comissao_mensal - despesas_adm_mensal
        saldo_capex = investimento - total_instalacao
        if retorno_mensal > 0.0:
            payback_mes = saldo_capex / retorno_mensal
        else:
            payback_mes = None

        # Chart configuration
        width, height = 750, 225
        pad_l, pad_r, pad_t, pad_b = 55, 20, 25, 50
        plot_w = width - pad_l - pad_r
        plot_h = height - pad_t - pad_b

        # Y scale ranges from 0.0 to max monthly faturamento
        ymin = 0.0
        ymax = max(100.0, max(row["Faturamento"] for row in chart_data))
        ymax *= 1.15  # Add top padding for visual comfort
        
        def get_y(val):
            return pad_t + plot_h - (val / ymax) * plot_h
        
        def get_x(m):
            return pad_l + ((m - 0.5) / pCtr) * plot_w

        # Draw grid lines and Y-axis labels
        grid_lines = [0.0]
        # Determine a nice step dynamically to avoid overlapping labels
        rough_step = ymax / 5
        if rough_step >= 100000:
            step = round(rough_step / 50000) * 50000
        elif rough_step >= 50000:
            step = round(rough_step / 10000) * 10000
        elif rough_step >= 10000:
            step = round(rough_step / 5000) * 5000
        elif rough_step >= 5000:
            step = round(rough_step / 1000) * 1000
        elif rough_step >= 1000:
            step = round(rough_step / 200) * 200
        else:
            step = round(rough_step / 50) * 50
        step = max(50.0, step)
            
        val = step
        while val <= ymax:
            grid_lines.append(val)
            val += step

        grid_lines = sorted(list(set(grid_lines)))

        svg_content = f"""<svg width="{width}" height="{height}" viewBox="0 0 {width} {height}" xmlns="http://www.w3.org/2000/svg">
            <!-- Grid lines -->
        """
        for g_val in grid_lines:
            gy = get_y(g_val)
            # Draw grid lines, but omit the text labels (descrição) since they overlap/become illegible
            svg_content += f"""
            <line x1="{pad_l}" y1="{gy}" x2="{width - pad_r}" y2="{gy}" stroke="#e2e8f0" stroke-width="0.8" stroke-dasharray="2 2" />
            """

        # Draw line for Payback
        if payback_mes is not None and payback_mes <= pCtr:
            px = get_x(payback_mes)
            bar_w_half = (plot_w / pCtr) / 2
            x1 = px - bar_w_half
            x2 = px + bar_w_half
            svg_content += f"""
            <!-- Payback Shaded Area -->
            <rect x="{x1}" y="{pad_t}" width="{x2 - x1}" height="{plot_h}" fill="#f0fdf4" opacity="0.7" />
            <line x1="{px}" y1="{pad_t - 5}" x2="{px}" y2="{pad_t + plot_h}" stroke="#22c55e" stroke-dasharray="3 3" stroke-width="1.2" />
            <text x="{px}" y="{pad_t - 9}" font-family="sans-serif" font-size="7.5pt" font-weight="bold" fill="#22c55e" text-anchor="middle">Payback ({payback_mes:.1f}m)</text>
            """

        # Draw stacked bars starting from 0.0 line
        bar_width = min(20.0, (plot_w / pCtr) * 0.7)
        y_zero = get_y(0.0)
        
        for row in chart_data:
            m = row["mes"]
            cx = get_x(m)
            x_left = cx - bar_width / 2
            
            go = row["GastosOperacionais"]
            qi = row["QuitarInvestimento"]
            ll = row["LucroLivre"]
            
            # Gastos Operacionais
            h_go = (go / ymax) * plot_h
            y_go = y_zero - h_go
            if h_go > 0.1:
                svg_content += f'<rect x="{x_left}" y="{y_go}" width="{bar_width}" height="{h_go}" fill="#94a3b8" rx="1" />\n'
            else:
                y_go = y_zero
                
            # Quitar Investimento
            h_qi = (qi / ymax) * plot_h
            y_qi = y_go - h_qi
            if h_qi > 0.1:
                svg_content += f'<rect x="{x_left}" y="{y_qi}" width="{bar_width}" height="{h_qi}" fill="#f97316" rx="1" />\n'
            else:
                y_qi = y_go
                
            # Lucro Livre
            h_ll = (ll / ymax) * plot_h
            y_ll = y_qi - h_ll
            if h_ll > 0.1:
                svg_content += f'<rect x="{x_left}" y="{y_ll}" width="{bar_width}" height="{h_ll}" fill="#22c55e" rx="1" />\n'

        # Draw Faturamento line (dashed blue step line)
        poly_points = []
        for i, row in enumerate(chart_data):
            m = row["mes"]
            cx = get_x(m)
            fat = row["Faturamento"]
            y_fat = get_y(fat)
            
            bar_w_half = (plot_w / pCtr) / 2
            x_start = cx - bar_w_half
            x_end = cx + bar_w_half
            
            poly_points.append(f"{x_start:.1f},{y_fat:.1f}")
            poly_points.append(f"{x_end:.1f},{y_fat:.1f}")
            
        points_str = " ".join(poly_points)
        svg_content += f"""
        <!-- Faturamento Step Line -->
        <polyline fill="none" stroke="#3b82f6" stroke-width="1.8" stroke-dasharray="3 3" points="{points_str}" />
        """

        # Draw X-axis labels
        for row in chart_data:
            m = row["mes"]
            cx = get_x(m)
            svg_content += f"""
            <text x="{cx}" y="{height - pad_b + 14}" font-family="sans-serif" font-size="7pt" fill="#64748b" text-anchor="middle">M{m}</text>
            """

        # Draw axis base lines
        svg_content += f"""
        <line x1="{pad_l}" y1="{pad_t + plot_h}" x2="{width - pad_r}" y2="{pad_t + plot_h}" stroke="#cbd5e1" stroke-width="1" />
        <line x1="{pad_l}" y1="{pad_t}" x2="{pad_l}" y2="{pad_t + plot_h}" stroke="#cbd5e1" stroke-width="1" />
        """

        # Draw Legend
        svg_content += f"""
        <!-- Legend -->
        <g transform="translate(130, 205)">
            <rect x="0" y="0" width="8" height="8" fill="#94a3b8" rx="1" />
            <text x="13" y="7" font-family="sans-serif" font-size="7pt" fill="#475569">Gastos Operacionais</text>
            
            <rect x="140" y="0" width="8" height="8" fill="#f97316" rx="1" />
            <text x="153" y="7" font-family="sans-serif" font-size="7pt" fill="#475569">Quitar Investimento</text>
            
            <rect x="285" y="0" width="8" height="8" fill="#22c55e" rx="1" />
            <text x="298" y="7" font-family="sans-serif" font-size="7pt" fill="#475569">Lucro Livre</text>
            
            <line x1="390" y1="4" x2="405" y2="4" stroke="#3b82f6" stroke-dasharray="3 3" stroke-width="1.8" />
            <text x="410" y="7" font-family="sans-serif" font-size="7pt" fill="#475569">Faturamento</text>
        </g>
        """

        svg_content += "\n</svg>"
        return svg_content

    @staticmethod
    def generate_locacao_approval_pdf(db: Session, opportunity_id: UUID, current_user: User) -> StreamingResponse:
        # Import models inside the function to prevent import issues
        from src.modules.products.models import Product
        from src.modules.own_services.models import OwnService

        # 1. Fetch Opportunity
        opportunity = db.query(SalesBudget).filter(
            SalesBudget.id == opportunity_id,
            SalesBudget.tenant_id == current_user.tenant_id
        ).first()
        if not opportunity:
            raise HTTPException(status_code=404, detail="Oportunidade não encontrada")

        if not opportunity.rental_items:
            raise HTTPException(status_code=400, detail="Esta oportunidade não possui itens de locação/comodato para gerar o relatório.")

        # 2. Fetch associated Purchase Budgets (Supplier Budgets)
        purchase_budgets = db.query(PurchaseBudget).filter(
            PurchaseBudget.sales_budget_id == opportunity_id,
            PurchaseBudget.tenant_id == current_user.tenant_id
        ).all()

        # Build tax lookup map: product_id -> {difal, st, source}
        opp_product_taxes = {}
        for item in opportunity.rental_items:
            if not item.opportunity_kit_id and item.product_id:
                difal = float(item.difal_unit) if item.difal_unit is not None else 0.0
                st = float(item.icms_st_unit) if item.icms_st_unit is not None else 0.0
                opp_product_taxes[item.product_id] = {
                    "difal": difal,
                    "st": st,
                    "source": "opportunity_item"
                }

        # Kit items
        kit_service = OpportunityKitService(db)
        kit_ids = set()
        for item in opportunity.rental_items:
            if item.opportunity_kit_id:
                kit_ids.add(item.opportunity_kit_id)
                
        kits_by_id = {}
        kits_financials = {}
        for kit_id in kit_ids:
            kit = db.query(OpportunityKit).filter(OpportunityKit.id == kit_id).first()
            if kit:
                kits_by_id[kit.id] = kit
                try:
                    rental_item = next((item for item in opportunity.rental_items if item.opportunity_kit_id == kit_id), None)
                    override_factor = rental_item.fator_margem if rental_item else None
                    kit_financials = kit_service.calculate_financials(kit, opportunity.tenant_id, override_factor=override_factor, sales_budget_id=str(opportunity.id))
                    kits_financials[kit.id] = kit_financials
                    for item_sum in kit_financials.get("item_summaries", []):
                        p_id = item_sum.get("product_id")
                        if p_id:
                            p_uuid = UUID(p_id) if isinstance(p_id, str) else p_id
                            difal_val = float(item_sum.get("difal_unitario") or 0.0)
                            st_val = float(item_sum.get("icms_st_unitario") or 0.0)
                            opp_product_taxes[p_uuid] = {
                                "difal": difal_val,
                                "st": st_val,
                                "source": "opportunity_kit"
                            }
                except Exception as e:
                    print(f"[Warning] Failed to calculate financials for kit {kit_id}: {e}")

        # Unpack helper for supplier matching
        def get_unpacked_qty(prod_id):
            qty = 0.0
            for item in opportunity.rental_items:
                if item.product_id == prod_id and not item.opportunity_kit_id:
                    qty += float(item.quantidade)
                elif item.opportunity_kit_id:
                    kit = kits_by_id.get(item.opportunity_kit_id)
                    if kit:
                        for kit_item in kit.items:
                            if kit_item.product_id == prod_id:
                                qty += float(item.quantidade) * float(kit_item.quantidade_no_kit)
            return qty

        # Helper to retrieve purchase tax unit breakdown for a product
        def get_purchase_tax_breakdown(prod_id, pb_item):
            tax_info = opp_product_taxes.get(prod_id)
            origem = None
            difal = 0.0
            st = 0.0
            ipi = 0.0
            
            if tax_info:
                difal = tax_info["difal"]
                st = tax_info["st"]
                origem = tax_info["source"]
            
            if difal == 0.0 and pb_item and pb_item.difal_unitario is not None and float(pb_item.difal_unitario) > 0.0:
                difal = float(pb_item.difal_unitario)
                origem = "purchase_budget"
            if st == 0.0 and pb_item and pb_item.st_unitario is not None and float(pb_item.st_unitario) > 0.0:
                st = float(pb_item.st_unitario)
                origem = "purchase_budget"
                
            if pb_item and pb_item.ipi_valor is not None and float(pb_item.ipi_valor) > 0.0:
                pb_qty = float(pb_item.quantidade) if float(pb_item.quantidade) > 0 else 1.0
                ipi = float(pb_item.ipi_valor) / pb_qty
            
            if origem is None:
                origem = "fallback_zero"
                
            return difal, st, ipi, origem

        product_suppliers = {}
        for pb in purchase_budgets:
            for pb_item in pb.items:
                if pb_item.product_id:
                    product_suppliers[pb_item.product_id] = {
                        "fornecedor": pb.supplier_nome_fantasia,
                        "pb_item": pb_item,
                        "pb": pb
                    }

        # Consolidate items details
        items_details = []
        total_aquisicao_sem_comissao = 0.0
        total_st_difal = 0.0
        locacao_mensal = 0.0
        custo_op_mensal_total = 0.0
        impostos_mensal_total = 0.0
        comissao_total_aquisicao = 0.0
        impostos_instalacao_total = 0.0
        total_instalacao = 0.0
        investimento_instalacao = 0.0
        custo_op_instalacao_total = 0.0
        investimento_rental = 0.0
        desp_adm_instalacao_total = 0.0
        frete_instalacao_total = 0.0
        desp_adm_mensal_total = 0.0

        # Detailed item metrics for totals row
        total_aquisicao_calc = 0.0
        total_comissao_calc = 0.0
        total_instalacao_calc = 0.0
        total_locacao_mensal_calc = 0.0
        total_manutencao_mes_calc = 0.0
        total_monitoramento_calc = 0.0
        total_fat_mensal_calc = 0.0
        total_fat_mensal_total_calc = 0.0
        total_vlr_total_calc = 0.0
        total_impostos_mensal_calc = 0.0
        
        total_comissao_liquida = 0.0
        total_comissao_dsr = 0.0
        total_comissao_fgts = 0.0
        total_comissao_inss = 0.0
        total_comissao_demais = 0.0
        total_despesa_operacional = 0.0

        prazo_contrato = opportunity.prazo_contrato_meses or 36
        prazo_instalacao = opportunity.prazo_instalacao_meses or 0
        prazo_fat = max(1, prazo_contrato - prazo_instalacao)

        # Pre-accumulate totals using aligned frontend logic
        faturamento_total_rental = 0.0
        impostos_totais = 0.0
        custo_op_total = 0.0

        for item in opportunity.rental_items:
            qty = float(item.quantidade)
            pb_info = product_suppliers.get(item.product_id) if item.product_id else None
            pb_item = pb_info["pb_item"] if pb_info else None
            
            # Recalculate kit metrics dynamically using kits_financials if available to align with frontend
            kit_financials_summary = None
            if item.opportunity_kit_id:
                kf = kits_financials.get(item.opportunity_kit_id)
                if kf and "summary" in kf:
                    kit_financials_summary = kf["summary"]

            if kit_financials_summary:
                s = kit_financials_summary
                custo_total = float(s.get("custo_aquisicao_total") or 0.0) * qty
                comissao_val = (
                    float(s.get("valor_comissao_locacao") or 0.0) +
                    float(s.get("vlt_comissao_dsr_loc") or 0.0) +
                    float(s.get("vlt_comissao_fgts_loc") or 0.0) +
                    float(s.get("vlt_comissao_inss_loc") or 0.0) +
                    float(s.get("vlt_comissao_demais_loc") or 0.0)
                )
                instalacao_val = float(s.get("valor_venda_instalacao") or s.get("vlr_instal_calc") or 0.0)

                manut_val = float(s.get("vlt_manut") or 0.0)
                monitoramento_val = float(s.get("venda_unit_monitoramento") or 0.0)
                fat_mensal_val = float(s.get("valor_mensal_antes_impostos") or s.get("valor_mensal_kit") or 0.0)
                impostos_mensal_val = float(item.impostos_mensal or 0.0)
                custo_op_mensal_val = float(s.get("custo_operacional_mensal_kit") or 0.0) + float(s.get("custo_mensal_bloco_7") or 0.0)
                
                comissao_item = comissao_val * qty
                instalacao_item = instalacao_val * qty
                manut_mes_item = manut_val * qty
                monitoramento_item = monitoramento_val * qty
                fat_mensal_total_item = fat_mensal_val * qty
                impostos_mensal_item = impostos_mensal_val * qty
                custo_op_mensal = custo_op_mensal_val * qty
                
                total_comissao_liquida += float(s.get("valor_comissao_locacao") or 0.0) * qty
                total_comissao_dsr += float(s.get("vlt_comissao_dsr_loc") or 0.0) * qty
                total_comissao_fgts += float(s.get("vlt_comissao_fgts_loc") or 0.0) * qty
                total_comissao_inss += float(s.get("vlt_comissao_inss_loc") or 0.0) * qty
                total_comissao_demais += float(s.get("vlt_comissao_demais_loc") or 0.0) * qty
                total_despesa_operacional += float(s.get("valor_despesa_operacional_loc") or 0.0) * qty
                
                purchase_tax_unit = float(s.get("total_difal_kit") or 0.0) + float(s.get("total_st_kit") or 0.0) + float(s.get("total_ipi_kit") or 0.0)
            else:
                custo_total = (float(item.kit_investimento_total or 0.0) * qty) or (float(item.custo_total_aquisicao or 0.0) * qty)
                base_com = float(item.comissao_mensal or 0.0) or float(item.kit_comissao or 0.0)
                comissao_val = (
                    base_com +
                    float(item.dsr_mensal or 0.0) +
                    float(item.fgts_mensal or 0.0) +
                    float(item.inss_mensal or 0.0) +
                    float(item.demais_incidencias_mensal or 0.0)
                )
                comissao_item = comissao_val * qty
                instalacao_item = float(item.kit_vlr_instal_calc or item.valor_instalacao_item or 0.0) * qty
                manut_mes_item = float(item.kit_vlt_manut or item.manutencao_locacao or 0.0) * qty
                monitoramento_item = float(item.kit_venda_unit_monitoramento or 0.0) * qty
                fat_mensal_total_item = float(item.valor_mensal or getattr(item, "kit_valor_mensal", 0.0) or 0.0) * qty
                impostos_mensal_item = float(item.impostos_mensal or 0.0) * qty
                
                total_comissao_liquida += base_com * qty
                total_comissao_dsr += float(item.dsr_mensal or 0.0) * qty
                total_comissao_fgts += float(item.fgts_mensal or 0.0) * qty
                total_comissao_inss += float(item.inss_mensal or 0.0) * qty
                total_comissao_demais += float(item.demais_incidencias_mensal or 0.0) * qty
                total_despesa_operacional += float(item.despesa_operacional_mensal or 0.0) * qty
                
                difal_unit, st_unit, ipi_unit, origem_imposto = get_purchase_tax_breakdown(item.product_id, pb_item)
                purchase_tax_unit = difal_unit + st_unit + ipi_unit
                
                custo_monitoramento = 0.0
                if item.opportunity_kit_id:
                    kit = kits_by_id.get(item.opportunity_kit_id)
                    if kit:
                        custo_monitoramento = float(kit.custo_monitoramento_unitario or 0.0)
 
                if item.opportunity_kit_id:
                    custo_op_mensal = (float(item.custo_op_mensal_kit or 0.0) + custo_monitoramento) * qty
                else:
                    custo_op_mensal = float(item.custo_manut_mensal or 0.0) * qty

            total_aquisicao_calc += custo_total
            total_st_difal += purchase_tax_unit * qty
            total_comissao_calc += comissao_item
            comissao_total_aquisicao += comissao_item
            
            fat_mensal_unit = fat_mensal_total_item / qty if qty > 0 else 0.0
            loc_mensal_item = fat_mensal_total_item - manut_mes_item - monitoramento_item
            prazo_item_raw = int(item.prazo_contrato or prazo_contrato)
            prazo_item = max(0, prazo_item_raw - prazo_instalacao)
            
            vlr_total_item = fat_mensal_total_item * prazo_item_raw

            # Adjustment for kit installation - column redirection and sum fixing
            if item.is_kit_instalacao:
                instalacao_item = fat_mensal_total_item
                loc_mensal_item = 0.0
                fat_mensal_total_item = 0.0
                fat_mensal_unit = 0.0
                vlr_total_item = instalacao_item

            # Now accumulate totals row
            total_instalacao_calc += instalacao_item
            total_manutencao_mes_calc += manut_mes_item
            total_monitoramento_calc += monitoramento_item
            total_fat_mensal_calc += fat_mensal_unit
            total_fat_mensal_total_calc += fat_mensal_total_item
            total_locacao_mensal_calc += loc_mensal_item
            total_vlr_total_calc += vlr_total_item
            total_impostos_mensal_calc += impostos_mensal_item

            # Installation vs Rental separation for Capex/Totals
            if item.opportunity_kit_id and getattr(item, "kit_perc_despesas_adm", None) is not None:
                perc_desp_adm = float(item.kit_perc_despesas_adm) / 100.0
            else:
                perc_desp_adm = float(opportunity.perc_despesa_adm or 0.0) / 100.0

            kit_desp_adm_val = None
            if item.opportunity_kit_id:
                if getattr(item, "kit_despesas_adm", None) is not None:
                    kit_desp_adm_val = float(item.kit_despesas_adm)
                elif kit_financials_summary:
                    kit_desp_adm_val = float(kit_financials_summary.get("valor_despesas_adm_locacao") or 0.0)

            vlr_inst_cost = 0.0
            imposto_inst_item = 0.0
            if item.opportunity_kit_id:
                if kit_financials_summary:
                    vlr_inst_cost = float(kit_financials_summary.get("vlr_instal_calc") or 0.0) * qty
                    imposto_inst_item = float(kit_financials_summary.get("imposto_instalacao") or 0.0) * qty
            else:
                vlr_inst_cost = float(item.valor_instalacao_item or 0.0) * qty
                if vlr_inst_cost > 0:
                    rate_total = float(opportunity.perc_pis_rental or 0.0) + \
                                 float(opportunity.perc_cofins_rental or 0.0) + \
                                 float(opportunity.perc_csll_rental or 0.0) + \
                                 float(opportunity.perc_irpj_rental or 0.0) + \
                                 float(opportunity.perc_iss_rental or 0.0)
                    imposto_inst_item = vlr_inst_cost * (rate_total / 100.0)

            if item.is_kit_instalacao:
                total_instalacao += instalacao_item
                impostos_instalacao_total += impostos_mensal_item
                custo_op_instalacao_total += custo_op_mensal
                investimento_instalacao += custo_total
                
                frete_val = float(kit_financials_summary.get("vlt_frete_venda") or 0.0) if kit_financials_summary else float(getattr(item, "frete_venda_unit", None) or 0.0)
                frete_total = frete_val * qty
                frete_instalacao_total += frete_total
                
                if kit_desp_adm_val is not None:
                    desp_adm_inst = kit_desp_adm_val * qty
                else:
                    desp_adm_inst = instalacao_item * perc_desp_adm
                desp_adm_instalacao_total += desp_adm_inst
                
                faturamento_total_rental += instalacao_item
                impostos_totais += impostos_mensal_item
                custo_op_total += custo_op_mensal
            else:
                locacao_mensal += fat_mensal_total_item
                impostos_mensal_total += impostos_mensal_item
                custo_op_mensal_total += custo_op_mensal
                investimento_rental += custo_total
                
                total_instalacao += instalacao_item
                impostos_instalacao_total += imposto_inst_item
                investimento_instalacao += vlr_inst_cost
                
                if kit_desp_adm_val is not None:
                    desp_adm_mensal = kit_desp_adm_val * qty
                else:
                    desp_adm_mensal = fat_mensal_total_item * perc_desp_adm
                desp_adm_mensal_total += desp_adm_mensal
                
                faturamento_total_rental += (fat_mensal_total_item * prazo_item) + instalacao_item
                impostos_totais += impostos_mensal_item * prazo_item
                custo_op_total += custo_op_mensal * prazo_item
                
            # Unpack components if this is a kit
            components_list = []
            if item.opportunity_kit_id:
                kf = kits_financials.get(item.opportunity_kit_id)
                if kf:
                    kit_total_cost = float(item.kit_investimento_total or item.custo_total_aquisicao or 1.0)
                    # Loop over kit products/services in items
                    for c in kf.get("item_summaries", []):
                        c_qty = float(c.get("quantidade_no_kit") or 1.0) * qty
                        c_cost_total = float(c.get("custo_total_item_no_kit") or 0.0) * qty
                        ratio = (c_cost_total / (kit_total_cost * qty)) if kit_total_cost > 0 else 0.0
                        
                        p_name = c.get("descricao_item") or "Componente do Kit"
                        p_code = None
                        if c.get("product_id"):
                            p_uuid = UUID(c["product_id"]) if isinstance(c["product_id"], str) else c["product_id"]
                            p_obj = db.query(Product).filter(Product.id == p_uuid).first()
                            if p_obj:
                                p_name = p_obj.nome
                                p_code = p_obj.codigo
                            
                            c_pb_info = product_suppliers.get(p_uuid) if p_uuid else None
                            if c_pb_info and c_pb_info.get("pb") and c_pb_info["pb"].dolar_orcamento:
                                pb = c_pb_info["pb"]
                                pb_item = c_pb_info["pb_item"]
                                if pb.valor_conversao and pb_item.valor_unitario_dolar is not None:
                                    p_name = f"{p_name} (U$ {format_usd(pb_item.valor_unitario_dolar)} * Cot. R$ {format_rate(pb.valor_conversao)})"
                        elif c.get("own_service_id"):
                            p_uuid = UUID(c["own_service_id"]) if isinstance(c["own_service_id"], str) else c["own_service_id"]
                            os_obj = db.query(OwnService).filter(OwnService.id == p_uuid).first()
                            if os_obj:
                                p_name = os_obj.nome_servico or os_obj.descricao or p_name
                                p_code = None
                                
                        components_list.append({
                            "descricao": p_name,
                            "part_number": p_code,
                            "quantidade": int(c_qty) if c_qty.is_integer() else c_qty,
                            "custo_aquisicao": format_currency(c_cost_total),
                            "comissao": format_currency(comissao_item * ratio),
                            "instalacao": format_currency(instalacao_item * ratio),
                            "locacao_mensal": format_currency(loc_mensal_item * ratio),
                            "manutencao_mes": format_currency(manut_mes_item * ratio),
                            "monitoramento": format_currency(monitoramento_item * ratio),
                            "fat_mensal": format_currency((fat_mensal_total_item * ratio) / c_qty if c_qty > 0 else 0.0),
                            "fat_mensal_total": format_currency(fat_mensal_total_item * ratio),
                            "prazo": prazo_item_raw,
                            "vlr_total": format_currency(vlr_total_item * ratio),
                            "impostos_mensal": format_currency(impostos_mensal_item * ratio)
                        })
                    
                    # Loop over kit costs (own services)
                    for c in kf.get("cost_summaries", []):
                        if c.get("own_service_id") is not None:
                            c_qty = float(c.get("quantidade") or 1.0) * qty
                            c_cost_total = float(c.get("custo_total_item_no_kit") or 0.0) * qty
                            ratio = (c_cost_total / (kit_total_cost * qty)) if kit_total_cost > 0 else 0.0
                            
                            p_name = c.get("tipo_custo") or "Serviço Próprio"
                            p_code = None
                            p_uuid = UUID(c["own_service_id"]) if isinstance(c["own_service_id"], str) else c["own_service_id"]
                            os_obj = db.query(OwnService).filter(OwnService.id == p_uuid).first()
                            if os_obj:
                                p_name = os_obj.nome_servico or os_obj.descricao or p_name
                                p_code = None
                                
                            components_list.append({
                                "descricao": p_name,
                                "part_number": p_code,
                                "quantidade": int(c_qty) if c_qty.is_integer() else c_qty,
                                "custo_aquisicao": format_currency(c_cost_total),
                                "comissao": format_currency(comissao_item * ratio),
                                "instalacao": format_currency(instalacao_item * ratio),
                                "locacao_mensal": format_currency(loc_mensal_item * ratio),
                                "manutencao_mes": format_currency(manut_mes_item * ratio),
                                "monitoramento": format_currency(monitoramento_item * ratio),
                                "fat_mensal": format_currency((fat_mensal_total_item * ratio) / c_qty if c_qty > 0 else 0.0),
                                "fat_mensal_total": format_currency(fat_mensal_total_item * ratio),
                                "prazo": prazo_item_raw,
                                "vlr_total": format_currency(vlr_total_item * ratio),
                                "impostos_mensal": format_currency(impostos_mensal_item * ratio)
                            })

            item_desc = item.product_nome or (item.product.nome if item.product else "Equipamento de Locação")
            if pb_info and pb_info.get("pb") and pb_info["pb"].dolar_orcamento:
                pb = pb_info["pb"]
                pb_item = pb_info["pb_item"]
                if pb.valor_conversao and pb_item.valor_unitario_dolar is not None:
                    item_desc = f"{item_desc} (U$ {format_usd(pb_item.valor_unitario_dolar)} * Cot. R$ {format_rate(pb.valor_conversao)})"

            items_details.append({
                "descricao": item_desc,
                "part_number": item.product_codigo or (item.product.codigo if item.product else None),
                "quantidade": int(qty) if qty.is_integer() else qty,
                "custo_aquisicao": format_currency(custo_total),
                "comissao": format_currency(comissao_item),
                "instalacao": format_currency(instalacao_item),
                "locacao_mensal": format_currency(loc_mensal_item),
                "manutencao_mes": format_currency(manut_mes_item),
                "monitoramento": format_currency(monitoramento_item),
                "fat_mensal": format_currency(fat_mensal_unit),
                "fat_mensal_total": format_currency(fat_mensal_total_item),
                "prazo": prazo_item_raw,
                "vlr_total": format_currency(vlr_total_item),
                "impostos_mensal": format_currency(impostos_mensal_item),
                "components": components_list,
                # ReportLab fallback fields
                "custo_total": format_currency(custo_total),
                "fator_margem": f"{float(item.fator_margem):.2f}",
                "valor_mensal": format_currency(loc_mensal_item),
                "lucro_mensal": format_currency(float(item.kit_lucro_mensal if (item.opportunity_kit_id and item.kit_lucro_mensal is not None) else (item.lucro_mensal or 0.0)) * qty),
            })

        total_row = {
            "custo_aquisicao": format_currency(total_aquisicao_calc),
            "comissao": format_currency(total_comissao_calc),
            "instalacao": format_currency(total_instalacao_calc),
            "locacao_mensal": format_currency(total_locacao_mensal_calc),
            "manutencao_mes": format_currency(total_manutencao_mes_calc),
            "monitoramento": format_currency(total_monitoramento_calc),
            "fat_mensal": format_currency(total_fat_mensal_calc),
            "fat_mensal_total": format_currency(total_fat_mensal_total_calc),
            "vlr_total": format_currency(total_vlr_total_calc),
            "impostos_mensal": format_currency(total_impostos_mensal_calc)
        }
        total_aquisicao_sem_comissao = total_aquisicao_calc

        # Supplier summaries
        mapped_by_supplier = {}
        fallback_supplier_key = "sem_proposta"
        mapped_by_supplier[fallback_supplier_key] = {
            "fornecedor": "Não Cadastrado",
            "total_sem_imposto": 0.0,
            "total_imposto": 0.0,
            "total_custo": 0.0,
            "forma_pagamento": "À Vista"
        }
        for pb in purchase_budgets:
            supplier_id = pb.supplier_id
            if supplier_id not in mapped_by_supplier:
                mapped_by_supplier[supplier_id] = {
                    "fornecedor": pb.supplier_nome_fantasia,
                    "total_sem_imposto": 0.0,
                    "total_imposto": 0.0,
                    "total_custo": 0.0,
                    "forma_pagamento": pb.forma_pagamento.descricao if pb.forma_pagamento else (pb.forma_pagamento_snapshot.get("descricao") if pb.forma_pagamento_snapshot else "Não informada")
                }

        total_fornecedores_produtos = 0.0
        total_fornecedores_impostos = 0.0
        total_own_services_cost = 0.0

        for item in opportunity.rental_items:
            qty = float(item.quantidade)
            custo_total = (float(item.kit_investimento_total or 0.0) * qty) or (float(item.custo_total_aquisicao or 0.0) * qty)
            
            if item.opportunity_kit_id:
                kf = kits_financials.get(item.opportunity_kit_id)
                if kf:
                    # Loop over kit products/services in items
                    for c in kf.get("item_summaries", []):
                        c_qty = float(c.get("quantidade_no_kit") or 1.0) * qty
                        c_cost_total = float(c.get("custo_total_item_no_kit") or 0.0) * qty
                        
                        c_prod_id = c.get("product_id")
                        c_uuid = UUID(c_prod_id) if isinstance(c_prod_id, str) else c_prod_id
                        c_pb_info = product_suppliers.get(c_uuid) if c_uuid else None
                        
                        if c_pb_info:
                            supplier_id = c_pb_info["pb"].supplier_id
                            c_pb_item = c_pb_info["pb_item"]
                            c_difal, c_st, c_ipi, _ = get_purchase_tax_breakdown(c_uuid, c_pb_item)
                            c_tax_total = (c_difal + c_st + c_ipi) * c_qty
                            
                            supplier_data = mapped_by_supplier[supplier_id]
                            supplier_data["total_sem_imposto"] += (c_cost_total - c_tax_total)
                            supplier_data["total_imposto"] += c_tax_total
                            supplier_data["total_custo"] += c_cost_total
                            
                            total_fornecedores_produtos += (c_cost_total - c_tax_total)
                            total_fornecedores_impostos += c_tax_total
                        else:
                            if c.get("product_id") is not None:
                                supplier_data = mapped_by_supplier[fallback_supplier_key]
                                supplier_data["total_sem_imposto"] += c_cost_total
                                supplier_data["total_custo"] += c_cost_total
                                total_fornecedores_produtos += c_cost_total
                            else:
                                total_own_services_cost += c_cost_total
                            
                    for c in kf.get("cost_summaries", []):
                        if c.get("own_service_id") is not None:
                            c_cost_total = float(c.get("custo_total_item_no_kit") or 0.0) * qty
                            total_own_services_cost += c_cost_total
            else:
                pb_info = product_suppliers.get(item.product_id) if item.product_id else None
                if pb_info:
                    supplier_id = pb_info["pb"].supplier_id
                    pb_item = pb_info["pb_item"]
                    difal_unit, st_unit, ipi_unit, _ = get_purchase_tax_breakdown(item.product_id, pb_item)
                    tax_total = (difal_unit + st_unit + ipi_unit) * qty
                    
                    supplier_data = mapped_by_supplier[supplier_id]
                    supplier_data["total_sem_imposto"] += (custo_total - tax_total)
                    supplier_data["total_imposto"] += tax_total
                    supplier_data["total_custo"] += custo_total
                    
                    total_fornecedores_produtos += (custo_total - tax_total)
                    total_fornecedores_impostos += tax_total
                else:
                    if item.product_id is not None:
                        supplier_data = mapped_by_supplier[fallback_supplier_key]
                        supplier_data["total_sem_imposto"] += custo_total
                        supplier_data["total_custo"] += custo_total
                        total_fornecedores_produtos += custo_total
                    else:
                        total_own_services_cost += custo_total

        # Do not subtract own services from total_aquisicao_calc, as they are calculated separately and were not added to it
        total_aquisicao_sem_comissao = total_aquisicao_calc



        # Format supplier summaries to strings
        supplier_summaries_list = []
        for s in mapped_by_supplier.values():
            if s["total_custo"] > 0:
                supplier_summaries_list.append({
                    "fornecedor": s["fornecedor"],
                    "total_sem_imposto": format_currency(s["total_sem_imposto"]),
                    "total_imposto": format_currency(s["total_imposto"]),
                    "total_custo": format_currency(s["total_custo"]),
                    "forma_pagamento": s["forma_pagamento"]
                })

        # Net revenue comissao (Director commission)
        perc_comissao_diretoria = float(opportunity.perc_comissao_diretoria or 0.0)
        
        investimento_rental = total_aquisicao_calc + comissao_total_aquisicao
        impostos_total_rental = impostos_totais
        custo_op_total_rental = custo_op_total
        
        diretor_rec_liq = faturamento_total_rental - investimento_rental - impostos_total_rental - custo_op_total_rental
        
        rec_liq_inst_calc = total_instalacao - investimento_instalacao - impostos_instalacao_total - custo_op_instalacao_total
        rec_liq_mensal_calc = diretor_rec_liq - rec_liq_inst_calc
        
        comissao_inst_calc = max(0.0, rec_liq_inst_calc * (perc_comissao_diretoria / 100.0))
        comissao_mensal_calc = max(0.0, (rec_liq_mensal_calc * (perc_comissao_diretoria / 100.0)) / prazo_fat)
        
        diretor_comissao = comissao_inst_calc + (comissao_mensal_calc * prazo_fat)

        # Capex & Payback
        receita_contratada = faturamento_total_rental
        
        # desp_adm_instalacao_total and desp_adm_mensal_total are already computed dynamically in the loop above.

        # Capex (investimento total de aquisição + comissão + impostos de instalação + despesas adm instalação + frete instalação + despesa operacional + custo de instalação)
        investimento_total = total_aquisicao_calc + comissao_total_aquisicao + impostos_instalacao_total + desp_adm_instalacao_total + frete_instalacao_total + total_despesa_operacional + investimento_instalacao
        
        # Project Total Cost (Capex + Impostos + Custos Operacionais + Despesas Adm)
        custo_total_projeto = total_aquisicao_calc + comissao_total_aquisicao + desp_adm_instalacao_total + frete_instalacao_total + impostos_totais + custo_op_total + (desp_adm_mensal_total * prazo_contrato) + total_despesa_operacional + impostos_instalacao_total + investimento_instalacao

        
        # Retorno Mensal Líquido (ebitda) = Locação Mensal - Impostos Mensais - Custo Op Mensal - Despesas Adm Mensais
        retorno_mensal_liquido = locacao_mensal - impostos_mensal_total - custo_op_mensal_total - desp_adm_mensal_total
        
        # Payback in months (Simple division of Saldo Capex by Retorno Mensal Líquido as requested by user)
        has_instalacao = any(item.is_kit_instalacao for item in opportunity.rental_items)
        prazo_instalacao_cashflow = opportunity.prazo_instalacao_meses or (1 if has_instalacao else 0)

        saldo_capex = investimento_total - total_instalacao
        if retorno_mensal_liquido > 0.0:
            payback_mes = saldo_capex / retorno_mensal_liquido
            payback_meses_str = f"{payback_mes:.1f} meses"
        else:
            payback_mes = 0.0
            payback_meses_str = "N/A"
            
        # Margem líquida = Lucro do Contrato / Faturamento Total
        lucro_contrato = receita_contratada - custo_total_projeto
        margem_liquida_val = (lucro_contrato / receita_contratada * 100) if receita_contratada > 0 else 0.0

        # Determine tax rates based on the first item
        first_item = opportunity.rental_items[0] if opportunity.rental_items else None
        if first_item and first_item.opportunity_kit_id:
            aliq_pis = float(first_item.kit_pis or 0.0)
            aliq_cofins = float(first_item.kit_cofins or 0.0)
            aliq_csll = float(first_item.kit_csll or 0.0)
            aliq_irpj = float(first_item.kit_irpj or 0.0)
            aliq_iss = float(first_item.kit_iss or 0.0)
        else:
            aliq_pis = float(opportunity.perc_pis_rental or 0.0)
            aliq_cofins = float(opportunity.perc_cofins_rental or 0.0)
            aliq_csll = float(opportunity.perc_csll_rental or 0.0)
            aliq_irpj = float(opportunity.perc_irpj_rental or 0.0)
            aliq_iss = float(opportunity.perc_iss_rental or 0.0)

        # detailed taxes recalculation per item
        pis_total_mensal = 0.0
        cofins_total_mensal = 0.0
        csll_total_mensal = 0.0
        irpj_total_mensal = 0.0
        iss_total_mensal = 0.0
        
        pis_total_contrato = 0.0
        cofins_total_contrato = 0.0
        csll_total_contrato = 0.0
        irpj_total_contrato = 0.0
        iss_total_contrato = 0.0
        
        for item in opportunity.rental_items:
            q = float(item.quantidade)
            if item.is_kit_instalacao:
                continue
                
            faturamento = float(item.valor_mensal or getattr(item, "kit_valor_mensal", 0.0) or 0.0) * q
            if item.opportunity_kit_id:
                mon = float(item.kit_venda_unit_monitoramento or 0.0) * q
                man = float(item.kit_vlt_manut or item.manutencao_locacao or 0.0) * q
                loc = faturamento - man - mon
                rate_pis = float(item.kit_pis or 0.0)
                rate_cofins = float(item.kit_cofins or 0.0)
                rate_csll = float(item.kit_csll or 0.0)
                rate_irpj = float(item.kit_irpj or 0.0)
                rate_iss = float(item.kit_iss or 0.0)
                is_sep = bool(item.kit_faturamento_separado)
            else:
                mon = 0.0
                man = 0.0
                loc = faturamento
                rate_pis = aliq_pis
                rate_cofins = aliq_cofins
                rate_csll = aliq_csll
                rate_irpj = aliq_irpj
                rate_iss = aliq_iss
                is_sep = False
                
            is_com = item.tipo_contrato_kit == 'COMODATO' or (not item.opportunity_kit_id and opportunity.tipo_receita_rental == 'COMODATO')
            
            def calc_tax(is_iss: bool, rate: float):
                if rate <= 0: return 0.0
                if is_iss and not is_com: return 0.0
                if not is_sep: return (loc + man + mon) * (rate / 100.0)
                if is_iss: return (man + mon) * (rate / 100.0)
                return (loc + man + mon) * (rate / 100.0)
                
            c_pis = calc_tax(False, rate_pis)
            c_cofins = calc_tax(False, rate_cofins)
            c_csll = calc_tax(False, rate_csll)
            c_irpj = calc_tax(False, rate_irpj)
            c_iss = calc_tax(True, rate_iss)
            
            total_calc = c_pis + c_cofins + c_csll + c_irpj + c_iss
            
            # Recalculate kit impostos_mensal dynamically if available to match loop overrides
            kit_financials_summary = None
            if item.opportunity_kit_id:
                kf = kits_financials.get(item.opportunity_kit_id)
                if kf and "summary" in kf:
                    kit_financials_summary = kf["summary"]

            impostos = float(item.impostos_mensal or 0.0) * q

            ratio = impostos / total_calc if total_calc > 0 else 1.0
            
            pis_total_mensal += c_pis * ratio
            cofins_total_mensal += c_cofins * ratio
            csll_total_mensal += c_csll * ratio
            irpj_total_mensal += c_irpj * ratio
            iss_total_mensal += c_iss * ratio
            
            prazo_item_raw = int(item.prazo_contrato or prazo_contrato)
            prazo_item = max(0, prazo_item_raw - prazo_instalacao)
            
            pis_total_contrato += c_pis * ratio * prazo_item
            cofins_total_contrato += c_cofins * ratio * prazo_item
            csll_total_contrato += c_csll * ratio * prazo_item
            irpj_total_contrato += c_irpj * ratio * prazo_item
            iss_total_contrato += c_iss * ratio * prazo_item

        taxes_summary = [
            {"name": "PIS", "percent": f"{aliq_pis:.2f}", "mensal": format_currency(pis_total_mensal), "total": format_currency(pis_total_contrato)},
            {"name": "COFINS", "percent": f"{aliq_cofins:.2f}", "mensal": format_currency(cofins_total_mensal), "total": format_currency(cofins_total_contrato)},
            {"name": "CSLL", "percent": f"{aliq_csll:.2f}", "mensal": format_currency(csll_total_mensal), "total": format_currency(csll_total_contrato)},
            {"name": "IRPJ", "percent": f"{aliq_irpj:.2f}", "mensal": format_currency(irpj_total_mensal), "total": format_currency(irpj_total_contrato)},
            {"name": "ISS", "percent": f"{aliq_iss:.2f}", "mensal": format_currency(iss_total_mensal), "total": format_currency(iss_total_contrato)},
        ]

        # Detailed installation taxes recalculation
        pis_total_instalacao = 0.0
        cofins_total_instalacao = 0.0
        csll_total_instalacao = 0.0
        irpj_total_instalacao = 0.0
        iss_total_instalacao = 0.0
        
        for item in opportunity.rental_items:
            q = float(item.quantidade)
            if not item.is_kit_instalacao:
                continue
                
            faturamento = float(item.valor_mensal or getattr(item, "kit_valor_mensal", 0.0) or 0.0) * q
            if item.opportunity_kit_id:
                rate_pis = float(item.kit_pis or 0.0)
                rate_cofins = float(item.kit_cofins or 0.0)
                rate_csll = float(item.kit_csll or 0.0)
                rate_irpj = float(item.kit_irpj or 0.0)
                rate_iss = float(item.kit_iss or 0.0)
            else:
                rate_pis = aliq_pis
                rate_cofins = aliq_cofins
                rate_csll = aliq_csll
                rate_irpj = aliq_irpj
                rate_iss = aliq_iss
                
            c_pis = faturamento * (rate_pis / 100.0)
            c_cofins = faturamento * (rate_cofins / 100.0)
            c_csll = faturamento * (rate_csll / 100.0)
            c_irpj = faturamento * (rate_irpj / 100.0)
            c_iss = faturamento * (rate_iss / 100.0)
            
            total_calc = c_pis + c_cofins + c_csll + c_irpj + c_iss
            impostos = float(item.impostos_mensal or 0.0) * q
            ratio = impostos / total_calc if total_calc > 0 else 1.0
            
            pis_total_instalacao += c_pis * ratio
            cofins_total_instalacao += c_cofins * ratio
            csll_total_instalacao += c_csll * ratio
            irpj_total_instalacao += c_irpj * ratio
            iss_total_instalacao += c_iss * ratio

        taxes_instalacao_summary = [
            {"name": "PIS s/ Instalação", "percent": f"{aliq_pis:.2f}", "total": format_currency(pis_total_instalacao)},
            {"name": "COFINS s/ Instalação", "percent": f"{aliq_cofins:.2f}", "total": format_currency(cofins_total_instalacao)},
            {"name": "CSLL s/ Instalação", "percent": f"{aliq_csll:.2f}", "total": format_currency(csll_total_instalacao)},
            {"name": "IRPJ s/ Instalação", "percent": f"{aliq_irpj:.2f}", "total": format_currency(irpj_total_instalacao)},
            {"name": "ISS s/ Instalação", "percent": f"{aliq_iss:.2f}", "total": format_currency(iss_total_instalacao)},
        ]

        # Audit emission information
        now = datetime.datetime.now()
        emissao_data_hora = now.strftime("%d/%m/%Y às %H:%M")
        
        status_labels = {
            "EM_LANCAMENTO": "RASCUNHO",
            "ENVIADO_APROVACAO": "EM APROVAÇÃO",
            "RETORNADO_VENDEDOR": "REPROVADA",
            "APROVADO": "APROVADA",
            "CANCELADO": "CANCELADA",
            "GANHO": "GANHA"
        }

        opportunity_dict = {
            "id": str(opportunity.id),
            "numero_orcamento": opportunity.numero_orcamento or str(opportunity.id)[:8],
            "titulo": opportunity.titulo,
            "customer_nome": opportunity.customer.nome_fantasia or opportunity.customer.razao_social if opportunity.customer else "Cliente Não Informado",
            "vendedor_nome": opportunity.vendedor.name if opportunity.vendedor else "Não Informado",
            "status_label": status_labels.get(opportunity.status, opportunity.status),
            "company_nome": opportunity.company.nome_fantasia or opportunity.company.razao_social if opportunity.company else "Empresa Não Informada",
            "prazo_contrato_meses": prazo_contrato
        }

        auditoria = {
            "usuario_emissor": current_user.name or current_user.email,
            "data": now.strftime("%d/%m/%Y"),
            "hora": now.strftime("%H:%M"),
            "versao": "1.0.0"
        }

        kpis = {
            "receita_contratada": format_currency(receita_contratada),
            "investimento_total": format_currency(custo_total_projeto),
            "investimento_capex": format_currency(investimento_total),
            "investimento_capex_grid": format_currency(investimento_total),
            "total_despesa_operacional_val": total_despesa_operacional,

            "locacao_mensal": format_currency(locacao_mensal),
            "custo_op_total": format_currency(custo_op_total),
            "impostos_totais": format_currency(impostos_totais),
            "margem_liquida": f"{margem_liquida_val:.2f}",
            "payback_meses": payback_meses_str,
            "roi_oportunidade": format_currency(lucro_contrato),
            "margem_lucro": f"{margem_liquida_val:.2f}%",
            "total_faturamento_str": format_currency(receita_contratada),
            "total_custos_str": format_currency(custo_total_projeto),
            
            "total_st_difal": format_currency(total_st_difal),
            "total_aquisicao_sem_comissao": format_currency(total_aquisicao_sem_comissao),
            "custo_op_mensal_total": format_currency(custo_op_mensal_total),
            "impostos_mensal_total": format_currency(impostos_mensal_total),
            "lucro_mensal_total": format_currency(retorno_mensal_liquido),
            
            "comissao_total_str": format_currency(comissao_total_aquisicao),
            "total_comissao_liquida": format_currency(total_comissao_liquida),
            "total_comissao_dsr": format_currency(total_comissao_dsr),
            "total_comissao_fgts": format_currency(total_comissao_fgts),
            "total_comissao_inss": format_currency(total_comissao_inss),
            "total_comissao_demais": format_currency(total_comissao_demais),
            "total_despesa_operacional": format_currency(total_despesa_operacional),
            "total_comissao_cheia_mais_desp": format_currency(comissao_total_aquisicao + total_despesa_operacional),
            "impostos_instalacao_str": format_currency(impostos_instalacao_total),
            "desp_adm_instalacao_str": format_currency(desp_adm_instalacao_total),
            "desp_adm_instalacao_val": desp_adm_instalacao_total,
            "frete_instalacao_str": format_currency(frete_instalacao_total),
            "frete_instalacao_val": frete_instalacao_total,
            "desp_adm_mensal_str": format_currency(desp_adm_mensal_total),
            "desp_adm_mensal_val": desp_adm_mensal_total,
            "total_fornecedores_produtos": format_currency(total_fornecedores_produtos),
            "total_fornecedores_impostos": format_currency(total_fornecedores_impostos),
            "custo_total_aquisicao_bruto": format_currency(total_aquisicao_sem_comissao - total_st_difal),
            "custo_aquisicao_terceiros_str": format_currency(total_aquisicao_calc - total_own_services_cost),
            "custo_servicos_proprios_str": format_currency(investimento_instalacao),
            "custo_servicos_proprios": investimento_instalacao,
            "total_instalacao_str": format_currency(total_instalacao),
            "saldo_capex_amortizar_str": format_currency(investimento_total - total_instalacao),
        }

        # Collect and consolidate Bloco 7 Monthly Costs from the kits
        monthly_costs_list = []
        total_monthly_costs_val = 0.0
        total_monthly_costs_contrato_val = 0.0
        
        for item in opportunity.rental_items:
            if item.is_kit_instalacao:
                continue
            if item.opportunity_kit_id:
                qty = float(item.quantidade)
                kit = kits_by_id.get(item.opportunity_kit_id)
                if kit:
                    licenses_unit_sum = 0.0
                    if kit.monthly_costs:
                        for mcost in kit.monthly_costs:
                            m_qty = float(mcost.quantidade or 1.0) * qty
                            m_val_unit = float(mcost.valor_unitario or 0.0)
                            m_total = m_qty * m_val_unit
                            total_monthly_costs_val += m_total
                            
                            prazo_item_raw = int(item.prazo_contrato or prazo_contrato)
                            prazo_item = max(0, prazo_item_raw - prazo_instalacao)
                            m_total_contrato = m_total * prazo_item
                            total_monthly_costs_contrato_val += m_total_contrato
                            
                            licenses_unit_sum += m_val_unit
                            
                            monthly_costs_list.append({
                                "servico": mcost.servico,
                                "tipo_custo": mcost.tipo_custo,
                                "quantidade": int(m_qty) if m_qty.is_integer() else m_qty,
                                "valor_unitario": format_currency(m_val_unit),
                                "total": format_currency(m_total),
                                "total_contrato": format_currency(m_total_contrato)
                            })
                            
                    # Add kit maintenance operational cost row if any
                    kf = kits_financials.get(item.opportunity_kit_id)
                    custo_op_mensal_kit = 0.0
                    if kf and "summary" in kf:
                        s = kf["summary"]
                        custo_op_mensal_kit = float(s.get("custo_operacional_mensal_kit") or 0.0) + float(s.get("custo_mensal_bloco_7") or 0.0)
                    else:
                        custo_op_mensal_kit = float(item.custo_op_mensal_kit or 0.0)
                        
                    maint_unit_cost = max(0.0, custo_op_mensal_kit - licenses_unit_sum)
                    if maint_unit_cost > 0.0:
                        m_qty = qty
                        m_total = maint_unit_cost * qty
                        total_monthly_costs_val += m_total
                        
                        prazo_item_raw = int(item.prazo_contrato or prazo_contrato)
                        prazo_item = max(0, prazo_item_raw - prazo_instalacao)
                        m_total_contrato = m_total * prazo_item
                        total_monthly_costs_contrato_val += m_total_contrato
                        
                        monthly_costs_list.append({
                            "servico": f"MANUTENÇÃO E SUPORTE TÉCNICO - {kit.nome_kit}",
                            "tipo_custo": "Manutenção",
                            "quantidade": int(m_qty) if m_qty.is_integer() else m_qty,
                            "valor_unitario": format_currency(maint_unit_cost),
                            "total": format_currency(m_total),
                            "total_contrato": format_currency(m_total_contrato)
                        })

        # Determine modalidade de receita
        modalidade_label_map = {
            "LOCACAO_PURA": "Locação Pura",
            "COMODATO": "Comodato",
            "LOCACAO_SERVICO": "Locação com Serviços"
        }
        modalidade_contrato = modalidade_label_map.get(opportunity.tipo_receita_rental, "Locação")

        # Determine purchase modes
        purchase_tax_types = set()
        for item in opportunity.rental_items:
            if item.opportunity_kit_id:
                kit = kits_by_id.get(item.opportunity_kit_id)
                if kit and kit.considerar_st_ou_difal:
                    purchase_tax_types.add(kit.considerar_st_ou_difal)
            else:
                if (item.difal_unit or 0.0) > 0:
                    purchase_tax_types.add("DIFAL")
                if (item.icms_st_unit or 0.0) > 0:
                    purchase_tax_types.add("ST")

        forma_compra = ", ".join(sorted(list(purchase_tax_types))) if purchase_tax_types else "DIFAL"

        # Generate SVG stacked bar cash flow chart
        cashflow_chart_svg = OpportunitiesReportService.generate_svg_cashflow_chart(
            investimento=investimento_total,
            faturamento_mensal=locacao_mensal,
            impostos_mensal=impostos_mensal_total,
            custo_op_mensal=custo_op_mensal_total,
            comissao_mensal=comissao_mensal_calc,
            prazo_contrato=prazo_contrato,
            prazo_instalacao=prazo_instalacao_cashflow,
            total_instalacao=total_instalacao,
            impostos_instalacao=impostos_instalacao_total,
            custo_op_instalacao=custo_op_instalacao_total,
            comissao_instalacao=comissao_inst_calc,
            despesas_adm_mensal=desp_adm_mensal_total,
            despesas_adm_instalacao=desp_adm_instalacao_total
        )

        # 8. Render HTML Template
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        templates_dir = os.path.join(base_dir, "templates", "reports")
        
        # Determine company logo path
        company_logo = None
        if opportunity.company and opportunity.company.logo_url:
            root_dir = os.path.dirname(os.path.dirname(base_dir))
            clean_path = opportunity.company.logo_url.lstrip("/")
            abs_logo_path = os.path.join(root_dir, clean_path)
            if os.path.exists(abs_logo_path):
                normalized_path = abs_logo_path.replace("\\", "/")
                company_logo = f"file:///{normalized_path}"

        css_path = os.path.join(templates_dir, "locacao_approval_v1.css")
        html_path = os.path.join(templates_dir, "locacao_approval_v1.html")

        # Load styles and HTML
        css_content = ""
        if os.path.exists(css_path):
            with open(css_path, "r", encoding="utf-8") as f:
                css_content = f.read()

        html_template = ""
        if os.path.exists(html_path):
            with open(html_path, "r", encoding="utf-8") as f:
                html_template = f.read()
        else:
            raise HTTPException(status_code=500, detail="Report HTML template file not found.")

        # Render template
        from jinja2 import Template
        template = Template(html_template)
        rendered_html = template.render(
            css_content=css_content,
            opportunity=opportunity_dict,
            company_logo=company_logo,
            emissao_data_hora=emissao_data_hora,
            modalidade_contrato=modalidade_contrato,
            forma_compra=forma_compra,
            kpis=kpis,
            items_details=items_details,
            total_row=total_row,
            supplier_summaries=supplier_summaries_list,
            comissao_total_aquisicao=comissao_total_aquisicao,
            impostos_instalacao_total=impostos_instalacao_total,
            taxes_summary=taxes_summary,
            taxes_instalacao_summary=taxes_instalacao_summary,
            cashflow_chart_svg=cashflow_chart_svg,
            auditoria=auditoria,
            total_instalacao_str=format_currency(total_instalacao),
            monthly_costs_details=monthly_costs_list,
            total_monthly_costs_bloco_7=format_currency(total_monthly_costs_val),
            total_monthly_costs_contrato_bloco_7=format_currency(total_monthly_costs_contrato_val)
        )

        # 9. PDF Generation with WeasyPrint & Fallback
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=rendered_html).write_pdf()
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=approval-locacao-{opportunity_dict['numero_orcamento']}.pdf"
                }
            )
        except Exception as weasy_err:
            print(f"[Warning] WeasyPrint failed. Falling back to ReportLab. Error: {weasy_err}")
            # REPORTLAB FALLBACK
            from reportlab.lib.pagesizes import letter, landscape
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buffer, 
                pagesize=landscape(letter),
                rightMargin=30, leftMargin=30, topMargin=30, bottomMargin=30
            )
            story = []
            styles = getSampleStyleSheet()

            # Define styles
            title_style = ParagraphStyle(
                'ReportTitle',
                parent=styles['Heading1'],
                fontSize=18,
                textColor=colors.HexColor('#0f766e'),
                spaceAfter=15
            )
            sub_style = ParagraphStyle(
                'SubStyle',
                parent=styles['Normal'],
                fontSize=10,
                textColor=colors.HexColor('#475569'),
                spaceAfter=15
            )
            table_header_style = ParagraphStyle(
                'TableHeader',
                parent=styles['Normal'],
                fontSize=8,
                fontName='Helvetica-Bold',
                textColor=colors.white
            )
            table_cell_style = ParagraphStyle(
                'TableCell',
                parent=styles['Normal'],
                fontSize=8,
                textColor=colors.HexColor('#1e293b')
            )

            story.append(Paragraph(f"Relatório Executivo de Approval de Locação - #{opportunity_dict['numero_orcamento']}", title_style))
            story.append(Paragraph(f"Cliente: {opportunity_dict['customer_nome']} | Vendedor: {opportunity_dict['vendedor_nome']} | Emissão: {emissao_data_hora}", sub_style))

            # Render KPI table
            kpi_data = [
                ["Receita Contratada", "Investimento Inicial", "Locação Mensal", "Custos Op. Total", "Payback"],
                [f"R$ {kpis['receita_contratada']}", f"R$ {kpis['investimento_total']}", f"R$ {kpis['locacao_mensal']}", f"R$ {kpis['custo_op_total']}", kpis['payback_meses']]
            ]
            kpi_table = Table(kpi_data, colWidths=[130]*5)
            kpi_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f766e')),
                ('TEXTCOLOR', (0,0), (-1,0), colors.white),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE', (0,0), (-1,-1), 9),
                ('BOTTOMPADDING', (0,0), (-1,-1), 8),
                ('TOPPADDING', (0,0), (-1,-1), 8),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#e2e8f0')),
            ]))
            story.append(kpi_table)
            story.append(Spacer(1, 20))

            # Render simple items table
            story.append(Paragraph("Composição dos Itens", styles['Heading2']))
            story.append(Spacer(1, 6))

            item_data = [[
                Paragraph("Item", table_header_style), 
                Paragraph("Quantidade", table_header_style), 
                Paragraph("Custo Total", table_header_style), 
                Paragraph("Fator Margem", table_header_style), 
                Paragraph("Locação Mensal", table_header_style),
                Paragraph("Lucro Mensal", table_header_style)
            ]]
            for item in items_details:
                item_data.append([
                    Paragraph(item["descricao"], table_cell_style),
                    Paragraph(str(item["quantidade"]), table_cell_style),
                    Paragraph(f"R$ {item['custo_total']}", table_cell_style),
                    Paragraph(item["fator_margem"] + "x", table_cell_style),
                    Paragraph(f"R$ {item['valor_mensal']}", table_cell_style),
                    Paragraph(f"R$ {item['lucro_mensal']}", table_cell_style)
                ])

            item_table = Table(item_data, colWidths=[180, 80, 100, 80, 100, 100])
            item_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#334155')),
                ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                ('TOPPADDING', (0,0), (-1,-1), 4),
                ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#e2e8f0')),
            ]))
            story.append(item_table)

            doc.build(story)
            pdf_buffer.seek(0)
            return StreamingResponse(
                pdf_buffer,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=approval-locacao-{opportunity_dict['numero_orcamento']}.pdf"
                }
            )
