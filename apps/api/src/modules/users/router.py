from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import List
from src.core.search import unaccent_ilike

from src.core.database import get_db
from src.core.security import get_password_hash, verify_password
from src.modules.users.models import User, UserRole, UserRoleEnum
from src.modules.users.schemas import UserResponse, UserCreate, UserUpdate, UserProfilePictureUpdate, UserPasswordUpdate
from src.modules.auth.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("", response_model=List[UserResponse])
def list_users(
    search: str = Query("", description="Filtrar por nome ou email"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(User).filter(User.tenant_id == current_user.tenant_id).options(joinedload(User.roles))

    if search:
        query = query.filter(
            unaccent_ilike(User.name, search) | unaccent_ilike(User.email, search)
        )

    users = query.options(joinedload(User.companies)).order_by(User.name).all()

    return [
        {
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "tenant_id": u.tenant_id,
            "is_active": u.is_active,
            "profile_picture": u.profile_picture,
            "roles": [r.role.value for r in u.roles],
            "companies": [str(c.company_id) for c in u.companies] if hasattr(u, "companies") else [],
        }
        for u in users
    ]


@router.patch("/{user_id}/toggle-active")
def toggle_user_active(
    user_id: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Only ADMIN should toggle, normally. Simplified here.
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    user.is_active = not user.is_active
    db.commit()
    return {"id": user.id, "is_active": user.is_active}

@router.post("", response_model=UserResponse)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Enforce ADMIN role later, trusting caller in MVP
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="E-mail já cadastrado")
        
    try:
        role_enum = UserRoleEnum(payload.role)
    except ValueError:
        raise HTTPException(status_code=400, detail="Perfil inválido")

    new_user = User(
        name=payload.name,
        email=payload.email,
        password_hash=get_password_hash(payload.password),
        tenant_id=current_user.tenant_id,
        is_active=True
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    user_role = UserRole(user_id=new_user.id, role=role_enum)
    db.add(user_role)
    db.commit()

    if getattr(payload, "companies", None):
        is_first = True
        for comp_id in payload.companies:
            new_uc = UserCompany(user_id=new_user.id, company_id=comp_id, is_default=is_first)
            db.add(new_uc)
            is_first = False
        db.commit()

    db.refresh(new_user)

    return format_user_response(new_user)

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: str,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")

    if payload.name is not None:
        user.name = payload.name
    if payload.email is not None and payload.email != user.email:
        existing_email = db.query(User).filter(User.email == payload.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="E-mail já está em uso")
        user.email = payload.email
    if payload.is_active is not None:
        user.is_active = payload.is_active
        
    if payload.roles is not None:
        # Recreate roles
        db.query(UserRole).filter(UserRole.user_id == user.id).delete()
        for role_str in payload.roles:
            try:
                role_enum = UserRoleEnum(role_str)
                db.add(UserRole(user_id=user.id, role=role_enum))
            except ValueError:
                pass # Skip invalid roles
                
    if payload.companies is not None:
        db.query(UserCompany).filter(UserCompany.user_id == user.id).delete()
        is_first = True
        for comp_id in payload.companies:
            db.add(UserCompany(user_id=user.id, company_id=comp_id, is_default=is_first))
            is_first = False

    db.commit()
    db.refresh(user)
    return format_user_response(user)

@router.put("/me/profile-picture", response_model=UserResponse)
def update_my_profile_picture(
    payload: UserProfilePictureUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    current_user.profile_picture = payload.profile_picture
    db.commit()
    return format_user_response(current_user)

@router.put("/me/reset-password")
def reset_my_password(
    payload: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
    
    current_user.password_hash = get_password_hash(payload.new_password)
    db.commit()
    return {"message": "Senha atualizada com sucesso"}

@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Não é possível excluir seu próprio usuário")
        
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
    db.delete(user)
    db.commit()
    
    return {"message": "Usuário excluído com sucesso", "id": user_id}

def format_user_response(u: User):
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "tenant_id": u.tenant_id,
        "is_active": u.is_active,
        "profile_picture": u.profile_picture,
        "roles": [r.role.value for r in u.roles] if u.roles else [],
        "companies": [str(c.company_id) for c in getattr(u, "companies", [])],
    }

from src.modules.users.schemas import UserCompanyResponse, UserCompanyAssign
from src.modules.users.models import UserCompany
from src.modules.companies.models import Company

@router.get("/me/companies", response_model=List[UserCompanyResponse])
def list_my_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List active companies available to the logged-in user.
    """
    user_comps = db.query(UserCompany).options(joinedload(UserCompany.company)).filter(
        UserCompany.user_id == current_user.id
    ).all()
    
    return [
        {
            "id": uc.id,
            "company_id": str(uc.company_id),
            "is_default": uc.is_default,
            "company_name": uc.company.razao_social,
            "company_cnpj": uc.company.cnpj
        }
        for uc in user_comps
    ]

@router.get("/{user_id}/companies", response_model=List[UserCompanyResponse])
def list_user_companies(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin: list companies assigned to a specific user.
    """
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
    user_comps = db.query(UserCompany).options(joinedload(UserCompany.company)).filter(
        UserCompany.user_id == user_id
    ).all()
    
    return [
        {
            "id": uc.id,
            "company_id": str(uc.company_id),
            "is_default": uc.is_default,
            "company_name": uc.company.razao_social,
            "company_cnpj": uc.company.cnpj
        }
        for uc in user_comps
    ]

@router.post("/{user_id}/companies", response_model=UserCompanyResponse)
def assign_user_company(
    user_id: str,
    payload: UserCompanyAssign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin: Assing a company to a user.
    """
    user = db.query(User).filter(User.id == user_id, User.tenant_id == current_user.tenant_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
    company = db.query(Company).filter(
        Company.id == payload.company_id, 
        Company.tenant_id == current_user.tenant_id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada no seu tenant")
        
    existing = db.query(UserCompany).filter(
        UserCompany.user_id == user_id,
        UserCompany.company_id == payload.company_id
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Usuário já possui acesso a esta empresa")
        
    # If it is the first company, make it default
    count = db.query(UserCompany).filter(UserCompany.user_id == user_id).count()
    is_default = payload.is_default or (count == 0)
    
    if is_default:
        # clear other defaults
        db.query(UserCompany).filter(UserCompany.user_id == user_id).update({"is_default": False})
        
    new_assignment = UserCompany(
        user_id=user_id,
        company_id=payload.company_id,
        is_default=is_default
    )
    db.add(new_assignment)
    db.commit()
    db.refresh(new_assignment)
    
    return {
        "id": new_assignment.id,
        "company_id": str(new_assignment.company_id),
        "is_default": new_assignment.is_default,
        "company_name": company.razao_social,
        "company_cnpj": company.cnpj
    }

@router.delete("/{user_id}/companies/{company_id}")
def unassign_user_company(
    user_id: str,
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Admin: Remove a company access from a user.
    """
    assignment = db.query(UserCompany).filter(
        UserCompany.user_id == user_id,
        UserCompany.company_id == company_id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Vínculo não encontrado")
        
    db.delete(assignment)
    
    # if it was default, make the next one default if exists
    if assignment.is_default:
        next_assignment = db.query(UserCompany).filter(UserCompany.user_id == user_id, UserCompany.id != assignment.id).first()
        if next_assignment:
            next_assignment.is_default = True
            
    db.commit()
    return {"message": "Acesso revogado com sucesso"}
