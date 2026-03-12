import psycopg2

def run():
    print("Running migration V001_cnpj_schemas...")
    conn = psycopg2.connect("postgresql://cerberus_user:cerberus_password@localhost:5432/cerberus")
    conn.autocommit = True
    cur = conn.cursor()
    with open('apps/api/migrations/V001__cnpj_schemas.sql', 'r', encoding='utf-8') as f:
        sql = f.read()
    cur.execute(sql)
    print("Migration successful.")
    conn.close()

if __name__ == "__main__":
    run()
