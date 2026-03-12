import requests
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

API_URL = "http://localhost:8000"

def test_admin_login():
    logger.info("1. Attempting login as wars@warslab.com.br")
    payload = {
        "email": "wars@warslab.com.br",
        "password": "W@rs2026"
    }
    
    response = requests.post(f"{API_URL}/auth/login", json=payload)
    if response.status_code != 200:
        logger.error(f"Login failed: {response.text}")
        return
    
    data = response.json()
    token = data["access_token"]
    logger.info(f"JWT Token generated: {token[:30]}...")

    logger.info("2. Accessing protected /me route")
    
    # We need the tenant id to access /me. Let's get it by querying the DB or maybe the token has it?
    # Our token payload includes tenant_id. So we can just decode it locally to get the tenant_id, 
    # or pass a dummy one if it isn't strictly validated on the route itself, but get_tenant_id header is required.
    import base64
    payload_part = token.split(".")[1]
    # Add padding if needed
    payload_part += "=" * ((4 - len(payload_part) % 4) % 4)
    decoded_payload = json.loads(base64.b64decode(payload_part).decode('utf-8'))
    tenant_id = decoded_payload.get("tenant_id")
    
    headers = {
        "Authorization": f"Bearer {token}",
        "X-Tenant-Id": tenant_id
    }
    response = requests.get(f"{API_URL}/auth/me", headers=headers)
    if response.status_code == 200:
        logger.info(f"Success! User Data: {json.dumps(response.json(), indent=2)}")
    else:
        logger.error(f"Failed to access /me: {response.text}")

if __name__ == "__main__":
    test_admin_login()
