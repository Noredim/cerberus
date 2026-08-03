import React, { useState, useEffect } from 'react';
import {
    X,
    AlertCircle,
    CheckCircle2,
    FileText
} from 'lucide-react';
import { api } from '../../../services/api';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Card } from '../../../components/ui/Card';
import type { NcmStItem, NcmStItemCreate } from '../types';

interface NcmStItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    headerId: string;
    itemToEdit: NcmStItem | null;
    onSuccess: () => void;
}

const NcmStItemModal: React.FC<NcmStItemModalProps> = ({
    isOpen,
    onClose,
    headerId,
    itemToEdit,
    onSuccess
}) => {
    const isEdit = !!itemToEdit;
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState<NcmStItemCreate>({
        ncm_sh: '',
        cest: '',
        mva_percent: null,
        descricao: '',
        segmento_anexo: '',
        vigencia_inicio: '',
        vigencia_fim: '',
        fundamento: '',
        observacoes: '',
        is_active: true
    });

    useEffect(() => {
        if (itemToEdit) {
            setFormData({
                ncm_sh: itemToEdit.ncm_sh || itemToEdit.ncm_normalizado || '',
                cest: itemToEdit.cest || itemToEdit.cest_normalizado || '',
                mva_percent: itemToEdit.mva_percent != null ? Number(itemToEdit.mva_percent) : null,
                descricao: itemToEdit.descricao || '',
                segmento_anexo: itemToEdit.segmento_anexo || '',
                vigencia_inicio: itemToEdit.vigencia_inicio ? itemToEdit.vigencia_inicio.split('T')[0] : '',
                vigencia_fim: itemToEdit.vigencia_fim ? itemToEdit.vigencia_fim.split('T')[0] : '',
                fundamento: itemToEdit.fundamento || '',
                observacoes: itemToEdit.observacoes || '',
                is_active: itemToEdit.is_active ?? true
            });
        } else {
            setFormData({
                ncm_sh: '',
                cest: '',
                mva_percent: null,
                descricao: '',
                segmento_anexo: '',
                vigencia_inicio: '',
                vigencia_fim: '',
                fundamento: '',
                observacoes: '',
                is_active: true
            });
        }
        setError(null);
    }, [itemToEdit, isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        try {
            setSaving(true);
            const payload = {
                ...formData,
                mva_percent: formData.mva_percent === null || formData.mva_percent === undefined || isNaN(Number(formData.mva_percent))
                    ? null
                    : Number(formData.mva_percent),
                vigencia_inicio: formData.vigencia_inicio ? `${formData.vigencia_inicio}T00:00:00` : null,
                vigencia_fim: formData.vigencia_fim ? `${formData.vigencia_fim}T23:59:59` : null
            };

            if (isEdit && itemToEdit) {
                await api.put(`/cadastro/ncm-st/${headerId}/itens/${itemToEdit.id}`, payload);
            } else {
                await api.post(`/cadastro/ncm-st/${headerId}/itens`, payload);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Erro ao salvar item NCM ST:', err);
            setError(err.response?.data?.detail || 'Erro ao salvar item.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300">
            <Card className="w-full max-w-2xl shadow-2xl border-none overflow-hidden max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-border-subtle flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                            <FileText className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-primary">
                                {isEdit ? 'Editar Item NCM ST' : 'Cadastrar Item NCM ST Manual'}
                            </h2>
                            <p className="text-sm text-text-muted">
                                {isEdit ? 'Altere a MVA%, CEST e informações do NCM.' : 'Informe os dados do NCM ST para cadastro manual.'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-bg-deep rounded-full transition-colors">
                        <X className="w-5 h-5 text-text-muted" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
                    {error && (
                        <div className="bg-brand-danger/10 border border-brand-danger/20 text-brand-danger p-3 rounded-md flex items-center gap-2 animate-in slide-in-from-top-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-text-primary">NCM (Código SH) *</label>
                            <Input
                                placeholder="Ex: 8471.30.12"
                                value={formData.ncm_sh || ''}
                                onChange={(e) => setFormData({ ...formData, ncm_sh: e.target.value })}
                                required
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-text-primary">CEST</label>
                            <Input
                                placeholder="Ex: 21.031.00"
                                value={formData.cest || ''}
                                onChange={(e) => setFormData({ ...formData, cest: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-brand-primary">MVA % *</label>
                            <Input
                                type="number"
                                step="0.01"
                                placeholder="Ex: 48.35"
                                value={formData.mva_percent ?? ''}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    mva_percent: e.target.value === '' ? null : parseFloat(e.target.value)
                                })}
                                required
                                className="font-bold text-brand-primary"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-primary">Descrição do Produto / Categoria *</label>
                        <Input
                            placeholder="Ex: Computadores portáteis de peso inferior a 10kg"
                            value={formData.descricao || ''}
                            onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-text-primary">Segmento / Anexo</label>
                            <Input
                                placeholder="Ex: Anexo II - Eletrônicos"
                                value={formData.segmento_anexo || ''}
                                onChange={(e) => setFormData({ ...formData, segmento_anexo: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-text-primary">Fundamento Legal</label>
                            <Input
                                placeholder="Ex: Decreto 12345/2026 Art. 2º"
                                value={formData.fundamento || ''}
                                onChange={(e) => setFormData({ ...formData, fundamento: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-text-primary">Vigência Início</label>
                            <Input
                                type="date"
                                value={formData.vigencia_inicio || ''}
                                onChange={(e) => setFormData({ ...formData, vigencia_inicio: e.target.value })}
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-text-primary">Vigência Fim</label>
                            <Input
                                type="date"
                                value={formData.vigencia_fim || ''}
                                onChange={(e) => setFormData({ ...formData, vigencia_fim: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-primary">Observações</label>
                        <textarea
                            rows={2}
                            className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-primary text-text-primary"
                            placeholder="Observações adicionais..."
                            value={formData.observacoes || ''}
                            onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="w-4 h-4 rounded text-brand-primary focus:ring-brand-primary/20 border-border-subtle"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            <span className="text-sm font-medium text-text-primary">Item Ativo</span>
                        </label>
                    </div>

                    <div className="pt-4 border-t border-border-subtle flex justify-end gap-3 shrink-0">
                        <Button type="button" variant="ghost" onClick={onClose}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={saving} className="bg-brand-primary">
                            {saving ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                    Salvando...
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <CheckCircle2 className="w-4 h-4" />
                                    {isEdit ? 'Salvar Alterações' : 'Cadastrar Item'}
                                </div>
                            )}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
};

export default NcmStItemModal;
