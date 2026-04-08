import uuid

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from src.core.base import Base
import src.modules.roles.models


class OwnService(Base):
    """Header entity: a named internal service with annual scope."""

    __tablename__ = "own_services"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)

    nome_servico = Column(String(200), nullable=False)
    unidade = Column(String(10), nullable=True)
    vigencia = Column(Integer, nullable=False)
    descricao = Column(Text, nullable=True)
    tempo_total_minutos = Column(Integer, nullable=False, default=0)

    ativo = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    company = relationship("Company")
    items = relationship(
        "OwnServiceItem",
        back_populates="service",
        cascade="all, delete-orphan",
        order_by="OwnServiceItem.id",
    )

    __table_args__ = (
        UniqueConstraint(
            "tenant_id", "company_id", "nome_servico", "vigencia",
            name="uq_own_services_name_year",
        ),
    )


class OwnServiceItem(Base):
    """Detail entity: one cargo + time entry within an OwnService."""

    __tablename__ = "own_service_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    own_service_id = Column(
        UUID(as_uuid=True),
        ForeignKey("own_services.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role_id = Column(String, ForeignKey("roles.id", ondelete="RESTRICT"), nullable=False)

    # fator: decimal time factor (1.0 = 1 hour). Replaces tempo_minutos.
    fator = Column(Numeric(precision=10, scale=4), nullable=False, default=0)
    # tempo_minutos kept for backward compatibility; derived from fator
    tempo_minutos = Column(Integer, nullable=False, default=0)
    tempo_total_minutos = Column(Integer, nullable=False, default=0)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    service = relationship("OwnService", back_populates="items")
    role = relationship("Role")

    __table_args__ = (
        UniqueConstraint(
            "own_service_id", "role_id",
            name="uq_own_service_items_service_role",
        ),
    )
