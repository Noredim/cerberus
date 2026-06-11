# AGENTS.md

## Objetivo

Este projeto é mantido com auxílio de Inteligências Artificiais.

Todo agente deve compreender o sistema antes de implementar qualquer alteração.

---

## Fluxo obrigatório

Antes de qualquer tarefa:

1. Ler AGENTS.md
2. Ler docs/ai-context/00-visao-geral.md
3. Ler docs/ai-context/01-arquitetura.md
4. Ler docs/ai-context/project-files-clean.txt
5. Ler apenas os arquivos relacionados à tarefa solicitada

---

## Regras

- Nunca alterar código sem compreender o contexto.
- Nunca recriar funcionalidades existentes.
- Nunca alterar migrations antigas.
- Nunca alterar contratos de API sem necessidade.
- Nunca apagar código sem justificar.
- Sempre fazer alterações pequenas e incrementais.
- Sempre preservar compatibilidade com o sistema atual.
- Sempre respeitar os padrões existentes do projeto.

---

## Forma de trabalho

Para tarefas grandes:

1. Fazer análise.
2. Criar plano.
3. Aguardar aprovação.
4. Implementar.
5. Revisar impacto.

---

## Limites

Evitar leitura desnecessária do projeto inteiro.

Ler apenas os módulos necessários para a tarefa.

Usar a documentação em docs/ai-context como fonte principal de conhecimento.

---

## Prioridades

1. Estabilidade
2. Compatibilidade
3. Legibilidade
4. Performance
5. Novas funcionalidades

---

## Importante

Se houver dúvida sobre alguma regra de negócio, consultar a documentação antes de implementar.


## Regras de Consumo de Contexto

- Nunca listar o projeto inteiro de forma recursiva.
- Nunca abrir `node_modules`, `.git`, `dist`, `build`, `.venv`, `venv`, `__pycache__` ou arquivos gerados.
- Para entender a estrutura do projeto, leia sempre `docs/ai-context/project-files-clean.txt`.
- Para tarefas simples, leia no máximo 5 arquivos antes de responder.
- Para tarefas médias, leia no máximo 10 arquivos antes de apresentar plano.
- Nunca procurar arquivos por tentativa e erro sem antes consultar `project-files-clean.txt`.
- O frontend principal está em `apps/web/src`.
- As engines estão em `engines/`.
- A documentação de contexto está em `docs/ai-context/`.
- As SPECS estão em `docs/specs/`.
- Se não encontrar um arquivo, consulte `docs/ai-context/project-files-clean.txt` antes de tentar outro caminho.