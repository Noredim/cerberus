import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Settings, Trash2, Edit2, CheckCircle2, XCircle, MoreVertical } from 'lucide-react';
import { roleApi } from '../../services/roleApi';
import type { Role } from '../../services/roleApi';
import { api } from '../../services/api';
import RolesForm from './RolesForm';

const RolesDashboard: React.FC = () => {
    const [roles, setRoles] = useState<Role[]>([]);
    const [companies, setCompanies] = useState<{ id: string; razao_social: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [rolesData, companiesData] = await Promise.all([
                roleApi.getRoles(),
                api.get('/companies').then((res: any) => res.data)
            ]);
            setRoles(rolesData);
            setCompanies(companiesData);
        } catch (error) {
            console.error('Failed to load data', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleCreateNew = () => {
        setEditingRole(null);
        setIsDrawerOpen(true);
    };

    const handleEdit = (role: Role) => {
        setEditingRole(role);
        setIsDrawerOpen(true);
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Tem certeza que deseja excluir o cargo "${name}"?`)) return;
        
        try {
            await roleApi.deleteRole(id);
            await loadData();
        } catch (error: any) {
            alert(error.response?.data?.detail || 'Erro ao excluir cargo');
        }
    };

    const handleFormSuccess = () => {
        setIsDrawerOpen(false);
        loadData();
    };

    const getCompanyName = (companyId: string) => {
        return companies.find(c => c.id === companyId)?.razao_social || 'Empresa Desconhecida';
    };

    return (
        <div className="p-6 md:p-8 w-full space-y-8 relative min-h-[calc(100vh-4rem)]">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-3xl font-extrabold tracking-tight text-text-primary flex items-center gap-3">
                        <Settings className="w-8 h-8 text-brand-primary" />
                        Cargos
                    </h1>
                    <p className="text-text-muted max-w-2xl">
                        Estruture a hierarquia organizacional associando cargos a empresas.
                    </p>
                </div>
                
                <button
                    onClick={handleCreateNew}
                    className="shrink-0 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-brand-primary rounded-lg hover:bg-brand-primary/90 transition-all hover:scale-[1.02] shadow-sm"
                >
                    <Plus className="w-4 h-4" />
                    Novo Cargo
                </button>
            </div>

            {/* Grid */}
            <div className="bg-surface rounded-lg border border-border-subtle shadow-sm flex flex-col">
                <div className="w-full overflow-visible">
                    <table className="w-full text-left">
                        <thead className="bg-[#f8f9fa] dark:bg-bg-deep">
                            <tr className="text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                                <th className="px-6 py-3 font-semibold">Cargo</th>
                                <th className="px-6 py-3 font-semibold">Empresa Associada</th>
                                <th className="px-6 py-3 font-semibold">Permissão</th>
                                <th className="px-6 py-3"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle bg-surface">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-text-muted animate-pulse">
                                        Carregando cargos...
                                    </td>
                                </tr>
                            ) : roles.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-10 text-center text-text-muted">
                                        Nenhum cargo cadastrado.
                                    </td>
                                </tr>
                            ) : (
                                roles.map(role => (
                                    <tr key={role.id} className="group hover:bg-bg-deep transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="font-bold text-text-primary capitalize">{role.name}</span>
                                        </td>
                                        <td className="px-6 py-4 text-sm font-semibold text-text-primary">
                                            {getCompanyName(role.company_id)}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className={`flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md w-fit ${role.can_perform_sale ? 'bg-brand-success/10 text-brand-success' : 'bg-bg-deep border border-border-subtle text-text-muted'}`}>
                                                {role.can_perform_sale ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                {role.can_perform_sale ? 'Pode Realizar Venda' : 'Não pode realizar venda'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={() => setOpenDropdown(openDropdown === role.id ? null : role.id)}
                                                className="p-2 rounded-md hover:bg-bg-deep text-text-muted hover:text-text-primary transition-all cursor-pointer"
                                                title="Ações"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {openDropdown === role.id && (
                                                <>
                                                    <div className="fixed inset-0 z-10" onClick={() => setOpenDropdown(null)} />
                                                    <div className="absolute right-8 top-10 mt-2 w-48 bg-surface rounded-md shadow-lg z-20 border border-border-subtle overflow-hidden">
                                                        <div className="py-1 flex flex-col">
                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleEdit(role);
                                                                }}
                                                                className="flex items-center gap-2 px-4 py-2 text-sm text-text-primary hover:bg-bg-deep transition-colors w-full text-left"
                                                            >
                                                                <Edit2 className="w-4 h-4" /> Editar Cargo
                                                            </button>
                                                            <button
                                                                onClick={() => {
                                                                    setOpenDropdown(null);
                                                                    handleDelete(role.id, role.name);
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
                            <RolesForm 
                                role={editingRole} 
                                companies={companies}
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

export default RolesDashboard;
