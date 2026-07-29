from pydantic import BaseModel
from typing import Optional, List

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[str] = None
    tenant_id: Optional[str] = None
    roles: List[str] = []

class UserLogin(BaseModel):
    email: str
    password: str
