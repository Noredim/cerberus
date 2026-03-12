import React, { useState, useEffect } from 'react';
import { FileSpreadsheet, Trash2, UploadCloud, Building2, Calendar, FileText, Download } from 'lucide-react';
import { useOpportunities } from '../hooks/useOpportunities';
import { OpportunityBudgetManualModal } from './OpportunityBudgetManualModal';
import { OpportunityBudgetDetailsModal } from './OpportunityBudgetDetailsModal';
import type { OpportunityBudget } from '../types';

interface OpportunityOrcamentosProps {
    oppId: string;
}

export function OpportunityOrcamentos({ oppId }: OpportunityOrcamentosProps) {
    const { getBudgets, uploadBudgetExcel, deleteBudget, downloadBudgetTemplate, loading } = useOpportunities();
    const [budgets, setBudgets] = useState<OpportunityBudget[]>([]);

    // Modal State
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);

    // Form State
    const [file, setFile] = useState<File | null>(null);
    const [tipoOrcamento, setTipoOrcamento] = useState<'REVENDA' | 'ATIVO_IMOBILIZADO'>('REVENDA');

    useEffect(() => {
        loadBudgets();
    }, [oppId]);

    const loadBudgets = async () => {
        try {
            const data = await getBudgets(oppId);
            setBudgets(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleUploadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) return;

        try {
            const result = await uploadBudgetExcel(
                oppId,
                file,
                tipoOrcamento
            );

            if (result.is_new_supplier) {
                alert(`Fornecedor cadastrado automaticamente com o CNPJ ${result.cnpj_fornecedor}!`);
            }

            closeModal();
            await loadBudgets();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (budgetId: string) => {
        if (window.confirm('Tem certeza que deseja apagar este orçamento e todos os seus itens?')) {
            try {
                await deleteBudget(budgetId);
                await loadBudgets();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const closeModal = () => {
        setIsUploadModalOpen(false);
        setFile(null);
        setTipoOrcamento('REVENDA');
    };

    const handleDownloadTemplate = async () => {
        await downloadBudgetTemplate();
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Actions */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-text-primary">Orçamentos de Fornecedores</h2>
                    <p className="text-sm text-text-muted mt-1">
                        Importe planilhas Excel para adicionar itens de terceiros rapidamente.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleDownloadTemplate}
                        className="flex items-center gap-2 bg-white border border-divider text-text-primary px-4 py-2.5 rounded-xl hover:bg-theme-bg transition-colors font-medium shadow-sm"
                    >
                        <Download size={18} /> Baixar Modelo
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsManualModalOpen(true)}
                        className="flex items-center gap-2 bg-white border border-divider text-text-primary px-4 py-2.5 rounded-xl hover:bg-theme-bg transition-colors font-medium shadow-sm"
                    >
                        <FileText size={18} /> Cadastrar Manualmente
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 bg-brand-primary text-white px-4 py-2.5 rounded-xl hover:bg-brand-primary/90 transition-colors font-medium shadow-sm"
                    >
                        <UploadCloud size={18} /> Importar XLSX
                    </button>
                </div>
            </div>

            {/* Empty State */}
            {!loading && budgets.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 bg-surface rounded-2xl border border-dashed border-divider">
                    <div className="w-16 h-16 rounded-full bg-theme-bg flex items-center justify-center mb-4">
                        <FileSpreadsheet size={32} className="text-brand-primary" />
                    </div>
                    <h3 className="text-lg font-bold text-text-primary mb-2">Nenhum orçamento importado</h3>
                    <p className="text-sm text-text-muted text-center max-w-sm mb-6">
                        Você pode subir planilhas de fornecedores e transformar as linhas em itens orçamentários rastreáveis.
                    </p>
                    <button
                        onClick={() => setIsUploadModalOpen(true)}
                        className="flex items-center gap-2 text-brand-primary font-medium hover:underline cursor-pointer"
                    >
                        Fazer o primeiro upload <UploadCloud size={16} />
                    </button>
                </div>
            )}

            {/* List of Budgets */}
            {budgets.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {budgets.map((budget) => (
                        <div key={budget.id} className="bg-surface border border-divider rounded-2xl p-5 hover:border-brand-primary/30 transition-colors shadow-sm flex flex-col group">
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg bg-theme-bg text-brand-primary flex items-center justify-center shrink-0">
                                        <Building2 size={20} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-text-primary leading-tight line-clamp-1" title={budget.nome_fornecedor_manual || 'Fornecedor Genérico'}>
                                            {budget.nome_fornecedor_manual || 'Fornecedor Genérico'}
                                        </h3>
                                        <span className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                                            <FileText size={12} /> CNPJ: {budget.cnpj_fornecedor || 'Não informado'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedBudgetId(budget.id)}
                                        className="px-3 py-1.5 text-xs font-bold text-brand-primary bg-brand-primary/10 hover:bg-brand-primary/20 rounded-lg transition-colors"
                                    >
                                        Conferir Itens
                                    </button>
                                    <button
                                        onClick={() => handleDelete(budget.id)}
                                        className="p-1.5 text-text-muted hover:text-status-danger hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                        title="Excluir Orçamento"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>

                            <div className="bg-theme-bg/50 rounded-xl p-4 mb-4 flex-1">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Moeda</span>
                                        <span className="font-medium text-text-primary">{budget.moeda} ({budget.cambio})</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Itens</span>
                                        <span className="font-medium text-text-primary">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(budget.valor_total_itens))}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-text-muted">Impostos</span>
                                        <span className="font-medium text-text-primary">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(budget.valor_total_impostos))}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-divider flex items-center justify-between">
                                <span className="text-xs text-text-muted flex items-center gap-1">
                                    <Calendar size={12} />
                                    {new Date(budget.created_at).toLocaleDateString('pt-BR')}
                                </span>
                                <div className="text-right">
                                    <span className="text-xs text-text-muted block leading-none mb-1">Total (BRL)</span>
                                    <span className="font-bold text-brand-primary text-lg leading-none">
                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(budget.valor_total_orcamento))}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Upload Modal */}
            {isUploadModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={closeModal} />
                    <div className="relative bg-surface w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 sm:mx-auto">
                        <div className="px-6 py-5 flex items-center justify-between border-b border-divider/50">
                            <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                                <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                                    <UploadCloud size={20} />
                                </div>
                                Importar Orçamento
                            </h2>
                            <button
                                onClick={closeModal}
                                className="p-2 text-text-muted hover:text-text-primary hover:bg-theme-bg rounded-xl transition-colors"
                            >
                                ✕
                            </button>
                        </div>
                        <form onSubmit={handleUploadSubmit} className="p-6 space-y-6">

                            {/* File Upload Area */}
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-primary block">Arquivo XLSX / Planilha</label>
                                <div className="relative group">
                                    <input
                                        type="file"
                                        required
                                        accept=".xlsx"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    />
                                    <div className={`w-full border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition-all duration-200
                                        ${file ? 'border-brand-primary bg-brand-primary/5' : 'border-divider bg-theme-bg/30 group-hover:bg-theme-bg/60 group-hover:border-brand-primary/40'}`}>
                                        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${file ? 'bg-brand-primary/20 text-brand-primary' : 'bg-surface text-text-muted group-hover:text-brand-primary shadow-sm'}`}>
                                            <FileSpreadsheet size={28} />
                                        </div>
                                        <p className={`font-semibold text-center text-lg ${file ? 'text-brand-primary' : 'text-text-primary'}`}>
                                            {file ? file.name : "Clique ou arraste a planilha"}
                                        </p>
                                        <p className="text-sm text-text-muted mt-1 text-center font-medium">Somente arquivos .xlsx</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-text-primary block">Tipo do Orçamento</label>
                                <select
                                    className="w-full px-4 py-3 rounded-xl border border-divider bg-theme-bg/50 focus:bg-surface focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all font-medium appearance-none"
                                    value={tipoOrcamento}
                                    onChange={(e) => setTipoOrcamento(e.target.value as 'REVENDA' | 'ATIVO_IMOBILIZADO')}
                                >
                                    <option value="REVENDA">Revenda (Mercadoria para Venda)</option>
                                    <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado (Uso/Consumo)</option>
                                </select>
                            </div>

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-5 py-2.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-theme-bg font-semibold transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !file}
                                    className="px-6 py-2.5 rounded-xl bg-brand-primary text-white font-semibold hover:bg-brand-primary/90 hover:shadow-lg hover:shadow-brand-primary/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
                                >
                                    {loading ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Importando...
                                        </>
                                    ) : (
                                        <>
                                            <UploadCloud size={18} />
                                            Importar Dados
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manual Entry Modal */}
            <OpportunityBudgetManualModal
                oppId={oppId}
                isOpen={isManualModalOpen}
                onClose={() => setIsManualModalOpen(false)}
                onSuccess={() => {
                    setIsManualModalOpen(false);
                    loadBudgets();
                }}
            />

            {/* Grid de Conferência Modal */}
            <OpportunityBudgetDetailsModal
                oppId={oppId}
                budgetId={selectedBudgetId}
                isOpen={!!selectedBudgetId}
                onClose={() => {
                    setSelectedBudgetId(null);
                    loadBudgets();
                }}
            />
        </div>
    );
}
