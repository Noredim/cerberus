# Estado Atual — Cerberus

> **Data de Atualização:** 07/10/2026  
> **Status Geral do Sistema:** Estável e Operacional em Produção

---

## 1. Banco de Dados & Migrações (Alembic)
- **Migração `a1b2c3d4e5ff_add_inside_estoque_realtime_configs.py`:** Adiciona campos para o Ambiente C de consulta de estoque e custos em tempo real na tabela `company_inside_configs` (`estoque_base_url`, `estoque_api_key`, `estoque_cod_empresa`, `estoque_tipo_padrao`, `estoque_is_active`).
- **Migração `a1b2c3d4e600_add_inside_product_cache_fields.py`:** Adiciona campos de cache de estoque e custo na tabela `products` (`inside_last_sync_at`, `inside_cached_custo`, `inside_cached_saldo`, `inside_cached_preco`, `inside_cached_raw`).
- **Migração `a1b2c3d4e601_add_permite_venda_express_to_sales_teams.py`:** Adiciona a coluna `permite_venda_express` na tabela `company_sales_teams`.

---

## 2. Backend (FastAPI & Integrações)
- **Módulo Inside ERP (`apps/api/src/modules/integrations/inside`):**
  - Cliente `InsideEstoqueClient` com autenticação `X-API-KEY`.
  - Serviço `InsideIntegrationService` com métodos de consulta em tempo real (`consultar_estoque_realtime`), análise de similaridade e correlação (`get_correlation_analysis`), auto-link 100% (`auto_link_exact`), importação direta (`import_product_from_inside`), sincronização individual (`sync_product_stock`) e vinculação em lote (`batch_link_products`).
  - Endpoints REST disponíveis em `/companies/{company_id}/inside/...`.
- **Regras de Precificação e Custos:**
  - `OpportunityKitService` e `SalesBudgetService` utilizam o custo do Inside (`inside_cached_custo`) como prioridade padrão se o produto estiver atrelado ao Inside (`codigo_service` preenchido).
  - Quando o produto usa custo do Inside, ST e DIFAL de entrada não incidem no custo base (já considerado custo final de almoxarifado).

---

## 3. Frontend (React + Vite + CoreUI Theme)
- **Aba Inside no Cadastro de Produtos (`ProductInsideTab.tsx`):**
  - Exibe badge de status de integração (Integrado / Não Integrado), data da última sincronização, dados em tempo real (Código ERP, Saldo, Custo Médio, Preço Tabela, Tipo de Estoque) e botão para sincronizar no ato.
- **Aba Inside ERP na Empresa (`InsideIntegrationTab.tsx`):**
  - Configuração dos Ambientes A (Serviços), B (Produtos) e C (Estoque/Custos em Tempo Real) com testes de conexão independentes.
- **Modal de Conciliação e Vínculo (`ProductInsideCorrelationModal.tsx`):**
  - Resumo estatístico por faixas de similaridade (Total, Vinculados, Match 100%, Alta 80-99%, Média 50-79%, Baixa 25-49%, Sem Vínculo).
  - Seleção múltipla com checkboxes por linha e botão "Selecionar Todos os Elegíveis".
  - Barra de ação em lote para vincular múltiplos produtos de uma vez (`Vincular Selecionados`).
  - Exibição ampla das descrições completas com tooltips nativos (`title`).

---

## 4. Ambiente de Produção & Infraestrutura
- Gateway Nginx atualizado e roteando requisições para `web` e `api`.
- Migrações sincronizadas na branch `new_opt`.
