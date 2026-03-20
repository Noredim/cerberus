import sys
import os
sys.path.append("/app")

from fastapi.testclient import TestClient
from src.main import app
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from uuid import uuid4

def override_get_user():
    return User(id=uuid4(), email="test@test.com", is_active=True, default_company_id=uuid4())

app.dependency_overrides[get_current_user] = override_get_user

client = TestClient(app)

payload = {
    "nome_kit": "KIT TESTE 2",
    "descricao_kit": "",
    "quantidade_kits": 1,
    "tipo_contrato": "LOCACAO",
    "prazo_contrato_meses": 36,
    "prazo_instalacao_meses": 0,
    "fator_margem_locacao": 1,
    "taxa_juros_mensal": 3,
    "taxa_manutencao_anual": 20,
    "instalacao_inclusa": False,
    "percentual_instalacao": 10,
    "manutencao_inclusa": False,
    "fator_manutencao": None,
    "aliq_pis": 0,
    "aliq_cofins": 0,
    "aliq_csll": 4.8,
    "aliq_irpj": 2.88,
    "aliq_iss": 5,
    "custo_manut_mensal_kit": 0,
    "custo_suporte_mensal_kit": 0,
    "custo_seguro_mensal_kit": 0,
    "custo_logistica_mensal_kit": 0,
    "custo_software_mensal_kit": 0,
    "custo_itens_acessorios_mensal_kit": 0,
    "items": [{
        "product_id": "da1ccca7-2483-490b-ae9b-1663a8a3013c",
        "descricao_item": "TEST PRODUCT",
        "quantidade_no_kit": 1
    }],
    "costs": [],
    "sales_budget_id": "147f0d08-e065-4fbf-8034-6ab4de731704"
}

r = client.post("/opportunity-kits/preview", json=payload, headers={"tenant-id": "Noredim"})
print(f"STATUS: {r.status_code}")
print(f"BODY: {r.text}")
