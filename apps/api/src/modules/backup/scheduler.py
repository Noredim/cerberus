from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
import traceback

from src.core.database import SessionLocal
from src.modules.backup.models import BackupSettings
from src.modules.backup.services import run_backup_now, get_or_create_settings

scheduler = AsyncIOScheduler()
JOB_ID = "scheduled_db_backup"


def execute_scheduled_backup():
    print("[SCHEDULER] Iniciando backup agendado do banco de dados...")
    db: Session = SessionLocal()
    try:
        res = run_backup_now(db)
        print(f"[SCHEDULER SUCCESS] {res.get('message')}")
    except Exception as e:
        print(f"[SCHEDULER ERROR] Erro durante backup agendado: {e}")
        traceback.print_exc()
    finally:
        db.close()


def update_scheduler_job(db: Session = None):
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        settings = get_or_create_settings(db)
        if scheduler.get_job(JOB_ID):
            scheduler.remove_job(JOB_ID)

        if settings.is_active and settings.cron_expression:
            try:
                trigger = CronTrigger.from_crontab(settings.cron_expression)
                scheduler.add_job(
                    execute_scheduled_backup,
                    trigger=trigger,
                    id=JOB_ID,
                    replace_existing=True,
                    name="Backup do Banco PostgreSQL"
                )
                print(f"[SCHEDULER] Tarefa de backup agendada ativada com expressão Cron: '{settings.cron_expression}'")
            except Exception as cron_err:
                print(f"[SCHEDULER ERROR] Expressão cron inválida '{settings.cron_expression}': {cron_err}")
        else:
            print("[SCHEDULER] Tarefa de backup agendada está INATIVA.")

    except Exception as e:
        print(f"[SCHEDULER ERROR] Erro ao atualizar job de backup: {e}")
    finally:
        if close_db:
            db.close()


def start_backup_scheduler():
    if not scheduler.running:
        scheduler.start()
        print("[SCHEDULER] Scheduler do APScheduler iniciado.")
    update_scheduler_job()


def stop_backup_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        print("[SCHEDULER] Scheduler do APScheduler finalizado.")
