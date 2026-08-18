import re
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional, Tuple
from src.modules.document_templates.models import DocumentTemplate, DocumentVersion, DocumentVariable, DocumentAudit, Letterhead
from src.modules.document_templates.schemas import (
    TemplateCreate, TemplateUpdate, DocumentRenderRequest,
    LetterheadCreate, LetterheadUpdate, LetterheadPreviewRequest
)
from src.modules.sales_budgets.models import SalesBudget
from src.modules.customers.models import Customer
from src.modules.companies.models import Company
DEFAULT_BASE_CSS = """
@page {
    size: A4;
    margin: 0;
}
html, body {
    margin: 0;
    padding: 0;
    font-family: Arial, Helvetica, sans-serif;
    color: #0f172a;
    line-height: 1.5;
}
.has-letterhead,
.letterhead-wrapper {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 297mm;
    min-height: 297mm;
    max-height: 297mm;
    box-sizing: border-box;
    position: relative;
    width: 100%;
    padding: 0.8cm 1.5cm 0.8cm 1.5cm;
    overflow: hidden;
}
.document-body-container {
    box-sizing: border-box;
    padding-top: 3.0cm;
    padding-bottom: 2.5cm;
    padding-left: 2.0cm;
    padding-right: 2.0cm;
    display: block;
    width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
}
.has-letterhead .document-body,
.letterhead-wrapper .document-body {
    flex: 1 1 auto !important;
    display: flex !important;
    flex-direction: column !important;
    min-height: 0 !important;
    max-height: none !important;
    overflow: hidden;
}
.has-letterhead .document-body-container,
.letterhead-wrapper .document-body-container {
    padding-top: 0.3cm !important;
    padding-bottom: 0.3cm !important;
    padding-left: 0 !important;
    padding-right: 0 !important;
    flex: 1 1 auto;
}
p {
    margin-top: 0;
    margin-bottom: 0.8em;
}
img {
    max-width: 100%;
    height: auto;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1em;
}
.has-letterhead .footer,
.letterhead-wrapper .footer,
.footer, [class*="footer"], footer {
    margin-top: auto !important;
    flex-shrink: 0 !important;
}
"""


def list_letterheads(
    db: Session,
    tenant_id: str,
    company_id: str,
    is_active: Optional[bool] = None,
    search: Optional[str] = None
) -> List[Letterhead]:
    query = db.query(Letterhead).filter(
        Letterhead.tenant_id == tenant_id,
        Letterhead.company_id == company_id
    )
    if is_active is not None:
        query = query.filter(Letterhead.is_active == is_active)
    if search:
        query = query.filter(Letterhead.nome.ilike(f"%{search}%"))
    return query.order_by(Letterhead.nome.asc()).all()


def get_letterhead(db: Session, tenant_id: str, company_id: str, letterhead_id: str) -> Optional[Letterhead]:
    return db.query(Letterhead).filter(
        Letterhead.id == letterhead_id,
        Letterhead.tenant_id == tenant_id,
        Letterhead.company_id == company_id
    ).first()


def create_letterhead(db: Session, tenant_id: str, company_id: str, data: LetterheadCreate) -> Letterhead:
    if data.is_default:
        db.query(Letterhead).filter(
            Letterhead.tenant_id == tenant_id,
            Letterhead.company_id == company_id
        ).update({"is_default": False})

    lh = Letterhead(
        tenant_id=tenant_id,
        company_id=company_id,
        nome=data.nome,
        descricao=data.descricao,
        conteudo_html=data.conteudo_html,
        conteudo_css=data.conteudo_css,
        is_active=data.is_active,
        is_default=data.is_default
    )
    db.add(lh)
    db.commit()
    db.refresh(lh)
    return lh


def update_letterhead(db: Session, tenant_id: str, company_id: str, letterhead_id: str, data: LetterheadUpdate) -> Optional[Letterhead]:
    lh = get_letterhead(db, tenant_id, company_id, letterhead_id)
    if not lh:
        return None

    if data.is_default and not lh.is_default:
        db.query(Letterhead).filter(
            Letterhead.tenant_id == tenant_id,
            Letterhead.company_id == company_id,
            Letterhead.id != lh.id
        ).update({"is_default": False})

    lh.nome = data.nome
    lh.descricao = data.descricao
    lh.conteudo_html = data.conteudo_html
    lh.conteudo_css = data.conteudo_css
    lh.is_active = data.is_active
    lh.is_default = data.is_default

    db.commit()
    db.refresh(lh)
    return lh


def delete_letterhead(db: Session, tenant_id: str, company_id: str, letterhead_id: str) -> bool:
    lh = get_letterhead(db, tenant_id, company_id, letterhead_id)
    if not lh:
        return False

    db.delete(lh)
    db.commit()
    return True


def preview_letterhead(data: LetterheadPreviewRequest) -> str:
    html = data.conteudo_html or "{{document_content}}"
    css = data.conteudo_css or ""
    sample = data.sample_content or """
    <div style="padding: 20px; font-family: sans-serif;">
        <h2 style="color: #1e293b;">Demonstração de Conteúdo do Documento</h2>
        <p style="color: #475569; line-height: 1.6;">
            Este é um texto de exemplo para visualização de como o documento final ficará envelopado no Papel Timbrado cadastrado.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <thead>
                <tr style="background-color: #f1f5f9; text-align: left;">
                    <th style="padding: 8px; border: 1px solid #cbd5e1;">Item</th>
                    <th style="padding: 8px; border: 1px solid #cbd5e1;">Descrição</th>
                    <th style="padding: 8px; border: 1px solid #cbd5e1;">Valor</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td style="padding: 8px; border: 1px solid #cbd5e1;">01</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1;">Prestação de Serviços de Segurança Eletrônica</td>
                    <td style="padding: 8px; border: 1px solid #cbd5e1;">R$ 4.500,00</td>
                </tr>
            </tbody>
        </table>
    </div>
    """

    if "{{document_content}}" in html:
        rendered = html.replace("{{document_content}}", sample)
    elif "{{conteudo_documento}}" in html:
        rendered = html.replace("{{conteudo_documento}}", sample)
    else:
        rendered = f"{html}\n{sample}"

    base_css = DEFAULT_BASE_CSS
    if css and css.strip():
        rendered = f"<style>{base_css}\n{css}</style>\n<div class=\"letterhead-wrapper\">{rendered}</div>"
    else:
        rendered = f"<style>{base_css}</style>\n<div class=\"letterhead-wrapper\">{rendered}</div>"

    return rendered


def format_currency(val: float) -> str:
    val = float(val or 0.0)
    return f"R$ {val:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def build_synthetic_items_table(budget: SalesBudget) -> str:
    """Modo Sintético: Agrupa itens por Kit de Oportunidade ou Produto avulso/Serviço.
    Exibe 1 linha consolidada por Kit com o Nome do Kit, Quantidade, Valor Unitário e Valor Total.
    Suporta tanto itens de Venda (budget.items) quanto Ativos de Locação/Comodato (budget.rental_items).
    """
    sales_items = list(budget.items or [])
    rental_items = list(budget.rental_items or [])
    all_items = sales_items + rental_items

    if not budget or not all_items:
        return """
        <table class="tabela-itens-sintetica" style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px;">
            <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; color: #334155;">
                    <th style="padding: 8px 12px;">Item / Kit (Sintético)</th>
                    <th style="padding: 8px 12px; text-align: center;">Qtd</th>
                    <th style="padding: 8px 12px; text-align: right;">Val. Unitário</th>
                    <th style="padding: 8px 12px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr><td colspan="4" style="padding: 10px; text-align: center; color: #64748b;">Nenhum item cadastrado na oportunidade.</td></tr>
            </tbody>
        </table>
        """

    kits_map = {}
    standalone_items = []

    # 1. Process Sales items
    for item in sales_items:
        if item.opportunity_kit_id and item.opportunity_kit:
            kit_id = str(item.opportunity_kit_id)
            if kit_id not in kits_map:
                kits_map[kit_id] = {
                    "kit": item.opportunity_kit,
                    "qtd": float(item.quantidade or 1),
                    "total": 0.0,
                    "items": []
                }
            kits_map[kit_id]["total"] += float(item.total_venda or 0.0)
            kits_map[kit_id]["items"].append(item)
        else:
            standalone_items.append({
                "codigo": item.product.codigo if item.product else "-",
                "nome": item.product.nome if item.product else (item.descricao_servico or "Item Geral"),
                "qtd": float(item.quantidade or 1),
                "venda_unit": float(item.venda_unit or 0),
                "total": float(item.total_venda or 0)
            })

    # 2. Process Rental items
    for item in rental_items:
        if item.opportunity_kit_id and item.opportunity_kit:
            kit_id = str(item.opportunity_kit_id)
            kit_total = float(item.kit_valor_mensal or item.valor_mensal or item.kit_investimento_total or item.custo_total_aquisicao or 0.0)
            if kit_id not in kits_map:
                kits_map[kit_id] = {
                    "kit": item.opportunity_kit,
                    "qtd": float(item.quantidade or 1),
                    "total": 0.0,
                    "items": []
                }
            kits_map[kit_id]["total"] += kit_total
            kits_map[kit_id]["items"].append(item)
        else:
            qtd = float(item.quantidade or 1)
            total = float(item.valor_mensal * qtd if item.valor_mensal else item.custo_total_aquisicao or 0.0)
            venda_unit = total / qtd if qtd > 0 else total
            standalone_items.append({
                "codigo": item.product.codigo if item.product else "-",
                "nome": item.product_nome or (item.product.nome if item.product else "Ativo de Locação"),
                "qtd": qtd,
                "venda_unit": venda_unit,
                "total": total
            })

    rows_html = ""

    for kit_id, data in kits_map.items():
        kit_nome = data["kit"].nome_kit or "Kit de Oportunidade"
        kit_desc = getattr(data["kit"], 'descricao_kit', None) or getattr(data["kit"], 'descricao', '')
        qtd = float(data["qtd"] or 1)
        total = data["total"]
        unit = total / qtd if qtd > 0 else total

        desc_html = f"<strong>Kit: {kit_nome}</strong>"
        if kit_desc:
            desc_html += f"<br/><small style='color: #64748b;'>{kit_desc}</small>"

        rows_html += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px; font-weight: 500;">{desc_html}</td>
            <td style="padding: 10px 12px; text-align: center;">{int(qtd) if qtd.is_integer() else f"{qtd:.2f}"}</td>
            <td style="padding: 10px 12px; text-align: right;">{format_currency(unit)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 600;">{format_currency(total)}</td>
        </tr>
        """

    for item_data in standalone_items:
        codigo = item_data["codigo"]
        nome = item_data["nome"]
        qtd = item_data["qtd"]
        venda_unit = item_data["venda_unit"]
        total = item_data["total"]

        rows_html += f"""
        <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 12px;"><strong>[{codigo}]</strong> {nome}</td>
            <td style="padding: 10px 12px; text-align: center;">{int(qtd) if qtd.is_integer() else f"{qtd:.2f}"}</td>
            <td style="padding: 10px 12px; text-align: right;">{format_currency(venda_unit)}</td>
            <td style="padding: 10px 12px; text-align: right; font-weight: 600;">{format_currency(total)}</td>
        </tr>
        """

    total_proposta = float(budget.valor_total or 0.0)
    if total_proposta == 0.0:
        total_proposta = sum(d["total"] for d in kits_map.values()) + sum(d["total"] for d in standalone_items)

    return f"""
    <table class="tabela-itens-sintetica" style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px;">
        <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; color: #334155;">
                <th style="padding: 10px 12px;">Item / Kit (Sintético)</th>
                <th style="padding: 10px 12px; text-align: center;">Qtd</th>
                <th style="padding: 10px 12px; text-align: right;">Val. Unitário</th>
                <th style="padding: 10px 12px; text-align: right;">Total</th>
            </tr>
        </thead>
        <tbody>
            {rows_html}
        </tbody>
        <tfoot>
            <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
                <td colspan="3" style="padding: 10px 12px; text-align: right;">TOTAL DA PROPOSTA:</td>
                <td style="padding: 10px 12px; text-align: right; color: #0f172a; font-size: 13px;">{format_currency(total_proposta)}</td>
            </tr>
        </tfoot>
    </table>
    """


def build_analytical_items_table(budget: SalesBudget) -> str:
    """Modo Analítico: Abre todos os sub-itens dentro de cada Kit de Oportunidade,
    mostrando produtos, serviços de instalação e manutenção unificados sob o Kit.
    Suporta tanto itens de Venda (budget.items) quanto Ativos de Locação/Comodato (budget.rental_items).
    """
    sales_items = list(budget.items or [])
    rental_items = list(budget.rental_items or [])
    all_items = sales_items + rental_items

    if not budget or not all_items:
        return """
        <table class="tabela-itens-analitica" style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px;">
            <thead>
                <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; color: #334155;">
                    <th style="padding: 8px 12px;">Código</th>
                    <th style="padding: 8px 12px;">Descrição do Item (Analítico)</th>
                    <th style="padding: 8px 12px; text-align: center;">Tipo</th>
                    <th style="padding: 8px 12px; text-align: center;">Qtd</th>
                    <th style="padding: 8px 12px; text-align: right;">Val. Unitário</th>
                    <th style="padding: 8px 12px; text-align: right;">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr><td colspan="6" style="padding: 10px; text-align: center; color: #64748b;">Nenhum item cadastrado na oportunidade.</td></tr>
            </tbody>
        </table>
        """

    kits_map = {}
    standalone_items = []

    # 1. Process Sales Items
    for item in sales_items:
        if item.opportunity_kit_id and item.opportunity_kit:
            kit_id = str(item.opportunity_kit_id)
            if kit_id not in kits_map:
                kits_map[kit_id] = {
                    "kit": item.opportunity_kit,
                    "qtd": float(item.quantidade or 1),
                    "total": 0.0,
                    "items": []
                }
            kits_map[kit_id]["total"] += float(item.total_venda or 0.0)
            kits_map[kit_id]["items"].append({
                "codigo": item.product.codigo if item.product else "-",
                "nome": item.product.nome if item.product else (item.descricao_servico or "Sub-item do Kit"),
                "tipo_label": "Mercadoria" if item.tipo_item == "MERCADORIA" else ("Instalação" if item.tipo_item == "SERVICO_INSTALACAO" else "Manutenção"),
                "qtd": float(item.quantidade or 1),
                "venda_unit": float(item.venda_unit or 0),
                "total": float(item.total_venda or 0)
            })
        else:
            standalone_items.append({
                "codigo": item.product.codigo if item.product else "-",
                "nome": item.product.nome if item.product else (item.descricao_servico or "Item Avulso"),
                "tipo_label": "Mercadoria" if item.tipo_item == "MERCADORIA" else ("Instalação" if item.tipo_item == "SERVICO_INSTALACAO" else "Manutenção"),
                "qtd": float(item.quantidade or 1),
                "venda_unit": float(item.venda_unit or 0),
                "total": float(item.total_venda or 0)
            })

    # 2. Process Rental Items
    for item in rental_items:
        if item.opportunity_kit_id and item.opportunity_kit:
            kit_id = str(item.opportunity_kit_id)
            kit_obj = item.opportunity_kit
            kit_total = float(item.kit_valor_mensal or item.valor_mensal or item.kit_investimento_total or item.custo_total_aquisicao or 0.0)
            if kit_id not in kits_map:
                kits_map[kit_id] = {
                    "kit": kit_obj,
                    "qtd": float(item.quantidade or 1),
                    "total": 0.0,
                    "items": []
                }
            kits_map[kit_id]["total"] += kit_total
            
            # Extract sub-items from kit.items if present
            if kit_obj.items:
                for sub in kit_obj.items:
                    prod = sub.product
                    svc = sub.own_service
                    cod = prod.codigo if prod else "-"
                    nm = prod.nome if prod else (svc.nome if svc else sub.descricao_item)
                    tp = "Mercadoria" if sub.tipo_item == "PRODUTO" else "Serviço"
                    q = float(sub.quantidade_no_kit or 1) * float(item.quantidade or 1)
                    kits_map[kit_id]["items"].append({
                        "codigo": cod,
                        "nome": nm,
                        "tipo_label": tp,
                        "qtd": q,
                        "venda_unit": 0.0,
                        "total": 0.0
                    })
            else:
                kits_map[kit_id]["items"].append({
                    "codigo": item.product.codigo if item.product else "-",
                    "nome": item.product_nome or "Ativo de Locação",
                    "tipo_label": "Locação/Comodato",
                    "qtd": float(item.quantidade or 1),
                    "venda_unit": kit_total / float(item.quantidade or 1) if float(item.quantidade or 1) > 0 else kit_total,
                    "total": kit_total
                })
        else:
            qtd = float(item.quantidade or 1)
            total = float(item.valor_mensal * qtd if item.valor_mensal else item.custo_total_aquisicao or 0.0)
            venda_unit = total / qtd if qtd > 0 else total
            standalone_items.append({
                "codigo": item.product.codigo if item.product else "-",
                "nome": item.product_nome or (item.product.nome if item.product else "Ativo de Locação"),
                "tipo_label": "Locação/Comodato",
                "qtd": qtd,
                "venda_unit": venda_unit,
                "total": total
            })

    rows_html = ""

    for kit_id, data in kits_map.items():
        kit_nome = data["kit"].nome_kit or "Kit de Oportunidade"
        kit_qtd = float(data["qtd"] or 1)
        kit_total = data["total"]
        unidade = getattr(data["kit"], 'unidade', None) or 'UN'

        rows_html += f"""
        <tr style="background-color: #f1f5f9; border-top: 2px solid #cbd5e1; border-bottom: 1px solid #cbd5e1;">
            <td colspan="4" style="padding: 8px 12px; font-weight: bold; color: #1e293b;">
                📦 KIT: {kit_nome} (Qtd: {int(kit_qtd) if kit_qtd.is_integer() else f"{kit_qtd:.2f}"} {unidade})
            </td>
            <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #475569;">Subtotal:</td>
            <td style="padding: 8px 12px; text-align: right; font-weight: bold; color: #0f172a;">{format_currency(kit_total)}</td>
        </tr>
        """

        for sub in data["items"]:
            codigo = sub["codigo"]
            nome = sub["nome"]
            tipo_label = sub["tipo_label"]
            tipo_badge = f'<span style="background:#e2e8f0; color:#334155; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">{tipo_label}</span>'
            qtd = sub["qtd"]
            venda_unit = sub["venda_unit"]
            total = sub["total"]

            unit_str = format_currency(venda_unit) if venda_unit > 0 else "-"
            total_str = format_currency(total) if total > 0 else "-"

            rows_html += f"""
            <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 6px 12px 6px 24px; font-mono; font-size: 11px; color: #64748b;">{codigo}</td>
                <td style="padding: 6px 12px;">{nome}</td>
                <td style="padding: 6px 12px; text-align: center;">{tipo_badge}</td>
                <td style="padding: 6px 12px; text-align: center;">{int(qtd) if qtd.is_integer() else f"{qtd:.2f}"}</td>
                <td style="padding: 6px 12px; text-align: right;">{unit_str}</td>
                <td style="padding: 6px 12px; text-align: right; font-weight: 500;">{total_str}</td>
            </tr>
            """

    if standalone_items:
        if kits_map:
            rows_html += """
            <tr style="background-color: #f8fafc; border-top: 2px solid #cbd5e1;">
                <td colspan="6" style="padding: 8px 12px; font-weight: bold; color: #334155;">Itens Avulsos da Proposta</td>
            </tr>
            """
        for item_data in standalone_items:
            codigo = item_data["codigo"]
            nome = item_data["nome"]
            tipo_label = item_data["tipo_label"]
            tipo_badge = f'<span style="background:#e2e8f0; color:#334155; padding:2px 6px; border-radius:4px; font-size:10px; font-weight:600;">{tipo_label}</span>'
            qtd = item_data["qtd"]
            venda_unit = item_data["venda_unit"]
            total = item_data["total"]

            rows_html += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-mono; font-size: 11px; color: #64748b;">{codigo}</td>
                <td style="padding: 8px 12px; font-weight: 500;">{nome}</td>
                <td style="padding: 8px 12px; text-align: center;">{tipo_badge}</td>
                <td style="padding: 8px 12px; text-align: center;">{int(qtd) if qtd.is_integer() else f"{qtd:.2f}"}</td>
                <td style="padding: 8px 12px; text-align: right;">{format_currency(venda_unit)}</td>
                <td style="padding: 8px 12px; text-align: right; font-weight: 600;">{format_currency(total)}</td>
            </tr>
            """

    total_proposta = float(budget.valor_total or 0.0)
    if total_proposta == 0.0:
        total_proposta = sum(d["total"] for d in kits_map.values()) + sum(d["total"] for d in standalone_items)

    return f"""
    <table class="tabela-itens-analitica" style="width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px;">
        <thead>
            <tr style="background-color: #f8fafc; border-bottom: 2px solid #cbd5e1; text-align: left; color: #334155;">
                <th style="padding: 10px 12px;">Código</th>
                <th style="padding: 10px 12px;">Descrição do Item (Analítico)</th>
                <th style="padding: 10px 12px; text-align: center;">Tipo</th>
                <th style="padding: 10px 12px; text-align: center;">Qtd</th>
                <th style="padding: 10px 12px; text-align: right;">Val. Unitário</th>
                <th style="padding: 10px 12px; text-align: right;">Total</th>
            </tr>
        </thead>
        <tbody>
            {rows_html}
        </tbody>
        <tfoot>
            <tr style="background-color: #f1f5f9; font-weight: bold; border-top: 2px solid #cbd5e1;">
                <td colspan="5" style="padding: 10px 12px; text-align: right;">TOTAL DA PROPOSTA:</td>
                <td style="padding: 10px 12px; text-align: right; color: #0f172a; font-size: 13px;">{format_currency(total_proposta)}</td>
            </tr>
        </tfoot>
    </table>
    """


def build_commercial_conditions_summary(budget: SalesBudget) -> str:
    """Gera um bloco de resumo das condições comerciais (forma de pagamento, validade, frete e observações)."""
    forma_pag = budget.forma_pagamento.nome if budget.forma_pagamento else "A combinar"
    vencimento = budget.data_vencimento_inicial.strftime("%d/%m/%Y") if budget.data_vencimento_inicial else "A definir"
    obs = budget.observacoes or "Sem observações adicionais."

    return f"""
    <div class="resumo-condicoes-comerciais" style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 16px; margin: 15px 0; font-size: 12px;">
        <h4 style="margin-top: 0; margin-bottom: 8px; color: #0f172a; font-size: 13px;">Condições Comerciais & Pagamento</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 8px;">
            <div><strong>Forma de Pagamento:</strong> {forma_pag}</div>
            <div><strong>Validade da Proposta:</strong> {vencimento}</div>
        </div>
        <div style="margin-top: 6px; color: #475569;">
            <strong>Observações:</strong> {obs}
        </div>
    </div>
    """


VARIABLES_CATALOG = {
    "OPORTUNIDADE": [
        {"nome": "cliente_nome", "origem": "CLIENTE", "campo": "razao_social", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "cliente_cnpj", "origem": "CLIENTE", "campo": "cnpj", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "cliente_cidade", "origem": "CLIENTE", "campo": "cidade", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "cliente_estado", "origem": "CLIENTE", "campo": "estado", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "empresa_nome", "origem": "EMPRESA", "campo": "razao_social", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "empresa_cnpj", "origem": "EMPRESA", "campo": "cnpj", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "oportunidade_numero", "origem": "OPORTUNIDADE", "campo": "numero_orcamento", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "oportunidade_titulo", "origem": "OPORTUNIDADE", "campo": "titulo", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "vendedor_nome", "origem": "VENDEDOR", "campo": "nome", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "forma_pagamento_nome", "origem": "FORMA_PAGAMENTO", "campo": "nome", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "valor_total_produtos", "origem": "OPORTUNIDADE", "campo": "valor_total_produtos", "tipo": "MOEDA", "obrigatoria": False},
        {"nome": "valor_total_servicos", "origem": "OPORTUNIDADE", "campo": "valor_total_servicos", "tipo": "MOEDA", "obrigatoria": False},
        {"nome": "valor_total_proposta", "origem": "OPORTUNIDADE", "campo": "valor_total", "tipo": "MOEDA", "obrigatoria": False},
        {"nome": "valor_proposta", "origem": "OPORTUNIDADE", "campo": "valor_total", "tipo": "MOEDA", "obrigatoria": False},
        {"nome": "tabela_itens_sintetica", "origem": "OPORTUNIDADE", "campo": "tabela_sintetica", "tipo": "TABELA_HTML", "obrigatoria": False},
        {"nome": "tabela_itens_analitica", "origem": "OPORTUNIDADE", "campo": "tabela_analitica", "tipo": "TABELA_HTML", "obrigatoria": False},
        {"nome": "resumo_condicoes_comerciais", "origem": "OPORTUNIDADE", "campo": "condicoes_comerciais", "tipo": "BLOCO_HTML", "obrigatoria": False},
    ]
}


def validate_mandatory_variables(modulo_origem: str, conteudo_html: str):
    """Ensure all variables flagged as mandatory in the catalog for this origin are present in the HTML content."""
    catalog = VARIABLES_CATALOG.get(modulo_origem, [])
    for v in catalog:
        if v.get("obrigatoria", False):
            name = v.get("nome", "")
            token = f"{{{{{name}}}}}"
            if token not in conteudo_html:
                raise ValueError(f"A variável obrigatória '{name}' deve estar presente no conteúdo do documento.")


def list_templates(
    db: Session,
    tenant_id: str,
    company_id: str,
    status: Optional[str] = None,
    modulo: Optional[str] = None,
    tipo: Optional[str] = None
) -> List[DocumentTemplate]:
    query = db.query(DocumentTemplate).filter(
        DocumentTemplate.tenant_id == tenant_id,
        DocumentTemplate.company_id == company_id
    )
    if status:
        query = query.filter(DocumentTemplate.status == status)
    if modulo:
        query = query.filter(DocumentTemplate.modulo_origem == modulo)
    if tipo:
        query = query.filter(DocumentTemplate.tipo_documento == tipo)
        
    return query.order_by(DocumentTemplate.updated_at.desc(), DocumentTemplate.created_at.desc()).all()


def get_template(db: Session, tenant_id: str, company_id: str, template_id: str) -> Optional[DocumentTemplate]:
    return db.query(DocumentTemplate).filter(
        DocumentTemplate.id == template_id,
        DocumentTemplate.tenant_id == tenant_id,
        DocumentTemplate.company_id == company_id
    ).first()


def create_template(db: Session, tenant_id: str, company_id: str, data: TemplateCreate, user_id: str) -> DocumentTemplate:
    # 1. Validate mandatory variables
    validate_mandatory_variables(data.modulo_origem, data.conteudo_html)

    # 2. Create template in RASCUNHO status by default
    template = DocumentTemplate(
        tenant_id=tenant_id,
        company_id=company_id,
        papel_timbrado_id=data.papel_timbrado_id,
        nome=data.nome,
        tipo_documento=data.tipo_documento,
        modulo_origem=data.modulo_origem,
        status="RASCUNHO",
        versao=1,
        conteudo_html=data.conteudo_html,
        descricao=data.descricao
    )
    db.add(template)
    db.flush()

    # 3. Add variables from catalog
    catalog = VARIABLES_CATALOG.get(data.modulo_origem, [])
    for var_data in catalog:
        var = DocumentVariable(
            modelo_id=template.id,
            nome=var_data["nome"],
            origem=var_data["origem"],
            campo=var_data["campo"],
            tipo=var_data["tipo"],
            obrigatoria=var_data["obrigatoria"]
        )
        db.add(var)

    # 4. Audit trail
    audit = DocumentAudit(
        modelo_id=template.id,
        usuario_id=user_id,
        acao="CRIACAO"
    )
    db.add(audit)
    
    db.commit()
    db.refresh(template)
    return template


def update_template(db: Session, tenant_id: str, company_id: str, template_id: str, data: TemplateUpdate, user_id: str) -> Optional[DocumentTemplate]:
    template = get_template(db, tenant_id, company_id, template_id)
    if not template:
        return None

    # Allow editing active/vigente models
    if template.status == "INATIVO":
        raise ValueError("Documentos inativos não podem ser editados.")

    # Validate variables
    validate_mandatory_variables(data.modulo_origem, data.conteudo_html)

    # Update template values
    template.nome = data.nome
    template.tipo_documento = data.tipo_documento
    template.modulo_origem = data.modulo_origem
    template.conteudo_html = data.conteudo_html
    template.descricao = data.descricao
    template.papel_timbrado_id = data.papel_timbrado_id

    # Recreate variables from catalog
    db.query(DocumentVariable).filter(DocumentVariable.modelo_id == template.id).delete()
    catalog = VARIABLES_CATALOG.get(data.modulo_origem, [])
    for var_data in catalog:
        var = DocumentVariable(
            modelo_id=template.id,
            nome=var_data["nome"],
            origem=var_data["origem"],
            campo=var_data["campo"],
            tipo=var_data["tipo"],
            obrigatoria=var_data["obrigatoria"]
        )
        db.add(var)

    # Audit trail
    audit = DocumentAudit(
        modelo_id=template.id,
        usuario_id=user_id,
        acao="EDICAO"
    )
    db.add(audit)

    db.commit()
    db.refresh(template)
    return template


def duplicate_template(db: Session, tenant_id: str, company_id: str, template_id: str, user_id: str) -> Optional[DocumentTemplate]:
    original = get_template(db, tenant_id, company_id, template_id)
    if not original:
        return None

    # Increment version for the clone/new edition draft
    new_version_number = original.versao + 1

    clone = DocumentTemplate(
        tenant_id=tenant_id,
        company_id=company_id,
        nome=f"{original.nome} (Nova Versão)" if original.status == "VIGENTE" else f"{original.nome} (Cópia)",
        tipo_documento=original.tipo_documento,
        modulo_origem=original.modulo_origem,
        status="RASCUNHO",
        versao=new_version_number if original.status == "VIGENTE" else 1,
        conteudo_html=original.conteudo_html,
        descricao=original.descricao
    )
    db.add(clone)
    db.flush()

    # Duplicate variables
    for original_var in original.variables:
        var = DocumentVariable(
            modelo_id=clone.id,
            nome=original_var.nome,
            origem=original_var.origem,
            campo=original_var.campo,
            tipo=original_var.tipo,
            obrigatoria=original_var.obrigatoria
        )
        db.add(var)

    # Audit trail
    audit = DocumentAudit(
        modelo_id=clone.id,
        usuario_id=user_id,
        acao="DUPLICACAO"
    )
    db.add(audit)

    db.commit()
    db.refresh(clone)
    return clone


def publish_template(db: Session, tenant_id: str, company_id: str, template_id: str, user_id: str) -> Optional[DocumentTemplate]:
    template = get_template(db, tenant_id, company_id, template_id)
    if not template:
        return None

    # RN001 / RN004: Inactivate previous vigent versions of same type/origin
    previous_vigent = db.query(DocumentTemplate).filter(
        DocumentTemplate.tenant_id == tenant_id,
        DocumentTemplate.company_id == company_id,
        DocumentTemplate.tipo_documento == template.tipo_documento,
        DocumentTemplate.modulo_origem == template.modulo_origem,
        DocumentTemplate.status == "VIGENTE",
        DocumentTemplate.id != template.id
    ).all()

    for old_template in previous_vigent:
        old_template.status = "INATIVO"
        # Log audit for inactivation
        db.add(DocumentAudit(
            modelo_id=old_template.id,
            usuario_id=user_id,
            acao="INATIVACAO_AUTOMATICA"
        ))

    # Publish template
    template.status = "VIGENTE"

    # Save a static version snapshot
    version = DocumentVersion(
        modelo_id=template.id,
        versao=template.versao,
        conteudo_html=template.conteudo_html,
        usuario_id=user_id
    )
    db.add(version)

    # Audit log
    audit = DocumentAudit(
        modelo_id=template.id,
        usuario_id=user_id,
        acao="PUBLICACAO"
    )
    db.add(audit)

    db.commit()
    db.refresh(template)
    return template


def deactivate_template(db: Session, tenant_id: str, company_id: str, template_id: str, user_id: str) -> Optional[DocumentTemplate]:
    template = get_template(db, tenant_id, company_id, template_id)
    if not template:
        return None

    template.status = "INATIVO"

    audit = DocumentAudit(
        modelo_id=template.id,
        usuario_id=user_id,
        acao="INATIVACAO"
    )
    db.add(audit)

    db.commit()
    db.refresh(template)
    return template


def render_template(db: Session, tenant_id: str, company_id: str, template_id: str, request: DocumentRenderRequest, user_id: str) -> str:
    template = get_template(db, tenant_id, company_id, template_id)
    if not template:
        raise ValueError("Modelo de documento não encontrado.")

    # RN005: Documentos inativos não poderão ser utilizados
    if template.status == "INATIVO":
        raise ValueError("Documentos inativos não poderão ser utilizados.")

    html = template.conteudo_html

    # Fetch values based on modulo_origem and data
    replacements = {}
    if template.modulo_origem == "OPORTUNIDADE" and request.oportunidade_id:
        budget = db.query(SalesBudget).filter(
            SalesBudget.id == request.oportunidade_id,
            SalesBudget.tenant_id == tenant_id,
            SalesBudget.company_id == company_id
        ).first()
        if budget:
            cust = budget.customer
            cidade_nome = cust.city.nome if (cust and cust.city) else ""
            estado_sigla = (cust.state.sigla or cust.state.nome) if (cust and cust.state) else ""

            produtos_sum = sum(float(item.total_venda or 0) for item in budget.items if item.tipo_item == "MERCADORIA")
            servicos_sum = sum(float(item.total_venda or 0) for item in budget.items if item.tipo_item != "MERCADORIA")

            total_formatted = format_currency(budget.valor_total)
            produtos_formatted = format_currency(produtos_sum)
            servicos_formatted = format_currency(servicos_sum)

            tabela_sintetica_html = build_synthetic_items_table(budget)
            tabela_analitica_html = build_analytical_items_table(budget)
            resumo_condicoes_html = build_commercial_conditions_summary(budget)

            replacements = {
                "cliente_nome": cust.nome_fantasia or cust.razao_social if cust else "",
                "cliente_cnpj": cust.cnpj if cust else "",
                "cliente_cidade": cidade_nome,
                "cliente_estado": estado_sigla,
                "empresa_nome": budget.company.razao_social if budget.company else "",
                "empresa_cnpj": budget.company.cnpj if budget.company else "",
                "oportunidade_numero": budget.numero_orcamento or "",
                "oportunidade_titulo": budget.titulo or "",
                "vendedor_nome": budget.vendedor.name if (budget.vendedor and hasattr(budget.vendedor, 'name')) else "",
                "forma_pagamento_nome": budget.forma_pagamento.nome if budget.forma_pagamento else "",
                "valor_total_produtos": produtos_formatted,
                "valor_total_servicos": servicos_formatted,
                "valor_total_proposta": total_formatted,
                "valor_proposta": total_formatted,
                "tabela_itens_sintetica": tabela_sintetica_html,
                "tabela_itens_analitica": tabela_analitica_html,
                "resumo_condicoes_comerciais": resumo_condicoes_html,
            }

    # Perform replace for all variables & replacements keys
    for name, value in replacements.items():
        html = html.replace(f"{{{{{name}}}}}", str(value))

    for var in template.variables:
        name = var.nome
        if name not in replacements:
            html = html.replace(f"{{{{{name}}}}}", "")

    # Envelopar no Papel Timbrado se estiver vinculado e ativo
    body_content = f'<div class="document-body-container">{html}</div>'
    if template.letterhead and template.letterhead.is_active:
        lh_html = template.letterhead.conteudo_html or "{{document_content}}"
        lh_css = template.letterhead.conteudo_css or ""
        if "{{document_content}}" in lh_html:
            html = lh_html.replace("{{document_content}}", body_content)
        elif "{{conteudo_documento}}" in lh_html:
            html = lh_html.replace("{{conteudo_documento}}", body_content)
        elif "{{conteudo}}" in lh_html:
            html = lh_html.replace("{{conteudo}}", body_content)
        elif "{{content}}" in lh_html:
            html = lh_html.replace("{{content}}", body_content)
        else:
            html = f"{lh_html}\n{body_content}"

        full_css = f"{DEFAULT_BASE_CSS}\n{lh_css}" if lh_css and lh_css.strip() else DEFAULT_BASE_CSS
        html = f'<div class="has-letterhead">\n<style>{full_css}</style>\n{html}\n</div>'
    else:
        html = f"<style>{DEFAULT_BASE_CSS}</style>\n{body_content}"

    # Log audit
    audit = DocumentAudit(
        modelo_id=template.id,
        usuario_id=user_id,
        acao="GERACAO"
    )
    db.add(audit)
    db.commit()

    return html
