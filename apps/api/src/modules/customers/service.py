from sqlalchemy.orm import Session
from sqlalchemy import or_
from src.core.search import unaccent_ilike
from .models import Customer
from .schemas import CustomerCreate, CustomerUpdate
from typing import List, Optional
import re

class CustomerService:
    def __init__(self, db: Session):
        self.db = db

    def create_customer(self, tenant_id: str, payload: CustomerCreate) -> Customer:
        customer = Customer(
            tenant_id=tenant_id,
            **payload.model_dump()
        )
        self.db.add(customer)
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def get_customer(self, tenant_id: str, customer_id: str, company_id: Optional[str] = None) -> Optional[Customer]:
        query = self.db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.tenant_id == tenant_id
        )
        if company_id:
            query = query.filter(Customer.company_id == company_id)
        return query.first()

    def list_customers(self, tenant_id: str, q: Optional[str] = None, skip: int = 0, limit: int = 100, company_id: Optional[str] = None) -> List[Customer]:
        query = self.db.query(Customer).filter(Customer.tenant_id == tenant_id)
        if company_id:
            query = query.filter(Customer.company_id == company_id)
        
        if q:
            q_clean = re.sub(r'\D', '', q)
            filters = [
                unaccent_ilike(Customer.razao_social, q),
                unaccent_ilike(Customer.nome_fantasia, q)
            ]
            if q_clean:
                filters.append(Customer.cnpj.ilike(f"%{q_clean}%"))
            query = query.filter(or_(*filters))
            
        return query.offset(skip).limit(limit).all()

    def count_customers(self, tenant_id: str, q: Optional[str] = None, company_id: Optional[str] = None) -> int:
        query = self.db.query(Customer).filter(Customer.tenant_id == tenant_id)
        if company_id:
            query = query.filter(Customer.company_id == company_id)
        if q:
            q_clean = re.sub(r'\D', '', q)
            filters = [
                unaccent_ilike(Customer.razao_social, q),
                unaccent_ilike(Customer.nome_fantasia, q)
            ]
            if q_clean:
                filters.append(Customer.cnpj.ilike(f"%{q_clean}%"))
            query = query.filter(or_(*filters))
        return query.count()

    def update_customer(self, tenant_id: str, customer_id: str, payload: CustomerUpdate, company_id: Optional[str] = None) -> Optional[Customer]:
        customer = self.get_customer(tenant_id, customer_id, company_id)
        if not customer:
            return None
        
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(customer, field, value)
            
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def delete_customer(self, tenant_id: str, customer_id: str, company_id: Optional[str] = None) -> bool:
        customer = self.get_customer(tenant_id, customer_id, company_id)
        if not customer:
            return False
        
        self.db.delete(customer)
        self.db.commit()
        return True
