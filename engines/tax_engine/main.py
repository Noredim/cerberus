from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Cerberus Tax Engine")

@app.get("/health")
def health(): return {"status": "healthy", "service": "tax-engine"}


class TaxInput(BaseModel):
    operation_type: str
    municipality_id: str
    service_code: str
    value: float

class TaxOutput(BaseModel):
    iss: float
    rate: float
    withheld: bool

@app.post("/calculate", response_model=TaxOutput)
def calculate_tax(payload: TaxInput):
    # Lógica de cálculo estática simulada por enquanto
    rate = 0.05
    iss = payload.value * rate
    return TaxOutput(
        iss=iss,
        rate=rate,
        withheld=False
    )
