# PLANO TÉCNICO: Correlacionamento de Estoques Multi-Empresa ERP (Stelseg Secundário & Stelmat Novos), Serviços e Regra de Equipes

> **Data de Criação:** 12/10/2026  
> **Status:** Pronto para Execução  
> **Prioridade:** P0 (Estabilidade, Rastreabilidade e Performance em Produção)

---

## 1. Visão Geral e Objetivos de Negócio

Integrar e correlacionar de forma contínua e automatizada os estoques do **Inside ERP** com o **Cerberus**, contemplando:
1. **Empresa 02 (Stelseg Tecnologia):** Tipo de estoque prioritário `ESTOQUE SECUNDARIO` (codEstoque: `10`, ~252 itens).
2. **Empresa 01 (Stelmat Teleinformática):** Tipo de estoque `NOVOS` (codEstoque: `1`, ~645 itens).
3. **Serviços do ERP (Ambiente A):** Cadastrados diretamente no módulo de Produtos com categoria `"SERVIÇOS ERP"` e tipo `"SERVICO"`, usando custo final do ERP.
4. **Criação Automática com Fallback de Itens Inexistentes:** Itens presentes no ERP que não existirem no Cerberus serão criados automaticamente com categoria `"PRODUTOS ERP"`, gerando SKU único e herdando marcas/fabricantes identificados.
5. **Regra de Equipe Comercial (`utiliza_apenas_itens_erp`):**
   - Flag no cadastro de equipes (`company_sales_teams`).
   - Quando ativada, bloqueia a seleção de kits e produtos sem correlação ERP.
   - Para equipe **Stelseg**, prioriza o estoque secundário (Empresa 02).
   - Para equipe **Stelmat**, restringe a produtos com posição na Empresa 01 tipo novos.
   - Quando desativada, mantém integralmente o fluxo normal do Cerberus.
6. **Custo Puro de Entrada:** Itens com correlação ERP têm seus custos tratados como valor final líquido, isentos de acréscimo de impostos de compra (ST, DIFAL, frete de entrada, IPI) na formação de preço.
7. **Autonomia via Interface do Usuário:** Botões e painéis para acionar e monitorar a sincronização diretamente no Frontend, sem necessidade de comandos via terminal em produção.

---

## 2. Modelagem de Dados & Migração (Database Architect)

### 2.1 Nova Tabela `product_inside_stocks`
Permite armazenar N posições de estoque simultâneas por produto sem sobrescrever dados entre empresas.

| Coluna | Tipo | Restrições / Detalhes |
|---|---|---|
| `id` | UUID | PK, default `uuid.uuid4` |
| `product_id` | UUID | FK `products.id` ON DELETE CASCADE, indexado |
| `empresa_erp` | String(50) | `'1'` (Stelmat), `'2'` (Stelseg) |
| `tipo_estoque` | String(50) | `'NOVOS'`, `'ESTOQUE SECUNDARIO'`, etc. |
| `cod_estoque` | String(50) | Código do estoque no Inside (`'1'`, `'10'`) |
| `cod_produto_erp` | Integer | Código do produto no Inside ERP, indexado |
| `saldo` | Numeric(15, 4) | Saldo atualizado de estoque |
| `custo` | Numeric(15, 4) | Custo contábil/médio do almoxarifado |
| `preco` | Numeric(15, 4) | Preço de tabela |
| `last_sync_at` | DateTime(tz) | Timestamp da última atualização |
| `raw_data` | JSONB | Payload completo retornado pela API |

*Constraint Única:* `uq_product_inside_stock_emp_tipo (product_id, empresa_erp, tipo_estoque)`.

### 2.2 Alteração na Tabela `company_sales_teams`
* Adicionar coluna `utiliza_apenas_itens_erp: Boolean, default=False, nullable=False`.

### 2.3 Migração Alembic
* Arquivo: `a1b2c3d4e602_add_inside_multi_stock_and_team_erp_flag.py`
* Revises: `a1b2c3d4e601`

---

## 3. Backend: Serviços e Endpoints (Backend Specialist)

### 3.1 Módulo `InsideIntegrationService`
1. **Método `sync_all_erp_stocks(db, company_id, user_id)`:**
   - **Fase A (Stelseg - Secundário):** Consulta `/api/consulta-produto` com `empresa='2'` e `tipoEstoque='ESTOQUE SECUNDARIO'`.
     - Correlaciona por código Inside ou nome similar (>= 85%).
     - Se existir: upsert em `product_inside_stocks`.
     - Se não existir: cria `Product` no Cerberus com categoria `"PRODUTOS ERP"`, tipo `"EQUIPAMENTO"`, SKU gerado, marca/fabricante extraídos, e vincula a `product_inside_stocks`.
   - **Fase B (Stelmat - Novos):** Consulta `/api/consulta-produto` com `empresa='1'` e `tipoEstoque='NOVOS'`.
     - Correlaciona no catálogo do Cerberus (incluindo os itens criados na Fase A).
     - Se existir: upsert em `product_inside_stocks`.
     - Se não existir: cria `Product` no Cerberus com categoria `"PRODUTOS ERP"`.
   - **Fase C (Serviços ERP):** Consulta `/api/integracoes-terceiros/servicos` (Ambiente A).
     - Correlaciona com `products` onde `tipo == 'SERVICO'` e `codigo_service == item['codServico']` ou nome idêntico.
     - Se não existir: cria `Product` no Cerberus com `tipo = 'SERVICO'`, `categoria = 'SERVIÇOS ERP'`, `inside_cached_custo = item['custo']`, `inside_cached_preco = item['valorUnitario']`.
2. **Método `get_multi_stock_summary(db, company_id)`:**
   - Retorna estatísticas agregadas (Total ERP por empresa/tipo, Total Vinculados, Total com Saldo > 0, etc.) para exibição na UI.

### 3.2 Regras de Seleção em Kits e Orçamentos
1. **`ProductService.list_products`:**
   - Receber parâmetro opcional `sales_team_id: Optional[UUID]`.
   - Se a equipe possuir `utiliza_apenas_itens_erp == True`:
     - Filtra produtos que tenham correlação ERP na `product_inside_stocks` ou `codigo_service != None`.
     - Se equipe pertencer a Stelseg: prioriza/filtra correlação com `empresa_erp == '2'`.
     - Se equipe pertencer a Stelmat: filtra correlação com `empresa_erp == '1'` e `tipo_estoque == 'NOVOS'`.
2. **`OpportunityKitService.list_kits`:**
   - Se `sales_team_id` possuir `utiliza_apenas_itens_erp == True`:
     - Filtra os kits verificando se **todos** os itens de produto (`OpportunityKitItem`) possuem correlação ERP. Se um kit contiver itens não correlacionados, ele é omitido da lista para essa equipe.
3. **Engines de Custo e Orçamento:**
   - Garantir que itens com correlação ERP utilizem o custo exato do estoque da empresa da proposta (Stelseg Secundário para Stelseg, Stelmat Novos para Stelmat) e isentem ST/DIFAL/IPI de entrada.

### 3.3 Endpoints REST (`router.py`)
* `POST /companies/{company_id}/inside/sync-multi-stock`: Dispara a rotina de sincronização e correlação completa.
* `GET /companies/{company_id}/inside/multi-stock-summary`: Retorna o panorama atual de estoques correlacionados.

---

## 4. Frontend: Interface de Usuário & Experiência (Frontend Specialist & CoreUI Theme)

1. **Cadastro de Equipes de Venda (`SalesTeamsTab.tsx` / `SalesTeamModal.tsx`):**
   - Campo switch / checkbox: **"Utiliza Apenas Itens ERP"**.
   - Descrição auxiliar intuitiva e badges visuais na tabela de equipes ("Somente ERP").
2. **Painel de Sincronização de Estoques (`InsideMultiStockPanel.tsx`):**
   - Integrado na aba **Inside ERP** da Empresa e acessível também em Catálogo > Produtos.
   - Cards com indicadores visuais:
     - 🏢 **Stelseg (Empresa 02 - Estoque Secundário):** Total ERP, Vinculados Cerberus, Itens com Saldo.
     - 🏢 **Stelmat (Empresa 01 - Estoque Novos):** Total ERP, Vinculados Cerberus, Itens com Saldo.
     - ⚙️ **Serviços ERP:** Total ERP, Cadastrados no Cerberus.
   - Botão de ação primário: `[Sincronizar e Correlacionar Estoques ERP]` com feedback de carregamento e relatório de itens criados/atualizados.
3. **Modal de Busca de Produtos (`ProductSearchModal.tsx`):**
   - Respeita o contexto da equipe ativa ou orçamento, filtrando automaticamente itens elegíveis quando a flag estiver ativa.
   - Exibe pill/badge com o saldo em estoque (ex: `Stelseg Sec: 5 un` | `Stelmat Novos: 12 un`).

---

## 5. Roteiro de Execução Passo a Passo

- [ ] **Etapa 1:** Criar e executar a migration Alembic `a1b2c3d4e602`.
- [ ] **Etapa 2:** Atualizar modelos SQLAlchemy (`Product`, `ProductInsideStock`, `SalesTeam`).
- [ ] **Etapa 3:** Implementar métodos de sincronização multi-empresa e serviços no `InsideIntegrationService`.
- [ ] **Etapa 4:** Implementar as regras de filtro por equipe em `ProductService` e `OpportunityKitService`.
- [ ] **Etapa 5:** Criar os endpoints na API e validar com testes automatizados / script de verificação.
- [ ] **Etapa 6:** Atualizar componentes do Frontend (flag na equipe, painel de sincronização, badge de saldo na busca).
- [ ] **Etapa 7:** Executar a sincronização da base real em homologação/local e conferir dados.
