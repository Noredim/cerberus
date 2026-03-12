import psycopg2
import sys

dsn = "host=127.0.0.1 port=5432 dbname=cerberus user=cerberus_user password=cerberus_password"

try:
    conn = psycopg2.connect(dsn)
    print("Connection successful!")
    conn.close()
except Exception as e:
    print(f"Connection failed: {e}")
    sys.exit(1)
