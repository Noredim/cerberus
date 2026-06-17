-- ====================================================================
-- CERBERUS - ROTINA DE CORREÇÃO DE PRODUTOS COM NCM 00000000
-- ====================================================================
-- Objetivo: Corrigir todos os produtos cadastrados com NCM '00000000'
--           (com ou sem formatação, ex: '0000.00.00') para que seu
--           campo 'tipo' seja alterado de 'EQUIPAMENTO' (ou 'PRODUTO')
--           para 'LICENCA'.
--
-- Rastreabilidade: Preservação de auditoria e memória de cálculo.
-- ====================================================================

-- 1. Iniciar transação interativa para segurança em produção
BEGIN;

-- 2. Auditando os produtos antes da alteração (Visualizar registros afetados)
SELECT 
    id, 
    tenant_id, 
    company_id, 
    codigo, 
    nome, 
    tipo AS tipo_atual, 
    ncm_codigo,
    created_at
FROM 
    products
WHERE 
    regexp_replace(ncm_codigo, '[^0-9]', '', 'g') = '00000000'
    AND tipo != 'LICENCA';

-- 3. Executando o Update dos produtos elegíveis
UPDATE 
    products
SET 
    tipo = 'LICENCA',
    updated_at = NOW()
WHERE 
    regexp_replace(ncm_codigo, '[^0-9]', '', 'g') = '00000000'
    AND tipo != 'LICENCA';

-- 4. Auditando os produtos pós-alteração para validar o tipo corrigido
SELECT 
    id, 
    tenant_id, 
    company_id, 
    codigo, 
    nome, 
    tipo AS novo_tipo, 
    ncm_codigo,
    updated_at
FROM 
    products
WHERE 
    regexp_replace(ncm_codigo, '[^0-9]', '', 'g') = '00000000';

-- ====================================================================
-- DECISÃO DO ADMINISTRADOR
-- ====================================================================
-- Verifique a contagem de registros afetados e os detalhes impressos.
--
-- Se tudo estiver correto, execute a instrução abaixo:
-- COMMIT;
--
-- Se houver qualquer inconsistência ou divergência, execute:
-- ROLLBACK;
-- ====================================================================
