import requests
import datetime
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from src.modules.catalog.models import State, City, IbgeSyncJob, SyncJobStatus
from src.modules.catalog.schemas import IbgeStateResponse, IbgeCityResponse

class IbgeLocationsService:
    BASE_URL = "https://servicodados.ibge.gov.br/api/v1/localidades"

    @staticmethod
    def fetch_states() -> List[dict]:
        response = requests.get(f"{IbgeLocationsService.BASE_URL}/estados", timeout=30)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def fetch_cities_by_state(ibge_state_id: int) -> List[dict]:
        response = requests.get(f"{IbgeLocationsService.BASE_URL}/estados/{ibge_state_id}/municipios", timeout=30)
        response.raise_for_status()
        return response.json()

    @staticmethod
    def sync_locations(db: Session, tenant_id: str, triggered_by_user_id: Optional[str] = None):
        job = IbgeSyncJob(
            tenant_id=tenant_id,
            status=SyncJobStatus.RUNNING,
            triggered_by_user_id=triggered_by_user_id,
            summary_json={
                "states_created": 0,
                "states_updated": 0,
                "cities_created": 0,
                "cities_updated": 0
            }
        )
        db.add(job)
        db.commit()
        db.refresh(job)

        try:
            # 1. Sync States
            ibge_states = IbgeLocationsService.fetch_states()
            state_mapping = {} # ibge_id -> db_id

            for s_data in ibge_states:
                # Normalizing
                ibge_id = s_data["id"]
                state = db.query(State).filter(
                    State.tenant_id == tenant_id,
                    State.ibge_id == ibge_id
                ).first()

                if state:
                    state.sigla = s_data["sigla"]
                    state.nome = s_data["nome"]
                    state.regiao_nome = s_data["regiao"]["nome"]
                    state.regiao_sigla = s_data["regiao"]["sigla"]
                    state.last_sync_at = datetime.datetime.utcnow()
                    job.summary_json["states_updated"] += 1
                else:
                    state = State(
                        tenant_id=tenant_id,
                        ibge_id=ibge_id,
                        sigla=s_data["sigla"],
                        nome=s_data["nome"],
                        regiao_nome=s_data["regiao"]["nome"],
                        regiao_sigla=s_data["regiao"]["sigla"],
                        last_sync_at=datetime.datetime.utcnow()
                    )
                    db.add(state)
                    job.summary_json["states_created"] += 1
                
                db.flush() # Ensure ID is generated
                state_mapping[ibge_id] = state.id

            # 2. Sync Cities for each state
            for ibge_state_id, db_state_id in state_mapping.items():
                ibge_cities = IbgeLocationsService.fetch_cities_by_state(ibge_state_id)
                for c_data in ibge_cities:
                    ibge_city_id = c_data["id"]
                    city = db.query(City).filter(
                        City.tenant_id == tenant_id,
                        City.ibge_id == ibge_city_id
                    ).first()

                    micro = c_data.get("microrregiao") or {}
                    meso = micro.get("mesorregiao") or {}

                    if city:
                        city.nome = c_data["nome"]
                        city.state_id = db_state_id
                        city.microregiao = micro.get("nome")
                        city.mesorregiao = meso.get("nome")
                        city.last_sync_at = datetime.datetime.utcnow()
                        job.summary_json["cities_updated"] += 1
                    else:
                        city = City(
                            tenant_id=tenant_id,
                            ibge_id=ibge_city_id,
                            state_id=db_state_id,
                            nome=c_data["nome"],
                            microregiao=micro.get("nome"),
                            mesorregiao=meso.get("nome"),
                            last_sync_at=datetime.datetime.utcnow()
                        )
                        db.add(city)
                        job.summary_json["cities_created"] += 1
                
                db.flush()

            job.status = SyncJobStatus.SUCCESS
            job.finished_at = datetime.datetime.utcnow()
            db.commit()

        except Exception as e:
            db.rollback()
            job.status = SyncJobStatus.FAILED
            job.error_message = str(e)
            job.finished_at = datetime.datetime.utcnow()
            db.add(job) # Need to re-add because of rollback
            db.commit()
            raise e

        return job
