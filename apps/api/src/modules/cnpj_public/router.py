# src/modules/cnpj_public/router.py
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List
from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from .schemas import CnpjLookupResponse, SyncTriggerRequest, BatchRunResponse
from .models import BatchRun
from .etl.batch_control import create_batch_run
from .etl.pipeline import run_cnpj_sync_job

router = APIRouter(prefix="/cnpj-public", tags=["CNPJ ETL"])

@router.get("/lookup/{cnpj_raw}", response_model=CnpjLookupResponse)
def lookup_cnpj(
    cnpj_raw: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fast, single-CNPJ lookup using a direct SQL query against the normalized 
    cnpj_public schema. Returns complete JOINed data.
    """
    # Clean non-digits
    cnpj = "".join(filter(str.isdigit, cnpj_raw))
    if len(cnpj) != 14:
        raise HTTPException(status_code=400, detail="CNPJ deve conter 14 dígitos numéricos.")

    # High-performance Raw SQL for wide joins (faster than ORM for exactly 1 record with deep relations)
    query = text("""
        SELECT 
            e.cnpj,
            emp.razao_social,
            e.nome_fantasia,
            e.situacao_cadastral,
            e.data_inicio_atividade,
            emp.natureza_juridica_codigo,
            emp.porte_codigo,
            e.logradouro,
            e.numero,
            e.complemento,
            e.bairro,
            e.cep,
            e.municipio_ibge,
            e.uf,
            c_prin.cnae_codigo as c_prin_cod,
            c_prin.descricao as c_prin_desc
        FROM cnpj_public.estabelecimentos e
        JOIN cnpj_public.empresas emp ON e.cnpj_basico = emp.cnpj_basico
        LEFT JOIN cnpj_public.cnaes c_prin ON e.cnae_principal = c_prin.cnae_codigo
        WHERE e.cnpj = :cnpj
    """)

    result = db.execute(query, {"cnpj": cnpj}).mappings().first()
    if not result:
        raise HTTPException(status_code=404, detail="CNPJ não encontrado na base pública.")

    # Fetch secondary CNAEs
    sec_query = text("""
        SELECT c.cnae_codigo, c.descricao
        FROM cnpj_public.estabelecimento_cnae_secundario ecs
        JOIN cnpj_public.cnaes c ON ecs.cnae_codigo = c.cnae_codigo
        WHERE ecs.cnpj = :cnpj
    """)
    sec_result = db.execute(sec_query, {"cnpj": cnpj}).mappings().all()

    cnaes_sec = [{"codigo": r["cnae_codigo"], "descricao": r["descricao"]} for r in sec_result]

    return {
        "cnpj": result["cnpj"],
        "razao_social": result["razao_social"],
        "nome_fantasia": result["nome_fantasia"],
        "situacao_cadastral": result["situacao_cadastral"],
        "data_inicio_atividade": result["data_inicio_atividade"],
        "natureza_juridica_codigo": result["natureza_juridica_codigo"],
        "porte_codigo": result["porte_codigo"],
        "endereco": {
            "logradouro": result["logradouro"],
            "numero": result["numero"],
            "complemento": result["complemento"],
            "bairro": result["bairro"],
            "cep": result["cep"],
            "municipio_ibge": result["municipio_ibge"],
            "uf": result["uf"],
        },
        "cnae_principal": {"codigo": result["c_prin_cod"], "descricao": result["c_prin_desc"]} if result["c_prin_cod"] else None,
        "cnaes_secundarios": cnaes_sec
    }

@router.post("/sync", status_code=202)
def trigger_sync(
    payload: SyncTriggerRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Manually triggers the CNPJ Public ETL job. 
    Requires ADMIN level permissions. Runs via BackgroundTasks for fire-and-forget.
    """
    # Authorization logic based on standard Cerberus user roles
    if "ADMIN" not in [r.role.name for r in current_user.roles]:
        raise HTTPException(status_code=403, detail="Acesso negado. Requer permissão ADMIN.")

    # Check if there is a RUNNING job already
    active_job = db.query(BatchRun).filter(BatchRun.status == "RUNNING").first()
    if active_job:
        raise HTTPException(status_code=409, detail=f"Já existe um job rodando (ID: {active_job.batch_id}).")

    # Create batch record
    batch_id = create_batch_run(
        db=db, 
        source_name="gov_cnpj_open_data", 
        source_ref=payload.source_ref, 
        user_id=current_user.id
    )

    # Dispatch to background
    background_tasks.add_task(run_cnpj_sync_job, batch_id=batch_id, source_ref=payload.source_ref, dry_run=payload.dry_run)
    return {"message": "Job de sincronização ETL iniciado.", "batch_id": batch_id}

@router.get("/batches", response_model=List[BatchRunResponse])
def list_batches(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List historical ETL batch executions.
    """
    if "ADMIN" not in [r.role.name for r in current_user.roles]:
        raise HTTPException(status_code=403, detail="Acesso negado.")

    return db.query(BatchRun).order_by(BatchRun.started_at.desc()).limit(limit).all()
