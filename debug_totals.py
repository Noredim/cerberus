import os
import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from uuid import UUID

# Add paths to import models
sys.path.append('c:/cerberus/apps/api')

# Force import of dependent models to resolve lazy-loading compilation
from src.modules.roles.models import Role
from src.modules.users.models import User
from src.modules.professionals.models import Professional
from src.modules.companies.models import Company
from src.modules.customers.models import Customer
from src.modules.products.models import Product
from src.modules.opportunity_kits.models import OpportunityKit

from src.core.base import Base
from src.modules.sales_budgets.models import SalesBudget, RentalBudgetItem

def run():
    # Try different connection strings (local SQLite and Postgres)
    engines = [
        "sqlite:///c:/cerberus/database.db",
        "postgresql://cerberus_user:cerberus_password@localhost:5433/cerberus"
    ]
    
    db = None
    for url in engines:
        try:
            engine = create_engine(url)
            SessionLocal = sessionmaker(bind=engine)
            db = SessionLocal()
            # Try to query a sales budget to see if it works
            budget = db.query(SalesBudget).first()
            print(f"Successfully connected using: {url}")
            break
        except Exception as e:
            print(f"Failed to connect using {url}: {e}")
            db = None

    if not db:
        print("Could not connect to any database!")
        return

    # Find the budget
    with open("debug_out.txt", "w", encoding="utf-8") as out:
        budgets = db.query(SalesBudget).all()
        out.write(f"Total budgets in DB: {len(budgets)}\n")
        for budget in budgets:
            title = (budget.titulo or "").upper()
            num = (budget.numero_orcamento or "").upper()
            if "ROTA" in title or "LEGAL" in title or "PMMT" in title or "STM-049" in num or "STM-049" in title:
                out.write(f"\n==================================================\n")
                out.write(f"Found Budget: {budget.numero_orcamento} - {budget.titulo}\n")
                out.write(f"Status: {budget.status}\n")
                out.write(f"Valor Total: {budget.valor_total}\n")
                out.write(f"Prazo Contrato: {budget.prazo_contrato_meses}\n")
                out.write(f"Prazo Instalação: {budget.prazo_instalacao_meses}\n")
                out.write(f"Comissão Diretoria: {budget.perc_comissao_diretoria}%\n")
                out.write(f"Rental items count: {len(budget.rental_items)}\n")
                
                out.write("\nRental Items:\n")
                for item in budget.rental_items:
                    out.write(f"  Item ID: {item.id}\n")
                    out.write(f"  Description/Nome: {item.product_nome or (item.product.nome if item.product else 'N/A')}\n")
                    out.write(f"  Is Installation Kit: {item.is_kit_instalacao}\n")
                    out.write(f"  Quantity: {item.quantidade}\n")
                    out.write(f"  Custo Aquisição Unit: {item.custo_aquisicao_unit}\n")
                    out.write(f"  Custo Total Aquisição: {item.custo_total_aquisicao}\n")
                    out.write(f"  Valor Mensal (Negotiated): {item.valor_mensal}\n")
                    out.write(f"  Kit Valor Mensal: {getattr(item, 'kit_valor_mensal', None)}\n")
                    out.write(f"  Impostos Mensal: {item.impostos_mensal}\n")
                    out.write(f"  Kit Valor Impostos: {getattr(item, 'kit_valor_impostos', None)}\n")
                    out.write(f"  Custo Operacional Mensal Kit: {item.custo_op_mensal_kit}\n")
                    out.write(f"  Custo Manutenção Mensal: {item.custo_manut_mensal}\n")
                    out.write(f"  Manutenção Locação: {item.manutencao_locacao}\n")
                    out.write(f"  Kit Vlt Manut: {getattr(item, 'kit_vlt_manut', None)}\n")
                    out.write(f"  Valor Venda Equipamento: {item.valor_venda_equipamento}\n")
                    out.write(f"  Parcela Locação: {item.parcela_locacao}\n")
                    out.write(f"  Kit Parcela Locacao: {getattr(item, 'kit_parcela_locacao', None)}\n")
                    out.write(f"  Kit Venda Unit Monitoramento: {getattr(item, 'kit_venda_unit_monitoramento', None)}\n")
                    out.write(f"  Kit Custos Produtos: {item.kit_custo_produtos}\n")
                    out.write(f"  Kit Custos Serviços: {item.kit_custo_servicos}\n")
                    out.write(f"  Kit Vlr Instal Calc: {getattr(item, 'kit_vlr_instal_calc', None)}\n")
                    out.write(f"  Valor Instalacao Item: {getattr(item, 'valor_instalacao_item', None)}\n")

if __name__ == "__main__":
    run()
