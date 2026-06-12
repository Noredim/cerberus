# PROJECT ENGINES

Engines principais:

engines/

O Cerberus utiliza engines externas especializadas para cálculos críticos do negócio.

Estrutura existente:

contract_engine/

cost_engine/

pricing_engine/

tax_engine/

Objetivo:

Este documento orienta a IA sobre a organização das engines.

Fluxo recomendado:

1. Ler este índice.
2. Identificar qual engine está envolvida.
3. Ler apenas a engine necessária.
4. Identificar os arquivos impactados.
5. Criar um plano.
6. Implementar apenas após aprovação.

Responsabilidades gerais:

tax_engine

* cálculos tributários
* benefícios fiscais
* ST
* DIFAL
* ISS

cost_engine

* composição de custos
* custo real
* custos adicionais

pricing_engine

* formação de preço
* margem
* markup

contract_engine

* locação
* comodato
* recorrência
* ROI
* payback

Regras:

* Nunca alterar múltiplas engines sem necessidade.
* Nunca modificar regras matemáticas sem análise.
* Nunca alterar contratos de entrada e saída sem validação.
* Sempre preservar memória de cálculo.
* Sempre preservar rastreabilidade.
* Ler apenas a engine envolvida na tarefa.

Se a engine não existir, responder:

"NÃO ENCONTRADO."
