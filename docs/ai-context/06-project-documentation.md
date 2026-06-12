# PROJECT DOCUMENTATION

O Cerberus possui uma documentação estruturada para orientar o desenvolvimento assistido por IA.

Objetivo:

Este documento orienta a IA sobre qual documentação consultar para cada tipo de tarefa.

Hierarquia de conhecimento:

1. AGENTS.md

Documento principal de comportamento dos agentes.

Define:

* fluxo de trabalho
* regras obrigatórias
* limites de consumo de contexto

---

2. PRD.md

Documento de Produto.

Consultar para entender:

* objetivo do sistema
* regras de negócio
* módulos
* perfis de usuário
* funcionalidades

---

3. SPECS.md

Documento de Arquitetura Técnica.

Consultar para entender:

* stack tecnológica
* arquitetura
* banco de dados
* endpoints
* engines
* infraestrutura

---

4. docs/ai-context/

Documentação auxiliar para navegação.

01-project-root.md

02-project-backend.md

03-project-frontend.md

04-project-engines.md

05-project-database.md

06-project-documentation.md

---

5. docs/specs/

Especificações detalhadas.

Consultar apenas quando necessário.

---

Fluxo recomendado para qualquer tarefa:

1. Ler AGENTS.md

2. Ler PRD.md

3. Ler SPECS.md

4. Ler o índice correspondente em docs/ai-context

5. Identificar os arquivos envolvidos

6. Ler apenas os arquivos necessários

7. Criar um plano

8. Implementar somente após aprovação

Regras:

* Nunca abrir documentação desnecessária.
* Nunca ler o projeto inteiro.
* Nunca fazer busca recursiva sem necessidade.
* Nunca assumir informações não confirmadas.
* Se houver dúvida, responder:
  "NÃO FOI POSSÍVEL DETERMINAR SEM LER O CÓDIGO."

Objetivo principal:

Reduzir consumo de tokens e aumentar a precisão das implementações.
