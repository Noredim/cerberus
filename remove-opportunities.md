# Plano de Remoção: Refatoração de Oportunidades

## Overview
Remover todas as dependências do módulo de oportunidades atual (telas, rotas, imports e tabelas) visando limpar totalmente o terreno para sua futura reconstrução do zero, conforme demandado.

## Project Type
WEB & BACKEND 
*(Agentes recomendados para orquestração: `frontend-specialist`, `backend-specialist`, e `database-architect`).*

## Success Criteria
- Nenhuma pasta `opportunities` existe nas apps (Web e API).
- A aplicação compila sem erros de importação relativas a `OpportunityBudgetDetailsModal`, `ProductBudgetManualModal` e `OpportunityList`.
- O servidor sobe com sucesso (FastAPI não encontra imports inválidos).
- As rotas e links da GUI desapareceram.
- As tabelas de oportunidades são eliminadas do banco de dados (migração de drop).

## Tech Stack
- Frontend: React / TypeScript / Vite / Tailwind
- Backend: FastAPI / Python / SQLAlchemy
- Ferramentas sugeridas: Delete / Grep para faxina absoluta de strings.

## File Structure
Pastas alvo da exclusão:
```
apps/web/src/modules/opportunities/*
apps/api/src/modules/opportunities/*
```

## Task Breakdown

### Task 1: Limpeza do Backend Principal (API)
- **agent**: `backend-specialist`
- **skills**: `bash-linux`, `clean-code`
- **priority**: P1
- **dependencies**: Nenhuma
- **INPUT**: Pasta de rotas API e main.py.
- **OUTPUT**: Sem a pasta opportunities; arquivo `main.py` e `products/router.py` limpos.
- **VERIFY**: `pyright apps/api` roda 100% ou a API sobe sem crashar nas rotas isoladas.

### Task 2: Limpeza de Banco de Dados e Migrations
- **agent**: `database-architect`
- **skills**: `database-design`
- **priority**: P1
- **dependencies**: Task 1
- **INPUT**: Arquivos de migration em `apps/api/alembic/versions`.
- **OUTPUT**: Criação de instrução para dropar a tabela `oportunidades` e derivados e apagar a migration `e9845fcc62d9_add_opportunity_module_tables.py`.
- **VERIFY**: Alembic gera e testa upgrade/downgrade de exclusão da tabela perfeitamente.

### Task 3: Limpeza Estrita do Frontend (Web)
- **agent**: `frontend-specialist`
- **skills**: `bash-linux`, `clean-code`
- **priority**: P2
- **dependencies**: Nível 2
- **INPUT**: Componentes React, App.tsx, Sidebar.tsx.
- **OUTPUT**: Sem arquivos .tsx/ts relativos a oportunidades.
- **VERIFY**: `npm run build` passa sem atirar erros de `Module not found` no Vite.


## ✅ Fase X: Verificação Final
Seguindo o core, deve invocar:
- `npm run lint && npx tsc --noEmit` em `apps/web`.
- Confirmação de API subindo na porta correta sem crash.
- (Opcional) Executar scripts de auditoria em Python recomendados no workflow.
