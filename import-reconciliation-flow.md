# Importação e Conciliação de Produtos (Refinamentos UI)

## Visão Geral
Atendendo as solicitações para melhorar o fluxo de importação de orçamentos e busca de produtos. O objetivo é permitir que o usuário cadastre novos produtos diretamente a partir da conciliação, tenha um modal de busca avançada ao clicar na lupa, e o template Excel passe a ter a coluna "descrição".

## Tipo de Projeto
WEB

## Critérios de Sucesso
1. **Cadastro de Produto na Conciliação:** Um usuário com um item "não encontrado" consegue iniciar o fluxo de criação de um novo produto sem perder o estado do modal atual.
2. **Modal de Busca Lupa:** Clicar na lupa na tela de conciliação (e na grid manual) abre um modal rico de pesquisa de produtos (com listagem, filtros básicos) ao invés de apenas um autocompletar simples.
3. **Template Excel Atualizado:** O arquivo `modelo_orcamento.xlsx` baixado pelo sistema contém a nova coluna 'descricao' / 'produto'.

## Stack Tecnológico
- React, TailwindCSS, Lucide Icons
- FastAPI / openpyxl (Backend)

## Estrutura de Arquivos
```text
apps/web/src/components/shared/
  ├── ProductSearchModal.tsx       (Novo Modal Global de Busca)

apps/web/src/modules/purchase_budgets/components/
  ├── BudgetReconciliationModal.tsx (Modificado)
  ├── BudgetItemsGrid.tsx           (Modificado)

apps/api/src/modules/purchase_budgets/
  ├── service.py                    (Modificado)
```

## Divisão de Tarefas

### Tarefa 1: Atualização do Parser e Template Excel
**Agente Preferencial:** `backend-specialist`
- **INPUT:** Atualizar lógica em `service.py` para ler iterativamente a coluna `descricao` (ou `produto`) enviada na planilha e atualizar a geração do modelo `modelo_orcamento.xlsx` em `apps/web/public/`.
- **OUTPUT:** Planilha gerada contendo a coluna Description, e retorno do backend contendo esta string para itens `nao_encontrados`.
- **VERIFY:** Baixar a planilha pelo frontend e importar preenchendo a descrição. O modal de conciliação deve exibir a descrição lida.

### Tarefa 2: Criação do Modal Global de Busca de Produtos (LUPA)
**Agente Preferencial:** `frontend-specialist`
- **INPUT:** Criar componente `ProductSearchModal.tsx` recebendo `onSelect(produto)`. Ele deve consumir a rota `GET /cadastro/produtos` possuindo campo de busca, listagem paginada (ou em scroll) e botão "Selecionar".
- **OUTPUT:** Componente reutilizável disponível para o sistema.
- **VERIFY:** Renderizar o modal; testar inserção de texto e confirmação de retorno da API.

### Tarefa 3: Integração do Modal de Busca no Orçamento
**Agente Preferencial:** `frontend-specialist`
- **INPUT:** Substituir a mecânica atual baseada em input-texto com absolute position tanto em `BudgetReconciliationModal.tsx` quanto na célula `ProductSearchCell` do `BudgetItemsGrid.tsx` para acionar via clique na Lupa o novo `ProductSearchModal`.
- **OUTPUT:** Os dois fluxos devem agora abrir o modal ao clicar na lupa.
- **VERIFY:** Clicar na lupa de conciliação; Modal abre. Selecionar produto; Produto é carregado na tela de retaguarda.

### Tarefa 4: Atalho de Cadastro de Produto na Conciliação
**Agente Preferencial:** `frontend-specialist`
- **INPUT:** Adicionar botão `[+] Cadastrar Novo Produto` na tela de `BudgetReconciliationModal.tsx`. Para não perder o contexto da aba/modal, esse botão deverá abrir a rota de `/cadastro/produtos/novo` em uma nova aba (`_blank`) E adicionar um botão de "Atualizar Lista/Busca" para encontrar rapidamente o produto recém-criado, ou renderizar um modal simples de criação rápida (o que for mais adequado com base nos componentes atuais).
- **OUTPUT:** Redirecionamento funcional / Fluxo limpo.
- **VERIFY:** Ter um item não encontrado -> clicar no botão de cadastrar -> cadastrar o produto (em nova guia) -> voltar ao modal -> pesquisar pelo novo nome -> vincular.

## Fase X: Auditoria de Verificação Final
- [ ] Segurança/Lint (API/WEB)
- [ ] Teste Manual do Fluxo Completo de Importação
- [ ] UX Audit (`python .agent/skills/frontend-design/scripts/ux_audit.py .`)
