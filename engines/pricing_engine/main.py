from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Cerberus Pricing Engine")

@app.get("/health")
def health(): return {"status": "healthy", "service": "pricing-engine"}


class PricingInput(BaseModel):
    real_cost: float
    desired_margin: float

class PricingOutput(BaseModel):
    final_price: float
    margin: float

@app.post("/calculate", response_model=PricingOutput)
def calculate_pricing(payload: PricingInput):
    # Cálculo simplificado
    final_price = payload.real_cost / (1 - payload.desired_margin)
    return PricingOutput(final_price=final_price, margin=payload.desired_margin)
