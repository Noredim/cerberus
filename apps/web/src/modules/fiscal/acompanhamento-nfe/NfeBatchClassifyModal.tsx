import React, { useState } from 'react';
import { X, Layers, CheckCircle2, Loader2 } from 'lucide-react';
import { api } from '../../../services/api';

interface NfeBatchClassifyModalProps {
    isOpen: boolean;
    selectedIds: string[];
    selectAllMatching?: boolean;
    totalMatchingCount?: number;
    filterParams?: Record<string, any>;
    onClose: () => void;
    onSuccess: () => void;
}

const APLICACOES_OPTIONS = [
    { value: 'REVENDA', label: 'Revenda' },
    { value: 'MATERIAL_APLICADO', label: 'Material Aplicado' },
    { value: 'MATERIAL_COMODATO', label: 'Material para Comodato' },
    { value: 'CONSUMO_INTERNO', label: 'Consumo Interno' },
    { value: 'OUTRAS_REMESSAS', label: 'Outras Remessas' },
    { value: 'RETORNO_CONSERTO', label: 'Retorno de Conserto' },
    { value: 'COMBUSTIVEL', label: 'Combustível' },
    { value: 'CANCELAMENTO', label: 'Cancelamento' }
];

const COMPATIBILIDADE_TRIBUTACAO: Record<string, { value: string; label: string }[]> = {
    REVENDA: [
        { value: 'ICMS_ST', label: 'ICMS ST' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    OUTRAS_REMESSAS: [
        { value: 'ICMS_ST', label: 'ICMS ST' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    RETORNO_CONSERTO: [
        { value: 'ICMS_ST', label: 'ICMS ST' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    MATERIAL_APLICADO: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    MATERIAL_COMODATO: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    CONSUMO_INTERNO: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    COMBUSTIVEL: [
        { value: 'DIFAL_ST', label: 'DIFAL ST' },
        { value: 'DIFAL', label: 'DIFAL' },
        { value: 'ST_DESTACADO', label: 'ST Destacado' },
        { value: 'NAO_TRIBUTADA', label: 'Operação Não Tributada' },
        { value: 'OPERACAO_NORMAL', label: 'Operação Normal' }
    ],
    CANCELAMENTO: [
        { value: 'CANCELAMENTO', label: 'Cancelamento' }
    ]
};

export const NfeBatchClassifyModal: React.FC<NfeBatchClassifyModalProps> = ({
    isOpen,
    selectedIds,
    selectAllMatching = false,
    totalMatchingCount = 0,
    filterParams = {},
    onClose,
    onSuccess
}) => {
    const [aplicacao, setAplicacao] = useState('REVENDA');
    const [tipoTributacao, setTipoTributacao] = useState('ICMS_ST');
    const [observacao, setObservacao] = useState('');
    const [submitting, setSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleAplicacaoChange = (newApp: string) => {
        setAplicacao(newApp);
        const permitidas = COMPATIBILIDADE_TRIBUTACAO[newApp] || [];
        if (permitidas.length > 0) {
            setTipoTributacao(permitidas[0].value);
        }
    };

    const countToUpdate = selectAllMatching ? totalMatchingCount : selectedIds.length;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectAllMatching && selectedIds.length === 0) return;

        setSubmitting(true);
        try {
            const payload: Record<string, any> = {
                aplicacao,
                tipo_tributacao: tipoTributacao,
                observacao_classificacao: observacao
            };

            if (selectAllMatching) {
                payload.select_all_matching = true;
                if (filterParams.competencia && filterParams.competencia !== 'ALL') {
                    payload.competencia = filterParams.competencia;
                }
                if (filterParams.search) payload.search = filterParams.search;
                if (filterParams.aplicacao) payload.status_classificacao = filterParams.status_classificacao;
                if (filterParams.uf_emit) payload.uf_emit = filterParams.uf_emit;
                if (filterParams.divergencia_flag) payload.divergencia_flag = filterParams.divergencia_flag;
            } else {
                payload.document_ids = selectedIds;
            }

            const res = await api.put('/fiscal/acompanhamento-nfe/classificacao/lote', payload);
            const updated = res.data?.updated_count ?? countToUpdate;
            alert(`Classificação atualizada com sucesso para ${updated} notas!`);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Erro na reclassificação em lote:', err);
            alert(err.response?.data?.detail || 'Erro ao classificar em lote.');
        } finally {
            setSubmitting(false);
        }
    };

    const tributacoesPermitidas = COMPATIBILIDADE_TRIBUTACAO[aplicacao] || [];

    return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-surface rounded-xl border border-border-subtle shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-5 border-b border-border-subtle bg-bg-deep flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                            <Layers className="w-5 h-5 text-brand-primary" />
                            Classificação em Lote
                        </h2>
                        <p className="text-xs text-text-muted mt-0.5">
                            Aplicar classificação para {countToUpdate} notas {selectAllMatching ? 'da competência (todas as páginas)' : 'selecionadas'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-surface text-text-muted hover:text-text-primary transition-colors cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-primary block">
                            Aplicação <span className="text-brand-danger">*</span>
                        </label>
                        <select
                            value={aplicacao}
                            onChange={e => handleAplicacaoChange(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                        >
                            {APLICACOES_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-primary block">
                            Tipo de Tributação <span className="text-brand-danger">*</span>
                        </label>
                        <select
                            value={tipoTributacao}
                            onChange={e => setTipoTributacao(e.target.value)}
                            className="w-full bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                        >
                            {tributacoesPermitidas.map(opt => (
                                <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-semibold text-text-primary block">
                            Observação da Classificação
                        </label>
                        <textarea
                            rows={3}
                            value={observacao}
                            onChange={e => setObservacao(e.target.value)}
                            placeholder="Motivo da classificação ou nota explicativa..."
                            className="w-full bg-bg-deep border border-border-subtle rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-primary"
                        />
                    </div>

                    <div className="pt-3 flex items-center justify-end gap-3 border-t border-border-subtle">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-border-subtle rounded-lg text-xs font-medium text-text-secondary hover:bg-bg-deep transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 bg-brand-primary text-white rounded-lg text-xs font-semibold hover:bg-brand-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2 cursor-pointer"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Gravando...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Aplicar Classificação ({countToUpdate})
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
