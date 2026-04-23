import { useState, useEffect } from 'react';
import { Plus, Trash2, Shield, Star, CheckCircle2 } from 'lucide-react';
import { api } from '../../../services/api';

interface Role {
    id: string;
    name: string;
}

interface CommercialPolicy {
    id?: string;
    nome_politica: string;
    fator_limite: number;
    manutencao_ano_percentual: number;
    comissao_percentual: number;
    ativo: boolean;
    is_default: boolean;
    roles: { role_id: string }[];
}

interface Props {
    companyId: string;
    isReadOnly: boolean;
}

export function CommercialPoliciesTab({ companyId, isReadOnly }: Props) {
    const [policies, setPolicies] = useState<CommercialPolicy[]>([]);
    const [roles, setRoles] = useState<Role[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!companyId) return;
        loadData();
    }, [companyId]);

    const loadData = async () => {
        setLoading(true);
        setError('');
        try {
            const [rolesRes, policiesRes] = await Promise.all([
                api.get('/roles'),
                api.get(`/companies/${companyId}/commercial-policies`)
            ]);
            setRoles(rolesRes.data);
            setPolicies(policiesRes.data);
        } catch (err: any) {
            console.error('Error loading commercial policies', err);
            setError('Erro ao carregar políticas comerciais.');
        } finally {
            setLoading(false);
        }
    };

    const addPolicy = () => {
        setPolicies([...policies, {
            nome_politica: '',
            fator_limite: 1.5,
            manutencao_ano_percentual: 0,
            comissao_percentual: 0,
            ativo: true,
            is_default: policies.length === 0, // First policy becomes default
            roles: []
        }]);
    };

    const removePolicy = async (index: number) => {
        const policy = policies[index];
        if (policy.id) {
            if (!confirm('Deseja realmente remover esta política?')) return;
            try {
                await api.delete(`/companies/commercial-policies/${policy.id}`);
            } catch (err) {
                alert('Erro ao remover política.');
                return;
            }
        }
        const newPolicies = [...policies];
        newPolicies.splice(index, 1);
        // If removed was default, set first remaining as default
        if (policy.is_default && newPolicies.length > 0) {
            newPolicies[0].is_default = true;
        }
        setPolicies(newPolicies);
    };

    const handlePolicyChange = (index: number, field: string, value: any) => {
        const newPolicies = [...policies];
        newPolicies[index] = { ...newPolicies[index], [field]: value };
        setPolicies(newPolicies);
    };

    /** Enforce single-default constraint at UI level */
    const handleSetDefault = (index: number) => {
        if (isReadOnly) return;
        setPolicies(prev => prev.map((p, i) => ({ ...p, is_default: i === index })));
    };

    const handleRoleChange = (index: number, roleId: string) => {
        const newPolicies = [...policies];
        const policyRoles = newPolicies[index].roles;
        const existingIndex = policyRoles.findIndex(r => r.role_id === roleId);
        if (existingIndex >= 0) {
            policyRoles.splice(existingIndex, 1);
        } else {
            policyRoles.push({ role_id: roleId });
        }
        setPolicies(newPolicies);
    };

    const savePolicies = async () => {
        setError('');
        setSaving(true);
        try {
            for (const p of policies) {
                if (!p.nome_politica) throw new Error('O nome da política é obrigatório.');
                if (p.roles.length === 0) throw new Error(`A política "${p.nome_politica}" deve ter ao menos um cargo vinculado.`);
            }

            for (const p of policies) {
                const payload = {
                    nome_politica: p.nome_politica,
                    fator_limite: p.fator_limite,
                    manutencao_ano_percentual: p.manutencao_ano_percentual,
                    comissao_percentual: p.comissao_percentual,
                    ativo: p.ativo,
                    is_default: p.is_default,
                    roles: p.roles.map(r => r.role_id)
                };

                if (p.id) {
                    await api.put(`/companies/commercial-policies/${p.id}`, payload);
                } else {
                    await api.post(`/companies/${companyId}/commercial-policies`, payload);
                }
            }
            alert('Políticas comerciais salvas com sucesso!');
            loadData();
        } catch (err: any) {
            console.error('Error saving commercial policies', err);
            setError(err.message || 'Erro ao salvar as políticas comerciais.');
        } finally {
            setSaving(false);
        }
    };

    if (!companyId) {
        return (
            <div className="p-8 text-center text-text-muted">
                <Shield className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">Salve a empresa primeiro para configurar as políticas comerciais.</p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 text-center text-text-muted text-sm animate-pulse">
                Carregando políticas comerciais...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
                <div>
                    <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                        <Shield className="w-4 h-4 text-brand-primary" />
                        Políticas Comerciais e Alçadas
                    </h3>
                    <p className="text-xs text-text-muted mt-1">
                        Defina limites de fator (markup) mínimo e parâmetros automáticos por cargo.<br />
                        A <span className="font-semibold text-text-secondary">Política Padrão</span> define os valores iniciais dos campos ao criar um kit ou orçamento.
                    </p>
                </div>
                {!isReadOnly && (
                    <div className="flex gap-2 shrink-0">
                        <button type="button" onClick={addPolicy} className="btn-secondary text-sm">
                            <Plus className="w-3.5 h-3.5 mr-1.5" />
                            Nova Política
                        </button>
                        <button type="button" onClick={savePolicies} className="btn-primary text-sm" disabled={saving}>
                            {saving ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                )}
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            {policies.length === 0 ? (
                <div className="text-center py-14 border-2 border-dashed border-border-subtle rounded-xl">
                    <Shield className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" />
                    <h4 className="text-text-primary font-semibold mb-1 text-sm">Nenhuma política configurada</h4>
                    <p className="text-text-muted text-xs">
                        Adicione políticas para restringir os fatores comerciais por cargo.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {policies.map((policy, index) => (
                        <div
                            key={policy.id ?? `new-${index}`}
                            className={`border rounded-xl overflow-hidden transition-all ${
                                policy.is_default
                                    ? 'border-brand-primary/50 shadow-sm shadow-brand-primary/10'
                                    : 'border-border-subtle'
                            }`}
                        >
                            {/* Policy card header */}
                            <div className={`flex justify-between items-center px-4 py-3 ${
                                policy.is_default ? 'bg-brand-primary/5' : 'bg-bg-subtle'
                            } border-b border-border-subtle/60`}>
                                <div className="flex items-center gap-2 min-w-0">
                                    {policy.is_default && (
                                        <span className="flex items-center gap-1 text-[10px] font-bold text-brand-primary bg-brand-primary/10 border border-brand-primary/20 px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0">
                                            <Star className="w-2.5 h-2.5" />
                                            Padrão
                                        </span>
                                    )}
                                    <span className="text-sm font-semibold text-text-primary truncate">
                                        {policy.nome_politica || `Nova Política ${index + 1}`}
                                    </span>
                                    {!policy.ativo && (
                                        <span className="text-[10px] font-medium text-text-muted bg-bg-subtle border border-border-subtle px-2 py-0.5 rounded-full shrink-0">
                                            Inativa
                                        </span>
                                    )}
                                </div>
                                {!isReadOnly && (
                                    <button
                                        type="button"
                                        onClick={() => removePolicy(index)}
                                        className="text-text-muted hover:text-red-500 p-1.5 rounded-md hover:bg-red-50 transition-colors ml-2 shrink-0"
                                        title="Remover política"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>

                            {/* Policy card body */}
                            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-5 bg-bg-surface">
                                {/* Left column: fields */}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                                            Nome da Política
                                        </label>
                                        <input
                                            type="text"
                                            className="input-field w-full"
                                            value={policy.nome_politica}
                                            onChange={(e) => handlePolicyChange(index, 'nome_politica', e.target.value)}
                                            disabled={isReadOnly}
                                            placeholder="Ex: Diretoria"
                                            maxLength={25}
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                                                Fator Mín.
                                            </label>
                                            <input
                                                type="number"
                                                step="0.0001"
                                                min="1"
                                                className="input-field w-full"
                                                value={policy.fator_limite}
                                                onChange={(e) => handlePolicyChange(index, 'fator_limite', parseFloat(e.target.value))}
                                                disabled={isReadOnly}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                                                Comissão (%)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input-field w-full"
                                                value={policy.comissao_percentual}
                                                onChange={(e) => handlePolicyChange(index, 'comissao_percentual', parseFloat(e.target.value))}
                                                disabled={isReadOnly}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">
                                                Manut. Ano (%)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input-field w-full"
                                                value={policy.manutencao_ano_percentual}
                                                onChange={(e) => handlePolicyChange(index, 'manutencao_ano_percentual', parseFloat(e.target.value))}
                                                disabled={isReadOnly}
                                            />
                                        </div>
                                    </div>

                                    {/* Controls row */}
                                    <div className="flex items-center gap-4 pt-1">
                                        {/* Active toggle */}
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <div
                                                className={`relative w-9 h-5 rounded-full transition-colors ${
                                                    policy.ativo ? 'bg-brand-success' : 'bg-border-subtle'
                                                } ${isReadOnly ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                                                onClick={() => !isReadOnly && handlePolicyChange(index, 'ativo', !policy.ativo)}
                                            >
                                                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${policy.ativo ? 'translate-x-4' : ''}`} />
                                            </div>
                                            <span className="text-xs font-medium text-text-secondary">Ativa</span>
                                        </label>

                                        {/* Default toggle — radio-style, only one allowed */}
                                        <button
                                            type="button"
                                            onClick={() => handleSetDefault(index)}
                                            disabled={isReadOnly || policy.is_default}
                                            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                                                policy.is_default
                                                    ? 'text-brand-primary bg-brand-primary/10 border-brand-primary/30 cursor-default'
                                                    : 'text-text-muted border-border-subtle hover:border-brand-primary/40 hover:text-brand-primary hover:bg-brand-primary/5'
                                            } disabled:opacity-50`}
                                        >
                                            {policy.is_default ? (
                                                <><CheckCircle2 className="w-3.5 h-3.5" /> Política Padrão</>
                                            ) : (
                                                <><Star className="w-3.5 h-3.5" /> Definir como Padrão</>
                                            )}
                                        </button>
                                    </div>
                                </div>

                                {/* Right column: roles */}
                                <div className="border-l border-border-subtle pl-5">
                                    <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-2">
                                        Cargos com esta Alçada
                                    </label>
                                    <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                                        {roles.map(role => {
                                            const isLinked = policy.roles.some(r => r.role_id === role.id);
                                            return (
                                                <label
                                                    key={role.id}
                                                    className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-all text-sm ${
                                                        isLinked
                                                            ? 'border-brand-primary/30 bg-brand-primary/5 text-brand-primary font-medium'
                                                            : 'border-border-subtle hover:border-border-default text-text-secondary'
                                                    } ${isReadOnly ? 'cursor-not-allowed opacity-60' : ''}`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isLinked}
                                                        onChange={() => handleRoleChange(index, role.id)}
                                                        disabled={isReadOnly}
                                                        className="w-3.5 h-3.5 accent-brand-primary shrink-0"
                                                    />
                                                    {role.name}
                                                </label>
                                            );
                                        })}
                                        {roles.length === 0 && (
                                            <p className="text-xs text-text-muted italic py-2">Nenhum cargo cadastrado no sistema.</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
