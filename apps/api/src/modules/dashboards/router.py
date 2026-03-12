from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from src.core.database import get_db

router = APIRouter(prefix="/dashboards", tags=["Dashboards"])

@router.get("/kpis")
def get_dashboard_kpis(db: Session = Depends(get_db)):
    # Placeholder
    return {
        "margem_media": 35.5,
        "roi_medio": 18.2,
        "tempo_proposta": "15m",
        "novas_oportunidades": 12
    }
