# Implementação: Parâmetros de Vendas da Empresa

## Goal
Criar uma seção opcional no cadastro de empresas para armazenar parâmetros métricos e percentuais (MKP PADRÃO e Impostos) em uma tabela separada (`1:1`), que atuarão como sugestões editáveis de valores base no futuro motor de precificação.

## Tasks

### Backend (Modelagem & Serviços)
- [ ] Task 1: Criar o modelo `CompanySalesParameter` em `apps/api/src/modules/companies/models.py`. -> Verify: Classe criada mapeando para a tabela `company_sales_parameters` vinculada por `company_id` com deleção em cascata.
- [ ] Task 2: Criar os schemas Pydantic relacionados em `apps/api/src/modules/companies/schemas.py` (`CompanySalesParameterBase`, `Create`, `Update`, `Out`). -> Verify: Validações para campos decimais configuradas.
- [ ] Task 3: Atualizar o arquivo `schemas.py` do company (`CompanyOut`) para incluir o relacionamento `sales_parameters`. -> Verify: Retorno da API da empresa já inclui os parâmetros caso existam.
- [ ] Task 4: Criar funções de serviço no `CompanyService` (`get_sales_parameters`, `upsert_sales_parameters`) para leitura e inserção/atualização. -> Verify: Funções prontas para lidar com a lógica opcional.
- [ ] Task 5: Criar rotas na API em `apps/api/src/modules/companies/router.py` (GET e PUT para `/companies/{id}/sales-parameters`). -> Verify: Testável via curl ou Swagger.
- [ ] Task 6: Gerar migração do Alembic e rodar no banco de dados. -> Verify: Tabela confirmada com as colunas certas no banco com `alembic upgrade head`.

### Frontend (UI & Integração)
- [x] Task 7: Atualizar os types do TypeScript em `apps/web/src/modules/companies/types.ts` para incluir as definições de `SalesParameter`. -> Verify: Sem erros de tipagem no frontend.
- [x] Task 8: Adicionar requisições API (`getSalesParameters`, `upsertSalesParameters`) em `companyApi.ts`. -> Verify: Funções exportadas.
- [x] Task 9: Modificar o `CompanyForm.tsx` adicionando uma nova aba para "Parâmetros de Venda". Desenvolver o formulário incluindo os inputs numéricos/decimais solicitados (MKP, Despesa Administrativa, ICMS, etc) com máscaras/validações simples. -> Verify: A aba aparece e não quebra a tela inicial.
- [x] Task 10: Adicionar lógica de submissão do formulário na aba nova para acionar o PUT do `upsertSalesParameters` apenas quando o usuário preencher dados. -> Verify: Dados são salvos no banco.

## Done When
- [x] Os parâmetros podem ser registrados ou atualizados em uma aba separada de qualquer empresa cadastrada.
- [x] Os dados ficam persistidos na tabela `company_sales_parameters`.
- [x] Formulário visual apresenta os decimais de forma legível.
