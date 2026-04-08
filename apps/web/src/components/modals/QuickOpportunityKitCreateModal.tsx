import React, { useState } from 'react';
import { X, Save, Loader2, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface QuickOpportunityKitCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (kit: any) => void;
  defaultTipoContrato?: string;
  salesProposalId?: string;
}

export function QuickOpportunityKitCreateModal({
  isOpen,
  onClose,
  onSuccess,
  defaultTipoContrato = 'VENDA_EQUIPAMENTOS',
  salesProposalId
}: QuickOpportunityKitCreateModalProps) {
  const { activeCompanyId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    nome_kit: '',
    descricao_kit: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome_kit) return;

    setError('');
    setLoading(true);
    
    try {
      const payload: Record<string, any> = {
          nome_kit: formData.nome_kit,
          descricao_kit: formData.descricao_kit || null,
          tipo_contrato: defaultTipoContrato,
          prazo_contrato_meses: 0,
          prazo_instalacao_meses: 0,
          sales_proposal_id: salesProposalId
      };

      if (!activeCompanyId) throw new Error("Empresa não selecionada");

      const res = await api.post(`/opportunity-kits/company/${activeCompanyId}`, payload);
      onSuccess(res.data);
      onClose();
      
      setFormData({
        nome_kit: '',
        descricao_kit: ''
      });
    } catch (err: any) {
      console.error('Save error:', err);
      setError('Falha ao salvar kit: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
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
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-text-primary tracking-tight">Novo Kit Comercial</h2>
              <p className="text-xs text-text-muted">Inicia um agrupamento vazio para edição</p>
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
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome Comercial do Kit *</label>
            <input
              type="text"
              required
              value={formData.nome_kit}
              onChange={e => setFormData({ ...formData, nome_kit: e.target.value })}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
              placeholder="Ex: Servidor Físico Completo"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Descrição (Opcional)</label>
            <textarea
              value={formData.descricao_kit}
              onChange={e => setFormData({ ...formData, descricao_kit: e.target.value })}
              className="w-full h-24 resize-none bg-bg-deep border border-border-subtle rounded-md px-3 py-2 text-text-primary focus:border-brand-primary outline-none transition-colors text-sm"
              placeholder="Notas descritivas deste escopo..."
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-border-subtle">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg font-bold text-text-muted hover:bg-bg-deep transition-colors cursor-pointer text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || !formData.nome_kit}
              className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 cursor-pointer text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Projetar Kit
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
