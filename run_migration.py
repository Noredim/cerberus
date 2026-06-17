import os
import sys
import psycopg2

def sanitize_db_url(url: str) -> str:
    if not url or not url.startswith("postgres"):
        return url
    
    import re
    from urllib.parse import quote_plus
    
    scheme = ""
    if "://" in url:
        scheme, rest = url.split("://", 1)
    else:
        scheme, rest = "postgresql", url

    if "@" in rest:
        parts = rest.rsplit("@", 1)
        user_pass = parts[0]
        host_db = parts[1]
        if ":" in user_pass:
            user, pwd = user_pass.split(":", 1)
            if "%" not in pwd or not re.match(r'%[0-9a-fA-F]{2}', pwd):
                pwd = quote_plus(pwd)
            return f"{scheme}://{user}:{pwd}@{host_db}"
            
    return url

def run():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            sys.path.append(os.path.join(current_dir, 'apps', 'api'))
            from src.core.config import settings
            database_url = settings.DATABASE_URL
        except Exception as e:
            # Fallback to local default connection string
            database_url = "postgresql://cerberus_user:cerberus_password@localhost:5432/cerberus"

    database_url = sanitize_db_url(database_url)
    print("Connecting to database to run SQL migrations...")
    try:
        conn_str = database_url
        if conn_str.startswith("postgresql+psycopg2://"):
            conn_str = conn_str.replace("postgresql+psycopg2://", "postgresql://", 1)

        conn = psycopg2.connect(conn_str)
        conn.autocommit = True
        cur = conn.cursor()
        
        # 1. Run V001
        print("Running SQL migration V001__cnpj_schemas.sql...")
        v001_path = os.path.join(os.path.dirname(__file__), 'apps', 'api', 'migrations', 'V001__cnpj_schemas.sql')
        with open(v001_path, 'r', encoding='utf-8') as f:
            sql1 = f.read()
        cur.execute(sql1)
        print("V001__cnpj_schemas.sql executed successfully.")

        # 2. Run V002
        print("Running SQL migration V002__companies_tax_profiles.sql...")
        v002_path = os.path.join(os.path.dirname(__file__), 'apps', 'api', 'migrations', 'V002__companies_tax_profiles.sql')
        with open(v002_path, 'r', encoding='utf-8') as f:
            sql2 = f.read()
        cur.execute(sql2)
        print("V002__companies_tax_profiles.sql executed successfully.")
        
        # 3. Run V003
        print("Running SQL migration V003__solution_analysis_budget_refs.sql...")
        v003_path = os.path.join(os.path.dirname(__file__), 'apps', 'api', 'migrations', 'V003__solution_analysis_budget_refs.sql')
        with open(v003_path, 'r', encoding='utf-8') as f:
            sql3 = f.read()
        cur.execute(sql3)
        print("V003__solution_analysis_budget_refs.sql executed successfully.")
        
        # 4. Run V004
        print("Running SQL migration V004__licitacao_item_quantity_fields.sql...")
        v004_path = os.path.join(os.path.dirname(__file__), 'apps', 'api', 'migrations', 'V004__licitacao_item_quantity_fields.sql')
        with open(v004_path, 'r', encoding='utf-8') as f:
            sql4 = f.read()
        cur.execute(sql4)
        print("V004__licitacao_item_quantity_fields.sql executed successfully.")
        
        conn.close()
        print("All SQL migrations completed successfully!")
    except Exception as e:
        print(f"Error executing SQL migrations: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run()
