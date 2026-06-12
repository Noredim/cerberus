# PROJECT ENGINES

Engines principais:

engines/

Estrutura esperada:

tax_engine/
cost_engine/
pricing_engine/
contract_engine/

As engines do Cerberus são serviços especializados responsáveis pelos cálculos críticos do sistema.

Responsabilidades:

tax_engine

* cálculos tributários
* impostos
* benefícios fiscais
* ST
* DIFAL
* ISS

cost_engine

* formação do custo real
* composição de custos
* custos adicionais

pricing_engine

* formação do preço de venda
* margem
* markup
* preço sugerido

contract_engine

* locação
* comodato
* recorrência
* ROI
* payback
* mensalidades

Objetivo:

Este documento orienta a IA sobre a organização das engines.

Fluxo recomendado:

1. Ler este índice.
2. Identificar qual engine está envolvida.
3. Ler apenas os arquivos necessários.
4. Validar as regras de negócio relacionadas.
5. Propor um plano.
6. Implementar apenas após aprovação.

Regras:

* Nunca alterar regras matemáticas sem justificativa.
* Nunca alterar contratos de entrada e saída das engines sem necessidade.
* Nunca modificar múltiplas engines ao mesmo tempo.
* Sempre preservar compatibilidade.
* Sempre preservar memória de cálculo.
* Sempre preservar rastreabilidade dos resultados.
* Ler apenas a engine envolvida na tarefa.

Em caso de dúvida sobre regras de negócio, consultar:

PRD.md
SPECS.md
docs/ai-context/03-regras-de-negocio.md
