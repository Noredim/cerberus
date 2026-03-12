"""
CMT Module smoke test — purely HTTP-based, no app-internal imports.
Creates a Municipality via psycopg2 directly, then exercises the HTTP endpoints.
"""
import requests, json, logging, uuid, base64

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE = "http://localhost:8000"

def get_token():
    r = requests.post(f"{BASE}/auth/login", json={"email": "wars@warslab.com.br", "password": "W@rs2026"})
    assert r.status_code == 200, f"Login failed: {r.text}"
    return r.json()["access_token"]

def decode_tenant(token):
    part = token.split(".")[1]
    part += "=" * ((4 - len(part) % 4) % 4)
    return json.loads(base64.b64decode(part))["tenant_id"]

def seed_municipality(ibge="5103403", name="Cuiabá", state="MT"):
    """Insert a Municipality directly via DB if not exists."""
    import psycopg2
    conn = psycopg2.connect("postgresql://cerberus_user:cerberus_password@db:5432/cerberus")
    cur = conn.cursor()
    cur.execute("SELECT id FROM municipalities WHERE ibge_code = %s", (ibge,))
    row = cur.fetchone()
    if row:
        muni_id = row[0]
        log.info(f"   Municipality already exists: {muni_id}")
    else:
        muni_id = str(uuid.uuid4())
        cur.execute(
            "INSERT INTO municipalities (id, ibge_code, name, state) VALUES (%s, %s, %s, %s)",
            (muni_id, ibge, name, state)
        )
        conn.commit()
        log.info(f"   Seeded Municipality: {name} → {muni_id}")
    conn.close()
    return muni_id

def run():
    token = get_token()
    tenant_id = decode_tenant(token)
    headers = {"Authorization": f"Bearer {token}", "X-Tenant-Id": tenant_id}

    # 1 - Download CSV template
    log.info("1. GET /cmt/template.csv")
    r = requests.get(f"{BASE}/cmt/template.csv")
    assert r.status_code == 200, f"template.csv failed: {r.text}"
    assert "municipal_code" in r.text
    log.info("   ✅ Template CSV — OK")

    # 2 - List municipalities (global, no auth required)
    log.info("2. GET /cmt/municipalities")
    r = requests.get(f"{BASE}/cmt/municipalities")
    assert r.status_code == 200, f"municipalities list failed: {r.text}"
    log.info(f"   ✅ Municipalities: {len(r.json())} rows — OK")

    # 3 - Seed a municipality via DB and create a source document via API
    log.info("3. Seeding municipality and creating a CMT source document")
    muni_id = seed_municipality()

    r = requests.post(f"{BASE}/cmt/documents", headers=headers, json={
        "municipality_id": muni_id,
        "document_name": "CTM Cuiabá Jan/2025",
        "document_type": "CTM",
        "valid_from": "2025-01-01"
    })
    assert r.status_code == 200, f"create doc failed: {r.text}"
    doc = r.json()
    assert doc["status"] == "DRAFT"
    log.info(f"   ✅ Document created — id={doc['id']} status={doc['status']}")

    # 4 - Activate document
    log.info("4. POST /cmt/documents/{id}/activate")
    r = requests.post(f"{BASE}/cmt/documents/{doc['id']}/activate", headers=headers)
    assert r.status_code == 200, f"activate failed: {r.text}"
    assert r.json()["status"] == "ACTIVE"
    log.info("   ✅ Document activated — OK")

    # 5 - List municipalities again to confirm our seed is visible
    log.info("5. GET /cmt/municipalities (post-seed)")
    r = requests.get(f"{BASE}/cmt/municipalities")
    assert r.status_code == 200
    muni_names = [m["name"] for m in r.json()]
    assert "Cuiabá" in muni_names
    log.info(f"   ✅ Cuiabá present in list — OK")

    log.info("\n🎉 ALL CMT SMOKE TESTS PASSED!")

if __name__ == "__main__":
    run()
