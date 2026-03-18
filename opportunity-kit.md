# Opportunity Kit Implementation Plan

## Project Type
WEB / BACKEND (Fullstack Feature)

## Overview
The user requested the implementation of a "Kit de Oportunidade" (Opportunity Kit) feature. This kit groups products together for automated rental calculation. Unlike standard products, the kit does not calculate its own taxes or fiscal costs; it consumes the final consolidated cost of its constituent products. The kit calculates a monthly rental value based on contract terms, financial parameters (interest rate, maintenance), operational costs, and taxes on revenue.

Since the system currently uses `sales_budgets` for what is conceptually an "Opportunity", this kit feature will either be integrated into the existing `sales_budgets` module (e.g., `sales_budget_kits`) or created as a standalone `opportunity_kits` module. Based on Cerberus naming conventions, we will map `FpvOportunidadeKit` to a new table `sales_budget_kits` (or `opportunity_kits` if the user prefers a separate domain), and `FpvOportunidadeKitItem` to `sales_budget_kit_items`.

## Success Criteria
- [ ] Backend models `OpportunityKit` and `OpportunityKitItem` created.
- [ ] Database migration generated and applied.
- [ ] Business logic service implements the exact mathematical formulas provided:
  - Custo Base Unitario Item = Product's final cost
  - Custo Aquisicao Kit = Sum of Items
  - Custo Total Mensal Kit = Depreciacao (Custo Aquisicao / Prazo Contrato) + Custos Operacionais
  - Taxa de Locação = `juros / (1 - (1+juros)^(-prazo_mensalidades))`
  - Valor Parcela = Base Venda * txLocacao
  - Receita Liquida = Valor Mensal - Impostos
- [ ] API Endpoints (CRUD + Recalculate) implemented.
- [ ] Frontend screen created with Master-Detail pattern (Kit Header + Items Grid).
- [ ] Real-time automatic recalculation on the frontend when fields change.
- [ ] Adheres to Frontend UI guidelines (No generic "SaaS safe harbors", proper spacing).

## Tech Stack
- **Backend:** FastAPI, SQLAlchemy, Alembic, PostgreSQL.
- **Frontend:** React, Vite, Tailwind CSS, custom UI components.

## File Structure
```text
apps/api/src/modules/opportunity_kits/
├── models.py         # OpportunityKit, OpportunityKitItem
├── schemas.py        # Pydantic schemas for IO
├── service.py        # Business logic & math formulas
├── router.py         # FastAPI endpoints
apps/web/src/modules/opportunity_kits/
├── pages/
│   ├── OpportunityKitList.tsx
│   ├── OpportunityKitForm.tsx
├── components/
│   ├── KitItemsGrid.tsx
│   ├── KitFinancialSummary.tsx
```

## Task Breakdown

### Task 1: Backend Database Models & Migrations
- **Agent:** `@backend-specialist` 
- **Skill:** `database-design`
- **Priority:** P0
- **Input:** The fields defined in the prompt (nomeKit, prazoContrato, fatorMargemLocacao, etc).
- **Output:** SQLAlchemy models & Alembic migration script.
- **Verify:** Run Alembic upgrade head successfully.

### Task 2: Backend Calculation Engine & API
- **Agent:** `@backend-specialist`
- **Skill:** `api-patterns`
- **Priority:** P1
- **Dependencies:** Task 1
- **Input:** Business formulas from the prompt (Steps 8 to 17).
- **Output:** Pydantic schemas, `KitService` with `recalcular_kit` method, and CRUD router.
- **Verify:** Pytest or manual API call via Swagger returning correct financial math.

### Task 3: Frontend Feature Scaffolding & Routing
- **Agent:** `@frontend-specialist`
- **Skill:** `frontend-design`
- **Priority:** P2
- **Dependencies:** Task 2
- **Input:** Backend API ready.
- **Output:** React routes setup, `OpportunityKitList` page, `OpportunityKitForm` shell.
- **Verify:** Can navigate to `/kits` and see an empty list/creation button.

### Task 4: Frontend Kit Form & Financial Summary
- **Agent:** `@frontend-specialist`
- **Skill:** `react-best-practices`
- **Priority:** P2
- **Dependencies:** Task 3
- **Input:** The "Dados Gerais", "Prazos", "Parâmetros Financeiros" and "Custos Operacionais" fields.
- **Output:** A radical, modern form layout abandoning "safe" 50/50 splits, focusing on strong typographic hierarchy for the financial readouts (Valor Mensal, Lucro Mensal, Margem).
- **Verify:** Form validates safely, handles recalculation hooks when inputs blur.

### Task 5: Frontend Kit Items Grid (Lupa do Produto)
- **Agent:** `@frontend-specialist`
- **Skill:** `react-best-practices`
- **Priority:** P2
- **Dependencies:** Task 4
- **Input:** Requirement 6 & 7 (Select product via Lupa, consume final cost).
- **Output:** Interactive grid allowing addition of `OpportunityKitItem` using the `ProductSearchModal`.
- **Verify:** Selecting a product populates the item's cost; total kit cost updates automatically.

## Phase X: Verification
- [ ] Run backend tests / manual API verification for financial math.
- [ ] Run `python .agent/scripts/checklist.py .` to verify Code Quality (Lint/TypeCheck/Security).
- [ ] Run `npm run build` cleanly.
- [ ] Verify UI compliance against `web-design-guidelines.md` (No purple, no template clichés).
