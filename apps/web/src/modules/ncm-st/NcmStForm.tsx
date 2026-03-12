import React, { useState, useEffect } from 'react';
import {
    Save,
    ArrowLeft,
    AlertCircle,
    CheckCircle2,
    Globe
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import type { NcmStHeaderCreate } from './types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

interface State {
    id: string;
    sigla: string;
    nome: string;
}

const NcmStForm: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const isEdit = !!id;

    const [states, setStates] = useState<State[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<NcmStHeaderCreate>({
        state_id: '',
        description: '',
        is_active: true
    });

    useEffect(() => {
        const fetchStates = async () => {
            try {
                const response = await api.get('/catalog/states');
                setStates(response.data);
            } catch (err) {
                console.error('Erro ao buscar estados:', err);
            }
        };

        const fetchHeader = async () => {
            if (!isEdit) return;
            try {
                setLoading(true);
                const response = await api.get(`/cadastro/ncm-st/${id}`);
                setFormData({
                    state_id: response.data.state_id,
                    description: response.data.description,
                    is_active: response.data.is_active
                });
            } catch (err) {
                setError('Erro ao carregar os dados do cadastro.');
            } finally {
                setLoading(false);
            }
        };

        fetchStates();
        fetchHeader();
    }, [id, isEdit]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.state_id || !formData.description) {
            setError('Estado e Descrição são obrigatórios.');
            return;
        }

        try {
            setSaving(true);
            setError(null);
            if (isEdit) {
                await api.put(`/cadastro/ncm-st/${id}`, formData);
            } else {
                await api.post('/cadastro/ncm-st/', formData);
            }
            navigate('/cadastros/ncm-st');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Erro ao salvar cadastro.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-8 h-8 border-4 border-brand-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
                <button
                    onClick={() => navigate('/cadastros/ncm-st')}
                    className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para Listagem
                </button>
            </div>

            <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                    <Save className="w-6 h-6" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-text-primary">
                        {isEdit ? 'Editar Cadastro NCM ST' : 'Novo Cadastro NCM ST'}
                    </h1>
                    <p className="text-text-muted">Defina a descrição e o estado para esta tabela.</p>
                </div>
            </div>

            <Card className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                    {error && (
                        <div className="bg-brand-danger/10 border border-brand-danger/20 text-brand-danger p-4 rounded-md flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <p className="text-sm font-medium">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                                    <Globe className="w-4 h-4 text-text-muted" />
                                    Estado (UF) *
                                </label>
                                <select
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm focus:border-brand-primary focus:ring-1 focus:ring-brand-primary outline-none transition-all"
                                    value={formData.state_id}
                                    onChange={(e) => setFormData({ ...formData, state_id: e.target.value })}
                                    required
                                >
                                    <option value="">Selecione um Estado</option>
                                    {states.map((s) => (
                                        <option key={s.id} value={s.id}>
                                            {s.sigla} - {s.nome}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-text-muted">Apenas estados sincronizados com o IBGE.</p>
                            </div>

                            <div className="space-y-1.5 flex items-end pb-2">
                                <label className="flex items-center gap-3 cursor-pointer group p-2 rounded-lg hover:bg-bg-deep transition-colors w-full border border-border-subtle border-dashed">
                                    <input
                                        type="checkbox"
                                        className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary/20 border-border-subtle"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    />
                                    <span className="text-sm font-medium text-text-primary group-hover:text-brand-primary transition-colors">Cadastro Ativo</span>
                                </label>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-text-primary">Descrição da Tabela *</label>
                            <Input
                                placeholder="Ex: Tabela NCM ST Mato Grosso 2026"
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                required
                                className="bg-bg-deep"
                            />
                            <p className="text-xs text-text-muted underline underline-offset-4 decoration-border-subtle/50 italic">
                                Use nomes claros para facilitar a identificação futura.
                            </p>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-border-subtle flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => navigate('/cadastros/ncm-st')}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={saving}
                            className="bg-brand-primary hover:shadow-lg hover:shadow-brand-primary/20"
                        >
                            {saving ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Salvando...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {isEdit ? 'Salvar Alterações' : 'Criar Cadastro'}
                                </div>
                            )}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default NcmStForm;
