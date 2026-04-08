import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Plus } from 'lucide-react';
import { QuickCustomerCreateModal } from '../../components/modals/QuickCustomerCreateModal';

// Fallback se toast
const toast = {
    success: (msg: string) => alert(msg),
    error: (msg: string) => alert(msg)
};
// import { QuickCustomerCreateModal } from '../customers/modals/QuickCustomerCreateModal';

interface SalesProposalCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const SalesProposalCreateModal: React.FC<SalesProposalCreateModalProps> = ({ isOpen, onClose }) => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [isSaving, setIsSaving] = useState(false);
    
    // Form States
    const [titulo, setTitulo] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [vendedorId, setVendedorId] = useState('');
    const [observacoes, setObservacoes] = useState('');
    
    // Modal states
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    
    const [professionals, setProfessionals] = useState<any[]>([]);
    const [customers, setCustomers] = useState<any[]>([]);

    const loadCustomers = async () => {
        try {
            const { data } = await api.get('/cadastro/clientes', { params: { limit: 500 } });
            setCustomers(Array.isArray(data) ? data : data.items || []);
        } catch (err) {
            console.error('Erro ao carregar clientes:', err);
        }
    };

    const loadProfessionals = async () => {
        try {
            const { data } = await api.get('/professionals', { params: { limit: 500 } });
            const items = Array.isArray(data) ? data : data.items || [];
            const validSellers = items.filter((p: any) => p.role?.can_perform_sale === true);
            setProfessionals(validSellers);
        } catch (err) {
            console.error('Erro ao carregar profissionais:', err);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadProfessionals();
            loadCustomers();
        }
    }, [isOpen]);

    const handleCustomerCreated = (newCustomer: any) => {
        setIsCustomerModalOpen(false);
        loadCustomers(); // Reload list
        setCustomerId(newCustomer.id); // Auto-select the newly created customer
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!titulo || !customerId) {
            toast.error('Preencha os campos obrigatórios.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                titulo,
                customer_id: customerId,
                vendedor_id: vendedorId || null,
                observacoes,
            };
            const res = await api.post('/sales-proposals', payload);
            toast.success('Proposta criada. Entrando na tela de detalhamento...');
            onClose();
            navigate(`/comercial/propostas/${res.data.id}`);
        } catch (error: any) {
            toast.error(error.response?.data?.detail || 'Erro ao criar proposta.');
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-surface rounded-lg shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-4 border-b border-border-subtle bg-bg-base shrink-0">
                    <h2 className="text-xl font-semibold text-text-primary">Lançar Nova Proposta</h2>
                    <button onClick={onClose} className="p-2 hover:bg-bg-deep rounded-md transition-colors text-text-muted hover:text-text-primary">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                    <form id="create-proposal-form" onSubmit={onSubmit} className="space-y-4">
                        
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                                Título da Proposta *
                            </label>
                            <input
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                                required
                                maxLength={150}
                                type="text"
                                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none transition-all"
                                placeholder="Ex: Projeto Sistema CFTV Matriz"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="flex items-center justify-between text-sm font-medium text-text-secondary mb-1">
                                    <span>Cliente *</span>
                                    <button 
                                        type="button" 
                                        onClick={() => setIsCustomerModalOpen(true)}
                                        className="text-brand-primary hover:text-brand-primary/80 flex items-center gap-1 text-xs bg-brand-primary/5 px-2 py-0.5 rounded"
                                    >
                                        <Plus className="w-3 h-3" />
                                        Novo
                                    </button>
                                </label>
                                <select
                                    value={customerId}
                                    onChange={(e) => setCustomerId(e.target.value)}
                                    required
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none transition-all"
                                >
                                    <option value="">Selecione um cliente</option>
                                    {customers.map((c: any) => (
                                         <option key={c.id} value={c.id}>{c.razao_social}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">
                                    Vendedor (Opcional)
                                </label>
                                <select
                                    value={vendedorId}
                                    onChange={(e) => setVendedorId(e.target.value)}
                                    className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none transition-all"
                                >
                                    <option value="">Nenhum Vendedor</option>
                                    {professionals.map((p: any) => (
                                         <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                                Responsável
                            </label>
                            <input
                                type="text"
                                disabled
                                value={user?.name || ''}
                                className="w-full bg-bg-base border border-border-subtle rounded-md px-3 py-2 text-text-muted cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">
                                Observações
                            </label>
                            <textarea
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                                maxLength={300}
                                className="w-full bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-text-primary focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 outline-none transition-all resize-none h-24"
                                placeholder="..."
                            ></textarea>
                        </div>
                    </form>
                </div>

                <div className="flex items-center justify-end gap-3 p-4 border-t border-border-subtle bg-bg-base shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 hover:bg-bg-deep rounded-md transition-colors text-text-primary font-medium"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        form="create-proposal-form"
                        disabled={isSaving}
                        className="px-6 py-2 bg-brand-primary text-white font-medium rounded-md hover:bg-brand-primary/90 transition-colors shadow-sm disabled:opacity-50"
                    >
                        {isSaving ? 'Salvando...' : 'Lançar Proposta'}
                    </button>
                </div>
            </div>
            
            <QuickCustomerCreateModal 
                isOpen={isCustomerModalOpen} 
                onClose={() => setIsCustomerModalOpen(false)}
                onSuccess={handleCustomerCreated}
            />
        </div>
    );
};
