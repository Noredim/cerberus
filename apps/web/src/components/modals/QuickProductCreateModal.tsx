import React, { useState, useEffect } from 'react';
import { X, Save, Loader2, Package } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../../services/api';
import { productApi } from '../../modules/products/api/productApi';
import { useAuth } from '../../contexts/AuthContext';

interface QuickProductCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: any) => void;
  initialData?: {
    nome?: string;
    ncm?: string;
    descricao?: string;
    supplier_id?: string;
    codigo_fornecedor?: string;
  };
}

export function QuickProductCreateModal({
  isOpen,
  onClose,
  onSuccess,
  initialData
}: QuickProductCreateModalProps) {
  const { activeCompanyId } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    company_id: '',
    nome: '',
    ncm_codigo: '',
    tipo: '', // Initially empty to force selection if NCM is missing
    descricao: '',
    marca: '',
    modelo: '',
    fabricante: '',
    part_number: ''
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({
        company_id: activeCompanyId || '',
        nome: initialData?.nome || initialData?.descricao || '',
        ncm_codigo: initialData?.ncm || '',
        tipo: initialData?.ncm ? 'EQUIPAMENTO' : '',
        descricao: initialData?.descricao || '',
        marca: '',
        modelo: '',
        fabricante: '',
        part_number: ''
      });
      setError('');
      fetchCompanies();
    }
  }, [isOpen, initialData]);

  const fetchCompanies = async () => {
    try {
      const cmpRes = await api.get('/companies');
      setCompanies(cmpRes.data);
      // Fallback only if no activeCompanyId is set and we have companies
      if (cmpRes.data.length > 0 && !activeCompanyId) {
        setFormData(prev => ({ 
          ...prev, 
          company_id: cmpRes.data[0].id 
        }));
      }
    } catch (err) {
      console.error('Error fetching companies', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.company_id || !formData.nome || !formData.tipo) return;

    setError('');
    setLoading(true);
    try {
      const suppliers = [];
      if (initialData?.supplier_id && initialData?.codigo_fornecedor) {
        suppliers.push({
          supplier_id: initialData.supplier_id,
          codigo_externo: initialData.codigo_fornecedor,
          unidade: 'UN',
          fator_conversao: '1'
        });
      }

      const payload = {
        company_id: formData.company_id,
        nome: formData.nome,
        descricao: formData.descricao,
        ncm_codigo: formData.ncm_codigo,
        tipo: formData.tipo as any,
        finalidade: 'REVENDA' as const,
        unidade: 'UN',
        categoria: '',
        marca: formData.marca,
        modelo: formData.modelo,
        fabricante: formData.fabricante,
        part_number: formData.part_number,
        cest_codigo: '',
        cmt_codigo: '',
        ativo: true,
        suppliers
      };

      const newProduct = await productApi.create(payload);
      onSuccess(newProduct);
      onClose();
    } catch (err: any) {
      console.error('Save error:', err);
      setError('Falha ao salvar produto: ' + (err.response?.data?.detail || err.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
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
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-text-primary tracking-tight">Cadastro Rápido</h2>
              <p className="text-xs text-text-muted">Adicione o produto para vinculá-lo imediatamente</p>
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
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Empresa Vinculada *</label>
            <select
              required
              value={formData.company_id}
              onChange={e => setFormData({ ...formData, company_id: e.target.value })}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary cursor-pointer h-11"
            >
              <option value="">Selecione uma empresa...</option>
              {companies.map(c => (
                <option key={c.id} value={c.id}>
                  {c.nome_fantasia || c.razao_social}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Nome do Produto *</label>
            <input
              type="text"
              required
              value={formData.nome}
              onChange={e => setFormData({ ...formData, nome: e.target.value })}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary h-11"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Tipo de Item *</label>
            <select
              required
              value={formData.tipo}
              onChange={e => setFormData({ ...formData, tipo: e.target.value })}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary cursor-pointer h-11"
            >
              <option value="">Selecione o tipo...</option>
              <option value="EQUIPAMENTO">Produto</option>
              <option value="SERVICO">Serviço</option>
              <option value="LICENCA">Licença</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">NCM (Opcional)</label>
            <input
              type="text"
              value={formData.ncm_codigo}
              onChange={e => setFormData({ ...formData, ncm_codigo: e.target.value })}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm focus:border-brand-primary outline-none transition-colors font-mono tracking-wide h-11"
              placeholder="Ex: 8517.62.39"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Marca (Opcional)</label>
              <input
                type="text"
                value={formData.marca}
                onChange={e => setFormData({ ...formData, marca: e.target.value })}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm focus:border-brand-primary outline-none transition-colors h-11"
                placeholder="Ex: Dell"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Modelo (Opcional)</label>
              <input
                type="text"
                value={formData.modelo}
                onChange={e => setFormData({ ...formData, modelo: e.target.value })}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm focus:border-brand-primary outline-none transition-colors h-11"
                placeholder="Ex: R740"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Fabricante (Opcional)</label>
              <input
                type="text"
                value={formData.fabricante}
                onChange={e => setFormData({ ...formData, fabricante: e.target.value })}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm focus:border-brand-primary outline-none transition-colors h-11"
                placeholder="Ex: Dell Technologies"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Part Number (Opcional)</label>
              <input
                type="text"
                value={formData.part_number}
                onChange={e => setFormData({ ...formData, part_number: e.target.value })}
                className="w-full bg-bg-deep border border-border-subtle rounded-md py-2.5 px-4 text-sm focus:border-brand-primary outline-none transition-colors h-11 font-mono"
                placeholder="Ex: PN-12345"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-text-muted uppercase tracking-wider">Descrição (Opcional)</label>
            <textarea
              value={formData.descricao}
              onChange={e => setFormData({ ...formData, descricao: e.target.value })}
              className="w-full bg-bg-deep border border-border-subtle rounded-md py-3 px-4 outline-none focus:border-brand-primary transition-colors text-sm text-text-primary min-h-[80px] resize-none"
              placeholder="Informações técnicas complementares..."
            />
          </div>

          {initialData?.codigo_fornecedor && (
            <div className="mt-4 p-3 bg-brand-primary/5 rounded-lg border border-brand-primary/10 text-xs text-text-muted">
              <strong>Info:</strong> O código <strong>{initialData.codigo_fornecedor}</strong> será vinculado automaticamente a este fornecedor.
            </div>
          )}

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
              disabled={loading || !formData.company_id || !formData.nome || !formData.tipo}
              className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-lg font-bold hover:bg-brand-primary/90 transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 cursor-pointer text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Cadastrar e Vincular
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
