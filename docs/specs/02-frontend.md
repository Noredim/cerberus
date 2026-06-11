# SPEC 02 — FRONTEND

## Objetivo

Definir os padrões técnicos do frontend do Cerberus Sales Engine.

O frontend deve fornecer uma experiência rápida, limpa e produtiva para usuários corporativos.

---

## Stack

* React
* Vite
* Tailwind CSS v4
* CoreUI Bright Theme
* Framer Motion
* Lucide React

---

## Princípios de Interface

A interface deve priorizar:

* simplicidade;
* produtividade;
* rapidez operacional;
* baixa quantidade de cliques;
* consistência visual.

---

## Layout

Utilizar layout principal com scroll nativo da página.

Evitar múltiplas barras de rolagem internas.

---

## Tema

Suporte nativo para:

* Light Mode
* Dark Mode

Manter compatibilidade com o Design System.

---

## Organização sugerida

```text
src/
├── components/
├── pages/
├── modules/
├── services/
├── hooks/
├── layouts/
└── routes/
```

---

## Padrão dos módulos

Cada módulo deve preferencialmente conter:

* páginas;
* componentes;
* serviços;
* tipos;
* validações.

---

## Comunicação com Backend

Toda comunicação deve ocorrer através da API principal.

O frontend nunca deve implementar regras tributárias ou cálculos complexos.

---

## Regras obrigatórias

* Não duplicar componentes existentes.
* Não quebrar navegação existente.
* Não alterar fluxo do usuário sem necessidade.
* Não mover regras de negócio para a interface.
* Não implementar cálculos financeiros no frontend.

---

## Diretriz para IA

Antes de alterar telas:

1. Ler esta SPEC.
2. Identificar o módulo.
3. Reutilizar componentes existentes.
4. Preservar identidade visual.
5. Implementar apenas o necessário.
