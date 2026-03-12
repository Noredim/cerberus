import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../../services/api';

interface StateModalProps {
    isOpen: boolean;
    onClose: () => void;
    stateData?: any; // If editing, pass the state data. If null, creates new.
    onSuccess: () => void;
}

const StateModal: React.FC<StateModalProps> = ({ isOpen, onClose, stateData, onSuccess }) => {
    const isEditing = !!stateData;
    const [formData, setFormData] = useState({
        nome: '',
        sigla: '',
        ibge_id: '',
        regiao_nome: '',
        regiao_sigla: '',
        is_active: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (stateData) {
            setFormData({
                nome: stateData.nome || '',
                sigla: stateData.sigla || '',
                ibge_id: stateData.ibge_id?.toString() || '',
                regiao_nome: stateData.regiao_nome || '',
                regiao_sigla: stateData.regiao_sigla || '',
                is_active: stateData.is_active !== undefined ? stateData.is_active : true
            });
        } else {
            setFormData({
                nome: '',
                sigla: '',
                ibge_id: '',
                regiao_nome: '',
                regiao_sigla: '',
                is_active: true
            });
        }
        setError(null);
    }, [stateData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const payload = {
                ...formData,
                ibge_id: parseInt(formData.ibge_id, 10),
                sigla: formData.sigla.toUpperCase()
            };

            if (isEditing) {
                await api.put(`/catalog/states/${stateData.id}`, payload);
            } else {
                await api.post('/catalog/states', payload);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ocorreu um erro ao salvar o estado.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Editar Estado' : 'Novo Estado'}
            maxWidth="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {error && (
                    <div className="bg-brand-danger/10 border border-brand-danger/20 text-brand-danger text-sm p-3 rounded-md">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5 col-span-2">
                        <label className="text-sm font-medium text-text-primary">Nome do Estado *</label>
                        <input
                            required
                            type="text"
                            value={formData.nome}
                            onChange={e => setFormData({ ...formData, nome: e.target.value })}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                            placeholder="Ex: São Paulo"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-text-primary">Sigla (UF) *</label>
                        <input
                            required
                            maxLength={2}
                            type="text"
                            value={formData.sigla}
                            onChange={e => setFormData({ ...formData, sigla: e.target.value.toUpperCase() })}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                            placeholder="Ex: SP"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-text-primary">Código IBGE *</label>
                        <input
                            required
                            type="number"
                            disabled={isEditing}
                            value={formData.ibge_id}
                            onChange={e => setFormData({ ...formData, ibge_id: e.target.value })}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none disabled:opacity-50"
                            placeholder="Ex: 35"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-text-primary">Nome da Região</label>
                        <input
                            type="text"
                            value={formData.regiao_nome}
                            onChange={e => setFormData({ ...formData, regiao_nome: e.target.value })}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                            placeholder="Ex: Sudeste"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-text-primary">Sigla da Região</label>
                        <input
                            type="text"
                            value={formData.regiao_sigla}
                            onChange={e => setFormData({ ...formData, regiao_sigla: e.target.value.toUpperCase() })}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                            placeholder="Ex: SE"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <input
                        type="checkbox"
                        id="is_active_state"
                        checked={formData.is_active}
                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary h-4 w-4"
                    />
                    <label htmlFor="is_active_state" className="text-sm text-text-primary">
                        Estado Ativo
                    </label>
                </div>

                <div className="flex items-center justify-end gap-3 pt-6 shrink-0 border-t border-border-subtle mt-6">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-md transition-colors cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 transition-colors cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default StateModal;
