import sys
import os
import unittest
from decimal import Decimal

# Adicionar apps/api ao sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'apps', 'api')))

from src.core.database import SessionLocal, engine
from src.core.base import Base
from src.modules.users.models import User
from src.modules.tenants.models import Tenant
from src.modules.fiscal.models import FiscalDocument, FiscalDocumentItem
from src.modules.tax_recovery.models import TaxRecoveryAnalysis, TaxRecoveryDocument, TaxRecoveryItemResult
from src.modules.tax_recovery.service import TaxRecoveryService
from src.modules.tax_recovery.schemas import TaxRecoveryCreate


def run_tax_recovery_tests():
    print("=== INICIANDO SUÍTE DE TESTES: MÓDULO DE RECUPERAÇÃO DE IMPOSTOS ===")
    
    # Criar apenas as tabelas necessárias para esta suíte de testes no SQLite
    for table_model in [Tenant, User, FiscalDocument, FiscalDocumentItem, TaxRecoveryAnalysis, TaxRecoveryDocument, TaxRecoveryItemResult]:
        table_model.__table__.create(bind=engine, checkfirst=True)
    
    db = SessionLocal()

    try:
        # Obter ou criar tenant e usuário de teste
        tenant = db.query(Tenant).first()
        if not tenant:
            tenant = Tenant(
                id="tenant_test_123",
                cnpj="12345678000195",
                razao_social="Empresa Teste LTDA",
                nome_fantasia="Empresa Teste"
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)

        tenant_id = tenant.id
        user = db.query(User).filter(User.tenant_id == tenant_id).first()
        if not user:
            user = User(
                id="user_test_123",
                tenant_id=tenant_id,
                email="admin@teste.com",
                full_name="Usuario Teste",
                password_hash="fakehash",
                is_active=True
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        user_id = str(user.id)

        print(f"[TEST 1] Validação de finalidade de entrada == destinação real...")
        try:
            invalid_data = TaxRecoveryCreate(
                name="Análise Inválida",
                entry_purpose="REVENDA",
                real_destination="REVENDA",
                description="Teste de validação"
            )
            TaxRecoveryService.create_analysis(db, tenant_id, user_id, invalid_data)
            print("❌ FALHA: Deveria ter lançado exceção para finalidades iguais.")
            return False
        except Exception as e:
            print("✅ PASSOU: Validação de finalidades iguais funcionando corretamente.")

        print(f"[TEST 2] Criação de análise com finalidades distintas...")
        valid_data = TaxRecoveryCreate(
            name="Recuperação ICMS-ST/DIFAL Equipamentos SP-MG",
            entry_purpose="REVENDA",
            real_destination="ATIVO_IMOBILIZADO",
            description="Reenquadramento de compras para Ativo Imobilizado"
        )
        analysis = TaxRecoveryService.create_analysis(db, tenant_id, user_id, valid_data)
        assert analysis.id is not None
        assert analysis.status == "RASCUNHO"
        print(f"✅ PASSOU: Análise criada com ID {analysis.id}")

        print(f"[TEST 3] Importação de XML de teste e verificação de não duplicidade de notas...")
        dummy_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
        <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
            <NFe>
                <infNFe Id="NFe35260812345678000195550010000012341000012345" versao="4.00">
                    <ide>
                        <cUF>35</cUF>
                        <cNF>00001234</cNF>
                        <natOp>Venda de Mercadoria</natOp>
                        <mod>55</mod>
                        <serie>1</serie>
                        <nNF>1234</nNF>
                        <dhEmi>2026-08-01T10:00:00-03:00</dhEmi>
                        <tpNF>1</tpNF>
                        <idDest>2</idDest>
                        <cMunFG>3550308</cMunFG>
                    </ide>
                    <emit>
                        <CNPJ>12345678000195</CNPJ>
                        <xNome>Fornecedor SP Eletronicos LTDA</xNome>
                        <enderEmit>
                            <UF>SP</UF>
                        </enderEmit>
                    </emit>
                    <dest>
                        <CNPJ>98765432000111</CNPJ>
                        <xNome>Empresa Cerberus Destino</xNome>
                        <enderDest>
                            <UF>MG</UF>
                        </enderDest>
                    </dest>
                    <det nItem="1">
                        <prod>
                            <cProd>PROD-001</cProd>
                            <xProd>Servidor Rack 2U Dell PowerEdge</xProd>
                            <NCM>84715010</NCM>
                            <CFOP>6102</CFOP>
                            <uCom>UN</uCom>
                            <qCom>2.0000</qCom>
                            <vUnCom>5000.0000</vUnCom>
                            <vProd>10000.00</vProd>
                        </prod>
                        <imposto>
                            <ICMS>
                                <ICMS10>
                                    <orig>0</orig>
                                    <CST>10</CST>
                                    <vBC>10000.00</vBC>
                                    <pICMS>12.00</pICMS>
                                    <vICMS>1200.00</vICMS>
                                    <vBCST>14000.00</vBCST>
                                    <pICMSST>18.00</pICMSST>
                                    <vICMSST>1320.00</vICMSST>
                                </ICMS10>
                            </ICMS>
                        </imposto>
                    </det>
                    <total>
                        <ICMSTot>
                            <vProd>10000.00</vProd>
                            <vNF>11320.00</vNF>
                            <vBC>10000.00</vBC>
                            <vICMS>1200.00</vICMS>
                            <vBCST>14000.00</vBCST>
                            <vICMSST>1320.00</vICMSST>
                        </ICMSTot>
                    </total>
                </infNFe>
            </NFe>
        </nfeProc>
        """

        import_res = TaxRecoveryService.import_xmls(
            db, tenant_id, user_id, str(analysis.id), [("nota_teste_sp.xml", dummy_xml)]
        )
        assert import_res["imported_count"] == 1
        print(f"✅ PASSOU: XML importado e vinculado à análise.")

        # Testar duplicidade de chave na mesma análise
        import_dup = TaxRecoveryService.import_xmls(
            db, tenant_id, user_id, str(analysis.id), [("nota_teste_sp.xml", dummy_xml)]
        )
        assert import_dup["imported_count"] == 0
        assert len(import_dup["errors"]) == 1
        print(f"✅ PASSOU: Impedimento de nota duplicada na mesma análise verificado.")

        print(f"[TEST 4] Execução do processamento de recálculo (REVENDA -> ATIVO_IMOBILIZADO)...")
        processed_analysis = TaxRecoveryService.process_analysis(db, tenant_id, user_id, str(analysis.id))
        assert processed_analysis.status in ("PROCESSADA", "PROCESSADA_COM_PENDENCIAS")
        assert processed_analysis.total_notes_count == 1
        print(f"✅ PASSOU: Processamento concluído com status {processed_analysis.status}.")
        print(f"   Total A Recuperar: R$ {processed_analysis.total_to_recover:.2f}")
        print(f"   Total A Recolher: R$ {processed_analysis.total_to_collect:.2f}")
        print(f"   Saldo Líquido: R$ {processed_analysis.net_balance:.2f}")

        # Limpeza do teste
        TaxRecoveryService.delete_analysis(db, tenant_id, str(analysis.id))
        print("✅ PASSOU: Limpeza dos dados de teste realizada com sucesso.")

        print("\n🎉 TODOS OS TESTES DO MÓDULO DE RECUPERAÇÃO DE IMPOSTOS PASSARAM COM SUCESSO!")
        return True

    except Exception as e:
        print(f"\n❌ ERRO NA EXECUÇÃO DOS TESTES: {str(e)}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_tax_recovery_tests()
    sys.exit(0 if success else 1)
