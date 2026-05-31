import uuid
from sqlalchemy import Column, String, ForeignKey, Boolean, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from src.core.base import Base

def generate_uuid():
    return str(uuid.uuid4())

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    title = Column(String, nullable=False)
    message = Column(String, nullable=False)
    opportunity_id = Column(String, nullable=False)
    opportunity_number = Column(String, nullable=False)
    vendedor_name = Column(String, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    tenant = relationship("Tenant")
    company = relationship("Company")
    user = relationship("User")
