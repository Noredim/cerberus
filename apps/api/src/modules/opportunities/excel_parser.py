from typing import List, Dict, Any
import openpyxl
from io import BytesIO
from decimal import Decimal, InvalidOperation

EXPECTED_COLUMNS = [
    "nome_do_fornecedor",
    "cnpj_do_fornecedor",
    "cod_interno_do_produto",
    "descricao",
    "ipi",
    "icms",
    "valor_unitario",
    "unidade",
    "ncm",
    "quantidade"
]

def normalize_header(header_str: str) -> str:
    if not header_str:
        return ""
    import unicodedata
    # Remove acentos
    nfkd = unicodedata.normalize('NFKD', str(header_str))
    header_str = u"".join([c for c in nfkd if not unicodedata.combining(c)])
    return header_str.strip().lower().replace(" ", "_")

def parse_budget_excel(file_content: bytes) -> Dict[str, Any]:
    """
    Parses an Excel (.xlsx) file containing budget items.
    Expects specific column headers in the first row.
    """
    wb = openpyxl.load_workbook(filename=BytesIO(file_content), data_only=True)
    ws = wb.active

    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        raise ValueError("O arquivo Excel está vazio.")

    # Find the header row (assuming it's the first non-empty row)
    header_row_idx = -1
    header_mapping = {}
    
    for idx, row in enumerate(rows):
        if any(cell for cell in row):
            headers = [normalize_header(cell) for cell in row]
            # Try to match at least some expected columns
            if any(col in headers for col in EXPECTED_COLUMNS):
                header_row_idx = idx
                for col_name in EXPECTED_COLUMNS:
                    try:
                        # try exact match
                        header_mapping[col_name] = headers.index(col_name)
                    except ValueError:
                        # try fuzzy / startswith match for some common cases
                        found = False
                        for i, h in enumerate(headers):
                            if col_name in h or h in col_name:
                                header_mapping[col_name] = i
                                found = True
                                break
                        if not found:
                            header_mapping[col_name] = None
                break
                
    if header_row_idx == -1:
        raise ValueError("Não foi possível encontrar o cabeçalho com as colunas esperadas (ex: descricao, quantidade, valor_unitario).")

    items = []
    fornecedor_nome = None
    fornecedor_cnpj = None
    
    # helper for safe decimal parsing
    def parse_decimal(val, default="0.00"):
        if val is None or val == "":
            return Decimal(default)
        try:
            return Decimal(str(val).replace(',', '.'))
        except InvalidOperation:
            return Decimal(default)

    for row in rows[header_row_idx + 1:]:
        # Skip empty rows completely
        if not any(row):
            continue
            
        nome_idx = header_mapping["nome_do_fornecedor"]
        cnpj_idx = header_mapping["cnpj_do_fornecedor"]
        codigo_idx = header_mapping["cod_interno_do_produto"]
        desc_idx = header_mapping["descricao"]
        qtd_idx = header_mapping["quantidade"]
        un_idx = header_mapping["unidade"]
        ncm_idx = header_mapping["ncm"]
        ipi_idx = header_mapping["ipi"]
        icms_idx = header_mapping["icms"]
        valor_idx = header_mapping["valor_unitario"]
        
        # Parse Supplier Info (takes the first valid one)
        if not fornecedor_nome and nome_idx is not None and row[nome_idx]:
            fornecedor_nome = str(row[nome_idx]).strip()
        if not fornecedor_cnpj and cnpj_idx is not None and row[cnpj_idx]:
            fornecedor_cnpj = str(row[cnpj_idx]).strip()

        item = {
            "codigo_fornecedor": str(row[codigo_idx]).strip() if codigo_idx is not None and row[codigo_idx] else None,
            "descricao": str(row[desc_idx]).strip() if desc_idx is not None and row[desc_idx] else "Item sem descrição",
            "quantidade": parse_decimal(row[qtd_idx] if qtd_idx is not None else 1, "1.0000"),
            "unidade": str(row[un_idx]).strip() if un_idx is not None and row[un_idx] else "UN",
            "ncm": str(row[ncm_idx]).strip().replace(".","") if ncm_idx is not None and row[ncm_idx] else None,
            "ipi_percentual": parse_decimal(row[ipi_idx] if ipi_idx is not None else 0, "0.00"),
            "icms_percentual": parse_decimal(row[icms_idx] if icms_idx is not None else 0, "0.00"),
            "valor_unitario": parse_decimal(row[valor_idx] if valor_idx is not None else 0, "0.00"),
        }
        
        # small validation: if both desc and valor_unitario are "empty", discard
        if item["descricao"] == "Item sem descrição" and item["valor_unitario"] == Decimal("0.00"):
            continue

        items.append(item)

    return {
        "fornecedor_nome": fornecedor_nome,
        "fornecedor_cnpj": fornecedor_cnpj,
        "items": items
    }
