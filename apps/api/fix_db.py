import sys
sys.path.append("/app")
from sqlalchemy import text
from src.core.database import SessionLocal

def main():
    db = SessionLocal()
    try:
        db.execute(text("UPDATE companies SET nomenclatura_orcamento = 'OV' WHERE nomenclatura_orcamento IS NULL"))
        db.execute(text("UPDATE companies SET numero_proposta = 1 WHERE numero_proposta IS NULL"))
        db.commit()
        print("Successfully backfilled companies with default fiscal parameters.")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    main()
