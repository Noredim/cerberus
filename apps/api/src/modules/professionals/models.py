from sqlalchemy import Column, String, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
import uuid

from src.core.base import Base

class Professional(Base):
    __tablename__ = "professionals"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    cpf = Column(String, nullable=False)
    role_id = Column(String, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    tenant = relationship("Tenant")
    role = relationship("Role")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint('tenant_id', 'user_id', name='uq_tenant_user_professional'),
    )
