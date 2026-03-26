import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Receipt, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { QuickCustomerCreateModal } from './QuickCustomerCreateModal';
import { useAuth } from '../../contexts/AuthContext';

interface OpportunityCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (id: string, newTitulo?: string, newCustomerId?: string) => void;
  initialData?: { id: string; titulo: string; customerId: string };
}

export function OpportunityCreateModal({ isOpen, onClose, onSuccess, initialData }: OpportunityCreateModalProps) {
  const [loading, setLoading] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [vendedorId, setVendedorId] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [error, setError] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    if (isOpen) {
      loadCustomers();
      loadProfessionals();
      // Reset state or set initialData
      if (initialData) {
        setTitulo(initialData.titulo || '');
        setCustomerId(initialData.customerId || '');
        // In edit mode we don't necessarily load original vendor, since it's immutable
        // But if we do, it won't be editable. We'll leave it empty to simplify since 
        // the form backend doesn't overwrite if omitted properly, wait actually it shouldn't clear it.
      } else {
        setTitulo('');
        setCustomerId('');
        setVendedorId('');
      }
      setError('');
    }
  }, [isOpen, initialData]);

  const loadCustomers = async () => {
    try {
      const { data } = await api.get('/cadastro/clientes', { params: { limit: 500 } });
      setCustomers(Array.isArray(data) ? data : data.items || []);
    } catch (err) {
      console.error('Falha ao carregar clientes:', err);
    }
  };

  const loadProfessionals = async () => {
    try {
      const { data } = await api.get('/professionals', { params: { limit: 500 } });
      const items = Array.isArray(data) ? data : data.items || [];
      // Filtrar profissionais cujo cargo permite realizar venda
      const validSellers = items.filter((p: any) => p.role?.can_perform_sale === true);
      setProfessionals(validSellers);
    } catch (err) {
      console.error('Falha ao carregar profissionais:', err);
    }
  };

  const handleCustomerCreated = (newCustomer: any) => {
    setCustomers(prev => [...prev, newCustomer]);
    setCustomerId(newCustomer.id);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo || !customerId) {
        setError("Título e Cliente são obrigatórios.");
        return;
    }
    if (!initialData && !vendedorId) {
        setError("Vendedor é obrigatório.");
        return;
    }
    
    setError('');
    setLoading(true);
    
    try {
       if (initialData?.id) {
         // Edit mode (do not touch vendedor_id or responsavel_ids)
         await api.patch(`/sales-budgets/${initialData.id}/header`, { titulo, customer_id: customerId });
         onSuccess(initialData.id, titulo, customerId);
       } else {
         // Create mode
         const payload = {
           titulo,
           customer_id: customerId,
           vendedor_id: vendedorId,
           responsavel_ids: user?.id ? [user.id] : [],
           data_orcamento: new Date().toISOString().slice(0, 10),
           status: 'RASCUNHO'
         };
         const res = await api.post('/sales-budgets', payload);
         onSuccess(res.data.id, titulo, customerId);
       }
    } catch (err: any) {
       console.error(err);
       setError(`Falha ao ${initialData?.id ? 'editar' : 'criar'} oportunidade: ` + (err.response?.data?.detail || err.message));
    } finally {
       setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        />
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-lg bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col"
        >
            <div className="p-6 border-b border-border-subtle bg-bg-deep flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-brand-primary/10 rounded-lg text-brand-primary">
                <Receipt className="w-5 h-5" />
                </div>
                <div>
                <h2 className="text-xl font-display font-bold text-text-primary tracking-tight">
                  {initialData?.id ? 'Editar Cabeçalho' : 'Nova Oportunidade'}
                </h2>
                <p className="text-xs text-text-muted">
                  {initialData?.id ? 'Altere os dados principais da oportunidade' : 'Preencha o cabeçalho para iniciar'}
                </p>
                </div>
            </div>
            <button
                onClick={onClose}
                className="p-2 text-text-muted hover:text-text-primary hover:bg-surface rounded-lg transition-colors cursor-pointer"
            >
                <X className="w-5 h-5" />
            </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {error && (
                <div className="p-3 bg-brand-danger/10 border border-brand-danger/20 rounded-lg text-xs text-brand-danger">
                {error}
                </div>
            )}

            <div className="space-y-1.5">
                <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Título *</label>
                <input
                    type="text"
                    required
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                    placeholder="Ex: Instalação CCTV Matriz"
                />
            </div>

            <div className="space-y-1.5">
                <label className="flex justify-between items-center text-sm font-bold text-text-muted uppercase tracking-wider">
                   <span>Cliente *</span>
                   <button 
                     type="button" 
                     onClick={() => setShowQuickCustomer(true)}
                     className="text-brand-primary hover:underline normal-case text-xs flex items-center gap-1"
                   >
                     <Plus className="w-3 h-3" /> Novo
                   </button>
                </label>
                <select
                    required
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
                >
                    <option value="">Selecione um cliente...</option>
                    {customers.map(c => (
                        <option key={c.id} value={c.id}>{c.nome_fantasia || c.razao_social}</option>
                    ))}
                </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Vendedor *</label>
                    <select
                        required={!initialData?.id}
                        disabled={!!initialData?.id}
                        value={vendedorId}
                        onChange={e => setVendedorId(e.target.value)}
                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11 disabled:opacity-60"
                    >
                        {!!initialData?.id ? (
                          <option value="">Não modificável</option>
                        ) : (
                          <>
                            <option value="">Selecione um vendedor...</option>
                            {professionals.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </>
                        )}
                    </select>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-bold text-text-muted uppercase tracking-wider">Responsável *</label>
                    <input
                        type="text"
                        disabled
                        value={user?.name || 'Carregando...'}
                        className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none text-sm text-text-primary h-11 disabled:opacity-60 cursor-not-allowed"
                    />
                </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2.5 rounded-lg font-bold text-text-muted hover:bg-bg-deep transition-colors cursor-pointer text-sm"
                >
                    Cancelar
                </button>
                <Button
                    type="submit"
                    disabled={loading || !titulo || !customerId}
                    className="flex items-center gap-2 font-bold cursor-pointer text-sm"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {initialData?.id ? 'Salvar Alterações' : 'Criar e Continuar'}
                </Button>
            </div>
            </form>
        </motion.div>
        </div>

        <QuickCustomerCreateModal 
          isOpen={showQuickCustomer} 
          onClose={() => setShowQuickCustomer(false)}
          onSuccess={handleCustomerCreated} 
        />
    </>
  );
}
