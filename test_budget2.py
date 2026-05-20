import sys
sys.path.append('/app')
try:
    from src.core.database import SessionLocal
    from sqlalchemy import text
    db = SessionLocal()
    result = db.execute(text("SELECT id, budget_id, prazo_contrato FROM rental_budget_items ORDER BY created_at DESC LIMIT 5"))
    for row in result:
        print(f"Item ID: {row[0]}, Budget ID: {row[1]}, Prazo: {row[2]}")
except Exception as e:
    print(e)
