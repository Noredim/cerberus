from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, get_active_company
from src.modules.users.models import User
from .schemas import ProductCreate, ProductUpdate, ProductOut, MvaLookupResult
from .service import ProductService
from src.modules.purchase_budgets.service import PurchaseBudgetService
from src.modules.purchase_budgets.schemas import PurchaseBudgetCreate, PurchaseBudgetItemCreate, BudgetTypeEnum, FreightTypeEnum
from src.modules.purchase_budgets.models import PurchaseBudgetItem, PurchaseBudget
from src.modules.purchase_budgets.schemas import PurchaseBudgetItemOut

router = APIRouter(prefix="/cadastro/produtos", tags=["Products"])

@router.post("", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_product(
    payload: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    active_company_id: str = Depends(get_active_company)
):
    from uuid import UUID
    if not active_company_id:
        raise HTTPException(status_code=400, detail="X-Company-Id obrigatório")
    payload.company_id = UUID(active_company_id)
    service = ProductService(db)
    return service.create_product(current_user.tenant_id, payload)

@router.get("", response_model=List[ProductOut])
def list_products(
    q: Optional[str] = Query(None),
    tipo: Optional[str] = Query(None),
    skip: int = Query(0),
    limit: int = Query(100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    service = ProductService(db)
    return service.list_products(current_user.tenant_id, q, tipo, skip, limit, company_id)

@router.get("/mva-preview", response_model=MvaLookupResult)
def preview_mva(
    ncm: str,
    company_id: UUID,
    finalidade: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Endpoint para o frontend consultar o MVA em tempo real ao preencher o NCM.
    """
    service = ProductService(db)
    mva_data = service.get_product_mva(current_user.tenant_id, ncm, str(company_id), finalidade)
    
    if not mva_data:
        return MvaLookupResult(found=False)
        
    return MvaLookupResult(
        found=True,
        mva_percent=mva_data["mva_percent"],
        ncm_base=mva_data["ncm_match"],
        description=mva_data["descricao"]
    )

@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    service = ProductService(db)
    product = service.get_product(current_user.tenant_id, str(product_id), company_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return product

@router.put("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: UUID,
    payload: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    service = ProductService(db)
    product = service.update_product(current_user.tenant_id, str(product_id), payload, company_id)
    if not product:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return product

@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    service = ProductService(db)
    success = service.delete_product(current_user.tenant_id, str(product_id), company_id)
    if not success:
        raise HTTPException(status_code=404, detail="Produto não encontrado.")
    return None

@router.get("/{product_id}/budgets")
def list_product_budgets(
    product_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    # Retornar histórico de itens de orçamento para o produto
    query = db.query(PurchaseBudgetItem).join(PurchaseBudget).filter(
        PurchaseBudgetItem.product_id == str(product_id),
        PurchaseBudget.tenant_id == current_user.tenant_id
    )
    if company_id:
        query = query.filter(PurchaseBudget.company_id == company_id)
        
    items = query.order_by(PurchaseBudget.data_orcamento.desc()).limit(20).all()
    
    print(f"DEBUG_GET_BUDGETS: found {len(items)} for product {product_id} tenant {current_user.tenant_id}", flush=True)

    result = []
    for item in items:
        # Prepara um dicionário com os campos esperados
        res = {
            "id": item.id,
            "valor_unitario": item.valor_unitario,
            "ipi_percent": item.ipi_percent,
            "icms_percent": item.icms_percent,
            "icms_percentual": item.icms_percent,
            "codigo_fornecedor": item.codigo_fornecedor,
            "created_at": getattr(item.budget, 'created_at', None),
            "budget": {
                "numero_orcamento": getattr(item.budget, 'numero_orcamento', None),
                "tipo_orcamento": getattr(item.budget, 'tipo_orcamento', None),
                "data_orcamento": item.budget.data_orcamento,
                "supplier_nome_fantasia": item.budget.supplier.nome_fantasia if getattr(item.budget, 'supplier', None) else None,
                "supplier_razao_social": item.budget.supplier.razao_social if getattr(item.budget, 'supplier', None) else None,
                "supplier_uf": item.budget.supplier.uf if getattr(item.budget, 'supplier', None) else None,
                "nome_fornecedor_manual": item.budget.vendedor_nome,
            }
        }
        result.append(res)
    return result

@router.post("/{product_id}/budgets/manual")
def create_manual_product_budget(
    product_id: UUID,
    payload: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    company_id: str = Depends(get_active_company)
):
    if not company_id:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="X-Company-Id header is required")

    # Map the ad-hoc frontend payload to standard PurchaseBudgetCreate
    items_data = payload.get("items", [])
    budget_items = []
    
    for item in items_data:
        budget_items.append(
            PurchaseBudgetItemCreate(
                product_id=UUID(item["produto_id"]),
                codigo_fornecedor=item.get("codigo_fornecedor", ""),
                ncm=item.get("ncm"),
                quantidade=item.get("quantidade", 1),
                valor_unitario=item.get("valor_unitario", 0),
                frete_percent=0,
                ipi_percent=item.get("ipi_percentual", 0),
                icms_percent=item.get("icms_percentual", 0)
            )
        )

    budget_create = PurchaseBudgetCreate(
        supplier_id=payload.get("fornecedor_id") or payload.get("cnpj_fornecedor") or "", # Fallback if manual string was used, but supplier_id usually required in schema
        numero_orcamento=None,
        data_orcamento=payload.get("data_cotacao", ""),
        tipo_orcamento=BudgetTypeEnum(payload.get("tipo_orcamento", "REVENDA")),
        vendedor_nome=payload.get("nome_fornecedor_manual"),
        frete_tipo=FreightTypeEnum("CIF"),
        frete_percent=0,
        ipi_calculado=False,
        items=budget_items
    )
    
    # Overwrite the supplier_id specifically for manual suppliers if they bypassed the DB
    if not payload.get("fornecedor_id"):
        # We need a dummy or we need to relax the schema in service.py
        # But this works if the UI enforces supplier catalog
        budget_create.supplier_id = payload.get("fornecedor_id", "00000000-0000-0000-0000-000000000000")

    result = PurchaseBudgetService.create_budget(
        db=db,
        tenant_id=current_user.tenant_id,
        company_id=UUID(company_id),
        data=budget_create
    )
    return {"status": "ok", "budget_id": str(result.id)}
