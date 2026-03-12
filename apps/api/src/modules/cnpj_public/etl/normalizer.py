# src/modules/cnpj_public/etl/normalizer.py
import logging

logger = logging.getLogger(__name__)

def parse_cnpj(basico, ordem, dv):
    if not basico or not ordem or not dv:
        return None
    return f"{basico}{ordem}{dv}".rjust(14, '0')

def upsert_to_public(engine, batch_id: str):
    """
    Executes raw SQL to perform INSERT ... ON CONFLICT (UPSERT)
    moving data from cnpj_stage to cnpj_public, applying necessary normalization.
    """
    raw_conn = engine.raw_connection()
    try:
        cursor = raw_conn.cursor()

        # 1. UPSERT CNAES
        logger.info("Upserting cnaes...")
        cursor.execute("""
            INSERT INTO cnpj_public.cnaes (cnae_codigo, descricao, last_batch_id, updated_at)
            SELECT
                cnae_codigo,
                descricao,
                %s,
                now()
            FROM cnpj_stage.cnaes_raw
            WHERE batch_id = %s
            ON CONFLICT (cnae_codigo) DO UPDATE SET
                descricao = EXCLUDED.descricao,
                last_batch_id = EXCLUDED.last_batch_id,
                updated_at = EXCLUDED.updated_at;
        """, (batch_id, batch_id))


        # 2. UPSERT EMPRESAS
        logger.info("Upserting empresas...")
        cursor.execute("""
            INSERT INTO cnpj_public.empresas (
                cnpj_basico, razao_social, natureza_juridica_codigo, 
                porte_codigo, capital_social, ente_federativo, last_batch_id, updated_at
            )
            SELECT
                LPAD(cnpj_basico, 8, '0'),
                razao_social,
                NULLIF(TRIM(natureza_juridica_codigo), ''),
                NULLIF(TRIM(porte_codigo), ''),
                CAST(REPLACE(capital_social, ',', '.') AS NUMERIC),
                ente_federativo,
                %s,
                now()
            FROM cnpj_stage.empresas_raw
            WHERE batch_id = %s
            ON CONFLICT (cnpj_basico) DO UPDATE SET
                razao_social = EXCLUDED.razao_social,
                natureza_juridica_codigo = EXCLUDED.natureza_juridica_codigo,
                porte_codigo = EXCLUDED.porte_codigo,
                capital_social = EXCLUDED.capital_social,
                ente_federativo = EXCLUDED.ente_federativo,
                last_batch_id = EXCLUDED.last_batch_id,
                updated_at = EXCLUDED.updated_at;
        """, (batch_id, batch_id))


        # 3. UPSERT ESTABELECIMENTOS
        logger.info("Upserting estabelecimentos...")
        cursor.execute("""
            INSERT INTO cnpj_public.estabelecimentos (
                cnpj, cnpj_basico, matriz_filial, nome_fantasia, situacao_cadastral,
                data_situacao, data_inicio_atividade, cnae_principal, uf, municipio_ibge,
                cep, logradouro, numero, complemento, bairro, ddd1, telefone1, email,
                last_batch_id, updated_at
            )
            SELECT
                LPAD(cnpj_basico, 8, '0') || LPAD(cnpj_ordem, 4, '0') || LPAD(cnpj_dv, 2, '0'),
                LPAD(cnpj_basico, 8, '0'),
                NULLIF(TRIM(identificador_matriz_filial), ''),
                nome_fantasia,
                NULLIF(TRIM(situacao_cadastral), ''),
                TO_DATE(NULLIF(TRIM(data_situacao), '00000000'), 'YYYYMMDD'),
                TO_DATE(NULLIF(TRIM(data_inicio_atividade), '00000000'), 'YYYYMMDD'),
                NULLIF(TRIM(cnae_principal), ''),
                NULLIF(TRIM(uf), ''),
                NULLIF(TRIM(municipio_ibge), ''),
                NULLIF(TRIM(cep), ''),
                logradouro,
                numero,
                complemento,
                bairro,
                NULLIF(TRIM(ddd1), ''),
                telefone1,
                email,
                %s,
                now()
            FROM cnpj_stage.estabelecimentos_raw
            WHERE batch_id = %s
            ON CONFLICT (cnpj) DO UPDATE SET
                matriz_filial = EXCLUDED.matriz_filial,
                nome_fantasia = EXCLUDED.nome_fantasia,
                situacao_cadastral = EXCLUDED.situacao_cadastral,
                data_situacao = EXCLUDED.data_situacao,
                data_inicio_atividade = EXCLUDED.data_inicio_atividade,
                cnae_principal = EXCLUDED.cnae_principal,
                uf = EXCLUDED.uf,
                municipio_ibge = EXCLUDED.municipio_ibge,
                cep = EXCLUDED.cep,
                logradouro = EXCLUDED.logradouro,
                numero = EXCLUDED.numero,
                complemento = EXCLUDED.complemento,
                bairro = EXCLUDED.bairro,
                ddd1 = EXCLUDED.ddd1,
                telefone1 = EXCLUDED.telefone1,
                email = EXCLUDED.email,
                last_batch_id = EXCLUDED.last_batch_id,
                updated_at = EXCLUDED.updated_at;
        """, (batch_id, batch_id))


        # 4. SECONDARIES CNAE (DELETE & INSERT PATTERN)
        logger.info("Upserting cnaes secundarios...")
        cursor.execute("""
            WITH lot_cnpjs AS (
                SELECT LPAD(cnpj_basico, 8, '0') || LPAD(cnpj_ordem, 4, '0') || LPAD(cnpj_dv, 2, '0') as cnpj
                FROM cnpj_stage.estabelecimentos_raw
                WHERE batch_id = %s
            )
            DELETE FROM cnpj_public.estabelecimento_cnae_secundario 
            WHERE cnpj IN (SELECT cnpj FROM lot_cnpjs);
        """, (batch_id,))

        # We must insert them securely processing CSV-like strings within SQL or Python.
        # Given secondary CNAEs are comma separated, postgres string_to_array and unnest is best:
        cursor.execute("""
            INSERT INTO cnpj_public.estabelecimento_cnae_secundario (cnpj, cnae_codigo, last_batch_id)
            SELECT 
                LPAD(cnpj_basico, 8, '0') || LPAD(cnpj_ordem, 4, '0') || LPAD(cnpj_dv, 2, '0') as cnpj,
                TRIM(unnest(string_to_array(cnae_secundarios, ','))) as cnae_codigo,
                %s
            FROM cnpj_stage.estabelecimentos_raw
            WHERE batch_id = %s AND cnae_secundarios IS NOT NULL AND TRIM(cnae_secundarios) <> '';
        """, (batch_id, batch_id))

        raw_conn.commit()
    except Exception as e:
        raw_conn.rollback()
        raise e
    finally:
        raw_conn.close()

def get_public_counts(engine, batch_id: str) -> dict:
    raw_conn = engine.raw_connection()
    counts = {}
    try:
        cursor = raw_conn.cursor()
        for table in ["empresas", "estabelecimentos", "cnaes", "estabelecimento_cnae_secundario"]:
            cursor.execute(f"SELECT COUNT(*) FROM cnpj_public.{table} WHERE last_batch_id = %s", (batch_id,))
            counts[table] = cursor.fetchone()[0]
    except Exception:
        pass
    finally:
        raw_conn.close()
    return counts
