import csv
import io
import datetime
from decimal import Decimal
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import select, delete, func
from src.core.search import unaccent_ilike
from .models import NcmStHeader, NcmStItem
from .schemas import NcmStHeaderCreate, NcmStHeaderUpdate, NcmStItemCreate
from src.modules.catalog.models import State

class NcmStService:
    @staticmethod
    def get_headers(db: Session, tenant_id: str, skip: int = 0, limit: int = 100):
        # Join with State to get Sigla
        query = db.query(
            NcmStHeader, 
            State.sigla.label("state_sigla"),
            func.count(NcmStItem.id).label("item_count")
        ).join(State, NcmStHeader.state_id == State.id)\
         .outerjoin(NcmStItem, NcmStHeader.id == NcmStItem.cad_ncm_st_id)\
         .filter(NcmStHeader.tenant_id == tenant_id)\
         .group_by(NcmStHeader.id, State.sigla)\
         .offset(skip).limit(limit)
        
        results = []
        for header, sigla, count in query.all():
            header.state_sigla = sigla
            header.item_count = count
            results.append(header)
        return results

    @staticmethod
    def get_header(db: Session, header_id: str, tenant_id: str):
        return db.query(NcmStHeader).filter(NcmStHeader.id == header_id, NcmStHeader.tenant_id == tenant_id).first()

    @staticmethod
    def create_header(db: Session, header_in: NcmStHeaderCreate, tenant_id: str, user_id: str):
        db_header = NcmStHeader(
            **header_in.model_dump(),
            tenant_id=tenant_id,
            created_by=user_id,
            updated_by=user_id
        )
        db.add(db_header)
        db.commit()
        db.refresh(db_header)
        return db_header

    @staticmethod
    def update_header(db: Session, header_id: str, header_in: NcmStHeaderUpdate, tenant_id: str, user_id: str):
        db_header = NcmStService.get_header(db, header_id, tenant_id)
        if not db_header:
            return None
        
        update_data = header_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(db_header, field, value)
        
        db_header.updated_by = user_id
        db_header.updated_at = datetime.datetime.utcnow()
        
        db.commit()
        db.refresh(db_header)
        return db_header

    @staticmethod
    def delete_header(db: Session, header_id: str, tenant_id: str):
        db_header = NcmStService.get_header(db, header_id, tenant_id)
        if db_header:
            db.delete(db_header)
            db.commit()
            return True
        return False

    @staticmethod
    def get_items(db: Session, header_id: str, skip: int = 0, limit: int = 100, q: Optional[str] = None):
        query = db.query(NcmStItem).filter(NcmStItem.cad_ncm_st_id == header_id)
        
        if q:
            query = query.filter(
                unaccent_ilike(NcmStItem.ncm_normalizado, q) |
                unaccent_ilike(NcmStItem.cest_normalizado, q) |
                unaccent_ilike(NcmStItem.descricao, q)
            )
            
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def count_items(db: Session, header_id: str, q: Optional[str] = None):
        query = db.query(func.count(NcmStItem.id)).filter(NcmStItem.cad_ncm_st_id == header_id)
        
        if q:
            query = query.filter(
                unaccent_ilike(NcmStItem.ncm_normalizado, q) |
                unaccent_ilike(NcmStItem.cest_normalizado, q) |
                unaccent_ilike(NcmStItem.descricao, q)
            )
            
        return query.scalar()

    @staticmethod
    def import_csv(db: Session, header_id: str, csv_content: str, strategy: str = "REPLACE") -> Tuple[int, int, int]:
        if strategy == "REPLACE":
            db.execute(delete(NcmStItem).where(NcmStItem.cad_ncm_st_id == header_id))
        
        f = io.StringIO(csv_content)
        reader = csv.DictReader(f)
        
        items_to_insert = []
        processed = 0
        success = 0
        errors = 0
        
        for row in reader:
            processed += 1
            try:
                # Basic conversion / normalization
                item_data = {
                    "cad_ncm_st_id": header_id,
                    "item": row.get("item"),
                    "is_active": row.get("ativo", "true").lower() == "true",
                    "ncm_sh": row.get("ncm_sh"),
                    "ncm_normalizado": row.get("ncm_normalizado"),
                    "cest": row.get("cest"),
                    "descricao": row.get("descricao"),
                    "observacoes": row.get("observacoes"),
                    "vigencia_inicio": NcmStService._parse_date(row.get("vigencia_inicio")),
                    "fundamento": row.get("fundamento"),
                    "segmento_anexo": row.get("segmento_anexo"),
                    "cest_normalizado": row.get("cest_normalizado"),
                    "mva_percent": NcmStService._parse_decimal(row.get("mva_percent")),
                    "vigencia_fim": NcmStService._parse_date(row.get("vigencia_fim")),
                }
                items_to_insert.append(item_data)
                success += 1
            except Exception:
                errors += 1
                continue
            
            # Bulk insert in chunks of 1000
            if len(items_to_insert) >= 1000:
                db.bulk_insert_mappings(NcmStItem, items_to_insert)
                items_to_insert = []
                db.flush()

        if items_to_insert:
            db.bulk_insert_mappings(NcmStItem, items_to_insert)
        
        db.commit()
        return processed, success, errors

    @staticmethod
    def _parse_date(date_str: Optional[str]) -> Optional[datetime.datetime]:
        if not date_str:
            return None
        try:
            # Try common formats
            for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"):
                try:
                    return datetime.datetime.strptime(date_str, fmt)
                except ValueError:
                    continue
            return None
        except Exception:
            return None

    @staticmethod
    def _parse_decimal(val: Optional[str]) -> Optional[Decimal]:
        if not val:
            return None
        try:
            return Decimal(val.replace(",", "."))
        except Exception:
            return None
