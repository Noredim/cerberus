import sys
sys.path.append('c:/cerberus/apps/api')

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.modules.users.models import User, UserRole, UserRoleEnum
from src.modules.companies.models import Company
from src.modules.customers.models import Customer
from src.modules.licitacoes.models import Licitacao, LicitacaoAnalista, LicitacaoChecklistGrupo
from src.modules.licitacoes.schemas import (
    LicitacaoUpdate, LicitacaoChecklistItemUpdate, LicitacaoChecklistItemCreate,
    LicitacaoChecklistAplicacaoCreate, LicitacaoChecklistAplicacaoUpdate,
    LicitacaoTarefaCreate
)
from src.modules.licitacoes.service import LicitacaoService
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.opportunity_kits.models import OpportunityKit

def run_permission_tests():
    print("Connecting to database...")
    engine = create_engine("postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus")
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        company = db.query(Company).first()
        tenant_id = company.tenant_id
        company_id = company.id

        customer = db.query(Customer).filter(Customer.tenant_id == tenant_id).first()

        admin = db.query(User).filter(User.email == "wars@warslab.com.br").first()
        normal_user = db.query(User).filter(User.email == "normal@warslab.com.br").first()

        # Create a test licitacao where Admin is the P.O.
        lic = Licitacao(
            tenant_id=tenant_id,
            company_id=company_id,
            customer_id=customer.id,
            numero_edital="Pregão Permissão Test",
            status="Criada",
            modalidade="Pregão",
            tipo_licitacao="Menor preço",
            po_id=admin.id
        )
        db.add(lic)
        db.commit()
        db.refresh(lic)

        # Seed default checklist for it
        LicitacaoService.seed_checklist(db, tenant_id, lic.id)
        checklist = LicitacaoService.get_checklist(db, tenant_id, lic.id, admin)
        tech_item = checklist[1].items[0]

        print("\n--- Test A: GET Checklist Permission Guard ---")
        # Trying as normal_user (not PO, not GERENTE/DIRETORIA)
        try:
            LicitacaoService.get_checklist(db, tenant_id, lic.id, normal_user)
            raise AssertionError("Should have failed to get checklist for unprivileged user")
        except Exception as e:
            print(f"Successfully blocked GET Checklist: {getattr(e, 'detail', str(e))}")
            assert getattr(e, 'status_code', 0) == 403

        print("\n--- Test B: PUT Checklist Item Status Guard ---")
        item_to_update = checklist[0].items[0]
        try:
            LicitacaoService.update_checklist_item(
                db, tenant_id, item_to_update.id,
                LicitacaoChecklistItemUpdate(status="Concluído"),
                normal_user
            )
            raise AssertionError("Should have failed to update checklist item status")
        except Exception as e:
            print(f"Successfully blocked PUT Checklist item: {getattr(e, 'detail', str(e))}")
            assert getattr(e, 'status_code', 0) == 403

        print("\n--- Test C: POST Technical Application Guard ---")
        try:
            LicitacaoService.create_technical_aplicacao(
                db, tenant_id, tech_item.id,
                LicitacaoChecklistAplicacaoCreate(usuario_id=admin.id, observacao="Análise"),
                normal_user
            )
            raise AssertionError("Should have failed to create technical application")
        except Exception as e:
            print(f"Successfully blocked POST Technical Application: {getattr(e, 'detail', str(e))}")
            assert getattr(e, 'status_code', 0) == 403

        print("\n--- Test D: POST add_analista (Team Mutation) Guard ---")
        try:
            LicitacaoService.add_analista(
                db, tenant_id, company_id, lic.id,
                normal_user.id, 4, normal_user
            )
            raise AssertionError("Should have failed to add analyst to team")
        except Exception as e:
            print(f"Successfully blocked POST add_analista: {getattr(e, 'detail', str(e))}")
            assert getattr(e, 'status_code', 0) == 403

        print("\n--- Cleanup ---")
        db.delete(lic)
        db.commit()
        print("Test database cleaned up.")
        print("\nALL ROLE RESTRICTION TESTS PASSED SUCCESSFULLY! [SUCCESS]")

    finally:
        db.close()

if __name__ == "__main__":
    run_permission_tests()
