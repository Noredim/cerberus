from fastapi.testclient import TestClient
from src.main import app
from src.modules.auth.dependencies import check_not_engenharia_preco, get_current_user

class MockUser:
    id = "dummy-user-id"
    tenant_id = "dummy-tenant-id"

# Bypass the router dependencies to avoid auth problems during mock test
app.dependency_overrides[check_not_engenharia_preco] = lambda: MockUser()
app.dependency_overrides[get_current_user] = lambda: MockUser()

client = TestClient(app)

def test_download_modelo_csv():
    response = client.get("/cadastro/ncm-st/modelo-csv")
    assert response.status_code == 200
    assert "text/csv" in response.headers["content-type"]
    assert "attachment; filename=modelo_importacao_ncm_st.csv" in response.headers["content-disposition"]
    
    content = response.text
    lines = content.strip().split("\n")
    assert len(lines) == 2
    
    header = lines[0]
    expected_header = "item,ativo,ncm_sh,ncm_normalizado,cest,descricao,observacoes,vigencia_inicio,fundamento,segmento_anexo,cest_normalizado,mva_percent,vigencia_fim"
    assert header == expected_header
    
    example = lines[1]
    assert example.startswith("1,true,")
    print("Test passed successfully!")

def test_import_non_utf8_csv():
    # Create an ISO-8859-1 encoded CSV content with latin characters like 'ç' or 'ã'
    headers_line = "item,ativo,ncm_sh,ncm_normalizado,cest,descricao,observacoes,vigencia_inicio,fundamento,segmento_anexo,cest_normalizado,mva_percent,vigencia_fim\n"
    data_line = "1,true,84713012,84713012,2103100,Computador portátil com acentuação,Exemplo de observação,2026-01-01,Decreto,Inf,2103100,12.00,\n"
    csv_bytes = (headers_line + data_line).encode("iso-8859-1")
    
    from src.modules.ncm_st.service import NcmStService
    original_get_header = NcmStService.get_header
    original_import_csv = NcmStService.import_csv
    
    class DummyHeader:
        id = "3ab6b60b-116e-4ad7-a998-b234386f347d"
        
    NcmStService.get_header = lambda db, header_id, tenant_id: DummyHeader()
    NcmStService.import_csv = lambda db, header_id, csv_text, strategy: (1, 1, 0)
    
    try:
        response = client.post(
            "/cadastro/ncm-st/3ab6b60b-116e-4ad7-a998-b234386f347d/importar-csv",
            data={"strategy": "REPLACE"},
            files={"file": ("test.csv", csv_bytes, "text/csv")}
        )
        assert response.status_code == 200
        assert response.json()["success_count"] == 1
        print("Import non-utf8 test passed successfully!")
    finally:
        NcmStService.get_header = original_get_header
        NcmStService.import_csv = original_import_csv

if __name__ == "__main__":
    test_download_modelo_csv()
    test_import_non_utf8_csv()
