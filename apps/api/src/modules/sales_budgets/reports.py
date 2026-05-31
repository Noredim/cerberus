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
from src.modules.payment_methods.models import PlanejamentoFinanceiro
from src.modules.users.models import User

# Formatting helper
def format_currency(val) -> str:
    if val is None:
        return "0,00"
    return f"{float(val):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

def parse_payment_condition(condition_str: str, total_value: float, base_date: datetime.date) -> tuple[List[dict], Optional[str]]:
    import re
    from datetime import timedelta
    
    if not condition_str:
        return [
            {
                "label_parcela": "Parcela Única",
                "percentual": "100.00",
                "data_prevista": "Não Calculada",
                "valor": format_currency(total_value)
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
                "valor": format_currency(val)
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
                "valor": format_currency(val)
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
                    "valor": format_currency(val)
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
                "valor": format_currency(total_value)
            }
        ], None
        
    # 5. Fallback for uninterpreted strings (e.g. "Conforme negociação comercial")
    return [
        {
            "label_parcela": "Parcela Única",
            "percentual": "100.00",
            "data_prevista": "Não Calculada",
            "valor": format_currency(total_value)
        }
    ], "Forma de pagamento não estruturada."

class OpportunitiesReportService:
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

        if not purchase_budgets:
            raise HTTPException(
                status_code=400, 
                detail="Não existem orçamentos de fornecedores vinculados para gerar o relatório."
            )

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

        # Process standard items
        for item in opportunity.items:
            if not item.opportunity_kit_id and item.product_id:
                unpacked_items.append({
                    "product_id": item.product_id,
                    "descricao": item.product_nome or (item.product.nome if item.product else "Equipamento"),
                    "part_number": item.product.part_number if item.product else None,
                    "quantidade": float(item.quantidade)
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

        # Map unpacked items to purchase budget items
        mapped_by_supplier = {}
        for pb in purchase_budgets:
            supplier_id = pb.supplier_id
            supplier_name = pb.supplier_nome_fantasia
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
                opp_qty = sum(item["quantidade"] for item in unpacked_items if item["product_id"] == pb_item.product_id)
                if opp_qty <= 0:
                    opp_qty = float(pb_item.quantidade)

                # Prioritized Tax Lookup:
                # 1. RentalBudgetItem of the opportunity
                opp_rental_item = next((item for item in opportunity.rental_items if item.product_id == pb_item.product_id), None)
                
                difal_unit = float(opp_rental_item.difal_unit) if (opp_rental_item and opp_rental_item.difal_unit is not None) else None
                if difal_unit is None or difal_unit == 0.0:
                    difal_unit = float(pb_item.difal_unitario or 0.0)
                    
                st_unit = float(opp_rental_item.icms_st_unit) if (opp_rental_item and opp_rental_item.icms_st_unit is not None) else None
                if st_unit is None or st_unit == 0.0:
                    st_unit = float(pb_item.st_unitario or 0.0)

                val_unit = float(pb_item.valor_unitario)

                val_total = val_unit * opp_qty
                difal_total = difal_unit * opp_qty
                st_total = st_unit * opp_qty
                val_final = val_total + difal_total + st_total

                product_desc = pb_item.product_nome or (pb_item.product.nome if pb_item.product else "Produto")

                mapped_by_supplier[supplier_id]["items"].append({
                    "descricao": product_desc,
                    "part_number": pb_item.product_codigo or (pb_item.product.part_number if pb_item.product else None),
                    "quantidade": opp_qty,
                    "valor_unitario": format_currency(val_unit),
                    "valor_total": format_currency(val_total),
                    "difal_unitario": format_currency(difal_unit),
                    "difal_total": format_currency(difal_total),
                    "st_unitario": format_currency(st_unit),
                    "st_total": format_currency(st_total),
                    "valor_final": format_currency(val_final),
                    # Numeric versions for backend summation
                    "_val_total": val_total,
                    "_difal_total": difal_total,
                    "_st_total": st_total,
                    "_val_final": val_final,
                    "_difal_unit": difal_unit,
                    "_st_unit": st_unit
                })

        # Calculate supplier totals and fetch financial planning installments
        for supplier_id, data in list(mapped_by_supplier.items()):
            if not data["items"]:
                mapped_by_supplier.pop(supplier_id)
                continue

            total_prod = sum(item["_val_total"] for item in data["items"])
            total_difal = sum(item["_difal_total"] for item in data["items"])
            total_st = sum(item["_st_total"] for item in data["items"])
            total_imp = total_difal + total_st
            total_geral = total_prod + total_imp

            data["totais"] = {
                "total_produtos": format_currency(total_prod),
                "total_difal": format_currency(total_difal),
                "total_st": format_currency(total_st),
                "total_impostos": format_currency(total_imp),
                "total_geral": format_currency(total_geral),
                # Numeric
                "_total_produtos": total_prod,
                "_total_difal": total_difal,
                "_total_st": total_st,
                "_total_impostos": total_imp,
                "_total_geral": total_geral
            }

            # Parse payment condition dynamically
            pb = next(pb for pb in purchase_budgets if pb.supplier_id == supplier_id)
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

        # 5. Build Fiscal Summary Lists
        fiscal_difal_items = []
        fiscal_st_items = []
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

        # 6. Calculate Consolidated Opportunity KPIs
        venda_consolidada = float(opportunity.valor_total or 0.0)
        custo_consolidado = sum(data["totais"]["_total_geral"] for data in mapped_by_supplier.values())
        lucro_bruto = venda_consolidada - custo_consolidado
        custo_impostos = sum(data["totais"]["_total_impostos"] for data in mapped_by_supplier.values())
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
            "qtd_produtos": qtd_produtos_str
        }

        # 7. Build Fechamento por Fornecedor Section
        fechamento_fornecedores = []
        total_equipamentos_f = 0.0
        total_impostos_f = 0.0
        
        for data in mapped_by_supplier.values():
            e_val = data["totais"]["_total_produtos"]
            i_val = data["totais"]["_total_impostos"]
            t_val = data["totais"]["_total_geral"]
            
            total_equipamentos_f += e_val
            total_impostos_f += i_val
            
            fechamento_fornecedores.append({
                "nome": data["nome"],
                "equipamentos": format_currency(e_val),
                "impostos": format_currency(i_val),
                "total": format_currency(t_val)
            })
            
        total_geral_f = total_equipamentos_f + total_impostos_f
        
        fechamento_totals = {
            "total_equipamentos": format_currency(total_equipamentos_f),
            "total_impostos": format_currency(total_impostos_f),
            "total_geral": format_currency(total_geral_f)
        }

        # 8. Build Consolidated General Section
        total_prod_all = sum(float(item["_val_total"]) for data in mapped_by_supplier.values() for item in data["items"])
        total_difal_all = sum(float(item["_difal_total"]) for data in mapped_by_supplier.values() for item in data["items"])
        total_st_all = sum(float(item["_st_total"]) for data in mapped_by_supplier.values() for item in data["items"])
        total_imp_all = total_difal_all + total_st_all
        total_geral_all = total_prod_all + total_imp_all

        consolidado_geral = {
            "total_produtos": format_currency(total_prod_all),
            "total_difal": format_currency(total_difal_all),
            "total_st": format_currency(total_st_all),
            "total_impostos": format_currency(total_imp_all),
            "total_geral_aquisicao": format_currency(total_geral_all)
        }

        # Status translation
        status_labels = {
            "EM_LANCAMENTO": "Rascunho",
            "ENVIADO_APROVACAO": "Em Aprovação",
            "RETORNADO_VENDEDOR": "Ajuste Requerido",
            "APROVADO": "Aprovado",
            "CANCELADO": "Cancelado",
            "GANHO": "Ganho"
        }

        opportunity_dict = {
            "id": str(opportunity.id),
            "numero_orcamento": opportunity.numero_orcamento or str(opportunity.id)[:8],
            "titulo": opportunity.titulo,
            "customer_nome": opportunity.customer.nome_fantasia or opportunity.customer.razao_social if opportunity.customer else "Cliente Não Informado",
            "vendedor_nome": opportunity.vendedor.name if opportunity.vendedor else "Não Informado",
            "status_label": status_labels.get(opportunity.status, opportunity.status)
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
            emissao_data_hora=emissao_data_hora,
            approval=approval_data,
            kpis=kpis,
            suppliers_data=list(mapped_by_supplier.values()),
            fiscal_difal_items=fiscal_difal_items,
            fiscal_st_items=fiscal_st_items,
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
                ["Venda Consolidada", "Custo Consolidado", "Lucro Bruto", "Custo Impostos", "MKP", "Qtd. Fornecedores", "Qtd. Produtos"],
                [f"R$ {kpis['venda_consolidada']}", f"R$ {kpis['custo_consolidado']}", f"R$ {kpis['lucro_bruto']}", f"R$ {kpis['custo_impostos']}", f"{kpis['markup']}x", kpis['qtd_fornecedores'], kpis['qtd_produtos']]
            ]
            kpi_table = Table(kpi_data, colWidths=[100]*7)
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
                    Paragraph("Produto", table_header_style), 
                    Paragraph("Part Number", table_header_style), 
                    Paragraph("Qtd", table_header_style), 
                    Paragraph("Val. Unit", table_header_style), 
                    Paragraph("Total", table_header_style), 
                    Paragraph("ST Total", table_header_style), 
                    Paragraph("DIFAL Total", table_header_style), 
                    Paragraph("Valor Final", table_header_style)
                ]]
                for item in supplier["items"]:
                    table_data.append([
                        Paragraph(item["descricao"], table_cell_style),
                        Paragraph(item["part_number"] or "-", table_cell_style),
                        Paragraph(str(item["quantidade"]), table_cell_style),
                        Paragraph(f"R$ {item['valor_unitario']}", table_cell_style),
                        Paragraph(f"R$ {item['valor_total']}", table_cell_style),
                        Paragraph(f"R$ {item['st_total']}", table_cell_style),
                        Paragraph(f"R$ {item['difal_total']}", table_cell_style),
                        Paragraph(f"R$ {item['valor_final']}", table_cell_style)
                    ])

                table_data.append([
                    Paragraph("TOTAL FORNECEDOR", table_cell_style),
                    Paragraph("-", table_cell_style),
                    Paragraph("-", table_cell_style),
                    Paragraph("-", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_produtos']}", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_st']}", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_difal']}", table_cell_style),
                    Paragraph(f"R$ {supplier['totais']['total_geral']}", table_cell_style)
                ])

                supplier_table = Table(table_data, colWidths=[180, 80, 40, 70, 70, 70, 70, 80])
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
                Paragraph("Total", table_header_style)
            ]]
            for f in fechamento_fornecedores:
                fech_data.append([
                    Paragraph(f["nome"], table_cell_style),
                    Paragraph(f"R$ {f['equipamentos']}", table_cell_style),
                    Paragraph(f"R$ {f['impostos']}", table_cell_style),
                    Paragraph(f"R$ {f['total']}", table_cell_style)
                ])
            fech_data.append([
                Paragraph("TOTAL GERAL", table_cell_style),
                Paragraph(f"R$ {fechamento_totals['total_equipamentos']}", table_cell_style),
                Paragraph(f"R$ {fechamento_totals['total_impostos']}", table_cell_style),
                Paragraph(f"R$ {fechamento_totals['total_geral']}", table_cell_style)
            ])
            fech_table = Table(fech_data, colWidths=[200, 100, 100, 100])
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
