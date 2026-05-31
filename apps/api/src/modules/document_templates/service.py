import re
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional, Tuple
from src.modules.document_templates.models import DocumentTemplate, DocumentVersion, DocumentVariable, DocumentAudit
from src.modules.document_templates.schemas import TemplateCreate, TemplateUpdate, DocumentRenderRequest
from src.modules.sales_budgets.models import SalesBudget
from src.modules.customers.models import Customer
from src.modules.companies.models import Company


VARIABLES_CATALOG = {
    "OPORTUNIDADE": [
        {"nome": "cliente_nome", "origem": "CLIENTE", "campo": "razao_social", "tipo": "TEXTO", "obrigatoria": True},
        {"nome": "cliente_cnpj", "origem": "CLIENTE", "campo": "cnpj", "tipo": "TEXTO", "obrigatoria": False},
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

    # RN002: Modelos vigentes não poderão ser editados
    if template.status == "VIGENTE":
        raise ValueError("Documentos vigentes não podem ser editados. Crie uma nova versão.")

    # Validate variables
    validate_mandatory_variables(data.modulo_origem, data.conteudo_html)

    # Update template values
    template.nome = data.nome
    template.tipo_documento = data.tipo_documento
    template.modulo_origem = data.modulo_origem
    template.conteudo_html = data.conteudo_html
    template.descricao = data.descricao

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
            replacements = {
                "cliente_nome": budget.customer.nome_fantasia or budget.customer.razao_social if budget.customer else "",
                "cliente_cnpj": budget.customer.cnpj if budget.customer else "",
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

    # Log audit
    audit = DocumentAudit(
        modelo_id=template.id,
        usuario_id=user_id,
        acao="GERACAO"
    )
    db.add(audit)
    db.commit()

    return html
