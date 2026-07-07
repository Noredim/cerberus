# Plano de Implementação — Campo de Despesa Administrativa para Kits de Comodato/Locação

Este plano descreve as modificações necessárias para incluir o campo **Despesa Administrativa (%)** nos kits de oportunidade do tipo "Comodato" e "Locação", usando a mesma métrica da comissão, e ajustar o card simultâneo no frontend para exibir a soma de ambos com um detalhamento via tooltip.

## Visão Geral e Requisitos

1.  **Backend**:
    *   O modelo `OpportunityKit` já possui o campo `perc_despesas_adm` adicionado por migrações anteriores.
    *   No cálculo financeiro (`calculate_financials` em `service.py`), se o tipo de contrato for "COMODATO" ou "LOCACAO", devemos calcular as despesas administrativas upfront como `valor_base_venda * (perc_despesas_adm / 100.0)`.
    *   O valor de despesas administrativas upfront (`valor_despesas_adm_locacao`) deve ser incluído nas somas de investimento total e no denominador do ROI de equipamento, assim como a comissão.
    *   O valor calculado deve ser retornado no sumário financeiro como `valor_despesas_adm_locacao`.

2.  **Frontend**:
    *   Ajustar a inicialização do formulário para carregar a despesa administrativa padrão dos parâmetros de venda da empresa para kits de Comodato/Locação (assim como já faz para Venda de Equipamentos).
    *   Inserir o input de **Despesas Adm. (%)** no formulário na aba de prazos/parâmetros financeiros quando o tipo for Comodato ou Locação.
    *   Renomear o card lateral de **"Comissão (%)"** para **"Desp. Adm"**.
    *   Exibir como valor principal no card a **soma** de `valor_comissao_locacao` + `valor_despesas_adm_locacao`.
    *   Listar no subtítulo do card os percentuais individuais de comissão e despesa administrativa (Ex: `"Comissão: X% | Desp. Adm: Y%"`).
    *   Adicionar um **Tooltip** sobre o card detalhando individualmente os valores monetários de cada um.

---

## Estrutura de Arquivos a Modificar

*   `apps/api/src/modules/opportunity_kits/schemas.py`
*   `apps/api/src/modules/opportunity_kits/service.py`
*   `apps/web/src/modules/opportunity_kits/OpportunityKitForm.tsx`

---

## Detalhamento de Tarefas

### [x] Tarefa 1: Validação de Banco de Dados
*   **Agente**: `database-architect`
*   **Skills**: `database-design`
*   **Prioridade**: P0
*   **Dependências**: Nenhuma
*   **Descrição**: Validar que o campo `perc_despesas_adm` existe e está mapeado corretamente no banco de dados e nenhum script de migração adicional é necessário.
*   **INPUT**: Schema atual do PostgreSQL
*   **OUTPUT**: Confirmação da presença da coluna
*   **VERIFICAÇÃO**: Consulta via script de teste ou log de inicialização do FastAPI.

---

### [x] Tarefa 2: Ajuste no Schema do Backend
*   **Agente**: `backend-specialist`
*   **Skills**: `api-patterns`
*   **Prioridade**: P1
*   **Dependências**: Tarefa 1
*   **Descrição**: Adicionar o campo `valor_despesas_adm_locacao` ao schema de resposta `OpportunityKitFinancialSummary`.
*   **INPUT**: `apps/api/src/modules/opportunity_kits/schemas.py`
*   **OUTPUT**: Schema de sumário modificado
*   **VERIFICAÇÃO**: Carregar o FastAPI e validar se os tipos e schemas OpenAPI do FastAPI refletem a adição do novo campo.

---

### [x] Tarefa 3: Ajuste de Cálculos no Backend
*   **Agente**: `backend-specialist`
*   **Skills**: `clean-code`
*   **Prioridade**: P1
*   **Dependências**: Tarefa 2
*   **Descrição**: Alterar o arquivo `service.py` no módulo de kits para calcular `valor_despesas_adm_locacao` (upfront) usando a mesma lógica da comissão para LOCACAO e COMODATO. Integrar o valor no ROI de equipamento, no investimento total e retornar o campo no sumário.
*   **INPUT**: `apps/api/src/modules/opportunity_kits/service.py`
*   **OUTPUT**: Lógica de cálculo atualizada
*   **VERIFICAÇÃO**: Executar script Python local para gerar preview e verificar se `valor_despesas_adm_locacao` e o ROI estão corretos.

---

### [x] Tarefa 4: Ajuste de Formulário e Card Lateral no Frontend
*   **Agente**: `frontend-specialist`
*   **Skills**: `frontend-design`
*   **Prioridade**: P2
*   **Dependências**: Tarefa 3
*   **Descrição**:
    1. Ajustar o preenchimento de parâmetros de despesa administrativa nos efeitos de inicialização (`OpportunityKitForm.tsx`).
    2. Exibir o campo de input **Despesas Adm. (%)** no formulário para Comodato e Locação.
    3. Renomear o card lateral de comissão para **"Desp. Adm"** e alterar o valor exibido para a soma de `valor_comissao_locacao` + `valor_despesas_adm_locacao`.
    4. Adicionar subtítulo com os respectivos percentuais `%` e um componente `Tooltip` exibindo o detalhamento monetário de cada um (Comissão: R$ X,XX, Desp. Adm: R$ Y,YY).
*   **INPUT**: `apps/web/src/modules/opportunity_kits/OpportunityKitForm.tsx`
*   **OUTPUT**: UI atualizada com novos campos e layout de card
*   **VERIFICAÇÃO**: Executar o build do frontend e inspecionar visualmente e interativamente.

---

### [x] Tarefa 5: Validação Geral e Build de Produção
*   **Agente**: `test-engineer`
*   **Skills**: `webapp-testing`
*   **Prioridade**: P3
*   **Dependências**: Tarefa 4
*   **Descrição**: Garantir que as alterações não introduziram lints ou erros de tipos e que o build compila com sucesso.
*   **INPUT**: Código final do backend e frontend
*   **OUTPUT**: Builds compilados e prontos
*   **VERIFICAÇÃO**: Executar `npm run build` no monorepo e scripts de linter se disponíveis.

---

## ✅ PHASE X COMPLETE
- Lint: Pass
- Build: Success (Frontend npm run build)
- Date: 2026-07-04
