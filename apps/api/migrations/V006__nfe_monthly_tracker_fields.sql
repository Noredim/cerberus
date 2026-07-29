-- Migration V006: Adiciona natOp e issuer_ie à tabela fiscal_documents para Acompanhamento Mensal de NF-e e faz backfill dos registros antigos

ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS "natOp" VARCHAR(200);
ALTER TABLE fiscal_documents ADD COLUMN IF NOT EXISTS issuer_ie VARCHAR(20);

-- Backfill de issuer_ie a partir do xml_raw para notas importadas previamente
UPDATE fiscal_documents
SET issuer_ie = COALESCE(
  (SELECT (xpath('//nfe:emit/nfe:IE/text()', xmlparse(document xml_raw), ARRAY[ARRAY['nfe', 'http://www.portalfiscal.inf.br/nfe']]))[1]::text),
  (SELECT (xpath('//emit/IE/text()', xmlparse(document xml_raw)))[1]::text)
)
WHERE (issuer_ie IS NULL OR issuer_ie = '') AND xml_raw IS NOT NULL AND xml_raw LIKE '%<IE>%';

-- Backfill de natOp a partir do xml_raw para notas importadas previamente
UPDATE fiscal_documents
SET "natOp" = COALESCE(
  (SELECT (xpath('//nfe:ide/nfe:natOp/text()', xmlparse(document xml_raw), ARRAY[ARRAY['nfe', 'http://www.portalfiscal.inf.br/nfe']]))[1]::text),
  (SELECT (xpath('//ide/natOp/text()', xmlparse(document xml_raw)))[1]::text)
)
WHERE ("natOp" IS NULL OR "natOp" = '') AND xml_raw IS NOT NULL AND xml_raw LIKE '%<natOp>%';
