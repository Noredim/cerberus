# PLAN — Flag "Usar Produtos Gerais" em Oportunidades

Adicionar uma flag chamada **USAR PRODUTOS GERAIS** na criação/edição de Oportunidades (`SalesBudget`). Quando marcada, desativa a restrição que limita a busca de produtos aos itens vinculados aos Orçamentos de Compra da Oportunidade, permitindo usar todo o cadastro global de produtos.

## Premissas e Limitações
- Política de execução respeitada:
  - Não utilizar `browser_subagent`.
  - Não executar testes E2E ou validações visuais.
  - Não alterar componentes desnecessários.
  - Implementar diretamente.
- O campo `usar_produtos_gerais` padrão será `False`.

---

## Proposta de Alterações

### Banco de Dados (PostgreSQL + Alembic)
- Criar script de migração Alembic para adicionar a coluna `usar_produtos_gerais` (Boolean, default False) à tabela `sales_budgets`.
- Atualizar a classe `SalesBudget` em `apps/api/src/modules/sales_budgets/models.py`.

### Backend (FastAPI)
- Adicionar a propriedade aos schemas em `apps/api/src/modules/sales_budgets/schemas.py`.
- Atualizar a função de serialização `_budget_to_dict` em `apps/api/src/modules/sales_budgets/router.py`.
- Atualizar métodos `create_budget` e `update_header` em `apps/api/src/modules/sales_budgets/service.py`.
- Atualizar o método `list_products` em `apps/api/src/modules/products/service.py` para ignorar o filtro de orçamentos vinculados se `usar_produtos_gerais` for `True`.

### Frontend (React)
- Atualizar `OpportunityCreateModal.tsx` para exibir a opção "Usar Produtos Gerais" (checkbox) na criação e na edição de cabeçalho.
- Atualizar `SalesBudgetForm.tsx` para carregar, armazenar e passar esse estado ao modal.

---

## Plano de Verificação

### Testes Automatizados
- Executar os testes locais:
  ```bash
  docker compose exec api python test_workflow_oportunidade.py
  ```

### Verificação Manual
- Validar se a flag "Usar Produtos Gerais" salva corretamente no banco de dados e se os produtos globais aparecem na busca quando ativada.
