import React, { useState, useEffect } from 'react';
import { Save, X, AlertCircle, Loader2 } from 'lucide-react';
import { roleApi } from '../../services/roleApi';
import type { Role } from '../../services/roleApi';

interface RolesFormProps {
    role: Role | null;
    companies: { id: string; razao_social: string }[];
    onSuccess: () => void;
    onCancel: () => void;
}

const RolesForm: React.FC<RolesFormProps> = ({ role, companies, onSuccess, onCancel }) => {
    const [name, setName] = useState('');
    const [companyId, setCompanyId] = useState('');
    const [canPerformSale, setCanPerformSale] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (role) {
            setName(role.name);
            setCompanyId(role.company_id);
            setCanPerformSale(role.can_perform_sale);
        } else {
            setName('');
            setCompanyId(companies[0]?.id || '');
            setCanPerformSale(false);
        }
    }, [role, companies]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('O nome do cargo é obrigatório.');
            return;
        }

        if (!companyId) {
            setError('A empresa associada é obrigatória.');
            return;
        }

        setLoading(true);
        try {
            if (role) {
                await roleApi.updateRole(role.id, {
                    name,
                    company_id: companyId,
                    can_perform_sale: canPerformSale
                });
            } else {
                await roleApi.createRole({
                    name,
                    company_id: companyId,
                    can_perform_sale: canPerformSale
                });
            }
            onSuccess();
        } catch (err: any) {
            console.error('Failed to save role', err);
            setError(err.response?.data?.detail || 'Erro ao salvar o cargo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-bg-surface">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between sticky top-0 bg-bg-surface z-10">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-text-primary">
                        {role ? 'Editar Cargo' : 'Novo Cargo'}
                    </h2>
                    <p className="text-sm text-text-muted mt-1">
                        {role ? 'Altere as informações deste cargo.' : 'Adicione um novo cargo para a hierarquia.'}
                    </p>
                </div>
                <button 
                    onClick={onCancel}
                    className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-md transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {error && (
                    <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-lg flex items-start gap-3 text-brand-danger">
                        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        <div>
                            <h3 className="font-semibold text-sm">Erro ao salvar</h3>
                            <p className="text-sm opacity-90">{error}</p>
                        </div>
                    </div>
                )}

                <form id="role-form" onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Informações do Cargo</h3>
                        
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-text-primary">
                                    Empresa *
                                </label>
                                <select
                                    value={companyId}
                                    onChange={(e) => setCompanyId(e.target.value)}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-3 text-text-primary focus:border-brand-primary outline-none transition-colors"
                                >
                                    <option value="" disabled>Selecione uma empresa</option>
                                    {companies.map(c => (
                                        <option key={c.id} value={c.id}>{c.razao_social}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-text-primary">
                                    Nome do Cargo *
                                </label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-3 text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                                    placeholder="Ex: Diretor de Vendas"
                                />
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-6">
                        <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Vendas e Alçadas</h3>

                        <label className="flex items-center gap-4 p-4 border border-border-subtle rounded-lg cursor-pointer hover:border-brand-primary/50 bg-bg-deep hover:bg-bg-surface transition-all group">
                            <div className="relative flex items-center justify-center shrink-0">
                                <input
                                    type="checkbox"
                                    checked={canPerformSale}
                                    onChange={(e) => setCanPerformSale(e.target.checked)}
                                    className="peer appearance-none w-5 h-5 border-2 border-border-strong rounded bg-bg-surface checked:bg-brand-primary checked:border-brand-primary transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/20 cursor-pointer"
                                />
                                <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                            </div>
                            <div>
                                <span className="text-sm font-bold text-text-primary group-hover:text-brand-primary transition-colors">Pode realizar vendas</span>
                                <p className="text-xs text-text-muted mt-1 leading-relaxed">Permite que o profissional cadastrado neste cargo crie e gerencie propostas e orçamentos.</p>
                            </div>
                        </label>
                    </div>
                </form>
            </div>

            <div className="p-6 border-t border-border-subtle flex items-center justify-end gap-3 bg-bg-surface sticky bottom-0">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-deep rounded-md transition-colors"
                    disabled={loading}
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    form="role-form"
                    disabled={loading}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-brand-primary/90 transition-all hover:scale-[1.02] flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {role ? 'Salvar Alterações' : 'Criar Cargo'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default RolesForm;
