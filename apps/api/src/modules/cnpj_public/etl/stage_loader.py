# src/modules/cnpj_public/etl/stage_loader.py
import logging

logger = logging.getLogger(__name__)

def copy_to_stage(engine, batch_id: str, file_paths: dict):
    """
    Executes PostgreSQL COPY command for lightning-fast bulk loading into staging tables.
    """
    table_mapping = {
        "empresas": "cnpj_stage.empresas_raw",
        "estabelecimentos": "cnpj_stage.estabelecimentos_raw",
        "cnaes": "cnpj_stage.cnaes_raw"
    }

    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()
        
        for file_type, paths in file_paths.items():
            table_name = table_mapping.get(file_type)
            if not table_name:
                continue
                
            for file_path in paths:
                logger.info(f"COPYing {file_path} to {table_name}")
                # For a real implementation, the CSV delimiter and encoding depends on GovBr format
                # Often it is ';' and LATIN1. 
                # Note: We must inject the batch_id. Typical COPY doesn't easily set a constant column 
                # unless using a staging temp table. A trick is to copy to a temp table, then insert.
                # but for simplicity in MVP, we assume the CSV is mapped, or we do it via psycopg2 temp:
                copy_query = f"COPY {table_name} FROM STDIN WITH CSV DELIMITER ';' ENCODING 'LATIN1'"
                with open(file_path, 'r', encoding='latin1') as f:
                    cursor.copy_expert(copy_query, f)
                
                # Update batch_id for rows just inserted that have null batch_id
                cursor.execute(f"UPDATE {table_name} SET batch_id = %s WHERE batch_id IS NULL", (batch_id,))

        raw_conn.commit()
    except Exception as e:
        raw_conn.rollback()
        raise e
    finally:
        raw_conn.close()

def get_stage_counts(engine, batch_id: str) -> dict:
    raw_conn = engine.raw_connection()
    counts = {}
    try:
        cursor = raw_conn.cursor()
        for table in ["empresas_raw", "estabelecimentos_raw", "cnaes_raw"]:
            cursor.execute(f"SELECT COUNT(*) FROM cnpj_stage.{table} WHERE batch_id = %s", (batch_id,))
            counts[table] = cursor.fetchone()[0]
    finally:
        raw_conn.close()
    return counts
