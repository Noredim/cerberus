Arquitetura Técnica Completa

Versão: 2.0
Status: Build Ready

1. STACK TECNOLÓGICA
Backend

Python 3.12+

FastAPI

SQLAlchemy

Alembic (migrations)

Banco de dados

PostgreSQL

Engines de cálculo (serviços isolados)

tax-engine

cost-engine

pricing-engine

contract-engine

Frontend

React + Vite
Tailwind CSS v4
CoreUI Bright Theme (Glassmorphism removido)
UX: Scroll nativo em nível de página no container principal para fluidez máxima.
Framer Motion (Micro-interações)
Lucide React

Infraestrutura local

Docker

Docker Compose

WSL

2. ARQUITETURA GERAL
Modelo

Monólito modular (API) + Engines externas stateless.

API (orquestrador)
 ├── Auth / RBAC
 ├── Tenants
 ├── Catálogo
 ├── Fiscal
 ├── Oportunidades
 ├── Simulações
 └── Dashboards

Engines
 ├── tax-engine
 ├── cost-engine
 ├── pricing-engine
 └── contract-engine
3. MULTIEMPRESA (MULTI-TENANT)
Estratégia

Isolamento lógico por:

tenant_id

Presente em todas as tabelas de domínio.

Resolução do tenant

Via header obrigatório:

X-Tenant-Id

Validação:

usuário pertence ao tenant

usuário possui permissão

4. AUTENTICAÇÃO E SEGURANÇA
Autenticação

JWT

login interno

Tabelas
users

id

tenant_id

name

email

password_hash

is_active

roles

ADMIN

ENGENHARIA_PRECO

DIRETORIA

user_roles

user_id

role_id

5. ESTRUTURA DO REPOSITÓRIO
cerberus/

apps/
 └── api/
     └── src/
         ├── core/
         ├── modules/
         │    ├── auth
         │    ├── tenants
         │    ├── users
         │    ├── catalog
         │    ├── fiscal
         │    ├── opportunities
         │    ├── simulations
         │    └── dashboards

engines/
 ├── tax_engine
 ├── cost_engine
 ├── pricing_engine
 └── contract_engine

docker-compose.yml
6. MODELO DE DADOS
6.1 TENANTS
tenants

id

cnpj

razao_social

nome_fantasia

municipality_id

created_at

tenant_cnaes

id

tenant_id

cnae

descricao

is_primary

Constraint:

1 CNAE primário por tenant.

6.2 MUNICÍPIOS
municipalities

id

ibge_code

name

uf

6.6 CATÁLOGO
products
services
suppliers
kits

Todos com:

tenant_id

6.7 NCM / ST / BIT
ncm_rules

ncm

cest

mva

st_flag

benefit_flag

uf

6.8 PERFIL TRIBUTÁRIO
tax_profiles

tenant_id

regime

icms

pis

cofins

iss_default

comissao_default

despesa_admin_default

6.9 OPORTUNIDADES
opportunities

id

tenant_id

name

customer

type

status

opportunity_items

id

opportunity_id

item_type

product_id / service_id

quantity

operation_type

6.10 SIMULAÇÕES
simulations_cost (FPC)
simulations_pricing (FPV)
6.11 CONTRATOS
contracts

type (venda / locação / comodato)

term_months

roi

payback

monthly_price



Fluxo:

item é serviço

identificar município

buscar regra vigente

enviar para tax-engine

9. CONTRATO DAS ENGINES
tax-engine
input
{
  "operation_type": "service",
  "municipality_id": "",
  "service_code": "",
  "value": 0
}
output
{
  "iss": 0,
  "rate": 0.05,
  "withheld": false
}
cost-engine

Retorna custo real.

pricing-engine

Retorna:

preço

margem

contract-engine

Retorna:

mensalidade

payback

ROI

10. ENDPOINTS PRINCIPAIS
AUTH

POST /auth/login

GET /auth/me

TENANTS

POST /tenants/cnpj-lookup

CRUD /tenants

USERS

POST /users
PUT /users/{id}
DELETE /users/{id}

CATALOG (CRUD)

DELETE /catalog/states/{id}
DELETE /catalog/cities/{id}


FISCAL / BENEFÍCIOS

CRUD /fiscal/ncm
GET /tax-benefits (Lista)
GET /tax-benefits/{id} (Detalhe)
POST /tax-benefits (Criação)
PUT /tax-benefits/{id} (Atualização)

OPORTUNIDADES

CRUD /opportunities

POST /opportunities/{id}/calc/fpc

POST /opportunities/{id}/calc/fpv

DASHBOARDS

GET /dashboards/kpis

11. DOCKER – SERVIÇOS

api

postgres

tax-engine

cost-engine

pricing-engine

contract-engine

12. OBSERVABILIDADE

Logs:

cálculos

alterações fiscais