import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Shield, Users, CheckCircle, XCircle, UserCheck } from 'lucide-react';
import { api } from '../../../services/api';

interface EligibleUser {
    id: string;
    name: string;
    email: string;
    role_name?: string;
}

interface CommercialPolicy {
    id: string;
    nome_politica: string;
    ativo: boolean;
}

interface TeamMember {
    id?: string;
    user_id: string;
    cargo: 'GERENTE' | 'VENDEDOR';
    user_name?: string;
    user_email?: string;
}

interface TeamPolicy {
    id?: string;
    commercial_policy_id: string;
    nome_politica?: string;
}

interface SalesTeam {
    id?: string;
    nome: string;
    ativo: boolean;
    members: TeamMember[];
    policies: TeamPolicy[];
}

interface Props {
    companyId: string;
    isReadOnly: boolean;
}

export function SalesTeamsTab({ companyId, isReadOnly }: Props) {
    const [teams, setTeams] = useState<SalesTeam[]>([]);
    const [eligibleUsers, setEligibleUsers] = useState<EligibleUser[]>([]);
    const [activePolicies, setActivePolicies] = useState<CommercialPolicy[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    
    // Edit/Create State
    const [editingTeam, setEditingTeam] = useState<SalesTeam | null>(null);

    useEffect(() => {
        if (!companyId) return;
        loadData();
    }, [companyId]);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [usersRes, teamsRes, policiesRes] = await Promise.all([
                api.get(`/companies/${companyId}/eligible-users`),
                api.get(`/companies/${companyId}/sales-teams`),
                api.get(`/companies/${companyId}/commercial-policies`)
            ]);
            setEligibleUsers(usersRes.data);
            setTeams(teamsRes.data);
            // Only associate active policies
            setActivePolicies(policiesRes.data.filter((p: any) => p.ativo));
        } catch (err: any) {
            console.error('Error loading sales teams data', err);
            setError('Erro ao carregar equipes de venda.');
        } finally {
            setLoading(false);
        }
    };

    const handleStartCreate = () => {
        setEditingTeam({
            nome: '',
            ativo: true,
            members: [],
            policies: []
        });
    };

    const handleStartEdit = (team: SalesTeam) => {
        setEditingTeam({
            ...team,
            members: [...team.members],
            policies: [...team.policies]
        });
    };

    const handleCancelEdit = () => {
        setEditingTeam(null);
        setError('');
    };

    const handleSave = async () => {
        if (!editingTeam) return;
        if (!editingTeam.nome.trim()) {
            setError('O nome da equipe é obrigatório.');
            return;
        }

        const gerentesCount = editingTeam.members.filter(m => m.cargo === 'GERENTE').length;
        const vendedoresCount = editingTeam.members.filter(m => m.cargo === 'VENDEDOR').length;

        if (gerentesCount === 0 && vendedoresCount === 0) {
            setError('A equipe deve possuir pelo menos 1 membro (Gerente ou Vendedor).');
            return;
        }

        setSaving(true);
        setError('');

        const payload = {
            nome: editingTeam.nome,
            ativo: editingTeam.ativo,
            members: editingTeam.members.map(m => ({
                user_id: m.user_id,
                cargo: m.cargo
            })),
            policies: editingTeam.policies.map(p => ({
                commercial_policy_id: p.commercial_policy_id
            }))
        };

        try {
            if (editingTeam.id) {
                await api.put(`/companies/sales-teams/${editingTeam.id}`, payload);
            } else {
                await api.post(`/companies/${companyId}/sales-teams`, payload);
            }
            setEditingTeam(null);
            loadData();
        } catch (err: any) {
            console.error('Error saving sales team', err);
            setError(err.response?.data?.detail || 'Erro ao salvar equipe de venda.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (teamId: string) => {
        if (isReadOnly) return;
        if (!confirm('Deseja realmente excluir esta equipe de venda?')) return;

        setLoading(true);
        try {
            await api.delete(`/companies/sales-teams/${teamId}`);
            loadData();
        } catch (err: any) {
            console.error('Error deleting sales team', err);
            setError('Erro ao excluir equipe de venda.');
            setLoading(false);
        }
    };

    const toggleMember = (userId: string, cargo: 'GERENTE' | 'VENDEDOR') => {
        if (!editingTeam || isReadOnly) return;
        
        const idx = editingTeam.members.findIndex(m => m.user_id === userId && m.cargo === cargo);
        const newMembers = [...editingTeam.members];

        if (idx >= 0) {
            newMembers.splice(idx, 1);
        } else {
            newMembers.push({ user_id: userId, cargo });
        }

        setEditingTeam({
            ...editingTeam,
            members: newMembers
        });
    };

    const togglePolicy = (policyId: string) => {
        if (!editingTeam || isReadOnly) return;

        const idx = editingTeam.policies.findIndex(p => p.commercial_policy_id === policyId);
        const newPolicies = [...editingTeam.policies];

        if (idx >= 0) {
            newPolicies.splice(idx, 1);
        } else {
            newPolicies.push({ commercial_policy_id: policyId });
        }

        setEditingTeam({
            ...editingTeam,
            policies: newPolicies
        });
    };

    if (loading) {
        return (
            <div className="p-8 text-center text-text-muted">
                <p>Carregando equipes de venda...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <div className="p-4 bg-brand-primary/10 border border-brand-primary/20 text-brand-primary rounded-lg text-sm font-medium">
                    {error}
                </div>
            )}

            {!editingTeam ? (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold text-text-primary">Equipes de Venda</h3>
                            <p className="text-sm text-text-muted">Gerencie os times de vendas e vincule suas políticas comerciais.</p>
                        </div>
                        {!isReadOnly && (
                            <button
                                onClick={handleStartCreate}
                                className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium rounded-lg text-sm transition-colors"
                            >
                                <Plus className="w-4 h-4" />
                                Nova Equipe
                            </button>
                        )}
                    </div>

                    {teams.length === 0 ? (
                        <div className="border border-dashed border-border-subtle rounded-xl p-8 text-center text-text-muted">
                            <Users className="w-12 h-12 mx-auto mb-3 opacity-40 text-text-primary" />
                            <p className="font-medium">Nenhuma equipe de venda cadastrada.</p>
                            <p className="text-sm">Clique em "Nova Equipe" para adicionar.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {teams.map((t) => {
                                const gerentes = t.members.filter(m => m.cargo === 'GERENTE');
                                const vendedores = t.members.filter(m => m.cargo === 'VENDEDOR');

                                return (
                                    <div key={t.id} className="bg-bg-card border border-border-subtle rounded-xl p-5 shadow-sm space-y-4 flex flex-col justify-between">
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-start">
                                                <h4 className="font-bold text-text-primary text-base">{t.nome}</h4>
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                    t.ativo ? 'bg-emerald-500/10 text-emerald-600' : 'bg-text-muted/10 text-text-muted'
                                                }`}>
                                                    {t.ativo ? <CheckCircle className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                                                    {t.ativo ? 'Ativa' : 'Inativa'}
                                                </span>
                                            </div>

                                            <div className="text-sm space-y-1 text-text-muted">
                                                <p><strong>Gerentes:</strong> {gerentes.length > 0 ? gerentes.map(g => g.user_name).join(', ') : 'Nenhum'}</p>
                                                <p><strong>Vendedores:</strong> {vendedores.length > 0 ? vendedores.map(v => v.user_name).join(', ') : 'Nenhum'}</p>
                                            </div>

                                            <div className="space-y-1.5 pt-2">
                                                <p className="text-xs font-bold uppercase text-text-muted tracking-wider">Políticas Comerciais</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {t.policies.length === 0 ? (
                                                        <span className="text-xs text-text-muted">Nenhuma vinculada</span>
                                                    ) : (
                                                        t.policies.map(p => (
                                                            <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-brand-primary/5 border border-brand-primary/15 text-brand-primary rounded-md text-xs font-medium">
                                                                <Shield className="w-3 h-3" />
                                                                {p.nome_politica}
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 pt-4 border-t border-border-subtle mt-4">
                                            <button
                                                onClick={() => handleStartEdit(t)}
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-bg-subtle border border-border-subtle rounded-md transition-colors"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                                Editar
                                            </button>
                                            {!isReadOnly && (
                                                <button
                                                    onClick={() => handleDelete(t.id!)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-brand-primary hover:bg-brand-primary/5 border border-brand-primary/20 rounded-md transition-colors"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Excluir
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : (
                <div className="bg-bg-card border border-border-subtle rounded-xl p-6 shadow-sm space-y-6">
                    <div className="flex justify-between items-center pb-4 border-b border-border-subtle">
                        <div>
                            <h3 className="text-lg font-bold text-text-primary">
                                {editingTeam.id ? `Editar Equipe: ${editingTeam.nome}` : 'Nova Equipe de Venda'}
                            </h3>
                            <p className="text-sm text-text-muted">Configure o nome, membros e políticas comerciais da equipe.</p>
                        </div>
                        <span className="flex items-center gap-2">
                            <label className="text-sm font-medium text-text-primary">Ativa</label>
                            <input
                                type="checkbox"
                                checked={editingTeam.ativo}
                                disabled={isReadOnly}
                                onChange={(e) => setEditingTeam({ ...editingTeam, ativo: e.target.checked })}
                                className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                            />
                        </span>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-semibold text-text-primary mb-1">Nome da Equipe</label>
                            <input
                                type="text"
                                value={editingTeam.nome}
                                disabled={isReadOnly}
                                onChange={(e) => setEditingTeam({ ...editingTeam, nome: e.target.value })}
                                className="w-full px-3.5 py-2 border border-border rounded-lg bg-bg-card text-text-primary focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary outline-none text-sm transition-all"
                                placeholder="Ex: Time Comercial Sul"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                            {/* Gerentes Selector */}
                            <div className="border border-border-subtle rounded-lg p-4 space-y-3 bg-bg-subtle/50">
                                <h4 className="font-bold text-sm text-text-primary flex items-center gap-2">
                                    <UserCheck className="w-4 h-4 text-brand-primary" />
                                    Gerentes da Equipe
                                </h4>
                                <p className="text-xs text-text-muted">Selecione um ou mais usuários para a função de Gerente.</p>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {eligibleUsers.map((u) => {
                                        const isSelected = editingTeam.members.some(m => m.user_id === u.id && m.cargo === 'GERENTE');
                                        return (
                                            <label key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-subtle/30 cursor-pointer transition-colors text-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-text-primary">{u.name}</span>
                                                    <span className="text-xs text-text-muted">{u.email}</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    disabled={isReadOnly}
                                                    onChange={() => toggleMember(u.id, 'GERENTE')}
                                                    className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Vendedores Selector */}
                            <div className="border border-border-subtle rounded-lg p-4 space-y-3 bg-bg-subtle/50">
                                <h4 className="font-bold text-sm text-text-primary flex items-center gap-2">
                                    <Users className="w-4 h-4 text-cyan-600" />
                                    Vendedores da Equipe
                                </h4>
                                <p className="text-xs text-text-muted">Selecione um ou mais usuários para a função de Vendedor.</p>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {eligibleUsers.map((u) => {
                                        const isSelected = editingTeam.members.some(m => m.user_id === u.id && m.cargo === 'VENDEDOR');
                                        return (
                                            <label key={u.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-subtle/30 cursor-pointer transition-colors text-sm">
                                                <div className="flex flex-col">
                                                    <span className="font-medium text-text-primary">{u.name}</span>
                                                    <span className="text-xs text-text-muted">{u.email}</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    disabled={isReadOnly}
                                                    onChange={() => toggleMember(u.id, 'VENDEDOR')}
                                                    className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Policies Selector */}
                        <div className="border border-border-subtle rounded-lg p-4 space-y-3 bg-bg-subtle/50 pt-4">
                            <h4 className="font-bold text-sm text-text-primary flex items-center gap-2">
                                <Shield className="w-4 h-4 text-emerald-600" />
                                Políticas Comerciais Vinculadas
                            </h4>
                            <p className="text-xs text-text-muted">Vincule as políticas comerciais ativas para esta equipe.</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                {activePolicies.length === 0 ? (
                                    <p className="text-xs text-text-muted col-span-full">Nenhuma política comercial ativa encontrada no cadastro.</p>
                                ) : (
                                    activePolicies.map((p) => {
                                        const isSelected = editingTeam.policies.some(tp => tp.commercial_policy_id === p.id);
                                        return (
                                            <label key={p.id} className="flex items-center justify-between p-3 rounded-lg border border-border-subtle bg-bg-card hover:bg-bg-subtle/30 cursor-pointer transition-colors text-sm">
                                                <span className="font-semibold text-text-primary">{p.nome_politica}</span>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    disabled={isReadOnly}
                                                    onChange={() => togglePolicy(p.id)}
                                                    className="w-4 h-4 rounded border-border text-brand-primary focus:ring-brand-primary"
                                                />
                                            </label>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-border-subtle">
                        <button
                            type="button"
                            onClick={handleCancelEdit}
                            className="px-4 py-2 border border-border rounded-lg text-sm font-medium text-text-primary hover:bg-bg-subtle transition-colors"
                        >
                            Cancelar
                        </button>
                        {!isReadOnly && (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white font-medium rounded-lg text-sm transition-colors flex items-center gap-2"
                            >
                                {saving ? 'Salvando...' : 'Salvar Equipe'}
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
