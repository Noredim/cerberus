import os
import sys
import uuid
import logging
from decimal import Decimal
from datetime import datetime, timezone, timedelta

# Setup path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.core.database import SessionLocal

# Force all relationships to map correctly by importing models first
from src.modules.companies.models import Company, CompanyCnae, CompanyTaxProfile, CompanySalesParameter
from src.modules.users.models import User, UserRole, UserCompany
from src.modules.customers.models import Customer
from src.modules.suppliers.models import Supplier
from src.modules.products.models import Product
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitItem, OpportunityKitCost, OpportunityKitMonthlyCost
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem
from src.modules.sales_proposals.models import SalesProposal
from src.modules.licitacoes.models import Licitacao, LicitacaoLote, LicitacaoItem, LicitacaoAnalista, LicitacaoHistory, LicitacaoChecklistGrupo, LicitacaoChecklistItem, LicitacaoChecklistAplicacao, LicitacaoTarefa, LicitacaoTarefaAndamento

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run():
    db = SessionLocal()
    tenant_id = "5cc7aebb-9c18-4bfa-bb17-77a218a26179"
    company_id = "147f0d08-e065-4fbf-8034-6ab4de731704"
    ricardo_email = "ricardo.noredim@stelmat.com.br"

    try:
        # Resolve company
        company = db.query(Company).filter(Company.id == uuid.UUID(company_id)).first()
        if not company:
            logger.error("STELMAT company not found!")
            return

        # Resolve user
        user = db.query(User).filter(User.email == ricardo_email).first()
        if not user:
            logger.error("Ricardo user not found!")
            return

        # Create or resolve Customer
        customer = db.query(Customer).filter(Customer.tenant_id == tenant_id).first()
        if not customer:
            logger.info("Creating customer...")
            customer = Customer(
                id=str(uuid.uuid4()),
                tenant_id=tenant_id,
                cnpj="98765432000188",
                razao_social="Orgao Publico Test",
                nome_fantasia="Orgao Publico",
                tipo="PUBLICO",
                esfera="MUNICIPAL",
                active=True
            )
            db.add(customer)
            db.commit()
            db.refresh(customer)
        else:
            logger.info("Customer already exists.")

        # Create Licitacao
        lic = db.query(Licitacao).filter(Licitacao.numero_edital == "Pregão 11/2026").first()
        if not lic:
            logger.info("Creating Licitacao...")
            lic_id = uuid.uuid4()
            lic = Licitacao(
                id=lic_id,
                tenant_id=tenant_id,
                company_id=company.id,
                customer_id=customer.id,
                numero_edital="Pregão 11/2026",
                status="Em Análise/Precificação",
                modalidade="Pregão",
                tipo_licitacao="Menor preço",
                valor_total_estimado=Decimal("100000.00"),
                valor_total_venda=Decimal("0.00"),
                margem_ponderada_global=Decimal("0.00"),
                precisa_aprovacao_diretoria=False,
                aprovado_diretoria=False,
                data_licitacao=datetime.now(timezone.utc) + timedelta(days=5),
                po_id=user.id
            )
            db.add(lic)
            db.commit()
            db.refresh(lic)

            # Create Analyst link
            analyst = LicitacaoAnalista(
                id=uuid.uuid4(),
                licitacao_id=lic.id,
                tenant_id=tenant_id,
                usuario_id=user.id,
                data_zero=datetime.now(timezone.utc),
                prazo_dias_uteis=4,
                data_limite=datetime.now(timezone.utc) + timedelta(days=4)
            )
            db.add(analyst)

            # Create Lote
            lote = LicitacaoLote(
                id=uuid.uuid4(),
                licitacao_id=lic.id,
                tenant_id=tenant_id,
                numero="1",
                nome="Lote 1 - Equipamentos de Rede",
                descricao="Lote de rede",
                custo_total=Decimal("0.00"),
                venda_total=Decimal("0.00"),
                lucro_estimado=Decimal("0.00"),
                margem_geral=Decimal("0.00")
            )
            db.add(lote)
            db.commit()
            db.refresh(lote)

            # Create Item
            item = LicitacaoItem(
                id=uuid.uuid4(),
                lote_id=lote.id,
                tenant_id=tenant_id,
                codigo="1",
                nome="Switches de Borda 24 Portas PoE",
                descricao="Switches PoE",
                quantidade=Decimal("5.0000"),
                tipo_fornecimento="Unitário",
                quantidade_total=Decimal("5.0000"),
                custo_unitario=Decimal("1200.0000"),
                custo_total=Decimal("6000.0000"),
                venda_unitario=Decimal("2000.0000"),
                venda_total=Decimal("10000.0000"),
                lucro_estimado=Decimal("4000.0000"),
                margem_geral=Decimal("40.0000")
            )
            db.add(item)
            db.commit()
            logger.info("Licitacao, lote, item, and analyst created successfully!")
        else:
            logger.info("Licitacao already exists.")

    except Exception as e:
        logger.error(f"Error seeding test data: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    run()
