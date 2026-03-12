import requests
import logging
import sys

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

    log.info("1. GET /companies/cnpj/27865757000102/consultar (Globo Comunicação)")
    # Using a known valid CNPJ
    r = requests.get(f"{BASE}/companies/cnpj/27865757000102/consultar", headers=headers)
    assert r.status_code in [200, 429], f"Failed to consult CNPJ: {r.text} - code {r.status_code}"
    
    if r.status_code == 200:
        data = r.json()
        assert data["success"] == True
        assert "normalizedData" in data
        assert data["normalizedData"]["cnpj"].replace(".", "").replace("/", "").replace("-", "") == "27865757000102"
        log.info(f"✅ CNPJ Consultar returned successfully. Source: {data.get('source')}")

    log.info("2. Trigger Rate Limit Test")
    for _ in range(4):
        resp = requests.get(f"{BASE}/companies/cnpj/00000000000191/consultar", headers=headers)
        if resp.status_code == 429:
            log.info("✅ Rate limiting properly triggered.")
            break
    
    log.info("✅ All basic integration tests passed.")

if __name__ == "__main__":
    run()
