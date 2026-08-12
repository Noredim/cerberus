from typing import Optional
from datetime import datetime
from pydantic import BaseModel, ConfigDict


class BackupSettingsSchema(BaseModel):
    id: str
    target_ip: Optional[str] = None
    target_dir: Optional[str] = None
    ssh_user: Optional[str] = "root"
    ssh_port: int = 22
    has_ssh_password: bool = False
    cron_expression: str = "0 2 * * *"
    retention_count: int = 3
    is_active: bool = False
    last_backup_at: Optional[datetime] = None
    last_backup_status: Optional[str] = None
    last_backup_message: Optional[str] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class BackupSettingsUpdate(BaseModel):
    target_ip: Optional[str] = None
    target_dir: Optional[str] = None
    ssh_user: Optional[str] = "root"
    ssh_port: int = 22
    ssh_password: Optional[str] = None  # None significa "manter a senha existente" se houver
    clear_ssh_password: bool = False
    cron_expression: str = "0 2 * * *"
    retention_count: int = 3
    is_active: bool = False


class TestDestinationRequest(BaseModel):
    target_ip: Optional[str] = None
    target_dir: Optional[str] = None
    ssh_user: Optional[str] = "root"
    ssh_port: int = 22
    ssh_password: Optional[str] = None
    use_saved_password: bool = False


class TestDestinationResponse(BaseModel):
    success: bool
    message: str


class BackupFileItem(BaseModel):
    filename: str
    size_formatted: str
    size_bytes: int
    created_at: datetime


class RunBackupResponse(BaseModel):
    success: bool
    message: str
    filename: str
    remote_destination: Optional[str] = None
