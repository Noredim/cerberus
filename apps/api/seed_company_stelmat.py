import sys
import os
import uuid
import logging
from datetime import date
from decimal import Decimal

# Setup path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.core.database import SessionLocal
from src.modules.tenants.models import Tenant
from src.modules.catalog.models import State, City
from src.modules.companies.models import Company, CompanyTaxProfile, CompanyCnae, CompanySalesParameter

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def seed_stelmat():
    db = SessionLocal()
    try:
        # 1. Resolve or Create Master Tenant
        tenant = db.query(Tenant).filter(Tenant.cnpj == "00000000000000").first()
        if not tenant:
            tenant_id = "5cc7aebb-9c18-4bfa-bb17-77a218a26179"
            logger.info(f"Creating Master Tenant: {tenant_id}")
            tenant = Tenant(id=tenant_id, cnpj="00000000000000", razao_social="Warslab Master Admin")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        else:
            logger.info(f"Master tenant exists: {tenant.id}")

        # 2. Resolve or Create State
        state_id = "89271e65-10b2-4f85-ac8d-a5233ba388bf"
        state = db.query(State).filter(State.sigla == "MT").first()
        if not state:
            logger.info(f"Creating State MT: {state_id}")
            state = State(
                id=state_id,
                tenant_id=tenant.id,
                ibge_id=51,
                sigla="MT",
                nome="Mato Grosso",
                regiao_nome="Centro-Oeste",
                regiao_sigla="CO",
                is_active=True
            )
            db.add(state)
            db.commit()
            db.refresh(state)
        else:
            logger.info(f"State MT exists: {state.id}")

        # 3. Resolve or Create City
        city_id = "c31a69f7-c898-4404-942c-d48f3cf36fb9"
        city = db.query(City).filter(City.ibge_id == 5103403).first()
        if not city:
            logger.info(f"Creating City Cuiaba: {city_id}")
            city = City(
                id=city_id,
                tenant_id=tenant.id,
                ibge_id=5103403,
                state_id=state.id,
                nome="Cuiabá",
                microregiao="Cuiabá",
                mesorregiao="Centro-Sul Mato-grossense",
                is_active=True
            )
            db.add(city)
            db.commit()
            db.refresh(city)
        else:
            logger.info(f"City Cuiaba exists: {city.id}")

        # 4. Create or Update Company STELMAT
        company_id = "147f0d08-e065-4fbf-8034-6ab4de731704"
        company = db.query(Company).filter(Company.id == company_id).first()
        if not company:
            logger.info(f"Creating Company STELMAT: {company_id}")
            company = Company(
                id=company_id,
                tenant_id=tenant.id,
                status="ATIVA",
                tipo="MATRIZ",
                cnpj="00950386000100",
                razao_social="STELMAT TELEINFORMATICA LTDA",
                nome_fantasia="STELMAT TELEINFORMATICA",
                natureza_juridica_codigo="206-2",
                natureza_juridica_descricao="SOCIEDADE EMPRESÁRIA LIMITADA",
                data_abertura=date(1984, 9, 24),
                situacao_cadastral="ATIVA",
                porte="DEMAIS",
                capital_social=Decimal("10000000.00"),
                email="stelmat@stelmat.com.br",
                telefone="(65) 3051-5757",
                logradouro="R DAS ORQUIDEAS",
                numero="222",
                complemento="TERREO",
                bairro="BOSQUE DA SAUDE",
                cep="78050010",
                municipality_id=city.id,
                state_id=state.id,
                logo_url="/uploads/logos/147f0d08-e065-4fbf-8034-6ab4de731704.png",
                nomenclatura_orcamento="STM",
                numero_proposta=44
            )
            db.add(company)
            db.commit()
            db.refresh(company)
        else:
            logger.info("Company STELMAT already exists, updating values...")
            company.tenant_id = tenant.id
            company.municipality_id = city.id
            company.state_id = state.id
            company.nomenclatura_orcamento = "STM"
            company.numero_proposta = 44
            db.commit()

        # 5. Create or Update Tax Profile
        tax_profile_id = "6a4e9b4b-0370-4249-8997-b17e11d164e4"
        tax_profile = db.query(CompanyTaxProfile).filter(CompanyTaxProfile.id == tax_profile_id).first()
        if not tax_profile:
            logger.info(f"Creating Tax Profile: {tax_profile_id}")
            tax_profile = CompanyTaxProfile(
                id=tax_profile_id,
                company_id=company.id,
                vigencia_inicio=date(2026, 3, 7),
                regime_tributario="LUCRO_PRESUMIDO",
                contribuinte_icms=False,
                contribuinte_iss=True,
                regime_iss="FIXO",
                regime_icms="NAO_APLICA",
                perfil_tarifario_st=True
            )
            db.add(tax_profile)
            db.commit()
        else:
            logger.info("Tax Profile already exists.")

        # 6. Create Sales Parameters
        sales_param = db.query(CompanySalesParameter).filter(CompanySalesParameter.company_id == company.id).first()
        if not sales_param:
            logger.info("Creating Sales Parameters for STELMAT...")
            sales_param = CompanySalesParameter(
                id=str(uuid.uuid4()),
                company_id=company.id,
                mkp_padrao=Decimal("2.12"),
                despesa_administrativa=Decimal("5.00"),
                comissionamento=Decimal("0.00"),
                pis=Decimal("0.65"),
                cofins=Decimal("3.00"),
                csll=Decimal("1.08"),
                irpj=Decimal("2.00"),
                iss=Decimal("5.00"),
                icms_interno=Decimal("17.00"),
                icms_externo=Decimal("12.00"),
                frete_venda_padrao=Decimal("0.00"),
                mkp_padrao_venda=Decimal("2.12"),
                despesa_administrativa_venda=Decimal("5.00"),
                comissionamento_venda=Decimal("0.00"),
                pis_venda=Decimal("0.65"),
                cofins_venda=Decimal("3.00"),
                csll_venda=Decimal("1.08"),
                irpj_venda=Decimal("2.00"),
                iss_venda=Decimal("5.00"),
                icms_interno_venda=Decimal("17.00"),
                icms_externo_venda=Decimal("12.00"),
                mkp_padrao_locacao=Decimal("2.12"),
                despesa_administrativa_locacao=Decimal("5.00"),
                comissionamento_locacao=Decimal("0.00"),
                pis_locacao=Decimal("0.65"),
                cofins_locacao=Decimal("3.00"),
                csll_locacao=Decimal("1.08"),
                irpj_locacao=Decimal("2.00"),
                iss_locacao=Decimal("0.00"),
                icms_interno_locacao=Decimal("0.00"),
                icms_externo_locacao=Decimal("0.00"),
                mkp_padrao_comodato=Decimal("2.12"),
                despesa_administrativa_comodato=Decimal("5.00"),
                comissionamento_comodato=Decimal("0.00"),
                pis_comodato=Decimal("0.65"),
                cofins_comodato=Decimal("3.00"),
                csll_comodato=Decimal("2.88"),
                irpj_comodato=Decimal("4.80"),
                iss_comodato=Decimal("5.00"),
                icms_interno_comodato=Decimal("0.00"),
                icms_externo_comodato=Decimal("0.00")
            )
            db.add(sales_param)
            db.commit()
        else:
            logger.info("Sales Parameters already exist.")

        # 7. Create CNAEs
        cnaes_list = [
            ("4751201", "PRIMARIO"),
            ("3313901", "SECUNDARIO"),
            ("4618499", "SECUNDARIO"),
            ("4651601", "SECUNDARIO"),
            ("4651602", "SECUNDARIO"),
            ("4652400", "SECUNDARIO"),
            ("4669999", "SECUNDARIO"),
            ("4752100", "SECUNDARIO"),
            ("4761003", "SECUNDARIO"),
            ("6110803", "SECUNDARIO"),
            ("6120599", "SECUNDARIO"),
            ("6190601", "SECUNDARIO"),
            ("6190699", "SECUNDARIO"),
            ("6201501", "SECUNDARIO"),
            ("6202300", "SECUNDARIO"),
            ("6203100", "SECUNDARIO"),
            ("6204000", "SECUNDARIO"),
            ("6209100", "SECUNDARIO"),
            ("6311900", "SECUNDARIO"),
            ("7112000", "SECUNDARIO"),
            ("7319002", "SECUNDARIO"),
            ("7490104", "SECUNDARIO"),
            ("7711000", "SECUNDARIO"),
            ("7739099", "SECUNDARIO"),
            ("7820500", "SECUNDARIO"),
            ("8011101", "SECUNDARIO"),
            ("8020001", "SECUNDARIO"),
            ("8020002", "SECUNDARIO"),
            ("8219901", "SECUNDARIO"),
            ("8220200", "SECUNDARIO"),
            ("8599603", "SECUNDARIO"),
            ("9511800", "SECUNDARIO"),
            ("9512600", "SECUNDARIO"),
            ("9521500", "SECUNDARIO")
        ]
        
        for cnae_code, cnae_type in cnaes_list:
            existing_cnae = db.query(CompanyCnae).filter(
                CompanyCnae.company_id == company.id,
                CompanyCnae.cnae_codigo == cnae_code
            ).first()
            if not existing_cnae:
                new_cnae = CompanyCnae(
                    id=str(uuid.uuid4()),
                    company_id=company.id,
                    cnae_codigo=cnae_code,
                    tipo=cnae_type
                )
                db.add(new_cnae)
        db.commit()
        logger.info("CNAEs seeded successfully.")
        
        logger.info("STELMAT company successfully seeded! ✅")

    except Exception as e:
        logger.error(f"Error seeding STELMAT: {e}")
        db.rollback()
    finally:
        db.close()
