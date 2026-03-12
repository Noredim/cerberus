# src/modules/cnpj_public/models.py
from sqlalchemy import Column, String, DateTime, func, JSON
from sqlalchemy.dialects.postgresql import UUID
from src.core.database import SessionLocal
import uuid

# Declarative base is not directly defined here since we will use Raw SQL for the CNPJ tables for querying.
# But we can map the batch_runs table.
from sqlalchemy.orm import declarative_base

CnpjBase = declarative_base()

class BatchRun(CnpjBase):
    __tablename__ = "batch_runs"
    __table_args__ = {"schema": "cnpj_ctl"}

    batch_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    started_at = Column(DateTime, default=func.now())
    finished_at = Column(DateTime, nullable=True)
    status = Column(String(50), nullable=False) # RUNNING, SUCCESS, FAILED
    source_name = Column(String, nullable=False)
    source_ref = Column(String, nullable=True)
    files_json = Column(JSON, nullable=True)
    rows_stage_json = Column(JSON, nullable=True)
    rows_public_json = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    created_by = Column(UUID(as_uuid=True), nullable=True)
    created_at = Column(DateTime, default=func.now())
