import uuid
from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.sql import func
from src.core.base import Base


class IntegrationLog(Base):
    __tablename__ = "integration_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    company_id = Column(UUID(as_uuid=True), ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, index=True)
    integration_type = Column(String(50), nullable=False, default="INSIDE_ERP", index=True)
    endpoint = Column(String(255), nullable=False)
    http_method = Column(String(10), nullable=False)
    status_code = Column(Integer, nullable=True)
    request_payload = Column(JSONB, nullable=True)
    response_payload = Column(JSONB, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    user_id = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
