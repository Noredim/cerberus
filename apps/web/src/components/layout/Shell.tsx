import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import { Bell, Search, User, Sun, Moon, Building2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CompanySelectionModal from '../modals/CompanySelectionModal';

interface ShellProps {
    children: React.ReactNode;
}

const Shell: React.FC<ShellProps> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isDark, setIsDark] = useState(true);
    const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
    
    const { user, userCompanies, activeCompanyId, setActiveCompany } = useAuth();

    useEffect(() => {
        // Inicializar com o dark mode por default
        if (!('theme' in localStorage) || localStorage.theme === 'dark') {
            document.documentElement.classList.add('dark');
            setIsDark(true);
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            setIsDark(false);
        }
    }, []);

    const toggleTheme = () => {
        if (isDark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setIsDark(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setIsDark(true);
        }
    };
    
    // c and comp are of type any to satisfy strict tsconfig without full interface import
    const activeCompany = userCompanies.find((c: any) => c.company_id === activeCompanyId);

    return (
        <div className="flex h-screen overflow-hidden bg-bg-deep text-text-primary">
            <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(!sidebarOpen)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 border-b border-border-subtle flex items-center justify-between px-8 bg-bg-surface sticky top-0 z-40 shadow-sm shrink-0">
                    <label htmlFor="top-search" className="flex items-center gap-3 bg-bg-deep px-4 py-1.5 rounded-full border border-border-subtle w-96 cursor-text transition-colors focus-within:border-brand-primary">
                        <Search className="w-4 h-4 text-text-muted" />
                        <span className="text-xs text-text-muted font-medium">Buscar:</span>
                        <input
                            id="top-search"
                            type="text"
                            placeholder="dados, municípios, regras..."
                            className="bg-transparent border-none outline-none text-sm w-full text-text-primary placeholder:text-text-muted"
                        />
                    </label>

                    <div className="flex items-center gap-6">
                        
                        {/* Company selector moved to the right corner below user profile, remove from here */}
                                


                        <button
                            onClick={toggleTheme}
                            className="relative cursor-pointer text-text-muted hover:text-brand-primary transition-colors p-2"
                            aria-label="Alternar Tema"
                        >
                            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                        </button>

                        <button
                            className="relative cursor-pointer text-text-muted hover:text-brand-primary transition-colors p-2"
                            aria-label="Notificações"
                        >
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-primary rounded-full"></span>
                        </button>

                        <div className="flex items-center gap-3 pl-6 border-l border-border-subtle cursor-pointer group relative">
                            <div className="text-right" onClick={() => setCompanyDropdownOpen(!companyDropdownOpen)}>
                                <p className="text-sm font-semibold text-text-primary transition-colors">{user?.name || 'Usuário'} <span className="text-xs text-text-muted font-normal ml-1">• {user?.roles?.join(', ') || 'N/A'}</span></p>
                                
                                {userCompanies.length > 0 && (
                                    <div className="flex items-center justify-end gap-1 mt-0.5 text-text-muted hover:text-brand-primary transition-colors">
                                        <Building2 className="w-3.5 h-3.5" />
                                        <p className="text-xs font-medium max-w-[150px] truncate" title={activeCompany?.company_name}>
                                            {activeCompany ? activeCompany.company_name : 'Nenhuma Empresa'}
                                        </p>
                                        <ChevronDown className="w-3.5 h-3.5" />
                                    </div>
                                )}
                            </div>
                            <div className="w-9 h-9 rounded-full bg-brand-primary/10 text-brand-primary flex items-center justify-center transition-all group-hover:bg-brand-primary group-hover:text-white shrink-0 overflow-hidden">
                                {user?.profile_picture ? (
                                    <img src={user.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                                ) : (
                                    <User className="w-4 h-4" />
                                )}
                            </div>

                            {/* Dropdown for companies is now anchored to the user profile box */}
                            {companyDropdownOpen && userCompanies.length > 0 && (
                                <div className="absolute top-full mt-2 right-0 w-64 bg-bg-surface border border-border-subtle rounded-md shadow-lg overflow-hidden py-1 z-50">
                                    <div className="px-3 py-2 text-xs font-semibold text-text-muted uppercase tracking-wider border-b border-border-subtle bg-bg-deep">
                                        Empresas Vinculadas
                                    </div>
                                    <div className="max-h-60 overflow-y-auto">
                                        {userCompanies.map((comp: any) => (
                                            <button
                                                key={comp.company_id}
                                                onClick={() => {
                                                    setActiveCompany(comp.company_id);
                                                    setCompanyDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-2 text-sm hover:bg-bg-deep transition-colors flex flex-col ${comp.company_id === activeCompanyId ? 'border-l-2 border-brand-primary bg-bg-deep text-brand-primary font-medium' : 'text-text-primary'}`}
                                            >
                                                <span className="truncate">{comp.company_name}</span>
                                                <span className="text-xs text-text-muted mt-0.5">{comp.company_cnpj}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6" role="main">
                    {children}
                </main>

                {/* backdrop for dropdown */}
                {companyDropdownOpen && (
                    <div 
                        className="fixed inset-0 z-30"
                        onClick={() => setCompanyDropdownOpen(false)}
                    />
                )}

                {/* Mandatory Selection Modal */}
                {userCompanies.length > 0 && !activeCompanyId && (
                    <CompanySelectionModal 
                        isOpen={true} 
                        companies={userCompanies} 
                        onSelect={setActiveCompany} 
                    />
                )}
            </div>
        </div>
    );
};

export default Shell;
