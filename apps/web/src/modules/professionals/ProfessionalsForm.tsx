import React, { useState, useEffect } from 'react';
import { Save, X, AlertCircle, Loader2 } from 'lucide-react';
import { professionalApi } from '../../services/professionalApi';
import { roleApi } from '../../services/roleApi';
import type { Professional, AvailableUser } from '../../services/professionalApi';
import type { Role } from '../../services/roleApi';

interface ProfessionalsFormProps {
    professional: Professional | null;
    onSuccess: () => void;
    onCancel: () => void;
}

const ProfessionalsForm: React.FC<ProfessionalsFormProps> = ({ professional, onSuccess, onCancel }) => {
    const [name, setName] = useState('');
    const [cpf, setCpf] = useState('');
    const [roleId, setRoleId] = useState('');
    const [userId, setUserId] = useState('');

    const [roles, setRoles] = useState<Role[]>([]);
    const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
    
    const [loading, setLoading] = useState(false);
    const [fetchingDeps, setFetchingDeps] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDependencies = async () => {
            setFetchingDeps(true);
            try {
                const [rolesData, usersData] = await Promise.all([
                    roleApi.getRoles(),
                    professionalApi.getAvailableUsers()
                ]);
                setRoles(rolesData);
                
                let usersList = usersData;
                // If editing, the currently assigned user is not returned in "available", so we inject it for the select box
                if (professional && professional.user) {
                    usersList = [{ id: professional.user.id, name: professional.user.name, email: '' }, ...usersData];
                }
                setAvailableUsers(usersList);

                if (professional) {
                    setName(professional.name);
                    setCpf(formatCpfDisplay(professional.cpf));
                    setRoleId(professional.role_id);
                    setUserId(professional.user_id || '');
                } else {
                    setName('');
                    setCpf('');
                    setRoleId(rolesData[0]?.id || '');
                    setUserId('');
                }
            } catch (err) {
                console.error("Error fetching form dependencies", err);
                setError('Falha ao carregar listagem de cargos ou usuários disponíveis.');
            } finally {
                setFetchingDeps(false);
            }
        };

        fetchDependencies();
    }, [professional]);

    const formatCpfDisplay = (value: string) => {
        let v = value.replace(/\D/g, '');
        if (v.length > 11) v = v.substring(0, 11);
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d)/, '$1.$2');
        v = v.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
        return v;
    };

    const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCpf(formatCpfDisplay(e.target.value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const pureCpf = cpf.replace(/\D/g, '');

        if (!name.trim()) {
            setError('O nome é obrigatório.');
            return;
        }

        if (pureCpf.length !== 11) {
            setError('O CPF informado possui um formato inválido (precisa ter 11 dígitos).');
            return;
        }

        if (!roleId) {
            setError('Selecione um Cargo associado.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                name,
                cpf: pureCpf,
                role_id: roleId,
                user_id: userId === '' ? null : userId
            };

            if (professional) {
                await professionalApi.updateProfessional(professional.id, payload);
            } else {
                await professionalApi.createProfessional(payload);
            }
            onSuccess();
        } catch (err: any) {
            console.error('Failed to save professional', err);
            setError(err.response?.data?.detail || 'Erro ao salvar o profissional.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="h-full flex flex-col bg-bg-surface">
            <div className="p-6 border-b border-border-subtle flex items-center justify-between sticky top-0 bg-bg-surface z-10">
                <div>
                    <h2 className="text-xl font-bold tracking-tight text-text-primary">
                        {professional ? 'Editar Profissional' : 'Novo Profissional'}
                    </h2>
                    <p className="text-sm text-text-muted mt-1">
                        {professional ? 'Altere os dados pessoais e vínculos deste profissional.' : 'Registre uma pessoa para atrelar a um cargo.'}
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
                {fetchingDeps ? (
                    <div className="flex items-center justify-center p-12">
                        <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-lg flex items-start gap-3 text-brand-danger">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div>
                                    <h3 className="font-semibold text-sm">Erro ao salvar</h3>
                                    <p className="text-sm opacity-90">{error}</p>
                                </div>
                            </div>
                        )}

                        <form id="professional-form" onSubmit={handleSubmit} className="space-y-8">
                            <div className="space-y-6">
                                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Dados Básicos</h3>
                                
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-text-primary">
                                            Nome *
                                        </label>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-3 text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                                            placeholder="Nome completo do profissional"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-text-primary">
                                            CPF *
                                        </label>
                                        <input
                                            type="text"
                                            value={cpf}
                                            onChange={handleCpfChange}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-3 text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                                            placeholder="999.999.999-99"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-6">
                                <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider mb-4">Vínculos Estruturais</h3>

                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-text-primary">
                                            Cargo (Role) *
                                        </label>
                                        <select
                                            value={roleId}
                                            onChange={(e) => setRoleId(e.target.value)}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-3 text-text-primary focus:border-brand-primary outline-none transition-colors"
                                        >
                                            <option value="" disabled>Selecione o cargo</option>
                                            {roles.map(r => (
                                                <option key={r.id} value={r.id}>{r.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-text-primary flex items-center justify-between">
                                            <span>Conta de Usuário</span>
                                            <span className="text-xs bg-bg-surface px-2 border border-border-subtle rounded-full text-brand-primary">Opcional</span>
                                        </label>
                                        <select
                                            value={userId}
                                            onChange={(e) => setUserId(e.target.value)}
                                            className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-3 text-text-primary focus:border-brand-primary outline-none transition-colors"
                                        >
                                            <option value="">Não vincular a nenhum usuário</option>
                                            {availableUsers.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-text-muted mt-1 leading-relaxed">
                                            Profissionais que usarão ativamente o sistema precisam estar vinculados a uma conta de Usuário válida. O sistema apenas lista os usuários que não foram vinculados a outra pessoa.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </form>
                    </>
                )}
            </div>

            <div className="p-6 border-t border-border-subtle flex items-center justify-end gap-3 bg-bg-surface sticky bottom-0">
                <button
                    type="button"
                    onClick={onCancel}
                    className="px-4 py-2.5 text-sm font-medium text-text-primary hover:bg-bg-deep rounded-md transition-colors"
                    disabled={loading || fetchingDeps}
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    form="professional-form"
                    disabled={loading || fetchingDeps}
                    className="px-6 py-2.5 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-brand-primary/90 transition-all hover:scale-[1.02] flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            <Save className="w-4 h-4" />
                            {professional ? 'Salvar Alterações' : 'Criar Profissional'}
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default ProfessionalsForm;
