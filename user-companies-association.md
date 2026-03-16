# Overview
O objetivo é adicionar a capacidade de vincular uma ou mais empresas ao usuário durante seu cadastro ou edição. Como solicitado, neste momento ele será apenas para visualização/informação e deve buscar do cadastro de empresas já cadastradas no sistema.

# Project Type
WEB e BACKEND (Full-stack)

# Success Criteria
- [ ] Endpoint da API adaptado para receber `companies` no cadastro e edição.
- [ ] Os schemas `UserCreate` e `UserUpdate` suportam lista de empresas.
- [ ] Funcionalidade na interface `UserModal.tsx` exibindo campo para multi-seleção de empresas.
- [ ] Dados informativos das empresas renderizados no modal.

# Tech Stack
- Frontend: React, Vite, CoreUI/Tailwind
- Backend: FastAPI, SQLAlchemy, Pydantic

# File Structure
- `apps/api/src/modules/users/schemas.py`
- `apps/api/src/modules/users/service.py`
- `apps/api/src/modules/users/router.py`
- `apps/web/src/components/modals/UserModal.tsx`

# Task Breakdown
| Task ID | Descrição | Implementação / Verificar | 
|---|---|---|
| TASK-1 | Atualizar Schemas API | Adicionar `companies` (List[str] ou Array) nos schemas `UserCreate` e `UserUpdate` e `UserResponse`. Verificar se retorna o erro 422 caso formato errado. |
| TASK-2 | Atualizar UserService | Em `service.py`, ao criar e editar mapear a lista de IDs para preencher a tabela existente `user_companies`. Validar gravação no banco. |
| TASK-3 | Modificar UserModal.tsx | Adicionar multi-select na UI buscando do endpoint `/api/v1/companies`. Validar renderização e submissão correta do array de IDs. |

# Phase X: Verification
- [ ] As opções do multi-select trazem realmente a listagem de Empresas do sistema.
- [ ] O backend salva na tabela associativa `user_companies` sem erro de Foreign Key.
- [ ] O frontend submete com sucesso e fecha o modal.
- [ ] Scripts executados: lint_runner.py, etc.
