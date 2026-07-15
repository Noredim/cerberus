import sys
sys.path.append('/app')
import os
from decimal import Decimal
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from src.modules.tenants.models import Tenant
from src.modules.users.models import User, UserRole
from src.modules.professionals.models import Professional
from src.modules.roles.models import Role
from src.modules.companies.models import Company, CommercialPolicy, CommercialPolicyServiceCommission
from src.modules.customers.models import Customer
from src.modules.products.models import Product
from src.modules.licitacoes.models import Licitacao, LicitacaoLote, LicitacaoItem
from src.modules.purchase_budgets.models import PurchaseBudget
from src.modules.sales_budgets.models import SalesBudget, SalesBudgetItem
from src.modules.sales_proposals.models import SalesProposal
from src.modules.opportunity_kits.models import OpportunityKit, OpportunityKitCost
from src.modules.own_services.models import OwnService, OwnServiceItem
from src.modules.man_hours.models import ManHour

DB_URL = os.getenv("DATABASE_URL", "postgresql://cerberus_user:cerberus_password@db:5432/cerberus")

def main():
    engine = create_engine(DB_URL)
    Session = sessionmaker(bind=engine)
    session = Session()
    
    print("Finding ManHour record for SERVIÇO DE NOC - MONITORAMENTO...")
    
    # Query by role name or role ID
    mhs = session.query(ManHour).join(Role).filter(Role.name == "SERVIÇO DE NOC - MONITORAMENTO").all()
    
    if not mhs:
        print("No ManHour records found for SERVIÇO DE NOC - MONITORAMENTO!")
        session.close()
        sys.exit(1)
        
    for mh in mhs:
        print(f"Updating ManHour ID {mh.id}:")
        print(f"  Old normal hour: {mh.hora_normal} | Old extra hour: {mh.hora_extra} | Old Dom/Fer: {mh.hora_extra_domingos_feriados}")
        
        mh.hora_normal = Decimal("119.25")
        mh.hora_extra = Decimal("178.875")
        mh.hora_extra_domingos_feriados = Decimal("238.50")
        
        # Also update other HE fields if they exist (let's check the schema)
        if hasattr(mh, "hora_extra_adicional_noturno"):
            mh.hora_extra_adicional_noturno = Decimal("178.875")
        if hasattr(mh, "hora_extra_domingos_feriados_noturno"):
            mh.hora_extra_domingos_feriados_noturno = Decimal("238.50")
            
        print(f"  New normal hour: {mh.hora_normal} | New extra hour: {mh.hora_extra} | New Dom/Fer: {mh.hora_extra_domingos_feriados}")
        
    session.commit()
    print("Database updated and committed successfully!")
    session.close()

if __name__ == "__main__":
    main()
