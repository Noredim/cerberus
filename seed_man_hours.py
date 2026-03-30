"""
seed_man_hours.py
-----------------
Popula a tabela man_hours com os dados fornecidos.
Usa SQL puro (sem ORM) para evitar conflitos de importação circular.

Uso (dentro do container api):
    python seed_man_hours.py
"""

import sys
import uuid
import logging
from decimal import Decimal

from sqlalchemy import create_engine, text

# ---------------------------------------------------------------------------
# ⚙️  CONFIGURAÇÃO
# ---------------------------------------------------------------------------

DB_URL     = "postgresql://cerberus_user:cerberus_password@db:5432/cerberus"
COMPANY_ID = "147f0d08-e065-4fbf-8034-6ab4de731704"  # STELMAT TELEINFORMATICA LTDA
VIGENCIA   = 2025
DRY_RUN    = False   # True = simula sem gravar

# Colunas: nome_cargo | hora_normal | hora_extra | he_adic_noturno | he_dom_fer | he_dom_fer_noturno
MAN_HOURS_DATA = [
    ("ELETRICISTA PLENO",                    46.12, 73.79,  92.23,  92.24,  115.30),
    ("TÉCNICO EM TELECOM JR. III",           46.12, 73.79,  92.23,  92.24,  115.30),
    ("TÉCNICO EM TELECOM JR.",               31.18, 49.88,  62.35,  62.36,   77.95),
    ("TÉCNICO DE VIDEOMONITORAMENTO",        28.40, 45.44,  56.80,  56.80,   71.00),
    ("AUXILIAR TÉCNICO",                     17.09, 27.34,  34.17,  34.18,   42.72),
    ("SUPORTE TÉCNICO NÍVEL I",              29.58, 47.32,  59.15,  59.16,   73.95),
    ("TÉCNICO DE INFOVIA",                   31.18, 49.88,  62.35,  62.36,   77.95),
    ("TÉCNICO EM TELECOM PLENO II",          75.10, 120.16, 150.20, 150.20,  187.75),
    ("TÉCNICO EM TELECOMUNICAÇÃO",           36.39, 58.22,  72.77,  72.78,   90.97),
    ("TÉCNICO EM TELECOM SENIOR",            83.34, 133.34, 166.67, 166.68,  208.35),
    ("COORDENADORA DE SUPORTE TÉCNICO",      42.07, 67.31,  84.13,  84.14,  105.17),
    ("TÉCNICO EM ELETROTÉCNICA",             46.23, 73.96,  92.45,  92.46,  115.57),
    ("ANALISTA DE TI",                       54.56, 87.29,  109.11, 109.12,  136.40),
    ("AUXILIAR TÉCNICO I",                   18.81, 30.09,  37.61,  37.62,   47.02),
    ("AUXILIAR TÉCNICO CFTV",                18.88, 30.20,  37.75,  37.76,   47.20),
    ("TÉCNICO PLENO",                        41.79, 66.86,  83.57,  83.58,  104.47),
    ("COORDENADORA ADMINISTRATIVA",          35.57, 56.91,  71.13,  71.14,   88.92),
    ("TÉCNICO EM TELECOMUNICAÇÃO PLENO",     62.26, 99.61,  124.51, 124.52,  155.65),
]

# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
logger = logging.getLogger(__name__)


def main():
    engine = create_engine(DB_URL)

    with engine.connect() as conn:
        # 1. Resolve tenant_id da empresa
        row = conn.execute(
            text("SELECT id::text, tenant_id FROM companies WHERE id = :cid"),
            {"cid": COMPANY_ID},
        ).fetchone()

        if not row:
            logger.error(f"Empresa '{COMPANY_ID}' não encontrada.")
            sys.exit(1)

        tenant_id = row[1]
        logger.info(f"Empresa:  STELMAT TELEINFORMATICA LTDA")
        logger.info(f"Tenant:   {tenant_id}")
        logger.info(f"Vigência: {VIGENCIA} | DRY_RUN: {DRY_RUN}")
        logger.info("-" * 62)

        inserted = skipped = errors = created_roles = 0

        for (name, h_norm, h_extra, h_adic, h_dom, h_dom_not) in MAN_HOURS_DATA:
            name = name.strip()
            logger.info(f"  {name}")

            try:
                # 2. Busca cargo pelo nome
                role_row = conn.execute(
                    text(
                        "SELECT id FROM roles "
                        "WHERE tenant_id = :tid AND company_id = :cid AND name = :name "
                        "LIMIT 1"
                    ),
                    {"tid": tenant_id, "cid": COMPANY_ID, "name": name},
                ).fetchone()

                if role_row:
                    role_id = role_row[0]
                else:
                    # Cargo não encontrado → criar
                    logger.warning(f"    ↷ Cargo não encontrado, criando...")
                    role_id = str(uuid.uuid4())
                    if not DRY_RUN:
                        conn.execute(
                            text(
                                "INSERT INTO roles (id, tenant_id, company_id, name, can_perform_sale) "
                                "VALUES (:id, :tid, :cid, :name, FALSE)"
                            ),
                            {"id": role_id, "tid": tenant_id, "cid": COMPANY_ID, "name": name},
                        )
                    created_roles += 1

                # 3. Verifica duplicidade
                dup = conn.execute(
                    text(
                        "SELECT 1 FROM man_hours "
                        "WHERE tenant_id=:tid AND company_id=:cid "
                        "  AND role_id=:rid AND vigencia=:year AND ativo=TRUE"
                    ),
                    {"tid": tenant_id, "cid": COMPANY_ID, "rid": role_id, "year": VIGENCIA},
                ).fetchone()

                if dup:
                    logger.info(f"    → Já existe — ignorando.")
                    skipped += 1
                    continue

                # 4. Insere
                if DRY_RUN:
                    logger.info(
                        f"    [DRY] H.Norm={h_norm} | H.Extra={h_extra} | "
                        f"H.Adic.Not={h_adic} | H.Dom={h_dom} | H.Dom.Not={h_dom_not}"
                    )
                else:
                    conn.execute(
                        text(
                            """
                            INSERT INTO man_hours (
                                id, tenant_id, company_id, role_id, vigencia,
                                hora_normal, hora_extra, hora_extra_adicional_noturno,
                                hora_extra_domingos_feriados, hora_extra_domingos_feriados_noturno,
                                ativo, created_at, updated_at
                            ) VALUES (
                                :id, :tid, :cid, :rid, :year,
                                :h_norm, :h_extra, :h_adic, :h_dom, :h_dom_not,
                                TRUE, NOW(), NOW()
                            )
                            """
                        ),
                        {
                            "id":        str(uuid.uuid4()),
                            "tid":       tenant_id,
                            "cid":       COMPANY_ID,
                            "rid":       role_id,
                            "year":      VIGENCIA,
                            "h_norm":    Decimal(str(h_norm)),
                            "h_extra":   Decimal(str(h_extra)),
                            "h_adic":    Decimal(str(h_adic)),
                            "h_dom":     Decimal(str(h_dom)),
                            "h_dom_not": Decimal(str(h_dom_not)),
                        },
                    )
                    logger.info(f"    ✔ Inserido.")

                inserted += 1

            except Exception as exc:
                logger.error(f"    ✘ Erro: {exc}")
                errors += 1
                continue

        # Commit único ao final
        if not DRY_RUN:
            conn.commit()

        logger.info("-" * 62)
        logger.info(
            f"Concluído — Inseridos: {inserted} | "
            f"Cargos criados: {created_roles} | "
            f"Ignorados: {skipped} | Erros: {errors}"
        )


if __name__ == "__main__":
    main()
