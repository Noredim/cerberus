# Planejamento: Inputs Agnósticos de Máscaras (NCM, CPF, CNPJ)

Este plano foi criado pelo agente **project-planner** como parte do fluxo de Orquestração. Ele descreve a arquitetura para garantir que o sistema processe CNPJ, CPF e NCM independentemente da presença de pontos, traços ou barras nas requisições.

## Estratégia Principal
Utilizar o backend (FastAPI/Pydantic) como o guardião central. Quando uma string chega ao servidor mascarada (`12.345.678/0001-90`), o backend limpa automaticamente antes da validação principal e armazena apenas dígitos (`12345678000190`). O frontend também manterá máscaras visuais, mas permitirá a colagem de textos variados e buscas tolerantes a pontos.

### 1. Backend: Pydantic Validators (Strippers)
Adicionar `BeforeValidator` ou validadores normais do Pydantic `@field_validator(..., mode='before')` nos schemas de entrada, assegurando que o caracter não numérico seja eliminado nativamente.

- `apps/api/src/modules/companies/schemas.py`: cnpj
- `apps/api/src/modules/suppliers/schemas.py`: cnpj, cpf
- `apps/api/src/modules/customers/schemas.py`: cnpj, cpf
- `apps/api/src/modules/products/schemas.py` / `ncm/schemas.py`: ncm_codigo, condicoes.ncm_incluir

### 2. Backend: Serviços de Busca (Query API)
As rotas `GET` que permitem buscar CNPJs, CPFs ou NCMs passados como `Query` string (`?q=...` ou `?cnpj=...`) precisam normalizar a busca para bater com o banco.

- **Companies / Customers / Suppliers**: Normalizar `q` (se assemelhar a documento) ou parâmetro `cnpj`/`cpf` antes de buscar.
- **NCM / Benefícios**: Garantir que as buscas GET por `ncm_codigo` removam pontos.

### 3. Frontend: Experiência do Usuário (UI/UX)
Os componentes visuais não devem bloquear ou "travar" a digitação de uma colagem (`Ctrl+V`) que venha com pontos, e as buscas devem permitir digitar a máscara. Ajustar regex de Replace no frontend onde necessário para deixar fluir os pontos pro backend (ou limpar no onChange).
