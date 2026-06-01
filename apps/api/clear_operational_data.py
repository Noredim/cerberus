import os
import sys
import argparse
from sqlalchemy import text

# Add apps/api to path so `src.*` can be resolved
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.core.database import SessionLocal

def main():
    parser = argparse.ArgumentParser(description="Limpa com segurança todos os dados operacionais (kits, orçamentos, produtos, clientes, fornecedores) para todas as empresas.")
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Confirma as exclusões e grava as alterações no banco de dados. Caso contrário, roda em modo de simulação (dry-run)."
    )
    args = parser.parse_args()

    db = SessionLocal()
    
    print("======================================================================")
    print("      SCRIPT DE LIMPEZA DE DADOS OPERACIONAIS (TODAS AS EMPRESAS)     ")
    print("======================================================================")
    print(f"Modo: {'EFETIVAR NO BANCO (COMMIT)' if args.commit else 'SIMULAÇÃO (DRY-RUN)'}")
    print("======================================================================")
    
    try:
        # Iniciando transação
        db.begin()
        
        # Passos de deleção na ordem correta para evitar violação de FK Restrict
        steps = [
            # 1. Análises de solução
            ("Deletar solution_analysis_items", "DELETE FROM solution_analysis_items"),
            ("Deletar solution_analyses", "DELETE FROM solution_analyses"),
            
            # 2. Custos e itens de kits de oportunidade
            ("Deletar opportunity_kit_costs", "DELETE FROM opportunity_kit_costs"),
            ("Deletar opportunity_kit_items", "DELETE FROM opportunity_kit_items"),
            ("Deletar kit_custos_mensais", "DELETE FROM kit_custos_mensais"),
            
            # 3. Propostas comerciais
            ("Deletar sales_proposal_kits", "DELETE FROM sales_proposal_kits"),
            ("Deletar sales_proposal_logs", "DELETE FROM sales_proposal_logs"),
            ("Deletar sales_proposals", "DELETE FROM sales_proposals"),
            
            # 4. Kits de oportunidade
            ("Deletar opportunity_kits", "DELETE FROM opportunity_kits"),
            
            # 5. Detalhes e orçamentos de vendas
            ("Deletar sales_budget_approvals", "DELETE FROM sales_budget_approvals"),
            ("Deletar sales_budget_history", "DELETE FROM sales_budget_history"),
            ("Deletar sales_budget_responsaveis", "DELETE FROM sales_budget_responsaveis"),
            ("Deletar sales_budget_items", "DELETE FROM sales_budget_items"),
            ("Deletar rental_budget_items", "DELETE FROM rental_budget_items"),
            ("Deletar sales_budgets", "DELETE FROM sales_budgets"),
            
            # 6. Detalhes e orçamentos de compras
            ("Deletar purchase_budget_negotiation_items", "DELETE FROM purchase_budget_negotiation_items"),
            ("Deletar purchase_budget_negotiations", "DELETE FROM purchase_budget_negotiations"),
            ("Deletar purchase_budget_items", "DELETE FROM purchase_budget_items"),
            ("Deletar purchase_budgets", "DELETE FROM purchase_budgets"),
            
            # 7. Fornecedores de produtos (tabela de ligação)
            ("Deletar product_suppliers", "DELETE FROM product_suppliers"),
            
            # 8. Produtos
            ("Deletar products", "DELETE FROM products"),
            
            # 9. Fornecedores
            ("Deletar suppliers", "DELETE FROM suppliers"),
            
            # 10. Clientes
            ("Deletar customers", "DELETE FROM customers")
        ]
        
        for idx, (label, sql) in enumerate(steps, start=1):
            res = db.execute(text(sql))
            print(f"[{idx}/{len(steps)}] {label}: {res.rowcount} linhas afetadas.")
            
        print("----------------------------------------------------------------------")
        
        # Verificações finais
        print("Verificações de integridade pós-limpeza:")
        tables_to_verify = [
            'opportunity_kits', 'sales_budgets', 'sales_proposals', 
            'purchase_budgets', 'products', 'suppliers', 'customers'
        ]
        
        passed = True
        for t in tables_to_verify:
            count = db.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
            print(f"  - Tabela '{t}': {count} registros restantes.")
            if count > 0:
                passed = False
                
        if not passed:
            print("Erro de verificação: Alguns registros operacionais ainda existem no banco!")
            db.rollback()
            return
            
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
