-- Migration: V001_cnpj_schemas
-- Creates the staging, public and control schemas for the CNPJ open data ETL.

CREATE SCHEMA IF NOT EXISTS cnpj_ctl;
CREATE SCHEMA IF NOT EXISTS cnpj_stage;
CREATE SCHEMA IF NOT EXISTS cnpj_public;

-- 1) CONTROL SCHEMA
CREATE TABLE IF NOT EXISTS cnpj_ctl.batch_runs (
    batch_id uuid PRIMARY KEY,
    started_at timestamp without time zone DEFAULT now(),
    finished_at timestamp without time zone,
    status varchar(50) NOT NULL, -- RUNNING, SUCCESS, FAILED
    source_name text NOT NULL,
    source_ref text,
    files_json jsonb,
    rows_stage_json jsonb,
    rows_public_json jsonb,
    error_message text,
    created_by uuid,
    created_at timestamp without time zone DEFAULT now()
);

-- 2) STAGE SCHEMA (RAW TEXT TABLES)
CREATE TABLE IF NOT EXISTS cnpj_stage.empresas_raw (
    cnpj_basico text,
    razao_social text,
    natureza_juridica_codigo text,
    qualificacao_responsavel text,
    capital_social text,
    porte_codigo text,
    ente_federativo text,
    batch_id uuid,
    loaded_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cnpj_stage.estabelecimentos_raw (
    cnpj_basico text,
    cnpj_ordem text,
    cnpj_dv text,
    identificador_matriz_filial text,
    nome_fantasia text,
    situacao_cadastral text,
    data_situacao text,
    motivo_situacao text,
    nome_cidade_exterior text,
    pais text,
    data_inicio_atividade text,
    cnae_principal text,
    cnae_secundarios text,
    tipo_logradouro text,
    logradouro text,
    numero text,
    complemento text,
    bairro text,
    cep text,
    uf text,
    municipio_ibge text,
    ddd1 text,
    telefone1 text,
    ddd2 text,
    telefone2 text,
    ddd_fax text,
    fax text,
    email text,
    situacao_especial text,
    data_situacao_especial text,
    batch_id uuid,
    loaded_at timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cnpj_stage.cnaes_raw (
    cnae_codigo text,
    descricao text,
    batch_id uuid,
    loaded_at timestamp without time zone DEFAULT now()
);

-- Indices for staging (Performance for UPSERT queries)
CREATE INDEX IF NOT EXISTS idx_stg_emp_batch_cnpj ON cnpj_stage.empresas_raw(batch_id, cnpj_basico);
CREATE INDEX IF NOT EXISTS idx_stg_est_batch_cnpj ON cnpj_stage.estabelecimentos_raw(batch_id, cnpj_basico, cnpj_ordem, cnpj_dv);
CREATE INDEX IF NOT EXISTS idx_stg_cnae_batch_cod ON cnpj_stage.cnaes_raw(batch_id, cnae_codigo);

-- 3) PUBLIC SCHEMA (NORMALIZED TABLES)

CREATE TABLE IF NOT EXISTS cnpj_public.empresas (
    cnpj_basico char(8) PRIMARY KEY,
    razao_social text,
    natureza_juridica_codigo char(4),
    porte_codigo char(2),
    capital_social numeric(18,2),
    ente_federativo text,
    last_batch_id uuid,
    updated_at timestamp without time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pub_emp_natjur ON cnpj_public.empresas(natureza_juridica_codigo);
CREATE INDEX IF NOT EXISTS idx_pub_emp_porte ON cnpj_public.empresas(porte_codigo);

CREATE TABLE IF NOT EXISTS cnpj_public.estabelecimentos (
    cnpj char(14) PRIMARY KEY,
    cnpj_basico char(8) NOT NULL REFERENCES cnpj_public.empresas(cnpj_basico) ON DELETE CASCADE,
    matriz_filial char(1),
    nome_fantasia text,
    situacao_cadastral char(2),
    data_situacao date,
    data_inicio_atividade date,
    cnae_principal char(7),
    uf char(2),
    municipio_ibge char(7),
    cep char(8),
    logradouro text,
    numero text,
    complemento text,
    bairro text,
    ddd1 char(2),
    telefone1 text,
    email text,
    last_batch_id uuid,
    updated_at timestamp without time zone DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pub_est_cnpjbasico ON cnpj_public.estabelecimentos(cnpj_basico);
CREATE INDEX IF NOT EXISTS idx_pub_est_uf_mun ON cnpj_public.estabelecimentos(uf, municipio_ibge);
CREATE INDEX IF NOT EXISTS idx_pub_est_cnae ON cnpj_public.estabelecimentos(cnae_principal);
CREATE INDEX IF NOT EXISTS idx_pub_est_situacao ON cnpj_public.estabelecimentos(situacao_cadastral);

CREATE TABLE IF NOT EXISTS cnpj_public.estabelecimento_cnae_secundario (
    cnpj char(14) REFERENCES cnpj_public.estabelecimentos(cnpj) ON DELETE CASCADE,
    cnae_codigo char(7),
    last_batch_id uuid,
    PRIMARY KEY (cnpj, cnae_codigo)
);
CREATE INDEX IF NOT EXISTS idx_pub_cnaesec_cnae ON cnpj_public.estabelecimento_cnae_secundario(cnae_codigo);
CREATE INDEX IF NOT EXISTS idx_pub_cnaesec_cnpj ON cnpj_public.estabelecimento_cnae_secundario(cnpj);

CREATE TABLE IF NOT EXISTS cnpj_public.cnaes (
    cnae_codigo char(7) PRIMARY KEY,
    descricao text,
    last_batch_id uuid,
    updated_at timestamp without time zone DEFAULT now()
);
