import sys
sys.path.append("c:\\cerberus\\apps\\api")
from src.main import app  # Resolves SQLAlchemy mappers
import openpyxl
import io
import uuid
from src.core.database import SessionLocal
from src.modules.tenants.models import Tenant
from src.modules.catalog.models import State, City
from src.modules.products.models import Product, ProductSupplier
from src.modules.companies.models import Company
from src.modules.suppliers.models import Supplier
from src.modules.purchase_budgets.service import PurchaseBudgetService

def create_excel_bytes(headers, rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    out = io.BytesIO()
    wb.save(out)
    return out.getvalue()

def run_tests():
    db = SessionLocal()
    # Start transaction block
    db.begin()
    try:
        # Create test Tenant
        tenant = Tenant(
            id="test-tenant-id",
            cnpj="99999999000199",
            razao_social="Test Tenant for Product Import",
            nome_fantasia="Test Tenant"
        )
        db.add(tenant)
        db.flush()
        print(f"Tenant created: {tenant.id}")
        
        # Create test State
        state_sp = State(
            id=str(uuid.uuid4()),
            tenant_id=tenant.id,
            ibge_id=35,
            sigla="SP",
            nome="São Paulo"
        )
        db.add(state_sp)
        db.flush()
        print(f"State created: {state_sp.id}")
        
        # Create test City
        city_sp = City(
            id=str(uuid.uuid4()),
            tenant_id=tenant.id,
            ibge_id=3550308,
            state_id=state_sp.id,
            nome="São Paulo"
        )
        db.add(city_sp)
        db.flush()
        print(f"City created: {city_sp.id}")
        
        # Create test Company
        company = Company(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            cnpj="12345678000199",
            razao_social="Test Company for Product Import",
            nome_fantasia="Test Company",
            state_id=state_sp.id,
            municipality_id=city_sp.id
        )
        db.add(company)
        db.flush()
        print(f"Company created: {company.id}")
        
        # Create test Supplier
        supplier = Supplier(
            id=str(uuid.uuid4()),
            tenant_id=tenant.id,
            cnpj="98765432000188",
            razao_social="Test Supplier",
            nome_fantasia="Test Supplier",
            state_id=state_sp.id
        )
        db.add(supplier)
        db.flush()
        print(f"Supplier created: {supplier.id}")
        
        # Create test Product
        product1 = Product(
            id=uuid.uuid4(),
            tenant_id=tenant.id,
            company_id=company.id,
            codigo="PRD-TEST01",
            nome="Test Product 1",
            tipo="EQUIPAMENTO",
            finalidade="REVENDA",
            unidade="UN",
            marca="Old Brand",
            fabricante="Old Manufacturer",
            part_number="Old PN"
        )
        db.add(product1)
        db.flush()
        print(f"Product created: {product1.id}")
        
        # Link product1 to supplier
        prod_sup1 = ProductSupplier(
            product_id=product1.id,
            supplier_id=supplier.id,
            codigo_externo="SUP-CODE-1",
            unidade="UN",
            fator_conversao="1"
        )
        db.add(prod_sup1)
        db.flush()
        print(f"ProductSupplier created")

        print("Testing Scenario 1: Importing with new columns populated")
        headers1 = ['codigo_fornecedor', 'descricao', 'quantidade', 'unidade', 'ncm', 'ipi_percent', 'icms_percent', 'valor_unitario', 'Marca', 'Fabricante', 'Part Number']
        rows1 = [
            ['SUP-CODE-1', 'Test Product 1 New Desc', 1, 'UN', '85176239', 0, 12, 100.0, 'New Brand', 'New Manufacturer', 'New PN']
        ]
        excel_bytes1 = create_excel_bytes(headers1, rows1)
        res1 = PurchaseBudgetService.parse_excel_items(db, tenant.id, supplier.id, excel_bytes1)
        
        assert len(res1["encontrados"]) == 1
        matched_item = res1["encontrados"][0]
        assert matched_item["product"]["marca"] == "New Brand"
        assert matched_item["product"]["fabricante"] == "New Manufacturer"
        assert matched_item["product"]["part_number"] == "New PN"
        
        # Verify db persistence
        db_prod1 = db.query(Product).filter(Product.id == product1.id).first()
        assert db_prod1.marca == "New Brand"
        assert db_prod1.fabricante == "New Manufacturer"
        assert db_prod1.part_number == "New PN"
        print("Scenario 1 passed!")

        print("Testing Scenario 2: Importing with new columns present but empty")
        headers2 = ['codigo_fornecedor', 'descricao', 'quantidade', 'unidade', 'ncm', 'ipi_percent', 'icms_percent', 'valor_unitario', 'Marca', 'Fabricante', 'Part Number']
        rows2 = [
            ['SUP-CODE-1', 'Test Product 1 New Desc', 1, 'UN', '85176239', 0, 12, 100.0, '', ' ', None]
        ]
        excel_bytes2 = create_excel_bytes(headers2, rows2)
        # Reset products fields first
        db_prod1.marca = "Some Brand"
        db_prod1.fabricante = "Some Manufacturer"
        db_prod1.part_number = "Some PN"
        db.flush()
        
        res2 = PurchaseBudgetService.parse_excel_items(db, tenant.id, supplier.id, excel_bytes2)
        assert len(res2["encontrados"]) == 1
        
        db_prod1 = db.query(Product).filter(Product.id == product1.id).first()
        # Since they were empty, the fields should remain as they were (not updated to empty/None):
        assert db_prod1.marca == "Some Brand"
        assert db_prod1.fabricante == "Some Manufacturer"
        assert db_prod1.part_number == "Some PN"
        print("Scenario 2 passed!")

        print("Testing Scenario 3: Backwards compatibility (missing columns)")
        headers3 = ['codigo_fornecedor', 'descricao', 'quantidade', 'unidade', 'ncm', 'ipi_percent', 'icms_percent', 'valor_unitario']
        rows3 = [
            ['SUP-CODE-1', 'Test Product 1 New Desc', 1, 'UN', '85176239', 0, 12, 100.0]
        ]
        excel_bytes3 = create_excel_bytes(headers3, rows3)
        res3 = PurchaseBudgetService.parse_excel_items(db, tenant.id, supplier.id, excel_bytes3)
        assert len(res3["encontrados"]) == 1
        db_prod1 = db.query(Product).filter(Product.id == product1.id).first()
        assert db_prod1.marca == "Some Brand" # preserved
        print("Scenario 3 passed!")

        print("All tests passed successfully!")
    finally:
        db.rollback()
        db.close()

if __name__ == "__main__":
    run_tests()
