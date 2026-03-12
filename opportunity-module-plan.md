# Oportunidades & Formação de Preço

## Goal
Implementar o módulo completo de Oportunidades focado inicialmente no cenário Privado, com suporte a orçamentos em Excel, itens, instalação e manutenção, integrando com o cadastro da empresa e produtos.

## Tasks

### Phase 1: Core & Relational Database
- [ ] Task 1: Criar os modelos SQLAlchemy (`Oportunidade`, `OportunidadeParametrosVenda`, `OportunidadeParametrosLocacao`, `OportunidadeItem`, `OportunidadeItemKit`, `OportunidadeOrcamento`, `OportunidadeOrcamentoItem`, `OportunidadeInstalacao`, `OportunidadeManutencao`) todos amarrados e isolados. → Verify: Alembic gera a migration vazia e `upgrade head` roda sem erros.
- [ ] Task 2: Criar Schemas Pydantic base, Enumerações e Rotas de CRUD exclusivas para o cabeçalho da Oportunidade. → Verify: POST /opportunities cria o registro e já "puxa" PIS/COFINS automático da Empresa raiz.

### Phase 2: Core UI & Abas Dinâmicas
- [ ] Task 3: Desenvolver a tela base de listagem (`OpportunityList`) com filtros e tabela. → Verify: Módulo fica acessível pelo menu lateral e tabela engole os dados de teste.
- [ ] Task 4: Criar o layout da tela de Detalhes (`OpportunityDetails`) contendo o cabeçalho (Status, Cálculos) e estruturar a casca das Abas Dinâmicas que reagem aos inputs booleanos. → Verify: Ao marcar "possui instalação", a respectiva Aba surge instantaneamente em tela.

### Phase 3: Gestão de Itens e Kits
- [ ] Task 5: Implementar CRUD de Itens da Oportunidade com busca Autocomplete de Produto ou Descrição Manual Livre na Aba Equipamentos. → Verify: Item salvo, permitindo adição e remoção fluida.
- [ ] Task 6: Implementar lógicas e tipagens de KITs (pai/filhoc) tanto na API quanto no Frontend grid. → Verify: Abertura em árvore do Kit reflete os equipamentos embutidos.

### Phase 4: Orçamentos e Excel Upload (O Coração)
- [ ] Task 7: Trabalhar no parser de leitura XLSX em Python que desça os dados para `OportunidadeOrcamentoItem`. Embutir fluxo condicional de criar Fornecedor rápido via CNPJ. → Verify: Endpoint consegue receber um multipart file excel pesado sem crashar e preenche as tabelas relativas.
- [ ] Task 8: Criar a UI na Aba Orçamentos para upload do botão, download do modelo template base, e renderização dos itens no grid lateral. → Verify: Após upload, o grid reflete o que tinha no excel real.
- [ ] Task 9: Implementar a complexa lógica visual de "Vínculo 1:1": Drag and drop ou Select interativo ligando Itens do Orçamento -> Itens da oportunidade (bloqueando repetição). E atrelar popup de criação acelerada de Produto faltante. → Verify: Itens casam corretamente e travam re-seleção.

### Phase 5: Serviços e Consolidação
- [ ] Task 10: Finalizar a Aba Instalação e Aba Manutenção condicionando lookups rigorosamente a Produtos `tipo=SERVICO`. → Verify: Fechamento de oportunidade com todos os paineis respondendo e rodando build.

## Done When
- [ ] Fluxo comercial ponta a ponta aplicável perante cliente PRIVADO.
- [ ] BD íntegro com foreign keys bem amarradas e lógicas soft-delete.
- [ ] O Vendedor consegue atrelar cotações de fornecedor em excel sem depender de Nenhuma outra tela do sistema, com cadastro assistido inline.
