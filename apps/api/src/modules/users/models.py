import uuid
from sqlalchemy import Column, String, Boolean, ForeignKey, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.core.base import Base
import enum

def generate_uuid():
    return str(uuid.uuid4())

class UserRoleEnum(enum.Enum):
    ADMIN = "ADMIN"
    ENGENHARIA_PRECO = "ENGENHARIA_PRECO"
    DIRETORIA = "DIRETORIA"

class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(Enum(UserRoleEnum), nullable=False)

    user = relationship("User", back_populates="roles")


class UserCompany(Base):
    __tablename__ = "user_companies"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    is_default = Column(Boolean, default=False)
    
    user = relationship("User", back_populates="companies")
    company = relationship("Company", back_populates="users")

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    companies = relationship("UserCompany", back_populates="user", cascade="all, delete-orphan")
