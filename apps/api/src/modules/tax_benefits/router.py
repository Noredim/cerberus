from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import uuid

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.companies.models import TaxBenefit, CompanyBenefit, Company
from .schemas import TaxBenefitBase, TaxBenefitOut, CompanyBenefitBase, CompanyBenefitOut

router = APIRouter(prefix="/tax-benefits", tags=["Tax Benefits"])

@router.post("", response_model=TaxBenefitOut, status_code=status.HTTP_201_CREATED)
def create_benefit(
    payload: TaxBenefitBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cria uma nova regra parametrizada de Benefício Fiscal para o Tenant.
    A validação estrutural do 'regra_json' é garantida via Pydantic Schema.
    """
    benefit = TaxBenefit(
        tenant_id=current_user.tenant_id,
        nome=payload.nome,
        descricao=payload.descricao,
        esfera=payload.esfera,
        tributo_alvo=payload.tributo_alvo,
        tipo_beneficio=payload.tipo_beneficio,
        regra_json=payload.regra_json.model_dump(mode="json"), # Serializa os decimals p/ floats e enum do Pydantic perfeitamente
        requer_habilitacao=payload.requer_habilitacao,
        documento_base=payload.documento_base,
        ativo=payload.ativo
    )
    db.add(benefit)
    db.commit()
    db.refresh(benefit)
    return benefit

@router.get("", response_model=List[TaxBenefitOut])
def list_benefits(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(TaxBenefit).filter(TaxBenefit.tenant_id == current_user.tenant_id).all()

@router.get("/{benefit_id}", response_model=TaxBenefitOut)
def get_benefit(
    benefit_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    benefit = db.query(TaxBenefit).filter(
        TaxBenefit.id == benefit_id, 
        TaxBenefit.tenant_id == current_user.tenant_id
    ).first()
    if not benefit:
        raise HTTPException(status_code=404, detail="Benefício não encontrado.")
    return benefit

@router.put("/{benefit_id}", response_model=TaxBenefitOut)
def update_benefit(
    benefit_id: str,
    payload: TaxBenefitBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    benefit = db.query(TaxBenefit).filter(
        TaxBenefit.id == benefit_id, 
        TaxBenefit.tenant_id == current_user.tenant_id
    ).first()
    if not benefit:
        raise HTTPException(status_code=404, detail="Benefício não encontrado.")
    
    # Update fields
    benefit.nome = payload.nome
    benefit.descricao = payload.descricao
    benefit.esfera = payload.esfera
    benefit.tributo_alvo = payload.tributo_alvo
    benefit.tipo_beneficio = payload.tipo_beneficio
    benefit.regra_json = payload.regra_json.model_dump(mode="json")
    benefit.requer_habilitacao = payload.requer_habilitacao
    benefit.documento_base = payload.documento_base
    benefit.ativo = payload.ativo
    
    db.commit()
    db.refresh(benefit)
    return benefit

# =========== Ações da Empresa x Benefícios ============

@router.post("/companies/{company_id}/benefits", response_model=CompanyBenefitOut)
def link_benefit_to_company(
    company_id: str,
    payload: CompanyBenefitBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Adiciona um Benefício Fiscal a uma Empresa determinando sua vigência e prioridade de cálculo.
    """
    # Verifica dono
    company = db.query(Company).filter(Company.id == company_id, Company.tenant_id == current_user.tenant_id).first()
    if not company:
        raise HTTPException(404, "Empresa não encontrada.")

    benefit = db.query(TaxBenefit).filter(TaxBenefit.id == payload.benefit_id, TaxBenefit.tenant_id == current_user.tenant_id).first()
    if not benefit:
        raise HTTPException(404, "Benefício inválido no Tenant.")

    company_benefit = CompanyBenefit(
        company_id=company.id,
        benefit_id=benefit.id,
        vigencia_inicio=payload.vigencia_inicio,
        vigencia_fim=payload.vigencia_fim,
        prioridade=payload.prioridade,
        status=payload.status,
        observacao=payload.observacao
    )
    db.add(company_benefit)
    db.commit()
    db.refresh(company_benefit)
    return company_benefit

@router.get("/companies/{company_id}/benefits", response_model=List[CompanyBenefitOut])
def list_company_benefits(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Lista todos os benefícios (ativos ou inativos/históricos) associados à empresa
    """
    company = db.query(Company).filter(Company.id == company_id, Company.tenant_id == current_user.tenant_id).first()
    if not company:
        raise HTTPException(404, "Empresa não encontrada")

    return db.query(CompanyBenefit).filter(CompanyBenefit.company_id == company.id).order_by(CompanyBenefit.prioridade.desc()).all()

@router.patch("/companies/{company_id}/benefits/{link_id}/disable")
def disable_company_benefit(
    company_id: str,
    link_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Regra de negócio: Só os Admins do tenant podem desativar a força (Plan RBAC requirement)
    if "ADMIN" not in [r.role.name for r in current_user.roles]:
        raise HTTPException(403, "Obrigatório permissão de ADMIN para revogar benefício.")

    link = db.query(CompanyBenefit).join(Company).filter(
        CompanyBenefit.id == link_id,
        Company.id == company_id,
        Company.tenant_id == current_user.tenant_id
    ).first()

    if not link:
        raise HTTPException(404, "Vínculo não encontrado.")

    link.status = "INATIVO"
    from datetime import date
    link.vigencia_fim = date.today() # Fecha a vigência na revogação
    db.commit()
    return {"message": "Benefício revogado."}
