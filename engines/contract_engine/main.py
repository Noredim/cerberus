from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Cerberus Contract Engine")

@app.get("/health")
def health(): return {"status": "healthy", "service": "contract-engine"}


class ContractInput(BaseModel):
    operation_type: str # locacao, comodato, venda
    term_months: int
    product_cost: float
    desired_roi: float

class ContractOutput(BaseModel):
    monthly_price: float
    payback_months: float
    roi: float

@app.post("/calculate", response_model=ContractOutput)
def calculate_contract(payload: ContractInput):
    # Cálculo simplificado para locação/comodato (exemplo)
    # Se for comodato ou locação, mensalidade visa cobrir o custo no prazo + roi
    total_expected = payload.product_cost * (1 + payload.desired_roi)
    monthly_price = total_expected / payload.term_months if payload.term_months > 0 else total_expected
    payback_months = payload.product_cost / monthly_price if monthly_price > 0 else 0
    
    return ContractOutput(
        monthly_price=monthly_price,
        payback_months=payback_months,
        roi=payload.desired_roi
    )
