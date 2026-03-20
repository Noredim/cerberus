import requests
import json

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
        "product_id": "00000000-0000-0000-0000-000000000000",
        "descricao_item": "TEST PRODUCT",
        "quantidade_no_kit": 1
    }],
    "costs": [],
    "sales_budget_id": "147f0d08-e065-4fbf-8034-6ab4de731704"
}

r = requests.post("http://localhost:8000/opportunity-kits/preview", json=payload, headers={"tenant-id": "Noredim"})
print(f"Status: {r.status_code}")
print("Response text: ")
print(r.text)

