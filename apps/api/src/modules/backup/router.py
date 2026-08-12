import os
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from src.modules.backup.schemas import (
    BackupSettingsSchema,
    BackupSettingsUpdate,
    TestDestinationRequest,
    TestDestinationResponse,
    BackupFileItem,
    RunBackupResponse,
)
from src.modules.backup.services import (
    get_or_create_settings,
    test_backup_destination,
    run_backup_now,
    list_backup_files,
    delete_backup_file,
    BACKUP_DIR,
)
from src.modules.backup.scheduler import update_scheduler_job

router = APIRouter(prefix="/backup", tags=["Backup"])


def _to_schema(settings) -> BackupSettingsSchema:
    return BackupSettingsSchema(
        id=settings.id,
        target_ip=settings.target_ip,
        target_dir=settings.target_dir,
        ssh_user=settings.ssh_user,
        ssh_port=settings.ssh_port or 22,
        has_ssh_password=bool(settings.ssh_password),
        cron_expression=settings.cron_expression or "0 2 * * *",
        retention_count=settings.retention_count or 3,
        is_active=settings.is_active or False,
        last_backup_at=settings.last_backup_at,
        last_backup_status=settings.last_backup_status,
        last_backup_message=settings.last_backup_message,
        updated_at=settings.updated_at,
    )


@router.get("/settings", response_model=BackupSettingsSchema)
def get_backup_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    settings = get_or_create_settings(db)
    return _to_schema(settings)


@router.put("/settings", response_model=BackupSettingsSchema)
def update_backup_settings(
    payload: BackupSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    settings = get_or_create_settings(db)

    settings.target_ip = payload.target_ip
    settings.target_dir = payload.target_dir
    settings.ssh_user = payload.ssh_user or "root"
    settings.ssh_port = payload.ssh_port or 22
    settings.cron_expression = payload.cron_expression or "0 2 * * *"
    settings.retention_count = payload.retention_count if payload.retention_count is not None else 3
    settings.is_active = payload.is_active

    if payload.clear_ssh_password:
        settings.ssh_password = None
    elif payload.ssh_password is not None and payload.ssh_password.strip() != "":
        settings.ssh_password = payload.ssh_password.strip()

    db.commit()
    db.refresh(settings)

    # Reagendar ou desativar o job no APScheduler
    update_scheduler_job(db)

    return _to_schema(settings)


@router.post("/test", response_model=TestDestinationResponse)
def test_destination(
    payload: TestDestinationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ssh_pass = payload.ssh_password
    if payload.use_saved_password:
        settings = get_or_create_settings(db)
        ssh_pass = settings.ssh_password

    res = test_backup_destination(
        target_ip=payload.target_ip,
        target_dir=payload.target_dir,
        ssh_user=payload.ssh_user,
        ssh_port=payload.ssh_port,
        ssh_password=ssh_pass
    )
    return TestDestinationResponse(
        success=res["success"],
        message=res["message"]
    )


@router.post("/run", response_model=RunBackupResponse)
def execute_backup_now(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        res = run_backup_now(db)
        return RunBackupResponse(
            success=True,
            message=res["message"],
            filename=res["filename"],
            remote_destination=res.get("remote_destination")
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erro ao executar backup manual: {str(e)}"
        )


@router.get("/list", response_model=List[BackupFileItem])
def list_backups(
    current_user: User = Depends(get_current_user)
):
    return list_backup_files()


@router.get("/download/{filename}")
def download_backup(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    clean_filename = os.path.basename(filename)
    if not clean_filename.startswith("backup_") or not clean_filename.endswith(".sql.gz"):
        raise HTTPException(status_code=400, detail="Nome de arquivo inválido.")

    file_path = os.path.join(BACKUP_DIR, clean_filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Arquivo de backup não encontrado.")

    return FileResponse(
        path=file_path,
        media_type="application/gzip",
        filename=clean_filename
    )


@router.delete("/{filename}")
def remove_backup(
    filename: str,
    current_user: User = Depends(get_current_user)
):
    try:
        success = delete_backup_file(filename)
        if not success:
            raise HTTPException(status_code=404, detail="Arquivo de backup não encontrado.")
        return {"success": True, "message": f"Arquivo '{filename}' excluído com sucesso."}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao excluir arquivo: {str(e)}")
