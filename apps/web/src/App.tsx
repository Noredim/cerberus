import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import PWAManager from './components/pwa/PWAManager';
import { Loader2, ServerOff } from 'lucide-react';

const Shell = lazy(() => import('./components/layout/Shell'));

// Lazy-loaded routes for code-splitting
const Login = lazy(() => import('./modules/auth/Login'));
const SelectCompany = lazy(() => import('./modules/auth/SelectCompany'));
const PublicLandingPage = lazy(() => import('./modules/marketing/public/PublicLandingPage').then(m => ({ default: m.PublicLandingPage })));
const GoogleCallback = lazy(() => import('./modules/integrations/GoogleCallback').then(m => ({ default: m.GoogleCallback })));

// Admin & App Dashboard
const Dashboard = lazy(() => import('./modules/dashboard/Dashboard'));
const UsersList = lazy(() => import('./modules/users/UsersList'));
const StatesList = lazy(() => import('./modules/catalog/StatesList'));
const CitiesList = lazy(() => import('./modules/catalog/CitiesList'));
const SyncJobsList = lazy(() => import('./modules/catalog/SyncJobsList'));
const RolesDashboard = lazy(() => import('./modules/roles/RolesDashboard'));
const ProfessionalsDashboard = lazy(() => import('./modules/professionals/ProfessionalsDashboard'));
const ManHoursDashboard = lazy(() => import('./modules/man_hours/ManHoursDashboard'));
const OwnServicesDashboard = lazy(() => import('./modules/own_services/OwnServicesDashboard'));
const ProfileDashboard = lazy(() => import('./modules/profiles/ProfileDashboard'));
const MessagingDashboard = lazy(() => import('./modules/messaging/MessagingDashboard'));
const BackupDashboard = lazy(() => import('./modules/security/backup/BackupDashboard'));

// Empresas & Benefícios
const EmpresasList = lazy(() => import('./modules/companies/EmpresasList'));
const EmpresaForm = lazy(() => import('./modules/companies/EmpresaForm'));
const TaxBenefitsList = lazy(() => import('./modules/tax-benefits/TaxBenefitsList'));
const TaxBenefitForm = lazy(() => import('./modules/tax-benefits/TaxBenefitForm'));

// Cadastros Fiscais & Produtos
const NcmList = lazy(() => import('./modules/ncm/NcmList'));
const NcmForm = lazy(() => import('./modules/ncm/NcmForm'));
const TipiList = lazy(() => import('./modules/ncm-tipi/TipiList').then(m => ({ default: m.TipiList })));
const NcmStList = lazy(() => import('./modules/ncm-st/NcmStList'));
const NcmStForm = lazy(() => import('./modules/ncm-st/NcmStForm'));
const NcmStDetails = lazy(() => import('./modules/ncm-st/NcmStDetails'));
const SupplierList = lazy(() => import('./modules/suppliers/SupplierList'));
const SupplierForm = lazy(() => import('./modules/suppliers/SupplierForm'));
const CustomerList = lazy(() => import('./modules/customers/CustomerList'));
const CustomerForm = lazy(() => import('./modules/customers/CustomerForm'));
const ProductList = lazy(() => import('./modules/products/ProductList'));
const ProductForm = lazy(() => import('./modules/products/ProductForm'));
const FormasPagamentoList = lazy(() => import('./modules/payment_methods/FormasPagamentoList'));
const FormasPagamentoForm = lazy(() => import('./modules/payment_methods/FormasPagamentoForm'));
const DocumentTemplateList = lazy(() => import('./modules/document_templates/DocumentTemplateList'));
const DocumentTemplateForm = lazy(() => import('./modules/document_templates/DocumentTemplateForm'));

// Orçamentos & Oportunidades
const BudgetsList = lazy(() => import('./modules/purchase_budgets/BudgetsList').then(m => ({ default: m.BudgetsList })));
const BudgetForm = lazy(() => import('./modules/purchase_budgets/BudgetForm').then(m => ({ default: m.BudgetForm })));
const SalesBudgetList = lazy(() => import('./modules/sales_budgets/SalesBudgetList').then(m => ({ default: m.SalesBudgetList })));
const SalesBudgetForm = lazy(() => import('./modules/sales_budgets/SalesBudgetForm').then(m => ({ default: m.SalesBudgetForm })));
const OpportunityKitList = lazy(() => import('./modules/opportunity_kits/OpportunityKitList').then(m => ({ default: m.OpportunityKitList })));
const OpportunityKitForm = lazy(() => import('./modules/opportunity_kits/OpportunityKitForm').then(m => ({ default: m.OpportunityKitForm })));
const SolutionAnalysisList = lazy(() => import('./modules/solution_analysis/SolutionAnalysisList').then(m => ({ default: m.SolutionAnalysisList })));
const SolutionAnalysisForm = lazy(() => import('./modules/solution_analysis/SolutionAnalysisForm').then(m => ({ default: m.SolutionAnalysisForm })));
const SalesProposalList = lazy(() => import('./modules/sales_proposals/SalesProposalList').then(m => ({ default: m.SalesProposalList })));
const SalesProposalForm = lazy(() => import('./modules/sales_proposals/SalesProposalForm').then(m => ({ default: m.SalesProposalForm })));
const LicitacaoList = lazy(() => import('./modules/licitacoes/LicitacaoList').then(m => ({ default: m.LicitacaoList })));
const LicitacaoForm = lazy(() => import('./modules/licitacoes/LicitacaoForm').then(m => ({ default: m.LicitacaoForm })));
const LeadList = lazy(() => import('./modules/leads/LeadList').then(m => ({ default: m.LeadList })));
const LeadDetail = lazy(() => import('./modules/leads/LeadDetail').then(m => ({ default: m.LeadDetail })));

// Marketing & Campanhas
const CampaignsList = lazy(() => import('./modules/marketing/CampaignsList').then(m => ({ default: m.CampaignsList })));
const CampaignForm = lazy(() => import('./modules/marketing/CampaignForm').then(m => ({ default: m.CampaignForm })));

// Relatórios & Fiscal
const KitAnalyticReport = lazy(() => import('./modules/reports/KitAnalyticReport'));
const NfeAnalysisList = lazy(() => import('./modules/fiscal/analise-nfe/NfeAnalysisList'));
const NfeAnalysisDetail = lazy(() => import('./modules/fiscal/analise-nfe/NfeAnalysisDetail'));
const NfeMonthlyTrackerList = lazy(() => import('./modules/fiscal/acompanhamento-nfe/NfeMonthlyTrackerList').then(m => ({ default: m.NfeMonthlyTrackerList })));
const NfeMonthlyDetailView = lazy(() => import('./modules/fiscal/acompanhamento-nfe/NfeMonthlyDetailView').then(m => ({ default: m.NfeMonthlyDetailView })));
const TaxRecoveryList = lazy(() => import('./modules/fiscal/recuperacao-impostos/TaxRecoveryList').then(m => ({ default: m.TaxRecoveryList })));
const TaxRecoveryDetail = lazy(() => import('./modules/fiscal/recuperacao-impostos/TaxRecoveryDetail').then(m => ({ default: m.TaxRecoveryDetail })));

const PageLoadingFallback = () => (
  <div className="min-h-screen bg-bg-deep flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
  </div>
);

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading, user, userCompanies, activeCompanyId } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-deep flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Se o usuário já autenticou, mas não tem empresa selecionada ainda (e.g. primeiro login)
  if (userCompanies.length > 0 && !activeCompanyId) {
      return <SelectCompany />;
  }

  // Se o usuário não tem nenhuma empresa vinculada
  const isAdmin = user?.roles?.includes('ADMIN');
  if (userCompanies.length === 0 && !isAdmin) {
      return (
         <div className="min-h-screen bg-bg-deep flex items-center justify-center p-4 text-center">
             <div className="bg-bg-surface p-8 rounded-lg border border-border-subtle max-w-md">
                 <div className="bg-brand-danger/10 p-3 rounded-full mb-4 mx-auto w-fit">
                     <ServerOff className="w-8 h-8 text-brand-danger" />
                 </div>
                 <h2 className="text-xl font-bold text-text-primary mb-2">Sem Acesso</h2>
                 <p className="text-sm text-text-muted">
                     Você não possui nenhuma empresa vinculada ao seu usuário. Solicite acesso ao administrador do sistema para continuar.
                 </p>
             </div>
         </div>
      );
  }

  // Se o usuário tem o perfil ENGENHARIA_PRECO, bloquear rotas não autorizadas
  const isEngenhariaPreco = user?.roles?.includes('ENGENHARIA_PRECO') && !user?.roles?.includes('ADMIN');
  if (isEngenhariaPreco) {
      const allowedPaths = [
          '/',                     // Painel Geral / Dashboard
          '/cadastro/produtos',    // Produtos
          '/cadastros/servicos-proprios', // Serviços Próprios
          '/cadastros/clientes',   // Clientes
          '/cadastros/fornecedores',// Fornecedores
          '/cadastros/kits',       // Kits (oportunidades)
          '/orcamentos-compras',   // Orçamento de compra
          '/orcamentos-vendas',    // Oportunidades
          '/comercial/leads',      // Leads
          '/comercial/comparativos',// Comparativos de soluções
          '/comercial/licitacoes', // Licitações
          '/integrations/google/callback', // Callback OAuth Google
          '/settings',             // Configurações
      ];
      
      const isAllowed = allowedPaths.some(allowed => 
          path === allowed || path.startsWith(allowed + '/')
      );
      
      if (!isAllowed) {
          return (
             <div className="min-h-screen bg-bg-deep flex items-center justify-center p-4 text-center">
                 <div className="bg-bg-surface p-8 rounded-lg border border-border-subtle max-w-md">
                     <div className="bg-brand-danger/10 p-3 rounded-full mb-4 mx-auto w-fit">
                         <ServerOff className="w-8 h-8 text-brand-danger" />
                     </div>
                     <h2 className="text-xl font-bold text-text-primary mb-2">Acesso Negado</h2>
                     <p className="text-sm text-text-muted">
                         Você não possui permissão para acessar esta página.
                     </p>
                 </div>
             </div>
          );
      }
  }

  // Se o usuário tem o perfil FISCAL, bloquear rotas não autorizadas (apenas acesso a Cadastro -> Produtos, Fiscal -> Análise NF-e, Fiscal -> Acompanhamento Mensal, Dashboard, Settings)
  const isFiscal = user?.roles?.includes('FISCAL') && !user?.roles?.includes('ADMIN');
  if (isFiscal) {
      const allowedPaths = [
          '/',                     // Painel Geral / Dashboard
          '/cadastro/produtos',    // Produtos
          '/fiscal/analise-nfe',   // Análise de NF-e
          '/fiscal/acompanhamento-nfe', // Acompanhamento Mensal de NF-e
          '/fiscal',               // Fiscal
          '/integrations/google/callback', // Callback OAuth Google
          '/settings',             // Configurações
      ];
      
      const isAllowed = allowedPaths.some(allowed => 
          path === allowed || path.startsWith(allowed + '/')
      );
      
      if (!isAllowed) {
          return (
             <div className="min-h-screen bg-bg-deep flex items-center justify-center p-4 text-center">
                 <div className="bg-bg-surface p-8 rounded-lg border border-border-subtle max-w-md">
                     <div className="bg-brand-danger/10 p-3 rounded-full mb-4 mx-auto w-fit">
                         <ServerOff className="w-8 h-8 text-brand-danger" />
                     </div>
                     <h2 className="text-xl font-bold text-text-primary mb-2">Acesso Negado</h2>
                     <p className="text-sm text-text-muted">
                         Você não possui permissão para acessar esta página.
                     </p>
                 </div>
             </div>
          );
      }
  }

  // Se o usuário tem o perfil MARKETING, restringir apenas ao módulo marketing
  const isMarketing = user?.roles?.includes('MARKETING') && !user?.roles?.includes('ADMIN');
  if (isMarketing) {
      if (path === '/') {
          return <Navigate to="/marketing" replace />;
      }
      const allowedPaths = [
          '/marketing',
          '/integrations/google/callback',
      ];
      
      const isAllowed = allowedPaths.some(allowed => 
          path === allowed || path.startsWith(allowed + '/')
      );
      
      if (!isAllowed) {
          return (
             <div className="min-h-screen bg-bg-deep flex items-center justify-center p-4 text-center">
                 <div className="bg-bg-surface p-8 rounded-lg border border-border-subtle max-w-md">
                     <div className="bg-brand-danger/10 p-3 rounded-full mb-4 mx-auto w-fit">
                         <ServerOff className="w-8 h-8 text-brand-danger" />
                     </div>
                     <h2 className="text-xl font-bold text-text-primary mb-2">Acesso Restrito</h2>
                     <p className="text-sm text-text-muted">
                         Seu perfil tem acesso exclusivo ao gerenciamento e acompanhamento de campanhas no módulo de Marketing.
                     </p>
                 </div>
             </div>
          );
      }
  }

  return (
    <Suspense fallback={<PageLoadingFallback />}>
      <Shell>
        <Outlet />
      </Shell>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <PWAManager />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<PageLoadingFallback />}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/lp/:slug" element={<PublicLandingPage />} />
            <Route path="/integrations/google/callback" element={<GoogleCallback />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/cadastros/usuarios" element={<UsersList />} />
              <Route path="/cadastros/estados" element={<StatesList />} />
              <Route path="/cadastros/municipios" element={<CitiesList />} />
              <Route path="/cadastros/jobs" element={<SyncJobsList />} />
              <Route path="/cadastros/cargos" element={<RolesDashboard />} />
              <Route path="/cadastros/profissionais" element={<ProfessionalsDashboard />} />
              <Route path="/cadastros/hora-homem" element={<ManHoursDashboard />} />
              <Route path="/cadastros/servicos-proprios" element={<OwnServicesDashboard />} />
              <Route path="/seguranca/perfil" element={<ProfileDashboard />} />
              <Route path="/seguranca/mensageria" element={<MessagingDashboard />} />
              <Route path="/seguranca/backup" element={<BackupDashboard />} />

              {/* Empresas */}
              <Route path="/empresas" element={<EmpresasList />} />
              <Route path="/empresas/novo" element={<EmpresaForm />} />
              <Route path="/empresas/editar/:id" element={<EmpresaForm />} />
              <Route path="/empresas/detalhes/:id" element={<EmpresaForm />} />

              {/* Benefícios */}
              <Route path="/beneficios" element={<TaxBenefitsList />} />
              <Route path="/beneficios/novo" element={<TaxBenefitForm />} />
              <Route path="/beneficios/editar/:id" element={<TaxBenefitForm />} />

              {/* NCM */}
              <Route path="/ncms" element={<NcmList />} />
              <Route path="/ncms/novo" element={<NcmForm />} />
              <Route path="/ncms/editar/:id" element={<NcmForm />} />
              <Route path="/ncms/detalhes/:id" element={<NcmForm />} />

              {/* Tabela TIPI */}
              <Route path="/cadastros/tipi" element={<TipiList />} />

              {/* NCM ST */}
              <Route path="/cadastros/ncm-st" element={<NcmStList />} />
              <Route path="/cadastros/ncm-st/novo" element={<NcmStForm />} />
              <Route path="/cadastros/ncm-st/editar/:id" element={<NcmStForm />} />
              <Route path="/cadastros/ncm-st/:id" element={<NcmStDetails />} />

              {/* Fornecedores */}
              <Route path="/cadastros/fornecedores" element={<SupplierList />} />
              <Route path="/cadastros/fornecedores/novo" element={<SupplierForm />} />
              <Route path="/cadastros/fornecedores/editar/:id" element={<SupplierForm />} />

              {/* Clientes */}
              <Route path="/cadastros/clientes" element={<CustomerList />} />
              <Route path="/cadastros/clientes/novo" element={<CustomerForm />} />
              <Route path="/cadastros/clientes/editar/:id" element={<CustomerForm />} />

              {/* Produtos */}
              <Route path="/cadastro/produtos" element={<ProductList />} />
              <Route path="/cadastro/produtos/novo" element={<ProductForm />} />
              <Route path="/cadastro/produtos/editar/:id" element={<ProductForm />} />
              <Route path="/cadastro/produtos/detalhes/:id" element={<ProductForm />} />

              {/* Formas de Pagamento */}
              <Route path="/cadastros/formas-pagamento" element={<FormasPagamentoList />} />
              <Route path="/cadastros/formas-pagamento/novo" element={<FormasPagamentoForm />} />
              <Route path="/cadastros/formas-pagamento/editar/:id" element={<FormasPagamentoForm />} />

              {/* Modelos de Documentos */}
              <Route path="/cadastros/modelos-documentos" element={<DocumentTemplateList />} />
              <Route path="/cadastros/modelos-documentos/novo" element={<DocumentTemplateForm />} />
              <Route path="/cadastros/modelos-documentos/:id" element={<DocumentTemplateForm />} />

              {/* Purchase Budgets */}
              <Route path="/orcamentos-compras" element={<BudgetsList />} />
              <Route path="/orcamentos-compras/novo" element={<BudgetForm />} />
              <Route path="/orcamentos-compras/:id" element={<BudgetForm />} />

              {/* Sales Budgets */}
              <Route path="/orcamentos-vendas" element={<SalesBudgetList />} />
              <Route path="/orcamentos-vendas/novo" element={<SalesBudgetForm />} />
              <Route path="/orcamentos-vendas/:id" element={<SalesBudgetForm />} />

              {/* Opportunity Kits */}
              <Route path="/cadastros/kits" element={<OpportunityKitList />} />
              <Route path="/cadastros/kits/novo" element={<OpportunityKitForm />} />
              <Route path="/cadastros/kits/:kitId" element={<OpportunityKitForm />} />

              {/* Comercial: Análise de Soluções */}
              <Route path="/comercial/comparativos" element={<SolutionAnalysisList />} />
              <Route path="/comercial/comparativos/novo" element={<SolutionAnalysisForm />} />
              <Route path="/comercial/comparativos/:id" element={<SolutionAnalysisForm />} />

              {/* Comercial: Propostas de Venda */}
              <Route path="/comercial/propostas" element={<SalesProposalList />} />
              <Route path="/comercial/propostas/:id" element={<SalesProposalForm />} />

              {/* Comercial: Licitações */}
              <Route path="/comercial/licitacoes" element={<LicitacaoList />} />
              <Route path="/comercial/licitacoes/:id" element={<LicitacaoForm />} />

              {/* Comercial: Leads */}
              <Route path="/comercial/leads" element={<LeadList />} />
              <Route path="/comercial/leads/:id" element={<LeadDetail />} />

              {/* Marketing & Campanhas */}
              <Route path="/marketing" element={<CampaignsList />} />
              <Route path="/marketing/campanhas" element={<CampaignsList />} />
              <Route path="/marketing/campanhas/nova" element={<CampaignForm />} />
              <Route path="/marketing/campanhas/:id" element={<CampaignForm />} />

              {/* Relatórios */}
              <Route path="/relatorios/kit-analitico" element={<KitAnalyticReport />} />

              {/* Fiscal: Análise de NF-e, Acompanhamento Mensal e Recuperação de Impostos */}
              <Route path="/fiscal/analise-nfe" element={<NfeAnalysisList />} />
              <Route path="/fiscal/analise-nfe/:id" element={<NfeAnalysisDetail />} />
              <Route path="/fiscal/acompanhamento-nfe" element={<NfeMonthlyTrackerList />} />
              <Route path="/fiscal/acompanhamento-nfe/:id" element={<NfeMonthlyDetailView />} />
              <Route path="/fiscal/recuperacao-impostos" element={<TaxRecoveryList />} />
              <Route path="/fiscal/recuperacao-impostos/:id" element={<TaxRecoveryDetail />} />

            </Route>
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
}

export default App;
