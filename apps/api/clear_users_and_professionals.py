import os
import sys
import argparse
from sqlalchemy import text

# Add apps/api to path so `src.*` can be resolved
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from src.core.database import SessionLocal

def main():
    parser = argparse.ArgumentParser(description="Limpa cadastros de profissionais e usuários, preservando apenas os e-mails informados.")
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Confirma as exclusões e grava as alterações no banco de dados. Caso contrário, roda em modo de simulação (dry-run)."
    )
    args = parser.parse_args()

    db = SessionLocal()
    
    # E-mails a serem mantidos
    preserved_emails = [
        'ricardo.noredim@stelmat.com.br',
        'joao.damasceno@stelmat.com.br'
    ]
    
    print("======================================================================")
    print("      SCRIPT DE LIMPEZA DE PROFISSIONAIS E FILTRAGEM DE USUÁRIOS       ")
    print("======================================================================")
    print(f"Modo: {'EFETIVAR NO BANCO (COMMIT)' if args.commit else 'SIMULAÇÃO (DRY-RUN)'}")
    print("======================================================================")
    
    try:
        # Iniciando transação
        db.begin()
        
        # 1. Excluir profissionais
        res_prof = db.execute(text("DELETE FROM professionals"))
        print(f"[1/2] Deletar profissionais: {res_prof.rowcount} linhas afetadas.")
        
        # 2. Excluir usuários (exceto os preservados)
        res_user = db.execute(
            text("DELETE FROM users WHERE email NOT IN :emails"),
            {"emails": tuple(preserved_emails)}
        )
        print(f"[2/2] Deletar usuários (exceto preservados): {res_user.rowcount} linhas afetadas.")
        
        print("----------------------------------------------------------------------")
        
        # Verificações finais
        print("Usuários que permanecem no banco:")
        remaining = db.execute(text("SELECT name, email FROM users ORDER BY email")).fetchall()
        for r in remaining:
            print(f"  - {r.name} ({r.email})")
            
        prof_count = db.execute(text("SELECT COUNT(*) FROM professionals")).scalar()
        print(f"Profissionais restantes: {prof_count}")
        
        if prof_count > 0:
            print("Erro de verificação: Ainda existem profissionais no banco!")
            db.rollback()
            return
            
        # Garante que nenhum e-mail não-preservado sobrou
        for r in remaining:
            if r.email not in preserved_emails:
                print(f"Erro de verificação: Usuário não-autorizado '{r.email}' ainda existe!")
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
