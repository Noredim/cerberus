import React, { useEffect, useState } from 'react';
import {
    Users,
    Search,
    Filter,
    MoreVertical,
    Plus,
    CheckCircle2,
    XCircle,
    Loader2,
    Shield,
    Mail,
    Edit2,
    Trash2,
    X
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../../services/api';

interface User {
    id: string;
    name: string;
    email: string;
    tenant_id: string;
    is_active: boolean;
    roles: string[];
}

const ROLE_LABELS: Record<string, string> = {
    ADMIN: 'Administrador',
    ENGENHARIA_PRECO: 'Eng. de Preços',
    DIRETORIA: 'Diretoria',
};

const ROLE_COLORS: Record<string, string> = {
    ADMIN: 'bg-brand-primary/10 text-brand-primary',
    ENGENHARIA_PRECO: 'bg-cyan-400/10 text-cyan-400',
    DIRETORIA: 'bg-pink-400/10 text-pink-400',
};

const ROLES = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'ENGENHARIA_PRECO', label: 'Engenharia de Preços' },
    { value: 'DIRETORIA', label: 'Diretoria' },
];

// ─── Inline Side Panel Form ─────────────────────────────────────────────────
interface UserPanelProps {
    isOpen: boolean;
    onClose: () => void;
    userData: User | null;
    onSuccess: () => void;
}

const UserPanel: React.FC<UserPanelProps> = ({ isOpen, onClose, userData, onSuccess }) => {
    const isEditing = !!userData;
    const [formData, setFormData] = useState({
        name: '', email: '', password: '', role: 'ADMIN', is_active: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (userData) {
            setFormData({
                name: userData.name || '',
                email: userData.email || '',
                password: '',
                role: userData.roles?.[0] || 'ADMIN',
                is_active: userData.is_active ?? true,
            });
        } else {
            setFormData({ name: '', email: '', password: '', role: 'ADMIN', is_active: true });
        }
        setError(null);
    }, [userData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            if (isEditing) {
                await api.put(`/users/${userData!.id}`, {
                    name: formData.name,
                    email: formData.email,
                    roles: [formData.role],
                    is_active: formData.is_active,
                });
            } else {
                if (!formData.password) { setError('A senha inicial é obrigatória.'); setLoading(false); return; }
                await api.post('/users', { name: formData.name, email: formData.email, password: formData.password, role: formData.role });
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ocorreu um erro ao salvar o usuário.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ x: '100%', opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: '100%', opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className="w-80 shrink-0 bg-bg-surface border-l border-border-subtle flex flex-col shadow-lg"
                >
                    {/* Panel Header */}
                    <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle shrink-0">
                        <div>
                            <h2 className="text-base font-bold text-text-primary">
                                {isEditing ? 'Editar Usuário' : 'Novo Usuário'}
                            </h2>
                            <p className="text-xs text-text-muted mt-0.5">
                                {isEditing ? 'Altere os dados do usuário' : 'Preencha os dados para criar'}
                            </p>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Panel Body */}
                    <div className="flex-1 overflow-y-auto p-5">
                        <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-xs p-3 rounded-md">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary">Nome Completo *</label>
                                <input
                                    required type="text" value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                                    placeholder="Ex: João Silva"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary">E-mail *</label>
                                <input
                                    required type="email" value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                                    placeholder="Ex: joao@empresa.com"
                                />
                            </div>

                            {!isEditing && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-text-primary">Senha de Acesso *</label>
                                    <input
                                        required type="password" value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                        className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                                        placeholder="Crie uma senha segura"
                                    />
                                </div>
                            )}

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-primary">Perfil Funcional *</label>
                                <select
                                    required value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                                >
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>

                            {isEditing && (
                                <div className="flex items-center gap-2 pt-1">
                                    <input
                                        type="checkbox" id="is_active_panel"
                                        checked={formData.is_active}
                                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary h-4 w-4"
                                    />
                                    <label htmlFor="is_active_panel" className="text-sm text-text-primary">Conta Ativa</label>
                                </div>
                            )}
                        </form>
                    </div>

                    {/* Panel Footer */}
                    <div className="shrink-0 px-5 py-4 border-t border-border-subtle flex gap-2">
                        <button
                            type="button" onClick={onClose}
                            className="flex-1 px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-md transition-colors cursor-pointer border border-border-subtle"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit" form="user-form" disabled={loading}
                            className="flex-1 px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:opacity-70 flex items-center justify-center gap-2"
                        >
                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

// ─── Main Component ──────────────────────────────────────────────────────────
const UsersList: React.FC = () => {
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [toggling, setToggling] = useState<string | null>(null);
    const [isPanelOpen, setIsPanelOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/users?search=${search}`);
            setUsers(response.data);
        } catch {
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, [search]);

    const handleToggleActive = async (userId: string) => {
        setToggling(userId);
        try { await api.patch(`/users/${userId}/toggle-active`); fetchUsers(); }
        catch { /* silent */ }
        finally { setToggling(null); }
    };

    const handleDelete = async (id: string) => {
        if (!window.confirm('Certeza que deseja excluir este Usuário permanentemente?')) return;
        try { await api.delete(`/users/${id}`); fetchUsers(); }
        catch { alert('Erro ao excluir usuário. Verifique se não é o seu próprio usuário.'); }
    };

    const openEditPanel = (user: User) => { setEditingUser(user); setIsPanelOpen(true); setOpenDropdown(null); };
    const openCreatePanel = () => { setEditingUser(null); setIsPanelOpen(true); };

    return (
        // Full-height container, no scroll on page level
        <div className="flex h-full gap-0 overflow-hidden">

            {/* ── Left: main content ── */}
            <div className="flex-1 flex flex-col overflow-hidden min-w-0 gap-5 pr-0">

                {/* Header */}
                <header className="flex items-center justify-between shrink-0">
                    <div>
                        <h1 className="text-2xl font-display font-bold text-text-primary tracking-tight">
                            Cadastro de <span className="text-brand-primary">Usuários</span>
                        </h1>
                        <p className="text-text-muted text-sm mt-0.5">Gerencie os usuários e permissões do sistema.</p>
                    </div>
                    <button
                        onClick={openCreatePanel}
                        className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2 rounded-md font-medium hover:bg-brand-primary/90 transition-colors min-h-[40px] cursor-pointer shadow-sm text-sm shrink-0"
                    >
                        <Plus className="w-4 h-4" /> Novo Usuário
                    </button>
                </header>

                {/* Card */}
                <div className="bg-bg-surface rounded-lg border border-border-subtle shadow-sm flex flex-col flex-1 overflow-hidden">

                    {/* Toolbar */}
                    <div className="px-5 py-3 border-b border-border-subtle flex items-center justify-between gap-4 shrink-0">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted w-4 h-4" />
                            <input
                                type="text"
                                placeholder="Buscar por nome ou e-mail..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-1.5 pl-9 pr-4 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                            />
                        </div>
                        <button className="p-1.5 rounded-md hover:bg-bg-deep text-text-muted border border-border-subtle transition-colors cursor-pointer">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Table — scrollable independently */}
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left">
                            <thead className="bg-bg-deep sticky top-0 z-10">
                                <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                    <th className="px-6 py-3 font-semibold">Usuário</th>
                                    <th className="px-6 py-3 font-semibold">E-mail</th>
                                    <th className="px-6 py-3 font-semibold">Perfis</th>
                                    <th className="px-6 py-3 font-semibold">Status</th>
                                    <th className="px-6 py-3" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                <AnimatePresence mode="popLayout">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-text-muted">
                                                <Loader2 className="w-7 h-7 animate-spin mx-auto mb-2 text-brand-primary" />
                                                Carregando usuários...
                                            </td>
                                        </tr>
                                    ) : users.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-text-muted text-sm">
                                                Nenhum usuário encontrado.
                                            </td>
                                        </tr>
                                    ) : users.map((user, i) => (
                                        <motion.tr
                                            key={user.id}
                                            initial={{ opacity: 0, y: 8 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.97 }}
                                            transition={{ delay: i * 0.03 }}
                                            className="group hover:bg-bg-deep transition-colors"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-md bg-brand-primary/10 flex items-center justify-center text-brand-primary shrink-0">
                                                        <Users className="w-4 h-4" />
                                                    </div>
                                                    <span className="font-medium text-text-primary text-sm">{user.name}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2 text-sm text-text-muted">
                                                    <Mail className="w-3.5 h-3.5 shrink-0" />
                                                    {user.email}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {user.roles.map(role => (
                                                        <span key={role} className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md ${ROLE_COLORS[role] || 'bg-bg-deep text-text-muted'}`}>
                                                            <Shield className="w-3 h-3" />
                                                            {ROLE_LABELS[role] || role}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleToggleActive(user.id)}
                                                    disabled={toggling === user.id}
                                                    className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md w-fit cursor-pointer transition-all hover:opacity-80 border border-transparent hover:border-border-subtle ${user.is_active ? 'bg-brand-success/10 text-brand-success' : 'bg-brand-danger/10 text-brand-danger'}`}
                                                >
                                                    {toggling === user.id ? <Loader2 className="w-3 h-3 animate-spin" /> : user.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                    {user.is_active ? 'ATIVO' : 'INATIVO'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right relative">
                                                <button
                                                    onClick={() => setOpenDropdown(openDropdown === user.id ? null : user.id)}
                                                    className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                                >
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                                {openDropdown === user.id && (
                                                    <>
                                                        <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                                        <div className="absolute right-8 top-10 mt-2 w-48 bg-bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                                                            <div className="py-1 flex flex-col">
                                                                <button
                                                                    onClick={() => openEditPanel(user)}
                                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                                >
                                                                    <Edit2 className="w-4 h-4" /> Editar Usuário
                                                                </button>
                                                                <button
                                                                    onClick={() => { setOpenDropdown(null); handleDelete(user.id); }}
                                                                    className="flex items-center gap-2 px-4 py-2 text-sm text-brand-danger hover:bg-brand-danger/10 transition-colors w-full text-left"
                                                                >
                                                                    <Trash2 className="w-4 h-4" /> Excluir
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </td>
                                        </motion.tr>
                                    ))}
                                </AnimatePresence>
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="px-5 py-3 bg-bg-deep flex items-center justify-between border-t border-border-subtle shrink-0">
                        <span className="text-xs text-text-muted font-medium">Exibindo {users.length} usuários</span>
                        <div className="flex gap-2">
                            <button className="px-3 py-1.5 rounded-md bg-transparent text-xs text-text-muted border border-border-subtle opacity-50 cursor-not-allowed">Anterior</button>
                            <button className="px-3 py-1.5 rounded-md bg-transparent text-xs text-text-muted border border-border-subtle opacity-50 cursor-not-allowed">Próxima</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Right: Inline slide-in panel ── */}
            <UserPanel
                isOpen={isPanelOpen}
                onClose={() => setIsPanelOpen(false)}
                userData={editingUser}
                onSuccess={fetchUsers}
            />
        </div>
    );
};

export default UsersList;
