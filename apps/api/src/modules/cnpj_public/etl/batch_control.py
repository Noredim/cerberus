# src/modules/cnpj_public/etl/batch_control.py
from sqlalchemy.orm import Session
from datetime import datetime
from uuid import uuid4
from src.modules.cnpj_public.models import BatchRun

def create_batch_run(
    db: Session, 
    source_name: str, 
    source_ref: str, 
    user_id: str = None
) -> str:
    batch_id = str(uuid4())
    run = BatchRun(
        batch_id=batch_id,
        status="RUNNING",
        source_name=source_name,
        source_ref=source_ref,
        created_by=user_id,
        started_at=datetime.utcnow()
    )
    db.add(run)
    db.commit()
    return batch_id

def finish_batch_run(
    db: Session, 
    batch_id: str, 
    status: str, # "SUCCESS" or "FAILED"
    error_message: str = None,
    rows_stage_json: dict = None,
    rows_public_json: dict = None
):
    run = db.query(BatchRun).filter(BatchRun.batch_id == batch_id).first()
    if run:
        run.status = status
        run.finished_at = datetime.utcnow()
        if error_message:
            run.error_message = error_message
        if rows_stage_json:
            run.rows_stage_json = rows_stage_json
        if rows_public_json:
            run.rows_public_json = rows_public_json
        db.commit()
