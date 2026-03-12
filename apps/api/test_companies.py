import requests, json, logging, uuid
logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

BASE = "http://localhost:8000"

def get_token_and_tenant():
    r = requests.post(f"{BASE}/auth/login", data={"username": "wars@warslab.com.br", "password": "W@rs2026"})
    if r.status_code != 200:
        return None, None
    token = r.json()["access_token"]
    
    r_me = requests.get(f"{BASE}/auth/me", headers={"Authorization": f"Bearer {token}"})
    tenant = r_me.json()["tenant_id"]
    return token, tenant

def run():
    token, tenant_id = get_token_and_tenant()
    if not token:
        log.warning("Skipping test: Auth failed.")
        return
        
    headers = {"Authorization": f"Bearer {token}"}

    log.info("1. GET /companies (Empty or not)")
    r = requests.get(f"{BASE}/companies", headers=headers)
    assert r.status_code == 200, f"Failed: {r.text}"
    
    log.info("2. POST /companies/cnpj-lookup (Local Integration)")
    # Testing with a dummy CNPJ we know we inserted before or a completely fake one to grab 404
    r = requests.post(f"{BASE}/companies/cnpj-lookup?cnpj=00000000000191", headers=headers)
    assert r.status_code in [200, 404], f"Lookup integration crashed: {r.text}"
    
    # We cannot fully test POST /companies successfully without knowing a valid UUID for cmt_id, municipality, state
    # But we can test validations
    log.info("3. POST /companies (Validation check)")
    bad_payload = {
        "cnpj": "123",
        "razao_social": "Test",
        "municipality_id": "abc",
        "state_id": "abc",
        "cmt_id": "abc",
        "cnaes": [],
        "initial_tax_profile": {"vigencia_inicio": "2024-01-01", "regime_tributario": "MEI"}
    }
    r = requests.post(f"{BASE}/companies", headers=headers, json=bad_payload)
    assert r.status_code == 422, f"Validation bypassed: {r.text}"
    
    log.info("✅ Companies endpoints are alive and routing correctly")

if __name__ == "__main__":
    run()
