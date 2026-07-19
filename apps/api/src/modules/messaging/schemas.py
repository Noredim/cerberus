from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from enum import Enum


class RecipientsType(str, Enum):
    FIXED = "FIXED"
    DYNAMIC = "DYNAMIC"
    ROLE_BASED = "ROLE_BASED"


class EmailStatus(str, Enum):
    PENDING = "PENDING"
    RETRYING = "RETRYING"
    SENT = "SENT"
    FAILED = "FAILED"


# --- EmailConfig Schemas ---

class EmailConfigCreate(BaseModel):
    smtp_host: str = Field(..., max_length=255)
    smtp_port: int = Field(default=587, ge=1, le=65535)
    smtp_user: str = Field(..., max_length=255)
    smtp_password: str = Field(..., min_length=1)
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False
    sender_name: str = Field(..., max_length=255)
    sender_email: EmailStr
    
    # Optional IMAP Configuration
    imap_host: Optional[str] = Field(None, max_length=255)
    imap_port: Optional[int] = Field(993, ge=1, le=65535)
    imap_user: Optional[str] = Field(None, max_length=255)
    imap_password: Optional[str] = None
    imap_use_ssl: Optional[bool] = True
    imap_use_tls: Optional[bool] = False


class EmailConfigUpdate(BaseModel):
    smtp_host: Optional[str] = Field(None, max_length=255)
    smtp_port: Optional[int] = Field(None, ge=1, le=65535)
    smtp_user: Optional[str] = Field(None, max_length=255)
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    smtp_use_ssl: Optional[bool] = None
    sender_name: Optional[str] = Field(None, max_length=255)
    sender_email: Optional[EmailStr] = None

    # Optional IMAP Configuration
    imap_host: Optional[str] = Field(None, max_length=255)
    imap_port: Optional[int] = Field(None, ge=1, le=65535)
    imap_user: Optional[str] = Field(None, max_length=255)
    imap_password: Optional[str] = None
    imap_use_ssl: Optional[bool] = None
    imap_use_tls: Optional[bool] = None


class EmailConfigResponse(BaseModel):
    id: str
    tenant_id: str
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_use_tls: bool
    smtp_use_ssl: bool
    sender_name: str
    sender_email: str
    
    # IMAP Configuration
    imap_host: Optional[str] = None
    imap_port: Optional[int] = None
    imap_user: Optional[str] = None
    imap_use_ssl: Optional[bool] = None
    imap_use_tls: Optional[bool] = None

    is_active: bool
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- EmailTrigger Schemas ---

class EmailTriggerCreate(BaseModel):
    action_key: str = Field(..., max_length=100)
    action_label: str = Field(..., max_length=255)
    is_active: bool = True
    subject_template: str = Field(..., max_length=500)
    body_template: str
    recipients_type: RecipientsType = RecipientsType.FIXED
    recipients_fixed: Optional[List[str]] = None
    recipients_roles: Optional[List[str]] = None


class EmailTriggerUpdate(BaseModel):
    action_label: Optional[str] = Field(None, max_length=255)
    is_active: Optional[bool] = None
    subject_template: Optional[str] = Field(None, max_length=500)
    body_template: Optional[str] = None
    recipients_type: Optional[RecipientsType] = None
    recipients_fixed: Optional[List[str]] = None
    recipients_roles: Optional[List[str]] = None


class EmailTriggerResponse(BaseModel):
    id: str
    tenant_id: str
    action_key: str
    action_label: str
    is_active: bool
    subject_template: str
    body_template: str
    recipients_type: RecipientsType
    recipients_fixed: Optional[List[str]] = None
    recipients_roles: Optional[List[str]] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# --- EmailLog Schemas ---

class EmailLogResponse(BaseModel):
    id: str
    tenant_id: str
    trigger_id: Optional[str] = None
    action_key: str
    source_module: str
    source_entity_id: Optional[str] = None
    requested_by_user_id: Optional[str] = None
    requested_by_user_name: str
    recipient_email: str
    subject: str
    body_preview: Optional[str] = None
    status: EmailStatus
    error_message: Optional[str] = None
    retry_count: int
    max_retries: int
    next_retry_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


# --- Test Email Schema ---

class EmailTestRequest(BaseModel):
    recipient_email: EmailStr
    subject: Optional[str] = "Cerberus - E-mail de Teste"
    body: Optional[str] = "Este é um e-mail de teste enviado pelo Cerberus para validar a configuração SMTP."
    smtp_host: Optional[str] = None
    smtp_port: Optional[int] = None
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_use_tls: Optional[bool] = None
    smtp_use_ssl: Optional[bool] = None
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None



# --- Available Actions Schema ---

class VariableSchema(BaseModel):
    name: str
    description: str

class AvailableAction(BaseModel):
    key: str
    label: str
    module: str
    variables: List[VariableSchema] = []

