# Opportunity Sales Parameters & UI Polish

## Goal
Adicionar a aba/seção de Parâmetros de Venda na Oportunidade puxando default da Empresa, e refatorar os Modais (como o de Upload) para se adequarem aos Guidelines visuais do projeto.

## Tasks
- [x] Task 1: Criar endpoints CRUD para `OpportunityParametersSales` na API (`services.py` e `router.py`), ligando com a Oportunidade. → Verify: `curl` ou swagger para checar se salva e retorna os parâmetros.
- [x] Task 2: Atualizar os types no Frontend (`types/index.ts`) e hooks (`useOpportunities.ts`) para suportar a carga/update de Parâmetros de Venda. → Verify: Compilação do TypeScript `npm run build`.
- [x] Task 3: Criar componente React `OpportunityParameters.tsx` contendo o form de parâmetros Tributários e de Venda. Embutir regras visuais (`mkp_padrao`, despesas administrativas, impostos). → Verify: Renderiza em tela sem quebrar a aplicação.
- [x] Task 4: Injetar a nova aba "Parâmetros" no `OpportunityForm.tsx` visível apenas quando `isEditing` for true. Ao montar, se os campos estiverem zerados, preencher via Auto-Fill usando os dados da aba "Tributos" da Empresa selecionada. → Verify: Valores populam dinamicamente baseados na Empresa.
- [x] Task 5: Refatorar Design do Modal de Upload em `OpportunityOrcamentos.tsx` utilizando as regras de Design (Web Design Guidelines) - remover bordas esquisitas, usar backdrop claro, sombras suaves e espaçamento adequado. → Verify: Modal abre com um visual limpo e fluido de acordo com o padrão do sistema.

## Done When
- [x] Os parâmetros da venda aparecem após criar a Oportunidade.
- [x] Impostos e indicadores financeiros são puxados da Empresa via perfil tributário.
- [x] Os dados ficam salvos em `opportunity_parameters_sales` de forma rastreável.
- [x] Modal de upload do Excel tem nova interface moderna e aderente aos guidelines UI/UX da aplicação.
