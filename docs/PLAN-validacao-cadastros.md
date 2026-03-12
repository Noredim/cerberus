# /plan - Validação e Cadastro Assistido (Orçamentos)

## 📌 Context
- **Objetivo:** Melhorar a UX da importação de orçamentos lidando com Fornecedores e Produtos não cadastrados de forma interativa.
- **Regras Solicitadas:**
  1. **Fornecedor:** Se o CNPJ da planilha não existir, o sistema deve avisar, pedir confirmação e direcionar para a tela de Fornecedores para o cadastro.
  2. **Produto:** Ao usar a ação de criar produto a partir de um item do orçamento (pré-cadastro), o sistema deve abrir a tela do produto para o usuário preencher o que falta.

---

## 🗺️ Task Breakdown (Implementação)

### Fase 1: Fluxo do Fornecedor Ausente (Upload Excel)
- [x] **Backend (`services_budget.py`):**
  - Modificar a lógica do `import_budget_excel`. Em vez de criar um "fornecedor rudimentar" silenciosamente, o sistema deve verificar se ele existe.
  - Se NÃO existir, lançar uma exception customizada ou um `HTTPException(404)` com uma estrutura JSON específica: `{"code": "SUPPLIER_NOT_FOUND", "cnpj": "...", "nome": "..."}`.
- [x] **Frontend (`useOpportunities.ts` & `OpportunityOrcamentos.tsx`):**
  - O hook `uploadBudgetExcel` deve capturar esse erro específico.
  - Na UI, se esse erro ocorrer, exibir um alerta/modal de confirmação (ex: "Fornecedor X não encontrado. Deseja cadastrá-lo agora?").
  - Se o usuário confirmar, redirecioná-lo para a tela de criação de fornecedores passando os dados na URL (ex: `/fornecedores?action=new&cnpj=...&nome=...`).
  - *Detalhe UX:* O arquivo Excel terá que ser importado novamente após o cadastro do fornecedor.

### Fase 2: Fluxo do Produto (Grid de Conferência)
- [x] **Backend (`services_budget.py`):**
  - O endpoint `create_product_from_budget_item` já faz o "pré-cadastro" copiando a descrição, NCM e criando um Produto básico. Devemos garantir que ele retorne o `produto_id` criado dentro do objeto do item de orçamento atualizado, ou retornar o Produto em si (atualmente retorna o `OpportunityBudgetItemOut`, mas precisamos garantir que o frontend saiba qual é o ID do produto criado). A propriedade `produto_id` já existe no item.
- [x] **Frontend (`OpportunityBudgetDetailsModal.tsx`):**
  - Após chamar `handleCreateProduct`, pegar o ID do produto recém criado (extraindo do item atualizado que a API devolve, ou recarregando os itens e pegando).
  - Redirecionar o usuário para a tela de edição do Produto (`/cadastros/produtos/{id}` ou `/products/{id}` dependendo da rota atual do sistema).
  - Abrir isso preferencialmente em uma nova aba (`window.open`), para não perder o contexto da "Grid de Conferência" atual.

---

## 🛑 Socratic Gate
Precisamos de algumas confirmações antes de meter a mão no código:

1. **Fornecedores:** Ao ser redirecionado para cadastrar o fornecedor ausente, o usuário vai sair da tela de oportunidade. Isso significa que ele terá que fazer o upload do Excel novamente depois de salvar o fornecedor. Isso está OK para você? (Alternativa seria abrir um modal flutuante de Fornecedor ali mesmo, mas você mencionou "cadastra na tela de fornecedores").
2. **Produtos:** Ao pré-cadastrar o produto e abri-lo, prefere que abra em uma **Nova Aba** do navegador (para ele não fechar a tela de Orçamentos da oportunidade atual) ou navegue na mesma aba?
