import requests, json, logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

SERVICES = [
    ("cerberus-api",            "http://localhost:8000/health"),
    ("tax-engine",              "http://localhost:8001/health"),
    ("cost-engine",             "http://localhost:8002/health"),
    ("pricing-engine",          "http://localhost:8003/health"),
    ("contract-engine",         "http://localhost:8004/health"),
]

passed = 0
failed = 0
for name, url in SERVICES:
    try:
        r = requests.get(url, timeout=5)
        if r.status_code == 200:
            log.info(f"✅  {name}: {r.json()}")
            passed += 1
        else:
            log.error(f"❌  {name}: HTTP {r.status_code}")
            failed += 1
    except Exception as e:
        log.error(f"❌  {name}: Unreachable — {e}")
        failed += 1

print(f"\nHealth Check: {passed} UP / {failed} DOWN")
if failed:
    raise SystemExit(1)
