from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.opportunities.schemas import (
    OpportunityCreate, OpportunityUpdate, OpportunityOut, OpportunityListOut,
    OpportunityItemOut, OpportunityItemCreate, OpportunityItemUpdate,
    OpportunityItemKitOut, OpportunityItemKitCreate,
    OpportunityParametersSalesOut, OpportunityParametersSalesUpdate,
    OpportunityBudgetOut, OpportunityBudgetManualCreate, OpportunityBudgetItemOut
)
from src.modules.opportunities import services
from src.modules.opportunities import services_budget
from fastapi import UploadFile, File, Form, Body

router = APIRouter(prefix="/opportunities", tags=["opportunities"])

@router.post("/", response_model=OpportunityOut, status_code=status.HTTP_201_CREATED)
def create_opportunity(
    opp_in: OpportunityCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cria uma nova Oportunidade e automaticamente amarra os parâmetros fiscais
    de venda ou de locação puxando os valores Default da Empresa selecionada.
    """
    return services.create_opportunity(db, current_user.tenant_id, opp_in)

@router.get("/", response_model=List[OpportunityListOut])
def read_opportunities(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lista todas as Oportunidades do Tenant atual.
    """
    return services.get_opportunities(db, current_user.tenant_id, skip=skip, limit=limit)

@router.get("/{opp_id}", response_model=OpportunityOut)
def read_opportunity(
    opp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Puxa os detalhes da Oportunidade pelo ID (Cabeçalho).
    """
    opp = services.get_opportunity_by_id(db, current_user.tenant_id, opp_id)
    if not opp:
        raise HTTPException(status_code=404, detail="Opportunity not found")
    return opp

@router.put("/{opp_id}", response_model=OpportunityOut)
def update_opportunity(
    opp_id: str,
    opp_in: OpportunityUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualiza os campos do cabeçalho da Oportunidade.
    """
    return services.update_opportunity(db, current_user.tenant_id, opp_id, opp_in)

@router.delete("/{opp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opportunity(
    opp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deleta uma oportunidade e todas as suas abas recursivamente.
    """
    services.delete_opportunity(db, current_user.tenant_id, opp_id)
    return None

# ========================================== #
# PARAMETERS
# ========================================== #
@router.get("/{opp_id}/parameters/sales", response_model=OpportunityParametersSalesOut)
def read_opportunity_parameters_sales(
    opp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    params = services.get_opportunity_parameters_sales(db, opp_id)
    if not params:
        raise HTTPException(status_code=404, detail="Sales parameters not found for this opportunity")
    return params

@router.put("/{opp_id}/parameters/sales", response_model=OpportunityParametersSalesOut)
def update_opportunity_parameters_sales(
    opp_id: str,
    params_in: OpportunityParametersSalesUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services.upsert_opportunity_parameters_sales(db, opp_id, params_in)

# ========================================== #
# OPORTUNIDADE ITEMS
# ========================================== #

@router.get("/{opp_id}/items", response_model=List[OpportunityItemOut])
def read_opportunity_items(
    opp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Pode opcionalmente checar se opp pertence ao tenant
    return services.get_items(db, opp_id)

@router.post("/{opp_id}/items", response_model=OpportunityItemOut, status_code=status.HTTP_201_CREATED)
def create_opportunity_item(
    opp_id: str,
    item_in: OpportunityItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services.add_item(db, opp_id, item_in)

@router.put("/items/{item_id}", response_model=OpportunityItemOut)
def update_opportunity_item(
    item_id: str,
    item_in: OpportunityItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services.update_item(db, item_id, item_in)

@router.delete("/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opportunity_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    services.remove_item(db, item_id)
    return None

# ========================================== #
# OPORTUNIDADE KITS
# ========================================== #

@router.get("/items/{item_id}/kits", response_model=List[OpportunityItemKitOut])
def read_opportunity_item_kits(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services.get_kit_items(db, item_id)

@router.post("/items/{item_id}/kits", response_model=OpportunityItemKitOut, status_code=status.HTTP_201_CREATED)
def create_opportunity_item_kit(
    item_id: str,
    kit_in: OpportunityItemKitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services.add_kit_item(db, item_id, kit_in)

@router.delete("/items/kits/{kit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_opportunity_item_kit(
    kit_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    services.remove_kit_item(db, kit_id)
    return None

# ========================================== #
# OPORTUNIDADE ORÇAMENTOS (UPLOAD EXCEL)
# ========================================== #

@router.get("/{opp_id}/budgets", response_model=List[OpportunityBudgetOut])
def list_budgets(
    opp_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services_budget.get_budgets(db, opp_id)

@router.post("/{opp_id}/budgets/upload", response_model=OpportunityBudgetOut)
async def upload_budget_excel(
    opp_id: str,
    file: UploadFile = File(...),
    fornecedor_cnpj: str = Form(None),
    fornecedor_nome: str = Form(None),
    moeda: str = Form("BRL"),
    cambio: str = Form("1.0000"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Recebe um arquivo Excel nativo contendo as cotações de fornecedores.
    Ele extrai essas informações e cria um Orçamento (Budget) com Inbound Items.
    Adicionalmente, se passar o CNPJ de um Fornecedor que não existe, o backend
    cria um registro simples no Banco para posterior higienização, vinculando ao
    Orçamento.
    """
    from decimal import Decimal
    
    file_bytes = await file.read()
    
    return services_budget.import_budget_excel(
        db=db,
        tenant_id=current_user.tenant_id,
        opp_id=opp_id,
        file_bytes=file_bytes,
        fornecedor_cnpj=fornecedor_cnpj,
        fornecedor_nome=fornecedor_nome,
        moeda=moeda,
        cambio=Decimal(cambio)
    )

@router.delete("/budgets/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_budget(
    budget_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    services_budget.delete_budget(db, budget_id)
    return None

@router.post("/{opp_id}/budgets/manual", response_model=OpportunityBudgetOut)
def create_manual_budget(
    opp_id: str,
    budget_in: OpportunityBudgetManualCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services_budget.create_manual_budget(db, current_user.tenant_id, opp_id, budget_in)

@router.put("/budgets/items/{item_id}/link", response_model=OpportunityBudgetItemOut)
def link_budget_item(
    item_id: str,
    opp_item_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services_budget.link_budget_item(db, item_id, opp_item_id)

@router.put("/budgets/items/{item_id}/unlink")
def unlink_budget_item(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services_budget.unlink_budget_item(db, item_id)

@router.post("/budgets/items/{item_id}/create-product", response_model=OpportunityBudgetItemOut)
def create_product_from_budget_item(
    item_id: str,
    company_id: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return services_budget.create_product_from_budget_item(db, current_user.tenant_id, item_id, company_id)

@router.get("/budgets/template/download")
def download_budget_template():
    from fastapi.responses import Response
    import openpyxl
    from io import BytesIO
    
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Itens do Orçamento"
    
    headers = ["Nome do fornecedor", "CNPJ do fornecedor", "Cód interno do produto", "Descrição", "IPI", "ICMS", "Valor unitário", "Unidade", "NCM", "Quantidade"]
    ws.append(headers)
    
    # Adicionar exemplo de preenchimento
    example_row = ["Distribuidora XYZ", "12.345.678/0001-90", "XYZ-123", "Servidor Dell R740", 0, 18, 15000.00, "UN", "84715010", 1]
    ws.append(example_row)
    
    file_stream = BytesIO()
    wb.save(file_stream)
    file_stream.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="modelo_orcamento.xlsx"'
    }
    
    return Response(
        content=file_stream.read(),
        headers=headers,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
