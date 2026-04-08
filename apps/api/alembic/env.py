from logging.config import fileConfig

from sqlalchemy import engine_from_config  # type: ignore
from sqlalchemy import pool  # type: ignore

from alembic import context  # type: ignore
import os
import sys

# Add apps/api to path so `src.*` can be resolved
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

from src.core.base import Base  # type: ignore
# Import all models here for Alembic auto-discovery
from src.modules.tenants.models import Tenant, TenantCnae  # type: ignore
from src.modules.users.models import User, UserRole  # type: ignore
from src.modules.fiscal.models import NcmRule  # type: ignore
from src.modules.catalog.models import State, City, IbgeSyncJob  # type: ignore
from src.modules.utils.models.cep import CepCache  # type: ignore
from src.modules.companies.models import Company, CompanyCnae, CompanyBenefit, CompanyCnpjQueryLog, CnpjQueryCache  # type: ignore
from src.modules.ncm.models import Ncm, NcmImportacao  # type: ignore
from src.modules.ncm_st.models import NcmStHeader, NcmStItem  # type: ignore
from src.modules.suppliers.models import Supplier  # type: ignore
from src.modules.products.models import Product, ProductSupplier  # type: ignore
from src.modules.customers.models import Customer  # type: ignore
from src.modules.purchase_budgets.models import PaymentCondition, PurchaseBudget, PurchaseBudgetItem, PurchaseBudgetNegotiation, PurchaseBudgetNegotiationItem  # type: ignore
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetResponsavel, SalesBudgetItem  # type: ignore
from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitItem, OpportunityKitCost  # type: ignore
from src.modules.profiles.models import FunctionalProfile  # type: ignore
from src.modules.roles.models import Role  # type: ignore
from src.modules.professionals.models import Professional  # type: ignore
from src.modules.solution_analysis.models import SolutionAnalysis, SolutionAnalysisItem  # type: ignore
from src.modules.own_services.models import OwnService, OwnServiceItem  # type: ignore
from src.modules.man_hours.models import ManHour  # type: ignore
from src.modules.sales_proposals.models import SalesProposal, SalesProposalKit, SalesProposalLog  # type: ignore
from src.core.config import settings  # type: ignore
target_metadata = Base.metadata

config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode.

    This configures the context with just a URL
    and not an Engine, though an Engine is acceptable
    here as well.  By skipping the Engine creation
    we don't even need a DBAPI to be available.

    Calls to context.execute() here emit the given string to the
    script output.

    """
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode.

    In this scenario we need to create an Engine
    and associate a connection with the context.

    """
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
