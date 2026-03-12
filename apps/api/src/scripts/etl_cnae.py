import os
import sys
import argparse
import csv
import logging
import unicodedata
from datetime import datetime, timezone
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

# Build connection string from environment or use a default
DATABASE_URL = os.getenv("ETL_DATABASE_URL") or os.getenv("DATABASE_URL")
if not DATABASE_URL:
    logger.error("DATABASE_URL or ETL_DATABASE_URL not set in environment.")
    sys.exit(1)

# Ensure psycopg2 is used (if PostgreSQL string)
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+psycopg2://", 1)
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)

try:
    engine = create_engine(DATABASE_URL)
except Exception as e:
    logger.error(f"Failed to create database engine: {e}")
    sys.exit(1)

def normalize_text(text_str):
    """Lowercase + remove accents + trim"""
    if not text_str:
        return ""
    text_str = text_str.strip().lower()
    # Remove accents using NFD normalization
    normalized = unicodedata.normalize("NFD", text_str)
    return "".join(c for c in normalized if unicodedata.category(c) != "Mn")

def normalize_code(codigo_str):
    """Remove anything that is not a digit"""
    if not codigo_str:
        return ""
    return "".join(filter(str.isdigit, str(codigo_str)))

def import_cnae(file_path):
    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        sys.exit(1)

    logger.info(f"Starting import from: {file_path}")
    source_filename = os.path.basename(file_path)
    now = datetime.now(timezone.utc)

    stats = {
        "read": 0,
        "valid": 0,
        "inserted": 0,
        "updated": 0,
        "ignored": 0
    }

    # Detect encoding (utf-8 with fallback to latin-1)
    encoding = "utf-8"
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            f.read(1024)
    except UnicodeDecodeError:
        encoding = "latin-1"
        logger.info("UTF-8 decoding failed. Falling back to latin-1.")

    try:
        with open(file_path, "r", encoding=encoding) as f:
            
            # Use sniffer to detect delimiter, fallback to ';'
            dialect = csv.Sniffer().sniff(f.read(1024))
            f.seek(0)
            
            # We expect a semicolon separator as per metadata
            reader = csv.reader(f, delimiter=';' if dialect.delimiter != ';' else dialect.delimiter)
            
            # Read first row
            try:
                header = next(reader)
                stats["read"] += 1
            except StopIteration:
                logger.error("Empty CSV file")
                sys.exit(1)
            
            # Check if header is actual data or a header row
            has_header = False
            try:
                # If first column is purely digits or formatted like a CNAE code, it's likely data, not a header
                if any(char.isdigit() for char in header[0]):
                   # It's data, we need to process it
                   # Reset file pointer
                   f.seek(0)
                   reader = csv.reader(f, delimiter=';')
                else:
                    has_header = True
            except IndexError:
                pass


            with engine.begin() as conn:
                # 1. Truncate staging table safely
                conn.execute(text("TRUNCATE TABLE gov.stg_cnae"))
                logger.info("Truncated staging table.")
                
                staging_records = []
                # Process rows
                for row in reader:
                    stats["read"] += 1
                    
                    if len(row) < 2:
                        continue # Skip invalid rows
                    
                    # Assume mapping by position (col1=CODIGO, col2=DESCRICAO)
                    codigo_raw = row[0].strip()
                    descricao_raw = row[1].strip()

                    # Validation
                    if not codigo_raw or not descricao_raw:
                        continue
                    
                    stats["valid"] += 1
                    staging_records.append({
                        "codigo_raw": codigo_raw,
                        "descricao_raw": descricao_raw,
                        "source_file": source_filename,
                        "loaded_at": now
                    })
                
                # Bulk insert into staging
                if staging_records:
                   conn.execute(
                       text("""
                           INSERT INTO gov.stg_cnae (codigo_raw, descricao_raw, source_file, loaded_at) 
                           VALUES (:codigo_raw, :descricao_raw, :source_file, :loaded_at)
                       """),
                       staging_records
                   )
                   logger.info(f"Loaded {len(staging_records)} records into staging.")

                # 2. Upsert into dimension table from staging
                upsert_query = text("""
                    WITH normalized_data AS (
                        SELECT 
                            TRIM(codigo_raw) as codigo,
                            TRIM(descricao_raw) as descricao,
                            regexp_replace(codigo_raw, '\\D', '', 'g') as codigo_norm,
                            -- Lowercase and remove accents
                            unaccent(lower(TRIM(descricao_raw))) as descricao_norm,
                            source_file
                        FROM gov.stg_cnae
                        WHERE TRIM(codigo_raw) != '' AND TRIM(descricao_raw) != ''
                    )
                    INSERT INTO gov.dim_cnae (
                        codigo, descricao, codigo_norm, descricao_norm, 
                        source_file, source_loaded_at, created_at, updated_at
                    )
                    SELECT 
                        codigo, descricao, codigo_norm, descricao_norm, 
                        source_file, :now, :now, :now
                    FROM normalized_data
                    ON CONFLICT (codigo) DO UPDATE SET
                        descricao = EXCLUDED.descricao,
                        codigo_norm = EXCLUDED.codigo_norm,
                        descricao_norm = EXCLUDED.descricao_norm,
                        source_file = EXCLUDED.source_file,
                        source_loaded_at = EXCLUDED.source_loaded_at,
                        updated_at = EXCLUDED.updated_at
                    WHERE gov.dim_cnae.descricao != EXCLUDED.descricao;
                """)
                
                # Check if unaccent extension is installed, if not, install it or fall back to Python normalization
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS unaccent;"))
                    
                    # Execute UPSERT natively in database
                    result = conn.execute(upsert_query, {"now": now})
                    
                    # Postgres doesn't easily differentiate insert vs update in a single statement result count without RETURNING and extra logic.
                    # For simplicity, we just count the total affected rows (inserted + updated)
                    total_affected = result.rowcount
                    logger.info(f"UPSERT complete. Records inserted/updated: {total_affected}")
                    stats["inserted"] = total_affected # Simplified metric
                    stats["ignored"] = stats["valid"] - total_affected
                    
                except Exception as e:
                    logger.warning(f"Native UPSERT failed (likely missing unaccent extension): {e}. Falling back to Python-based upsert.")
                    
                    # Python fallback UPSERT logic
                    for record in staging_records:
                        codigo = record["codigo_raw"].strip()
                        descricao = record["descricao_raw"].strip()
                        codigo_norm = normalize_code(codigo)
                        descricao_norm = normalize_text(descricao)
                        
                        # Check existence and current description
                        existing = conn.execute(
                            text("SELECT descricao FROM gov.dim_cnae WHERE codigo = :codigo"), 
                            {"codigo": codigo}
                        ).fetchone()
                        
                        if existing:
                            if existing[0] != descricao:
                                # Update needed
                                conn.execute(text("""
                                    UPDATE gov.dim_cnae 
                                    SET descricao = :descricao, 
                                        codigo_norm = :codigo_norm,
                                        descricao_norm = :descricao_norm,
                                        source_file = :source_file,
                                        source_loaded_at = :now,
                                        updated_at = :now
                                    WHERE codigo = :codigo
                                """), {
                                    "codigo": codigo, "descricao": descricao, "codigo_norm": codigo_norm, "descricao_norm": descricao_norm, "source_file": source_filename, "now": now
                                })
                                stats["updated"] += 1
                            else:
                                stats["ignored"] += 1
                        else:
                            # Insert needed
                            conn.execute(text("""
                                INSERT INTO gov.dim_cnae (codigo, descricao, codigo_norm, descricao_norm, source_file, source_loaded_at, created_at, updated_at)
                                VALUES (:codigo, :descricao, :codigo_norm, :descricao_norm, :source_file, :now, :now, :now)
                            """), {
                                "codigo": codigo, "descricao": descricao, "codigo_norm": codigo_norm, "descricao_norm": descricao_norm, "source_file": source_filename, "now": now
                            })
                            stats["inserted"] += 1

    except Exception as e:
        logger.error(f"Error during import: {e}")
        sys.exit(1)

    logger.info("Import Complete!")
    logger.info(f"Lines Read: {stats['read']}")
    logger.info(f"Valid Records: {stats['valid']}")
    logger.info(f"Records Inserted: {stats['inserted']}")
    logger.info(f"Records Updated: {stats['updated']}")
    logger.info(f"Records Ignored (No changes): {stats['ignored']}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Import CNAE CSV into ETL database.")
    parser.add_argument("--file", required=True, help="Path to the CNAE CSV file")
    args = parser.parse_args()
    
    import_cnae(args.file)
