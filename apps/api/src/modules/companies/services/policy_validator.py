from decimal import Decimal
from sqlalchemy.orm import Session
from fastapi import HTTPException
from src.modules.users.models import User
from src.modules.professionals.models import Professional
from src.modules.companies.models import CompanyCommercialPolicy, CompanyCommercialPolicyRole

def validate_commercial_policy_limits(db: Session, current_user: User, company_id: str, factors: list[Decimal]):
    """
    Validates if the given factors exceed the maximum allowed factor for the user's role
    in the active company. Throws HTTPException 400 if any factor exceeds the limit.
    """
    # Exclude None or <= 0 factors from validation
    factors_to_validate = [f for f in factors if f is not None and f > 0]
    if not factors_to_validate:
        return

    professional = db.query(Professional).filter(
        Professional.user_id == current_user.id,
        Professional.tenant_id == current_user.tenant_id
    ).first()
    
    if not professional or not professional.role_id:
        return # Cannot validate if user has no role

    policies = db.query(CompanyCommercialPolicy).join(
        CompanyCommercialPolicyRole
    ).filter(
        CompanyCommercialPolicy.company_id == company_id,
        CompanyCommercialPolicy.ativo == True,
        CompanyCommercialPolicyRole.role_id == professional.role_id
    ).all()

    if not policies:
        return # No policy applied to this role, allow freely or fallback to strict? Usually allow freely if no policy.
        
    # Get the MINIMUM factor allowed for this user
    min_allowed = min(p.fator_limite for p in policies)

    for factor in factors_to_validate:
        if factor < min_allowed:
            raise HTTPException(
                status_code=400, 
                detail=f"Fator {factor} está abaixo do limite permitido da sua política comercial (Mínimo: {min_allowed})."
            )
