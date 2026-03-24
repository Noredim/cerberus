import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Users, Trash2, Edit2, MoreVertical } from 'lucide-react';
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
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

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
        <div className="p-6 md:p-8 w-full space-y-8 relative min-h-[calc(100vh-4rem)]">
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
            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm flex flex-col">
                <div className="w-full overflow-visible">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
                            <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                <th className="px-6 py-3 font-semibold">Profissional</th>
                                <th className="px-6 py-3 font-semibold">CPF</th>
                                <th className="px-6 py-3 font-semibold">Cargo Atribuído</th>
                                <th className="px-6 py-3 font-semibold">Usuário do Sistema</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-text-muted animate-pulse">
                                        Carregando profissionais...
                                    </td>
                                </tr>
                            ) : professionals.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-text-muted">
                                        Nenhum profissional cadastrado.
                                    </td>
                                </tr>
                            ) : (
                                professionals.map(prof => (
                                    <tr key={prof.id} className="group hover:bg-bg-deep transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-text-primary capitalize">{prof.name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-muted">
                                            {formatCpf(prof.cpf)}
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-text-primary">
                                            {prof.role?.name || <span className="text-text-muted font-normal italic">Cargo não localizado</span>}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-text-primary">
                                            {prof.user ? prof.user.name : <span className="text-text-muted italic">Sem usuário vinculado</span>}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={() => setOpenDropdown(openDropdown === prof.id ? null : prof.id)}
                                                className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                                title="Ações"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {openDropdown === prof.id && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                                    <div className="absolute right-8 top-10 mt-2 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                                                        <div className="py-1 flex flex-col">
                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleEdit(prof);
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                            >
                                                                <Edit2 className="w-4 h-4" /> Editar Profissional
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleDelete(prof.id, prof.name);
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-brand-danger hover:bg-brand-danger/10 transition-colors w-full text-left"
                                                            >
                                                                <Trash2 className="w-4 h-4" /> Excluir
                                                            </button>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

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
