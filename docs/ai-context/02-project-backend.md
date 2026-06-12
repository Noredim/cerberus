# PROJECT BACKEND

Backend principal:

apps/api/src

O backend do Cerberus está em produção.

Estrutura principal:

core/
modules/
scripts/
templates/

Módulos existentes:

auth/
catalog/
cnpj_public/
companies/
customers/
dashboards/
document_templates/
domains/
fiscal/
man_hours/
ncm/
ncm_st/
notifications/
opportunity_kits/
own_services/
payment_methods/
products/
professionals/
profiles/
purchase_budgets/
roles/
sales_budgets/
sales_proposals/
simulations/
solution_analysis/
suppliers/
tax_benefits/
tenants/
users/
utils/

Objetivo:

Este documento orienta a IA sobre a organização do backend.

Fluxo recomendado:

1. Ler este índice.
2. Identificar o módulo envolvido.
3. Ler apenas o módulo necessário.
4. Identificar os arquivos envolvidos.
5. Criar um plano.
6. Implementar apenas após aprovação.

Regras:

* Nunca fazer busca recursiva em todo o backend.
* Nunca abrir módulos não relacionados.
* Nunca fazer grandes refatorações.
* Sempre preservar compatibilidade.
* Ler apenas os módulos envolvidos na tarefa.

Se um módulo não existir, responder:

"NÃO ENCONTRADO."
