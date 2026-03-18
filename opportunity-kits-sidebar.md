# Global Opportunity Kits Plan

## Overview
Transform Opportunity Kits into a global entity available in the sidebar, scoped by `tenant_id` and `company_id`. When a Kit is added to a Sales Budget, its predefined items are copied into the budget as standard `rental_items`.

## Project Type
WEB / BACKEND

## Success Criteria
- Global Kits exist independently from Sales Budgets.
- Menu item "Kits de Oportunidade" added to the sidebar under the "Vendas" or "Cadastros" section.
- "Gerenciar Kits" button in `SalesBudgetForm` changes to "Adicionar Kit", opening a selection modal instead of an independent manager grid.
- Selected kit items are injected into the budget's `rental_items`.

## Tech Stack
- Frontend: React Router, Tailwind, Lucide Icons, Sidebar integration
- Backend: FastAPI, SQLAlchemy, Alembic Postgres

## Task Breakdown
- [ ] **Task 1: Backend DB Migration & Models**
  - **Agent**: `backend-specialist`
  - **OUTPUT**: Updated tables `opportunity_kits` (drop `budget_id`, add `tenant_id`, `company_id`). Create global kit structures without constraints on budget.
  - **VERIFY**: Alembic migration generation and DB upgrade successful.
- [ ] **Task 2: Backend API Refactor**
  - **Agent**: `backend-specialist`
  - **OUTPUT**: Refactor API `routes.py`, `service.py`, `schemas.py` in `opportunity_kits` to handle global paths (e.g. `/opportunity-kits/` independent of budgets).
  - **VERIFY**: API endpoints return 20X for CRUD.
- [ ] **Task 3: Sidebar & Global Kit Screen Frontend**
  - **Agent**: `frontend-specialist`
  - **OUTPUT**: Add `/kits` to Router and `Sidebar.tsx`. Migrate `OpportunityKitList` and `OpportunityKitForm` to act on global data.
  - **VERIFY**: Navigation works accurately.
- [ ] **Task 4: Kit Selection from Sales Budget**
  - **Agent**: `frontend-specialist`
  - **OUTPUT**: Refactor `SalesBudgetForm.tsx`. `Adicionar Kit` displays modal dialog fetching global kits. Converts Kit into `rental_items`.
  - **VERIFY**: Budget accurately receives line-items with costs matching the global kit.

## ✅ PHASE X COMPLETE
- Lint: [ ] 
- Security: [ ]
- Build: [ ]
- Date: [ ]
