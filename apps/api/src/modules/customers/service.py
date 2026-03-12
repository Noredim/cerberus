from sqlalchemy.orm import Session
from sqlalchemy import or_
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

    def get_customer(self, tenant_id: str, customer_id: str) -> Optional[Customer]:
        return self.db.query(Customer).filter(
            Customer.id == customer_id,
            Customer.tenant_id == tenant_id
        ).first()

    def list_customers(self, tenant_id: str, q: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[Customer]:
        query = self.db.query(Customer).filter(Customer.tenant_id == tenant_id)
        
        if q:
            search_query = f"%{q}%"
            q_clean = re.sub(r'\D', '', q)
            filters = [
                Customer.razao_social.ilike(search_query),
                Customer.nome_fantasia.ilike(search_query)
            ]
            if q_clean:
                filters.append(Customer.cnpj.ilike(f"%{q_clean}%"))
            query = query.filter(or_(*filters))
            
        return query.offset(skip).limit(limit).all()

    def count_customers(self, tenant_id: str, q: Optional[str] = None) -> int:
        query = self.db.query(Customer).filter(Customer.tenant_id == tenant_id)
        if q:
            search_query = f"%{q}%"
            q_clean = re.sub(r'\D', '', q)
            filters = [
                Customer.razao_social.ilike(search_query),
                Customer.nome_fantasia.ilike(search_query)
            ]
            if q_clean:
                filters.append(Customer.cnpj.ilike(f"%{q_clean}%"))
            query = query.filter(or_(*filters))
        return query.count()

    def update_customer(self, tenant_id: str, customer_id: str, payload: CustomerUpdate) -> Optional[Customer]:
        customer = self.get_customer(tenant_id, customer_id)
        if not customer:
            return None
        
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(customer, field, value)
            
        self.db.commit()
        self.db.refresh(customer)
        return customer

    def delete_customer(self, tenant_id: str, customer_id: str) -> bool:
        customer = self.get_customer(tenant_id, customer_id)
        if not customer:
            return False
        
        self.db.delete(customer)
        self.db.commit()
        return True
