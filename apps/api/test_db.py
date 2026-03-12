from sqlalchemy import create_engine
import sys

DATABASE_URL = "postgresql://cerberus_user:cerberus_password@127.0.0.1:5433/cerberus"

try:
    engine = create_engine(DATABASE_URL)
    with engine.connect() as conn:
        print("Connection successful!")
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)
