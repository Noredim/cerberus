from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.modules.users.models import User
from src.core.security import verify_password, get_password_hash
from src.core.jwt import create_access_token
from src.modules.auth.schemas import UserLogin, Token
from src.modules.auth.dependencies import get_current_user
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(prefix="/auth", tags=["Auth"])

@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-mail ou senha incorretos",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(status_code=400, detail="Usuário inativo")

    roles = [role.role.name for role in user.roles]
    access_token = create_access_token(
        data={"user_id": user.id, "tenant_id": user.tenant_id, "roles": roles}
    )
    
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me")
def get_me(current_user: User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "tenant_id": current_user.tenant_id,
        "is_active": current_user.is_active,
        "roles": [role.role.name for role in current_user.roles]
    }


@router.post("/register")
def register(payload: UserLogin, tenant_id: str, db: Session = Depends(get_db)):
    # Simples endpoint de registro só para teste de desenvolvimento
    existing_user = db.query(User).filter(User.email == payload.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="E-mail já registrado")
    
    hashed_password = get_password_hash(payload.password)
    # Automatically get the first tenant, since we are moving away from passing it via the frontend temporarily or defaulting to the only tenant (cerberus local)
    from src.modules.tenants.models import Tenant
    tenant = db.query(Tenant).first()
    if not tenant:
        raise HTTPException(status_code=400, detail="No tenants found in db to assign.")

    new_user = User(
        email=payload.email,
        password_hash=hashed_password,
        name=payload.email.split("@")[0],
        tenant_id=tenant.id
    )
    db.add(new_user)
    db.commit()
    return {"message": "User registered successfully"}

