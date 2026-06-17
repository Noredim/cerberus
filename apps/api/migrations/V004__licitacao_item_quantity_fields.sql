-- Migration V004: Add tipo_fornecimento, total_meses, and quantidade_total to licitacao_items
ALTER TABLE licitacao_items ADD COLUMN IF NOT EXISTS tipo_fornecimento VARCHAR(50) NOT NULL DEFAULT 'Unitário';
ALTER TABLE licitacao_items ADD COLUMN IF NOT EXISTS total_meses INTEGER NULL;
ALTER TABLE licitacao_items ADD COLUMN IF NOT EXISTS quantidade_total NUMERIC(15, 4) NOT NULL DEFAULT 1.0;

-- Backfill legacy records to match business rules
UPDATE licitacao_items
SET tipo_fornecimento = 'Unitário',
    quantidade_total = quantidade,
    total_meses = NULL
WHERE tipo_fornecimento = 'Unitário' OR tipo_fornecimento IS NULL;
