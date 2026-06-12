# PROJECT DATABASE

Banco de dados principal:

PostgreSQL

Arquitetura:

Multi-Tenant

O Cerberus utiliza uma arquitetura modular.

Os modelos não ficam em uma pasta global.

Cada módulo possui seus próprios arquivos.

Estrutura encontrada:

apps/api/src/modules/

Padrão dos módulos:

models.py
schemas.py
service.py
router.py

Exemplos confirmados:

sales_budgets/
purchase_budgets/
opportunity_kits/

Alguns módulos podem possuir apenas parte dessa estrutura.

Objetivo:

Este documento orienta a IA sobre a organização do banco de dados e das entidades.

Fluxo recomendado:

1. Ler este índice.
2. Identificar o módulo envolvido.
3. Localizar o models.py do módulo.
4. Verificar schemas.py.
5. Verificar service.py.
6. Verificar router.py.
7. Criar um plano.
8. Implementar apenas após aprovação.

Regras:

* Nunca procurar models globais sem necessidade.
* Nunca alterar migrations antigas.
* Nunca quebrar compatibilidade.
* Nunca ignorar tenant_id quando aplicável.
* Ler apenas o módulo envolvido.

Se o módulo não existir, responder:

"NÃO ENCONTRADO."
