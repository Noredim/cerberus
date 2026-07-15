import sys
sys.path.append('/app')
import src.main # triggers all model registrations
from decimal import Decimal
import os

from src.core.database import SessionLocal
from src.modules.sales_budgets.models import SalesBudget
from src.modules.sales_budgets.service import get_opportunity_dre

def run_hybrid_dre_tests():
    print("Running DRE calculations test for hybrid opportunity STM-147/2026...")
    db = SessionLocal()
    
    try:
        # 1. Fetch the target opportunity
        opp = db.query(SalesBudget).filter(SalesBudget.numero_orcamento == 'STM-147/2026').first()
        if not opp:
            print("ERROR: Opportunity STM-147/2026 not found in database. Skipping assertion checks.")
            return False
            
        # 2. Run DRE calculation
        dre = get_opportunity_dre(db, opp.tenant_id, opp.id, opp.company_id)
        
        # 3. Perform assertions matching the expected numbers
        total_produtos = Decimal(str(dre["entradas"]["total_produtos"]))
        total_servicos = Decimal(str(dre["entradas"]["total_servicos"]))
        total_entradas = Decimal(str(dre["entradas"]["total_entradas"]))
        total_saidas = Decimal(str(dre["saidas"]["total_saidas"]))
        lucro_ebitda = Decimal(str(dre["lucro_ebitda"]))
        margem_liquida = Decimal(str(dre["margem_liquida"]))
        
        has_venda = dre["header"]["has_venda"]
        has_locacao = dre["header"]["has_locacao"]
        prazo_contrato_meses = dre["header"]["prazo_contrato_meses"]
        venda_markup_produtos = dre["header"]["venda_markup_produtos"]
        
        print("\n--- Calculations Results ---")
        print(f"Revenue (Locação / Comodato): {total_produtos}")
        print(f"Revenue (Venda): {total_servicos}")
        print(f"Total Revenue (Entradas): {total_entradas}")
        print(f"Total Cost (Saídas): {total_saidas}")
        print(f"Lucro EBITDA: {lucro_ebitda}")
        print(f"Margem Líquida: {margem_liquida}%")
        print(f"has_venda: {has_venda}")
        print(f"has_locacao: {has_locacao}")
        print(f"prazo_contrato_meses: {prazo_contrato_meses}")
        print(f"venda_markup_produtos: {venda_markup_produtos}")
        print("----------------------------\n")
        
        assert total_produtos == Decimal("9485.04"), f"Expected total_produtos 9485.04, got {total_produtos}"
        assert total_servicos == Decimal("2505.10"), f"Expected total_servicos 2505.10, got {total_servicos}"
        assert total_entradas == Decimal("11990.14"), f"Expected total_entradas 11990.14, got {total_entradas}"
        assert total_saidas == Decimal("8903.90"), f"Expected total_saidas 8903.90, got {total_saidas}"
        assert lucro_ebitda == Decimal("3086.24"), f"Expected lucro_ebitda 3086.24, got {lucro_ebitda}"
        assert margem_liquida == Decimal("25.74"), f"Expected margem_liquida 25.74, got {margem_liquida}"
        assert has_venda is True, "Expected has_venda to be True"
        assert has_locacao is True, "Expected has_locacao to be True"
        assert prazo_contrato_meses == 12, f"Expected prazo_contrato_meses 12, got {prazo_contrato_meses}"
        assert venda_markup_produtos == 2.0, f"Expected venda_markup_produtos 2.0, got {venda_markup_produtos}"
        
        print("SUCCESS: All DRE/DRV assertions for hybrid opportunity STM-147/2026 passed successfully!")
        return True
        
    except AssertionError as ae:
        print(f"ASSERTION ERROR: {ae}")
        return False
    except Exception as e:
        print(f"UNEXPECTED ERROR: {e}")
        return False
    finally:
        db.close()

if __name__ == "__main__":
    success = run_hybrid_dre_tests()
    sys.exit(0 if success else 1)
