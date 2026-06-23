CREATE TABLE IF NOT EXISTS tipi_importacao (
    id UUID PRIMARY KEY,
    arquivo_nome VARCHAR(255) NOT NULL,
    vigencia DATE NOT NULL,
    total_linhas INTEGER NOT NULL DEFAULT 0,
    total_importados INTEGER NOT NULL DEFAULT 0,
    total_ignorados INTEGER NOT NULL DEFAULT 0,
    total_erros INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ncm_tipi (
    id UUID PRIMARY KEY,
    ncm_id UUID REFERENCES ncm(id) ON DELETE CASCADE,
    importacao_id UUID REFERENCES tipi_importacao(id) ON DELETE CASCADE,
    aliquota NUMERIC(10, 4) NOT NULL,
    vigencia DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ncm_tipi_ncm_id ON ncm_tipi(ncm_id);
CREATE INDEX IF NOT EXISTS idx_ncm_tipi_importacao_id ON ncm_tipi(importacao_id);
CREATE INDEX IF NOT EXISTS idx_ncm_tipi_vigencia ON ncm_tipi(vigencia);
