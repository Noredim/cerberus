# Plano de Implementação — PWA Cerberusu (Atualizado com Restrições de Cache de API)

Este documento detalha o plano técnico para transformar o Cerberusu em Progressive Web App (PWA) de acordo com o PRD, as decisões aprovadas e o complemento arquitetural (incluindo as restrições finais de cache).

## Visão Geral
O Cerberusu passará a rodar como PWA sem a utilização de frameworks de geração automática (como `vite-plugin-pwa`), optando por um **Service Worker Vanilla JS** direto. A identidade visual será preservada redimensionando o logo oficial existente. O sistema exibirá a versão em produção, identificará o modo de execução (PWA standalone vs Navegador) no menu do usuário e controlará rigorosamente a segurança de cache (sem caching de dados confidenciais ou endpoints autenticados).

---

## 🛠️ Detalhes do Escopo e Estrutura Técnica

### 1. Arquivos de Configuração e Assets
- `/apps/web/public/manifest.json`: Manifest com metadados do PWA.
- `/apps/web/public/version.json`: Metadados da versão atual (`1.0.0`) e data do build.
- `/apps/web/public/service-worker.js`: Gerenciamento do ciclo de vida, Cache-First para estáticos, Network-Only/Bypass para APIs e Rotas Autenticadas.
- `/apps/web/public/icons/`: Ícones oficiais redimensionados (192, 512, Maskable).
- `/apps/web/public/splash/splash.png`: Splash screen.

### 2. Exclusão de Cache Absoluto de APIs e Negócios (Ajuste 01)
O Service Worker **NÃO** armazenará em cache nenhuma resposta de negócio ou dados sensíveis:
- Exclusão estrita de todas as requisições sob `/api/*`.
- Exclusão de rotas de autenticação `/auth/*`, `/login`, `/logout`, `/token`, `/refresh-token`, `/me`, `/profile`.
- Apenas requisições GET para arquivos estáticos (`.js`, `.css`, `.woff`, `.png`, etc.) usarão `Cache-First`.

### 3. Fluxo UX / UI (Solução Híbrida)
- **Offline (P2)**: Banner fixo no topo (`bg-brand-danger`, `text-white`).
- **Recuperação de conexão (P2)**: Toast temporário de "Conexão restabelecida" (`bg-brand-success`, `text-white`).
- **Atualização (P4)**: Toast flutuante no canto inferior direito ("Nova versão disponível. [Atualizar Agora] [Depois]"). Atualiza apenas mediante clique.
- **Instalação Inteligente (P8)**: Banner customizado que aparece apenas na primeira visita e se ignorado só reaparece em 30 dias ou caso mude a versão principal (Major Version).
- **Identificação do Modo (P6)**: Rótulo no perfil do usuário (`UserProfileModal`) mostrando "PWA Instalado" ou "Executando via Navegador".

### 4. Preparação para Offline Futuro (P7)
- Criação do serviço `apps/web/src/services/offline-queue.service.ts` contendo as interfaces e o fluxo conceitual de enfileiramento de ações futuras sem implementar lógica de banco local ou sincronização ativa nesta fase (Ajuste 02/03).

---

## 📋 Estrutura de Arquivos Modificados e Novos

```text
c:/cerberus/
 ├── scripts/
 │    └── generate_pwa_assets.py   # Script de geração automatizada de ícones
 ├── apps/web/
 │    ├── public/
 │    │    ├── manifest.json
 │    │    ├── version.json        # Metadados de versão
 │    │    ├── service-worker.js   # Service Worker com Cache-First restrito a estáticos
 │    │    ├── icons/
 │    │    │    ├── icon-192.png
 │    │    │    ├── icon-512.png
 │    │    │    └── icon-maskable.png
 │    │    └── splash/
 │    │         └── splash.png
 │    ├── src/
 │    │    ├── services/
 │    │    │    └── offline-queue.service.ts # Estrutura base de sincronização futura
 │    │    ├── components/
 │    │    │    └── pwa/
 │    │    │         └── PWAManager.tsx  # Lógica principal de Service Worker e interface
 │    │    ├── components/modals/
 │    │    │    └── UserProfileModal.tsx # Mostrar informações de versão e modo de execução
 │    │    └── App.tsx              # Acoplamento do PWAManager
 │    └── index.html               # Links de manifest e tags iOS
```

---

## 🔄 Cronograma e Checklist de Desenvolvimento

* [x] **Fase 1: Preparação de Assets (P1)**
  * Criar o script `scripts/generate_pwa_assets.py` para redimensionar a logo e gerar os assets de ícones e splash.
  * Executar o script para criar a estrutura em `apps/web/public/icons/` e `apps/web/public/splash/`.
* [x] **Fase 2: Configuração Estática e Versão (P3)**
  * Criar `apps/web/public/manifest.json` com especificações do PWA.
  * Criar `apps/web/public/version.json` com os metadados de versão do frontend.
  * Modificar `apps/web/index.html` para carregar o manifest, incluir as tags mobile para iOS e configurar a cor de tema.
* [x] **Fase 3: Service Worker e Segurança de Cache (P0, P5, Ajuste 01)**
  * Criar `apps/web/public/service-worker.js` implementando Cache-First apenas para estáticos e ignorando todas as requisições `/api/*` e `/auth/*`.
* [x] **Fase 4: Serviços de Offline Futuro (P7, Ajuste 02/03)**
  * Criar `apps/web/src/services/offline-queue.service.ts` com fila de sincronização.
* [x] **Fase 5: Interface React e Exibição de Modo (P2, P4, P6, P8)**
  * Criar `apps/web/src/components/pwa/PWAManager.tsx` para gerenciar registro do Service Worker, prompts de instalação inteligente, estados online/offline e avisos de novas versões controladas.
  * Modificar `apps/web/src/components/modals/UserProfileModal.tsx` para exibir versão e modo de execução.
  * Importar e renderizar o `<PWAManager />` no topo do `apps/web/src/App.tsx`.
* [x] **Fase 6: Verificação e Build**
  * Executar auditoria local e comandos de build para garantir que a nota do PWA seja >= 95 e sem erros de lint ou build.

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass (Todos os novos módulos e componentes compilados com sucesso sem erros ou avisos)
- Security: ✅ No critical issues (Security scan com sucesso)
- Build: ✅ Success (Vite bundle criado com sucesso via npx vite build)
- Date: 2026-05-31

