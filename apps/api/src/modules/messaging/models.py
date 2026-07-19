import uuid
import enum
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, ForeignKey, func, Enum
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import relationship
from src.core.base import Base


def generate_uuid():
    return str(uuid.uuid4())


class RecipientsTypeEnum(enum.Enum):
    FIXED = "FIXED"
    DYNAMIC = "DYNAMIC"
    ROLE_BASED = "ROLE_BASED"


class EmailStatusEnum(enum.Enum):
    PENDING = "PENDING"
    RETRYING = "RETRYING"
    SENT = "SENT"
    FAILED = "FAILED"


class EmailConfig(Base):
    __tablename__ = "email_configs"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    smtp_host = Column(String(255), nullable=False)
    smtp_port = Column(Integer, nullable=False, default=587)
    smtp_user = Column(String(255), nullable=False)
    smtp_password_encrypted = Column(String(512), nullable=False)
    smtp_use_tls = Column(Boolean, default=True, nullable=False)
    smtp_use_ssl = Column(Boolean, default=False, nullable=False)
    sender_name = Column(String(255), nullable=False)
    sender_email = Column(String(255), nullable=False)
    
    # IMAP Configuration
    imap_host = Column(String(255), nullable=True)
    imap_port = Column(Integer, nullable=True, default=993)
    imap_user = Column(String(255), nullable=True)
    imap_password_encrypted = Column(String(512), nullable=True)
    imap_use_ssl = Column(Boolean, default=True, nullable=True)
    imap_use_tls = Column(Boolean, default=False, nullable=True)

    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=True)

    tenant = relationship("Tenant")


class EmailTrigger(Base):
    __tablename__ = "email_triggers"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    action_key = Column(String(100), nullable=False)
    action_label = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    subject_template = Column(String(500), nullable=False)
    body_template = Column(Text, nullable=False)
    recipients_type = Column(Enum(RecipientsTypeEnum), nullable=False, default=RecipientsTypeEnum.FIXED)
    recipients_fixed = Column(ARRAY(String), nullable=True)
    recipients_roles = Column(ARRAY(String), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=True)

    tenant = relationship("Tenant")


class EmailLog(Base):
    __tablename__ = "email_logs"

    id = Column(String, primary_key=True, default=generate_uuid)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), index=True, nullable=False)
    trigger_id = Column(String, ForeignKey("email_triggers.id", ondelete="SET NULL"), nullable=True)
    action_key = Column(String(100), nullable=False, index=True)
    source_module = Column(String(100), nullable=False)
    source_entity_id = Column(String, nullable=True)
    requested_by_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    requested_by_user_name = Column(String(255), nullable=False)
    recipient_email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=False)
    body_preview = Column(String(500), nullable=True)
    status = Column(Enum(EmailStatusEnum), nullable=False, default=EmailStatusEnum.PENDING)
    error_message = Column(Text, nullable=True)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=5, nullable=False)
    next_retry_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)

    tenant = relationship("Tenant")
    trigger = relationship("EmailTrigger")
    requested_by_user = relationship("User")
