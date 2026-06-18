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
from src.modules.licitacoes.models import Licitacao, LicitacaoLote, LicitacaoItem
from src.modules.opportunity_kits.models import OpportunityKit
from src.modules.users.models import User

# Formatting helper
def format_currency(val) -> str:
    if val is None:
        return "0,00"
    return f"{float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def format_percent(val) -> str:
    if val is None:
        return "0,00%"
    return f"{float(val):.2f}%".replace(".", ",")

class LicitacoesReportService:
    @staticmethod
    def generate_envio_proposta_pdf(db: Session, licitacao_id: UUID, current_user: User) -> StreamingResponse:
        # Helper to get String representation of UUID/User safely
        def String(val):
            return str(val) if val is not None else ""

        # 1. Fetch Licitacao
        licitacao = db.query(Licitacao).filter(
            Licitacao.id == licitacao_id,
            Licitacao.tenant_id == current_user.tenant_id
        ).first()
        if not licitacao:
            raise HTTPException(status_code=404, detail="Licitação não encontrada")

        # Check permission for cost/profit
        user_role_strs = []
        for r in getattr(current_user, "roles", []):
            if hasattr(r, "role") and r.role is not None:
                val = getattr(r.role, "value", None) or getattr(r.role, "name", None)
                if val:
                    user_role_strs.append(str(val))

        is_po_or_manager = (
            String(licitacao.po_id) == String(current_user.id) or
            any(role in ["ADMIN", "DIRETORIA", "GERENTE"] for role in user_role_strs)
        )
        can_see_cost = is_po_or_manager

        # 2. Build Hierarchy: Lotes -> Items -> Kits
        lotes_data = []
        
        # Grand totals for the entire bidding
        grand_total_venda = Decimal("0.0")
        grand_total_custo = Decimal("0.0")
        grand_total_lucro = Decimal("0.0")
        grand_total_minimo = Decimal("0.0")
        grand_lucro_minimo = Decimal("0.0")
        has_min_margin_grand = False

        for lote in licitacao.lotes:
            lote_venda = Decimal("0.0")
            lote_custo = Decimal("0.0")
            lote_lucro = Decimal("0.0")
            lote_minimo = Decimal("0.0")
            lote_lucro_minimo = Decimal("0.0")
            has_min_margin_lote = False
            
            items_data = []
            
            for item in lote.items:
                item_venda = Decimal("0.0")
                item_custo = Decimal("0.0")
                item_lucro = Decimal("0.0")
                item_minimo = Decimal("0.0")
                item_lucro_minimo = Decimal("0.0")
                has_min_margin_item = False
                
                kits_data = []
                
                # Fetch kits for this item
                kits = db.query(OpportunityKit).filter(OpportunityKit.licitacao_item_id == item.id).all()
                for kit in kits:
                    v_total = kit.venda_total or Decimal("0.0")
                    c_total = kit.custo_total or Decimal("0.0")
                    l_estimado = kit.lucro_estimado or Decimal("0.0")
                    margem_atual = kit.margem_geral or Decimal("0.0")
                    
                    # Fator Atual
                    if kit.tipo_contrato in ("LOCACAO", "COMODATO"):
                        fator_atual = kit.fator_margem_locacao or Decimal("1.0")
                    elif kit.tipo_contrato == "VENDA_EQUIPAMENTOS":
                        fator_atual = kit.fator_margem_servicos_produtos or Decimal("1.0")
                    elif kit.tipo_contrato == "INSTALACAO":
                        fator_atual = kit.fator_margem_instalacao or Decimal("1.0")
                    else:
                        fator_atual = Decimal("1.0")

                    # Margem Minima Solver fields
                    margem_min = kit.margem_minima_resultante
                    fator_min = kit.fator_minimo_calculado
                    v_minimo = kit.valor_venda_minimo
                    l_minimo = kit.lucro_minimo
                    
                    # Accumulate totals
                    item_venda += v_total
                    item_custo += c_total
                    item_lucro += l_estimado
                    
                    if v_minimo is not None:
                        item_minimo += v_minimo
                        if l_minimo is not None:
                            item_lucro_minimo += l_minimo
                        has_min_margin_item = True
                        has_min_margin_lote = True
                        has_min_margin_grand = True
                    else:
                        # Fallback if not calculated
                        item_minimo += v_total
                        item_lucro_minimo += l_estimado

                    # Calculations for Desconto Maximo
                    desc_max_val = Decimal("0.0")
                    desc_max_pct = Decimal("0.0")
                    if v_minimo is not None and v_total > 0:
                        desc_max_val = v_total - v_minimo
                        desc_max_pct = (desc_max_val / v_total) * Decimal("100.0")

                    kits_data.append({
                        "id": str(kit.id),
                        "nome_kit": kit.nome_kit,
                        "tipo_contrato": kit.tipo_contrato,
                        "quantidade": int(kit.quantidade_kits or 1),
                        # Pricing Atual
                        "preco_atual": format_currency(v_total),
                        "margem_atual": format_percent(margem_atual) if can_see_cost else "---",
                        "fator_atual": f"{float(fator_atual):.2f}",
                        # Pricing Minimo
                        "preco_minimo": format_currency(v_minimo) if v_minimo is not None else "Não calculado",
                        "margem_minima": format_percent(margem_min) if (v_minimo is not None and can_see_cost) else ("---" if can_see_cost else "---"),
                        "fator_minimo": f"{float(fator_min):.2f}" if fator_min is not None else "---",
                        # Desconto Maximo
                        "desconto_max_val": format_currency(desc_max_val) if v_minimo is not None else "---",
                        "desconto_max_pct": format_percent(desc_max_pct) if v_minimo is not None else "---",
                        # Raw values for permissions check
                        "_v_total": v_total,
                        "_v_minimo": v_minimo,
                        "_desc_max_val": desc_max_val,
                        "_desc_max_pct": desc_max_pct,
                    })
                
                # Totals for Item
                item_margem_atual = (item_lucro / item_venda * Decimal("100.0")) if item_venda > 0 else Decimal("0.0")
                item_margem_min = (item_lucro_minimo / item_minimo * Decimal("100.0")) if (item_minimo > 0 and has_min_margin_item) else Decimal("0.0")
                item_desc_val = item_venda - item_minimo if has_min_margin_item else Decimal("0.0")
                item_desc_pct = (item_desc_val / item_venda * Decimal("100.0")) if (item_venda > 0 and has_min_margin_item) else Decimal("0.0")

                items_data.append({
                    "id": str(item.id),
                    "codigo": item.codigo,
                    "nome_concatenado": f"Item {item.codigo} - {item.nome}",
                    "kits": kits_data,
                    "has_kits": len(kits_data) > 0,
                    # Totals
                    "preco_atual": format_currency(item_venda),
                    "margem_atual": format_percent(item_margem_atual) if can_see_cost else "---",
                    "preco_minimo": format_currency(item_minimo) if has_min_margin_item else "Não calculado",
                    "margem_minima": format_percent(item_margem_min) if (has_min_margin_item and can_see_cost) else ("---" if can_see_cost else "---"),
                    "desconto_max_val": format_currency(item_desc_val) if has_min_margin_item else "---",
                    "desconto_max_pct": format_percent(item_desc_pct) if has_min_margin_item else "---",
                })
                
                lote_venda += item_venda
                lote_custo += item_custo
                lote_lucro += item_lucro
                lote_minimo += item_minimo
                lote_lucro_minimo += item_lucro_minimo

            # Totals for Lote
            lote_margem_atual = (lote_lucro / lote_venda * Decimal("100.0")) if lote_venda > 0 else Decimal("0.0")
            lote_margem_min = (lote_lucro_minimo / lote_minimo * Decimal("100.0")) if (lote_minimo > 0 and has_min_margin_lote) else Decimal("0.0")
            lote_desc_val = lote_venda - lote_minimo if has_min_margin_lote else Decimal("0.0")
            lote_desc_pct = (lote_desc_val / lote_venda * Decimal("100.0")) if (lote_venda > 0 and has_min_margin_lote) else Decimal("0.0")

            lotes_data.append({
                "id": str(lote.id),
                "numero": lote.numero,
                "nome_lote": f"LOTE {lote.numero} - {lote.nome}",
                "items": items_data,
                # Totals
                "preco_atual": format_currency(lote_venda),
                "margem_atual": format_percent(lote_margem_atual) if can_see_cost else "---",
                "preco_minimo": format_currency(lote_minimo) if has_min_margin_lote else "Não calculado",
                "margem_minima": format_percent(lote_margem_min) if (has_min_margin_lote and can_see_cost) else ("---" if can_see_cost else "---"),
                "desconto_max_val": format_currency(lote_desc_val) if has_min_margin_lote else "---",
                "desconto_max_pct": format_percent(lote_desc_pct) if has_min_margin_lote else "---",
            })
            
            grand_total_venda += lote_venda
            grand_total_custo += lote_custo
            grand_total_lucro += lote_lucro
            grand_total_minimo += lote_minimo
            grand_lucro_minimo += lote_lucro_minimo

        # Grand Totals
        grand_margem_atual = (grand_total_lucro / grand_total_venda * Decimal("100.0")) if grand_total_venda > 0 else Decimal("0.0")
        grand_margem_min = (grand_lucro_minimo / grand_total_minimo * Decimal("100.0")) if (grand_total_minimo > 0 and has_min_margin_grand) else Decimal("0.0")
        grand_desc_val = grand_total_venda - grand_total_minimo if has_min_margin_grand else Decimal("0.0")
        grand_desc_pct = (grand_desc_val / grand_total_venda * Decimal("100.0")) if (grand_total_venda > 0 and has_min_margin_grand) else Decimal("0.0")

        geral_totals = {
            "preco_atual": format_currency(grand_total_venda),
            "margem_atual": format_percent(grand_margem_atual) if can_see_cost else "---",
            "preco_minimo": format_currency(grand_total_minimo) if has_min_margin_grand else "Não calculado",
            "margem_minima": format_percent(grand_margem_min) if (has_min_margin_grand and can_see_cost) else ("---" if can_see_cost else "---"),
            "desconto_max_val": format_currency(grand_desc_val) if has_min_margin_grand else "---",
            "desconto_max_pct": format_percent(grand_desc_pct) if has_min_margin_grand else "---",
        }

        # 3. Audit metadata
        now = datetime.datetime.now()
        emissao_data_hora = now.strftime("%d/%m/%Y às %H:%M")
        auditoria = {
            "usuario_emissor": current_user.name or current_user.email,
            "data": now.strftime("%d/%m/%Y"),
            "hora": now.strftime("%H:%M"),
            "versao": "1.0.0"
        }

        licitacao_dict = {
            "id": str(licitacao.id),
            "numero_edital": licitacao.numero_edital,
            "descricao": licitacao.descricao or "Sem descrição",
            "customer_nome": licitacao.customer.nome_fantasia or licitacao.customer.razao_social if licitacao.customer else "Cliente Não Informado",
            "po_nome": licitacao.po.name if licitacao.po else "Não Informado",
            "status": licitacao.status,
            "modalidade": licitacao.modalidade,
            "tipo_licitacao": licitacao.tipo_licitacao,
            "company_nome": licitacao.company.nome_fantasia or licitacao.company.razao_social if licitacao.company else "Empresa Não Informada"
        }

        # 4. Render HTML/CSS Templates
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        templates_dir = os.path.join(base_dir, "templates", "reports")

        # Company Logo logic
        company_logo = None
        if licitacao.company and licitacao.company.logo_url:
            root_dir = os.path.dirname(os.path.dirname(base_dir))
            clean_path = licitacao.company.logo_url.lstrip("/")
            abs_logo_path = os.path.join(root_dir, clean_path)
            if os.path.exists(abs_logo_path):
                normalized_path = abs_logo_path.replace("\\", "/")
                company_logo = f"file:///{normalized_path}"

        css_path = os.path.join(templates_dir, "envio_proposta_v1.css")
        html_path = os.path.join(templates_dir, "envio_proposta_v1.html")

        # Load stylesheet
        css_content = ""
        if os.path.exists(css_path):
            with open(css_path, "r", encoding="utf-8") as f:
                css_content = f.read()

        # Load HTML template
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
            licitacao=licitacao_dict,
            company_logo=company_logo,
            emissao_data_hora=emissao_data_hora,
            lotes_data=lotes_data,
            geral_totals=geral_totals,
            auditoria=auditoria,
            can_see_cost=can_see_cost
        )

        # 5. PDF Generation with WeasyPrint & Fallback to ReportLab
        try:
            from weasyprint import HTML
            pdf_bytes = HTML(string=rendered_html).write_pdf()
            return StreamingResponse(
                io.BytesIO(pdf_bytes),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=envio-proposta-edital-{licitacao_dict['numero_edital'].replace('/', '_')}.pdf"
                }
            )
        except Exception as weasy_err:
            print(f"[Warning] WeasyPrint failed for bidding report. Falling back to ReportLab. Error: {weasy_err}")
            # REPORTLAB FALLBACK
            from reportlab.lib.pagesizes import letter, portrait
            from reportlab.lib import colors
            from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
            from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

            pdf_buffer = io.BytesIO()
            doc = SimpleDocTemplate(
                pdf_buffer, 
                pagesize=portrait(letter),
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
                spaceAfter=15
            )
            sub_style = ParagraphStyle(
                'SubStyle',
                parent=styles['Normal'],
                fontSize=9,
                textColor=colors.HexColor('#475569'),
                spaceAfter=15
            )
            lote_style = ParagraphStyle(
                'LoteHeader',
                parent=styles['Heading2'],
                fontSize=11,
                textColor=colors.HexColor('#1e3a8a'),
                spaceBefore=12,
                spaceAfter=6
            )
            item_style = ParagraphStyle(
                'ItemHeader',
                parent=styles['Normal'],
                fontSize=9,
                fontName='Helvetica-Bold',
                textColor=colors.HexColor('#334155'),
                spaceBefore=6,
                spaceAfter=4
            )
            table_header_style = ParagraphStyle(
                'TableHeader',
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
            table_cell_bold = ParagraphStyle(
                'TableCellBold',
                parent=styles['Normal'],
                fontSize=7,
                fontName='Helvetica-Bold',
                textColor=colors.HexColor('#1e293b')
            )

            story.append(Paragraph(f"Relatório de Envio de Proposta — Edital: {licitacao_dict['numero_edital']}", title_style))
            story.append(Paragraph(f"Cliente: {licitacao_dict['customer_nome']} | Responsável: {licitacao_dict['po_nome']} | Emissão: {emissao_data_hora}", sub_style))

            # Build Table Columns
            # Preço Atual | Margem Atual | Fator Atual | Preço Mínimo | Margem Mínima | Fator Mínimo | Desconto Máx
            headers_cols = ["Kit", "Preço Atual", "Margem", "Fator"]
            if can_see_cost:
                headers_cols.append("Preço Mín")
                headers_cols.append("Margem Mín")
                headers_cols.append("Fator Mín")
            headers_cols.append("Desconto Máx")

            col_widths = [140, 70, 50, 40]
            if can_see_cost:
                col_widths.extend([70, 50, 40])
            col_widths.append(70)

            # Story assembly
            for lote_d in lotes_data:
                story.append(Paragraph(lote_d["nome_lote"], lote_style))
                
                for item_d in lote_d["items"]:
                    story.append(Paragraph(item_d["nome_concatenado"], item_style))
                    
                    if not item_d["kits"]:
                        story.append(Paragraph("Sem kits associados a este item.", styles['Italic']))
                        continue

                    # Table Data
                    table_data = [[Paragraph(h, table_header_style) for h in headers_cols]]
                    
                    for k in item_d["kits"]:
                        row = [
                            Paragraph(k["nome_kit"], table_cell_style),
                            Paragraph(k["preco_atual"], table_cell_style),
                            Paragraph(k["margem_atual"], table_cell_style),
                            Paragraph(k["fator_atual"], table_cell_style)
                        ]
                        if can_see_cost:
                            row.append(Paragraph(k["preco_minimo"], table_cell_style))
                            row.append(Paragraph(k["margem_minima"], table_cell_style))
                            row.append(Paragraph(k["fator_minimo"], table_cell_style))
                        row.append(Paragraph(f"{k['desconto_max_val']} ({k['desconto_max_pct']})", table_cell_style))
                        
                        table_data.append(row)

                    # Add item total row
                    total_row = [
                        Paragraph("TOTAL ITEM", table_cell_bold),
                        Paragraph(item_d["preco_atual"], table_cell_bold),
                        Paragraph(item_d["margem_atual"], table_cell_bold),
                        Paragraph("---", table_cell_bold)
                    ]
                    if can_see_cost:
                        total_row.append(Paragraph(item_d["preco_minimo"], table_cell_bold))
                        total_row.append(Paragraph(item_d["margem_minima"], table_cell_bold))
                        total_row.append(Paragraph("---", table_cell_bold))
                    total_row.append(Paragraph(f"{item_d['desconto_max_val']} ({item_d['desconto_max_pct']})", table_cell_bold))
                    
                    table_data.append(total_row)

                    t_style = [
                        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#475569')),
                        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
                        ('TOPPADDING', (0,0), (-1,-1), 4),
                        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#cbd5e1')),
                        ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f1f5f9')),
                    ]
                    
                    kit_table = Table(table_data, colWidths=col_widths)
                    kit_table.setStyle(TableStyle(t_style))
                    story.append(kit_table)
                    story.append(Spacer(1, 8))

                # Add Lote Total
                story.append(Spacer(1, 4))
                lote_summary_data = [
                    ["TOTAL LOTE", lote_d["preco_atual"], lote_d["margem_atual"]]
                ]
                lote_cols = ["Lote Summary", "Preço Atual", "Margem Atual"]
                if can_see_cost:
                    lote_summary_data[0].extend([lote_d["preco_minimo"], lote_d["margem_minima"]])
                    lote_cols.extend(["Preço Mínimo", "Margem Mínima"])
                lote_summary_data[0].append(f"{lote_d['desconto_max_val']} ({lote_d['desconto_max_pct']})")
                lote_cols.append("Desconto Máximo")

                lote_table_data = [
                    [Paragraph(h, table_header_style) for h in lote_cols],
                    [Paragraph(v, table_cell_bold) for v in lote_summary_data[0]]
                ]
                
                l_widths = [150, 90, 70]
                if can_see_cost:
                    l_widths.extend([90, 70])
                l_widths.append(90)

                lote_table = Table(lote_table_data, colWidths=l_widths)
                lote_table.setStyle(TableStyle([
                    ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#1e3a8a')),
                    ('BOTTOMPADDING', (0,0), (-1,-1), 5),
                    ('TOPPADDING', (0,0), (-1,-1), 5),
                    ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#93c5fd')),
                    ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#eff6ff')),
                ]))
                story.append(lote_table)
                story.append(Spacer(1, 15))

            # Grand Total Section
            story.append(Spacer(1, 10))
            story.append(Paragraph("Resumo Geral da Licitação", lote_style))
            
            geral_cols = ["Geral Summary", "Preço Atual", "Margem Atual"]
            geral_row = ["TOTAL GERAL", geral_totals["preco_atual"], geral_totals["margem_atual"]]
            if can_see_cost:
                geral_cols.extend(["Preço Mínimo", "Margem Mínima"])
                geral_row.extend([geral_totals["preco_minimo"], geral_totals["margem_minima"]])
            geral_cols.append("Desconto Máximo")
            geral_row.append(f"{geral_totals['desconto_max_val']} ({geral_totals['desconto_max_pct']})")

            geral_table_data = [
                [Paragraph(h, table_header_style) for h in geral_cols],
                [Paragraph(v, table_cell_bold) for v in geral_row]
            ]
            
            g_widths = [150, 90, 70]
            if can_see_cost:
                g_widths.extend([90, 70])
            g_widths.append(90)

            geral_table = Table(geral_table_data, colWidths=g_widths)
            geral_table.setStyle(TableStyle([
                ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0f172a')),
                ('BOTTOMPADDING', (0,0), (-1,-1), 6),
                ('TOPPADDING', (0,0), (-1,-1), 6),
                ('GRID', (0,0), (-1,-1), 1, colors.HexColor('#475569')),
                ('BACKGROUND', (0,-1), (-1,-1), colors.HexColor('#f8fafc')),
            ]))
            story.append(geral_table)

            doc.build(story)
            pdf_buffer.seek(0)
            return StreamingResponse(
                pdf_buffer,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename=envio-proposta-edital-{licitacao_dict['numero_edital'].replace('/', '_')}.pdf"
                }
            )
