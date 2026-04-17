import requests

resp = requests.post(
    "http://localhost:8000/cadastro/clientes",
    json={
        "cnpj": "03848688000152",
        "razao_social": "TEST",
        "company_id": "d121c2cb-42d3-4483-8257-41b4c0d138cf"
    },
    headers={
        "X-Tenant-Id": "default",
        "X-Company-Id": "d121c2cb-42d3-4483-8257-41b4c0d138cf",
        # Might need a dummy auth token or we'll get 401 instead of 422
    }
)

print(resp.status_code)
print(resp.text)
