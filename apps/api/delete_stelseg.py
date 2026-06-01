import os
import sys
import argparse
from sqlalchemy import text

# Add apps/api to path so `src.*` can be resolved
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.core.database import SessionLocal

def main():
    parser = argparse.ArgumentParser(description="Exclui de forma segura todos os dados associados à empresa STELSEG.")
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Confirma as exclusões e grava as alterações no banco de dados. Caso contrário, roda em modo de simulação (dry-run)."
    )
    args = parser.parse_args()

    db = SessionLocal()
    
    stelseg_id = 'a38cab19-fdcc-4166-a667-fbdc8c67c1bd'
    stelmat_id = '147f0d08-e065-4fbf-8034-6ab4de731704'
    
    print("======================================================================")
    print("      SCRIPT DE EXCLUSÃO SEGURA DA EMPRESA STELSEG                    ")
    print("======================================================================")
    print(f"Modo: {'EFETIVAR NO BANCO (COMMIT)' if args.commit else 'SIMULAÇÃO (DRY-RUN)'}")
    print("======================================================================")
    
    try:
        # Iniciando transação
        db.begin()
        
        # Verificar existência das empresas
        comp_stelseg = db.execute(text("SELECT id, nome_fantasia, razao_social FROM companies WHERE id = :id"), {"id": stelseg_id}).fetchone()
        comp_stelmat = db.execute(text("SELECT id, nome_fantasia, razao_social FROM companies WHERE id = :id"), {"id": stelmat_id}).fetchone()
        
        if not comp_stelseg:
            print("Erro: Empresa STELSEG não foi encontrada no banco de dados.")
            db.rollback()
            return
        if not comp_stelmat:
            print("Erro: Empresa STELMAT não foi encontrada no banco de dados.")
            db.rollback()
            return
            
        print(f"Empresas identificadas:")
        print(f"  - STELSEG: {comp_stelseg.razao_social} (ID: {comp_stelseg.id})")
        print(f"  - STELMAT: {comp_stelmat.razao_social} (ID: {comp_stelmat.id})")
        print("----------------------------------------------------------------------")
        
        # 1. Atualizar a empresa padrão (is_default) para STELMAT nos usuários vinculados
        result = db.execute(text("""
            UPDATE user_companies 
            SET is_default = True 
            WHERE user_id IN (SELECT user_id FROM user_companies WHERE company_id = :stelseg_id)
              AND company_id = :stelmat_id
        """), {"stelseg_id": stelseg_id, "stelmat_id": stelmat_id})
        print(f"[1/39] Atualizado default company para STELMAT em {result.rowcount} vínculos de usuários.")
        
        # Passos de deleção e atualização
        steps = [
            # Nulificar referências cruzadas de produtos/serviços da STELSEG em kits e análises de outras empresas (STELMAT)
            ("nullify solution_analysis_items (item_a_id)", 
             """UPDATE solution_analysis_items SET item_a_id = NULL WHERE item_a_id IN (SELECT id FROM products WHERE company_id = :stelseg_id)"""),
            ("nullify solution_analysis_items (item_b_id)", 
             """UPDATE solution_analysis_items SET item_b_id = NULL WHERE item_b_id IN (SELECT id FROM products WHERE company_id = :stelseg_id)"""),
            ("nullify solution_analysis_items (item_c_id)", 
             """UPDATE solution_analysis_items SET item_c_id = NULL WHERE item_c_id IN (SELECT id FROM products WHERE company_id = :stelseg_id)"""),
             
            ("nullify opportunity_kit_items (product_id)",
             """UPDATE opportunity_kit_items SET product_id = NULL WHERE product_id IN (SELECT id FROM products WHERE company_id = :stelseg_id)"""),
            ("nullify opportunity_kit_items (own_service_id)",
             """UPDATE opportunity_kit_items SET own_service_id = NULL WHERE own_service_id IN (SELECT id FROM own_services WHERE company_id = :stelseg_id)"""),
             
            ("nullify opportunity_kit_costs (product_id)",
             """UPDATE opportunity_kit_costs SET product_id = NULL WHERE product_id IN (SELECT id FROM products WHERE company_id = :stelseg_id)"""),
            ("nullify opportunity_kit_costs (own_service_id)",
             """UPDATE opportunity_kit_costs SET own_service_id = NULL WHERE own_service_id IN (SELECT id FROM own_services WHERE company_id = :stelseg_id)"""),

            # Deletar itens e cabeçalhos de análise de solução da STELSEG
            ("delete solution_analysis_items", 
             """DELETE FROM solution_analysis_items WHERE analise_id IN (SELECT id FROM solution_analyses WHERE company_id = :stelseg_id)"""),
            ("delete solution_analyses", 
             """DELETE FROM solution_analyses WHERE company_id = :stelseg_id"""),
             
            # Deletar custos e itens dos kits de oportunidade da STELSEG
            ("delete opportunity_kit_costs", 
             """DELETE FROM opportunity_kit_costs WHERE kit_id IN (SELECT id FROM opportunity_kits WHERE company_id = :stelseg_id)"""),
            ("delete opportunity_kit_items", 
             """DELETE FROM opportunity_kit_items WHERE kit_id IN (SELECT id FROM opportunity_kits WHERE company_id = :stelseg_id)"""),
            ("delete kit_custos_mensais",
             """DELETE FROM kit_custos_mensais WHERE kit_id IN (SELECT id FROM opportunity_kits WHERE company_id = :stelseg_id)"""),
            ("delete sales_proposal_kits", 
             """DELETE FROM sales_proposal_kits WHERE proposal_id IN (SELECT id FROM sales_proposals WHERE company_id = :stelseg_id)"""),
            ("delete sales_proposal_logs", 
             """DELETE FROM sales_proposal_logs WHERE proposal_id IN (SELECT id FROM sales_proposals WHERE company_id = :stelseg_id)"""),
            ("delete sales_proposals", 
             """DELETE FROM sales_proposals WHERE company_id = :stelseg_id"""),
            ("delete opportunity_kits", 
             """DELETE FROM opportunity_kits WHERE company_id = :stelseg_id"""),
             
            # Deletar man_hours, own_service_items, own_services
            ("delete man_hours", 
             """DELETE FROM man_hours WHERE company_id = :stelseg_id"""),
            ("delete own_service_items", 
             """DELETE FROM own_service_items WHERE own_service_id IN (SELECT id FROM own_services WHERE company_id = :stelseg_id)"""),
            ("delete own_services", 
             """DELETE FROM own_services WHERE company_id = :stelseg_id"""),
             
            # Deletar professionals, roles, policies, policy roles
            ("delete professionals", 
             """DELETE FROM professionals WHERE company_id = :stelseg_id"""),
            ("delete company_commercial_policy_roles", 
             """DELETE FROM company_commercial_policy_roles WHERE policy_id IN (SELECT id FROM company_commercial_policies WHERE company_id = :stelseg_id)"""),
            ("delete company_commercial_policies", 
             """DELETE FROM company_commercial_policies WHERE company_id = :stelseg_id"""),
            ("delete roles", 
             """DELETE FROM roles WHERE company_id = :stelseg_id"""),
             
            # Deletar dados de orçamentos de compras (purchase_budgets)
            ("delete purchase_budget_negotiation_items", 
             """DELETE FROM purchase_budget_negotiation_items WHERE negotiation_id IN (SELECT id FROM purchase_budget_negotiations WHERE budget_id IN (SELECT id FROM purchase_budgets WHERE company_id = :stelseg_id))"""),
            ("delete purchase_budget_negotiations", 
             """DELETE FROM purchase_budget_negotiations WHERE budget_id IN (SELECT id FROM purchase_budgets WHERE company_id = :stelseg_id)"""),
            ("delete purchase_budget_items", 
             """DELETE FROM purchase_budget_items WHERE budget_id IN (SELECT id FROM purchase_budgets WHERE company_id = :stelseg_id)"""),
            ("delete purchase_budgets", 
             """DELETE FROM purchase_budgets WHERE company_id = :stelseg_id"""),
             
            # Deletar dados de orçamentos de vendas (sales_budgets)
            ("delete sales_budget_approvals", 
             """DELETE FROM sales_budget_approvals WHERE sales_budget_id IN (SELECT id FROM sales_budgets WHERE company_id = :stelseg_id)"""),
            ("delete sales_budget_history", 
             """DELETE FROM sales_budget_history WHERE sales_budget_id IN (SELECT id FROM sales_budgets WHERE company_id = :stelseg_id)"""),
            ("delete sales_budget_responsaveis", 
             """DELETE FROM sales_budget_responsaveis WHERE budget_id IN (SELECT id FROM sales_budgets WHERE company_id = :stelseg_id)"""),
            ("delete sales_budget_items", 
             """DELETE FROM sales_budget_items WHERE budget_id IN (SELECT id FROM sales_budgets WHERE company_id = :stelseg_id)"""),
            ("delete sales_budgets", 
             """DELETE FROM sales_budgets WHERE company_id = :stelseg_id"""),
             
            # Deletar tabelas do catálogo de produtos e parceiros
            ("delete product_suppliers", 
             """DELETE FROM product_suppliers WHERE product_id IN (SELECT id FROM products WHERE company_id = :stelseg_id)"""),
            ("delete products", 
             """DELETE FROM products WHERE company_id = :stelseg_id"""),
            ("delete suppliers", 
             """DELETE FROM suppliers WHERE company_id = :stelseg_id"""),
            ("delete customers", 
             """DELETE FROM customers WHERE company_id = :stelseg_id"""),
             
            # Deletar tabelas de parametrizações e metadados fiscais da empresa
            ("delete company_cnaes", """DELETE FROM company_cnaes WHERE company_id = :stelseg_id"""),
            ("delete company_tax_profiles", """DELETE FROM company_tax_profiles WHERE company_id = :stelseg_id"""),
            ("delete company_benefits", """DELETE FROM company_benefits WHERE company_id = :stelseg_id"""),
            ("delete company_qsa", """DELETE FROM company_qsa WHERE company_id = :stelseg_id"""),
            ("delete company_sales_parameters", """DELETE FROM company_sales_parameters WHERE company_id = :stelseg_id"""),
            ("delete company_cnpj_query_logs", """DELETE FROM company_cnpj_query_logs WHERE company_id = :stelseg_id"""),
            ("delete user_companies", """DELETE FROM user_companies WHERE company_id = :stelseg_id"""),
            ("delete notifications", """DELETE FROM notifications WHERE company_id = :stelseg_id"""),
            
            # Por fim, excluir a própria empresa
            ("companies", """DELETE FROM companies WHERE id = :stelseg_id""")
        ]
        
        for idx, (label, sql) in enumerate(steps, start=2):
            res = db.execute(text(sql), {"stelseg_id": stelseg_id})
            print(f"[{idx}/{len(steps)+1}] {label}: {res.rowcount} linhas afetadas.")
            
        print("----------------------------------------------------------------------")
        
        # Verificação final na transação atual
        stelseg_check = db.execute(text("SELECT id FROM companies WHERE id = :stelseg_id"), {"stelseg_id": stelseg_id}).fetchone()
        stelmat_check = db.execute(text("SELECT id FROM companies WHERE id = :stelmat_id"), {"stelmat_id": stelmat_id}).fetchone()
        
        if stelseg_check:
            print("Erro de verificação: STELSEG ainda existe no banco de dados!")
            db.rollback()
            return
        else:
            print("Verificação: STELSEG excluída com sucesso.")
            
        if not stelmat_check:
            print("Erro de verificação: STELMAT foi excluída acidentalmente!")
            db.rollback()
            return
        else:
            print("Verificação: STELMAT permanece intacta.")
            
        if args.commit:
            db.commit()
            print("\nSUCESSO: Transação efetivada (committed) no banco de dados!")
        else:
            db.rollback()
            print("\nSUCESSO: Simulação concluída (dry-run). Nenhuma alteração foi salva no banco de dados.")
            
    except Exception as e:
        print(f"\nERRO DURANTE A EXECUÇÃO: {e}")
        print("Executando ROLLBACK da transação para preservar o estado do banco...")
        try:
            db.rollback()
            print("Rollback executado com sucesso.")
        except Exception as rollback_err:
            print(f"Erro ao tentar executar rollback: {rollback_err}")
    finally:
        db.close()

if __name__ == "__main__":
    main()
