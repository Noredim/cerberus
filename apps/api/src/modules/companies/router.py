from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import text
from typing import List
import uuid
from uuid import UUID
import json
import os
import shutil

from src.core.database import get_db
from src.modules.auth.dependencies import get_current_user
from src.modules.users.models import User
from .models import Company, CompanyCnae, CompanyTaxProfile, CompanyBenefit, CompanyQsa
from .schemas import CompanyCreate, CompanyOut, CnpjIntegrationResult, CompanyTaxProfileBase, CompanyUpdate, CompanySalesParameterBase

from .providers.cnpj_provider import ReceitaWsProvider
from .services.cnpj_consultar_service import ConsultarEmpresaPorCNPJService

router = APIRouter(prefix="/companies", tags=["Companies"])

@router.post("/cnpj-lookup", response_model=CnpjIntegrationResult)
def lookup_cnpj(
    cnpj: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Integração de CNPJ: Bate no repositório local do ETL (cnpj_public).
    Isso cumpre o requisito P2 sem depender de chamadas externas HTTP.
    """
    cnpj_clean = "".join(filter(str.isdigit, cnpj))
    if len(cnpj_clean) != 14:
        raise HTTPException(status_code=400, detail="CNPJ deve possuir 14 dígitos.")
    
    # Query de altíssima performance usando raw SQL
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
            c_prin.cnae_codigo as c_prin_cod
        FROM cnpj_public.estabelecimentos e
        JOIN cnpj_public.empresas emp ON e.cnpj_basico = emp.cnpj_basico
        LEFT JOIN cnpj_public.cnaes c_prin ON e.cnae_principal = c_prin.cnae_codigo
        WHERE e.cnpj = :cnpj
    """)
    result = db.execute(query, {"cnpj": cnpj_clean}).mappings().first()
    
    if not result:
        raise HTTPException(status_code=404, detail="CNPJ não localizado no provedor local (Receita Federal ETL). Preencha manualmente.")

    # Busca cnae secundário
    sec_query = text("SELECT cnae_codigo FROM cnpj_public.estabelecimento_cnae_secundario WHERE cnpj = :cnpj")
    sec_result = db.execute(sec_query, {"cnpj": cnpj_clean}).mappings().all()
    cnaes_sec = [r["cnae_codigo"] for r in sec_result]

    return {
        "cnpj": result["cnpj"],
        "razao_social": result["razao_social"],
        "nome_fantasia": result["nome_fantasia"],
        "natureza_juridica_codigo": result["natureza_juridica_codigo"],
        "data_abertura": result["data_inicio_atividade"],
        "situacao_cadastral": result["situacao_cadastral"],
        "porte": result["porte_codigo"],
        "logradouro": result["logradouro"],
        "numero": result["numero"],
        "complemento": result["complemento"],
        "bairro": result["bairro"],
        "cep": result["cep"],
        "municipio_ibge": result["municipio_ibge"],
        "uf": result["uf"],
        "cnae_principal": result["c_prin_cod"],
        "cnaes_secundarios": cnaes_sec
    }

@router.get("/cnpj/{cnpj}/consultar")
async def consultar_cnpj(
    cnpj: str,
    force_refresh: bool = Query(False, description="Bypass cache and force HTTP lookup"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Consulta um CNPJ utilizando o provedor integrado (ReceitaWS) com suporte a cache.
    """
    provider = ReceitaWsProvider()
    service = ConsultarEmpresaPorCNPJService(provider, db)
    return await service.execute(
        cnpj=cnpj,
        tenant_id=current_user.tenant_id,
        user_id=str(current_user.id),
        force_refresh=force_refresh
    )

@router.post("/cnpj/{cnpj}/reconsultar")
async def reconsultar_cnpj(
    cnpj: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Força a reconsulta online ignorando o cache existente.
    """
    provider = ReceitaWsProvider()
    service = ConsultarEmpresaPorCNPJService(provider, db)
    return await service.execute(
        cnpj=cnpj,
        tenant_id=current_user.tenant_id,
        user_id=str(current_user.id),
        force_refresh=True
    )


@router.post("", response_model=CompanyOut, status_code=status.HTTP_201_CREATED)
def create_company(
    payload: CompanyCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Cria a Empresa, insere o Perfil Tributário e amarra CNAEs dentro da mesma transação.
    """
    # 1. Verifica CNPJ Único no Tenant
    existing = db.query(Company).filter(Company.tenant_id == current_user.tenant_id, Company.cnpj == payload.cnpj).first()
    if existing:
        raise HTTPException(status_code=400, detail="CNPJ já cadastrado neste Tenant.")

    company_id = uuid.uuid4()
    company_id_str = str(company_id)
    
    # 2. Prepara os dados de Natureza Jurídica
    nj_codigo = payload.natureza_juridica_codigo
    nj_descricao = payload.natureza_juridica_descricao

    if nj_codigo and " - " in nj_codigo:
        parts = nj_codigo.split(" - ", 1)
        nj_codigo = parts[0][:10] # Garante max 10 chars
        if not nj_descricao and len(parts) > 1:
            nj_descricao = parts[1][:255]

    # 3. Cria Entidade Principal
    company = Company(
        id=company_id,
        tenant_id=current_user.tenant_id,
        cnpj=payload.cnpj,
        tipo=payload.tipo,
        razao_social=payload.razao_social,
        nome_fantasia=payload.nome_fantasia,
        natureza_juridica_codigo=nj_codigo,
        natureza_juridica_descricao=nj_descricao,
        data_abertura=payload.data_abertura,
        situacao_cadastral=payload.situacao_cadastral,
        porte=payload.porte,
        capital_social=payload.capital_social,
        email=payload.email,
        telefone=payload.telefone,
        logradouro=payload.logradouro,
        numero=payload.numero,
        complemento=payload.complemento,
        bairro=payload.bairro,
        cep=payload.cep,
        municipality_id=payload.municipality_id,
        state_id=payload.state_id,
        cnpj_snapshot_json=None # Pode ser injetado o payload completo no front pra trilha de auditoria se quisesse
    )
    db.add(company)

    # 3. CNAEs
    primaries = 0
    for cnae_data in payload.cnaes:
        if cnae_data.tipo == "PRIMARIO":
            primaries += 1
        db.add(CompanyCnae(
            company_id=company_id,
            cnae_codigo=cnae_data.cnae_codigo,
            tipo=cnae_data.tipo
        ))
    if primaries != 1:
        raise HTTPException(status_code=400, detail="A empresa deve possuir exatamente 1 CNAE primário.")

    # 4. Perfil Tributário Inicial
    db.add(CompanyTaxProfile(
        company_id=company_id,
        vigencia_inicio=payload.initial_tax_profile.vigencia_inicio,
        vigencia_fim=None, # Perfil Ativo
        regime_tributario=payload.initial_tax_profile.regime_tributario,
        contribuinte_icms=payload.initial_tax_profile.contribuinte_icms,
        contribuinte_iss=payload.initial_tax_profile.contribuinte_iss,
        inscricao_estadual=payload.initial_tax_profile.inscricao_estadual,
        inscricao_municipal=payload.initial_tax_profile.inscricao_municipal,
        regime_iss=payload.initial_tax_profile.regime_iss,
        regime_icms=payload.initial_tax_profile.regime_icms,
        observacoes=payload.initial_tax_profile.observacoes
    ))

    # 5. Benefícios Fiscais
    for benefit_data in payload.benefits:
        db.add(CompanyBenefit(
            company_id=company_id,
            benefit_id=benefit_data.benefit_id,
            vigencia_inicio=benefit_data.vigencia_inicio,
            vigencia_fim=benefit_data.vigencia_fim,
            prioridade=benefit_data.prioridade,
            status=benefit_data.status,
            observacao=benefit_data.observacao
        ))

    # 6. Quadro de Sócios (QSA)
    for qsa_data in payload.qsa:
        db.add(CompanyQsa(
            company_id=company_id,
            nome=qsa_data.nome,
            qualificacao=qsa_data.qualificacao,
            pais_origem=qsa_data.pais_origem,
            nome_rep_legal=qsa_data.nome_rep_legal,
            qualificacao_rep_legal=qsa_data.qualificacao_rep_legal
        ))

    db.commit()
    db.refresh(company)
    return company

@router.post("/{company_id}/logo", response_model=CompanyOut)
async def upload_company_logo(
    company_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if file.content_type not in ["image/jpeg", "image/png", "image/jpg"]:
        raise HTTPException(400, "Arquivo inválido. Formatos aceitos: PNG, JPG, JPEG")
    
    company = db.query(Company).filter(
        Company.id == company_id, 
        Company.tenant_id == current_user.tenant_id
    ).first()
    
    if not company:
        raise HTTPException(404, "Empresa não encontrada.")
        
    upload_dir = "uploads/logos"
    os.makedirs(upload_dir, exist_ok=True)
    
    file_ext = file.filename.split(".")[-1]
    filename = f"{company_id}.{file_ext}"
    filepath = os.path.join(upload_dir, filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    company.logo_url = f"/uploads/logos/{filename}"
    db.commit()
    db.refresh(company)
    
    return company

@router.get("/{company_id}", response_model=CompanyOut)
def get_company(
    company_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        id_uuid = UUID(company_id) if isinstance(company_id, str) else company_id
    except:
        raise HTTPException(status_code=400, detail="ID de empresa inválido.")

    company = db.query(Company).options(
        joinedload(Company.tax_profiles),
        joinedload(Company.benefits).joinedload(CompanyBenefit.benefit),
        joinedload(Company.qsa)
    ).filter(
        Company.id == id_uuid, 
        Company.tenant_id == current_user.tenant_id
    ).first()
    
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")
        
    return company

@router.get("", response_model=List[CompanyOut])
def list_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(Company).options(
        joinedload(Company.tax_profiles),
        joinedload(Company.benefits).joinedload(CompanyBenefit.benefit)
    ).filter(Company.tenant_id == current_user.tenant_id).all()

# Endpoint para historico de Vigência/Fechamento do perfil tributário
@router.post("/{company_id}/tax-profile", status_code=status.HTTP_201_CREATED)
def change_tax_profile(
    company_id: str,
    payload: CompanyTaxProfileBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fecha o perfil atual com data de ieri e abre o novo.
    """
    company = db.query(Company).filter(Company.id == company_id, Company.tenant_id == current_user.tenant_id).first()
    if not company:
        raise HTTPException(404, "Empresa não encontrada.")

    active_profile = db.query(CompanyTaxProfile).filter(
        CompanyTaxProfile.company_id == company_id,
        CompanyTaxProfile.vigencia_fim == None
    ).first()

    if active_profile:
        # Se a data de inicio do novo é anterior do atual, da erro de backdate
        if payload.vigencia_inicio <= active_profile.vigencia_inicio:
            raise HTTPException(400, "Vigência início do novo perfil deve ser sucessora ao perfil atual.")
        
        # O fim do atual é o dia anterior ao início do novo
        from datetime import timedelta
        active_profile.vigencia_fim = payload.vigencia_inicio - timedelta(days=1)
        db.add(active_profile)

    new_profile = CompanyTaxProfile(
        company_id=company.id,
        vigencia_inicio=payload.vigencia_inicio,
        vigencia_fim=None,
        regime_tributario=payload.regime_tributario,
        contribuinte_icms=payload.contribuinte_icms,
        contribuinte_iss=payload.contribuinte_iss,
        inscricao_estadual=payload.inscricao_estadual,
        inscricao_municipal=payload.inscricao_municipal,
        regime_iss=payload.regime_iss,
        regime_icms=payload.regime_icms,
        observacoes=payload.observacoes
    )
    db.add(new_profile)
    db.commit()
    return {"message": "Perfil Tributário alterado com sucesso."}

@router.put("/{company_id}", response_model=CompanyOut)
def update_company(
    company_id: str,
    payload: CompanyUpdate, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Atualiza os dados da Empresa, CNAEs e QSA.
    """
    try:
        id_uuid = UUID(company_id) if isinstance(company_id, str) else company_id
    except:
        raise HTTPException(status_code=400, detail="ID de empresa inválido.")

    company = db.query(Company).filter(
        Company.id == id_uuid, 
        Company.tenant_id == current_user.tenant_id
    ).first()
    
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada.")

    # 1. Update basic fields (only provided ones)
    update_data = payload.model_dump(exclude={"cnaes", "initial_tax_profile", "benefits", "qsa"}, exclude_unset=True)
    for field, value in update_data.items():
        setattr(company, field, value)

    # 2. Update CNAEs (Delete all and recreate if provided)
    if payload.cnaes is not None:
        db.query(CompanyCnae).filter(CompanyCnae.company_id == id_uuid).delete()
        for cnae_data in payload.cnaes:
            db.add(CompanyCnae(
                company_id=id_uuid,
                cnae_codigo=cnae_data.cnae_codigo,
                tipo=cnae_data.tipo
            ))

    # 3. Update QSA (Delete all and recreate if provided)
    if payload.qsa is not None:
        db.query(CompanyQsa).filter(CompanyQsa.company_id == id_uuid).delete()
        for qsa_data in payload.qsa:
            db.add(CompanyQsa(
                company_id=id_uuid,
                nome=qsa_data.nome,
                qualificacao=qsa_data.qualificacao,
                pais_origem=qsa_data.pais_origem,
                nome_rep_legal=qsa_data.nome_rep_legal,
                qualificacao_rep_legal=qsa_data.qualificacao_rep_legal
            ))

    # Note: Benefits and Tax Profile are managed separately or via creation.
    # We keep them as they are for now to avoid side effects.

    db.commit()
    db.refresh(company)
    return company

@router.get("/{id}/sales-parameters", response_model=CompanySalesParameterBase)
def get_sales_parameters(
    id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from .models import CompanySalesParameter
    param = db.query(CompanySalesParameter).filter(
        CompanySalesParameter.company_id == id
    ).first()
    
    if not param:
        # Return default zeros instead of 404 to allow seamless UI binding
        from .schemas import CompanySalesParameterBase
        return CompanySalesParameterBase()
    
    return param

@router.put("/{id}/sales-parameters", response_model=CompanySalesParameterBase)
def upsert_sales_parameters(
    id: UUID,
    payload: CompanySalesParameterBase,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from .models import CompanySalesParameter
    
    # Check if company exists first
    company = db.query(Company).filter(
        Company.id == id,
        Company.tenant_id == current_user.tenant_id
    ).first()
    if not company:
        raise HTTPException(status_code=404, detail="Empresa não encontrada ou sem acesso.")

    param = db.query(CompanySalesParameter).filter(
        CompanySalesParameter.company_id == id
    ).first()
    
    if param:
        for key, value in payload.model_dump().items():
            setattr(param, key, value)
    else:
        param = CompanySalesParameter(company_id=id, **payload.model_dump())
        db.add(param)
        
    db.commit()
    db.refresh(param)
    return param
