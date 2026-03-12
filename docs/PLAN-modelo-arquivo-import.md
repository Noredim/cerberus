# /plan - Novo Modelo de Importação de Orçamentos

## 📌 Context
- **Objetivo:** Refatorar o modelo do arquivo de importação de orçamentos (XLSX) na tela de Oportunidades.
- **Regra:** 1 Arquivo = 1 Fornecedor. A planilha vai conter o nome e CNPJ do fornecedor nas próprias linhas.
- **Colunas Oficiais da Planilha:**
  1. `Nome do fornecedor`
  2. `CNPJ do fornecedor`
  3. `Cód interno do produto`
  4. `Descrição`
  5. `IPI`
  6. `ICMS`
  7. `Valor unitário`
  8. `Unidade`
  9. `NCM`
  10. `Quantidade`

---

## 🗺️ Task Breakdown (Implementação)

### Fase 1: Atualização do Backend (Parser & API)
- [x] **`excel_parser.py`**:
  - Atualizar `EXPECTED_COLUMNS` para buscar as novas colunas.
  - Como as colunas podem ter nomes muito humanizados (ex: "Cód interno do produto"), utilizaremos o `fuzzywuzzy` (que já está implementado no `normalize_header`) para mapeá-las corretamente.
  - Retornar não apenas as linhas, mas também os dados do fornecedor extraídos da 1ª linha válida (Onde `CNPJ` e `Nome` estiverem preenchidos).
- [x] **`services_budget.py`**:
  - Modificar a transação de importação para utilizar o **CNPJ e Nome extraídos da planilha**, em vez dos que vêm do Frontend.
  - Manter a lógica de criação de Fornecedor dinâmico, mas agora consumindo a variável que vem do `parse_budget_excel`.
- [x] **`router.py`**:
  - Refatorar a rota `GET /budgets/template/download` para incluir as 10 novas colunas na 1ª linha. Adicionar uma linha de exemplo com essas 10 colunas.
  - Remover a necessidade de enviar `fornecedor_cnpj` e `fornecedor_nome` do FormData no `POST /{opp_id}/budgets/upload`.

### Fase 2: Atualização do Frontend (UX/UI)
- [x] **`OpportunityOrcamentos.tsx` (Upload Modal)**:
  - Como a planilha agora possui o CNPJ e o Nome do Fornecedor, **remover** os campos de "CNPJ (Opcional)" e "Nome do Fornecedor" da modal de Importar XLSX.
  - Deixar a modal muito mais limpa: O usuário precisará apenas escolher o "Tipo do Orçamento" (Revenda/Ativo) e fazer o upload do arquivo. A planilha fará o resto.
- [x] **`useOpportunities.ts`**:
  - Ajustar a assinatura da função `uploadBudgetExcel` para remover as dependências de CNPJ/Nome manuais.

---

## ✅ Critérios de Validação
1. Ao baixar o modelo, as novas colunas devem aparecer exatamente como solicitado.
2. Ao subir um arquivo na modal simplificada, a Grade de Conferência deve carregar o CNPJ e o Nome extraídos do Excel.
3. Quantidade e NCM devem ser lidos corretamente.
