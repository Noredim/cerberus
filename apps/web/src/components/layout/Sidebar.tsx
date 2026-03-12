import React, { useState } from 'react';
import {
    Shield,
    LayoutDashboard,
    Settings,
    Users,
    BarChart3,
    Menu,
    ChevronLeft,
    LogOut,
    Building2,
    ChevronDown,
    ChevronRight,
    Handshake
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
    isOpen: boolean;
    toggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, toggle }) => {
    const { user, logout } = useAuth();
    const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({
        Cadastro: true,
        Empresas: true
    });

    const toggleMenu = (label: string) => {
        setExpandedMenus(prev => ({ ...prev, [label]: !prev[label] }));
    };

    const menuItems = [
        { icon: LayoutDashboard, label: 'Painel Geral', path: '/' },
        {
            icon: Users,
            label: 'Cadastro',
            path: '/cadastros',
            subItems: [
                { label: 'Usuários', path: '/cadastros/usuarios' },
                { label: 'Estados', path: '/cadastros/estados' },
                { label: 'Municípios', path: '/cadastros/municipios' },
                { label: 'NCM', path: '/ncms' },
                { label: 'NCM ST', path: '/cadastros/ncm-st' },
                { label: 'Fornecedores', path: '/cadastros/fornecedores' },
                { label: 'Clientes', path: '/cadastros/clientes' },
                { label: 'Produtos', path: '/cadastro/produtos' },
            ]
        },
        {
            icon: Building2,
            label: 'Empresas',
            path: '/empresas',
            subItems: [
                { label: 'Empresas', path: '/empresas' },
                { label: 'Benefícios Fiscais', path: '/beneficios' },
            ]
        },
        { icon: Handshake, label: 'Oportunidades', path: '/oportunidades' },
        { icon: BarChart3, label: 'Relatórios', path: '/dashboards' },
        { icon: Shield, label: 'Segurança', path: '/security' },
        { icon: Settings, label: 'Configurações', path: '/settings' },
    ];

    return (
        <motion.aside
            initial={false}
            animate={{ width: isOpen ? 256 : 64 }}
            className="bg-surface h-screen sticky top-0 flex flex-col transition-all duration-300 z-50 border-r border-border-subtle shadow-sm overflow-hidden"
        >
            <div className="h-16 flex items-center justify-between px-4 bg-brand-primary text-white shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 flex items-center justify-center">
                        <Shield className="w-6 h-6" />
                    </div>
                    {isOpen && (
                        <motion.span
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="text-lg font-bold tracking-wide whitespace-nowrap"
                        >
                            CERBERUS
                        </motion.span>
                    )}
                </div>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                {menuItems.map((item) => {
                    const isActive = window.location.pathname === item.path || (item.subItems && item.subItems.some(sub => window.location.pathname === sub.path));
                    const isExpanded = expandedMenus[item.label];

                    return (
                        <div key={item.label} className="space-y-1">
                            <div
                                onClick={() => {
                                    if (item.subItems) {
                                        if (!isOpen) toggle();
                                        toggleMenu(item.label);
                                    } else {
                                        window.location.href = item.path;
                                    }
                                }}
                                className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-colors group ${isActive ? 'bg-brand-primary/10 text-brand-primary font-semibold' : 'text-text-muted hover:text-text-primary hover:bg-bg-deep'}`}
                            >
                                <item.icon className={`w-5 h-5 shrink-0 ${isActive ? 'text-brand-primary' : 'text-text-muted group-hover:text-text-primary'}`} />
                                {isOpen && (
                                    <div className="flex flex-1 items-center justify-between">
                                        <motion.span
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="whitespace-nowrap text-[15px]"
                                        >
                                            {item.label}
                                        </motion.span>
                                        {item.subItems && (
                                            isExpanded ? <ChevronDown className="w-4 h-4 text-text-muted" /> : <ChevronRight className="w-4 h-4 text-text-muted" />
                                        )}
                                    </div>
                                )}
                            </div>

                            <AnimatePresence>
                                {isOpen && item.subItems && isExpanded && (
                                    <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="pl-11 border-l border-border-subtle ml-[22px] space-y-1 mt-1 overflow-hidden"
                                    >
                                        {item.subItems.map(sub => {
                                            const isSubActive = window.location.pathname === sub.path;
                                            return (
                                                <div
                                                    key={sub.label}
                                                    onClick={() => window.location.href = sub.path}
                                                    className={`py-1.5 text-sm cursor-pointer transition-colors relative before:content-[''] before:absolute before:left-[-12px] before:top-1/2 before:-translate-y-1/2 before:w-1.5 before:h-[1px] before:bg-border-subtle ${isSubActive ? 'text-brand-primary font-semibold' : 'text-text-muted hover:text-brand-primary'}`}
                                                >
                                                    {sub.label}
                                                </div>
                                            )
                                        })}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )
                })}
            </nav>

            <div className="p-3 border-t border-border-subtle flex flex-col gap-2 shrink-0">
                {user && isOpen && (
                    <div className="flex flex-col mb-1 px-2">
                        <span className="text-sm font-semibold text-text-primary truncate">{user.name}</span>
                        <span className="text-xs text-text-muted truncate">{user.email}</span>
                    </div>
                )}
                <button
                    onClick={logout}
                    className="w-full flex items-center justify-start gap-3 p-2.5 rounded-md hover:bg-brand-danger/10 text-text-muted hover:text-brand-danger transition-colors cursor-pointer"
                    title="Sair da conta"
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    {isOpen && <span className="font-semibold whitespace-nowrap text-[15px]">Sair</span>}
                </button>
            </div>

            <div className="p-3 border-t border-border-subtle shrink-0">
                <button
                    onClick={toggle}
                    className="w-full flex items-center justify-center p-2 rounded-md hover:bg-bg-deep text-text-muted transition-colors cursor-pointer"
                >
                    {isOpen ? <ChevronLeft className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
            </div>
        </motion.aside>
    );
};

export default Sidebar;
