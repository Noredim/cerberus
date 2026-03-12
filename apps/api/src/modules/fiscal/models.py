from sqlalchemy import Column, String, Numeric, Boolean
from src.core.base import Base

class NcmRule(Base):
    __tablename__ = "ncm_rules"

    ncm = Column(String, primary_key=True)
    cest = Column(String)
    mva = Column(Numeric(5, 4))
    st_flag = Column(Boolean, default=False)
    benefit_flag = Column(Boolean, default=False)
    uf = Column(String, nullable=False)
