# Estado Atual — Módulo de Recuperação de Impostos (Cerberus)

## 1. Banco de Dados
- Migração Alembic `a9f8e7d6c5b4_add_tax_recovery_tables.py` aplicada contendo as tabelas `tax_recovery_analyses`, `tax_recovery_documents` e `tax_recovery_item_results`.
- Suporte a `JSONB` com variantes universais para PostgreSQL em ambiente de produção e Docker.

## 2. Backend (FastAPI & Engines)
- Novo módulo `apps/api/src/modules/tax_recovery` com modelos SQLAlchemy, esquemas Pydantic, serviço `TaxRecoveryService` e roteador REST (`/fiscal/tax-recovery`).
- Reuso completo dos serviços de parser de XML (`NFeXmlParser`), documentos fiscais existentes (`FiscalDocument`) e regras de cálculo de DIFAL (`calcular_difal_item_formacao_preco`) da `tax_engine`.
- Validação estrita para impedir criação de recuperações onde `finalidade_entrada == destinacao_real`.
- Recálculo de cenários originais x recalculados, apuração de saldos a recuperar e a recolher, e geração de memória de cálculo auditável em JSON por item.

## 3. Frontend (React + Vite + CoreUI Bright Theme)
- Submenu adicionado no menu principal: `Fiscal > Recuperação de Impostos` (`/fiscal/recuperacao-impostos`).
- Tela de listagem com filtros avançados, badges de status e grid com as 17 colunas solicitadas (`TaxRecoveryList.tsx`).
- Formulário modal com validação em tempo real (`TaxRecoveryFormModal.tsx`).
- Tela de detalhes (`TaxRecoveryDetail.tsx`) com 11 cards totalizadores, upload múltiplo de XML de NF-e com acompanhamento individual de erros/alertas, e ações completas de processamento.
- Modal de detalhamento da nota fiscal (`TaxRecoveryDocumentModal.tsx`) com layout premium comparativo de cenários (Entrada vs Destinação Real), timeline categorizada com ícones e formatação monetária padrão BRL (`R$ 1.431.366,00`).
- Alinhamento completo do recálculo de ICMS-ST (Revenda) e DIFAL (Ativo Imobilizado MT) com a engine de precificação oficial do Cerberus e Regulamento ICMS MT.
- O build de produção do frontend (`npm run build`) compila sem erros ou avisos de tipos.

## 4. Testes
- Script de teste de regressão `test_tax_recovery_module.py` cobrindo validação de finalidades iguais, criação de análises, importação de XML, bloqueio de chaves duplicadas e recálculo tributário rodando e passando 100%.
