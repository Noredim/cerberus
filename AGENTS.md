# AGENTS.md

# CERBERUS

## Objetivo

Este projeto é mantido com auxílio de Inteligências Artificiais.

O Cerberus é um sistema operacional e em produção.

Toda alteração deve priorizar:

* estabilidade
* compatibilidade
* rastreabilidade
* preservação da memória de cálculo

O objetivo dos agentes é compreender o sistema antes de implementar qualquer alteração.

---

# Hierarquia de Conhecimento

Antes de qualquer tarefa, seguir obrigatoriamente esta ordem:

## Nível 1 — Contexto Principal

1. AGENTS.md

2. CURRENT_STATE.md

3. PRD.md

4. SPECS.md
---

## Nível 2 — Navegação do Projeto

4. docs/ai-context/01-project-root.md

A partir deste ponto, consultar apenas o índice relacionado à tarefa.

### Backend

docs/ai-context/02-project-backend.md

### Frontend

docs/ai-context/03-project-frontend.md

### Engines

docs/ai-context/04-project-engines.md

### Banco de Dados

docs/ai-context/05-project-database.md

### Documentação

docs/ai-context/06-project-documentation.md

---

## Nível 3 — Leitura Específica

Somente após identificar o módulo envolvido:

* abrir os arquivos necessários
* evitar leituras desnecessárias
* evitar exploração do projeto inteiro

---

# Fluxo Obrigatório

Para qualquer tarefa:

1. Ler AGENTS.md

2. Ler PRD.md

3. Ler SPECS.md

4. Ler docs/ai-context/01-project-root.md

5. Identificar o domínio da tarefa

6. Ler apenas o índice correspondente

7. Identificar os arquivos envolvidos

8. Criar um plano

9. Aguardar aprovação quando necessário

10. Implementar

11. Revisar impacto

---

# Regras Gerais

Sempre:

* compreender o contexto antes de alterar código
* preservar compatibilidade
* fazer alterações pequenas e incrementais
* respeitar padrões existentes
* preservar memória de cálculo
* preservar auditabilidade
* preservar rastreabilidade
* informar arquivos alterados
* informar impactos da alteração

Nunca:

* recriar funcionalidades existentes
* alterar arquitetura sem necessidade
* alterar migrations antigas
* alterar contratos de API sem necessidade
* apagar código sem justificativa
* fazer grandes refatorações
* substituir implementações funcionais apenas por preferência técnica

---

# Regras para Sistemas em Produção

Este sistema possui usuários ativos.

Prioridades:

1. Estabilidade

2. Compatibilidade

3. Legibilidade

4. Performance

5. Novas funcionalidades

Toda alteração deve minimizar riscos.

---

# Regras de Consumo de Contexto

Nunca:

* listar o projeto inteiro de forma recursiva
* abrir node_modules
* abrir .git
* abrir dist
* abrir build
* abrir .venv
* abrir venv
* abrir **pycache**
* abrir arquivos gerados sem necessidade

Evitar:

* leitura desnecessária do projeto inteiro
* busca por tentativa e erro
* abrir arquivos não relacionados

Preferir:

* leitura seletiva
* navegação pelos índices
* análise incremental

Para tarefas simples:

* ler no máximo 5 arquivos

Para tarefas médias:

* ler no máximo 10 arquivos

Para tarefas grandes:

* apresentar plano antes de expandir a leitura

---

# Regras de Descoberta

Nunca assumir informações ausentes.

Nunca inventar:

* endpoints
* estruturas
* nomes de arquivos
* entidades
* módulos

Se a informação não puder ser confirmada, responder:

"NÃO FOI POSSÍVEL DETERMINAR SEM LER O CÓDIGO."

---

# Estrutura do Projeto

Backend:
apps/api/src

Frontend:
apps/web/src

Engines:
engines/

Documentação:
docs/

Contexto IA:
docs/ai-context/

Especificações:
docs/specs/

---

# Filosofia de Desenvolvimento

Analisar.

Planejar.

Validar.

Implementar.

Revisar.

Nunca codificar antes de compreender o contexto.

Nunca sacrificar estabilidade por velocidade.

O objetivo principal é evoluir o Cerberus preservando sua arquitetura e regras de negócio.
