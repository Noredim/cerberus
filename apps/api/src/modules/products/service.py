from sqlalchemy.orm import Session
from sqlalchemy import or_, func, desc
from src.core.search import unaccent_ilike
from .models import Product, ProductSupplier
from .schemas import ProductCreate, ProductUpdate
from src.modules.companies.models import Company
from src.modules.ncm_st.models import NcmStHeader, NcmStItem
from typing import List, Optional
import re
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException
from src.modules.ncm.services.ncm_service import NcmService

class ProductService:
    def __init__(self, db: Session):
        self.db = db

    def _generate_sku(self, tenant_id: str) -> str:
        # Simple SKU generation: PRD-XXXX
        last_product = self.db.query(Product).filter(
            Product.tenant_id == tenant_id
        ).order_by(desc(Product.created_at)).first()
        
        count = self.db.query(Product).filter(Product.tenant_id == tenant_id).count()
        next_id = count + 1
        return f"PRD-{next_id:04d}"

    def create_product(self, tenant_id: str, payload: ProductCreate) -> Product:
        if not payload.codigo:
            payload.codigo = self._generate_sku(tenant_id)
            
        product_data = payload.model_dump(exclude={'suppliers'})
        product = Product(
            tenant_id=tenant_id,
            **product_data
        )
        self.db.add(product)
        
        # Add suppliers
        for sup_data in payload.suppliers:
            ps = ProductSupplier(
                product_id=product.id,
                **sup_data.model_dump()
            )
            product.suppliers.append(ps)
            
        self.db.commit()
        self.db.refresh(product)
        return product

    def get_product(self, tenant_id: str, product_id: str) -> Optional[Product]:
        product = self.db.query(Product).filter(
            Product.id == product_id,
            Product.tenant_id == tenant_id
        ).first()
        if product:
            self._attach_benefits(product)
        return product

    def list_products(self, tenant_id: str, q: Optional[str] = None, tipo: Optional[str] = None, skip: int = 0, limit: int = 100) -> List[Product]:
        query = self.db.query(Product).filter(Product.tenant_id == tenant_id)
        
        if q:
            q_clean = re.sub(r'\D', '', q)
            filters = [
                unaccent_ilike(Product.nome, q),
                unaccent_ilike(Product.codigo, q)
            ]
            if q_clean:
                filters.append(Product.ncm_codigo.ilike(f"%{q_clean}%"))
            query = query.filter(or_(*filters))
        
        if tipo:
            query = query.filter(Product.tipo == tipo)
            
        products = query.order_by(desc(Product.created_at)).offset(skip).limit(limit).all()
        for p in products:
            self._attach_benefits(p)
        return products

    def update_product(self, tenant_id: str, product_id: str, payload: ProductUpdate) -> Optional[Product]:
        product = self.get_product(tenant_id, product_id)
        if not product:
            return None
        
        update_data = payload.model_dump(exclude_unset=True, exclude={'suppliers'})
        for key, value in update_data.items():
            setattr(product, key, value)
            
        # Update suppliers list if provided
        if payload.suppliers is not None:
            # Explicitly delete old suppliers to avoid cascade/uniqueness issues
            self.db.query(ProductSupplier).filter(
                ProductSupplier.product_id == product.id
            ).delete(synchronize_session=False)
            self.db.flush()
            
            for sup_data in payload.suppliers:
                ps = ProductSupplier(
                    product_id=product.id,
                    supplier_id=sup_data.supplier_id,
                    codigo_externo=sup_data.codigo_externo,
                    unidade=sup_data.unidade,
                    fator_conversao=str(sup_data.fator_conversao)
                )
                self.db.add(ps)
            
        self.db.commit()
        self.db.refresh(product)
        return product

    def delete_product(self, tenant_id: str, product_id: str) -> bool:
        product = self.get_product(tenant_id, product_id)
        if not product:
            return False
        
        try:
            self.db.delete(product)
            self.db.commit()
            return True
        except IntegrityError:
            self.db.rollback()
            raise HTTPException(status_code=400, detail="produto vinculado a formaçoes de preço, não é possivel exclusão!")

    def get_product_mva(self, tenant_id: str, ncm: str, company_id: str, finalidade: str) -> Optional[dict]:
        """
        Busca o MVA baseado no NCM, UF da Empresa e Finalidade.
        Regra: Hierarquia de NCM (ex: 8517.62 -> 8517.6)
        """
        if finalidade != "REVENDA" or not ncm:
            return None
            
        # 1. Get company state
        company = self.db.query(Company).filter(Company.id == company_id).first()
        if not company or not company.state_id:
            return None
            
        # 2. Clean NCM for lookup
        ncm_clean = re.sub(r'[^0-9]', '', ncm)
        
        # 3. Search in NCM ST Item hierarchy
        # We search for rules in the same tenant and state
        # Ordered by length of ncm_normalizado descending to get the most specific match first
        match = self.db.query(NcmStItem).join(NcmStHeader).filter(
            NcmStHeader.tenant_id == tenant_id,
            NcmStHeader.state_id == company.state_id,
            NcmStHeader.is_active == True,
            NcmStItem.is_active == True,
            # Hierarchical match logic: rule NCM is a prefix of product NCM
            func.length(NcmStItem.ncm_normalizado) >= 4,
            # Using cast/string ops to ensure prefix match
            # This is equivalent to: ncm_clean starting with NcmStItem.ncm_normalizado
            literal_column(f"'{ncm_clean}'").like(NcmStItem.ncm_normalizado + '%')
        ).order_by(desc(func.length(NcmStItem.ncm_normalizado))).first()

        if match:
            return {
                "mva_percent": float(match.mva_percent) if match.mva_percent else 0,
                "ncm_match": match.ncm_normalizado,
                "fundamento": match.fundamento,
                "descricao": match.descricao
            }
            
        return None

    def _attach_benefits(self, product: Product):
        """Atacha benefícios fiscais ao objeto de produto (não persistido no DB)"""
        if not product.ncm_codigo:
            product.tax_benefits = []
            return
            
        ncm_service = NcmService(self.db)
        benefits = ncm_service.get_linked_benefits(product.ncm_codigo)
        # Filtramos por tenant
        product.tax_benefits = [b for b in benefits if str(b.tenant_id) == str(product.tenant_id)]

from sqlalchemy import literal_column
