from pydantic import BaseModel

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: str | None = None
    tenant_id: str | None = None
    roles: list[str] = []

class UserLogin(BaseModel):
    email: str
    password: str
