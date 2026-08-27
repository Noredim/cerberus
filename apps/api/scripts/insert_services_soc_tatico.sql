-- =============================================================================
-- SCRIPT DE INSERÇÃO / ATUALIZAÇÃO DE SERVIÇOS PRÓPRIOS
-- 
-- Serviços a serem cadastrados:
-- 1. SERVIÇO DE MONITORAMENTO SOC - Custo Mensal: R$ 119,25
-- 2. SERVIÇO DE TÁTICO DE MONITORAMENTO - Custo Mensal: R$ 149,10
--
-- Vigência: 2026
-- =============================================================================

DO $$
DECLARE
    v_tenant_id VARCHAR;
    v_company_id UUID;
    v_role_id VARCHAR;
    v_svc_soc_id UUID;
    v_svc_tatico_id UUID;
BEGIN
    -- 1. Identificar Tenant principal
    SELECT id INTO v_tenant_id FROM tenants ORDER BY created_at ASC LIMIT 1;
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum tenant encontrado no banco de dados.';
    END IF;

    -- 2. Identificar Company principal
    SELECT id INTO v_company_id FROM companies WHERE tenant_id = v_tenant_id LIMIT 1;
    IF v_company_id IS NULL THEN
        SELECT id INTO v_company_id FROM companies LIMIT 1;
    END IF;
    IF v_company_id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma empresa (company) encontrada no banco de dados.';
    END IF;

    -- 3. Identificar Cargo 'TÉCNICO DE VIDEOMONITORAMENTO'
    SELECT id INTO v_role_id FROM roles WHERE name ILIKE '%TÉCNICO DE VIDEOMONITORAMENTO%' LIMIT 1;
    IF v_role_id IS NULL THEN
        SELECT id INTO v_role_id FROM roles WHERE name ILIKE '%TÉCNICO%' LIMIT 1;
    END IF;

    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum cargo técnico encontrado para compor o serviço.';
    END IF;

    -- -------------------------------------------------------------------------
    -- 1. SERVIÇO DE MONITORAMENTO SOC (Custo Mensal: R$ 119,25)
    -- -------------------------------------------------------------------------
    SELECT id INTO v_svc_soc_id 
    FROM own_services 
    WHERE tenant_id = v_tenant_id 
      AND company_id = v_company_id 
      AND nome_servico = 'SERVIÇO DE MONITORAMENTO SOC' 
      AND vigencia = 2026;

    IF v_svc_soc_id IS NULL THEN
        v_svc_soc_id := gen_random_uuid();
        INSERT INTO own_services (
            id, tenant_id, company_id, nome_servico, unidade, vigencia, 
            descricao, tempo_total_minutos, ativo, created_at, updated_at
        ) VALUES (
            v_svc_soc_id, v_tenant_id, v_company_id, 'SERVIÇO DE MONITORAMENTO SOC', 'UN', 2026,
            'Serviço de Monitoramento SOC com custo mensal de R$ 119,25', 252, true, NOW(), NOW()
        );
    ELSE
        UPDATE own_services 
        SET tempo_total_minutos = 252, ativo = true, updated_at = NOW()
        WHERE id = v_svc_soc_id;
    END IF;

    -- Composição de Cargos (Fator: 4.1989h -> 4.1989 * R$ 28,40/h = R$ 119,25)
    INSERT INTO own_service_items (
        id, own_service_id, role_id, fator, tempo_minutos, tempo_total_minutos, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_svc_soc_id, v_role_id, 4.1989, 252, 252, NOW(), NOW()
    )
    ON CONFLICT (own_service_id, role_id) DO UPDATE 
    SET fator = 4.1989, tempo_minutos = 252, tempo_total_minutos = 252, updated_at = NOW();

    -- -------------------------------------------------------------------------
    -- 2. SERVIÇO DE TÁTICO DE MONITORAMENTO (Custo Mensal: R$ 149,10)
    -- -------------------------------------------------------------------------
    SELECT id INTO v_svc_tatico_id 
    FROM own_services 
    WHERE tenant_id = v_tenant_id 
      AND company_id = v_company_id 
      AND nome_servico = 'SERVIÇO DE TÁTICO DE MONITORAMENTO' 
      AND vigencia = 2026;

    IF v_svc_tatico_id IS NULL THEN
        v_svc_tatico_id := gen_random_uuid();
        INSERT INTO own_services (
            id, tenant_id, company_id, nome_servico, unidade, vigencia, 
            descricao, tempo_total_minutos, ativo, created_at, updated_at
        ) VALUES (
            v_svc_tatico_id, v_tenant_id, v_company_id, 'SERVIÇO DE TÁTICO DE MONITORAMENTO', 'UN', 2026,
            'Serviço de Tático de Monitoramento com custo mensal de R$ 149,10', 315, true, NOW(), NOW()
        );
    ELSE
        UPDATE own_services 
        SET tempo_total_minutos = 315, ativo = true, updated_at = NOW()
        WHERE id = v_svc_tatico_id;
    END IF;

    -- Composição de Cargos (Fator: 5.2500h -> 5.25 * R$ 28,40/h = R$ 149,10)
    INSERT INTO own_service_items (
        id, own_service_id, role_id, fator, tempo_minutos, tempo_total_minutos, created_at, updated_at
    ) VALUES (
        gen_random_uuid(), v_svc_tatico_id, v_role_id, 5.2500, 315, 315, NOW(), NOW()
    )
    ON CONFLICT (own_service_id, role_id) DO UPDATE 
    SET fator = 5.2500, tempo_minutos = 315, tempo_total_minutos = 315, updated_at = NOW();

    RAISE NOTICE 'Inserção concluída com sucesso. SOC ID: %, Tático ID: %', v_svc_soc_id, v_svc_tatico_id;
END $$;
