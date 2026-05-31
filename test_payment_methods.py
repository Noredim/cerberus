import sys
import uuid
from datetime import date
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.append('c:/cerberus/apps/api')
import src.main
from src.modules.payment_methods.service import PaymentMethodsService
from src.modules.payment_methods.schemas import TipoDistribuicaoEnum, TipoMovimentoEnum

engine = create_engine("postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# We start a transaction block so we can rollback at the end
db.begin()

try:
    tenant_id = "test-tenant"
    company_id = uuid.uuid4()
    origem_id = uuid.uuid4()
    origem_tipo = "SALES_BUDGET"
    data_inicial = date(2026, 6, 1)

    print("--- Test 1: PERCENTUAL Distribution (30/30/40) on $100.00 ---")
    parcelas_rules = [
        {"sequencia": 1, "descricao": "Parc 1", "intervalo_dias": 0, "percentual": Decimal("30.0000"), "valor_fixo": None},
        {"sequencia": 2, "descricao": "Parc 2", "intervalo_dias": 30, "percentual": Decimal("30.0000"), "valor_fixo": None},
        {"sequencia": 3, "descricao": "Parc 3", "intervalo_dias": 60, "percentual": Decimal("40.0000"), "valor_fixo": None},
    ]
    pfs = PaymentMethodsService.generate_planning_from_rules(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
        origem_tipo=origem_tipo,
        origem_id=origem_id,
        valor_total=Decimal("100.00"),
        data_inicial=data_inicial,
        tipo_distribuicao="PERCENTUAL",
        parcelas_rules=parcelas_rules,
        tipo_movimento="RECEBIMENTO"
    )
    assert len(pfs) == 3
    assert pfs[0].valor_previsto == Decimal("30.00")
    assert pfs[1].valor_previsto == Decimal("30.00")
    assert pfs[2].valor_previsto == Decimal("40.00")
    assert pfs[0].data_prevista == date(2026, 6, 1)
    assert pfs[1].data_prevista == date(2026, 7, 1) # 2026-06-01 + 30 days
    assert pfs[2].data_prevista == date(2026, 7, 31) # 2026-06-01 + 60 days
    print("Test 1 Passed!")

    print("\n--- Test 2: PERCENTUAL Distribution with Rounding Residue on $100.00 (33.33/33.33/33.34) ---")
    parcelas_rules = [
        {"sequencia": 1, "descricao": "Parc 1", "intervalo_dias": 0, "percentual": Decimal("33.3333"), "valor_fixo": None},
        {"sequencia": 2, "descricao": "Parc 2", "intervalo_dias": 30, "percentual": Decimal("33.3333"), "valor_fixo": None},
        {"sequencia": 3, "descricao": "Parc 3", "intervalo_dias": 60, "percentual": Decimal("33.3334"), "valor_fixo": None},
    ]
    pfs = PaymentMethodsService.generate_planning_from_rules(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
        origem_tipo=origem_tipo,
        origem_id=origem_id,
        valor_total=Decimal("100.00"),
        data_inicial=data_inicial,
        tipo_distribuicao="PERCENTUAL",
        parcelas_rules=parcelas_rules,
        tipo_movimento="RECEBIMENTO"
    )
    assert len(pfs) == 3
    # sum of rounded values is 33.33 + 33.33 + 33.33 = 99.99. Diff of 0.01 added to last installment
    assert pfs[0].valor_previsto == Decimal("33.33")
    assert pfs[1].valor_previsto == Decimal("33.33")
    assert pfs[2].valor_previsto == Decimal("33.34")
    print("Test 2 Passed!")

    print("\n--- Test 3: RATEIO_IGUAL Distribution on $100.00 (3 installments) ---")
    parcelas_rules = [
        {"sequencia": 1, "descricao": "Parc 1", "intervalo_dias": 0, "percentual": None, "valor_fixo": None},
        {"sequencia": 2, "descricao": "Parc 2", "intervalo_dias": 30, "percentual": None, "valor_fixo": None},
        {"sequencia": 3, "descricao": "Parc 3", "intervalo_dias": 60, "percentual": None, "valor_fixo": None},
    ]
    pfs = PaymentMethodsService.generate_planning_from_rules(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
        origem_tipo=origem_tipo,
        origem_id=origem_id,
        valor_total=Decimal("100.00"),
        data_inicial=data_inicial,
        tipo_distribuicao="RATEIO_IGUAL",
        parcelas_rules=parcelas_rules,
        tipo_movimento="RECEBIMENTO"
    )
    assert len(pfs) == 3
    assert pfs[0].valor_previsto == Decimal("33.33")
    assert pfs[1].valor_previsto == Decimal("33.33")
    assert pfs[2].valor_previsto == Decimal("33.34") # rounding residue of 0.01 added to last installment
    print("Test 3 Passed!")

    print("\n--- Test 4: VALOR_FIXO Distribution on $100.00 with dynamic Saldo installment ---")
    parcelas_rules = [
        {"sequencia": 1, "descricao": "Parc 1", "intervalo_dias": 0, "percentual": None, "valor_fixo": Decimal("20.00")},
        {"sequencia": 2, "descricao": "Parc 2 - Saldo", "intervalo_dias": 30, "percentual": None, "valor_fixo": None}, # null means Saldo
        {"sequencia": 3, "descricao": "Parc 3", "intervalo_dias": 60, "percentual": None, "valor_fixo": Decimal("15.00")},
    ]
    pfs = PaymentMethodsService.generate_planning_from_rules(
        db=db,
        tenant_id=tenant_id,
        company_id=company_id,
        origem_tipo=origem_tipo,
        origem_id=origem_id,
        valor_total=Decimal("100.00"),
        data_inicial=data_inicial,
        tipo_distribuicao="VALOR_FIXO",
        parcelas_rules=parcelas_rules,
        tipo_movimento="RECEBIMENTO"
    )
    assert len(pfs) == 3
    assert pfs[0].valor_previsto == Decimal("20.00")
    assert pfs[1].valor_previsto == Decimal("65.00") # Saldo = 100 - (20 + 15)
    assert pfs[2].valor_previsto == Decimal("15.00")
    print("Test 4 Passed!")

    print("\nAll calculation tests passed successfully!")

except Exception as e:
    print(f"Test failed with error: {e}")
    raise e
finally:
    # Always rollback transaction to prevent database pollution
    db.rollback()
    db.close()
