import sys
import os
from datetime import date
from decimal import Decimal
import io
import openpyxl

# Add path so src can be resolved
sys.path.append('c:/cerberus/apps/api')

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from src.modules.ncm.models import Ncm
from src.modules.ncm_tipi.models import TipiImportacao, NcmTipi
from src.modules.ncm_tipi.service import TipiService

def run_tests():
    print("Iniciando testes unitarios e de integracao do Modulo TIPI...")
    
    # Setup DB connection
    engine = create_engine("postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    # Define test codes
    ncm1_code = "99999999"
    ncm2_code = "88888888"

    # Clean up any potential leftover test records
    db.query(NcmTipi).filter(NcmTipi.aliquota == Decimal("12.5000")).delete()
    db.query(Ncm).filter(Ncm.codigo.in_([ncm1_code, ncm2_code])).delete()
    db.commit()

    # 1. Insert two NCMs into database to resolve
    ncm1 = Ncm(
        codigo=ncm1_code,
        descricao="NCM Teste 1 - TIPI",
        data_inicio=date(2026, 1, 1),
        data_fim=date(2030, 12, 31)
    )
    ncm2 = Ncm(
        codigo=ncm2_code,
        descricao="NCM Teste 2 - TIPI",
        data_inicio=date(2026, 1, 1),
        data_fim=date(2030, 12, 31)
    )
    db.add(ncm1)
    db.add(ncm2)
    db.commit()
    db.refresh(ncm1)
    db.refresh(ncm2)

    # 2. Create in-memory mock Excel sheet representing different validation cases
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["NCM Codigo", "Aliquota (%)"]) # Headers containing "NCM" and "Aliquota"

    # Row 1: Valid NCM 1, Aliquota 12.5% -> Should be IMPORTED
    ws.append(["99.999.999", "12,5%"])
    # Row 2: Valid NCM 2, Aliquota 10.0% -> Should be IMPORTED
    ws.append(["88888888", 10.0])
    # Row 3: Non-existent NCM, Aliquota 5% -> Should be IGNORED
    ws.append(["77777777", "5.0"])
    # Row 4: Valid NCM 1, Aliquota = 0 -> Should be IGNORED
    ws.append(["99999999", "0"])
    # Row 5: Valid NCM 2, Aliquota textual -> Should be IGNORED
    ws.append(["88888888", "NT"])
    # Row 6: Empty fields -> Should be IGNORED
    ws.append([None, None])

    file_stream = io.BytesIO()
    wb.save(file_stream)
    file_bytes = file_stream.getvalue()

    # 3. Call the import service
    import_date = date(2026, 6, 23)
    importacao = TipiService.importar_tipi(db, file_bytes, "planilha_teste_tipi.xlsx", import_date)

    print(f"Status da Importacao: {importacao.status}")
    print(f"Total de Linhas Processadas: {importacao.total_linhas}")
    print(f"Total Importadas: {importacao.total_importados}")
    print(f"Total Ignoradas: {importacao.total_ignorados}")
    print(f"Total Erros: {importacao.total_erros}")

    # 4. Assertions on service results
    assert importacao.status == "CONCLUIDO", "Importação deveria ter status CONCLUIDO"
    assert importacao.total_linhas == 5, "Deveria registrar 5 linhas processadas"
    assert importacao.total_importados == 2, "Deveria ter importado exatamente 2 registros"
    assert importacao.total_ignorados == 3, "Deveria ter ignorado exatamente 3 registros"
    assert importacao.total_erros == 0, "Deveria ter 0 erros não tratados"

    # 5. Assertions on database content
    relations = db.query(NcmTipi).filter(NcmTipi.importacao_id == importacao.id).all()
    assert len(relations) == 2, "Deveria haver exatamente 2 relações criadas no banco"
    
    for rel in relations:
        if rel.ncm_id == ncm1.id:
            assert rel.aliquota == Decimal("12.5000"), f"Alíquota incorreta para NCM1: {rel.aliquota}"
        elif rel.ncm_id == ncm2.id:
            assert rel.aliquota == Decimal("10.0000"), f"Alíquota incorreta para NCM2: {rel.aliquota}"
            
    # 6. Verify listing functions
    importacoes, total_imp = TipiService.get_importacoes(db, 0, 10)
    assert total_imp >= 1, "Deveria listar pelo menos 1 importação"
    
    valores, total_val = TipiService.get_valores(db, 0, 10, codigo_ncm="88888888")
    assert total_val == 1, "Filtro de valores por NCM código deveria retornar 1 registro"
    assert valores[0].codigo_ncm == "88888888"
    assert valores[0].aliquota == Decimal("10.0000")

    # 7. Clean up test records
    db.query(NcmTipi).filter(NcmTipi.importacao_id == importacao.id).delete()
    db.query(TipiImportacao).filter(TipiImportacao.id == importacao.id).delete()
    db.query(Ncm).filter(Ncm.id.in_([ncm1.id, ncm2.id])).delete()
    db.commit()

    print("SUCCESS: Todos os testes do modulo TIPI passaram com sucesso!")

if __name__ == "__main__":
    run_tests()
