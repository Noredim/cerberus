from uuid import UUID
import uuid
from sqlalchemy.orm import Session
from fastapi import HTTPException
from pydantic import ValidationError
from decimal import Decimal

from src.modules.opportunities.models import OpportunityBudget, OpportunityBudgetItem, OpportunityItem
from src.modules.opportunities.schemas import OpportunityBudgetOut, OpportunityBudgetManualCreate
from src.modules.suppliers.models import Supplier
from src.modules.products.models import Product
from src.modules.opportunities.excel_parser import parse_budget_excel

def get_budgets(db: Session, opp_id: str):
    return db.query(OpportunityBudget).filter(OpportunityBudget.opportunity_id == opp_id).all()

def delete_budget(db: Session, budget_id: str):
    budget = db.query(OpportunityBudget).filter(OpportunityBudget.id == budget_id).first()
    if not budget:
        raise HTTPException(status_code=404, detail="Orçamento não encontrado")
    db.delete(budget)
    db.commit()

def import_budget_excel(
    db: Session,
    tenant_id: str,
    opp_id: str,
    file_bytes: bytes,
    fornecedor_cnpj: str = None,
    fornecedor_nome: str = None,
    tipo_orcamento: str = "REVENDA",
    moeda: str = "BRL",
    cambio: Decimal = Decimal("1.0000")
):
    """
    Parses the Excel file, optionally creates/links a Supplier via CNPJ,
    and inserts the OpportunityBudget and OpportunityBudgetItem records.
    """
    
    # 1. Parse Excel into dicts
    try:
        parsed_data = parse_budget_excel(file_bytes)
        items_data = parsed_data["items"]
        if parsed_data.get("fornecedor_cnpj"):
            fornecedor_cnpj = parsed_data["fornecedor_cnpj"]
        if parsed_data.get("fornecedor_nome"):
            fornecedor_nome = parsed_data["fornecedor_nome"]
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Erro ao ler Excel: {str(e)}")
        
    if not items_data:
        raise HTTPException(status_code=400, detail="Nenhum item válido encontrado no Excel.")

    # 2. Handle Supplier logic (Fast creation if not exists)
    fornecedor_id = None
    if fornecedor_cnpj:
        clean_cnpj = ''.join(filter(str.isdigit, fornecedor_cnpj))
        if len(clean_cnpj) == 14:
            supplier = db.query(Supplier).filter(
                Supplier.tenant_id == tenant_id,
                Supplier.cnpj == clean_cnpj
            ).first()
            
            if supplier:
                fornecedor_id = supplier.id
            else:
                # Create rudimentary supplier
                new_supplier_id = str(uuid.uuid4())
                supplier = Supplier(
                    id=new_supplier_id,
                    tenant_id=tenant_id,
                    cnpj=clean_cnpj,
                    razao_social=fornecedor_nome or f"Fornecedor Importado {clean_cnpj}"
                )
                db.add(supplier)
                db.flush()
                fornecedor_id = new_supplier_id
                is_new_supplier = True
                
    # 3. Create Budget Header
    valor_total_itens = sum(item["quantidade"] * item["valor_unitario"] for item in items_data)
    
    # Simple tax calculation for demo purposes (real would map ICMS/IPI line by line)
    valor_total_impostos = sum(
        item["quantidade"] * item["valor_unitario"] * ((item["ipi_percentual"] + item["icms_percentual"]) / Decimal(100))
        for item in items_data
    )
    
    valor_total_orcamento = (valor_total_itens + valor_total_impostos) * cambio
    
    budget = OpportunityBudget(
        opportunity_id=opp_id,
        fornecedor_id=fornecedor_id,
        nome_fornecedor_manual=fornecedor_nome if not fornecedor_id else None,
        cnpj_fornecedor=fornecedor_cnpj if not fornecedor_id else None,
        tipo_orcamento=tipo_orcamento,
        moeda=moeda,
        cambio=cambio,
        valor_total_itens=valor_total_itens,
        valor_total_impostos=valor_total_impostos,
        valor_total_orcamento=valor_total_orcamento
    )
    db.add(budget)
    db.flush()
    
    # 4. Create Budget Items
    for data in items_data:
        b_item = OpportunityBudgetItem(
            orcamento_id=budget.id,
            codigo_fornecedor=data["codigo_fornecedor"],
            descricao=data["descricao"],
            quantidade=data["quantidade"],
            unidade=data["unidade"],
            ncm=data["ncm"],
            ipi_percentual=data["ipi_percentual"],
            icms_percentual=data["icms_percentual"],
            valor_unitario=data["valor_unitario"]
        )
        db.add(b_item)
        
    db.commit()
    db.refresh(budget)
    
    # Inject flag for frontend awareness
    setattr(budget, "is_new_supplier", getattr(locals(), 'is_new_supplier', False))
    
    return budget

def create_manual_budget(db: Session, tenant_id: str, opp_id: str, budget_in: OpportunityBudgetManualCreate):
    TWO = Decimal('0.01')

    valor_total_itens = sum(item.quantidade * item.valor_unitario for item in budget_in.items)
    valor_total_impostos = sum(
        # ICMS is informational only — only IPI affects the cost calculation
        item.quantidade * item.valor_unitario * (item.ipi_percentual / Decimal(100))
        for item in budget_in.items
    )
    valor_total_orcamento = (valor_total_itens + valor_total_impostos) * budget_in.cambio

    # Quantize to 2 decimal places to satisfy Pydantic's condecimal(decimal_places=2)
    valor_total_itens = valor_total_itens.quantize(TWO)
    valor_total_impostos = valor_total_impostos.quantize(TWO)
    valor_total_orcamento = valor_total_orcamento.quantize(TWO)

    
    budget = OpportunityBudget(
        opportunity_id=opp_id,
        tipo_orcamento=budget_in.tipo_orcamento,
        fornecedor_id=budget_in.fornecedor_id,
        nome_fornecedor_manual=budget_in.nome_fornecedor_manual,
        cnpj_fornecedor=budget_in.cnpj_fornecedor,
        moeda=budget_in.moeda,
        cambio=budget_in.cambio,
        data_cotacao=budget_in.data_cotacao,
        valor_total_itens=valor_total_itens,
        valor_total_impostos=valor_total_impostos,
        valor_total_orcamento=valor_total_orcamento
    )
    db.add(budget)
    db.flush()
    
    for item_data in budget_in.items:
        b_item = OpportunityBudgetItem(
            orcamento_id=budget.id,
            codigo_fornecedor=item_data.codigo_fornecedor,
            descricao=item_data.descricao,
            quantidade=item_data.quantidade,
            unidade=item_data.unidade,
            ncm=item_data.ncm,
            ipi_percentual=item_data.ipi_percentual,
            icms_percentual=item_data.icms_percentual,
            valor_unitario=item_data.valor_unitario,
            produto_id=item_data.produto_id
        )
        db.add(b_item)
        
    db.commit()
    db.refresh(budget)
    return budget

def link_budget_item(db: Session, budget_item_id: str, opp_item_id: str):
    budget_item = db.query(OpportunityBudgetItem).filter(OpportunityBudgetItem.id == budget_item_id).first()
    if not budget_item:
        raise HTTPException(status_code=404, detail="Item do orçamento não encontrado")
    
    # Check if the opp item exists and belongs to the same opportunity
    opp_item = db.query(OpportunityItem).filter(OpportunityItem.id == opp_item_id).first()
    if not opp_item:
        raise HTTPException(status_code=404, detail="Item da oportunidade não encontrado")
        
    if opp_item.opportunity_id != budget_item.budget.opportunity_id:
        raise HTTPException(status_code=400, detail="O item não pertence à mesma oportunidade")
        
    # Check if already linked to another
    existing_link = db.query(OpportunityBudgetItem).filter_by(oportunidade_item_id_vinculado=opp_item_id).first()
    if existing_link and existing_link.id != budget_item.id:
        raise HTTPException(status_code=400, detail="Este item de oportunidade já está vinculado a outra cotação")
        
    budget_item.oportunidade_item_id_vinculado = opp_item_id
    db.commit()
    db.refresh(budget_item)
    return budget_item

def unlink_budget_item(db: Session, budget_item_id: str):
    budget_item = db.query(OpportunityBudgetItem).filter(OpportunityBudgetItem.id == budget_item_id).first()
    if not budget_item:
        raise HTTPException(status_code=404, detail="Item do orçamento não encontrado")
        
    budget_item.oportunidade_item_id_vinculado = None
    db.commit()
    return {"message": "Vínculo removido com sucesso"}

def create_product_from_budget_item(db: Session, tenant_id: str, budget_item_id: str, company_id: str):
    budget_item = db.query(OpportunityBudgetItem).filter(OpportunityBudgetItem.id == budget_item_id).first()
    if not budget_item:
        raise HTTPException(status_code=404, detail="Item do orçamento não encontrado")
        
    # Scaffold new product
    new_product = Product(
        tenant_id=tenant_id,
        nome=budget_item.descricao or "Novo Produto Assitido",
        tipo="EQUIPAMENTO",
        company_id=company_id,
        unidade=budget_item.unidade or "UN",
        ncm_codigo=budget_item.ncm
    )
    db.add(new_product)
    db.flush()
    
    budget_item.produto_id = new_product.id
    db.commit()
    
    return budget_item

def ensure_mdm_opportunity(db: Session, tenant_id: str) -> str:
    """
    Garante que existe uma oportunidade 'fantasma' para orçamentos avulsos do MDM.
    """
    from src.modules.opportunities.models import Opportunity
    from src.modules.companies.models import Company
    
    opp = db.query(Opportunity).filter(
        Opportunity.tenant_id == tenant_id,
        Opportunity.titulo_oportunidade == "ORÇAMENTOS AVULSOS - MDM"
    ).first()
    
    if not opp:
        # Puxa a primeira empresa do tenant para amarrar
        company = db.query(Company).filter(Company.tenant_id == tenant_id).first()
        if not company:
            raise HTTPException(status_code=400, detail="Nenhuma empresa cadastrada para criar oportunidade de sistema.")
            
        from src.modules.opportunities.services import generate_opportunity_number
        from src.modules.companies.models import CompanyTaxProfile
        
        tax_profile = db.query(CompanyTaxProfile).filter(CompanyTaxProfile.company_id == company.id).first()
        
        opp = Opportunity(
            tenant_id=tenant_id,
            numero_oportunidade=generate_opportunity_number(),
            titulo_oportunidade="ORÇAMENTOS AVULSOS - MDM",
            empresa_id=company.id,
            perfil_tributario_origem_id=tax_profile.id if tax_profile else None,
            status="EM_COTACAO"
        )
        db.add(opp)
        db.flush()
        
    return str(opp.id)

def get_product_budget_history(db: Session, product_id: str):
    """
    Busca o histórico de orçamentos (items) vinculados a um produto específico.
    Eager-loads budget → supplier so the frontend can display fornecedor, data_cotacao, etc.
    """
    from sqlalchemy.orm import joinedload
    return (
        db.query(OpportunityBudgetItem)
        .options(
            joinedload(OpportunityBudgetItem.budget).joinedload(OpportunityBudget.supplier)
        )
        .filter(OpportunityBudgetItem.produto_id == product_id)
        .order_by(OpportunityBudgetItem.created_at.desc())
        .all()
    )
