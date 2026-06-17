import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Shell from './components/layout/Shell';
import Login from './modules/auth/Login';
import SelectCompany from './modules/auth/SelectCompany';
import StatesList from './modules/catalog/StatesList';
import CitiesList from './modules/catalog/CitiesList';
import SyncJobsList from './modules/catalog/SyncJobsList';
import UsersList from './modules/users/UsersList';
import EmpresasList from './modules/companies/EmpresasList';
import EmpresaForm from './modules/companies/EmpresaForm';
import TaxBenefitsList from './modules/tax-benefits/TaxBenefitsList';
import TaxBenefitForm from './modules/tax-benefits/TaxBenefitForm';
import ProfileDashboard from './modules/profiles/ProfileDashboard';
import NcmList from './modules/ncm/NcmList';
import NcmForm from './modules/ncm/NcmForm';
import NcmStList from './modules/ncm-st/NcmStList';
import NcmStForm from './modules/ncm-st/NcmStForm';
import NcmStDetails from './modules/ncm-st/NcmStDetails';
import SupplierList from './modules/suppliers/SupplierList';
import SupplierForm from './modules/suppliers/SupplierForm';
import ProductList from './modules/products/ProductList';
import ProductForm from './modules/products/ProductForm';
import CustomerList from './modules/customers/CustomerList';
import CustomerForm from './modules/customers/CustomerForm';
import { BudgetsList } from './modules/purchase_budgets/BudgetsList';
import { BudgetForm } from './modules/purchase_budgets/BudgetForm';
import { SalesBudgetList } from './modules/sales_budgets/SalesBudgetList';
import { SalesBudgetForm } from './modules/sales_budgets/SalesBudgetForm';
import { OpportunityKitList } from './modules/opportunity_kits/OpportunityKitList';
import { OpportunityKitForm } from './modules/opportunity_kits/OpportunityKitForm';
import RolesDashboard from './modules/roles/RolesDashboard';
import ManHoursDashboard from './modules/man_hours/ManHoursDashboard';
import OwnServicesDashboard from './modules/own_services/OwnServicesDashboard';
import ProfessionalsDashboard from './modules/professionals/ProfessionalsDashboard';
import Dashboard from './modules/dashboard/Dashboard';
import { SolutionAnalysisList } from './modules/solution_analysis/SolutionAnalysisList';
import { SolutionAnalysisForm } from './modules/solution_analysis/SolutionAnalysisForm';
import { SalesProposalList } from './modules/sales_proposals/SalesProposalList';
import { SalesProposalForm } from './modules/sales_proposals/SalesProposalForm';
import { LicitacaoList } from './modules/licitacoes/LicitacaoList';
import { LicitacaoForm } from './modules/licitacoes/LicitacaoForm';
import KitAnalyticReport from './modules/reports/KitAnalyticReport';
import FormasPagamentoList from './modules/payment_methods/FormasPagamentoList';
import FormasPagamentoForm from './modules/payment_methods/FormasPagamentoForm';
import DocumentTemplateList from './modules/document_templates/DocumentTemplateList';
import DocumentTemplateForm from './modules/document_templates/DocumentTemplateForm';
import PWAManager from './components/pwa/PWAManager';

import { Loader2, ServerOff } from 'lucide-react';

const ProtectedRoute = () => {
  const { isAuthenticated, isLoading, user, userCompanies, activeCompanyId } = useAuth();

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
      const path = window.location.pathname;
      const allowedPaths = [
          '/',                     // Painel Geral / Dashboard
          '/cadastro/produtos',    // Produtos
          '/cadastros/clientes',   // Clientes
          '/cadastros/fornecedores',// Fornecedores
          '/cadastros/kits',       // Kits (oportunidades)
          '/orcamentos-compras',   // Orçamento de compra
          '/orcamentos-vendas',    // Oportunidades
          '/comercial/comparativos',// Comparativos de soluções
          '/comercial/licitacoes', // Licitações
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

  return (
    <Shell>
      <Outlet />
    </Shell>
  );
};

function App() {
  return (
    <AuthProvider>
      <PWAManager />
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />

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

            {/* Empresas */}
            <Route path="/empresas" element={<EmpresasList />} />
            <Route path="/empresas/novo" element={<EmpresaForm />} />
            <Route path="/empresas/editar/:id" element={<EmpresaForm />} />
            <Route path="/empresas/detalhes/:id" element={<EmpresaForm />} />

            {/* BenefÃ­cios */}
            <Route path="/beneficios" element={<TaxBenefitsList />} />
            <Route path="/beneficios/novo" element={<TaxBenefitForm />} />
            <Route path="/beneficios/editar/:id" element={<TaxBenefitForm />} />

            {/* NCM */}
            <Route path="/ncms" element={<NcmList />} />
            <Route path="/ncms/novo" element={<NcmForm />} />
            <Route path="/ncms/editar/:id" element={<NcmForm />} />
            <Route path="/ncms/detalhes/:id" element={<NcmForm />} />

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

            {/* Comercial: AnÃ¡lise de SoluÃ§Ãµes */}
            <Route path="/comercial/comparativos" element={<SolutionAnalysisList />} />
            <Route path="/comercial/comparativos/novo" element={<SolutionAnalysisForm />} />
            <Route path="/comercial/comparativos/:id" element={<SolutionAnalysisForm />} />

            {/* Comercial: Propostas de Venda */}
            <Route path="/comercial/propostas" element={<SalesProposalList />} />
            <Route path="/comercial/propostas/:id" element={<SalesProposalForm />} />

            {/* Comercial: Licitações */}
            <Route path="/comercial/licitacoes" element={<LicitacaoList />} />
            <Route path="/comercial/licitacoes/:id" element={<LicitacaoForm />} />


            {/* Relatórios */}
            <Route path="/relatorios/kit-analitico" element={<KitAnalyticReport />} />

          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
