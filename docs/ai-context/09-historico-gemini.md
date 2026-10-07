# Histórico de Sessões & Contexto — 07/10/2026

## Sessão: Integração Inside ERP (Estoque em Tempo Real) & Conciliação em Lote

### 1. Contexto e Objetivos
- Integrar a nova API de Consulta de Estoque e Custos em Tempo Real do Inside ERP (`http://186.231.9.44:44923/api/consulta-produto`) com autenticação `X-API-KEY`.
- Permitir configuração dinâmica dos 3 ambientes (Serviços, Produtos, Estoque) no cadastro de Empresas.
- Criar a aba "Inside" no cadastro de produtos para visualização do status de integração, data da última sincronização, saldo e custos.
- Priorizar o custo do Inside como custo base nos kits de oportunidade e orçamentos (sem incidência de ST ou DIFAL no custo inicial).
- Criar tela de Conciliação e Correlação com seleção múltipla, vinculação em lote e exibição ampla de nomes/descrições.
- Solucionar os erros de 502 Bad Gateway e 500 decorrentes do deploy de produção.
- Extrair a listagem alfabética de produtos da Empresa 02 (STELSEG).

### 2. Entregas Realizadas
- **Backend:**
  - `InsideEstoqueClient` em `apps/api/src/modules/integrations/inside/client.py`.
  - Métodos `consultar_estoque_realtime`, `sync_product_stock`, `get_correlation_analysis`, `auto_link_exact`, `batch_link_products`, `import_product_from_inside` em `service.py`.
  - Migrações Alembic `a1b2c3d4e5ff`, `a1b2c3d4e600` e `a1b2c3d4e601`.
- **Frontend:**
  - `ProductInsideTab.tsx` no cadastro de produto (`/cadastro/produtos/editar/:id`).
  - `ProductInsideCorrelationModal.tsx` com seleção múltipla, checkboxes, "Selecionar Todos", botão de vinculação em lote e descrições sem truncamento.
  - Atualização de `InsideIntegrationTab.tsx` com o Ambiente C.
- **Auditoria / Relatórios:**
  - `stelseg_produtos_inside.md` contendo todos os 697 produtos da Empresa 02 ordenados de A a Z com saldo e custos.

### 3. Comandos de Produção
Para atualizar novas alterações no servidor:
```bash
git pull origin new_opt
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build web api
docker compose -f docker-compose.prod.yml --env-file .env.prod exec api alembic upgrade head
docker compose -f docker-compose.prod.yml --env-file .env.prod restart gateway
```
