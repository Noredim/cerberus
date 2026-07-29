from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all module models so SQLAlchemy registry resolves relationship mappers across all domains
import src.modules.tenants.models  # noqa
import src.modules.users.models  # noqa
import src.modules.companies.models  # noqa
import src.modules.fiscal.models  # noqa
import src.modules.catalog.models  # noqa
import src.modules.utils.models.cep  # noqa
import src.modules.ncm.models  # noqa
import src.modules.ncm_st.models  # noqa
import src.modules.suppliers.models  # noqa
import src.modules.products.models  # noqa
import src.modules.customers.models  # noqa
import src.modules.purchase_budgets.models  # noqa
import src.modules.sales_budgets.models  # noqa
import src.modules.opportunity_kits.models  # noqa
import src.modules.profiles.models  # noqa
import src.modules.roles.models  # noqa
import src.modules.professionals.models  # noqa
import src.modules.solution_analysis.models  # noqa
import src.modules.own_services.models  # noqa
import src.modules.man_hours.models  # noqa
import src.modules.sales_proposals.models  # noqa
import src.modules.document_templates.models  # noqa
import src.modules.notifications.models  # noqa
import src.modules.licitacoes.models  # noqa
import src.modules.messaging.models  # noqa


