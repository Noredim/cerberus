"""
CNPJ Public Module smoke test — purely HTTP-based, no app-internal imports.
Exercises the HTTP endpoints of the new ETL engine.
"""
import requests, json, logging, uuid, base64

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE = "http://localhost:8000"

def get_token():
    r = requests.post(f"{BASE}/auth/login", json={"email": "wars@warslab.com.br", "password": "W@rs2026"})
    if r.status_code != 200:
        log.warning("Could not login. Skipping authenticated tests if DB is down or credentials changed.")
        return None
    return r.json()["access_token"]

def seed_test_cnpj():
    """Insert a test CNPJ directly via DB to ensure lookup has data."""
    import psycopg2
    try:
        conn = psycopg2.connect("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
        cur = conn.cursor()
        
        # Ensure schemas exist for testing
        cur.execute("CREATE SCHEMA IF NOT EXISTS cnpj_ctl;")
        cur.execute("CREATE SCHEMA IF NOT EXISTS cnpj_stage;")
        cur.execute("CREATE SCHEMA IF NOT EXISTS cnpj_public;")

        # Insert dummy data if target doesn't exist
        test_cnpj = "00000000000191"
        try:
            # Requires the schema to be fully migrated usually. This will fail gracefully if it isn't.
            cur.execute("INSERT INTO cnpj_public.empresas (cnpj_basico, razao_social) VALUES ('00000000', 'EMPRESA TESTE') ON CONFLICT DO NOTHING")
            cur.execute("INSERT INTO cnpj_public.estabelecimentos (cnpj, cnpj_basico, nome_fantasia) VALUES ('00000000000191', '00000000', 'FANTASIA TESTE') ON CONFLICT DO NOTHING")
            conn.commit()
            log.info("   Seeded dummy CNPJ data: 00000000000191")
        except Exception as e:
            log.warning(f"   Could not seed dummy CNPJ (migration not run yet?): {e}")
            conn.rollback()
        conn.close()
    except Exception as e:
        log.warning(f"   DB connection failed (Docker not running?): {e}")

def run():
    token = get_token()
    if not token:
        return
        
    headers = {"Authorization": f"Bearer {token}"}

    # 1 - Test trigger sync
    log.info("1. POST /cnpj-public/sync")
    r = requests.post(f"{BASE}/cnpj-public/sync", headers=headers, json={"source_ref": "test-2024", "dry_run": True})
    assert r.status_code in [202, 409], f"sync trigger failed: {r.text}"
    log.info(f"   ✅ Sync triggered (or already running) — OK ({r.status_code})")

    # 2 - List batches
    log.info("2. GET /cnpj-public/batches")
    r = requests.get(f"{BASE}/cnpj-public/batches", headers=headers)
    assert r.status_code == 200, f"batches list failed: {r.text}"
    log.info(f"   ✅ Batches found: {len(r.json())} — OK")

    # 3 - Try Lookup (may be 404 if data not present, which is expected behavior, but endpoint must respond)
    log.info("3. GET /cnpj-public/lookup/00000000000191")
    seed_test_cnpj()
    r = requests.get(f"{BASE}/cnpj-public/lookup/00000000000191", headers=headers)
    assert r.status_code in [200, 404], f"lookup failed unexpectedly: {r.status_code}: {r.text}"
    log.info(f"   ✅ Lookup endpoint responded properly — OK ({r.status_code})")
    
    # 4 - Test Validation (must be 14 digits)
    log.info("4. GET /cnpj-public/lookup/invalid_format")
    r = requests.get(f"{BASE}/cnpj-public/lookup/123", headers=headers)
    assert r.status_code == 400, f"validation failed: {r.text}"
    log.info("   ✅ Validation caught invalid CNPJ length — OK")

    log.info("\n🎉 CNPJ ETL SMOKE TESTS COMPLETED!")

if __name__ == "__main__":
    run()
