"""
Migration script: Apply default commercial policy to ALL existing VENDA_EQUIPAMENTOS kits.

Usage:
    python /tmp/apply_default_policy.py --dry-run   # Preview only
    python /tmp/apply_default_policy.py              # Apply changes

Fields updated in OpportunityKit:
    - fator_margem_locacao            → default_policy.fator_limite
    - fator_margem_instalacao         → default_policy.fator_limite
    - fator_margem_manutencao         → default_policy.fator_limite
    - fator_margem_servicos_produtos  → default_policy.fator_limite
    - perc_comissao                   → default_policy.comissao_percentual
"""
import sys
import os

# Add project root to path
sys.path.insert(0, '/app')

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://cerberus_user:cerberus_password@cerberus_db:5432/cerberus')

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)

DRY_RUN = '--dry-run' in sys.argv

def run():
    session = Session()
    try:
        # ── 1. Find all default policies grouped by company ──────────────────
        default_policies = session.execute(text("""
            SELECT
                cp.id         AS policy_id,
                cp.company_id,
                cp.nome_politica,
                CAST(cp.fator_limite AS FLOAT)         AS fator_limite,
                CAST(cp.comissao_percentual AS FLOAT)  AS comissao_percentual
            FROM company_commercial_policies cp
            WHERE cp.is_default = TRUE
              AND cp.ativo = TRUE
            ORDER BY cp.company_id
        """)).fetchall()

        if not default_policies:
            print("❌  Nenhuma política padrão encontrada. Configure 'is_default = true' em ao menos uma política.")
            return

        print(f"\n{'='*60}")
        print(f"  {'DRY-RUN — ' if DRY_RUN else ''}Aplicação de Política Padrão em Kits Existentes")
        print(f"{'='*60}\n")

        total_updated = 0

        for pol in default_policies:
            # ── 2. Find all VENDA_EQUIPAMENTOS kits for this company ──────────
            kits = session.execute(text("""
                SELECT
                    ok.id,
                    ok.nome_kit,
                    ok.sales_budget_id,
                    CAST(ok.fator_margem_locacao AS FLOAT)            AS fator_margem_locacao,
                    CAST(ok.fator_margem_instalacao AS FLOAT)         AS fator_margem_instalacao,
                    CAST(ok.fator_margem_manutencao AS FLOAT)         AS fator_margem_manutencao,
                    CAST(ok.fator_margem_servicos_produtos AS FLOAT)  AS fator_margem_servicos_produtos,
                    CAST(ok.perc_comissao AS FLOAT)                   AS perc_comissao
                FROM opportunity_kits ok
                JOIN sales_budgets sb ON sb.id = ok.sales_budget_id
                WHERE ok.tipo_contrato = 'VENDA_EQUIPAMENTOS'
                  AND sb.company_id = :company_id
            """), {'company_id': pol.company_id}).fetchall()

            if not kits:
                print(f"  Empresa {pol.company_id}: nenhum kit VENDA_EQUIPAMENTOS encontrado.\n")
                continue

            print(f"  Empresa: {pol.company_id}")
            print(f"  Política Padrão: \"{pol.nome_politica}\"")
            print(f"  → Fator Mín.: {pol.fator_limite:.4f} | Comissão: {pol.comissao_percentual:.2f}%")
            print(f"  Kits a atualizar: {len(kits)}\n")

            for kit in kits:
                changes = []
                if abs(kit.fator_margem_locacao - pol.fator_limite) > 0.0001:
                    changes.append(f"    fator_margem_locacao:           {kit.fator_margem_locacao:.4f} → {pol.fator_limite:.4f}")
                if abs(kit.fator_margem_instalacao - pol.fator_limite) > 0.0001:
                    changes.append(f"    fator_margem_instalacao:        {kit.fator_margem_instalacao:.4f} → {pol.fator_limite:.4f}")
                if abs(kit.fator_margem_manutencao - pol.fator_limite) > 0.0001:
                    changes.append(f"    fator_margem_manutencao:        {kit.fator_margem_manutencao:.4f} → {pol.fator_limite:.4f}")
                if abs(kit.fator_margem_servicos_produtos - pol.fator_limite) > 0.0001:
                    changes.append(f"    fator_margem_servicos_produtos: {kit.fator_margem_servicos_produtos:.4f} → {pol.fator_limite:.4f}")
                if abs(kit.perc_comissao - pol.comissao_percentual) > 0.001:
                    changes.append(f"    perc_comissao:                  {kit.perc_comissao:.2f}% → {pol.comissao_percentual:.2f}%")

                budget_info = f"(Orç: {kit.sales_budget_id})" if kit.sales_budget_id else "(Global)"
                if changes:
                    print(f"  • {kit.nome_kit} {budget_info}")
                    for c in changes:
                        print(c)
                    print()
                else:
                    print(f"  ✓ {kit.nome_kit} {budget_info} — já está correto\n")

            if not DRY_RUN:
                # ── 3. Bulk update all matching kits ────────────────────────────
                result = session.execute(text("""
                    UPDATE opportunity_kits
                    SET
                        fator_margem_locacao            = :fator,
                        fator_margem_instalacao         = :fator,
                        fator_margem_manutencao         = :fator,
                        fator_margem_servicos_produtos  = :fator,
                        perc_comissao                   = :comissao
                    WHERE tipo_contrato = 'VENDA_EQUIPAMENTOS'
                      AND sales_budget_id IN (
                          SELECT id FROM sales_budgets WHERE company_id = :company_id
                      )
                """), {
                    'fator': pol.fator_limite,
                    'comissao': pol.comissao_percentual,
                    'company_id': pol.company_id
                })
                rows = result.rowcount
                total_updated += rows
                print(f"  ✅ {rows} kits atualizados para empresa {pol.company_id}\n")

        if DRY_RUN:
            print(f"\n{'='*60}")
            print("  ⚠️  DRY-RUN concluído. Nenhum dado foi alterado.")
            print("  Execute sem --dry-run para aplicar as mudanças.")
            print(f"{'='*60}\n")
        else:
            session.commit()
            print(f"\n{'='*60}")
            print(f"  ✅ Migração concluída. Total de kits atualizados: {total_updated}")
            print(f"{'='*60}\n")

    except Exception as e:
        session.rollback()
        print(f"\n❌  Erro durante a migração: {e}")
        raise
    finally:
        session.close()


if __name__ == '__main__':
    run()
