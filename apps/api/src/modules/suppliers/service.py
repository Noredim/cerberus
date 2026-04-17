from sqlalchemy.orm import Session
from sqlalchemy import or_
from src.core.search import unaccent_ilike
from .models import Supplier
from .schemas import SupplierCreate, SupplierUpdate
from typing import List, Optional
import re

class SupplierService:
    def __init__(self, db: Session):
        self.db = db

    def create_supplier(self, tenant_id: str, payload: SupplierCreate) -> Supplier:
        supplier = Supplier(
            tenant_id=tenant_id,
            **payload.model_dump()
        )
        self.db.add(supplier)
        self.db.commit()
        self.db.refresh(supplier)
        return supplier

    def get_supplier(self, tenant_id: str, supplier_id: str, company_id: Optional[str] = None) -> Optional[Supplier]:
        query = self.db.query(Supplier).filter(
            Supplier.id == supplier_id,
            Supplier.tenant_id == tenant_id
        )
        if company_id:
            query = query.filter(Supplier.company_id == company_id)
        return query.first()

    def list_suppliers(self, tenant_id: str, q: Optional[str] = None, skip: int = 0, limit: int = 100, company_id: Optional[str] = None) -> List[Supplier]:
        query = self.db.query(Supplier).filter(Supplier.tenant_id == tenant_id)
        if company_id:
            query = query.filter(Supplier.company_id == company_id)
        
        if q:
            q_clean = re.sub(r'\D', '', q)
            filters = [
                unaccent_ilike(Supplier.razao_social, q),
                unaccent_ilike(Supplier.nome_fantasia, q)
            ]
            if q_clean:
                filters.append(Supplier.cnpj.ilike(f"%{q_clean}%"))
            query = query.filter(or_(*filters))
            
        return query.offset(skip).limit(limit).all()

    def count_suppliers(self, tenant_id: str, q: Optional[str] = None, company_id: Optional[str] = None) -> int:
        query = self.db.query(Supplier).filter(Supplier.tenant_id == tenant_id)
        if company_id:
            query = query.filter(Supplier.company_id == company_id)
        if q:
            q_clean = re.sub(r'\D', '', q)
            filters = [
                unaccent_ilike(Supplier.razao_social, q),
                unaccent_ilike(Supplier.nome_fantasia, q)
            ]
            if q_clean:
                filters.append(Supplier.cnpj.ilike(f"%{q_clean}%"))
            query = query.filter(or_(*filters))
        return query.count()

    def update_supplier(self, tenant_id: str, supplier_id: str, payload: SupplierUpdate, company_id: Optional[str] = None) -> Optional[Supplier]:
        supplier = self.get_supplier(tenant_id, supplier_id, company_id)
        if not supplier:
            return None
        
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(supplier, field, value)
            
        self.db.commit()
        self.db.refresh(supplier)
        return supplier

    def delete_supplier(self, tenant_id: str, supplier_id: str, company_id: Optional[str] = None) -> bool:
        supplier = self.get_supplier(tenant_id, supplier_id, company_id)
        if not supplier:
            return False
        
        self.db.delete(supplier)
        self.db.commit()
        return True
