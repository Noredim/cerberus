import traceback
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import HTTPException
from fastapi.staticfiles import StaticFiles
import os

from src.modules.auth.router import router as auth_router
from src.modules.tenants.router import router as tenants_router
from src.modules.fiscal.router import router as fiscal_router
from src.modules.dashboards.router import router as dashboards_router
from src.modules.catalog.router import router as catalog_router
from src.modules.users.router import router as users_router
from src.modules.cnpj_public.router import router as cnpj_public_router
from src.modules.companies.router import router as companies_router
from src.modules.tax_benefits.router import router as tax_benefits_router
from src.modules.utils.router import router as utils_router
from src.modules.domains.cnae.router import router as cnae_domains_router
from src.modules.ncm.router import router as ncm_router
from src.modules.ncm_st.router import router as ncm_st_router
from src.modules.suppliers.router import router as suppliers_router
from src.modules.products.router import router as products_router
from src.modules.customers.router import router as customers_router
from src.modules.purchase_budgets.router import router as purchase_budgets_router

ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
]

app = FastAPI(
    title="Cerberus - Sales Engine API",
    description="Backend Multi-Tenant Services",
    version="1.0.0",
)

# Servir arquivos estáticos (Uploads da Logo e afins)
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# CORS configuration — must be first middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------------------- #
# Custom exception handlers — ensure CORS headers are present on all errors.  #
# FastAPI's default 422 handler can bypass CORSMiddleware on some ASGI stacks  #
# --------------------------------------------------------------------------- #

FIELD_LABELS = {
    "cnpj": "CNPJ",
    "razao_social": "Razão Social",
    "municipality_id": "Município",
    "state_id": "Estado (UF)",
    "regime_tributario": "Regime Tributário",
    "vigencia_inicio": "Início da Vigência",
    "cnae_codigo": "Código CNAE",
}

def _human_message(error: dict) -> str:
    loc = error.get("loc", [])
    field = loc[-1] if loc else "campo"
    label = FIELD_LABELS.get(str(field), str(field))
    msg = error.get("msg", "valor inválido")
    return f"{label}: {msg}"


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    messages = [_human_message(e) for e in errors]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": errors,                    # raw for programmatic use
            "mensagens": messages,               # human-readable PT-BR list
            "erro": "Dados inválidos ou incompletos. Verifique os campos: " + ", ".join(messages),
        },
        headers={"Access-Control-Allow-Origin": request.headers.get("origin", "*")},
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={"Access-Control-Allow-Origin": request.headers.get("origin", "*")},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Catch-all: garante CORS headers em erros 500 não tratados."""
    traceback.print_exc()
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Erro interno do servidor.",
            "erro": str(exc),
        },
        headers={
            "Access-Control-Allow-Origin": request.headers.get("origin", "*"),
            "Access-Control-Allow-Credentials": "true",
        },
    )


@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "cerberus-api"}

# Authentication and Authorization
app.include_router(auth_router)

# Multi-Tenant Core Services
app.include_router(tenants_router)
app.include_router(fiscal_router)
app.include_router(dashboards_router)
app.include_router(catalog_router)
app.include_router(users_router)
app.include_router(cnpj_public_router)
app.include_router(companies_router)
app.include_router(tax_benefits_router)
app.include_router(utils_router)
app.include_router(cnae_domains_router)
app.include_router(ncm_router)
app.include_router(ncm_st_router)
app.include_router(suppliers_router)
app.include_router(products_router)
app.include_router(customers_router)
app.include_router(purchase_budgets_router)
