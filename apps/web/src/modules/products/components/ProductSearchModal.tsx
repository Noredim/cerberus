import { useState, useEffect } from 'react';
import { Search, Loader2, Package, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { productApi } from '../api/productApi';

interface ProductSearchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (product: any) => void;
}

export function ProductSearchModal({ isOpen, onClose, onSelect }: ProductSearchModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSearchQuery('');
            setProducts([]);
            fetchProducts('');
        }
    }, [isOpen]);

    const fetchProducts = async (q: string) => {
        setLoading(true);
        try {
            const data = await productApi.list({ q });
            setProducts(data);
        } catch (error) {
            console.error('Error fetching products:', error);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isOpen) return;
        const timer = setTimeout(() => {
            fetchProducts(searchQuery);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchQuery, isOpen]);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="relative bg-surface w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl overflow-hidden"
                >
                    <div className="px-6 py-5 flex items-center justify-between border-b border-border-subtle flex-none bg-surface z-10">
                        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 text-brand-primary flex items-center justify-center">
                                <Search size={20} />
                            </div>
                            Buscar Produto
                        </h2>
                        <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-deep rounded-xl transition-colors cursor-pointer">
                            <X size={20} />
                        </button>
                    </div>

                    <div className="p-6 border-b border-border-subtle bg-bg-deep/10">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Digite o nome, código ou NCM do produto..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-4 py-3 rounded-xl border border-border-subtle bg-surface focus:border-brand-primary outline-none transition-all text-sm shadow-sm"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 bg-bg-deep/5">
                        {loading && products.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-text-muted">
                                <Loader2 className="w-8 h-8 animate-spin mb-4 text-brand-primary" />
                                <p className="text-sm font-medium">Buscando produtos...</p>
                            </div>
                        ) : products.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-text-muted bg-surface rounded-xl border border-dashed border-border-subtle">
                                <Package className="w-8 h-8 mb-3 opacity-50" />
                                <p className="text-sm font-medium">Nenhum produto encontrado...</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {products.map((product) => (
                                    <div
                                        key={product.id}
                                        onClick={() => {
                                            onSelect(product);
                                            onClose();
                                        }}
                                        className="flex items-center justify-between p-4 rounded-xl border border-border-subtle bg-surface hover:border-brand-primary/50 hover:shadow-md transition-all cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-lg bg-bg-deep border border-border-subtle flex items-center justify-center flex-shrink-0 group-hover:bg-brand-primary/5 transition-colors">
                                                <Package className="w-6 h-6 text-text-muted group-hover:text-brand-primary transition-colors" />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-xs font-bold text-text-muted bg-bg-deep px-2 py-0.5 rounded uppercase tracking-wider">
                                                        {product.codigo || 'SEM CÓDIGO'}
                                                    </span>
                                                    {product.ncm_codigo && (
                                                        <span className="text-xs font-bold text-text-muted bg-bg-deep px-2 py-0.5 rounded uppercase tracking-wider">
                                                            NCM: {product.ncm_codigo}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="text-sm font-bold text-text-primary group-hover:text-brand-primary transition-colors">
                                                    {product.nome}
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="text-brand-primary font-bold text-sm bg-brand-primary/10 px-4 py-2 rounded-lg group-hover:bg-brand-primary group-hover:text-white transition-colors">
                                            Selecionar
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
