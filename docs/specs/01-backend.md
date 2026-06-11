# SPEC 01 — BACKEND

## Objetivo

Definir os padrões técnicos do backend do Cerberus Sales Engine.

O backend é responsável por orquestrar regras de negócio, autenticação, multiempresa, cadastros, fiscal, oportunidades, simulações, dashboards e comunicação com as engines de cálculo.

---

## Stack

- Python 3.12+
- FastAPI
- SQLAlchemy
- Alembic
- PostgreSQL
- JWT
- Docker

---

## Arquitetura

O backend segue o modelo de monólito modular.

A API principal atua como orquestradora e deve delegar cálculos especializados para engines stateless externas.

Módulos principais:

- Auth / RBAC
- Tenants
- Users
- Catalog
- Fiscal
- Opportunities
- Simulations
- Dashboards

---

## Multiempresa

O sistema é SaaS multiempresa.

Todas as tabelas de domínio devem possuir `tenant_id`.

Toda requisição de domínio deve receber o header:

```http
X-Tenant-Id