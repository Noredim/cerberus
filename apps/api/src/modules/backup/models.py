import uuid
from sqlalchemy import Column, String, Integer, Boolean, DateTime, Text, func
from src.core.base import Base


def generate_uuid():
    return str(uuid.uuid4())


class BackupSettings(Base):
    __tablename__ = "backup_settings"

    id = Column(String, primary_key=True, default=generate_uuid)
    target_ip = Column(String(255), nullable=True)
    target_dir = Column(String(512), nullable=True)
    ssh_user = Column(String(255), nullable=True, default="root")
    ssh_port = Column(Integer, nullable=False, default=22)
    ssh_password = Column(String(512), nullable=True)
    cron_expression = Column(String(100), nullable=False, default="0 2 * * *")
    retention_count = Column(Integer, nullable=False, default=3)
    is_active = Column(Boolean, nullable=False, default=False)
    last_backup_at = Column(DateTime(timezone=True), nullable=True)
    last_backup_status = Column(String(50), nullable=True)
    last_backup_message = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), default=func.now(), onupdate=func.now(), nullable=True)
