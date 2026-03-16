# Budget Reconciliation Fixes

## Overview
The user reported four distinct issues related to the budget creation, product reconciliation, and quick product creation flows. This plan addresses these bugs using the `debugger` and `frontend-specialist`/`backend-specialist` agents.

## Project Type
WEB and BACKEND

## Success Criteria
1. DIFAL Scenario toggle only appears for REVENDA budgets.
2. Quick Product Create Modal includes Brand (MARCA), Model (MODELO), Manufacturer (FABRICANTE), and Part Number (PARTNUMBER).
3. Linking a newly created product via the modal succeeds (no 404 error).
4. Manual link button correctly binds the product to the import item and updates the UI.

## Tech Stack
- Frontend: React / Vite / Tailwind (apps/web)
- Backend: FastAPI / SQLAlchemy (apps/api)

## File Structure
- `apps/web/src/modules/purchase_budgets/...`
- `apps/web/src/components/modals/QuickProductCreateModal.tsx`
- `apps/api/src/modules/purchase_budgets/router.py`
- `apps/api/src/modules/purchase_budgets/services.py`

## Task Breakdown

### Task 1: Fix DIFAL Conditional Display
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Description**: Hide or disable the "Criar Cenário DIFAL" toggle when "Tipo de Orçamento" is not REVENDA.
- **INPUT**: `BudgetForm.tsx` (or where the toggle is rendered)
- **OUTPUT**: Updated form logic
- **VERIFY**: Check condition based on `watch("tipoOrcamento")` === 'REVENDA'.

### Task 2: Add Missing Fields to Quick Product Create Modal
- **Agent**: `frontend-specialist`
- **Skill**: `frontend-design`
- **Description**: Add `marca`, `modelo`, `fabricante`, and `part_number` fields to the `QuickProductCreateModal.tsx` form.
- **INPUT**: `QuickProductCreateModal.tsx`
- **OUTPUT**: Updated form with 4 new fields and schemas.
- **VERIFY**: Check that submitting the form sends these new fields to the API.

### Task 3: Fix 404 Error on Product Link (Backend API mapping)
- **Agent**: `debugger` / `backend-specialist`
- **Skill**: `systematic-debugging`
- **Description**: The frontend requests `POST /purchase-budgets/import/link-product/{itemId}` but gets a 404. Find where the route should be defined and define it or correct the URL.
- **INPUT**: `apps/api/src/modules/purchase_budgets/router.py`
- **OUTPUT**: Working API endpoint for link-product.
- **VERIFY**: Ensure the route is registered and successfully processes the body.

### Task 4: Fix Manual Linking Button
- **Agent**: `debugger` / `frontend-specialist`
- **Skill**: `systematic-debugging`
- **Description**: Attempting to link via "Vincular Produto" button does nothing and shows an error. Investigate the onClick handler and API call in the frontend.
- **INPUT**: `BudgetReconciliationModal.tsx`
- **OUTPUT**: Fixed event handler.
- **VERIFY**: User clicks the button, item is linked.

## Phase X: Verification
- [ ] Front-end components updated and clear of TypeScript/Lint errors.
- [ ] Backend route `/import/link-product/{itemId}` created or renamed correctly.
- [ ] API successfully handles linking scenarios.
