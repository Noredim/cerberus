import requests
import json
import sys

res = requests.get('http://localhost:8000/api/v1/sales-budgets?skip=0&limit=1', headers={'X-Tenant-Id': 'tenant-uuid'})
if res.status_code != 200:
    print('Failed to get budgets')
    sys.exit(1)

budgets = res.json()
if not budgets:
    print('No budgets found')
    sys.exit(1)

budget = budgets[0]
budget_id = budget['id']

res = requests.get(f'http://localhost:8000/api/v1/sales-budgets/{budget_id}')
details = res.json()

if not details.get('rental_items'):
    print('No rental items found in budget')
    sys.exit(1)

item = details['rental_items'][0]
original_prazo = item.get('prazo_contrato')
print(f'Original prazo: {original_prazo}')

# Overwrite to 11
item['prazo_contrato'] = 11

payload = details.copy()
payload['customer_id'] = payload['customer_id'] or '00000000-0000-0000-0000-000000000000'
res = requests.put(f'http://localhost:8000/api/v1/sales-budgets/{budget_id}', json=payload)
print(res.status_code)

res = requests.get(f'http://localhost:8000/api/v1/sales-budgets/{budget_id}')
details_after = res.json()
print(f'After update prazo: {details_after["rental_items"][0]["prazo_contrato"]}')
