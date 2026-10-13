# Estado Atual — Cerberus

> **Data de Atualização:** 12/10/2026  
> **Status Geral do Sistema:** Estável e Operacional em Produção

---

## 1. Banco de Dados & Migrações (Alembic)
- **Migração `a1b2c3d4e5ff_add_inside_estoque_realtime_configs.py`:** Adiciona campos para o Ambiente C de consulta de estoque e custos em tempo real na tabela `company_inside_configs` (`estoque_base_url`, `estoque_api_key`, `estoque_cod_empresa`, `estoque_tipo_padrao`, `estoque_is_active`).
- **Migração `a1b2c3d4e600_add_inside_product_cache_fields.py`:** Adiciona campos de cache de estoque e custo na tabela `products` (`inside_last_sync_at`, `inside_cached_custo`, `inside_cached_saldo`, `inside_cached_preco`, `inside_cached_raw`).
- **Migração `a1b2c3d4e601_add_permite_venda_express_to_sales_teams.py`:** Adiciona a coluna `permite_venda_express` na tabela `company_sales_teams`.
- **Migração `a1b2c3d4e602_add_inside_multi_stock_and_team_erp_flag.py`:** 
  - Adiciona a tabela `product_inside_stocks` com chave única composta `(product_id, empresa_erp, tipo_estoque)` para armazenar posições simultâneas de estoque (Empresa 01 Novos e Empresa 02 Secundário).
  - Adiciona a flag booleana `utiliza_apenas_itens_erp` na tabela `company_sales_teams`.

---

## 2. Backend (FastAPI & Integrações)
- **Módulo Inside ERP (`apps/api/src/modules/integrations/inside`):**
  - Cliente `InsideEstoqueClient` com suporte a consultas irrestritas multi-empresa e multi-estoque (`empresa_id="TODAS"`, `tipo_estoque="TODOS"`).
  - Sincronização multi-empresa completa em 3 fases (`sync_multi_stock_complete`):
    1. **Empresa 02 (Stelseg Tecnologia):** Estoque secundário (`codEstoque: '10'`) - itens correlacionados e novos criados em `products` sob categoria `"PRODUTOS ERP"`.
    2. **Empresa 01 (Stelmat Teleinformática):** Estoque novos (`codEstoque: '1'`) correlacionados e persistidos em `product_inside_stocks`.
    3. **Serviços ERP (Ambiente A):** Importação de serviços do Inside diretamente na tabela `products` (`tipo='SERVICO'`, `categoria='SERVIÇOS ERP'`), com custo oficial do ERP.
  - Endpoint `POST /companies/{company_id}/inside/sync-multi-stock` e `GET /companies/{company_id}/inside/multi-stock-summary`.
- **Regras de Equipes de Vendas & Catálogo:**
  - `ProductService.list_products` e `OpportunityKitService.list_kits` respeitam `sales_team_id`:
    - Se a equipe possui `utiliza_apenas_itens_erp = True`, apenas produtos e kits com correlação ERP ativa são exibidos.
    - Para equipes com nome "STELSEG", prioriza visualização de estoque Empresa 02 (Secundário).
    - Para equipes com nome "STELMAT", exibe apenas produtos com correlação Empresa 01 (Novos).
    - Se a flag for `False`, permanece o fluxo padrão do sistema sem restrições.
- **Formação de Preço e Custo sem Impostos de Compra:**
  - `calculate_product_cost_composition` e `OpportunityKitService.get_product_info`: produtos importados ou correlacionados com o ERP têm ST, DIFAL, IPI e frete CIF zerados na entrada, utilizando o custo do ERP como custo final líquido de almoxarifado.

---

## 3. Frontend (React + Vite + CoreUI Theme)
- **Aba Equipes de Vendas (`SalesTeamsTab.tsx`):**
  - Toggle e visualização da flag `utiliza_apenas_itens_erp` ("Utiliza Apenas Itens ERP") nos modais de criação/edição e cards das equipes.
- **Painel de Controle Inside ERP (`InsideIntegrationTab.tsx`):**
  - Cards de métricas em tempo real das posições de estoque (Empresa 02 Secundário, Empresa 01 Novos e Serviços ERP).
  - Botão de ação "Sincronizar Estoques Multi-Empresa & Serviços" com relatório detalhado de itens criados e vinculados.
- **Modal de Busca de Produtos (`ProductSearchModal.tsx`):**
  - Suporte ao filtro por equipe `salesTeamId`.
  - Badges visuais de saldo e custo por empresa (`Stelseg Sec` e `Stelmat Novos`) respeitando a regra de Purple Ban.
- **Montagem de Kits (`OpportunityKitForm.tsx`):**
  - Propagação do `salesTeamId` da equipe selecionada para o modal de busca de produtos.

---

## 4. Ambiente de Produção & Infraestrutura
- Gateway Nginx atualizado e roteando requisições para `web` e `api`.
- Migrações sincronizadas e aplicadas no PostgreSQL.
