import { X, Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

export interface NotificationItem {
    id: string;
    tenant_id: string;
    company_id?: string;
    user_id: string;
    title: string;
    message: string;
    opportunity_id: string;
    opportunity_number: string;
    vendedor_name: string;
    is_read: boolean;
    created_at: string;
}

interface NotificationsModalProps {
    isOpen: boolean;
    onClose: () => void;
    notifications: NotificationItem[];
    onRefresh: () => void;
}

const formatTimeAgo = (dateStr: string) => {
    try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Agora mesmo';
        if (diffMins < 60) return `Há ${diffMins} min`;
        if (diffHours < 24) return `Há ${diffHours} h`;
        if (diffDays === 1) return 'Ontem';
        return `Há ${diffDays} dias`;
    } catch {
        return '';
    }
};

export function NotificationsModal({ isOpen, onClose, notifications, onRefresh }: NotificationsModalProps) {
    const navigate = useNavigate();

    if (!isOpen) return null;

    const handleNotificationClick = async (n: NotificationItem) => {
        try {
            if (!n.is_read) {
                await api.post(`/notifications/${n.id}/read`);
            }
            onClose();
            onRefresh();
            navigate(`/orcamentos-vendas/${n.opportunity_id}`);
        } catch (error) {
            console.error('Erro ao ler notificação:', error);
            // Redireciona mesmo em caso de erro na marcação de leitura
            onClose();
            navigate(`/orcamentos-vendas/${n.opportunity_id}`);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await api.post('/notifications/read-all');
            onRefresh();
        } catch (error) {
            console.error('Erro ao marcar todas como lidas:', error);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-surface rounded-xl shadow-2xl w-full max-w-md flex flex-col border border-border-subtle overflow-hidden max-h-[80vh]"
            >
                {/* Header */}
                <div className="flex justify-between items-center px-5 py-4 bg-bg-subtle border-b border-border-subtle shrink-0">
                    <div className="flex items-center gap-2">
                        <Bell className="w-5 h-5 text-brand-primary" />
                        <h2 className="text-base font-bold text-text-primary">Notificações</h2>
                        {unreadCount > 0 && (
                            <span className="bg-brand-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                {unreadCount} nova{unreadCount > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {unreadCount > 0 && (
                            <button
                                onClick={handleMarkAllAsRead}
                                className="flex items-center gap-1 text-[11px] font-bold text-brand-primary hover:text-brand-primary-hover px-2 py-1 rounded hover:bg-bg-deep transition-all cursor-pointer"
                                title="Marcar todas como lidas"
                            >
                                <CheckCheck className="w-3.5 h-3.5" />
                                Marcar lidas
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-1.5 text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-md transition-colors cursor-pointer"
                        >
                            <X className="w-4.5 h-4.5" />
                        </button>
                    </div>
                </div>

                {/* Notifications List */}
                <div className="flex-1 overflow-y-auto divide-y divide-border-subtle/50 min-h-[200px]">
                    <AnimatePresence initial={false}>
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center p-8 text-center h-full min-h-[200px]">
                                <div className="w-12 h-12 rounded-full bg-bg-deep flex items-center justify-center text-text-muted mb-3 border border-border-subtle">
                                    <Bell className="w-5 h-5 opacity-40" />
                                </div>
                                <h3 className="text-sm font-bold text-text-primary mb-1">Sem notificações</h3>
                                <p className="text-xs text-text-muted max-w-xs">
                                    Você está em dia! Avisaremos quando houver novas propostas de venda para aprovação.
                                </p>
                            </div>
                        ) : (
                            notifications.map((n) => (
                                <motion.div
                                    key={n.id}
                                    layout
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => handleNotificationClick(n)}
                                    className={`p-4 flex gap-3 cursor-pointer transition-all duration-200 hover:bg-bg-deep/50 relative group ${!n.is_read ? 'bg-brand-primary/[0.02]' : ''}`}
                                >
                                    {/* Unread indicator dot */}
                                    {!n.is_read && (
                                        <span className="absolute left-3 top-5 w-2 h-2 rounded-full bg-brand-primary" />
                                    )}
                                    
                                    <div className={`flex-1 min-w-0 ${!n.is_read ? 'pl-3' : ''}`}>
                                        <div className="flex justify-between items-start gap-2">
                                            <h4 className={`text-xs font-bold text-text-primary truncate ${!n.is_read ? 'font-extrabold' : ''}`}>
                                                {n.title}
                                            </h4>
                                            <span className="text-[9px] text-text-muted shrink-0 mt-0.5">
                                                {formatTimeAgo(n.created_at)}
                                            </span>
                                        </div>
                                        <p className="text-[11px] text-text-muted mt-1 leading-snug">
                                            Oportunidade: <span className="font-semibold text-text-primary">{n.opportunity_number}</span>
                                        </p>
                                        <p className="text-[11px] text-text-muted mt-0.5 leading-snug">
                                            Vendedor: <span className="font-medium text-text-primary">{n.vendedor_name}</span>
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center text-text-muted opacity-0 group-hover:opacity-100 transition-opacity self-center">
                                        <ChevronRight className="w-4 h-4" />
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

export default NotificationsModal;
