import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Package, Hash, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import { useOpportunities } from '../hooks/useOpportunities';
import { productApi } from '../../products/api/productApi';
import type { OpportunityItem, OpportunityItemKit } from '../types';
import type { Product } from '../../products/types';

interface OpportunityEquipamentosProps {
    oppId: string;
}

export function OpportunityEquipamentos({ oppId }: OpportunityEquipamentosProps) {
    const { getItems, createItem, deleteItem, getKitItems, createKitItem, deleteKitItem, loading } = useOpportunities();

    const [items, setItems] = useState<OpportunityItem[]>([]);
    const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
    const [kitsByItem, setKitsByItem] = useState<Record<string, OpportunityItemKit[]>>({});

    // Modal state
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [kitParentId, setKitParentId] = useState<string | null>(null);
    const [products, setProducts] = useState<Product[]>([]);

    // Form state
    const [selectedProduct, setSelectedProduct] = useState<string>('');
    const [quantidade, setQuantidade] = useState<number>(1);
    const [valorVenda, setValorVenda] = useState<number>(0);

    useEffect(() => {
        loadItems();
        loadProducts();
    }, [oppId]);

    const loadItems = async () => {
        if (!oppId) return;
        try {
            const data = await getItems(oppId);
            setItems(data);
        } catch (error) {
            console.error(error);
        }
    };

    const loadProducts = async () => {
        try {
            const data = await productApi.list();
            setProducts(data);
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteItem = async (itemId: string) => {
        if (window.confirm('Tem certeza que deseja remover este item?')) {
            try {
                await deleteItem(itemId);
                await loadItems();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const toggleExpand = async (itemId: string) => {
        const newExpanded = new Set(expandedItemIds);
        if (newExpanded.has(itemId)) {
            newExpanded.delete(itemId);
            setExpandedItemIds(newExpanded);
        } else {
            newExpanded.add(itemId);
            setExpandedItemIds(newExpanded);
            if (!kitsByItem[itemId]) {
                await loadKits(itemId);
            }
        }
    };

    const loadKits = async (itemId: string) => {
        try {
            const kits = await getKitItems(itemId);
            setKitsByItem(prev => ({ ...prev, [itemId]: kits }));
        } catch (error) {
            console.error(error);
        }
    };

    const handleAddSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (kitParentId) {
                // Adding Kit Item
                await createKitItem(kitParentId, {
                    produto_id: selectedProduct,
                    quantidade: Number(quantidade),
                    observacoes: ''
                });
                await loadKits(kitParentId);
            } else {
                // Adding Main Item
                const product = products.find(p => p.id === selectedProduct);
                await createItem(oppId, {
                    tipo_item: 'PRODUTO',
                    produto_id: selectedProduct,
                    quantidade: Number(quantidade),
                    valor_venda_unitario: Number(valorVenda),
                    descricao_manual: product?.nome || product?.descricao
                });
                await loadItems();
            }

            closeModal();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDeleteKit = async (kitId: string, parentId: string) => {
        if (window.confirm('Remover este sub-item?')) {
            try {
                await deleteKitItem(kitId);
                await loadKits(parentId);
            } catch (error) {
                console.error(error);
            }
        }
    };

    const openModal = (parentId: string | null = null) => {
        setKitParentId(parentId);
        setIsAddModalOpen(true);
    };

    const closeModal = () => {
        setIsAddModalOpen(false);
        setKitParentId(null);
        setSelectedProduct('');
        setQuantidade(1);
        setValorVenda(0);
    };

    // Calculate totals
    const totalItems = items.reduce((acc, item) => acc + (Number(item.quantidade) * Number(item.valor_venda_unitario)), 0);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-end border-b border-divider pb-4">
                <div>
                    <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <Package className="text-brand-primary" size={24} />
                        Itens e Equipamentos
                    </h3>
                    <p className="text-sm text-text-muted mt-1">Gerencie os produtos, recursos e kits vinculados a esta negociação.</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="bg-theme-bg px-4 py-2 rounded-lg border border-divider">
                        <span className="text-xs text-text-muted uppercase font-bold tracking-wider block">Valor Total Itens</span>
                        <span className="text-lg font-bold text-text-primary">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalItems)}
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => openModal(null)}
                        className="flex items-center gap-2 bg-brand-primary text-white px-4 py-3 rounded-xl hover:bg-brand-primary/90 transition-colors font-medium shadow-sm ml-4"
                    >
                        <Plus size={18} /> Adicionar Item
                    </button>
                </div>
            </div>

            {items.length === 0 && !loading ? (
                <div className="py-12 flex flex-col justify-center items-center text-center">
                    <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center border border-divider mb-4">
                        <Package className="text-text-muted" size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-text-primary">Nenhum item adicionado</h3>
                    <p className="text-text-muted max-w-md mt-2 mb-6">
                        Adicione os produtos que farão parte desta oportunidade. Você pode inserir produtos do catálogo ou itens manuais.
                    </p>
                    <button
                        type="button"
                        onClick={() => openModal(null)}
                        className="flex items-center gap-2 bg-white border border-divider text-text-primary px-4 py-2 rounded-lg hover:bg-theme-bg transition-colors font-medium cursor-pointer"
                    >
                        <Plus size={18} /> Iniciar Precificação
                    </button>
                </div>
            ) : (
                <div className="w-full overflow-hidden">
                    <table className="w-full text-left text-sm">
                        <thead className="border-b border-divider">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-text-muted">Descrição do Item</th>
                                <th className="px-6 py-4 font-semibold text-text-muted text-center w-24">Qtd</th>
                                <th className="px-6 py-4 font-semibold text-text-muted text-right w-36">Vlr. Unitário</th>
                                <th className="px-6 py-4 font-semibold text-text-muted text-right w-36">Total</th>
                                <th className="px-6 py-4 font-semibold text-text-muted text-right w-20">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-divider">
                            {items.map((item) => {
                                const total = Number(item.quantidade) * Number(item.valor_venda_unitario);
                                const isExpanded = expandedItemIds.has(item.id);
                                const kits = kitsByItem[item.id] || [];

                                return (
                                    <React.Fragment key={item.id}>
                                        <tr className="hover:bg-theme-bg/50 transition-colors group">
                                            <td className="px-6 py-4 flex items-center gap-3">
                                                <button
                                                    onClick={() => toggleExpand(item.id)}
                                                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-theme-bg text-text-muted hover:text-brand-primary border border-transparent hover:border-divider transition-all cursor-pointer"
                                                >
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-text-primary">
                                                        {item.descricao_manual || 'Item sem descrição'}
                                                    </span>
                                                    <span className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                                                        <Hash size={12} /> {item.tipo_item}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center font-medium">{Number(item.quantidade)}</td>
                                            <td className="px-6 py-4 text-right">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(item.valor_venda_unitario))}
                                            </td>
                                            <td className="px-6 py-4 text-right font-semibold text-brand-primary">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total)}
                                            </td>
                                            <td className="px-6 py-4 text-right flex justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openModal(item.id)}
                                                    className="p-2 text-text-muted hover:text-brand-primary hover:bg-theme-bg rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Adicionar Sub-Item (Kit)"
                                                >
                                                    <Layers size={16} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteItem(item.id)}
                                                    className="p-2 text-text-muted hover:text-status-danger hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    title="Remover Item"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                        {isExpanded && (
                                            <tr className="bg-theme-bg/20">
                                                <td colSpan={5} className="p-0 border-t border-divider">
                                                    <div className="pl-16 pr-6 py-4 border-l-2 border-brand-primary ml-4">
                                                        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3">Composição do Kit ({kits.length})</h4>
                                                        {kits.length > 0 ? (
                                                            <div className="border border-divider rounded-lg bg-surface overflow-hidden">
                                                                <table className="w-full text-xs">
                                                                    <thead className="bg-theme-bg">
                                                                        <tr>
                                                                            <th className="px-4 py-2 font-medium text-text-muted text-left">Produto</th>
                                                                            <th className="px-4 py-2 font-medium text-text-muted text-center w-24">Qtd</th>
                                                                            <th className="px-4 py-2 w-12"></th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody className="divide-y divide-divider">
                                                                        {kits.map(kit => (
                                                                            <tr key={kit.id} className="hover:bg-theme-bg/50">
                                                                                <td className="px-4 py-2 font-medium text-text-primary">
                                                                                    {products.find(p => p.id === kit.produto_id)?.nome || kit.produto_id}
                                                                                </td>
                                                                                <td className="px-4 py-2 text-center">{Number(kit.quantidade)}</td>
                                                                                <td className="px-4 py-2 text-right">
                                                                                    <button onClick={() => handleDeleteKit(kit.id, item.id)} className="text-text-muted hover:text-status-danger cursor-pointer"><Trash2 size={14} /></button>
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                        ) : (
                                                            <div className="text-sm text-text-muted italic">Nenhum sub-item adicionado a esta composição.</div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal de Inserção de Item */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-surface w-full max-w-lg rounded-2xl shadow-xl border border-divider overflow-hidden animate-in slide-in-from-bottom-4">
                        <div className="px-6 py-4 border-b border-divider flex items-center justify-between bg-theme-bg/50">
                            <h2 className="text-lg font-bold text-text-primary">{kitParentId ? 'Adicionar Composição (Kit)' : 'Adicionar Item Principal'}</h2>
                            <button onClick={closeModal} className="text-text-muted hover:text-text-primary p-2">✕</button>
                        </div>
                        <form onSubmit={handleAddSubmit} className="p-6 space-y-4">

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-muted uppercase tracking-wider block">Produto do Catálogo</label>
                                <select
                                    required
                                    value={selectedProduct}
                                    onChange={(e) => setSelectedProduct(e.target.value)}
                                    className="w-full px-4 py-3 rounded-lg border border-divider bg-surface focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
                                >
                                    <option value="">Selecione um produto...</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.nome}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-text-muted uppercase tracking-wider block">Quantidade</label>
                                    <input
                                        type="number"
                                        required
                                        min="0.0001"
                                        step="0.0001"
                                        value={quantidade}
                                        onChange={(e) => setQuantidade(Number(e.target.value))}
                                        className="w-full px-4 py-3 rounded-lg border border-divider bg-surface focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
                                    />
                                </div>
                                {!kitParentId && (
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-text-muted uppercase tracking-wider block">Valor Venda (Unitário)</label>
                                        <input
                                            type="number"
                                            required
                                            step="0.01"
                                            min="0"
                                            value={valorVenda}
                                            onChange={(e) => setValorVenda(Number(e.target.value))}
                                            className="w-full px-4 py-3 rounded-lg border border-divider bg-surface focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 outline-none"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="pt-4 border-t border-divider flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-5 py-2.5 rounded-lg text-text-muted hover:text-text-primary hover:bg-theme-bg font-medium transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading || !selectedProduct}
                                    className="px-5 py-2.5 rounded-lg bg-brand-primary text-white font-medium hover:bg-brand-primary/90 transition-colors disabled:opacity-50"
                                >
                                    Confirmar Item
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
