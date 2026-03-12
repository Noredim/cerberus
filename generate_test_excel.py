import openpyxl

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Orcamento"

headers = [
    "codigo_fornecedor",
    "descricao",
    "quantidade",
    "unidade",
    "ncm",
    "ipi_percentual",
    "icms_percentual",
    "valor_unitario"
]
ws.append(headers)

# Add some dummy items
items = [
    ["SKU-001", "Câmera IP Dome 2MP", 5, "UN", "85258929", 5.0, 18.0, 150.00],
    ["SKU-002", "Cabo UTP Cat6 305m", 2, "CX", "85444900", 0.0, 18.0, 350.50],
    ["SKU-003", "Switch PoE 8 Portas", 1, "UN", "85176239", 10.0, 18.0, 420.00],
]

for item in items:
    ws.append(item)

wb.save("c:/cerberus/modelo_orcamento.xlsx")
print("Planilha criada: c:/cerberus/modelo_orcamento.xlsx")
