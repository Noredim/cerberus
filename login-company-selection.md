# Overview
A funcionalidade exigida consiste em forçar a seleção de uma Empresa logo após o login (se o usuário possuir mais de uma ou se nenhuma estiver selecionada) e exibir a empresa selecionada no canto superior direito do cabeçalho, logo abaixo do perfil do usuário.

# Project Type
WEB

# Success Criteria
- [ ] Um modal sobreposto aparece na tela logo após o login se não houver um `activeCompanyId` no contexto de autenticação.
- [ ] O modal lista apenas as empresas vinculadas ao usuário logado.
- [ ] Quando selecionada, a empresa é gravada como ativa (reaproveitando a função já existente no `AuthContext`).
- [ ] No canto superior direito (`Shell.tsx`), abaixo do Nome e Perfil do usuário, passa a ser exibida a Razão Social da empresa ativa.

# Tech Stack
- Frontend: React, Vite, CoreUI/Tailwind

# File Structure
- `apps/web/src/components/modals/CompanySelectionModal.tsx` (NOVO)
- `apps/web/src/components/layout/Shell.tsx` (MODIFICADO)

# Task Breakdown
| Task ID | Descrição | Implementação / Verificar | 
|---|---|---|
| TASK-1 | Modificação do Header | Alterar `Shell.tsx` para apresentar as informações do Perfil do lado direito, adicionando uma linha extra para a "Empresa Selecionada". |
| TASK-2 | Modal de Seleção | Criar `CompanySelectionModal.tsx` que recebe a lista de `userCompanies` do AuthContext e força a seleção, usando a função `setActiveCompany`. |
| TASK-3 | Inserir Modal no Layout | Em `Shell.tsx`, se `userCompanies.length > 0` e `!activeCompanyId`, renderizar o modal impedindo a interação com o resto da tela (bloqueante). |

# Phase X: Verification
- [ ] Se o login tiver sucesso com 2+ empresas, o modal é obrigatório e bloqueia o uso do app até que uma seja escolhida.
- [ ] Se o login tiver sucesso com 1 empresa, o sistema auto-seleciona (isso já ocorre no `AuthContext`).
- [ ] A empresa aparece abaixo do perfil no topbar?
- [ ] Scripts: `npm run lint` passa sem erros.
