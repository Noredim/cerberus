# PROJECT DATABASE

Banco de dados principal:

PostgreSQL

Arquitetura:

Multi-Tenant

Toda entidade de domínio deve respeitar o isolamento por tenant_id.

Estrutura principal:

migrations/

models/

schemas/

seed/

database/

Arquivos importantes:

src/core/database.py

Objetivo:

Este documento orienta a IA sobre a organização do banco de dados do Cerberus.

Fluxo recomendado:

1. Ler este índice.
2. Identificar as entidades envolvidas.
3. Ler apenas os models necessários.
4. Verificar migrations relacionadas.
5. Verificar impacto nas APIs e engines.
6. Propor um plano.
7. Implementar apenas após aprovação.

Regras:

* Nunca alterar migrations antigas.
* Nunca apagar colunas existentes sem solicitação.
* Nunca quebrar compatibilidade com dados existentes.
* Nunca ignorar tenant_id.
* Nunca criar tabelas duplicadas.
* Sempre preservar integridade dos dados.
* Sempre analisar impacto nas engines.
* Ler apenas as entidades envolvidas na tarefa.

Para regras de negócio consultar:

PRD.md

SPECS.md

docs/ai-context/03-regras-de-negocio.md

Para arquitetura consultar:

docs/ai-context/02-project-backend.md

docs/ai-context/04-project-engines.md
