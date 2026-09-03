import re
from decimal import Decimal
from sqlalchemy.orm import Session, joinedload
from uuid import UUID
from typing import List, Optional, Tuple
from src.modules.document_templates.models import DocumentTemplate, DocumentVersion, DocumentVariable, DocumentAudit, Letterhead
from src.modules.document_templates.schemas import (
    TemplateCreate, TemplateUpdate, DocumentRenderRequest,
    LetterheadCreate, LetterheadUpdate, LetterheadPreviewRequest
)
from src.modules.sales_budgets.models import SalesBudget
from src.modules.customers.models import Customer
from src.modules.companies.models import Company, SalesTeam, SalesTeamMember
from src.modules.users.models import User
DEFAULT_BASE_CSS = """
@page {
    size: A4;
    margin: 10mm 15mm 10mm 15mm;
}
html, body {
    margin: 0;
    padding: 0;
    font-family: 'Inter', Arial, Helvetica, sans-serif;
    color: #0f172a;
    line-height: 1.5;
}
.has-letterhead,
.letterhead-wrapper {
    display: block;
    width: 100%;
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}
.letterhead-print-table {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    margin: 0;
    padding: 0;
    border: none !important;
}
.letterhead-print-table > thead {
    display: table-header-group;
}
.letterhead-print-table > tfoot {
    display: table-footer-group;
}
.letterhead-print-table > tbody > tr > td {
    padding: 0;
    border: none !important;
    vertical-align: top;
}
.letterhead-header-cell,
.letterhead-footer-cell {
    padding: 0;
    border: none !important;
}
.letterhead-body-cell {
    padding-top: 10px;
    padding-bottom: 15px;
}
.stelseg-document-header,
.document-header,
.header {
    width: 100%;
    margin: 0 0 15px 0;
    padding: 0 0 8px 0;
    border-bottom: 2px solid #0284c7;
    text-align: left;
}
.stelseg-header-logo,
.header-logo {
    display: block;
    width: auto;
    max-width: 280px;
    max-height: 55px;
    margin: 0;
    padding: 0;
}
.stelseg-document-footer,
.document-footer,
.footer {
    width: 100%;
    margin: 0;
    padding: 6px 0 0 0;
    border-top: 1px solid #94a3b8;
    color: #334155;
    font-size: 9px;
    line-height: 1.4;
    text-align: left;
}
.stelseg-footer-company,
.footer-company {
    margin: 0;
    padding: 0;
    color: #1e3a5f;
    font-weight: 700;
}
.document-body-container {
    box-sizing: border-box;
    display: block;
    width: 100%;
    word-wrap: break-word;
    overflow-wrap: break-word;
}
.document-body,
.stelseg-document-content {
    width: 100%;
    display: block;
}
p {
    margin-top: 0;
    margin-bottom: 0.5em;
}
img {
    max-width: 100%;
    height: auto;
}
table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 0.5em;
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
                    svc_nome = getattr(svc, "nome_servico", None) or getattr(svc, "nome", None) or sub.descricao_item
                    nm = prod.nome if prod else svc_nome
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
    forma_pag = getattr(budget.forma_pagamento, 'descricao', getattr(budget.forma_pagamento, 'nome', 'A combinar')) if budget.forma_pagamento else "A combinar"
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


def build_commercial_proposal_full(budget: SalesBudget, db: Session) -> dict:
    """Gera todas as seções conceituais da Proposta Comercial da Oportunidade:
    1. Venda de Produtos (Kits de Venda com PRD, Nome, Qtd, Unitário, Total + Subtotal do Kit + Total Geral)
    2. Instalação (Kits de Instalação com Kit, Qtd, Unitário, Total + Total Geral)
    3. Comodato / Locação (Kits com Mensalidade, Qtd de Meses, Lista de Produtos sem preços individuais + Total Mensal)
    4. Resumo Geral da Proposta (Venda R$, Instalação R$, Mensalidade R$/mês)
    5. Assinaturas (Vendedor e Cliente)
    
    Retorna um dicionário contendo o HTML consolidado e as seções individuais.
    """
    from src.modules.opportunity_kits.models import OpportunityKit
    from src.modules.opportunity_kits.service import OpportunityKitService

    kit_service = OpportunityKitService(db)
    kits = db.query(OpportunityKit).filter_by(sales_budget_id=budget.id).all() if budget else []

    # 1. Agrupar por modalidade de contrato
    venda_kits = [k for k in kits if k.tipo_contrato == "VENDA_EQUIPAMENTOS"]
    instalacao_kits = [k for k in kits if k.tipo_contrato == "INSTALACAO"]
    locacao_kits = [k for k in kits if k.tipo_contrato in ("COMODATO", "LOCACAO")]

    # Verificar itens avulsos de venda (sem kit vinculado)
    standalone_venda_items = [item for item in (budget.items or []) if not item.opportunity_kit_id]

    has_venda = bool(venda_kits or standalone_venda_items)
    has_instalacao = bool(instalacao_kits)
    has_locacao = bool(locacao_kits)

    # ── SEÇÃO 1: VENDA DE PRODUTOS ──
    venda_html = ""
    total_venda_geral = 0.0

    if has_venda:
        venda_tables = ""
        
        # Kits de Venda
        for k in venda_kits:
            try:
                fin = kit_service.calculate_financials(k, tenant_id=budget.tenant_id, sales_budget_id=str(budget.id))
                s = fin.get("summary", {})
                item_summaries = fin.get("item_summaries", [])
            except Exception:
                fin, s, item_summaries = {}, {}, []

            b_item = next((it for it in (budget.items or []) if str(it.opportunity_kit_id) == str(k.id)), None)
            qtd_kit = float(b_item.quantidade if b_item and b_item.quantidade is not None else (k.quantidade_kits or 1))
            
            tot_kit = float(b_item.total_venda if b_item and b_item.total_venda is not None else (s.get("venda_equipamentos_total") or 0.0))
            if tot_kit == 0.0 and getattr(k, 'venda_total', None):
                tot_kit = float(k.venda_total) * qtd_kit
            
            total_venda_geral += tot_kit

            # Map item_summaries by product_id / item id
            summary_by_prod = {}
            for summ in item_summaries:
                if summ.get("id"):
                    summary_by_prod[str(summ["id"])] = summ
                if summ.get("product_id"):
                    summary_by_prod[str(summ["product_id"])] = summ

            rows_items = ""
            for it in k.items:
                prod = it.product
                cod = prod.codigo if prod else "-"
                nm = prod.nome if prod else (it.descricao_item or "Produto")
                
                summ = summary_by_prod.get(str(it.id)) or (summary_by_prod.get(str(it.product_id)) if it.product_id else None)
                if summ:
                    qtd_item = float(summ.get("quantidade_no_kit", it.quantidade_no_kit or 1.0)) * qtd_kit
                    unit_venda = float(summ.get("venda_unitario_item", 0.0))
                    tot_venda = float(summ.get("venda_total_item", unit_venda * qtd_item))
                else:
                    qtd_item = float(it.quantidade_no_kit or 1.0) * qtd_kit
                    unit_venda = 0.0
                    tot_venda = 0.0

                rows_items += f"""
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 7px 10px; font-family: monospace; font-size: 11px; font-weight: 600; color: #475569;">{cod}</td>
                    <td style="padding: 7px 10px; color: #1e293b;">{nm}</td>
                    <td style="padding: 7px 10px; text-align: center; color: #334155;">{int(qtd_item) if qtd_item.is_integer() else f'{qtd_item:.2f}'}</td>
                    <td style="padding: 7px 10px; text-align: right; color: #334155;">{format_currency(unit_venda)}</td>
                    <td style="padding: 7px 10px; text-align: right; font-weight: 600; color: #0f172a;">{format_currency(tot_venda)}</td>
                </tr>
                """

            venda_tables += f"""
            <div class="proposal-kit-block" style="margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                <div style="background-color: #0f172a; color: #ffffff; padding: 6px 12px; font-size: 11.5px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                    <span>📦 KIT: {k.nome_kit}</span>
                    <span style="font-size: 11px; opacity: 0.85;">Qtd: {int(qtd_kit) if qtd_kit.is_integer() else f'{qtd_kit:.2f}'}</span>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; color: #334155; text-align: left;">
                            <th style="padding: 6px 10px; width: 14%;">PRD</th>
                            <th style="padding: 6px 10px;">Nome do Produto</th>
                            <th style="padding: 6px 10px; text-align: center; width: 10%;">Qtd</th>
                            <th style="padding: 6px 10px; text-align: right; width: 18%;">Valor Unitário</th>
                            <th style="padding: 6px 10px; text-align: right; width: 18%;">Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows_items}
                    </tbody>
                    <tfoot>
                        <tr style="background-color: #f8fafc; border-top: 1px solid #cbd5e1; font-weight: 700;">
                            <td colspan="4" style="padding: 6px 10px; text-align: right; color: #334155; font-size: 11px;">TOTAL DO KIT:</td>
                            <td style="padding: 6px 10px; text-align: right; color: #0f172a; font-size: 11.5px;">{format_currency(tot_kit)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            """

        # Itens Avulsos de Venda
        if standalone_venda_items:
            tot_avulso = 0.0
            rows_avulso = ""
            for it in standalone_venda_items:
                cod = it.product.codigo if it.product else "-"
                nm = it.product.nome if it.product else (it.descricao_servico or "Item Avulso")
                qtd = float(it.quantidade or 1)
                unit_venda = float(it.venda_unit or 0)
                tot = float(it.total_venda or (unit_venda * qtd))
                tot_avulso += tot

                rows_avulso += f"""
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 10px; font-family: monospace; font-size: 11px; font-weight: 600; color: #475569;">{cod}</td>
                    <td style="padding: 6px 10px; color: #1e293b;">{nm}</td>
                    <td style="padding: 6px 10px; text-align: center; color: #334155;">{int(qtd) if qtd.is_integer() else f'{qtd:.2f}'}</td>
                    <td style="padding: 6px 10px; text-align: right; color: #334155;">{format_currency(unit_venda)}</td>
                    <td style="padding: 6px 10px; text-align: right; font-weight: 600; color: #0f172a;">{format_currency(tot)}</td>
                </tr>
                """
            total_venda_geral += tot_avulso

            venda_tables += f"""
            <div class="proposal-kit-block" style="margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                <div style="background-color: #334155; color: #ffffff; padding: 6px 12px; font-size: 11.5px; font-weight: 700;">
                    Itens Avulsos da Proposta
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; color: #334155; text-align: left;">
                            <th style="padding: 6px 10px; width: 14%;">PRD</th>
                            <th style="padding: 6px 10px;">Nome do Produto</th>
                            <th style="padding: 6px 10px; text-align: center; width: 10%;">Qtd</th>
                            <th style="padding: 6px 10px; text-align: right; width: 18%;">Valor Unitário</th>
                            <th style="padding: 6px 10px; text-align: right; width: 18%;">Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows_avulso}
                    </tbody>
                    <tfoot>
                        <tr style="background-color: #f8fafc; border-top: 1px solid #cbd5e1; font-weight: 700;">
                            <td colspan="4" style="padding: 6px 10px; text-align: right; color: #334155; font-size: 11px;">TOTAL ITENS AVULSOS:</td>
                            <td style="padding: 6px 10px; text-align: right; color: #0f172a; font-size: 11.5px;">{format_currency(tot_avulso)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
            """

        venda_html = f"""
        <div class="section-venda-produtos" style="margin-bottom: 14px;">
            <div style="border-bottom: 2px solid #0f172a; padding-bottom: 3px; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">1. Venda de Produtos</h3>
            </div>
            {venda_tables}
            <div style="text-align: right; font-size: 12px; font-weight: 800; color: #0f172a; padding: 6px 10px; background-color: #e2e8f0; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 4px;">
                TOTAL DE VENDA DE PRODUTOS: {format_currency(total_venda_geral)}
            </div>
        </div>
        """

    # ── SEÇÃO 2: INSTALAÇÃO ──
    instalacao_html = ""
    total_instalacao_geral = 0.0

    if has_instalacao:
        rows_inst = ""
        for k in instalacao_kits:
            try:
                fin = kit_service.calculate_financials(k, tenant_id=budget.tenant_id, sales_budget_id=str(budget.id))
                s = fin.get("summary", {})
            except Exception:
                fin, s = {}, {}

            b_item = next((it for it in (budget.items or []) if str(it.opportunity_kit_id) == str(k.id)), None)
            qtd_inst = float(b_item.quantidade if b_item and b_item.quantidade is not None else (k.quantidade_kits or 1))
            unit_inst = float(b_item.venda_unit if b_item and b_item.venda_unit is not None else (s.get("valor_mensal_kit") or s.get("venda_equipamentos_total") or s.get("valor_base_final") or 0.0))
            if unit_inst == 0.0 and getattr(k, 'venda_unitario', None):
                unit_inst = float(k.venda_unitario)
            
            tot_inst = float(b_item.total_venda if b_item and b_item.total_venda is not None else (unit_inst * qtd_inst))
            total_instalacao_geral += tot_inst

            rows_inst += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 10px; font-weight: 600; color: #1e293b;">{k.nome_kit}</td>
                <td style="padding: 7px 10px; text-align: center; color: #334155;">{int(qtd_inst) if qtd_inst.is_integer() else f'{qtd_inst:.2f}'}</td>
                <td style="padding: 7px 10px; text-align: right; color: #334155;">{format_currency(unit_inst)}</td>
                <td style="padding: 7px 10px; text-align: right; font-weight: 600; color: #0f172a;">{format_currency(tot_inst)}</td>
            </tr>
            """

        instalacao_html = f"""
        <div class="section-instalacao" style="margin-bottom: 14px;">
            <div style="border-bottom: 2px solid #0f172a; padding-bottom: 3px; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">2. Instalação</h3>
            </div>
            <div style="border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; margin-bottom: 4px; page-break-inside: avoid; break-inside: avoid;">
                <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; color: #334155; text-align: left;">
                            <th style="padding: 6px 10px;">Kit</th>
                            <th style="padding: 6px 10px; text-align: center; width: 14%;">Quantidade</th>
                            <th style="padding: 6px 10px; text-align: right; width: 22%;">Valor Unitário</th>
                            <th style="padding: 6px 10px; text-align: right; width: 22%;">Valor Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows_inst}
                    </tbody>
                    <tfoot>
                        <tr style="background-color: #f8fafc; border-top: 1px solid #cbd5e1; font-weight: 700;">
                            <td colspan="3" style="padding: 6px 10px; text-align: right; color: #334155;">TOTAL DE INSTALAÇÃO:</td>
                            <td style="padding: 6px 10px; text-align: right; color: #0f172a; font-size: 11.5px;">{format_currency(total_instalacao_geral)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
        """

    # ── SEÇÃO 3: COMODATO / LOCAÇÃO ──
    locacao_html = ""
    total_locacao_mensal = 0.0

    if has_locacao:
        locacao_blocks = ""
        for k in locacao_kits:
            try:
                fin = kit_service.calculate_financials(k, tenant_id=budget.tenant_id, sales_budget_id=str(budget.id))
                s = fin.get("summary", {})
            except Exception:
                fin, s = {}, {}

            rental_item = next((rit for rit in (budget.rental_items or []) if str(rit.opportunity_kit_id) == str(k.id)), None)
            qtd_kit = float(rental_item.quantidade if rental_item and rental_item.quantidade is not None else (k.quantidade_kits or 1))
            
            mensal_unit = float(rental_item.kit_valor_mensal or rental_item.valor_mensal if rental_item and (rental_item.kit_valor_mensal or rental_item.valor_mensal) is not None else (s.get("valor_mensal_antes_impostos") or s.get("valor_mensal_kit") or 0.0))
            if mensal_unit == 0.0 and getattr(k, 'custo_total', None):
                mensal_unit = float(k.custo_total)

            mensal_tot = mensal_unit * qtd_kit
            total_locacao_mensal += mensal_tot
            meses_contrato = k.prazo_contrato_meses or budget.prazo_contrato_meses or 36

            rows_items = ""
            # 1. Itens do Bloco 4 (Produtos e Serviços vinculados ao kit)
            for it in (k.items or []):
                prod = it.product
                cod = prod.codigo if prod else "SERV"
                nm = prod.nome if prod else (getattr(it.own_service, 'nome_servico', None) or it.descricao_item or "Item do Kit")
                q = float(it.quantidade_no_kit or 1) * qtd_kit

                rows_items += f"""
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 6px 10px; font-family: monospace; font-size: 11px; font-weight: 600; color: #475569;">{cod}</td>
                    <td style="padding: 6px 10px; color: #1e293b;">{nm}</td>
                    <td style="padding: 6px 10px; text-align: center; color: #334155;">{int(q) if q.is_integer() else f'{q:.2f}'}</td>
                </tr>
                """

            # 2. Custos Operacionais Mensais do Bloco 6 (Serviços e custos operacionais mensais do kit)
            for c in (k.costs or []):
                if c.tipo_custo != "INSTALACAO":
                    prod = c.product
                    cod = prod.codigo if prod else "SERV"
                    nm = prod.nome if prod else (getattr(c.own_service, 'nome_servico', None) or c.descricao_item or "Serviço Operacional")
                    q = float(c.quantidade or 1) * qtd_kit

                    rows_items += f"""
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px 10px; font-family: monospace; font-size: 11px; font-weight: 600; color: #475569;">{cod}</td>
                        <td style="padding: 6px 10px; color: #1e293b;">{nm}</td>
                        <td style="padding: 6px 10px; text-align: center; color: #334155;">{int(q) if q.is_integer() else f'{q:.2f}'}</td>
                    </tr>
                    """

            if hasattr(k, 'monthly_costs') and k.monthly_costs:
                for mc in k.monthly_costs:
                    cod = "SERV"
                    nm = mc.servico or "Custo Mensal"
                    q = float(mc.quantidade or 1) * qtd_kit

                    rows_items += f"""
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px 10px; font-family: monospace; font-size: 11px; font-weight: 600; color: #475569;">{cod}</td>
                        <td style="padding: 6px 10px; color: #1e293b;">{nm}</td>
                        <td style="padding: 6px 10px; text-align: center; color: #334155;">{int(q) if q.is_integer() else f'{q:.2f}'}</td>
                    </tr>
                    """

            locacao_blocks += f"""
            <div class="proposal-kit-block" style="margin-bottom: 10px; page-break-inside: avoid; break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
                <div style="background-color: #0f172a; color: #ffffff; padding: 6px 12px; font-size: 11.5px; font-weight: 700; display: flex; justify-content: space-between; align-items: center;">
                    <span>📦 KIT: {k.nome_kit}</span>
                    <span style="font-size: 11px; opacity: 0.9;">Qtd: {int(qtd_kit) if qtd_kit.is_integer() else f'{qtd_kit:.2f}'}</span>
                </div>
                <div style="background-color: #f8fafc; border-bottom: 1px solid #cbd5e1; padding: 6px 12px; display: flex; justify-content: space-between; font-size: 11.5px; color: #334155;">
                    <div><strong>Mensalidade:</strong> <span style="color: #0f172a; font-weight: 700;">{format_currency(mensal_tot)}/mês</span></div>
                    <div><strong>Quantidade de Meses:</strong> <span style="color: #0f172a; font-weight: 700;">{meses_contrato} meses</span></div>
                </div>
                <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
                    <thead>
                        <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; color: #334155; text-align: left;">
                            <th style="padding: 5px 10px; width: 18%;">PRD</th>
                            <th style="padding: 5px 10px;">Nome do Produto / Serviço</th>
                            <th style="padding: 5px 10px; text-align: center; width: 14%;">Quantidade</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows_items}
                    </tbody>
                </table>
            </div>
            """

        locacao_html = f"""
        <div class="section-comodato-locacao" style="margin-bottom: 14px;">
            <div style="border-bottom: 2px solid #0f172a; padding-bottom: 3px; margin-bottom: 8px;">
                <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">3. Comodato / Locação</h3>
            </div>
            {locacao_blocks}
            <div style="text-align: right; font-size: 12px; font-weight: 800; color: #0f172a; padding: 6px 10px; background-color: #e2e8f0; border-radius: 4px; border: 1px solid #cbd5e1; margin-top: 4px;">
                TOTAL MENSAL COMODATO / LOCAÇÃO: {format_currency(total_locacao_mensal)}/mês
            </div>
        </div>
        """

    # ── DADOS DE CLIENTE, VENDEDOR E ASSINATURAS ──
    vendedor_str = budget.vendedor.name if (budget.vendedor and hasattr(budget.vendedor, 'name')) else ""
    if not vendedor_str and budget.responsaveis:
        vendedor_str = budget.responsaveis[0].user.name if budget.responsaveis[0].user else ""
    if not vendedor_str:
        vendedor_str = "Consultor Comercial"

    cliente_str = budget.customer.razao_social if budget.customer else (budget.customer.nome_fantasia if budget.customer else "Cliente")

    assinaturas_html = f"""
    <div class="proposal-signatures-block" style="margin-top: 24px; padding-top: 10px; page-break-inside: avoid; break-inside: avoid;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center;">
            <div>
                <div style="border-top: 1.5px solid #0f172a; margin-bottom: 6px; width: 85%; margin-left: auto; margin-right: auto;"></div>
                <div style="font-size: 11.5px; font-weight: 700; color: #0f172a;">{vendedor_str}</div>
                <div style="font-size: 10.5px; color: #64748b;">Consultor Comercial / Vendedor</div>
            </div>
            <div>
                <div style="border-top: 1.5px solid #0f172a; margin-bottom: 6px; width: 85%; margin-left: auto; margin-right: auto;"></div>
                <div style="font-size: 11.5px; font-weight: 700; color: #0f172a;">{cliente_str}</div>
                <div style="font-size: 10.5px; color: #64748b;">Cliente / De Acordo</div>
            </div>
        </div>
    </div>
    """

    # ── CABEÇALHO PADRONIZADO DA PROPOSTA ──
    cust = budget.customer
    cidade_nome = cust.city.nome if (cust and cust.city) else ""
    estado_sigla = (cust.state.sigla or cust.state.nome) if (cust and cust.state) else ""
    cidade_uf_str = f"{cidade_nome} / {estado_sigla}" if (cidade_nome and estado_sigla) else (cidade_nome or estado_sigla)

    data_emissao_str = budget.data_orcamento.strftime("%d/%m/%Y") if budget.data_orcamento else datetime.now().strftime("%d/%m/%Y")
    data_validade_str = budget.data_vencimento_inicial.strftime("%d/%m/%Y") if budget.data_vencimento_inicial else "15 dias"

    forma_pag_str = ""
    if budget.forma_pagamento and budget.forma_pagamento.descricao:
        forma_pag_str = budget.forma_pagamento.descricao
    elif budget.forma_pagamento_snapshot and isinstance(budget.forma_pagamento_snapshot, dict):
        forma_pag_str = budget.forma_pagamento_snapshot.get("descricao", "")
    if not forma_pag_str:
        forma_pag_str = "A Combinar / Padrão"

    header_html = f"""
    <div class="proposal-header-block" style="border-bottom: 2px solid #0f172a; padding-bottom: 8px; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px;">PROPOSTA COMERCIAL</h2>
                <div style="font-size: 12.5px; font-weight: 700; color: #475569; margin-top: 2px;">Oportunidade nº {budget.numero_orcamento or ''}</div>
            </div>
            <div style="text-align: right; font-size: 11px; color: #64748b; line-height: 1.4;">
                <div><strong>Data:</strong> {data_emissao_str}</div>
                <div><strong>Validade:</strong> {data_validade_str}</div>
            </div>
        </div>
        <div style="margin-top: 10px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; font-size: 11px; line-height: 1.5;">
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px;">
                <div><strong>Cliente:</strong> {cliente_str}</div>
                <div><strong>CNPJ:</strong> {cust.cnpj if cust else ''}</div>
            </div>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-top: 2px;">
                <div><strong>Cidade/UF:</strong> {cidade_uf_str}</div>
                <div><strong>Consultor / Vendedor:</strong> {vendedor_str}</div>
            </div>
            <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; margin-top: 2px; border-top: 1px dashed #cbd5e1; padding-top: 3px;">
                <div><strong>Forma de Pagamento:</strong> {forma_pag_str}</div>
                <div><strong>Validade da Proposta:</strong> {data_validade_str}</div>
            </div>
        </div>
    </div>
    """

    # ── RESUMO GERAL DA PROPOSTA / DEMONSTRATIVO DE VALORES ──
    total_unico = total_venda_geral + total_instalacao_geral
    has_unico = bool(has_venda or has_instalacao)
    prazo_contrato = budget.prazo_contrato_meses or 36
    if locacao_kits and locacao_kits[0].prazo_contrato_meses:
        prazo_contrato = locacao_kits[0].prazo_contrato_meses
    total_contrato_locacao = total_locacao_mensal * prazo_contrato

    tabelas_demonstrativo = ""

    # 1. Tabela Demonstrativo de Valores Únicos (Venda + Instalação)
    if has_unico:
        rows_unico = ""
        if has_venda:
            rows_unico += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 10px; color: #1e293b;">Venda de Equipamentos / Produtos</td>
                <td style="padding: 7px 10px; text-align: center; color: #475569;">Pagamento Único</td>
                <td style="padding: 7px 10px; text-align: right; font-weight: 600; color: #0f172a;">{format_currency(total_venda_geral)}</td>
            </tr>
            """
        if has_instalacao:
            rows_unico += f"""
            <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 7px 10px; color: #1e293b;">Serviços de Instalação e Configuração</td>
                <td style="padding: 7px 10px; text-align: center; color: #475569;">Pagamento Único</td>
                <td style="padding: 7px 10px; text-align: right; font-weight: 600; color: #0f172a;">{format_currency(total_instalacao_geral)}</td>
            </tr>
            """

        parcelas_info = ""
        fp = budget.forma_pagamento
        fp_snap = budget.forma_pagamento_snapshot
        
        rules = []
        tipo_dist = "RATEIO_IGUAL"
        taxa_juros = Decimal('0')
        forma_nome = forma_pag_str

        if fp and fp.parcelas:
            rules = [
                {
                    "intervalo_dias": p.intervalo_dias,
                    "percentual": float(p.percentual) if p.percentual is not None else None,
                    "valor_fixo": float(p.valor_fixo) if p.valor_fixo is not None else None
                }
                for p in fp.parcelas
            ]
            tipo_dist = fp.tipo_distribuicao
            taxa_juros = Decimal(str(fp.taxa_juros_mensal or 0))
            forma_nome = fp.descricao
        elif fp_snap and fp_snap.get("parcelas"):
            rules = fp_snap.get("parcelas") or []
            tipo_dist = fp_snap.get("tipo_distribuicao") or "RATEIO_IGUAL"
            taxa_juros = Decimal(str(fp_snap.get("taxa_juros_mensal") or 0))
            forma_nome = fp_snap.get("descricao") or forma_pag_str

        if rules and Decimal(str(total_unico)) > Decimal('0'):
            from src.modules.payment_methods.service import PaymentMethodsService
            calc = PaymentMethodsService.calculate_installments_schedule(
                valor_total=Decimal(str(total_unico)),
                parcelas_rules=rules,
                tipo_distribuicao=tipo_dist,
                taxa_juros_mensal=taxa_juros
            )
            qtd_p = len(rules)
            pmt = calc["pmt"]
            total_geral = calc["total_geral"]
            total_juros = calc["total_juros"]

            if total_juros > Decimal('0'):
                parcelas_info = (
                    f"<div style='font-size: 11px; color: #334155; line-height: 1.5;'>"
                    f"<strong>Condição de Pagamento:</strong> {forma_nome}<br />"
                    f"<span style='font-size: 12px; font-weight: 700; color: #0f172a;'>{qtd_p}x de {format_currency(pmt)}</span> "
                    f"<span style='color: #475569;'>(Total a Prazo: <strong>{format_currency(total_geral)}</strong> | Acréscimo de Juros: <strong>+{format_currency(total_juros)}</strong>)</span>"
                    f"</div>"
                )
            elif qtd_p > 1:
                parcelas_info = (
                    f"<div style='font-size: 11px; color: #334155;'>"
                    f"<strong>Condição de Pagamento:</strong> {qtd_p}x de {format_currency(pmt)} ({forma_nome})"
                    f"</div>"
                )
            else:
                parcelas_info = f"<div style='font-size: 11px; color: #334155;'><strong>Condição de Pagamento:</strong> {forma_nome}</div>"

        tabelas_demonstrativo += f"""
        <div style="margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
            <div style="background-color: #0f172a; color: #ffffff; padding: 6px 12px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Demonstrativo de Valores — Pagamento Único (Venda / Instalação)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
                <thead>
                    <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; color: #334155; text-align: left;">
                        <th style="padding: 5px 10px;">Descrição</th>
                        <th style="padding: 5px 10px; text-align: center; width: 22%;">Modalidade</th>
                        <th style="padding: 5px 10px; text-align: right; width: 24%;">Valor Total</th>
                    </tr>
                </thead>
                <tbody>
                    {rows_unico}
                </tbody>
                <tfoot>
                    <tr style="background-color: #f8fafc; border-top: 1px solid #cbd5e1; font-weight: 700;">
                        <td colspan="2" style="padding: 6px 10px; text-align: right; color: #334155;">TOTAL DE INVESTIMENTO (VALOR ÚNICO):</td>
                        <td style="padding: 6px 10px; text-align: right; color: #0f172a; font-size: 12px;">{format_currency(total_unico)}</td>
                    </tr>
                </tfoot>
            </table>
            {f"<div style='padding: 5px 10px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0;'>{parcelas_info}</div>" if parcelas_info else ""}
        </div>
        """

    # 2. Tabela Demonstrativo de Valores Recorrentes (Comodato / Locação)
    if has_locacao:
        tabelas_demonstrativo += f"""
        <div style="margin-bottom: 10px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; page-break-inside: avoid; break-inside: avoid;">
            <div style="background-color: #0f172a; color: #ffffff; padding: 6px 12px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                Demonstrativo de Valores — Comodato / Locação (Mensal Recorrente)
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
                <thead>
                    <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1; color: #334155; text-align: left;">
                        <th style="padding: 5px 10px;">Descrição</th>
                        <th style="padding: 5px 10px; text-align: center; width: 22%;">Quantidade de Meses</th>
                        <th style="padding: 5px 10px; text-align: right; width: 24%;">Valor Mensal</th>
                    </tr>
                </thead>
                <tbody>
                    <tr style="border-bottom: 1px solid #e2e8f0;">
                        <td style="padding: 6px 10px; color: #1e293b;">Serviços e Equipamentos em Comodato / Locação</td>
                        <td style="padding: 6px 10px; text-align: center; font-weight: 600; color: #0f172a;">{prazo_contrato} meses</td>
                        <td style="padding: 6px 10px; text-align: right; font-weight: 600; color: #0f172a;">{format_currency(total_locacao_mensal)}/mês</td>
                    </tr>
                </tbody>
                <tfoot>
                    <tr style="background-color: #f8fafc; border-top: 1px solid #cbd5e1; font-weight: 700;">
                        <td colspan="2" style="padding: 6px 10px; text-align: right; color: #334155;">TOTAL MENSAL RECORRENTE:</td>
                        <td style="padding: 6px 10px; text-align: right; color: #0f172a; font-size: 12px;">{format_currency(total_locacao_mensal)}/mês</td>
                    </tr>
                </tfoot>
            </table>
            <div style="padding: 5px 10px; background-color: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 11px; color: #475569;">
                <strong>Período Contratual:</strong> {prazo_contrato} meses
            </div>
        </div>
        """

    resumo_html = f"""
    <div class="proposal-summary-block" style="margin-top: 14px; margin-bottom: 14px;">
        <div style="border-bottom: 2px solid #0f172a; padding-bottom: 3px; margin-bottom: 8px;">
            <h3 style="margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px;">Resumo Geral da Proposta</h3>
        </div>
        {tabelas_demonstrativo}
    </div>
    """

    # ── SEÇÃO DE OBSERVAÇÕES ──
    obs_custom = budget.observacoes.strip() if (budget.observacoes and budget.observacoes.strip()) else ""

    observacoes_html = f"""
    <div class="proposal-observations-block" style="margin-top: 14px; margin-bottom: 14px; page-break-inside: avoid; break-inside: avoid; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden;">
        <div style="background-color: #0f172a; color: #ffffff; padding: 6px 12px; font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
            Observações
        </div>
        <div style="padding: 10px 12px; background-color: #f8fafc; font-size: 11px; color: #334155; line-height: 1.5;">
            <div style="margin-bottom: 6px;">
                <strong>1.</strong> Toda a venda de material e comodato de equipamentos será feito o faturamento pelo CNPJ: <strong>00.950.381/0001-00 Stelmat Teleinformática LTDA</strong>.
            </div>
            <div>
                <strong>2.</strong> Todo o serviço de monitoramento e serviços táticos serão faturados pelo CNPJ: <strong>43.294.119/0001-27 | Stelseg Tecnologia em Monitoramento e Segurança Eletrônica LTDA</strong>.
            </div>
            {f'<div style="margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; color: #475569;"><strong>3. Informações Complementares:</strong> {obs_custom}</div>' if obs_custom else ''}
        </div>
    </div>
    """

    # ── CONSOLIDADO COMPLETO DA PROPOSTA ──
    consolidated_body = ""
    if not (has_venda or has_instalacao or has_locacao):
        consolidated_body = f"""
        {header_html}
        <div style="padding: 24px; text-align: center; color: #64748b; font-size: 13px; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 6px;">
            Nenhum item comercial cadastrado nesta oportunidade.
        </div>
        """
    else:
        consolidated_body = f"""
        {header_html}
        {venda_html}
        {instalacao_html}
        {locacao_html}
        {resumo_html}
        {observacoes_html}
        {assinaturas_html}
        """

    return {
        "header_html": header_html,
        "venda_html": venda_html,
        "instalacao_html": instalacao_html,
        "locacao_html": locacao_html,
        "resumo_html": resumo_html,
        "observacoes_html": observacoes_html,
        "assinaturas_html": assinaturas_html,
        "proposta_completa_html": consolidated_body,
        "total_venda": total_venda_geral,
        "total_instalacao": total_instalacao_geral,
        "total_locacao_mensal": total_locacao_mensal,
        "has_venda": has_venda,
        "has_instalacao": has_instalacao,
        "has_locacao": has_locacao,
    }


VARIABLES_CATALOG = {
    "OPORTUNIDADE": [
        {"nome": "proposta_comercial", "origem": "OPORTUNIDADE", "campo": "proposta_completa", "tipo": "BLOCO_HTML", "obrigatoria": False},
        {"nome": "proposta_comercial_completa", "origem": "OPORTUNIDADE", "campo": "proposta_completa", "tipo": "BLOCO_HTML", "obrigatoria": False},
        {"nome": "secao_venda_produtos", "origem": "OPORTUNIDADE", "campo": "secao_venda", "tipo": "BLOCO_HTML", "obrigatoria": False},
        {"nome": "secao_instalacao", "origem": "OPORTUNIDADE", "campo": "secao_instalacao", "tipo": "BLOCO_HTML", "obrigatoria": False},
        {"nome": "secao_comodato_locacao", "origem": "OPORTUNIDADE", "campo": "secao_locacao", "tipo": "BLOCO_HTML", "obrigatoria": False},
        {"nome": "resumo_proposta", "origem": "OPORTUNIDADE", "campo": "resumo_proposta", "tipo": "BLOCO_HTML", "obrigatoria": False},
        {"nome": "observacoes_proposta", "origem": "OPORTUNIDADE", "campo": "observacoes_proposta", "tipo": "BLOCO_HTML", "obrigatoria": False},
        {"nome": "bloco_assinaturas", "origem": "OPORTUNIDADE", "campo": "bloco_assinaturas", "tipo": "BLOCO_HTML", "obrigatoria": False},
        {"nome": "cliente_nome", "origem": "CLIENTE", "campo": "razao_social", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "cliente_cnpj", "origem": "CLIENTE", "campo": "cnpj", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "cliente_cidade", "origem": "CLIENTE", "campo": "cidade", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "cliente_estado", "origem": "CLIENTE", "campo": "estado", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "cliente_cidade_uf", "origem": "CLIENTE", "campo": "cidade_uf", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "empresa_nome", "origem": "EMPRESA", "campo": "razao_social", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "empresa_cnpj", "origem": "EMPRESA", "campo": "cnpj", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "oportunidade_numero", "origem": "OPORTUNIDADE", "campo": "numero_orcamento", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "oportunidade_titulo", "origem": "OPORTUNIDADE", "campo": "titulo", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "vendedor_nome", "origem": "VENDEDOR", "campo": "nome", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "data_emissao", "origem": "OPORTUNIDADE", "campo": "data_orcamento", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "data_validade", "origem": "OPORTUNIDADE", "campo": "data_vencimento_inicial", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "forma_pagamento_nome", "origem": "FORMA_PAGAMENTO", "campo": "nome", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "valor_total_produtos", "origem": "OPORTUNIDADE", "campo": "valor_total_produtos", "tipo": "MOEDA", "obrigatoria": False},
        {"nome": "valor_total_servicos", "origem": "OPORTUNIDADE", "campo": "valor_total_servicos", "tipo": "MOEDA", "obrigatoria": False},
        {"nome": "valor_total_venda", "origem": "OPORTUNIDADE", "campo": "total_venda", "tipo": "MOEDA", "obrigatoria": False},
        {"nome": "valor_total_instalacao", "origem": "OPORTUNIDADE", "campo": "total_instalacao", "tipo": "MOEDA", "obrigatoria": False},
        {"nome": "valor_mensal_locacao", "origem": "OPORTUNIDADE", "campo": "total_locacao_mensal", "tipo": "MOEDA", "obrigatoria": False},
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
            cidade_uf_str = f"{cidade_nome} / {estado_sigla}" if (cidade_nome and estado_sigla) else (cidade_nome or estado_sigla)

            produtos_sum = sum(float(item.total_venda or 0) for item in budget.items if item.tipo_item == "MERCADORIA")
            servicos_sum = sum(float(item.total_venda or 0) for item in budget.items if item.tipo_item != "MERCADORIA")

            total_formatted = format_currency(budget.valor_total)
            produtos_formatted = format_currency(produtos_sum)
            servicos_formatted = format_currency(servicos_sum)

            # Build full structured proposal sections
            prop_data = build_commercial_proposal_full(budget, db)

            tabela_sintetica_html = build_synthetic_items_table(budget)
            tabela_analitica_html = build_analytical_items_table(budget)
            resumo_condicoes_html = build_commercial_conditions_summary(budget)

            data_emissao_str = budget.data_orcamento.strftime("%d/%m/%Y") if budget.data_orcamento else datetime.now().strftime("%d/%m/%Y")
            data_validade_str = budget.data_vencimento_inicial.strftime("%d/%m/%Y") if budget.data_vencimento_inicial else "15 dias"

            vendedor_str = budget.vendedor.name if (budget.vendedor and hasattr(budget.vendedor, 'name')) else ""
            if not vendedor_str and budget.responsaveis:
                vendedor_str = budget.responsaveis[0].user.name if budget.responsaveis[0].user else ""

            emitter_user = db.query(User).filter(User.id == user_id).first()
            emitter_user_name = emitter_user.name if emitter_user else "Usuário Cerberus"

            replacements = {
                "proposta_comercial": prop_data["proposta_completa_html"],
                "proposta_comercial_completa": prop_data["proposta_completa_html"],
                "secao_venda_produtos": prop_data["venda_html"],
                "secao_instalacao": prop_data["instalacao_html"],
                "secao_comodato_locacao": prop_data["locacao_html"],
                "resumo_proposta": prop_data["resumo_html"],
                "observacoes_proposta": prop_data["observacoes_html"],
                "bloco_assinaturas": prop_data["assinaturas_html"],
                "valor_total_venda": format_currency(prop_data["total_venda"]),
                "valor_total_instalacao": format_currency(prop_data["total_instalacao"]),
                "valor_mensal_locacao": format_currency(prop_data["total_locacao_mensal"]),
                "data_emissao": data_emissao_str,
                "data_validade": data_validade_str,
                "cliente_nome": cust.nome_fantasia or cust.razao_social if cust else "",
                "cliente_cnpj": cust.cnpj if cust else "",
                "cliente_cidade": cidade_nome,
                "cliente_estado": estado_sigla,
                "cliente_cidade_uf": cidade_uf_str,
                "empresa_nome": budget.company.razao_social if budget.company else "",
                "empresa_cnpj": budget.company.cnpj if budget.company else "",
                "oportunidade_numero": budget.numero_orcamento or "",
                "oportunidade_titulo": budget.titulo or "",
                "vendedor_nome": vendedor_str,
                "usuario_emissor": emitter_user_name,
                "usuario_nome": emitter_user_name,
                "impresso_por": f"Impresso por cerberus.warslab.com.br | Usuário: {emitter_user_name}",
                "forma_pagamento_nome": getattr(budget.forma_pagamento, 'descricao', getattr(budget.forma_pagamento, 'nome', '')) if budget.forma_pagamento else "",
                "valor_total_produtos": produtos_formatted,
                "valor_total_servicos": servicos_formatted,
                "valor_total_proposta": total_formatted,
                "valor_proposta": total_formatted,
                "tabela_itens_sintetica": tabela_sintetica_html,
                "tabela_itens_analitica": tabela_analitica_html,
                "resumo_condicoes_comerciais": resumo_condicoes_html,
            }

            # Se for uma PROPOSTA_COMERCIAL e o template estiver vazio, com texto padrão ou sem seções de itens:
            if template.tipo_documento == "PROPOSTA_COMERCIAL":
                clean_text = re.sub(r'<[^>]*>', '', html or "").strip()
                if not html or html.strip() in ("", "<p></p>", "<p><br></p>", "<p>&nbsp;</p>") or clean_text in ("", "Digite seu documento aqui...", "Digite seu texto aqui..."):
                    html = prop_data["proposta_completa_html"]
                elif "{{proposta_comercial}}" not in html and "{{proposta_comercial_completa}}" not in html and "{{secao_venda_produtos}}" not in html and "{{tabela_itens_sintetica}}" not in html and "{{tabela_itens_analitica}}" not in html:
                    html = f"{html}\n{prop_data['proposta_completa_html']}"

    # Perform replace for all variables & replacements keys
    for name, value in replacements.items():
        html = html.replace(f"{{{{{name}}}}}", str(value))

    for var in template.variables:
        name = var.nome
        if name not in replacements:
            html = html.replace(f"{{{{{name}}}}}", "")

    # Determina o papel timbrado aplicável:
    # 1. Se for OPORTUNIDADE, prioriza o papel timbrado da equipe de venda selecionada
    # 2. Se a equipe de venda não tiver papel timbrado (None), imprime sem cabeçalho e rodapé
    active_letterhead = None
    if template.modulo_origem == "OPORTUNIDADE" and budget:
        target_team = None
        if getattr(budget, "sales_team_id", None):
            target_team = db.query(SalesTeam).options(joinedload(SalesTeam.papel_timbrado)).filter(SalesTeam.id == budget.sales_team_id).first()
        elif getattr(budget, "vendedor_id", None):
            member = db.query(SalesTeamMember).filter(SalesTeamMember.user_id == str(budget.vendedor_id)).first()
            if member:
                target_team = db.query(SalesTeam).options(joinedload(SalesTeam.papel_timbrado)).filter(SalesTeam.id == member.sales_team_id).first()

        if target_team:
            if target_team.papel_timbrado and target_team.papel_timbrado.is_active:
                active_letterhead = target_team.papel_timbrado
            else:
                active_letterhead = None  # Equipe sem papel timbrado -> imprime sem cabeçalhos e rodapé
        else:
            active_letterhead = template.letterhead if (template.letterhead and template.letterhead.is_active) else None
    else:
        active_letterhead = template.letterhead if (template.letterhead and template.letterhead.is_active) else None

    # Envelopar no Papel Timbrado se estiver ativo
    body_content = f'<div class="document-body-container">{html}</div>'
    if active_letterhead:
        lh_html = active_letterhead.conteudo_html or "{{document_content}}"
        # Substitui variáveis no próprio papel timbrado (ex: usuario_emissor, impresso_por)
        for name, value in replacements.items():
            lh_html = lh_html.replace(f"{{{{{name}}}}}", str(value))

        lh_css = active_letterhead.conteudo_css or ""
        # Substituição robusta de qualquer formato de placeholder de conteúdo no papel timbrado
        placeholder_pattern = r'(\{\{|\{|\[|&#123;&#123;|&lcub;&lcub;)\s*(document_content|conteudo_documento|conteudo|content)\s*(\}\}|\}|\]|&#125;&#125;|&rcub;&rcub;)'
        if re.search(placeholder_pattern, lh_html, flags=re.IGNORECASE):
            html = re.sub(placeholder_pattern, lambda m: body_content, lh_html, flags=re.IGNORECASE)
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
