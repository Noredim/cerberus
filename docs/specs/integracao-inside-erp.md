# ESPECIFICAÇÃO DE INTEGRAÇÃO: CERBERUS ➔ ERP INSIDE (SERVICE ONPREMISES)

> **Status:** Especificado e Planejado (Pronto para Início da Fase 1)  
> **Data de Registro:** 03/10/2026  
> **Escopo:** Módulos de Leads, Oportunidades, Orçamentos, Produtos, Serviços, Profissionais, Formas de Pagamento e Configurações de Empresa.

---

## 1. Visão Geral e Princípios Fundamentais

### 1.1. Regra de Ouro do Isolamento Comercial
1. **Ciclo Comercial 100% no Cerberus:**  
   Captação de leads, distribuição para vendedores, qualificação, dimensionamento técnico, montagem de orçamentos e negociações ocorrem **exclusivamente dentro do Cerberus**. Nenhuma chamada de criação é feita para o Inside durante a fase de prospecção/negociação.
2. **Gatilho Exclusivo no Fechamento:**  
   A integração só é startada no momento exato em que a **Oportunidade for marcada como VENCIDA (Ganha / Won)**.

---

## 2. Visão Técnica da API Inside Service OnPremises

* **Protocolo:** RESTful (JSON) via HTTP(S) - Porta Padrão: `65191`.
* **Autenticação:** Header HTTP obrigatório `Hash: <codigo_hash_gerado>`.
  * *Geração no ERP:* `Suporte > B - Configurações > B - Configurador Geral Complemento > aba Geral > Gerar Hash > Gravar`.
* **Envelope de Retorno:**
  ```json
  {
    "data": { ... },
    "success": true,
    "notifications": [],
    "message": ""
  }
  ```

### Principais Endpoints Mapeados:
1. `GET /api/prospect-mobile/configuracoes?codUnidade={id}`: Consulta atividades, origens, interesses e regras de CPF da unidade.
2. `GET /api/integracoes-terceiros/cliente/consultar-clientes?documento={cpf_cnpj}&codUnidade={id}`: Busca se o cliente já existe no Inside.
3. `POST /api/integracoes-terceiros/prospects/cadastrar-prospect`: Cria o Prospect com dados de contato/endereço (retorna `codProspect`).
4. `POST /api/integracoes-terceiros/orcamento/cadastrar-orcamento`: Cria o Orçamento comercial (retorna `codInternoOrcamento`).
5. `POST /api/integracoes-terceiros/orcamento/produto`: Vincula produtos ao orçamento (`codProduto`, `quantidade`, `unitario`, `cobraLocado`).
6. `POST /api/integracoes-terceiros/orcamento/servico`: Vincula serviços ao orçamento (`codServico`, `quantidade`, `unitario`).
7. `POST /api/integracoes-terceiros/orcamento/gerar-antecipacao`: Registra as duplicatas e parcelas no contas a receber para emissão de NFs e boletos.
8. `GET /api/integracoes-terceiros/forma-pagamento/listar-formas-pagamento`: Lista códigos das formas de pagamento.

---

## 3. Mapeamento de Entidades e Campos de Atrelamento (De-Para)

| Entidade Cerberus | Arquivo no Backend | Campo a Criar no Cerberus | Campo no Inside ERP |
| :--- | :--- | :--- | :--- |
| **Produtos** | `apps/api/src/modules/products/models.py` | `codigo_service` (Integer) | `codProduto` (int) |
| **Serviços Próprios** | `apps/api/src/modules/own_services/models.py` | `codigo_service` (Integer) | `codServico` (int) |
| **Profissionais / Vendedores** | `apps/api/src/modules/professionals/models.py` | `codigo_service` (Integer) | `vendedor` / `codTecnico` (int) |
| **Formas de Pagamento** | `apps/api/src/modules/payment_methods/models.py` | `codigo_service` (Integer) | `formaPagamento` (int) |
| **Clientes** | `apps/api/src/modules/customers/models.py` | `codigo_cliente_service` (Integer) | `codCliente` (int) |
| **Oportunidades / Vendas** | `apps/api/src/modules/leads/models.py` | `inside_prospect_id`, `inside_orcamento_id`, `inside_status` | `codProspect`, `codInterno` |

---

## 4. Plano de Execução em 3 Fases

### 🔹 FASE 1: De-Para, Campos de Atrelamento e Ajustes de Modelos
* **Backend:**
  * Migrations e adição de `codigo_service` em `Product`, `OwnService`, `Professional`, `PaymentMethod`.
  * Atualização dos Schemas Pydantic (`create`, `update`, `response`) em cada módulo.
  * Criação do modelo de configurações `CompanyInsideConfig` para guardar Base URL, Hash Token e defaults por empresa.
* **Frontend:**
  * Inserção dos campos `Cód. Inside (Service)` nos formulários de cadastro:
    * `ProductForm.tsx`
    * `OwnServiceForm.tsx`
    * `ProfessionalsForm.tsx`
    * `PaymentMethodsForm.tsx`
  * Exibição de badges informativos nos dashboards indicando status de vínculo ERP.

### 🔹 FASE 2: Conexão, Ambiente de Testes e Homologação de Oportunidade
* **Backend:**
  * Criação do cliente HTTP isolado (`InsideServiceClient` em `apps/api/src/modules/integrations/inside/`).
  * Rota de Health Check / Teste de Conexão (`GET /test-connection`).
  * Tabela de Log de Auditoria (`IntegrationLog`) com histórico de requisições, payloads e retornos.
* **Frontend:**
  * Painel em *Configurações da Empresa > Integrações > Inside ERP*.
  * Botão **"Testar Conexão"** com validação visual instantânea da URL e Hash.
  * Botão **"Simular Envio de Oportunidade"** (Dry-Run com visualização do JSON e retorno).

### 🔹 FASE 3: Separação de Envios por Base (Produtos x Serviços)
* **Arquitetura de Divisão:**
  * Se a oportunidade contiver **apenas produtos**, gera orçamento na **Base de Produtos**.
  * Se contiver **apenas serviços**, gera orçamento na **Base de Serviços**.
  * Se for **mista**, o Cerberus orquestra a divisão em dois orçamentos nos respectivos destinos e vincula ambos à oportunidade no Cerberus.
* **Geração Financeira:** Disparo de `POST /gerar-antecipacao` para liberar faturamento e emissão de notas fiscais no Inside.

---

## 5. Como Retomar Este Trabalho
Ao reabrir a conversa, basta solicitar:
> *"Vamos iniciar a Fase 1 da integração com o Inside ERP."*

O assistente consultará este documento (`docs/specs/integracao-inside-erp.md`) e executará as alterações de forma cirúrgica e segura.
