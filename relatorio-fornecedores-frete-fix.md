# Plano: Correção do Frete no Relatório de Fechamento de Fornecedores

## Overview
Este plano resolve a inconsistência na visualização dos custos de frete no relatório de fechamento de fornecedores (`relatorio-fechamento-fornecedores`). Atualmente, o frete é computado no total geral de aquisição e listado na primeira tabela, mas não aparece detalhado nas tabelas por fornecedor, no demonstrativo de fechamento por fornecedor, nem no consolidado geral.

## Project Type
BACKEND / WEB (FastAPI + WeasyPrint/ReportLab)

## Success Criteria
- Colunas de frete unitário e total adicionadas à tabela de itens de cada fornecedor no relatório.
- Coluna de frete adicionada ao "Fechamento por Fornecedor".
- Linha de frete adicionada ao "Consolidado Geral".
- A soma `Equipamentos + Impostos + Frete = Total` bate em todas as tabelas.

## Tech Stack
- Python (FastAPI, ReportLab)
- HTML/CSS (Jinja2, WeasyPrint)

## File Structure
- `apps/api/src/modules/sales_budgets/reports.py` (Cálculos e fallback do ReportLab)
- `apps/api/src/templates/reports/fechamento_fornecedores_v1.html` (Template HTML do relatório)

## Task Breakdown

### Task 1: Atualização dos Cálculos e ReportLab no Backend
- **Agente:** `backend-specialist`
- **Skill:** `clean-code`
- **Input:** `apps/api/src/modules/sales_budgets/reports.py`
- **Output:** Alteração no backend para adicionar frete ao array `fechamento_fornecedores` e na geração do ReportLab.
- **Verify:** Rodar testes ou inspecionar se a compilação do python passa.

### Task 2: Atualização do Template HTML
- **Agente:** `frontend-specialist`
- **Skill:** `frontend-design`
- **Input:** `apps/api/src/templates/reports/fechamento_fornecedores_v1.html`
- **Output:** Alterações no HTML para exibir as novas colunas e linhas referentes ao frete.
- **Verify:** Validação visual do PDF gerado.

## Phase X: Verification
- [x] Lint: Passa sem erros de compilação.
- [x] Geração do PDF: Sem falhas de layout ou quebra no ReportLab e WeasyPrint.
- [x] Matemática dos totais consistente.

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass
- Security: ✅ No critical issues
- Build: ✅ Success
- Date: 2026-07-09
