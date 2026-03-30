from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from src.core.base import Base


class ManHour(Base):
    __tablename__ = "man_hours"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(String, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)

    vigencia = Column(Integer, nullable=False)

    hora_normal = Column(Numeric(precision=18, scale=4), nullable=False)
    hora_extra = Column(Numeric(precision=18, scale=4), nullable=False)
    hora_extra_adicional_noturno = Column(Numeric(precision=18, scale=4), nullable=False)
    hora_extra_domingos_feriados = Column(Numeric(precision=18, scale=4), nullable=False)
    hora_extra_domingos_feriados_noturno = Column(Numeric(precision=18, scale=4), nullable=False)

    ativo = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=text("now()"), nullable=False, onupdate=datetime.utcnow)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    tenant = relationship("Tenant")
    company = relationship("Company")
    role = relationship("Role")

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "company_id", "role_id", "vigencia",
            name="uq_man_hours_tenant_company_role_year"
        ),
    )
