from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

class GoogleAuthUrlResponse(BaseModel):
    auth_url: str

class GoogleCallbackRequest(BaseModel):
    code: str
    state: str

class GoogleIntegrationStatusResponse(BaseModel):
    is_connected: bool
    is_active: bool = False
    google_email: Optional[str] = None
    last_sync_at: Optional[datetime] = None
    last_error_message: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class CalendarEventData(BaseModel):
    summary: str
    description: Optional[str] = None
    start_time: datetime
    end_time: datetime
    time_zone: str = "America/Sao_Paulo"
    location: Optional[str] = None
    attendees: Optional[List[str]] = None
