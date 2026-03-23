import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, X, AlertCircle, Loader2 } from 'lucide-react';
import { createFunctionalProfile } from '../../services/profileApi';

const ProfileForm: React.FC = () => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [marginLimit, setMarginLimit] = useState('');
    const [viewDirector, setViewDirector] = useState(false);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const formatLimit = (value: string) => {
        // Limit to numbers and a single comma, max 5 decimal places
        let formatted = value.replace(/[^0-9,]/g, '');
        
        // Ensure only one comma exists
        const parts = formatted.split(',');
        if (parts.length > 2) {
             formatted = parts[0] + ',' + parts.slice(1).join('');
        }
        
        // Limit decimal places to 5
        if (formatted.includes(',')) {
            const [integer, decimal] = formatted.split(',');
            formatted = `${integer},${decimal.slice(0, 5)}`;
        }

        return formatted;
    };

    const handleMarginChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setMarginLimit(formatLimit(e.target.value));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!name.trim()) {
            setError('O nome do perfil é obrigatório.');
            return;
        }

        if (!marginLimit) {
            setError('O limite de fator de margem é obrigatório.');
            return;
        }

        // Validate format: must be valid numeric (replace comma with dot for backend)
        const numericMargin = parseFloat(marginLimit.replace(',', '.'));
        if (isNaN(numericMargin) || numericMargin < 0) {
             setError('O limite de fator de margem deve ser um número válido e positivo.');
             return;
        }

        setLoading(true);
        try {
            await createFunctionalProfile({
                name,
                margin_factor_limit: numericMargin,
                view_director_consolidation: viewDirector
            });
            // Reusing existing toast pattern concept, just navigating back for now.
            // A success alert could be shown here.
            navigate('/seguranca/perfil');
        } catch (err: any) {
            console.error('Failed to create profile', err);
            setError(err.response?.data?.detail || 'Erro ao criar o perfil funcional.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-text-primary">Novo Perfil Funcional</h1>
                    <p className="text-text-muted mt-1">
                        Crie um novo perfil para gerenciar as permissões e alçadas dos usuários.
                    </p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-brand-danger/10 border border-brand-danger/20 rounded-lg flex items-start gap-3 text-brand-danger">
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-sm">Erro ao salvar</h3>
                        <p className="text-sm opacity-90">{error}</p>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="bg-bg-surface rounded-xl border border-border-subtle p-6 space-y-8 shadow-sm">
                 <div className="space-y-6">
                    <h2 className="text-lg font-semibold text-text-primary border-b border-border-subtle pb-2">Informações Básicas</h2>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">
                                Nome do Perfil *
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                                placeholder="Ex: Diretor de Vendas"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-text-primary">
                                Limite Fator de Margem *
                            </label>
                            <input
                                type="text"
                                value={marginLimit}
                                onChange={handleMarginChange}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2 px-3 text-text-primary placeholder:text-text-muted focus:border-brand-primary outline-none transition-colors"
                                placeholder="Ex: 1,12345"
                            />
                            <p className="text-xs text-text-muted">
                                Utilize a vírgula para separar as até 5 casas decimais.
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="space-y-6">
                     <h2 className="text-lg font-semibold text-text-primary border-b border-border-subtle pb-2">Alçadas e Permissões</h2>

                     <label className="flex items-center gap-3 p-4 border border-border-subtle rounded-lg cursor-pointer hover:bg-bg-deep transition-colors group">
                        <div className="relative flex items-center justify-center">
                            <input
                                type="checkbox"
                                checked={viewDirector}
                                onChange={(e) => setViewDirector(e.target.checked)}
                                className="peer appearance-none w-5 h-5 border-2 border-border-strong rounded bg-bg-surface checked:bg-brand-primary checked:border-brand-primary transition-all focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                            />
                            <svg className="absolute w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity pointer-events-none" viewBox="0 0 14 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1 5L5 9L13 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                        </div>
                        <div>
                            <span className="text-sm font-medium text-text-primary group-hover:text-brand-primary transition-colors">Visualiza Consolidação Diretoria</span>
                            <p className="text-xs text-text-muted mt-0.5">Permite que usuários com este perfil visualizem os dados consolidados da diretoria nos orçamentos.</p>
                        </div>
                    </label>
                </div>

                <div className="pt-6 border-t border-border-subtle flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={() => navigate('/seguranca/perfil')}
                        className="px-4 py-2 text-sm font-medium text-text-primary bg-bg-deep border border-border-subtle rounded-md hover:bg-bg-surface transition-colors flex items-center gap-2"
                        disabled={loading}
                    >
                        <X className="w-4 h-4" />
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 text-sm font-medium text-white bg-brand-primary rounded-md hover:bg-brand-primary/90 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                Salvar Perfil
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ProfileForm;
