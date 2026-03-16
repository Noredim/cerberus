import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, ShoppingCart, Building2, Package, Loader2, Truck, UserPlus, X, CheckCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { productApi } from '../api/productApi';
import { api } from '../../../services/api';
export interface OpportunityBudgetItemCreatePayload {
    codigo_fornecedor?: string;
    descricao: string;
    quantidade: number;
    unidade: string;
    ncm?: string;
    ipi_percentual: number;
    icms_percentual: number;
    valor_unitario: number;
    produto_id: string;
}

export interface OpportunityBudgetManualCreatePayload {
    tipo_orcamento: 'REVENDA' | 'ATIVO_IMOBILIZADO';
    nome_fornecedor_manual?: string;
    cnpj_fornecedor?: string;
    fornecedor_id?: string;
    moeda: string;
    cambio: number;
    data_cotacao: string;
    aliquota_orcamento: number;
    criar_cenario_difal: boolean;
    items: OpportunityBudgetItemCreatePayload[];
}

interface Supplier {
    id: string;
    razao_social: string;
    nome_fantasia?: string;
    cnpj: string;
}

interface ProductBudgetManualModalProps {
    productId: string;
    productName: string;
    productSku: string;
    productNcm: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export function ProductBudgetManualModal({ productId, productName, productSku, productNcm, isOpen, onClose, onSuccess }: ProductBudgetManualModalProps) {
    const [loading, setLoading] = useState(false);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [savingSupplier, setSavingSupplier] = useState(false);
    const [showNewSupplierForm, setShowNewSupplierForm] = useState(false);
    const [newSupplierData, setNewSupplierData] = useState({
        cnpj: '',
        razao_social: '',
        nome_fantasia: '',
        email: '',
        telefone: ''
    });
    const [newSupplierError, setNewSupplierError] = useState('');

    // Supplier selected from catalog
    const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');

    // Freight state (Bug 5)
    const [modalidadeFrete, setModalidadeFrete] = useState<'CIF' | 'FOB'>('CIF');
    const [fretePercent, setFretePercent] = useState<number>(0);

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
        codigo_fornecedor: productSku || '',
        descricao: productName || '',
        quantidade: 1,
        unidade: 'UN',
        ncm: productNcm || '',
        ipi_percentual: 0,
        icms_percentual: 0,
        valor_unitario: 0,
        produto_id: productId
    }]);

    useEffect(() => {
        if (isOpen) {
            api.get('/cadastro/fornecedores').then(res => setSuppliers(res.data)).catch(() => { });
        }
    }, [isOpen]);

    const handleSaveNewSupplier = async () => {
        if (!newSupplierData.razao_social.trim() || !newSupplierData.cnpj.trim()) {
            setNewSupplierError('CNPJ e Razão Social são obrigatórios.');
            return;
        }
        setSavingSupplier(true);
        setNewSupplierError('');
        try {
            const res = await api.post('/cadastro/fornecedores', {
                ...newSupplierData,
                cnpj: newSupplierData.cnpj.replace(/\D/g, ''),
                active: true
            });
            const created: Supplier = res.data;
            setSuppliers(prev => [...prev, created]);
            setSelectedSupplierId(created.id);
            setShowNewSupplierForm(false);
            setNewSupplierData({ cnpj: '', razao_social: '', nome_fantasia: '', email: '', telefone: '' });
        } catch (err: any) {
            const detail = err.response?.data?.detail || 'Erro ao cadastrar fornecedor.';
            setNewSupplierError(typeof detail === 'string' ? detail : JSON.stringify(detail));
        } finally {
            setSavingSupplier(false);
        }
    };

    if (!isOpen) return null;

    const handleItemChange = (index: number, field: keyof OpportunityBudgetItemCreatePayload, value: string | number) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
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
            valor_unitario: 0,
            produto_id: productId
        }]);
    };

    const removeItem = (index: number) => {
        if (items.length > 1) {
            setItems(prev => prev.filter((_, i) => i !== index));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const validItems = items.filter(i => i.descricao?.trim() && Number(i.valor_unitario) > 0);

        if (validItems.length === 0) {
            alert('Adicione pelo menos um item válido (com descrição e valor)');
            setLoading(false);
            return;
        }

        // Build the payload — use supplier from catalog if selected
        const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);
        const payload = {
            ...formData,
            fornecedor_id: selectedSupplierId || undefined,
            nome_fornecedor_manual: selectedSupplierId ? undefined : formData.nome_fornecedor_manual,
            cnpj_fornecedor: selectedSupplier?.cnpj || formData.cnpj_fornecedor,
            items: validItems
        };

        try {
            await productApi.createManualBudget(productId, payload);
            onSuccess();
        } catch (error: any) {
            console.error(error);
            alert('Erro ao salvar orçamento: ' + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
        }
    };

    // Freight calculations (Bug 5)
    const totalQtd = items.reduce((acc, i) => acc + Number(i.quantidade), 0);
    const valorTotalItens = items.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.valor_unitario)), 0);
    const freteTotal = modalidadeFrete === 'FOB' ? valorTotalItens * (fretePercent / 100) : 0;
    const freteUnitario = totalQtd > 0 ? freteTotal / totalQtd : 0;

    // IPI included in cost (Bug 6)
    const getCustoUnitFinal = (item: OpportunityBudgetItemCreatePayload) => {
        const ipiAmt = Number(item.valor_unitario) * (Number(item.ipi_percentual) / 100);
        return Number(item.valor_unitario) + ipiAmt + freteUnitario;
    };

    const valorTotalImpostos = items.reduce((acc, item) => {
        const itemBase = Number(item.quantidade) * Number(item.valor_unitario);
        const taxes = Number(item.ipi_percentual) / 100; // ICMS is informational only — not included in price formation
        return acc + (itemBase * taxes);
    }, 0);
    const valorTotal = (valorTotalItens + valorTotalImpostos + freteTotal) * Number(formData.cambio);

    const inputClass = "w-full px-3 py-2 rounded-lg border border-border-subtle bg-bg-deep/50 focus:bg-surface focus:border-brand-primary outline-none transition-all text-sm";
    const headerInputClass = "w-full px-4 py-3 rounded-xl border border-border-subtle bg-bg-deep/50 focus:bg-surface focus:border-brand-primary outline-none transition-all text-sm";
    const fmtCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-surface w-full max-w-[95vw] max-h-[95vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="px-6 py-5 flex items-center justify-between border-b border-border-subtle flex-none bg-surface z-10">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                            <ShoppingCart size={20} />
                        </div>
                        Lançamento Avulso de Orçamento
                    </h2>
                    <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-xl transition-colors cursor-pointer">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-bg-deep/10">
                    <form id="product-budget-form" onSubmit={handleSubmit} className="space-y-6">

                        {/* Bloco: Fornecedor */}
                        <div className="bg-surface p-6 rounded-2xl border border-border-subtle shadow-sm space-y-5">
                            <h3 className="text-sm font-bold text-text-muted flex items-center gap-2 uppercase tracking-wider">
                                <Building2 size={16} /> Dados do Fornecedor e Cotação
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="space-y-4">
                                    <div className="flex items-end gap-3">
                                        <div className="flex-1 space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Fornecedor (Cadastro)</label>
                                            <select
                                                value={selectedSupplierId}
                                                onChange={e => setSelectedSupplierId(e.target.value)}
                                                className={headerInputClass}
                                            >
                                                <option value="">— Selecione ou preencha abaixo —</option>
                                                {suppliers.map(s => (
                                                    <option key={s.id} value={s.id}>
                                                        {s.nome_fantasia || s.razao_social}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => { setShowNewSupplierForm(v => !v); setNewSupplierError(''); }}
                                            className={`flex items-center gap-1.5 px-4 py-3 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${showNewSupplierForm
                                                ? 'bg-brand-danger/10 text-brand-danger border border-brand-danger/30 hover:bg-brand-danger/20'
                                                : 'bg-brand-primary/10 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/20'
                                                }`}
                                            title={showNewSupplierForm ? 'Cancelar' : 'Cadastrar novo fornecedor'}
                                        >
                                            {showNewSupplierForm ? <><X size={14} /> Cancelar</> : <><UserPlus size={14} /> Novo Fornecedor</>}
                                        </button>
                                    </div>

                                    {/* Inline quick-add supplier form */}
                                    <AnimatePresence>
                                        {showNewSupplierForm && (
                                            <motion.div
                                                initial={{ opacity: 0, height: 0 }}
                                                animate={{ opacity: 1, height: 'auto' }}
                                                exit={{ opacity: 0, height: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="p-5 bg-brand-primary/5 border border-brand-primary/20 rounded-xl space-y-4">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <UserPlus size={15} className="text-brand-primary" />
                                                        <p className="text-sm font-bold text-brand-primary">Cadastro Rápido de Fornecedor</p>
                                                    </div>

                                                    {newSupplierError && (
                                                        <div className="px-4 py-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-xs text-red-500 font-medium">
                                                            {newSupplierError}
                                                        </div>
                                                    )}

                                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">CNPJ *</label>
                                                            <input
                                                                type="text"
                                                                maxLength={18}
                                                                placeholder="00.000.000/0001-00"
                                                                value={newSupplierData.cnpj}
                                                                onChange={e => setNewSupplierData(p => ({ ...p, cnpj: e.target.value }))}
                                                                className={headerInputClass}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5 lg:col-span-2">
                                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Razão Social *</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Nome completo da empresa"
                                                                value={newSupplierData.razao_social}
                                                                onChange={e => setNewSupplierData(p => ({ ...p, razao_social: e.target.value }))}
                                                                className={headerInputClass}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome Fantasia</label>
                                                            <input
                                                                type="text"
                                                                placeholder="Nome comercial"
                                                                value={newSupplierData.nome_fantasia}
                                                                onChange={e => setNewSupplierData(p => ({ ...p, nome_fantasia: e.target.value }))}
                                                                className={headerInputClass}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">E-mail</label>
                                                            <input
                                                                type="email"
                                                                placeholder="contato@empresa.com"
                                                                value={newSupplierData.email}
                                                                onChange={e => setNewSupplierData(p => ({ ...p, email: e.target.value }))}
                                                                className={headerInputClass}
                                                            />
                                                        </div>
                                                        <div className="space-y-1.5">
                                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Telefone</label>
                                                            <input
                                                                type="text"
                                                                placeholder="(00) 00000-0000"
                                                                value={newSupplierData.telefone}
                                                                onChange={e => setNewSupplierData(p => ({ ...p, telefone: e.target.value }))}
                                                                className={headerInputClass}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="flex justify-end">
                                                        <button
                                                            type="button"
                                                            onClick={handleSaveNewSupplier}
                                                            disabled={savingSupplier}
                                                            className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold hover:bg-brand-primary/90 transition-all shadow-md cursor-pointer disabled:opacity-50"
                                                        >
                                                            {savingSupplier
                                                                ? <><Loader2 size={16} className="animate-spin" />Salvando...</>
                                                                : <><CheckCircle size={16} />Salvar e Selecionar</>}
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {!selectedSupplierId && (
                                    <div className="space-y-1.5 lg:col-span-2">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome Manual (se não cadastrado)</label>
                                        <input
                                            type="text"
                                            name="nome_fornecedor_manual"
                                            value={formData.nome_fornecedor_manual}
                                            onChange={e => setFormData(p => ({ ...p, nome_fornecedor_manual: e.target.value }))}
                                            placeholder="Ex: Dist. XYZ"
                                            className={headerInputClass}
                                        />
                                    </div>
                                )}

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Data Cotação</label>
                                    <input
                                        type="date"
                                        name="data_cotacao"
                                        value={formData.data_cotacao}
                                        onChange={e => setFormData(p => ({ ...p, data_cotacao: e.target.value }))}
                                        className={headerInputClass}
                                    />
                                </div>

                                <div className="space-y-1.5 lg:col-span-2">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo do Orçamento</label>
                                    <select
                                        name="tipo_orcamento"
                                        value={formData.tipo_orcamento}
                                        onChange={e => setFormData(p => ({ ...p, tipo_orcamento: e.target.value as 'REVENDA' | 'ATIVO_IMOBILIZADO' }))}
                                        className={headerInputClass}
                                    >
                                        <option value="REVENDA">Revenda (Mercadoria)</option>
                                        <option value="ATIVO_IMOBILIZADO">Ativo Imobilizado (Uso/Consumo)</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5 lg:col-span-2">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Alíquota ICMS Interestadual (NF)</label>
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
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Moeda</label>
                                    <select
                                        name="moeda"
                                        value={formData.moeda}
                                        onChange={e => setFormData(p => ({ ...p, moeda: e.target.value }))}
                                        className={headerInputClass}
                                    >
                                        <option value="BRL">BRL - Real</option>
                                        <option value="USD">USD - Dólar</option>
                                        <option value="EUR">EUR - Euro</option>
                                    </select>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Câmbio</label>
                                    <input
                                        type="number"
                                        step="0.0001"
                                        name="cambio"
                                        value={formData.cambio}
                                        onChange={e => setFormData(p => ({ ...p, cambio: parseFloat(e.target.value) }))}
                                        disabled={formData.moeda === 'BRL'}
                                        className={headerInputClass}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Bug 5: Frete CIF/FOB */}
                        <div className="bg-surface p-6 rounded-2xl border border-border-subtle shadow-sm">
                            <h3 className="text-sm font-bold text-text-muted flex items-center gap-2 uppercase tracking-wider mb-4">
                                <Truck size={16} /> Frete
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Modalidade</label>
                                    <select
                                        value={modalidadeFrete}
                                        onChange={e => {
                                            setModalidadeFrete(e.target.value as 'CIF' | 'FOB');
                                            if (e.target.value === 'CIF') setFretePercent(0);
                                        }}
                                        className={headerInputClass}
                                    >
                                        <option value="CIF">CIF — Por conta do Remetente</option>
                                        <option value="FOB">FOB — Por conta do Destinatário</option>
                                    </select>
                                </div>

                                {modalidadeFrete === 'FOB' && (
                                    <>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">% Frete sobre Total dos Itens</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                min="0"
                                                value={fretePercent}
                                                onChange={e => setFretePercent(parseFloat(e.target.value) || 0)}
                                                className={headerInputClass}
                                                placeholder="Ex: 10.00"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Frete Calculado</label>
                                            <div className="flex gap-4 items-center py-3 px-4 bg-bg-deep rounded-xl border border-border-subtle">
                                                <div>
                                                    <p className="text-[10px] text-text-muted uppercase font-bold">Total Frete</p>
                                                    <p className="font-bold text-text-primary text-sm">{fmtCurrency(freteTotal)}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-text-muted uppercase font-bold">Frete/Unit</p>
                                                    <p className="font-bold text-brand-primary text-sm">{fmtCurrency(freteUnitario)}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Itens */}
                        <div className="bg-surface p-6 rounded-2xl border border-border-subtle shadow-sm space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-text-muted flex items-center gap-2 uppercase tracking-wider">
                                    <Package size={16} /> Itens Cotados
                                </h3>
                                <button
                                    type="button"
                                    onClick={addItem}
                                    className="flex items-center gap-1.5 text-xs font-bold text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-lg hover:bg-brand-primary/20 transition-colors cursor-pointer"
                                >
                                    <Plus size={16} /> Adicionar Item
                                </button>
                            </div>

                            <div className="overflow-x-auto w-full border border-border-subtle rounded-xl">
                                <table className="w-full text-left text-xs min-w-[1100px]">
                                    <thead className="bg-bg-deep border-b border-border-subtle">
                                        <tr>
                                            <th className="px-3 py-3 font-bold text-text-muted w-32">Código</th>
                                            <th className="px-3 py-3 font-bold text-text-muted min-w-[200px]">Descrição</th>
                                            <th className="px-3 py-3 font-bold text-text-muted w-20">Qtd</th>
                                            <th className="px-3 py-3 font-bold text-text-muted w-20">UN</th>
                                            <th className="px-3 py-3 font-bold text-text-muted w-28">NCM</th>
                                            <th className="px-3 py-3 font-bold text-text-muted w-24">% IPI</th>
                                            <th className="px-3 py-3 font-bold text-amber-500 w-24">% ICMS</th>
                                            <th className="px-3 py-3 font-bold text-text-muted w-28">Vlr. Unitário</th>
                                            <th className="px-3 py-3 font-bold text-brand-primary w-32">Custo Unit. Final</th>
                                            <th className="px-3 py-3 w-10 text-center"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-border-subtle">
                                        {items.map((item, index) => (
                                            <tr key={index} className="bg-surface hover:bg-bg-deep/30 transition-colors">
                                                <td className="px-3 py-2">
                                                    <input type="text" value={item.codigo_fornecedor}
                                                        onChange={(e) => handleItemChange(index, 'codigo_fornecedor', e.target.value)}
                                                        className={inputClass} />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input type="text" value={item.descricao}
                                                        onChange={(e) => handleItemChange(index, 'descricao', e.target.value)}
                                                        required className={inputClass} />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input type="number" step="0.0001" value={item.quantidade}
                                                        onChange={(e) => handleItemChange(index, 'quantidade', parseFloat(e.target.value) || 0)}
                                                        required className={inputClass} />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input type="text" value={item.unidade}
                                                        onChange={(e) => handleItemChange(index, 'unidade', e.target.value.toUpperCase())}
                                                        className={inputClass} />
                                                </td>
                                                <td className="px-3 py-2">
                                                    {/* NCM is read-only — comes from product cadastro */}
                                                    <div className="flex flex-col gap-0.5">
                                                        <div className="px-3 py-2 bg-bg-deep/50 border border-border-subtle rounded-lg text-text-muted text-xs font-mono cursor-not-allowed select-none">
                                                            {item.ncm || productNcm || '—'}
                                                        </div>
                                                        <span className="text-[9px] text-brand-primary font-bold uppercase tracking-wider">Do cadastro</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input type="number" step="0.01" min="0" value={item.ipi_percentual}
                                                        onChange={(e) => handleItemChange(index, 'ipi_percentual', parseFloat(e.target.value) || 0)}
                                                        className={inputClass} />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input type="number" step="0.01" min="0" value={item.icms_percentual}
                                                        onChange={(e) => handleItemChange(index, 'icms_percentual', parseFloat(e.target.value) || 0)}
                                                        className={`${inputClass} border-amber-500/30 focus:border-amber-500`} />
                                                </td>
                                                <td className="px-3 py-2">
                                                    <input type="number" step="0.01" value={item.valor_unitario}
                                                        onChange={(e) => handleItemChange(index, 'valor_unitario', parseFloat(e.target.value) || 0)}
                                                        required className={inputClass} />
                                                </td>
                                                {/* Bug 6: Computed final cost */}
                                                <td className="px-3 py-2">
                                                    <div className="px-3 py-2 bg-brand-primary/5 border border-brand-primary/20 rounded-lg text-brand-primary font-bold text-right">
                                                        {fmtCurrency(getCustoUnitFinal(item))}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <button type="button" onClick={() => removeItem(index)} disabled={items.length === 1}
                                                        className="p-1.5 text-text-muted hover:text-brand-danger hover:bg-brand-danger/10 rounded-md transition-colors disabled:opacity-30 cursor-pointer">
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

                <div className="px-6 py-4 flex items-center justify-between border-t border-border-subtle bg-surface flex-none">
                    <div className="flex items-center gap-6">
                        <div>
                            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Total Itens</span>
                            <span className="font-bold text-text-primary text-sm">{fmtCurrency(valorTotalItens)}</span>
                        </div>
                        {modalidadeFrete === 'FOB' && (
                            <div>
                                <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Frete FOB</span>
                                <span className="font-bold text-amber-600 text-sm">{fmtCurrency(freteTotal)}</span>
                            </div>
                        )}
                        <div>
                            <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider block">Impostos</span>
                            <span className="font-bold text-brand-warning text-sm">{fmtCurrency(valorTotalImpostos)}</span>
                        </div>
                        <div className="pl-6 border-l border-border-subtle">
                            <span className="text-[10px] text-brand-primary uppercase font-bold tracking-wider block">Total Geral</span>
                            <span className="font-black text-brand-primary text-lg">
                                {fmtCurrency(valorTotal)}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button type="button" onClick={onClose}
                            className="px-6 py-2.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-deep font-bold transition-colors cursor-pointer text-sm">
                            Cancelar
                        </button>
                        <button type="submit" form="product-budget-form" disabled={loading}
                            className="px-8 py-2.5 rounded-lg bg-brand-primary text-white font-bold hover:bg-brand-primary/90 hover:shadow-lg transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 text-sm">
                            {loading ? (
                                <><Loader2 className="w-4 h-4 animate-spin" />Salvando...</>
                            ) : (
                                <><Save size={18} />Salvar Orçamento</>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
