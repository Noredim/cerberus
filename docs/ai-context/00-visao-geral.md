# CERBERUS - VISÃO GERAL DO PROJETO

## Objetivo

O Cerberus é uma plataforma inteligente de engenharia comercial com foco na formação de preço de custo e preço de venda.

O sistema foi concebido para permitir a construção, análise, simulação e auditoria de propostas comerciais complexas, preservando integralmente a memória de cálculo utilizada em cada operação.

---

## Estado Atual

O sistema encontra-se em produção e em evolução contínua.

Novas funcionalidades devem preservar compatibilidade com as regras existentes e evitar alterações destrutivas.

---

## Perfis de Usuário

### Administrador

Responsável pelas configurações gerais, cadastros estruturais e administração do sistema.

### Engenharia de Preço

Responsável pela composição de custos, tributação, políticas comerciais e formação de preço.

### Diretoria

Responsável pela análise estratégica, validações e acompanhamento gerencial.

---

## Módulos Principais

* Segurança
* Cadastro
* Comercial
* Fiscal
* Relatórios
* Configurações

---

## Princípios Fundamentais

O Cerberus foi desenvolvido com base nos seguintes princípios:

### 1. A memória de cálculo nunca deve ser alterada.

Toda operação deve manter rastreabilidade completa dos cálculos realizados.

### 2. Toda formação de preço deve ser auditável.

O sistema deve permitir compreender como qualquer valor foi obtido.

### 3. Nenhum cálculo pode ser realizado sem rastreabilidade.

Todas as informações utilizadas devem possuir origem identificável.

### 4. Toda composição de custo deve ser preservada.

Alterações futuras não devem destruir a estrutura lógica das composições existentes.

### 5. Nenhuma alteração pode quebrar a compatibilidade com propostas já existentes.

O sistema deve priorizar estabilidade e integridade histórica dos dados.

---

## Diretrizes para Agentes de IA

Antes de implementar qualquer funcionalidade, o agente deve compreender o contexto da alteração.

Sempre que possível:

* preservar regras existentes;
* realizar alterações incrementais;
* evitar reescritas desnecessárias;
* manter compatibilidade com o sistema em produção;
* preservar a memória de cálculo e a auditabilidade do sistema.
