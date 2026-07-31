import os
import sys
import json
import logging
import uuid
from datetime import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Garantir que a pasta apps/api esteja no sys.path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from src.core.config import settings
from src.modules.users.models import User, UserRole, UserRoleEnum, UserCompany
from src.modules.companies.models import Company
from src.modules.own_services.models import OwnService
from src.modules.tenants.models import Tenant
from src.modules.catalog.models import State, IbgeSyncJob
from src.modules.ncm_st.models import NcmStHeader, NcmStItem

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DATA_FILE = os.path.join(current_dir, "ncm_st_data.json")

def seed_ncm_st():
    logger.info("Iniciando carga da tabela NCM ST...")

    if not os.path.exists(DATA_FILE):
        logger.error(f"Arquivo de dados não encontrado: {DATA_FILE}")
        sys.exit(1)

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        items_data = json.load(f)

    logger.info(f"Carregados {len(items_data)} itens NCM ST do arquivo JSON.")

    engine = create_engine(settings.DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        tenants = db.query(Tenant).all()
        if not tenants:
            logger.warning("Nenhum Tenant encontrado no banco. Criando tenant padrão se necessário.")
            tenant = Tenant(id=str(uuid.uuid4()), cnpj="00000000000000", razao_social="Tenant Principal")
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
            tenants = [tenant]

        # Garantir estado MT no cadastro
        state_mt = db.query(State).filter(State.sigla == "MT").first()
        if not state_mt:
            logger.info("Criando estado MT no cadastro de Estados...")
            state_mt = State(
                id=str(uuid.uuid4()),
                codigo_ibge="51",
                sigla="MT",
                nome="Mato Grosso",
                regiao="Centro-Oeste",
                pais_sigla="CO"
            )
            db.add(state_mt)
            db.commit()
            db.refresh(state_mt)

        for tenant in tenants:
            logger.info(f"Processando NCM ST para o Tenant: {tenant.razao_social} ({tenant.id})")

            # Buscar ou criar cabeçalho NCM ST para MT
            header = db.query(NcmStHeader).filter(
                NcmStHeader.tenant_id == tenant.id,
                NcmStHeader.state_id == state_mt.id
            ).first()

            if not header:
                logger.info(f"Criando cabeçalho NCM ST SEFAZ MT para tenant {tenant.id}")
                header = NcmStHeader(
                    id=str(uuid.uuid4()),
                    tenant_id=tenant.id,
                    state_id=state_mt.id,
                    description="NCM ST SEFAZ MT",
                    is_active=True
                )
                db.add(header)
                db.commit()
                db.refresh(header)
            else:
                logger.info(f"Cabeçalho existente encontrado ID: {header.id}")

            # Mapear itens existentes por ncm_normalizado + cest_normalizado + item para upsert
            existing_items = db.query(NcmStItem).filter(NcmStItem.cad_ncm_st_id == header.id).all()
            existing_map = {
                f"{item.ncm_normalizado or ''}_{item.cest_normalizado or ''}_{item.item or ''}": item
                for item in existing_items
            }

            inserted_count = 0
            updated_count = 0

            for raw in items_data:
                key = f"{raw.get('ncm_normalizado') or ''}_{raw.get('cest_normalizado') or ''}_{raw.get('item') or ''}"
                existing = existing_map.get(key)

                v_inicio = datetime.fromisoformat(raw['vigencia_inicio']) if raw.get('vigencia_inicio') else None
                v_fim = datetime.fromisoformat(raw['vigencia_fim']) if raw.get('vigencia_fim') else None

                if existing:
                    existing.item = raw.get('item')
                    existing.is_active = raw.get('is_active', True)
                    existing.ncm_sh = raw.get('ncm_sh')
                    existing.cest = raw.get('cest')
                    existing.descricao = raw.get('descricao')
                    existing.observacoes = raw.get('observacoes')
                    existing.vigencia_inicio = v_inicio
                    existing.fundamento = raw.get('fundamento')
                    existing.segmento_anexo = raw.get('segmento_anexo')
                    existing.mva_percent = raw.get('mva_percent')
                    existing.vigencia_fim = v_fim
                    updated_count += 1
                else:
                    new_item = NcmStItem(
                        id=raw.get('id') or str(uuid.uuid4()),
                        cad_ncm_st_id=header.id,
                        item=raw.get('item'),
                        is_active=raw.get('is_active', True),
                        ncm_sh=raw.get('ncm_sh'),
                        ncm_normalizado=raw.get('ncm_normalizado'),
                        cest=raw.get('cest'),
                        descricao=raw.get('descricao'),
                        observacoes=raw.get('observacoes'),
                        vigencia_inicio=v_inicio,
                        fundamento=raw.get('fundamento'),
                        segmento_anexo=raw.get('segmento_anexo'),
                        cest_normalizado=raw.get('cest_normalizado'),
                        mva_percent=raw.get('mva_percent'),
                        vigencia_fim=v_fim
                    )
                    db.add(new_item)
                    inserted_count += 1

            db.commit()
            logger.info(f"Finalizada carga NCM ST para tenant {tenant.id}: {inserted_count} inseridos, {updated_count} atualizados.")

        logger.info("Carga da tabela NCM ST concluída com sucesso em todos os tenants!")

    except Exception as e:
        logger.error(f"Erro ao executar seed NCM ST: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    seed_ncm_st()
