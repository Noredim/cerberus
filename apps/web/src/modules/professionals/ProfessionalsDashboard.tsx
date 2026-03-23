import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Users, Trash2, Edit2 } from 'lucide-react';
import { professionalApi } from '../../services/professionalApi';
import type { Professional } from '../../services/professionalApi';
import ProfessionalsForm from './ProfessionalsForm';

const formatCpf = (cpf: string) => {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const ProfessionalsDashboard: React.FC = () => {
    const [professionals, setProfessionals] = useState<Professional[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingProfessional, setEditingProfessional] = useState<Professional | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const data = await professionalApi.getProfessionals();
            setProfessionals(data);
        } catch (error) {
            console.error('Failed to load professionals', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateNew = () => {
        setEditingProfessional(null);
        setIsDrawerOpen(true);
    };

    const handleEdit = (prof: Professional) => {
        setEditingProfessional(prof);
        setIsDrawerOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir o profissional "${name}"?`)) return;
        
        try {
            await professionalApi.deleteProfessional(id);
            await loadData();
        } catch (error: any) {
            alert(error.response?.data?.detail || 'Erro ao excluir profissional');
        }
    };

    const handleFormSuccess = () => {
        setIsDrawerOpen(false);
        loadData();
    };

    return (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 relative min-h-[calc(100vh-4rem)]">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-3">
                        <Users className="w-8 h-8 text-brand-primary" />
                        Profissionais
                    </h1>
                    <p className="text-text-muted max-w-2xl">
                        Gerencie o cadastro de pessoas, associando-as com cargos e opcionalmente com usuários do sistema.
                    </p>
                </div>
                
                <button
                    onClick={handleCreateNew}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-all hover:scale-[1.02] shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Novo Profissional
                </button>
            </div>

            {/* Grid */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 bg-bg-surface rounded-xl border border-border-subtle" />
                    ))}
                </div>
            ) : professionals.length === 0 ? (
                <div className="text-center py-12 bg-bg-surface rounded-xl border border-border-subtle">
                    <p className="text-text-muted">Nenhum profissional cadastrado.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {professionals.map(prof => (
                        <div 
                            key={prof.id}
                            className="group relative bg-bg-surface rounded-xl border border-border-subtle p-6 hover:border-brand-primary/30 transition-all hover:shadow-lg flex flex-col h-full"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-text-primary capitalize truncate pr-4">
                                        {prof.name}
                                    </h3>
                                    <p className="text-sm font-medium text-text-muted mt-1">
                                        {formatCpf(prof.cpf)}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-4 flex-1">
                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                        Cargo Atribuído
                                    </p>
                                    <p className="text-sm font-bold text-text-primary truncate">
                                        {prof.role?.name || 'Cargo não localizado'}
                                    </p>
                                </div>

                                <div className="bg-bg-deep p-3 rounded-lg border border-border-subtle">
                                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-1">
                                        Usuário do Sistema
                                    </p>
                                    <p className="text-sm font-bold text-text-primary truncate">
                                        {prof.user ? prof.user.name : <span className="text-text-muted italic">Sem usuário vinculado</span>}
                                    </p>
                                </div>
                            </div>

                            <div className="pt-5 mt-5 border-t border-border-subtle flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => handleEdit(prof)}
                                    className="p-2 text-text-muted hover:text-brand-primary bg-bg-deep hover:bg-brand-primary/10 rounded-md transition-colors"
                                    title="Editar"
                                >
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(prof.id, prof.name)}
                                    className="p-2 text-text-muted hover:text-brand-danger bg-bg-deep hover:bg-brand-danger/10 rounded-md transition-colors"
                                    title="Excluir"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Side Drawer */}
            {isDrawerOpen && (
                <div className="fixed inset-0 z-50 flex justify-end">
                    <div 
                        className="absolute inset-0 bg-bg-deep/80 backdrop-blur-sm"
                        onClick={() => setIsDrawerOpen(false)}
                    />
                    
                    <div className="relative w-full max-w-2xl bg-bg-surface h-full shadow-2xl border-l border-border-subtle flex flex-col">
                        <div className="flex-1 overflow-y-auto">
                            <ProfessionalsForm 
                                professional={editingProfessional} 
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

export default ProfessionalsDashboard;
