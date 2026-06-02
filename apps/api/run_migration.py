import os
import sys
import psycopg2

def run():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        try:
            # Add current path to python path to import settings
            current_dir = os.path.dirname(os.path.abspath(__file__))
            if current_dir not in sys.path:
                sys.path.append(current_dir)
            from src.core.config import settings
            database_url = settings.DATABASE_URL
        except Exception as e:
            print(f"Error loading database settings: {e}")
            sys.exit(1)

    print("Connecting to database to run SQL migrations...")
    try:
        # Convert connection string if it contains sqlalchemy dialect parts
        conn_str = database_url
        if conn_str.startswith("postgresql+psycopg2://"):
            conn_str = conn_str.replace("postgresql+psycopg2://", "postgresql://", 1)

        conn = psycopg2.connect(conn_str)
        conn.autocommit = True
        cur = conn.cursor()
        
        # 1. Run V001
        print("Running SQL migration V001__cnpj_schemas.sql...")
        v001_path = os.path.join(os.path.dirname(__file__), 'migrations', 'V001__cnpj_schemas.sql')
        with open(v001_path, 'r', encoding='utf-8') as f:
            sql1 = f.read()
        cur.execute(sql1)
        print("V001__cnpj_schemas.sql executed successfully.")

        # 2. Run V002
        print("Running SQL migration V002__companies_tax_profiles.sql...")
        v002_path = os.path.join(os.path.dirname(__file__), 'migrations', 'V002__companies_tax_profiles.sql')
        with open(v002_path, 'r', encoding='utf-8') as f:
            sql2 = f.read()
        cur.execute(sql2)
        print("V002__companies_tax_profiles.sql executed successfully.")
        # 3. Run V003
        print("Running SQL migration V003__solution_analysis_budget_refs.sql...")
        v003_path = os.path.join(os.path.dirname(__file__), 'migrations', 'V003__solution_analysis_budget_refs.sql')
        with open(v003_path, 'r', encoding='utf-8') as f:
            sql3 = f.read()
        cur.execute(sql3)
        print("V003__solution_analysis_budget_refs.sql executed successfully.")
        
        conn.close()
        print("All SQL migrations completed successfully! ✅")
    except Exception as e:
        print(f"Error executing SQL migrations: {e}")
        sys.exit(1)

if __name__ == "__main__":
    run()
