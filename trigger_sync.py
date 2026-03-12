import requests
import sys

API_URL = "http://localhost:8000"

def get_token():
    payload = {"username": "wars@warslab.com.br", "password": "W@rs2026"}
    print(f"Logging in with {payload['username']}")
    r = requests.post(f"{API_URL}/auth/login", data=payload)
    if r.status_code != 200:
        print(f"Login failed: {r.status_code} {r.text}")
        sys.exit(1)
    return r.json()["access_token"]

def trigger_sync(token):
    headers = {"Authorization": f"Bearer {token}"}
    payload = {"source_ref": "2024-05", "dry_run": False}
    print("Triggering sync...")
    r = requests.post(f"{API_URL}/cnpj-public/sync", headers=headers, json=payload)
    print(f"Sync response: {r.status_code} {r.text}")

def main():
    token = get_token()
    trigger_sync(token)

if __name__ == "__main__":
    main()
