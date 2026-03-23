import uuid
from sqlalchemy import Column, String, Boolean, Float, ForeignKey
from sqlalchemy.orm import relationship
from src.core.base import Base

def generate_uuid():
    return str(uuid.uuid4())

class FunctionalProfile(Base):
    __tablename__ = "functional_profiles"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, nullable=False)
    margin_factor_limit = Column(Float, nullable=False)
    view_director_consolidation = Column(Boolean, default=False)
    is_protected = Column(Boolean, default=False)
