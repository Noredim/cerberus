from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class NotificationResponse(BaseModel):
    id: str
    tenant_id: str
    company_id: Optional[UUID] = None
    user_id: str
    title: str
    message: str
    opportunity_id: str
    opportunity_number: str
    vendedor_name: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
