import pytest
from decimal import Decimal
from datetime import datetime
from src.modules.fiscal.parser import NFeXmlParser
from src.modules.fiscal.rules import (
    validate_classification,
    get_tributacoes_permitidas,
    APLICACOES_VALIDAS,
    TRIBUTACOES_VALIDAS,
)

MOCK_VALID_NFE_XML = """<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35260712345678000199550010000123451000123456" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <cNF>12345678</cNF>
        <natOp>VENDA DE MERCADORIA</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>12345</nNF>
        <dhEmi>2026-07-15T10:00:00-03:00</dhEmi>
        <tpNF>1</tpNF>
        <finNFe>1</finNFe>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>Fornecedor de Sao Paulo Ltda</xNome>
        <enderEmit>
          <UF>SP</UF>
        </enderEmit>
      </emit>
      <dest>
        <CNPJ>98765432000188</CNPJ>
        <xNome>Empresa Destinataria MT S.A.</xNome>
        <enderDest>
          <UF>MT</UF>
        </enderDest>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>PROD100</cProd>
          <xProd>Parafuso Sextavado</xProd>
          <NCM>73181500</NCM>
          <CFOP>6102</CFOP>
          <uCom>UN</uCom>
          <qCom>100.0000</qCom>
          <vUnCom>2.5000</vUnCom>
          <vProd>250.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <orig>0</orig>
              <CST>00</CST>
              <vBC>250.00</vBC>
              <pICMS>12.00</pICMS>
              <vICMS>30.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vBC>250.00</vBC>
          <vICMS>30.00</vICMS>
          <vBCST>0.00</vBCST>
          <vST>0.00</vST>
          <vProd>250.00</vProd>
          <vFrete>10.00</vFrete>
          <vSeg>0.00</vSeg>
          <vDesc>0.00</vDesc>
          <vIPI>0.00</vIPI>
          <vPIS>4.12</vPIS>
          <vCOFINS>19.00</vCOFINS>
          <vOutro>0.00</vOutro>
          <vNF>260.00</vNF>
        </ICMSTot>
      </total>
    </infNFe>
  </NFe>
</nfeProc>"""

MOCK_EVENTO_XML = """<?xml version="1.0" encoding="UTF-8"?>
<procEventoNFe xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.00">
  <evento versao="1.00">
    <infEvento>
      <tpEvento>110111</tpEvento>
      <xJust>Cancelamento de NF-e</xJust>
    </infEvento>
  </evento>
</procEventoNFe>"""


def test_rules_validation_cases():
    # Caso 1: REVENDA + ICMS_ST -> Válido
    validate_classification("REVENDA", "ICMS_ST")

    # Caso 2: REVENDA + DIFAL -> Inválido
    with pytest.raises(ValueError, match="não é permitida para a aplicação 'REVENDA'"):
        validate_classification("REVENDA", "DIFAL")

    # Caso 3: MATERIAL_APLICADO + DIFAL -> Válido
    validate_classification("MATERIAL_APLICADO", "DIFAL")

    # Caso 4: CONSUMO_INTERNO + ICMS_ST -> Inválido
    with pytest.raises(ValueError, match="não é permitida para a aplicação 'CONSUMO_INTERNO'"):
        validate_classification("CONSUMO_INTERNO", "ICMS_ST")

    # Aplicação inválida
    with pytest.raises(ValueError, match="Aplicação 'INVALID_APP' inválida"):
        validate_classification("INVALID_APP", "OPERAÇÃO_NORMAL")


def test_parser_extended_fields():
    parsed = NFeXmlParser.parse_xml(MOCK_VALID_NFE_XML)
    assert parsed["access_key"] == "35260712345678000199550010000123451000123456"
    assert parsed["nNF"] == "12345"
    assert parsed["natOp"] == "VENDA DE MERCADORIA"
    assert parsed["competencia"] == "2026-07"
    assert parsed["uf_emit"] == "SP"
    assert parsed["uf_dest"] == "MT"
    assert parsed["vProd"] == Decimal("250.00")
    assert parsed["vNF"] == Decimal("260.00")
    assert parsed["vFrete"] == Decimal("10.00")
    assert parsed["vICMS"] == Decimal("30.00")
    assert len(parsed["items"]) == 1


def test_parser_rejects_event_xml():
    with pytest.raises(ValueError, match="evento fiscal"):
        NFeXmlParser.parse_xml(MOCK_EVENTO_XML)


def test_parser_rejects_xxe():
    xxe_xml = '<?xml version="1.0"?><!ENTITY xxe SYSTEM "file:///etc/passwd"><nfeProc></nfeProc>'
    with pytest.raises(ValueError, match="inseguro"):
        NFeXmlParser.parse_xml(xxe_xml)
