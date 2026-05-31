# Planejamento: Formas de Pagamento e Planejamento Financeiro

Módulo de cadastro de condições comerciais dinâmicas e geração automática de previsões financeiras no Cerberus.

---

## Project Type
**WEB** (FastAPI backend + React Vite frontend)

---

## Success Criteria
1. Possibilidade de cadastrar formas de pagamento com parcelas dinâmicas (intervalos de dias e distribuição por percentual, rateio igual ou valor fixo).
2. Validação rigorosa na soma de percentuais (deve ser exatamente 100%) e na soma de valores fixos.
3. Geração automática de parcelas em tempo real no frontend para fins de simulação e visualização pelo usuário.
4. Geração automática de registros na tabela `planejamento_financeiro` após salvar Oportunidades ou Orçamentos de Compras.
5. Recálculo das datas e valores do planejamento ao alterar a data inicial ou o valor total da operação de origem.
6. Bloqueio de exclusão para formas de pagamento vinculadas a registros no sistema (permitindo apenas inativação).

---

## Tech Stack
* **Backend**: FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2
* **Frontend**: React, TypeScript, Tailwind CSS, Lucide React
* **Database**: PostgreSQL 15

---

## File Structure

```plaintext
apps/api/src/
├── modules/
│   ├── payment_methods/
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── service.py
│   │   └── router.py
│   ├── sales_budgets/
│   │   ├── models.py       # Modificado (relacionamento forma_pagamento)
│   │   └── service.py      # Modificado (gatilho de planejamento)
│   └── purchase_budgets/
│       ├── models.py       # Modificado (relacionamento forma_pagamento)
│       └── service.py      # Modificado (gatilho de planejamento)
alembic/versions/
└── xxxx_add_payment_methods_and_planning.py  # Nova migration

apps/web/src/
├── modules/
│   ├── payment_methods/
│   │   ├── FormasPagamentoList.tsx           # Nova tela de listagem
│   │   ├── FormasPagamentoForm.tsx           # Nova tela de cadastro/edição
│   │   └── components/
│   │       └── InstallmentsGrid.tsx          # Componente de grid dinâmico
│   ├── sales_budgets/
│   │   └── SalesBudgetForm.tsx               # Modificado (seleção e grid de parcelas)
│   └── purchase_budgets/
│       └── BudgetForm.tsx                    # Modificado (seleção e grid de parcelas)
└── components/layout/
    └── Sidebar.tsx                           # Modificado (link no menu)
```

---

## Task Breakdown

### Phase 1: Foundation (Database & Base Config)

#### Task 1.1: Database Migration
* **Agent**: `database-architect`
* **Skill**: `database-design`
* **Priority**: P0
* **Dependencies**: None
* **INPUT**: Definição das tabelas `formas_pagamento`, `formas_pagamento_parcelas` e `planejamento_financeiro`.
* **OUTPUT**: Nova migration gerada pelo Alembic e aplicada com sucesso.
* **VERIFY**: Executar a migration e validar a existência das novas tabelas no banco de dados.

### Phase 2: Core Backend Logic (API & Service)

#### Task 2.1: Payment Methods CRUD
* **Agent**: `backend-specialist`
* **Skill**: `python-patterns`
* **Priority**: P1
* **Dependencies**: Task 1.1
* **INPUT**: Definição de rotas, Pydantic schemas e CRUD para `formas_pagamento` e `formas_pagamento_parcelas`.
* **OUTPUT**: Novo módulo `payment_methods` no FastAPI com endpoints ativos.
* **VERIFY**: Testar requisições GET, POST, PUT e DELETE usando testes de API locais.

#### Task 2.2: Financial Planning Logic (Cálculo e Geração)
* **Agent**: `backend-specialist`
* **Skill**: `clean-code`
* **Priority**: P1
* **Dependencies**: Task 2.1
* **INPUT**: Lógica de cálculo de parcelas (dias e valores) com arredondamento na última parcela.
* **OUTPUT**: Funções em `service.py` para calcular parcelamento e inserir no banco.
* **VERIFY**: Testes unitários passando para cenários de percentual (somando 100%), rateio igual (com resto) e valor fixo.

#### Task 2.3: Opportunity & Purchase Budget Hooks
* **Agent**: `backend-specialist`
* **Skill**: `python-patterns`
* **Priority**: P1
* **Dependencies**: Task 2.2
* **INPUT**: Integração com os módulos `sales_budgets` e `purchase_budgets` para registrar vencimento inicial e forma de pagamento.
* **OUTPUT**: Planejamentos financeiros criados automaticamente na persistência das compras/vendas.
* **VERIFY**: Criar compras/vendas de teste e verificar a persistência correta em `planejamento_financeiro`.

### Phase 3: Frontend Interface (UI/UX)

#### Task 3.1: Sidebar Navigation
* **Agent**: `frontend-specialist`
* **Skill**: `frontend-design`
* **Priority**: P2
* **Dependencies**: None
* **INPUT**: Link no Sidebar em "Cadastros → Financeiro → Formas de Pagamento".
* **OUTPUT**: Sidebar atualizada.
* **VERIFY**: Visualizar link no menu e rota ativa.

#### Task 3.2: Payment Methods CRUD Screen
* **Agent**: `frontend-specialist`
* **Skill**: `frontend-design`
* **Priority**: P2
* **Dependencies**: Task 2.1
* **INPUT**: Telas de listagem e formulário com grid dinâmico de parcelas.
* **OUTPUT**: Páginas `FormasPagamentoList` e `FormasPagamentoForm` funcionais e responsivas.
* **VERIFY**: Cadastrar, editar e visualizar formas de pagamento de teste na UI.

#### Task 3.3: Integration in Forms (Opportunities & Purchases)
* **Agent**: `frontend-specialist`
* **Skill**: `react-best-practices`
* **Priority**: P2
* **Dependencies**: Task 2.3, Task 3.2
* **INPUT**: Seleção da forma de pagamento na tela de Oportunidades (`SalesBudgetForm.tsx`) e Orçamento de Compras (`BudgetForm.tsx`) com grid de parcelamento interativo.
* **OUTPUT**: Integração de parcelas dinâmica nos formulários existentes.
* **VERIFY**: Digitar valor total e data inicial e ver o grid renderizar as parcelas corretas antes de salvar.

### Phase 4: Quality & Testing (QA)

#### Task 4.1: Automated Integration Tests
* **Agent**: `test-engineer`
* **Skill**: `testing-patterns`
* **Priority**: P3
* **Dependencies**: Phase 2, Phase 3
* **INPUT**: Casos de teste para regras de arredondamento, validação de limites de percentual, e fluxo financeiro.
* **OUTPUT**: Testes automatizados executados e passando.
* **VERIFY**: Execução de `pytest` e logs de sucesso.

---

## Phase X: Verification Checklist

### 1. Run Verification Scripts
```bash
# Execução da suíte de testes unitários do backend
pytest apps/api/tests/

# Lint e auditoria de UX
python .agent/scripts/checklist.py .
```

### 2. Rule Compliance (Manual Check)
- [ ] Nenhum código de cor roxo/violeta foi utilizado no CSS do frontend (Purple Ban).
- [ ] O Socratic Gate foi totalmente respeitado e aprovado antes do início da codificação.
- [ ] O planejamento financeiro gerado para Oportunidades gera registros do tipo `RECEBIMENTO`.
- [ ] O planejamento financeiro gerado para Compras gera registros do tipo `PAGAMENTO`.
- [ ] Bloqueio de exclusão em uso verificado no banco e na tela.
