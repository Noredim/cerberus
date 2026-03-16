# PRD — Módulo de Orçamento de Compra

**Sistema:** Cerberus ERP
**Módulo:** Compras / Formação de Custo
**Tela:** Cadastro de Orçamento de Fornecedor

## 1. OBJETIVO DO MÓDULO
Permitir o registro estruturado de orçamentos de fornecedores contendo produtos, impostos e condições comerciais, possibilitando:
- Cálculo correto do custo de aquisição
- Histórico de negociação de preços
- Atualização automática do custo de produtos
- Suporte à formação de preço de venda

O orçamento poderá ser lançado:
1. **Manualmente** produto por produto
2. **Por importação** via Excel

Após salvo, o orçamento passa a compor o histórico de custos do produto.

## 2. ESTRUTURA DA TELA
A tela será dividida em 4 blocos principais
1. Cabeçalho do Orçamento
2. Entrada de Produtos
3. Grid de Produtos
4. Negociação de Orçamento

## 3. CABEÇALHO DO ORÇAMENTO
Campos obrigatórios e opcionais.

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | --- | --- |
| Fornecedor | Select | Sim | Lista de fornecedores cadastrados |
| Cadastrar fornecedor | Botão | — | Abre modal para cadastro rápido |
| Data do orçamento | Date | Sim | Data de emissão do orçamento |
| Validade do orçamento | Date | Não | Prazo de validade |
| Nome do vendedor | Texto | Não | Nome do vendedor do fornecedor |
| Telefone do vendedor | Texto | Não | Telefone |
| Email do vendedor | Texto | Não | Email |
| Condição de pagamento | Select | Sim | Lista da tabela de condições |
| Cadastrar condição | Botão | — | Abre cadastro sem sair da tela |
| Tipo de orçamento | Select | Sim | Revenda / Ativo imobilizado |
| Frete | Select | Sim | CIF ou FOB |
| % Frete | Decimal (2) | Condicional | Apenas se FOB |
| IPI já calculado | Checkbox | Não | Define lógica de cálculo |

## 4. REGRAS DO FRETE
**CIF**
Frete por conta do remetente.
- `fretePercent = 0`
- `freteValor = 0`

**FOB**
Frete por conta do destinatário.
Campo habilitado: `% frete`
Frete unitário calculado:
`valorFrete = valorProdutoUnit * (fretePercent / 100)`

## 5. MODAL DE CADASTRO RÁPIDO
Deve permitir cadastro sem sair da tela de orçamento.

**Fornecedor**
Campos mínimos: Razão social, CNPJ, Nome fantasia, Telefone, Email.
Após salvar, retorna automaticamente ao orçamento.

**Condição de pagamento**
Tabela: `condicao_pagamento`
Campos: descrição, prazo, parcelas

## 6. FORMAS DE LANÇAMENTO DE PRODUTOS
O sistema terá dois modos de entrada.

**MODO 1 — LANÇAMENTO MANUAL**
Usuário insere produto manualmente.
Campos do formulário de item:

| Campo | Tipo |
| --- | --- |
| Produto | Select |
| Cadastrar produto | botão |
| Código fornecedor | Texto |
| NCM | Texto |
| Valor unitário | Decimal |
| % IPI | Decimal |
| % ICMS | Decimal |

Botão: *Adicionar Item*

## 7. GRID DE PRODUTOS
Após salvar o item ele aparece na grid.
Colunas:
- Código do produto
- Nome do produto
- NCM
- Valor unitário
- % frete
- Valor do frete
- % IPI
- Valor do IPI
- % ICMS
- Total do produto

## 8. REGRAS DE CÁLCULO DO ITEM
**Valor do frete**: `valorFrete = valorUnitario * (fretePercent / 100)`
**Valor do IPI**: `valorIPI = valorUnitario * (ipiPercent / 100)`

**Cálculo do total do item:**
Caso IPI *NÃO* esteja calculado: `totalItem = valorUnitario + valorFrete + valorIPI`
Caso IPI *já* calculado: `totalItem = valorUnitario + valorFrete`

## 9. FRETE PERSONALIZADO POR ITEM
Após salvar o item o usuário pode alterar `% frete` por item.
Regra: `fretePercentItem` = `fretePercentCabecalho` (default). 
Usuário pode alterar. Recalcula automaticamente `valorFreteItem` e `totalItem`.

## 10. ICMS
O campo `% ICMS` NÃO entra no cálculo do orçamento.
Ele é armazenado apenas para cálculo de DIFAL, cálculo de ICMS ST e formação de preço posterior.

## 11. MODO 2 — IMPORTAÇÃO VIA EXCEL
O sistema deve disponibilizar um modelo de planilha.
Campos da planilha: `codigo_fornecedor`, `ncm`, `valor_unitario`, `ipi_percent`, `icms_percent`

**PROCESSO DE IMPORTAÇÃO:**
1. Usuário baixa planilha modelo
2. Preenche itens
3. Importa planilha

Sistema executa para cada linha: procurar produto por `codigo_fornecedor`
**CASO PRODUTO NÃO SEJA ENCONTRADO**
Sistema abre tela de resolução. Opções:
1. Vincular a produto existente
2. Cadastrar novo produto
*Vínculo Automático*: Quando usuário vincular produto, sistema grava `produto_codigo_fornecedor` e `produto_fornecedor_id`. Assim, futuras importações serão automáticas.

## 12. PREENCHIMENTO AUTOMÁTICO DA GRID
Após resolver pendências, sistema popula a grid com os mesmos cálculos do modo manual.

## 13. SALVAMENTO DO ORÇAMENTO
Quando usuário clicar em *Salvar Orçamento*, o sistema:
1. Grava orçamento
2. Grava itens
3. Vincula aos produtos

## 14. HISTÓRICO DE ORÇAMENTO NO PRODUTO
Dentro do cadastro do produto deve existir nova aba chamada **ORÇAMENTOS**.
Campos: fornecedor, data orçamento, valor unitário, frete, ipi, total, condição pagamento.
Esse histórico servirá para formação de preço e análise de custo.

## 15. NEGOCIAÇÃO DO ORÇAMENTO
Após salvar orçamento o usuário pode registrar negociação.
Campos: Data da negociação, % desconto geral.

**DESCONTO POR ITEM**
Se desconto geral não for informado. Usuário pode informar: preço unitário negociado OU % desconto do item.

**REGRA DE CÁLCULO**
Desconto geral: `novoValor = totalItem * (1 - descontoPercent/100)`
Desconto item: `novoValor = totalItem * (1 - descontoItem/100)`

## 16. HISTÓRICO DE NEGOCIAÇÕES
Sistema mantém todas negociações. Porém o sistema considera como vigente: *última negociação salva*.

## 17. ATUALIZAÇÃO DO PRODUTO
Ao salvar negociação: Sistema atualiza no produto: `ultimo_preco_compra`, `data_ultimo_preco`, `fornecedor_ultimo_preco`.

## 18. ESTRUTURA DE TABELAS
- `tabela_orcamentos`: id, fornecedor_id, data_orcamento, validade, vendedor_nome, vendedor_telefone, vendedor_email, condicao_pagamento_id, tipo_orcamento, frete_tipo, frete_percent, ipi_calculado, created_at
- `tabela_orcamento_itens`: id, orcamento_id, produto_id, codigo_fornecedor, ncm, valor_unitario, frete_percent, frete_valor, ipi_percent, ipi_valor, icms_percent, total_item
- `tabela_orcamento_negociacoes`: id, orcamento_id, data_negociacao, desconto_percent, created_at
- `tabela_orcamento_negociacao_itens`: id, negociacao_id, orcamento_item_id, valor_original, desconto_percent, valor_final

## 19. PERMISSÕES
- Administrador: Excluir orçamento, Editar orçamento
- Comprador: Criar orçamento, Importar Excel, Negociar preço
- Fiscal: (Leitura/Visualização)

## 20. BENEFÍCIOS DO MÓDULO
✔ Histórico real de compras
✔ Base de custo confiável
✔ Cálculo automático de preço
✔ Integração com formação de preço
✔ Controle de negociação com fornecedor
