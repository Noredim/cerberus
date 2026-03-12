-- V002__companies_tax_profiles.sql
-- Migration: Criação do módulo de Empresas, Perfis Tributários e Benefícios Fiscais
-- Autor: AntiGravity (database-architect)

-- 1. Tabela de Domínio: Catálogo CNAE (Caso não exista)
CREATE TABLE IF NOT EXISTS public.cnae_catalog (
    cnae_codigo VARCHAR(20) PRIMARY KEY,
    descricao TEXT NOT NULL,
    versao VARCHAR(50) DEFAULT '2.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 2. Tabela Core: Cadastro de Empresas
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    cmt_id VARCHAR NOT NULL REFERENCES public.municipal_source_documents(id), -- Referência ao CMT que rege
    status VARCHAR(50) DEFAULT 'ATIVA', -- ATIVA, INATIVA, BLOQUEADA
    cnpj VARCHAR(14) NOT NULL,
    razao_social VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    natureza_juridica_codigo VARCHAR(10),
    natureza_juridica_descricao VARCHAR(255),
    data_abertura DATE,
    situacao_cadastral VARCHAR(100),
    porte VARCHAR(100),
    capital_social NUMERIC(15, 2),
    email VARCHAR(255),
    telefone VARCHAR(50),
    -- Endereço
    logradouro VARCHAR(255),
    numero VARCHAR(50),
    complemento VARCHAR(255),
    bairro VARCHAR(255),
    cep VARCHAR(20),
    municipality_id VARCHAR NOT NULL REFERENCES public.municipalities(id),
    state_id VARCHAR NOT NULL REFERENCES public.states(id),
    
    origem_dados_cnpj VARCHAR(50) DEFAULT 'INTEGRACAO', -- INTEGRACAO, MANUAL
    cnpj_snapshot_json JSONB, -- Fotografia da importação
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_tenant_cnpj ON public.companies (tenant_id, cnpj);

-- 3. Tabela Relacional: Empresa <-> CNAEs
CREATE TABLE IF NOT EXISTS public.company_cnaes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    cnae_codigo VARCHAR(20) NOT NULL, 
    tipo VARCHAR(20) NOT NULL, -- 'PRIMARIO', 'SECUNDARIO'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_company_cnaes_unique ON public.company_cnaes(company_id, cnae_codigo);
CREATE UNIQUE INDEX IF NOT EXISTS idx_company_cnaes_primary ON public.company_cnaes(company_id) WHERE tipo = 'PRIMARIO';

-- 4. Tabela de Domínio: Perfis Tributários com Vigência
CREATE TABLE IF NOT EXISTS public.company_tax_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE, -- Nullable para o perfil ativo atual
    regime_tributario VARCHAR(50) NOT NULL, -- SIMPLES_NACIONAL, LUCRO_PRESUMIDO, LUCRO_REAL, MEI, OUTRO
    contribuinte_icms BOOLEAN DEFAULT false,
    contribuinte_iss BOOLEAN DEFAULT true,
    inscricao_estadual VARCHAR(50),
    inscricao_municipal VARCHAR(50),
    regime_iss VARCHAR(50) DEFAULT 'FIXO', -- FIXO, VARIAVEL, ESTIMATIVA, NAO_APLICA, OUTRO
    regime_icms VARCHAR(50) DEFAULT 'NAO_APLICA', -- NORMAL, ST, NAO_APLICA, OUTRO
    observacoes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_profiles_active ON public.company_tax_profiles(company_id) WHERE vigencia_fim IS NULL;

-- 5. Tabela Core: Catálogo de Benefícios Fiscais (Regras JsonB)
CREATE TABLE IF NOT EXISTS public.tax_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id VARCHAR NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    esfera VARCHAR(50) NOT NULL, -- MUNICIPAL, ESTADUAL, FEDERAL
    tributo_alvo VARCHAR(50) NOT NULL, -- ISS, ICMS, IPI, PIS, COFINS, IRPJ, CSLL, OUTRO
    tipo_beneficio VARCHAR(100) NOT NULL, -- REDUCAO_ALIQUOTA, ISENCAO, DIFERIMENTO, CREDITO_PRESUMIDO, BASE_CALCULO_REDUZIDA, OUTRO
    regra_json JSONB NOT NULL, -- JsonSchema a ser validado pelo Backend (P0)
    requer_habilitacao BOOLEAN DEFAULT false,
    documento_base VARCHAR(255),
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- 6. Tabela Relacional: Empresa <-> Benefícios
CREATE TABLE IF NOT EXISTS public.company_benefits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    benefit_id UUID NOT NULL REFERENCES public.tax_benefits(id) ON DELETE CASCADE,
    vigencia_inicio DATE NOT NULL,
    vigencia_fim DATE,
    prioridade INTEGER DEFAULT 100,
    status VARCHAR(50) DEFAULT 'ATIVO', -- ATIVO, INATIVO
    observacao TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);
