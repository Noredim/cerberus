# Planejamento: Orçamento de Compra (Purchasing Budgets)

## Overview
Implementação do novo módulo de "Orçamento de Compra" voltado à estruturação de compras, cotações contendo impostos (IPI, ICMS) e custos (CIF/FOB). Suporta inserção massiva por planilha Excel com resolução de conflitos de catálogo (vínculo automático de códigos de fornecedor).

## Project Type
BACKEND e WEB

## Success Criteria
- [ ] Database atualizada e validada via Alembic migration, mantendo integridade com products e empresas.
- [ ] CRUD via FastAPI funcionando para criação de orçamentos e registro de negociações.
- [ ] Importador de Excel processa massivamente e valida produtos x fornecedores com sucesso.
- [ ] UI reflete corretamente as tabelas interativas, com modal intermitente para Cadastro Rápido de Fornecedor e Condições de Pagamento.
- [ ] Aba "Orçamentos" devolvida e integrada de forma sadia no componente de `ProductForm.tsx`.
- [ ] Regras de formação de preço base (último preço atualizado via API/DB trigger) funcionando sem regressions.

## Tech Stack
- Frontend: `React`, `TailwindCSS`, `Vite`, React Router. Fluxos interativos (Independent Fetch).
- Backend: `FastAPI`, `SQLAlchemy`, `Alembic`, File Uploads (`python-multipart`), `openpyxl`.

## File Structure
```text
apps/api/src/modules/purchase_budgets/
  ├── models.py
  ├── schemas.py
  ├── router.py
  ├── services.py
apps/web/src/modules/purchase_budgets/
  ├── BudgetsList.tsx
  ├── BudgetForm.tsx
  ├── components/
  │    ├── BudgetItemsGrid.tsx
  │    ├── BudgetImportModal.tsx
  │    ├── BudgetNegotiationModal.tsx
  │    └── QuickAddSupplierModal.tsx
```

---

## Task Breakdown

### Fase 1: Arquitetura de Banco de Dados
- [x] **Task 1.1: Migrations e Models SQLAlchemy**
  - **Agent**: `backend-specialist` | **Skill**: `database-design`
  - **INPUT**: PRD item 18 (Estrutura de tabelas recomendadas).
  - **OUTPUT**: Script de schema consolidado (`models.py`) que relaciona as foreign keys para produtos, e migration auto-gerada Alembic.
  - **VERIFY**: `alembic upgrade head` completa com sucesso. Nenhuma restrição quebra (Foreign Keys referenciam Supplier e Product corretamente).

### Fase 2: Serviços e Endpoints de API (Backend)
- [x] **Task 2.1: Lógica Base CRUD e Cálculos Nativos**
  - **Agent**: `backend-specialist` | **Skill**: `api-patterns`
  - **INPUT**: Modelo final modelado, regras CIF/FOB (PRD-4) e cálculos de IPI/Frete (PRD-8/9).
  - **OUTPUT**: Módulo REST completo gerando payloads validados no `schemas.py` com rotas protegidas em `router.py`.
  - **VERIFY**: API responde adequadamente às rotas `POST /budgets` processando o IPI internamente de forma exata de acordo com a regra.
- [x] **Task 2.2: Rota de Importação Excel**
  - **Agent**: `backend-specialist` | **Skill**: `data-ingestion-patterns`
  - **INPUT**: Rota que recebe multipart-form data de um `.xlsx`.
  - **OUTPUT**: Função em `services.py` varrendo arquivo e devolvendo Array JSON (itens "encontrados" vs "não-encontrados").
  - **VERIFY**: Enviar uma macro de Excel via script Python local devolve exatamente os arrays filtrados.

### Fase 3: Estruturação Básica do Novo Frontend
- [x] **Task 3.1: Configuração das Páginas e Cabeçalhos**
  - **Agent**: `frontend-specialist` | **Skill**: `frontend-design`
  - **INPUT**: PRD item 3 (Cabeçalho) e PRD 5 (Modal Rápido).
  - **OUTPUT**: Paginação configurada (lista principal de orçamentos) e formulário contendo cabeçalho estrutural em Master-Detail.
  - **VERIFY**: App não crasha ao acessar as rotas (Empty States ok).
- [x] **Task 3.2: Grid Dinâmica e Cálculos React**
  - **Agent**: `frontend-specialist` | **Skill**: `react-best-practices`
  - **INPUT**: Lógica de "total do produto" (PRD-7,8).
  - **OUTPUT**: Componente flexível `BudgetItemsGrid.tsx` implementando *live recalculation* baseado em Frete Customizado do item.
  - **VERIFY**: Modificar % Frete em 1 linha não afeta as demais e totaliza em tempo real.

### Fase 4: Integrações e Regras Complexas Interativas
- [x] **Task 4.1: Importação de Excel e Conciliação Visual**
  - **Agent**: `frontend-specialist` | **Skill**: `ui_component_patterns`
  - **INPUT**: Response do backend dividindo "achados" e "órfãos".
  - **OUTPUT**: Fluxo interativo no modal permitindo ao comprador vincular ID do fornecedor ao produto da DB.
  - **VERIFY**: Processo salva o `produto_codigo_fornecedor` e insere os dados corretamente na tela de edição manual.
- [x] **Task 4.2: Componente de Histórico & Formação de Preço**
  - **Agent**: `frontend-specialist` | **Skill**: `ui_component_patterns`
  - **INPUT**: Requisição atrelada ao último Endpoint (Histórico de Produto).
  - **OUTPUT**: Aba de `Orçamentos` nativa no Componente Pai de Produto (ProductForm.tsx / Aba Pricing).
  - **VERIFY**: Produto reflete `ultimo_preco_compra` após nova negociação salva.

---

## ✅ PHASE X COMPLETE
- Lint: [ ] Pendente
- Security: [ ] Pendente
- Build: [ ] Pendente
- Date: [ ] Pendente
