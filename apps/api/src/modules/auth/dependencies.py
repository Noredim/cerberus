from fastapi import Header, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from src.core.database import get_db
from src.core.config import settings
from src.modules.tenants.models import Tenant
from src.modules.users.models import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

def get_tenant_id(x_tenant_id: str = Header(..., description="ID do Tenant OBRIGATÓRIO")):
    if not x_tenant_id:
        raise HTTPException(status_code=400, detail="X-Tenant-Id header missing")
    return x_tenant_id

def verify_tenant(tenant_id: str = Depends(get_tenant_id), db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant não encontrado")
    return tenant

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Não foi possível validar as credenciais",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        user_id: str = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise credentials_exception
    return user


def get_active_company(
    x_company_id: str = Header(None, description="ID da Empresa de Trabalho ativa"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Validates that the provided X-Company-Id is valid and the current user has access to it.
    If no header is provided, this dependency returns None (for endpoints that don't STRICTLY require a company context).
    If an endpoint STRICTLY requires it, the route handler should check `if not company_id: raise HTTPException(400)`.
    """
    if not x_company_id:
        return None
        
    from src.modules.users.models import UserCompany
    
    # Check if the user has access to this company
    has_access = db.query(UserCompany).filter(
        UserCompany.user_id == current_user.id,
        UserCompany.company_id == x_company_id
    ).first()
    
    if not has_access:
        raise HTTPException(status_code=403, detail="Você não tem acesso a esta empresa ou ela não existe.")
        
    return x_company_id

