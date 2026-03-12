# src/modules/cnpj_public/etl/pipeline.py
import logging
from src.core.database import SessionLocal, engine
from .batch_control import finish_batch_run
from .stage_loader import copy_to_stage, get_stage_counts
from .normalizer import upsert_to_public, get_public_counts

logger = logging.getLogger(__name__)

def run_cnpj_sync_job(batch_id: str, source_ref: str, dry_run: bool = False):
    """
    Main background job function that orchestrates the ETL pipeline.
    """
    logger.info(f"Starting CnpjPublicSyncJob for batch {batch_id}")
    db = SessionLocal()
    
    try:
        if dry_run:
            logger.info("DRY RUN mode. Bypassing download and db updates.")
            finish_batch_run(
                db, batch_id, 
                status="SUCCESS", 
                rows_stage_json={"dry_run": True}, 
                rows_public_json={"dry_run": True}
            )
            return

        # 1. Download
        logger.info("Downloading GovBr files...")
        # Since this is a placeholder MVP, we assume files are locally present 
        # inside /tmp/cnpj_data/ or returned by a real downloader.
        # files = downloader.download(source_ref, "/tmp/cnpj_data")
        # For testing, we send empty dict so COPY does nothing and errors out if we actually tried
        # to process empty files. Or we can just pretend it downloaded 0 files.
        files = {"empresas": [], "estabelecimentos": [], "cnaes": []}
        
        # 2. Stage Load (COPY)
        logger.info("Copying to stage...")
        copy_to_stage(engine, batch_id, files)
        stage_counts = get_stage_counts(engine, batch_id)

        # 3. Normalize & Upsert
        logger.info("Normalizing and Upserting to public...")
        upsert_to_public(engine, batch_id)
        pub_counts = get_public_counts(engine, batch_id)

        # 4. Success Completion
        finish_batch_run(db, batch_id, status="SUCCESS", rows_stage_json=stage_counts, rows_public_json=pub_counts)
        logger.info(f"Batch {batch_id} completed successfully.")

    except Exception as e:
        logger.error(f"Batch {batch_id} failed: {str(e)}")
        finish_batch_run(db, batch_id, status="FAILED", error_message=str(e))
    finally:
        db.close()
