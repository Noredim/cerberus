from sqlalchemy.orm import Session
from sqlalchemy import or_
from src.core.search import unaccent_ilike
from datetime import datetime, date, timedelta
from uuid import UUID
from typing import List, Optional
from fastapi import HTTPException
from ..models import Ncm, NcmImportacao
from ..schemas import NcmImportSchema, NcmCreate, NcmUpdate
from src.modules.companies.models import TaxBenefit

class NcmService:
    def __init__(self, db: Session):
        self.db = db

    def get_all(self, 
                skip: int = 0, 
                limit: int = 100, 
                codigo: Optional[str] = None, 
                descricao: Optional[str] = None,
                active_only: bool = True):
        query = self.db.query(Ncm)
        
        if active_only:
            query = query.filter(Ncm.deleted_at == None)
            
        if codigo:
            codigo_clean = "".join(filter(str.isdigit, codigo))
            query = query.filter(Ncm.codigo.ilike(f"{codigo_clean}%"))
        if descricao:
            query = query.filter(unaccent_ilike(Ncm.descricao, descricao))
            
        total = query.count()
        items = query.order_by(Ncm.codigo).offset(skip).limit(limit).all()
        
        return items, total

    def get_by_id(self, ncm_id: UUID):
        ncm = self.db.query(Ncm).filter(Ncm.id == ncm_id).first()
        if not ncm:
            raise HTTPException(status_code=404, detail="NCM não encontrado.")
        return ncm

    def create(self, data: NcmCreate):
        # Check uniqueness: codigo + data_inicio + data_fim
        existing = self.db.query(Ncm).filter(
            Ncm.codigo == data.codigo,
            Ncm.data_inicio == data.data_inicio,
            Ncm.data_fim == data.data_fim
        ).first()
        
        if existing:
            raise HTTPException(status_code=400, detail="Já existe um NCM com este código e vigência.")

        new_ncm = Ncm(**data.model_dump())
        self.db.add(new_ncm)
        self.db.commit()
        self.db.refresh(new_ncm)
        return new_ncm

    def update(self, ncm_id: UUID, data: NcmUpdate):
        ncm = self.get_by_id(ncm_id)
        
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(ncm, field, value)
            
        self.db.commit()
        self.db.refresh(ncm)
        return ncm

    def delete(self, ncm_id: UUID):
        ncm = self.get_by_id(ncm_id)
        ncm.deleted_at = datetime.utcnow()
        self.db.commit()
        return True

    def import_json(self, data: NcmImportSchema):
        # 1. Create Import Header
        importacao = NcmImportacao(
            data_ultima_atualizacao_ncm=data.Data_Ultima_Atualizacao_NCM,
            ato=data.Ato
        )
        self.db.add(importacao)
        self.db.flush() # Get ID

        stats = {
            "total_processados": 0,
            "total_inseridos": 0,
            "total_atualizados": 0,
            "total_ignorados": 0,
            "importacao_id": importacao.id
        }

        for item in data.Nomenclaturas:
            stats["total_processados"] += 1
            try:
                # Basic normalization of dates (Assuming DD/MM/YYYY or YYYY-MM-DD)
                # The schema handles basic type conversion if we use date objects, 
                # but here we receive strings from JSON raw.
                d_ini = self._parse_date(item.Data_Inicio)
                d_fim = self._parse_date(item.Data_Fim)
                
                if d_ini > d_fim:
                    # Invalid item, skip or log error
                    stats["total_ignorados"] += 1
                    continue

                # Search by key
                existing = self.db.query(Ncm).filter(
                    Ncm.codigo == item.Codigo,
                    Ncm.data_inicio == d_ini,
                    Ncm.data_fim == d_fim
                ).first()

                if existing:
                    # Update other fields
                    existing.descricao = item.Descricao
                    existing.tipo_ato_ini = item.Tipo_Ato_Ini
                    existing.numero_ato_ini = item.Numero_Ato_Ini
                    existing.ano_ato_ini = item.Ano_Ato_Ini
                    existing.importacao_id = importacao.id
                    existing.deleted_at = None # Restore if soft-deleted
                    stats["total_atualizados"] += 1
                else:
                    new_ncm = Ncm(
                        codigo=item.Codigo,
                        descricao=item.Descricao,
                        data_inicio=d_ini,
                        data_fim=d_fim,
                        tipo_ato_ini=item.Tipo_Ato_Ini,
                        numero_ato_ini=item.Numero_Ato_Ini,
                        ano_ato_ini=item.Ano_Ato_Ini,
                        importacao_id=importacao.id
                    )
                    self.db.add(new_ncm)
                    stats["total_inseridos"] += 1

            except Exception as e:
                # Log error and continue
                stats["total_ignorados"] += 1
                continue

        self.db.commit()
        return stats

    def _parse_date(self, date_str: str) -> date:
        # Try common formats
        formats = [
            "%d/%m/%Y",
            "%Y-%m-%d",
            "%d-%m-%Y"
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Formato de data inválido: {date_str}")

    def _normalize_ncm(self, ncm: str) -> str:
        """Remove pontos e espaços de um NCM."""
        if not ncm:
            return ""
        return "".join(filter(str.isdigit, ncm))

    def get_linked_benefits(self, ncm_code: str):
        """
        Busca benefícios onde o NCM (normalizado) está presente na lista de incluídos.
        Nota: Como regra_json é JSONB, a busca por NCM normalizado em uma lista
        que pode conter pontos exige uma abordagem flexível.
        """
        ncm_clean = self._normalize_ncm(ncm_code)
        if not ncm_clean:
            return []

        # Buscamos todos os benefícios ativos para o tenant e filtramos
        # (Ideal para volumes moderados de benefícios)
        all_benefits = self.db.query(TaxBenefit).filter(TaxBenefit.ativo == True).all()
        
        linked = []
        for b in all_benefits:
            regra = b.regra_json
            condicoes = regra.get("condicoes", {})
            ncm_incluir = condicoes.get("ncm_incluir", [])
            
            # Normalizamos cada NCM da lista do benefício para comparar com o NCM do produto
            import re
            normalized_list = [re.sub(r'\D', '', str(code)) for code in ncm_incluir]
            
            if ncm_clean in normalized_list:
                linked.append(b)
                
        return linked
