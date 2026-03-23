import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Settings2, Trash2, Edit2, ShieldAlert } from 'lucide-react';
import { getProfiles, deleteFunctionalProfile } from '../../services/profileApi';
import type { FunctionalProfileResponse } from '../../services/profileApi';
import ProfileForm from './ProfileForm';

const ProfileDashboard: React.FC = () => {
    const [profiles, setProfiles] = useState<FunctionalProfileResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState<FunctionalProfileResponse | null>(null);

    const loadProfiles = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getProfiles();
            setProfiles(data);
        } catch (error) {
            console.error('Failed to load profiles', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProfiles();
    }, [loadProfiles]);

    const handleCreateNew = () => {
        setEditingProfile(null);
        setIsDrawerOpen(true);
    };

    const handleEdit = (profile: FunctionalProfileResponse) => {
        setEditingProfile(profile);
        setIsDrawerOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir o perfil "${name}"?`)) return;
        
        try {
            await deleteFunctionalProfile(id);
            await loadProfiles();
        } catch (error: any) {
            alert(error.response?.data?.detail || 'Erro ao excluir perfil');
        }
    };

    const handleFormSuccess = () => {
        setIsDrawerOpen(false);
        loadProfiles();
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 relative min-h-[calc(100vh-4rem)]">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-3">
                        <Settings2 className="w-8 h-8 text-brand-primary" />
                        Perfis Funcionais
                    </h1>
                    <p className="text-text-muted max-w-2xl">
                        Gerencie alçadas, limites de margem e permissões de visão de resultados. 
                        Perfis nativos são protegidos pelo sistema.
                    </p>
                </div>
                
                <button
                    onClick={handleCreateNew}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-all hover:scale-[1.02] shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Novo Perfil
                </button>
            </div>

            {/* Profile Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-bg-surface rounded-xl border border-border-subtle" />
                    ))}
                </div>
            ) : profiles.length === 0 ? (
                <div className="text-center py-12 bg-bg-surface rounded-xl border border-border-subtle">
                    <p className="text-text-muted">Nenhum perfil cadastrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {profiles.map(profile => (
                        <div 
                            key={profile.id}
                            className="group relative bg-bg-surface rounded-xl border border-border-subtle p-6 hover:border-brand-primary/30 transition-all hover:shadow-lg flex flex-col h-full"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <h3 className="text-lg font-bold text-text-primary capitalize truncate pr-4">
                                    {profile.name}
                                </h3>
                                {profile.is_protected && (
                                    <div className="shrink-0 bg-brand-warning/10 text-brand-warning p-1.5 rounded-md" title="Perfil Nativo do Sistema">
                                        <ShieldAlert className="w-4 h-4" />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4 flex-1">
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                        Fator de Margem
                                    </p>
                                    <p className="text-2xl font-black text-brand-primary">
                                        {profile.margin_factor_limit.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 5 })}
                                    </p>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${profile.view_director_consolidation ? 'bg-brand-success' : 'bg-border-strong'}`} />
                                    <span className="text-sm font-medium text-text-secondary">
                                        {profile.view_director_consolidation ? 'Visão Diretoria Ativa' : 'Visão Base'}
                                    </span>
                                </div>
                            </div>

                            <div className="pt-5 mt-5 border-t border-border-subtle flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(profile)}
                                    className="p-2 text-text-muted hover:text-brand-primary bg-bg-deep hover:bg-brand-primary/10 rounded-md transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                {!profile.is_protected && (
                                    <button
                                        onClick={() => handleDelete(profile.id, profile.name)}
                                        className="p-2 text-text-muted hover:text-brand-danger bg-bg-deep hover:bg-brand-danger/10 rounded-md transition-colors"
                                        title="Excluir"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Side Drawer for Form */}
            {isDrawerOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div 
                        className="absolute inset-0 bg-bg-deep/80 backdrop-blur-sm"
                        onClick={() => setIsDrawerOpen(false)}
                    />
                    
                    <div className="relative w-full max-w-2xl bg-bg-surface h-full shadow-2xl border-l border-border-subtle animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            <ProfileForm 
                                profile={editingProfile} 
                                onSuccess={handleFormSuccess} 
                                onCancel={() => setIsDrawerOpen(false)} 
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProfileDashboard;
