# PRD & Diagnóstico Técnico — Módulo Marketing (Campanhas & Landing Pages)

**Produto:** Cerberus  
**Módulo:** Marketing / Gestão de Campanhas e Landing Pages  
**Status:** Diagnóstico concluído, pronto para FASE 2 (Modelagem)  
**Data:** 03/09/2026  

---

## 1. Visão Geral

Implementação do módulo **Marketing** no Cerberus com foco em campanhas e publicação de Landing Pages públicas (ex.: tráfego via Instagram/redes sociais), com coleta de telemetria, captura de UTMs e conversão automática de submissões válidas em **Leads** no Cerberus via fila Round Robin.

### Fluxo de Conversão:
```text
Campanha (Vigência + Configurações)
   ↓
Landing Page Pública (/lp/:slug)
   ↓
Visitante Anônimo (UTMs + Referrer + Page View)
   ↓
Engajamento (Vídeo + CTA + Form Start)
   ↓
Submissão Válida (Anti-Spam / Honeypot)
   ↓
Registro da Submissão (MarketingSubmission)
   ↓
Criação Automática de Lead (Lead no Cerberus com origem/canal/observações)
   ↓
Distribuição Comercial (Fila Round Robin da Equipe de Vendas vinculada)
   ↓
Métricas no Dashboard de Marketing
```

---

## 2. Diagnóstico Técnico da Arquitetura Cerberus

### Backend (`apps/api`):
* **Framework:** FastAPI + SQLAlchemy 2.x + Pydantic v2 + Alembic.
* **Uploads de Mídia:** Servidos via `StaticFiles` em `uploads/` montado no `main.py`. As mídias da campanha serão armazenadas em `uploads/marketing/`.
* **Multi-Tenancy:** Preserva `tenant_id` e `company_id`.
* **Módulo Leads (`apps/api/src/modules/leads/`):**
  * `create_lead` aceita `created_by_id=None` (chave estrangeira nullable), permitindo criação anônima/pública.
  * Suporta `ROUND_ROBIN` com a função `get_next_queue_vendor`.
  * Não há trava de unicidade para `cpf_cnpj` ou `email` em `leads`.

### Frontend (`apps/web`):
* **Framework:** React 19 + TypeScript + Vite + Tailwind CSS (tokens do sistema, sem roxo/violeta).
* **Roteamento:** `react-router-dom` v7 no `App.tsx`.
* **Rotas Públicas:** Declaradas fora de `<Route element={<ProtectedRoute />}>`, permitindo renderizar a Landing Page pública em `/lp/:slug` sem carregar o Shell/Sidebar administrativo e sem exigir login.
* **Menu Administrativo:** Adição de "Marketing" em `Sidebar.tsx`.

---

## 3. Modelagem de Dados Prevista

```text
marketing_campaigns
├── id (UUID, PK)
├── tenant_id (String, FK tenants)
├── company_id (UUID, FK companies)
├── sales_team_id (UUID, FK company_sales_teams, nullable)
├── nome (String(255))
├── descricao (Text)
├── status (String(30): RASCUNHO, ATIVA, PAUSADA, ENCERRADA)
├── data_inicio (DateTime)
├── data_fim (DateTime)
├── created_by_id (String, FK users)
└── created_at / updated_at

marketing_landing_pages
├── id (UUID, PK)
├── campaign_id (UUID, FK marketing_campaigns, UNIQUE no MVP)
├── slug (String(100), UNIQUE, INDEX)
├── titulo (String(255))
├── subtitulo (Text)
├── texto_cta (String(100))
├── url_imagem_banner (String(500))
├── url_imagem_fundo (String(500))
├── url_video (String(500))
├── configuracao_formulario (JSONB: campos ativos, obrigatoriedade, labels)
├── configuracao_conteudo (JSONB: tópicos, diferenciais, itens em destaque)
├── cor_primaria (String(20), default '#1E40AF')
└── created_at / updated_at

marketing_submissions
├── id (UUID, PK)
├── landing_page_id (UUID, FK marketing_landing_pages)
├── campaign_id (UUID, FK marketing_campaigns)
├── lead_id (UUID, FK leads, nullable)
├── dados_formulario (JSONB)
├── utm_source, utm_medium, utm_campaign, utm_content, utm_term (Strings)
├── referrer (String(500))
├── ip_address_hash (String(64))
├── user_agent (String(500))
└── created_at (DateTime)

marketing_events
├── id (UUID, PK)
├── landing_page_id (UUID, FK marketing_landing_pages, INDEX)
├── session_id (String(64), INDEX)
├── event_type (String(50): PAGE_VIEW, VIDEO_PLAY, CTA_CLICK, FORM_START, FORM_SUBMIT)
├── metadata (JSONB)
└── created_at (DateTime, INDEX)
```

---

## 4. Plano de Implementação (Fases 1 a 7)

* **FASE 1 — Diagnóstico (Concluído):** Arquitetura, dependências e fluxo levantados.
* **FASE 2 — Modelagem & Migração:** Criação do script de migração Alembic incremental.
* **FASE 3 — Backend:**
  * Domínio `apps/api/src/modules/marketing/` (`models.py`, `schemas.py`, `service.py`, `router.py`).
  * Endpoints administrativos com controle de acesso.
  * Endpoints públicos seguros (`/marketing/public/lp/{slug}`, submit, telemetria fire-and-forget).
  * Conversão direta da submissão em Lead via serviço existente.
* **FASE 4 — Frontend Administrativo:**
  * Menu em `Sidebar.tsx`.
  * Telas de campanhas (Listagem, Edição com formulário configurável, Preview, Dashboard).
* **FASE 5 — Frontend Público:**
  * Rota pública `/lp/:slug` responsiva e mobile-first, com captura de UTMs e feedback imediato de envio.
* **FASE 6 — Testes & Validação:**
  * Testes unitários do backend e teste E2E do funil (Visita ➔ Submit ➔ Lead na fila).
* **FASE 7 — Revisão e Deploy:**
  * Revisão de segurança anti-spam (honeypot), performance mobile e homologação.
