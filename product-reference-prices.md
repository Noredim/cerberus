# Product Reference Prices Plan (UI/UX Pro Max + Orchestrator)

## 1. Overview
Implement automatic reference price tracking per product based on Purchase Budgets. The product will maintain `vlrReferenciaRevenda` and `vlrReferenciaUsoConsumo` independently.

## 2. Project Type
**WEB + BACKEND**

## 3. Success Criteria
- Product model has tracking columns for both Revenda and Uso/Consumo.
- Creating a `REVENDA` budget updates both fields (Uso/Consumo derived via DIFAL).
- Creating a `USO_CONSUMO` budget updates ONLY the Uso/Consumo field.
- Product grid shows both columns securely.
- Product details form displays read-only reference data and origin clearly.

## 4. Tech Stack
- FastAPI, SQLAlchemy, Alembic (Backend)
- Next.js / React Web, Tailwind CSS, Lucide React (Frontend)

## 5. File Structure
- `apps/api/src/modules/products/models.py`
- `apps/api/src/modules/products/schemas.py`
- `apps/api/src/modules/purchase_budgets/service.py`
- `apps/web/src/modules/products/components/ProductList.tsx`
- `apps/web/src/modules/products/components/ProductForm.tsx`

## 6. Task Breakdown

### Task 1: Database Migration
- **Agent:** backend-specialist
- **Action:** Add 7 columns to `Product` model. Run `alembic revision --autogenerate`.
- **OUTPUT:** Migration file and updated `models.py`.
- **VERIFY:** DB migrates without errors.

### Task 2: Schema Updates
- **Agent:** backend-specialist
- **Action:** Add fields to `ProductResponse` schema.
- **OUTPUT:** Updated `schemas.py`.
- **VERIFY:** Swagger UI shows new fields on Product GET endpoints.

### Task 3: Trigger Logic in Budgets
- **Agent:** backend-specialist
- **Action:** Implement `update_product_reference_prices` in `PurchaseBudgetService`. Call on `create_budget` and `add_negotiation`. Connect DIFAL logic.
- **OUTPUT:** Automated update logic.
- **VERIFY:** Saving a budget updates specific fields on the linked products in the DB.

### Task 4: UI Product Grid
- **Agent:** frontend-specialist
- **Action:** Add "VLR Revenda" and "VLR Uso/Consumo" columns to `ProductList.tsx`.
- **OUTPUT:** Grid renders new columns natively.
- **VERIFY:** Empty fields handled safely as "0,00".

### Task 5: UI Product Detail View
- **Agent:** frontend-specialist
- **Action:** Enhance `ProductForm.tsx` to display historical read-only values for tracking references.
- **OUTPUT:** Beautiful, UI/UX compliant grid section for Reference Tracking.
- **VERIFY:** Displays correct dates, origin flags, and budget IDs.

## 7. Phase X: Verification
- [ ] Lint & Type Check
- [ ] `checklist.py` validation
- [ ] Build Success
- [ ] Verified manual scenarios (Revenda overrides vs Uso/Consumo isolations)
