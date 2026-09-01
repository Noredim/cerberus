import uuid
from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from src.core.base import Base

def generate_uuid():
    return str(uuid.uuid4())

class UserGoogleIntegration(Base):
    __tablename__ = "user_google_integrations"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    
    google_email = Column(String(255), nullable=False)
    google_user_id = Column(String(255), nullable=True)
    
    access_token_encrypted = Column(String(1024), nullable=False)
    refresh_token_encrypted = Column(String(1024), nullable=True)
    token_expires_at = Column(DateTime(timezone=True), nullable=False)
    
    scopes = Column(JSONB, nullable=False, default=list)
    calendar_id = Column(String(255), nullable=False, default="primary")
    is_active = Column(Boolean, nullable=False, default=True)
    
    last_sync_at = Column(DateTime(timezone=True), nullable=True)
    last_error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User")
    tenant = relationship("Tenant")


class CalendarEventSyncLog(Base):
    __tablename__ = "calendar_event_sync_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    entity_type = Column(String(50), nullable=False, index=True)  # ex: 'LEAD_TASK'
    entity_id = Column(String(255), nullable=False, index=True)
    google_event_id = Column(String(255), nullable=True)
    
    action = Column(String(30), nullable=False)  # 'CREATE', 'UPDATE', 'DELETE'
    status = Column(String(30), nullable=False)  # 'SUCCESS', 'FAILED', 'SKIPPED'
    error_detail = Column(Text, nullable=True)
    
    synced_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    user = relationship("User")
    tenant = relationship("Tenant")
