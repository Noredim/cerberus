import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../../services/api';
import { Building2, Plus, Trash2, CheckCircle2 } from 'lucide-react';

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    userData?: any;
    onSuccess: () => void;
}

const ROLES = [
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'ENGENHARIA_PRECO', label: 'Engenharia de Preços' },
    { value: 'DIRETORIA', label: 'Diretoria' }
];

const UserModal: React.FC<UserModalProps> = ({ isOpen, onClose, userData, onSuccess }) => {
    const isEditing = !!userData;
    const [activeTab, setActiveTab] = useState<'dados' | 'empresas'>('dados');
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'ADMIN',
        roles: [] as string[],
        is_active: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    // Admin Companies state
    const [allCompanies, setAllCompanies] = useState<any[]>([]);
    const [userCompanies, setUserCompanies] = useState<any[]>([]);
    const [selectedCompanyToAdd, setSelectedCompanyToAdd] = useState('');
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    useEffect(() => {
        if (userData) {
            setFormData({
                name: userData.name || '',
                email: userData.email || '',
                password: '', // Ignored on edit for MVP (could be a separate flow)
                role: userData.roles && userData.roles.length > 0 ? userData.roles[0] : 'ADMIN',
                roles: userData.roles || [],
                is_active: userData.is_active !== undefined ? userData.is_active : true
            });
            setActiveTab('dados');
            if (isOpen) {
                fetchUserCompanies(userData.id);
                fetchAllCompanies();
            }
        } else {
            setFormData({
                name: '',
                email: '',
                password: '',
                role: 'ADMIN',
                roles: [],
                is_active: true
            });
            setActiveTab('dados');
        }
        setError(null);
    }, [userData, isOpen]);

    const fetchAllCompanies = async () => {
        try {
            const { data } = await api.get('/companies');
            setAllCompanies(data);
        } catch (err) {
            console.error('Failed to fetch companies', err);
        }
    };

    const fetchUserCompanies = async (userId: string) => {
        setLoadingCompanies(true);
        try {
            const { data } = await api.get(`/users/${userId}/companies`);
            setUserCompanies(data);
        } catch (err) {
            console.error('Failed to fetch user companies', err);
        } finally {
            setLoadingCompanies(false);
        }
    };
    
    const handleAddCompany = async () => {
        if (!selectedCompanyToAdd || !userData) return;
        setLoadingCompanies(true);
        try {
            await api.post(`/users/${userData.id}/companies`, {
                company_id: selectedCompanyToAdd,
                is_default: userCompanies.length === 0
            });
            setSelectedCompanyToAdd('');
            await fetchUserCompanies(userData.id);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao vincular empresa');
        } finally {
            setLoadingCompanies(false);
        }
    };
    
    const handleRemoveCompany = async (companyId: string) => {
        if (!userData) return;
        setLoadingCompanies(true);
        try {
            await api.delete(`/users/${userData.id}/companies/${companyId}`);
            await fetchUserCompanies(userData.id);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao desvincular empresa');
        } finally {
            setLoadingCompanies(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isEditing) {
                const payload = {
                    name: formData.name,
                    email: formData.email,
                    roles: [formData.role],
                    is_active: formData.is_active
                };
                await api.put(`/users/${userData.id}`, payload);
            } else {
                if (!formData.password) {
                    setError("A senha inicial é obrigatória.");
                    setLoading(false);
                    return;
                }
                const payload = {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role
                };
                await api.post('/users', payload);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ocorreu um erro ao salvar o usuário.');
        } finally {
            setLoading(false);
        }
    };

    const availableToAssign = allCompanies.filter(
        c => !userCompanies.some(uc => uc.company_id === c.id)
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Editar Usuário' : 'Novo Usuário'}
            maxWidth="lg"
        >
            {isEditing && (
                <div className="flex border-b border-border-subtle mb-4">
                    <button
                        type="button"
                        onClick={() => setActiveTab('dados')}
                        className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'dados' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                    >
                        Dados do Usuário
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('empresas')}
                        className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'empresas' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
                    >
                        Empresas Vinculadas
                    </button>
                </div>
            )}

            {error && (
                <div className="bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-sm p-3 rounded-md mb-4">
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
                {activeTab === 'dados' ? (
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-text-primary">Nome Completo *</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                                placeholder="Ex: João Silva"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-text-primary">E-mail *</label>
                            <input
                                required
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                                placeholder="Ex: joao@empresa.com"
                            />
                        </div>

                        {!isEditing && (
                            <div className="space-y-1.5">
                                <label className="text-sm font-medium text-text-primary">Senha de Acesso *</label>
                                <input
                                    required
                                    type="password"
                                    value={formData.password}
                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                                    placeholder="Crie uma senha segura"
                                />
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-text-primary">Perfil Funcional *</label>
                            <select
                                required
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                            >
                                {ROLES.map(r => (
                                    <option key={r.value} value={r.value}>{r.label}</option>
                                ))}
                            </select>
                        </div>

                        {isEditing && (
                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="is_active_user"
                                    checked={formData.is_active}
                                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary h-4 w-4"
                                />
                                <label htmlFor="is_active_user" className="text-sm text-text-primary">
                                    Conta Ativa
                                </label>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex gap-2 items-end">
                            <div className="flex-1 space-y-1.5">
                                <label className="text-sm font-medium text-text-primary">Vincular Nova Empresa</label>
                                <select
                                    value={selectedCompanyToAdd}
                                    onChange={e => setSelectedCompanyToAdd(e.target.value)}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                                >
                                    <option value="">Selecione uma empresa...</option>
                                    {availableToAssign.map(c => (
                                        <option key={c.id} value={c.id}>{c.razao_social} ({c.cnpj})</option>
                                    ))}
                                </select>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddCompany}
                                disabled={!selectedCompanyToAdd || loadingCompanies}
                                className="px-3 py-2 bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Adicionar
                            </button>
                        </div>
                        
                        <div className="mt-6 border border-border-subtle rounded-md bg-bg-deep overflow-hidden">
                            <div className="px-4 py-3 bg-bg-surface border-b border-border-subtle font-medium text-sm text-text-primary flex items-center justify-between">
                                <span>Empresas Vinculadas ({userCompanies.length})</span>
                            </div>
                            
                            {loadingCompanies ? (
                                <div className="p-4 text-center text-text-muted text-sm">Carregando...</div>
                            ) : userCompanies.length === 0 ? (
                                <div className="p-6 text-center text-text-muted text-sm flex flex-col items-center gap-2">
                                    <Building2 className="w-8 h-8 opacity-20" />
                                    Nenhuma empresa vinculada.
                                </div>
                            ) : (
                                <ul className="divide-y divide-border-subtle max-h-60 overflow-y-auto">
                                    {userCompanies.map(uc => (
                                        <li key={uc.id} className="p-3 flex items-center justify-between hover:bg-bg-surface transition-colors">
                                            <div>
                                                <p className="text-sm font-medium text-text-primary flex items-center gap-2">
                                                    {uc.company_name}
                                                    {uc.is_default && (
                                                        <span className="inline-flex items-center gap-1 text-[10px] uppercase font-bold tracking-wider bg-brand-success/10 text-brand-success px-1.5 py-0.5 rounded">
                                                            <CheckCircle2 className="w-3 h-3" /> Padrão
                                                        </span>
                                                    )}
                                                </p>
                                                <p className="text-xs text-text-muted mt-0.5">CNPJ: {uc.company_cnpj}</p>
                                            </div>
                                            
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveCompany(uc.company_id)}
                                                className="text-text-muted hover:text-brand-danger transition-colors p-1.5 rounded-md hover:bg-brand-danger/10"
                                                title="Remover Acesso"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'dados' && (
                    <div className="flex items-center justify-end gap-3 pt-6 shrink-0 border-t border-border-subtle mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-md transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                )}
            </form>
        </Modal>
    );
};

export default UserModal;
