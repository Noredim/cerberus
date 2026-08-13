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

    base_css = """
    html, body {
        height: 100%;
        margin: 0;
        padding: 0;
    }
    .letterhead-wrapper {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 257mm;
        box-sizing: border-box;
    }
    .footer, [class*="footer"], footer {
        margin-top: auto;
    }
    """

    if css and css.strip():
        rendered = f"<style>{base_css}\n{css}</style>\n<div class=\"letterhead-wrapper\">{rendered}</div>"
    else:
        rendered = f"<style>{base_css}</style>\n<div class=\"letterhead-wrapper\">{rendered}</div>"

    return rendered


VARIABLES_CATALOG = {
    "OPORTUNIDADE": [
        {"nome": "cliente_nome", "origem": "CLIENTE", "campo": "razao_social", "tipo": "TEXTO", "obrigatoria": True},
        {"nome": "cliente_cnpj", "origem": "CLIENTE", "campo": "cnpj", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "cliente_cidade", "origem": "CLIENTE", "campo": "cidade", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "cliente_estado", "origem": "CLIENTE", "campo": "estado", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "empresa_nome", "origem": "EMPRESA", "campo": "razao_social", "tipo": "TEXTO", "obrigatoria": True},
        {"nome": "empresa_cnpj", "origem": "EMPRESA", "campo": "cnpj", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "oportunidade_numero", "origem": "OPORTUNIDADE", "campo": "numero_orcamento", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "oportunidade_titulo", "origem": "OPORTUNIDADE", "campo": "titulo", "tipo": "TEXTO", "obrigatoria": False},
        {"nome": "valor_proposta", "origem": "OPORTUNIDADE", "campo": "valor_total", "tipo": "NUMERO", "obrigatoria": True},
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
        
    return query.order_by(DocumentTemplate.nome.asc()).all()


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

            replacements = {
                "cliente_nome": cust.nome_fantasia or cust.razao_social if cust else "",
                "cliente_cnpj": cust.cnpj if cust else "",
                "cliente_cidade": cidade_nome,
                "cliente_estado": estado_sigla,
                "empresa_nome": budget.company.razao_social if budget.company else "",
                "empresa_cnpj": budget.company.cnpj if budget.company else "",
                "oportunidade_numero": budget.numero_orcamento or "",
                "oportunidade_titulo": budget.titulo or "",
                "valor_proposta": budget.valor_total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) if hasattr(budget.valor_total, 'toLocaleString') else f"R$ {float(budget.valor_total or 0):,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
            }

    # Perform replace for all variables
    for var in template.variables:
        name = var.nome
        value = replacements.get(name, "")
        
        # RN006: Todo modelo vigente que for gerado deve passar pela substituição.
        # Se for obrigatória e o valor estiver vazio, a regra diz "não deve deixar salvar sem estar preenchido".
        # Na renderização, preencheremos ou manteremos se não houver dados.
        html = html.replace(f"{{{{{name}}}}}", str(value))

    # Envelopar no Papel Timbrado se estiver vinculado e ativo
    if template.letterhead and template.letterhead.is_active:
        lh_html = template.letterhead.conteudo_html or "{{document_content}}"
        lh_css = template.letterhead.conteudo_css or ""
        if "{{document_content}}" in lh_html:
            html = lh_html.replace("{{document_content}}", html)
        elif "{{conteudo_documento}}" in lh_html:
            html = lh_html.replace("{{conteudo_documento}}", html)
        else:
            html = f"{lh_html}\n{html}"

        if lh_css and lh_css.strip():
            html = f"<style>{lh_css}</style>\n{html}"

    # Log audit
    audit = DocumentAudit(
        modelo_id=template.id,
        usuario_id=user_id,
        acao="GERACAO"
    )
    db.add(audit)
    db.commit()

    return html
