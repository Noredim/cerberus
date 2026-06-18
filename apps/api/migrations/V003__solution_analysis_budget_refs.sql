ALTER TABLE solution_analysis_items ADD COLUMN IF NOT EXISTS budget_a_id UUID REFERENCES purchase_budgets(id) ON DELETE SET NULL;
ALTER TABLE solution_analysis_items ADD COLUMN IF NOT EXISTS budget_b_id UUID REFERENCES purchase_budgets(id) ON DELETE SET NULL;
ALTER TABLE solution_analysis_items ADD COLUMN IF NOT EXISTS budget_c_id UUID REFERENCES purchase_budgets(id) ON DELETE SET NULL;
