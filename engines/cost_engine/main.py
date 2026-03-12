from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Cerberus Cost Engine")

@app.get("/health")
def health(): return {"status": "healthy", "service": "cost-engine"}


class CostInput(BaseModel):
    product_cost: float
    taxes: float
    shipping: float

class CostOutput(BaseModel):
    real_cost: float

@app.post("/calculate", response_model=CostOutput)
def calculate_cost(payload: CostInput):
    real_cost = payload.product_cost + payload.taxes + payload.shipping
    return CostOutput(real_cost=real_cost)
