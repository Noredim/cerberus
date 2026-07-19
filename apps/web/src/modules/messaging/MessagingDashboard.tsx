import React, { useState } from 'react';
import { Mail, Zap, ScrollText } from 'lucide-react';
import SmtpConfigForm from './components/SmtpConfigForm';
import TriggerList from './components/TriggerList';
import EmailLogTable from './components/EmailLogTable';

type TabKey = 'config' | 'triggers' | 'logs';

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'config', label: 'Configuração SMTP', icon: <Mail className="w-4 h-4" /> },
    { key: 'triggers', label: 'Triggers de E-mail', icon: <Zap className="w-4 h-4" /> },
    { key: 'logs', label: 'Logs de Envio', icon: <ScrollText className="w-4 h-4" /> },
];

const MessagingDashboard: React.FC = () => {
    const [activeTab, setActiveTab] = useState<TabKey>('config');

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6 min-h-[calc(100vh-4rem)]">
            {/* Header */}
            <div className="space-y-1">
                <h1 className="text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-3">
                    <Mail className="w-8 h-8 text-brand-primary" />
                    Mensageria
                </h1>
                <p className="text-text-muted max-w-2xl">
                    Configure o envio de e-mails automáticos, defina triggers por ação e acompanhe o histórico de envios.
                </p>
            </div>

            {/* Tabs */}
            <div className="border-b border-border-subtle">
                <nav className="flex gap-1 -mb-px">
                    {TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 transition-all ${
                                activeTab === tab.key
                                    ? 'border-brand-primary text-brand-primary'
                                    : 'border-transparent text-text-muted hover:text-text-primary hover:border-border-subtle'
                            }`}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
                {activeTab === 'config' && <SmtpConfigForm />}
                {activeTab === 'triggers' && <TriggerList />}
                {activeTab === 'logs' && <EmailLogTable />}
            </div>
        </div>
    );
};

export default MessagingDashboard;
