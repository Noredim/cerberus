from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List, Optional
from decimal import Decimal
from datetime import date

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user, check_not_engenharia_preco
from src.modules.users.models import User
from .schemas import (
    FormaPagamentoCreate, FormaPagamentoUpdate, FormaPagamentoOut, 
    TipoDistribuicaoEnum, TipoUsoEnum
)
from .service import PaymentMethodsService
from pydantic import BaseModel, Field

router = APIRouter(prefix="/cadastro/formas-pagamento", tags=["Payment Methods"])

class SimulationInput(BaseModel):
    valor_total: Decimal = Field(..., ge=0)
    data_inicial: date
    tipo_distribuicao: TipoDistribuicaoEnum
    parcelas: List[dict]  # list of dict containing: sequencia, descricao, intervalo_dias, percentual, valor_fixo

def check_admin_or_finance(user: User):
    roles = [r.role.value for r in user.roles]
    if "ENGENHARIA_PRECO" in roles and "ADMIN" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: Perfil de Engenharia de Preço não possui permissão para gerenciar formas de pagamento"
        )
    if "ADMIN" not in roles and "DIRETORIA" not in roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso negado: Apenas administradores e diretores podem gerenciar formas de pagamento"
        )

@router.get("", response_model=List[FormaPagamentoOut])
def list_formas(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return PaymentMethodsService.list_formas(db, current_user.tenant_id)

@router.get("/{forma_id}", response_model=FormaPagamentoOut)
def get_forma(
    forma_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    forma = PaymentMethodsService.get_forma(db, current_user.tenant_id, forma_id)
    if not forma:
        raise HTTPException(status_code=404, detail="Forma de pagamento não encontrada")
    return forma

@router.post("", response_model=FormaPagamentoOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(check_not_engenharia_preco)])
def create_forma(
    data: FormaPagamentoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Check permissions
    check_admin_or_finance(current_user)
    return PaymentMethodsService.create_forma(db, current_user.tenant_id, data)

@router.put("/{forma_id}", response_model=FormaPagamentoOut, dependencies=[Depends(check_not_engenharia_preco)])
def update_forma(
    forma_id: UUID,
    data: FormaPagamentoUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_or_finance(current_user)
    try:
        forma = PaymentMethodsService.update_forma(db, current_user.tenant_id, forma_id, data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not forma:
        raise HTTPException(status_code=404, detail="Forma de pagamento não encontrada")
    return forma

@router.delete("/{forma_id}", dependencies=[Depends(check_not_engenharia_preco)])
def delete_forma(
    forma_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    check_admin_or_finance(current_user)
    try:
        success = PaymentMethodsService.delete_forma(db, current_user.tenant_id, forma_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not success:
        raise HTTPException(status_code=404, detail="Forma de pagamento não encontrada")
    return {"message": "Forma de pagamento excluída com sucesso", "id": forma_id}

@router.post("/simular")
def simular_parcelas(
    data: SimulationInput,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Simula em tempo real a divisão das parcelas baseando-se no valor total,
    data inicial e regras da forma de pagamento.
    """
    try:
        # Create a mock entity or simulate rules directly using the helper
        pfs = PaymentMethodsService.generate_planning_from_rules(
            db=db,
            tenant_id=current_user.tenant_id,
            company_id=UUID("00000000-0000-0000-0000-000000000000"),  # mock UUID
            origem_tipo='SIMULATION',
            origem_id=UUID("00000000-0000-0000-0000-000000000000"),  # mock UUID
            valor_total=data.valor_total,
            data_inicial=data.data_inicial,
            tipo_distribuicao=data.tipo_distribuicao.value,
            parcelas_rules=data.parcelas,
            tipo_movimento='RECEBIMENTO'
        )
        
        # Format output
        simulated = [
            {
                "sequencia": pf.numero_parcela,
                "descricao": pf.descricao,
                "data_prevista": pf.data_prevista,
                "valor_previsto": float(pf.valor_previsto)
            }
            for pf in pfs
        ]
        
        # Clean up database operations (simulation shouldn't persist)
        for pf in pfs:
            db.expunge(pf)
            
        return simulated
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
