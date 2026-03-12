import React, { useState } from 'react';
import { Plus, Trash2, Save, ShoppingCart, Building2, Package } from 'lucide-react';
import { useOpportunities } from '../hooks/useOpportunities';
import type { OpportunityBudgetManualCreatePayload, OpportunityBudgetItemCreatePayload } from '../types';

interface OpportunityBudgetManualModalProps {
    oppId: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function OpportunityBudgetManualModal({ oppId, isOpen, onClose, onSuccess }: OpportunityBudgetManualModalProps) {
    const { createManualBudget, loading } = useOpportunities();

    const [formData, setFormData] = useState<Omit<OpportunityBudgetManualCreatePayload, 'items'>>({
        tipo_orcamento: 'REVENDA',
        nome_fornecedor_manual: '',
        cnpj_fornecedor: '',
        moeda: 'BRL',
        cambio: 1.0000,
        data_cotacao: new Date().toISOString().split('T')[0],
        aliquota_orcamento: 12.00,
        criar_cenario_difal: false
    });

    const [items, setItems] = useState<OpportunityBudgetItemCreatePayload[]>([{
        codigo_fornecedor: '',
        descricao: '',
        quantidade: 1,
        unidade: 'UN',
        ncm: '',
        ipi_percentual: 0,
        icms_percentual: 0,
        valor_unitario: 0
    }]);

    if (!isOpen) return null;

    const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'cambio' ? parseFloat(value) : value
        }));
    };

    const handleItemChange = (index: number, field: keyof OpportunityBudgetItemCreatePayload, value: string | number) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            [field]: value
        };
        setItems(newItems);
    };

    const addItem = () => {
        setItems(prev => [...prev, {
            codigo_fornecedor: '',
            descricao: '',
            quantidade: 1,
            unidade: 'UN',
            ncm: '',
            ipi_percentual: 0,
            icms_percentual: 0,
            valor_unitario: 0
        }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Remove empty items
        const validItems = items.filter(i => i.descricao?.trim() && Number(i.valor_unitario) > 0);

        if (validItems.length === 0) {
            alert('Adicione pelo menos um item válido (com descrição e valor)');
            return;
        }

        try {
            await createManualBudget(oppId, {
                ...formData,
                items: validItems
            });
            onSuccess();
        } catch (error) {
            console.error(error);
        }
    };

    // calculate totals on the fly
    const valorTotalItens = items.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.valor_unitario)), 0);
    const valorTotalImpostos = items.reduce((acc, item) => {
        const itemTot = Number(item.quantidade) * Number(item.valor_unitario);
        const taxes = (Number(item.ipi_percentual) + Number(item.icms_percentual)) / 100;
        return acc + (itemTot * taxes);
    }, 0);
    const valorTotal = (valorTotalItens + valorTotalImpostos) * Number(formData.cambio);

    const inputClass = "w-full px-3 py-2 rounded-lg border border-divider bg-theme-bg/50 focus:bg-surface focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/10 outline-none transition-all font-medium text-sm";
    const headerInputClass = "w-full px-4 py-3 rounded-xl border border-divider bg-theme-bg/50 focus:bg-surface focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/10 outline-none transition-all font-medium text-sm";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-surface w-full max-w-5xl max-h-[90vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 sm:mx-auto">
                <div className="px-6 py-5 flex items-center justify-between border-b border-divider/50 flex-none bg-surface z-10">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                            <ShoppingCart size={20} />
                        </div>
                        Inserir Orçamento Manual
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-muted hover:text-text-primary hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
                    >
                        ✕
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-theme-bg/30">
                    <form id="manual-budget-form" onSubmit={handleSubmit} className="space-y-8">
                        {/* HEADER SECTION */}
                        <div className="bg-surface p-6 rounded-2xl border border-divider shadow-sm space-y-5">
                            <h3 className="text-sm font-bold text-text-muted flex items-center gap-2 uppercase tracking-wider">
                                <Building2 size={16} /> Dados do Fornecedor e Cotação
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-1.5 lg:col-span-2">
                                    <label className="text-sm font-bold text-text-primary">Nome Fornecedor</label>
                                    <input
                                        type="text"
                                        name="nome_fornecedor_manual"
                                        value={formData.nome_fornecedor_manual}
                                        onChange={handleFormChange}
                                        placeholder="Ex: Dist. XYZ"
                                        required
                                        className={headerInputClass}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-text-primary">CNPJ</label>
                                    <input
                                        type="text"
                                        name="cnpj_fornecedor"
                                        value={formData.cnpj_fornecedor}
                                        onChange={(e) => setFormData(prev => ({ ...prev, cnpj_fornecedor: e.target.value.replace(/\D/g, '') }))}
                                        placeholder="Somente números"
                                        className={headerInputClass}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-text-primary">Data Cotação</label>
                                    <input
                                        type="date"
                                        name="data_cotacao"
                                        value={formData.data_cotacao}
                                        onChange={handleFormChange}
                                        className={headerInputClass}
                                    />
                                </div>

                                <div className="space-y-1.5 lg:col-span-2">
                                    <label className="text-sm font-bold text-text-primary">Tipo do Orçamento</label>
                                    <select
                                        name="tipo_orcamento"
                                        value={formData.tipo_orcamento}
                                        onChange={handleFormChange}
                                        className={headerInputClass}
                                    >
                                        <option value="REVENDA">Revenda (Mercadoria)</option>
                                        <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado (Uso/Consumo)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5 lg:col-span-2">
                                    <label className="text-sm font-bold text-text-primary">Alíquota ICMS Interestadual (NF)</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            step="0.01"
                                            name="aliquota_orcamento"
                                            value={formData.aliquota_orcamento}
                                            onChange={e => setFormData(p => ({ ...p, aliquota_orcamento: parseFloat(e.target.value) || 0 }))}
                                            className={headerInputClass}
                                        />
                                        <span className="text-sm font-bold text-text-muted">%</span>
                                    </div>
                                </div>

                                {formData.tipo_orcamento === 'REVENDA' && (
                                    <div className="space-y-1.5 lg:col-span-2 flex items-center">
                                        <label className="flex items-center gap-2 cursor-pointer mt-6">
                                            <input
                                                type="checkbox"
                                                checked={formData.criar_cenario_difal}
                                                onChange={e => setFormData(p => ({ ...p, criar_cenario_difal: e.target.checked }))}
                                                className="w-4 h-4 text-brand-primary border-border-subtle rounded focus:ring-brand-primary"
                                            />
                                            <span className="text-sm font-bold text-text-primary">Criar Cenário DIFAL-ST (Simulação)</span>
                                        </label>
                                    </div>
                                )}
                                
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-text-primary">Moeda</label>
                                    <select
                                        name="moeda"
                                        value={formData.moeda}
                                        onChange={handleFormChange}
                                        className={headerInputClass}
                                    >
                                        <option value="BRL">BRL - Real</option>
                                        <option value="USD">USD - Dólar</option>
                                        <option value="EUR">EUR - Euro</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-sm font-bold text-text-primary">Câmbio</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        name="cambio"
                                        value={formData.cambio}
                                        onChange={handleFormChange}
                                        disabled={formData.moeda === 'BRL'}
                                        className={headerInputClass}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* ITEMS GRID */}
                        <div className="bg-surface p-6 rounded-2xl border border-divider shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-text-muted flex items-center gap-2 uppercase tracking-wider">
                                    <Package size={16} /> Itens Cotados
                                </h3>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="flex items-center gap-1.5 text-sm font-bold text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-lg hover:bg-brand-primary/20 transition-colors cursor-pointer"
                                >
                                    <Plus size={16} /> Adicionar Linha
                                </button>
                            </div>

                            <div className="overflow-x-auto w-full border border-divider rounded-xl">
                                <table className="w-full text-left text-sm min-w-[800px]">
                                    <thead className="bg-theme-bg/80 border-b border-divider">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-text-muted w-32">Código</th>
                                            <th className="px-4 py-3 font-semibold text-text-muted min-w-[200px]">Descrição</th>
                                            <th className="px-4 py-3 font-semibold text-text-muted w-24">Qtd</th>
                                            <th className="px-4 py-3 font-semibold text-text-muted w-20">UN</th>
                                            <th className="px-4 py-3 font-semibold text-text-muted w-28">NCM</th>
                                            <th className="px-4 py-3 font-semibold text-text-muted w-20">% IPI</th>
                                            <th className="px-4 py-3 font-semibold text-text-muted w-20">% ICMS</th>
                                            <th className="px-4 py-3 font-semibold text-text-muted w-32">Vlr. Unitário</th>
                                            <th className="px-4 py-3 font-semibold text-center w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-divider">
                                        {items.map((item, index) => (
                                            <tr key={index} className="bg-surface hover:bg-theme-bg/30 transition-colors group">
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Cód"
                                                        value={item.codigo_fornecedor}
                                                        onChange={(e) => handleItemChange(index, 'codigo_fornecedor', e.target.value)}
                                                        className={inputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        placeholder="Descrição do item..."
                                                        value={item.descricao}
                                                        onChange={(e) => handleItemChange(index, 'descricao', e.target.value)}
                                                        required
                                                        className={inputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        step="0.0001"
                                                        value={item.quantidade}
                                                        onChange={(e) => handleItemChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                                                        required
                                                        className={inputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        value={item.unidade}
                                                        onChange={(e) => handleItemChange(index, 'unidade', e.target.value.toUpperCase())}
                                                        className={inputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="text"
                                                        placeholder="NCM"
                                                        value={item.ncm}
                                                        onChange={(e) => handleItemChange(index, 'ncm', e.target.value.replace(/\D/g, ''))}
                                                        className={inputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.ipi_percentual}
                                                        onChange={(e) => handleItemChange(index, 'ipi_percentual', parseFloat(e.target.value) || 0)}
                                                        className={inputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.icms_percentual}
                                                        onChange={(e) => handleItemChange(index, 'icms_percentual', parseFloat(e.target.value) || 0)}
                                                        className={inputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        placeholder="Vlr UN"
                                                        value={item.valor_unitario}
                                                        onChange={(e) => handleItemChange(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                                                        required
                                                        className={inputClass}
                                                    />
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(index)}
                                                        disabled={items.length === 1}
                                                        className="p-1.5 text-text-muted hover:text-status-danger hover:bg-red-50 rounded-md transition-colors disabled:opacity-30"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </form>
                </div>

                {/* FOOTER */}
                <div className="px-6 py-4 flex items-center justify-between border-t border-divider/50 bg-surface flex-none">
                    <div className="flex items-center gap-6">
                        <div>
                            <span className="text-xs text-text-muted uppercase font-bold tracking-wider block">Total Itens</span>
                            <span className="font-medium text-text-primary">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalItens)}
                            </span>
                        </div>
                        <div>
                            <span className="text-xs text-text-muted uppercase font-bold tracking-wider block">Impostos</span>
                            <span className="font-medium text-status-warning">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalImpostos)}
                            </span>
                        </div>
                        <div className="pl-6 border-l border-divider">
                            <span className="text-xs text-text-muted uppercase font-bold tracking-wider block text-brand-primary">Valor Total Orçamento</span>
                            <span className="font-bold text-brand-primary text-xl">
                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: formData.moeda === 'BRL' ? 'BRL' : formData.moeda }).format(valorTotal)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-theme-bg font-semibold transition-colors cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            form="manual-budget-form"
                            disabled={loading}
                            className="px-8 py-2.5 rounded-xl bg-brand-primary text-white font-bold hover:bg-brand-primary/90 hover:shadow-lg hover:shadow-brand-primary/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Salvando...
                                </>
                            ) : (
                                <>
                                    <Save size={18} />
                                    Salvar Orçamento
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
