import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import { api } from '../../services/api';

interface CityModalProps {
    isOpen: boolean;
    onClose: () => void;
    cityData?: any;
    states: any[]; // List of states for the dropdown
    onSuccess: () => void;
}

const CityModal: React.FC<CityModalProps> = ({ isOpen, onClose, cityData, states, onSuccess }) => {
    const isEditing = !!cityData;
    const [formData, setFormData] = useState({
        nome: '',
        state_id: '',
        ibge_id: '',
        microregiao: '',
        mesorregiao: '',
        is_active: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (cityData) {
            setFormData({
                nome: cityData.nome || '',
                state_id: cityData.state_id || '',
                ibge_id: cityData.ibge_id?.toString() || '',
                microregiao: cityData.microregiao || '',
                mesorregiao: cityData.mesorregiao || '',
                is_active: cityData.is_active !== undefined ? cityData.is_active : true
            });
        } else {
            setFormData({
                nome: '',
                state_id: '',
                ibge_id: '',
                microregiao: '',
                mesorregiao: '',
                is_active: true
            });
        }
        setError(null);
    }, [cityData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const payload = {
                ...formData,
                ibge_id: parseInt(formData.ibge_id, 10),
            };

            if (isEditing) {
                await api.put(`/catalog/cities/${cityData.id}`, payload);
            } else {
                await api.post('/catalog/cities', payload);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Ocorreu um erro ao salvar o município.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={isEditing ? 'Editar Município' : 'Novo Município'}
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
                        <label className="text-sm font-medium text-text-primary">Nome do Município *</label>
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
                        <label className="text-sm font-medium text-text-primary">Estado vinculado *</label>
                        <select
                            required
                            value={formData.state_id}
                            onChange={e => setFormData({ ...formData, state_id: e.target.value })}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                            disabled={isEditing}
                        >
                            <option value="">Selecione um Estado</option>
                            {states.map(s => (
                                <option key={s.id} value={s.id}>{s.nome} ({s.sigla})</option>
                            ))}
                        </select>
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
                            placeholder="Ex: 3550308"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-text-primary">Microrregião</label>
                        <input
                            type="text"
                            value={formData.microregiao}
                            onChange={e => setFormData({ ...formData, microregiao: e.target.value })}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                            placeholder="Ex: São Paulo"
                        />
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-text-primary">Mesorregião</label>
                        <input
                            type="text"
                            value={formData.mesorregiao}
                            onChange={e => setFormData({ ...formData, mesorregiao: e.target.value })}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm text-text-primary focus:border-brand-primary outline-none"
                            placeholder="Ex: Metropolitana de São Paulo"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                    <input
                        type="checkbox"
                        id="is_active_city"
                        checked={formData.is_active}
                        onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                        className="rounded border-border-subtle text-brand-primary focus:ring-brand-primary h-4 w-4"
                    />
                    <label htmlFor="is_active_city" className="text-sm text-text-primary">
                        Município Ativo
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

export default CityModal;
