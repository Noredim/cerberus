# Plano de Implementação — Despesas Administrativas por Kit no Orçamento de Locação

Este plano descreve as modificações para corrigir a exibição e cálculo de despesas administrativas na tela de Fechamento de Proposta do Orçamento/Proposta de Venda. Atualmente, a barra lateral calcula despesas de forma genérica usando o percentual global da proposta, ignorando se os kits de oportunidade adicionados possuem percentual específico (como `0.00%`).

## Visão Geral e Requisitos

1.  **Backend (Banco de Dados e Schemas)**:
    *   Adicionar as colunas `kit_despesas_adm` e `kit_perc_despesas_adm` ao modelo `RentalBudgetItem`.
    *   Criar e aplicar uma migração Alembic correspondente.
    *   Atualizar schemas de entrada e resposta de itens de orçamento de locação.
    *   Ajustar a rota de serialização e desserialização de itens.

2.  **Backend (Lógica de Serviço)**:
    *   No cálculo de itens de locação (`calculate_rental_item`), utilizar `kit_perc_despesas_adm` (se fornecido) no lugar de `perc_despesa_adm` global para determinar a despesa administrativa unitária.
    *   Persistir corretamente `kit_despesas_adm` e `kit_perc_despesas_adm` ao salvar itens.

3.  **Frontend (React)**:
    *   Capturar e mapear `kit_despesas_adm` e `kit_perc_despesas_adm` da resposta do kit de oportunidade (quando selecionado ou carregado via API).
    *   Na consolidação de totais (`rentalTotals`), calcular a despesa administrativa mensal de cada item baseando-se no `i.kit_perc_despesas_adm` do kit individual, em vez do `percDespesaAdm` genérico do orçamento.
    *   Somar `kit_despesas_adm` ao Capex de investimento do item (de forma análoga à comissão).

---

## Estrutura de Arquivos a Modificar

*   `apps/api/src/modules/sales_budgets/models.py`
*   `apps/api/src/modules/sales_budgets/schemas.py`
*   `apps/api/src/modules/sales_budgets/service.py`
*   `apps/api/src/modules/sales_budgets/router.py`
*   `apps/web/src/modules/sales_budgets/SalesBudgetForm.tsx`

---

## Detalhamento de Tarefas

### [x] Tarefa 1: Atualização do Modelo no Backend e Migração
*   **Agente**: `database-architect`
*   **Skills**: `database-design`
*   **Prioridade**: P0
*   **Dependências**: Nenhuma
*   **Descrição**: Adicionar colunas `kit_despesas_adm` (Numeric) e `kit_perc_despesas_adm` (Numeric) ao modelo `RentalBudgetItem` em `models.py` e gerar script de migração no Alembic.
*   **INPUT**: `apps/api/src/modules/sales_budgets/models.py`
*   **OUTPUT**: Modelo atualizado e arquivo de migração gerado
*   **VERIFICAÇÃO**: Execução de `alembic upgrade head`.

---

### [x] Tarefa 2: Ajuste nos Schemas e Serializadores do Backend
*   **Agente**: `backend-specialist`
*   **Skills**: `api-patterns`
*   **Prioridade**: P1
*   **Dependências**: Tarefa 1
*   **Descrição**: Adicionar os novos campos aos schemas Pydantic de itens (`RentalBudgetItemCreate`, `RentalBudgetItemResponse`) e à lista de campos arredondados.
*   **INPUT**: `apps/api/src/modules/sales_budgets/schemas.py`
*   **OUTPUT**: Schemas atualizados
*   **VERIFICAÇÃO**: Checagem de linter e carregamento OpenAPI.

---

### [x] Tarefa 3: Atualização de Rotas e Mapeamento de Persistência
*   **Agente**: `backend-specialist`
*   **Skills**: `clean-code`
*   **Prioridade**: P1
*   **Dependências**: Tarefa 2
*   **Descrição**: Garantir que as rotas de criação, atualização e busca serializem e desserializem as despesas administrativas dos itens de kit.
*   **INPUT**: `apps/api/src/modules/sales_budgets/router.py` e `apps/api/src/modules/sales_budgets/service.py`
*   **OUTPUT**: Fluxo de persistência atualizado
*   **VERIFICAÇÃO**: Execução de requisição de salvamento/carregamento e verificação dos campos no JSON de retorno.

---

### [x] Tarefa 4: Ajuste na Lógica de Cálculo de Itens no Backend
*   **Agente**: `backend-specialist`
*   **Skills**: `clean-code`
*   **Prioridade**: P1
*   **Dependências**: Tarefa 3
*   **Descrição**: Ajustar o método `calculate_rental_item` para que respeite o percentual do kit se fornecido, e calcular a despesa administrativa do item com base nele.
*   **INPUT**: `apps/api/src/modules/sales_budgets/service.py`
*   **OUTPUT**: Cáculo de despesas por item implementado no backend
*   **VERIFICAÇÃO**: Teste unitário/integrado ou script Python.

---

### [x] Tarefa 5: Ajuste de UI e Consolidação de Totais no Frontend
*   **Agente**: `frontend-specialist`
*   **Skills**: `frontend-design`
*   **Prioridade**: P2
*   **Dependências**: Tarefa 4
*   **Descrição**:
    1. Ajustar o mapeamento de kits carregados e selecionados no `SalesBudgetForm.tsx` para definir `kit_despesas_adm` e `kit_perc_despesas_adm`.
    2. Modificar o bloco de agregação de `rentalTotals` para computar a despesa de cada item baseado no seu percentual específico de kit, se aplicável, e agregar no Capex de investimento.
*   **INPUT**: `apps/web/src/modules/sales_budgets/SalesBudgetForm.tsx`
*   **OUTPUT**: Agrupador recalculando corretamente as despesas e exibindo R$ 0,00 se os kits estiverem zerados.
*   **VERIFICAÇÃO**: Build do frontend e inspecionamento visual dos totais.

---

### [x] Tarefa 6: Validação Geral e Build
*   **Agente**: `test-engineer`
*   **Skills**: `webapp-testing`
*   **Prioridade**: P3
*   **Dependências**: Tarefa 5
*   **Descrição**: Validar integridade dos builds do monorepo.
*   **INPUT**: Código completo
*   **OUTPUT**: builds limpos
*   **VERIFICAÇÃO**: `npm run build` no frontend e checklist geral.

---

## ✅ PHASE X COMPLETE
- Lint: Pass
- Build: Success
- Date: 2026-07-04

---

# Ajustes Adicionais — Despesas e Custos Iniciais (Fase 2)

O usuário solicitou os seguintes ajustes de cálculo e regras para as despesas e custos iniciais:
1. No card **Despesas administrativas**, deve constar apenas o valor de despesas administrativas dos kits do tipo "comodato" ou "locação" (excluindo os de instalação).
2. No card **Custo de aquisição**, deve ser trazido o valor de despesas administrativas dos kits do tipo "apenas instalação" para compor os custos iniciais.

## Detalhamento de Novas Tarefas

### [x] Tarefa 7: Ajustes nos acumuladores de rentalTotals (Frontend)
*   **Agente**: `frontend-specialist`
*   **Prioridade**: P1
*   **Descrição**:
    *   No cálculo de `rentalTotals` para itens do tipo instalação (`i.is_kit_instalacao`), calcular a despesa administrativa do item e acumulá-la em `t.despAdmInstalacaoTotal`, mas **não** em `t.despAdmTotal`.
    *   No cálculo de `t.investimento`, adicionar a despesa administrativa do kit (`despAdmItem`) **apenas** quando for um kit de instalação (`i.is_kit_instalacao` é verdadeiro).
    *   No card de exibição "Despesas Adm.", alterar o valor principal exibido para mostrar apenas `rentalTotals.despAdmTotal`.
*   **INPUT**: `apps/web/src/modules/sales_budgets/SalesBudgetForm.tsx`
*   **OUTPUT**: UI exibindo valores corretos nos cards
*   **VERIFICAÇÃO**: Build do frontend e inspecionamento visual dos totais.

---

### [x] Tarefa 8: Inclusão de Despesas Adm. no Cálculo de Retorno Mensal do Payback
*   **Agente**: `frontend-specialist`, `backend-specialist`
*   **Prioridade**: P1
*   **Descrição**:
    *   No frontend, atualizar a definição de `divisorBase` e `divisorDiretor` em `SalesBudgetForm.tsx` para subtrair `despAdmMensalTotal` (despesa administrativa recorrente mensal dos kits de locação/comodato) do faturamento locação mensal.
    *   Atualizar os tooltips correspondentes ("Cálculo do Payback" e "Cálculo do Payback (Diretoria)") para exibir a linha dedutiva das despesas administrativas mensais.
    *   No backend, atualizar `generate_svg_cashflow_chart` no módulo `reports.py` para receber as despesas administrativas mensais e deduzi-las da rentabilidade mensal do cashflow e do payback dos relatórios PDF.
*   **INPUT**: `apps/web/src/modules/sales_budgets/SalesBudgetForm.tsx` e `apps/api/src/modules/sales_budgets/reports.py`
*   **OUTPUT**: Payback considerando custos de despesas administrativas recorrentes
*   **VERIFICAÇÃO**: Build e checagens gerais.

---

# Ajustes Adicionais — Detalhamento do Tooltip de Despesas Adm. (Fase 3)

O usuário solicitou que o tooltip do card de Despesas Adm. passe a detalhar o valor mensal e o valor total.

## Detalhamento de Novas Tarefas

### [x] Tarefa 9: Atualização do Tooltip de Despesas Adm. (Frontend)
*   **Agente**: `frontend-specialist`
*   **Prioridade**: P1
*   **Descrição**:
    *   No frontend, alterar o Tooltip do card "Despesas Adm." em `SalesBudgetForm.tsx` para exibir separadamente "Despesa Adm. Mensal" (`rentalTotals.despAdmMensalTotal`) e "Despesa Adm. Total" (`rentalTotals.despAdmTotal`).
*   **INPUT**: `apps/web/src/modules/sales_budgets/SalesBudgetForm.tsx`
*   **OUTPUT**: Tooltip exibindo detalhamento mensal e total
*   **VERIFICAÇÃO**: Build do frontend.

---

# Ajustes Adicionais — Alinhamento de Payback no PDF (Fase 4)

O cálculo do Payback do relatório PDF estava divergindo do Payback de Diretoria do frontend.

## Detalhamento de Novas Tarefas

### [x] Tarefa 10: Alinhamento de Payback no PDF e Persistência de Despesas Adm.
*   **Agente**: `backend-specialist`, `frontend-specialist`
*   **Prioridade**: P1
*   **Descrição**:
    *   No frontend, incluir `kit_despesas_adm` e `kit_perc_despesas_adm` no payload enviado para o backend durante o `handleSave` de itens de locação.
    *   No backend (`reports.py`), adicionar um fallback dinâmico para `desp_adm_mensal` e `desp_adm_inst` a partir de `kit_financials_summary` quando `kit_despesas_adm` estiver `None` no banco de dados.
*   **INPUT**: `apps/web/src/modules/sales_budgets/SalesBudgetForm.tsx`, `apps/api/src/modules/sales_budgets/reports.py`
*   **OUTPUT**: Payback do PDF idêntico ao Payback de Diretoria
*   **VERIFICAÇÃO**: Rebuild das imagens e execução das checagens gerais.

---

# Ajustes Adicionais — Tooltips de Totais de Diretoria (Fase 5)

O usuário solicitou a inclusão de Tooltips explicativos para os campos de Total de Faturamento e Total de Custos na Consolidação de Diretoria, além de incluir as despesas administrativas no total de custos.

## Detalhamento de Novas Tarefas

### [x] Tarefa 11: Implementação de Tooltips e Ajuste de Total de Custos (Frontend)
*   **Agente**: `frontend-specialist`
*   **Prioridade**: P1
*   **Descrição**:
    *   No frontend (`SalesBudgetForm.tsx`), envolver o "Total de Faturamento" e "Total de Custo" da Consolidação da Diretoria em Tooltips explicativos.
    *   No Tooltip de custo, detalhar a soma: `Aquisição + impostos + operacionais + desp. administrativas`.
    *   Atualizar o valor exibido do custo total para incluir `rentalTotals.despAdmTotal`.
*   **INPUT**: `apps/web/src/modules/sales_budgets/SalesBudgetForm.tsx`
*   **OUTPUT**: Tooltips interativos e custo total correto
*   **VERIFICAÇÃO**: Build do frontend.

---

# Ajustes Adicionais — Correção da Duplicação de Despesa Adm. Instalação no Capex (Fase 6)

O valor de `despAdmInstalacaoTotal` estava sendo somado duas vezes no `capexTotal` na Consolidação de Diretoria.

## Detalhamento de Novas Tarefas

### [x] Tarefa 12: Correção do capexTotal (Frontend)
*   **Agente**: `frontend-specialist`
*   **Prioridade**: P1
*   **Descrição**:
    *   No frontend (`SalesBudgetForm.tsx`), remover a adição redundante de `rentalTotals.despAdmInstalacaoTotal` na declaração de `capexTotal` na Consolidação de Diretoria, visto que esse valor já está contido em `rentalTotals.investimento`.
*   **INPUT**: `apps/web/src/modules/sales_budgets/SalesBudgetForm.tsx`
*   **OUTPUT**: capexTotal calculado corretamente sem valores duplicados
*   **VERIFICAÇÃO**: Build do frontend.

---

# Ajustes Adicionais — Inclusão de Despesa Adm. Instalação no Investimento/Custo Total do Relatório PDF (Fase 7)

O valor do totalizador de investimento total (`custo_total_projeto`) do relatório Approval de Venda em PDF não estava somando a despesa administrativa de aquisição (`desp_adm_instalacao_total`).

## Detalhamento de Novas Tarefas

### [x] Tarefa 13: Inclusão de desp_adm_instalacao_total no custo_total_projeto (Backend)
*   **Agente**: `backend-specialist`
*   **Prioridade**: P1
*   **Descrição**:
    *   No backend (`reports.py`), adicionar `desp_adm_instalacao_total` ao cálculo de `custo_total_projeto`.
*   **INPUT**: `apps/api/src/modules/sales_budgets/reports.py`
*   **OUTPUT**: Custo total do projeto no PDF correspondente ao totalizador da tela e correto
*   **VERIFICAÇÃO**: Rebuild do backend e testes manuais.

