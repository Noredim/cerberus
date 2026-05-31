import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';
import { Bell, Search, User, Sun, Moon, Building2, ChevronDown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import CompanySelectionModal from '../modals/CompanySelectionModal';
import NotificationsModal from '../modals/NotificationsModal';
import type { NotificationItem } from '../modals/NotificationsModal';
import { api } from '../../services/api';

interface ShellProps {
    children: React.ReactNode;
}

interface CompanyItem {
    company_id: string;
    company_name: string;
    company_cnpj: string;
}

const Shell: React.FC<ShellProps> = ({ children }) => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    
    // Initialize isDark directly from localStorage to prevent synchronous setState inside useEffect
    const [isDark, setIsDark] = useState<boolean>(() => {
        if (typeof window !== 'undefined') {
            return !('theme' in localStorage) || localStorage.theme === 'dark';
        }
        return true;
    });
    
    const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
    
    const { user, userCompanies, activeCompanyId, setActiveCompany } = useAuth();

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [notificationsOpen, setNotificationsOpen] = useState(false);

    const fetchNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const response = await api.get('/notifications');
            setNotifications(response.data || []);
        } catch (error) {
            console.error('Erro ao buscar notificações:', error);
        }
    }, [user]);

    useEffect(() => {
        // Defer initial fetch to prevent synchronous state updates during rendering
        const timer = setTimeout(() => {
            fetchNotifications();
        }, 0);
        const interval = setInterval(fetchNotifications, 30000);
        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [fetchNotifications]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    const toggleTheme = () => {
        setIsDark(prev => !prev);
    };
    
    const activeCompany = userCompanies.find((c: CompanyItem) => c.company_id === activeCompanyId);

    return (
        <div className="flex h-screen overflow-hidden bg-bg-deep text-text-primary print:h-auto print:overflow-visible print:bg-white">
            <Sidebar isOpen={sidebarOpen} toggle={() => setSidebarOpen(!sidebarOpen)} />

            <div className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible">
                <header className="h-16 border-b border-border-subtle flex items-center justify-between px-8 bg-bg-surface sticky top-0 z-40 shadow-sm shrink-0 print:hidden">
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
                            onClick={() => setNotificationsOpen(true)}
                            className="relative cursor-pointer text-text-muted hover:text-brand-primary transition-colors p-2 hover:scale-105 active:scale-95 transition-all"
                            aria-label="Notificações"
                        >
                            <Bell className="w-5 h-5" />
                            {unreadCount > 0 && (
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-primary rounded-full animate-pulse"></span>
                            )}
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
                                        {userCompanies.map((comp: CompanyItem) => (
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

                <main className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible print:block" role="main">
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

                <NotificationsModal
                    isOpen={notificationsOpen}
                    onClose={() => setNotificationsOpen(false)}
                    notifications={notifications}
                    onRefresh={fetchNotifications}
                />
            </div>
        </div>
    );
};

export default Shell;
