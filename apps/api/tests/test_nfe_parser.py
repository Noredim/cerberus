import pytest
from decimal import Decimal
from datetime import datetime
from src.modules.fiscal.parser import NFeXmlParser

# Mock NFe XML content for testing
MOCK_NFE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe32260312345678901234550010000476051234567890" versao="4.00">
      <ide>
        <cUF>32</cUF>
        <cNF>12345678</cNF>
        <natOp>Venda de Mercadorias</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>47605</nNF>
        <dhEmi>2026-07-24T08:30:00-04:00</dhEmi>
        <tpNF>1</tpNF>
        <tpAmb>1</tpAmb>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Fornecedor de Testes Ltda</xNome>
        <xFant>Fornecedor Teste</xFant>
        <IE>123456789</IE>
        <CRT>3</CRT>
      </emit>
      <dest>
        <CNPJ>98765432000188</CNPJ>
        <xNome>Sua Empresa B2B S.A.</xNome>
        <IE>987654321</IE>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>PROD001</cProd>
          <cEAN>7891234567890</cEAN>
          <xProd>Produto Teste 1</xProd>
          <NCM>84713012</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>10.0000</qCom>
          <vUnCom>150.00000000</vUnCom>
          <vProd>1500.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <vBC>1500.00</vBC>
              <pICMS>18.00</pICMS>
              <vICMS>270.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
      <det nItem="2">
        <prod>
          <cProd>PROD002</cProd>
          <xProd>Produto Teste 2 com Reforma Tributaria</xProd>
          <NCM>85176277</NCM>
          <CFOP>5102</CFOP>
          <uCom>PC</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>500.00000000</vUnCom>
          <vProd>1000.00</vProd>
        </prod>
        <imposto>
          <IBSCBS>
            <CST>10</CST>
            <gIBSCBS>
              <vBC>1000.00</vBC>
              <gIBSUF>
                <pIBSUF>10.00</pIBSUF>
                <vIBSUF>100.00</vIBSUF>
              </gIBSUF>
              <vIBS>100.00</vIBS>
              <gCBS>
                <pCBS>9.00</pCBS>
                <vCBS>90.00</vCBS>
              </gCBS>
            </gIBSCBS>
          </IBSCBS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vProd>2500.00</vProd>
          <vNF>2690.00</vNF>
        </ICMSTot>
      </total>
      <cobr>
        <fat>
          <nFat>FAT-12345</nFat>
          <vOrig>2690.00</vOrig>
          <vNF>2690.00</vNF>
        </fat>
        <dup>
          <nDup>001</nDup>
          <dVenc>2026-08-24</dVenc>
          <vDup>1345.00</vDup>
        </dup>
        <dup>
          <nDup>002</nDup>
          <dVenc>2026-09-24</dVenc>
          <vDup>1345.00</vDup>
        </dup>
      </cobr>
      <pag>
        <detPag>
          <tPag>15</tPag>
          <vPag>2690.00</vPag>
        </detPag>
      </pag>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <tpAmb>1</tpAmb>
      <verAplic>SP-NFe-12.0</verAplic>
      <chNFe>32260312345678901234550010000476051234567890</chNFe>
      <dhRecbto>2026-07-24T08:35:00-04:00</dhRecbto>
      <nProt>132260001234567</nProt>
      <cStat>100</cStat>
      <xMotivo>Autorizado o uso da NF-e</xMotivo>
    </infProt>
  </protNFe>
</nfeProc>
"""

def test_parse_nfe_xml_success():
    res = NFeXmlParser.parse_xml(MOCK_NFE_XML)
    
    # Assert general info
    assert res["access_key"] == "32260312345678901234550010000476051234567890"
    assert res["nNF"] == "47605"
    assert res["serie"] == "1"
    assert res["mod"] == "55"
    assert isinstance(res["dhEmi"], datetime)
    assert res["dhEmi"].year == 2026

    # Assert issuer/recipient
    assert res["issuer_cnpj"] == "12345678000199"
    assert res["issuer_name"] == "Fornecedor de Testes Ltda"
    assert res["recipient_cnpj"] == "98765432000188"
    assert res["recipient_name"] == "Sua Empresa B2B S.A."

    # Assert totals
    assert res["vProd"] == Decimal("2500.00")
    assert res["vNF"] == Decimal("2690.00")

    # Assert items
    assert len(res["items"]) == 2
    
    # Item 1 details
    item1 = res["items"][0]
    assert item1["nItem"] == 1
    assert item1["cProd"] == "PROD001"
    assert item1["xProd"] == "Produto Teste 1"
    assert item1["qCom"] == Decimal("10.0")
    assert item1["vUnCom"] == Decimal("150.0")
    assert item1["vProd"] == Decimal("1500.0")
    assert "ICMS" in item1["tributos"]
    assert item1["tributos"]["ICMS"]["ICMS00"]["vICMS"] == "270.00"

    # Item 2 details (Reforma Tributaria)
    item2 = res["items"][1]
    assert item2["nItem"] == 2
    assert item2["cProd"] == "PROD002"
    assert item2["tributos"]["IBSCBS"]["CST"] == "10"
    assert item2["tributos"]["IBSCBS"]["gIBSCBS"]["vIBS"] == "100.00"
    assert item2["tributos"]["IBSCBS"]["gIBSCBS"]["gCBS"]["vCBS"] == "90.00"

    # Assert installments
    assert len(res["installments"]) == 2
    assert res["installments"][0]["nDup"] == "001"
    assert res["installments"][0]["vDup"] == Decimal("1345.00")

    # Assert payments
    assert len(res["payments"]) == 1
    assert res["payments"][0]["tPag"] == "15"
    assert res["payments"][0]["vPag"] == Decimal("2690.00")

    # Assert protocol
    assert res["cStat"] == "100"
    assert res["nProt"] == "132260001234567"
    assert res["xMotivo"] == "Autorizado o uso da NF-e"


def test_parse_xml_xxe_protection():
    # Insecure XML with ENTITY declaration
    insecure_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <!DOCTYPE test [  
      <!ENTITY xxe SYSTEM "file:///etc/passwd">
    ]>
    <nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
      <NFe>
        <infNFe Id="NFe123">&xxe;</infNFe>
      </NFe>
    </nfeProc>"""

    with pytest.raises(ValueError) as exc:
        NFeXmlParser.parse_xml(insecure_xml)
    assert "inseguro" in str(exc.value)
