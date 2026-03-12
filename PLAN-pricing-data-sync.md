# PLAN: Pricing Data Synchronization

Ensure that the "Formação de Preço" tab is automatically populated with budget data without requiring a manual visit to the "Orçamentos" tab.

## Overview
Currently, `ProductForm.tsx` only triggers the `fetchBudgets` function when the `activeTab` is explicitly set to `'quotes'`. This causes the `'pricing'` tab to appear with zeroed values if it is visited first.

## Project Type
**WEB** (React/Vite)

## Success Criteria
- [ ] Navigating to "Formação de Preço" tab immediately displays data from the latest budget.
- [ ] No redundant API calls if data is already present.
- [ ] UI remains responsive during data fetch.

## Proposed Changes

### [ProductForm.tsx](file:///c:/cerberus/apps/web/src/modules/products/ProductForm.tsx)

#### Identify and Update fetchBudgets trigger
- Modify the `useEffect` that listens to `activeTab` to include `'pricing'` in its condition.
- Add a check to prevent re-fetching if `productBudgets` is already populated and the `id` hasn't changed.

## Task Breakdown

### Phase 1: Implementation
| Task ID | Name | Agent | Skills | Priority | Dependencies |
|---------|------|-------|--------|----------|--------------|
| T1 | Update Tab Trigger | `frontend-specialist` | `clean-code` | P0 | None |
| T2 | Clean up Canary UI | `frontend-specialist` | `frontend-design` | P1 | T1 |

**T1: Update Tab Trigger**
- **INPUT**: `ProductForm.tsx` lines 179-183.
- **OUTPUT**: Updated logic to fetch budgets for pricing tab.
- **VERIFY**: Open product details, click "Formação de Preço" as the first action, verify data is present.

**T2: Clean up Canary UI**
- **INPUT**: `ProductPriceFormation.tsx` (Canary strings).
- **OUTPUT**: Restore professional casing and labels if canary confirmed sync.
- **VERIFY**: UI labels match user expectations.

## Phase X: Verification
- [ ] Verify automatic fetch on tab switch.
- [ ] Verify totalizers recalculate correctly with new data.
- [ ] Final UI check for labels and contrast.
